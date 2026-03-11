#!/usr/bin/env python3
"""
Unicorn-based inner LZSS decompressor for ALEX1.EXE - v3.

Key insight: HackStop decrypts the code image and places the output
at a HIGHER memory address (code offset 0x10100 to 0x2067E).
The inner LZSS decompressor is at the END of the decrypted output.
The decompressor reads from within the decrypted region and writes
to the beginning of memory (code offset 0x0100).

Full memory layout at time inner decompressor runs:
  LOAD_SEG:0000 to LOAD_SEG:11C7F = original code image (72832 bytes)
  (LOAD_SEG+0x1010):0000 onwards  = HackStop-decrypted data (72464 bytes)

The inner decompressor (at the end of the decrypted data) reads
compressed data from within the decrypted region and decompresses
to fill LOAD_SEG:0100 onwards.
"""

import struct
from pathlib import Path
import sys
sys.path.insert(0, '/tmp')
from unicorn import *
from unicorn.x86_const import *

DEFAULT_EXE_PATH = Path('game/ALEX/ALEX1.EXE')
DEFAULT_DECRYPTED_PATH = Path('game_decrypted/bin/ALEX1_decrypted.bin')
DEFAULT_UNPACKED_PATH = Path('game_decrypted/bin/ALEX1_unpacked.bin')

def load_original_and_decrypted(exe_path, decrypted_path):
    """Load both the original EXE code and HackStop-decrypted data."""
    with open(exe_path, 'rb') as f:
        exe = f.read()

    # MZ header
    header_para = struct.unpack_from('<H', exe, 8)[0]
    header_size = header_para * 16  # 32 bytes
    code_image = exe[header_size:]
    print(f"Original EXE code image: {len(code_image)} bytes")

    with open(decrypted_path, 'rb') as f:
        decrypted = f.read()
    print(f"HackStop-decrypted data: {len(decrypted)} bytes")

    # HackStop dst offset in code image: 0x2067E
    # But that's computed as: dst_seg * 16 - 0x100 + dst_off
    # dst_seg = 0x1EC6, dst_off = 0x1B1E
    # = 0x1EC60 - 0x100 + 0x1B1E = 0x2067E
    #
    # The decryption writes backwards, total 72464 bytes.
    # So it fills from 0x2067E - 72464 + 2 = 0x2067E - 0x11B10 + 2 = 0xEB70
    # Wait, it writes backwards with STOSW, DI decreasing, and there's segment wrapping.
    #
    # Actually, let me reconsider. The HackStop header says:
    # Dest ptr: 1EC6:1B1E → after fixup: (1EC6 + PSP):1B1E
    # With STD, first STOSW writes to ES:DI = (1EC6+PSP):1B1E, then DI -= 2
    # After first chunk (3464 words), DI = 1B1E - 3464*2 = 1B1E - 1B20 = FFFE (wraps)
    # Then ES -= 0x800, DI += 0x8000 etc.
    #
    # The key point is: where does the decrypted data end up in the memory image?
    # From unpack_hackstop.py: dst code offset = 0x2067E, going backwards.
    # Total 72464 bytes = 0x11B10 bytes
    # So the decrypted data spans code offsets: 0x2067E - 0x11B10 + 2 = 0xEB70
    # From 0x0EB70 to 0x2067E
    #
    # But that's a destination CODE offset, not raw. Actually...
    # HackStop decrypts src → dst in memory. Both are in the loaded code image area.
    # The dest is at a much higher offset because the program requested lots of extra memory.

    # The inner decompressor (within the decrypted data) is at:
    # decrypted offset 0x118F0 (from the decrypted.bin file)
    # which maps to code offset 0xEB70 + 0x118F0 ... no, that doesn't work.

    # Let me think differently. The decrypted.bin is a flat dump of the decrypted output.
    # In memory, this data exists at the destination location.
    # The destination ends at code offset 0x2067E (the first word written).
    # With STD, subsequent words go to lower addresses.
    # So the decrypted data in memory spans:
    #   high end: code offset 0x2067E (+ 1, for the full word)
    #   low end: 0x2067E - 72464 + 2 = 0xEB70
    #
    # decrypted.bin[0] = byte at code offset 0x0EB70
    # decrypted.bin[72463] = byte at code offset 0x2067F

    dst_start_code = 0x0EB70  # where decrypted[0] goes in memory

    print(f"Decrypted data maps to code offsets 0x{dst_start_code:05x} to 0x{dst_start_code + len(decrypted) - 1:05x}")

    # The inner decompressor at decrypted offset 0x118F0 is at code offset:
    decomp_code_offset = dst_start_code + 0x118F0
    print(f"Decompressor at code offset 0x{decomp_code_offset:05x}")
    # That's way too high... 0x0EB70 + 0x118F0 = 0x20460

    # Actually, let me reconsider the destination calculation.
    # HackStop writes backwards: first word goes to the highest address.
    # unpack_hackstop.py builds the output array forwards: all_decrypted[0] = first
    # byte of the final in-memory data (lowest address).
    #
    # So in memory:
    # Code offset 0x0EB70 = all_decrypted[0]  (LOWEST byte of decrypted output)
    # Code offset 0x2067F = all_decrypted[72463] (HIGHEST byte)
    #
    # The decompressor parameter block at all_decrypted[0x118F0]:
    # Code offset = 0x0EB70 + 0x118F0 = 0x20460
    # That's code segment 0x2046, offset 0x0

    # But the decompressor's source points back into this same decrypted data:
    # src_seg_raw = 0x0EC7, after fixup: 0x0EC7 + LOAD_SEG
    # For LOAD_SEG = segment at which code image starts (let's call it L)
    # src linear = (L + 0x0EC7) * 16 = L*16 + 0x0EC70
    # Code offset = 0x0EC70
    # That's within the decrypted range (0x0EB70 to 0x2067F): CHECK ✓
    # decrypted data offset = 0x0EC70 - 0x0EB70 = 0x0100
    # So the source data in decrypted.bin starts at offset 0x0100!

    print(f"\nSource data in decrypted.bin: offset 0x{0x0EC70 - dst_start_code:04x}")
    # Source = decrypted[0x100:...] = the compressed LZSS payload

    # And the output goes to LOAD_SEG:0100 = code offset 0x0100
    # That's BEFORE the decrypted data area (0x0100 < 0x0EB70)
    # So the decompressor reads from within decrypted data and writes to
    # the ORIGINAL code image area (which is mostly the encrypted HackStop data
    # at this point, about to be overwritten by the decompressed program).

    return code_image, decrypted, dst_start_code


def emulate(exe_path=DEFAULT_EXE_PATH, decrypted_path=DEFAULT_DECRYPTED_PATH,
            out_file=DEFAULT_UNPACKED_PATH):
    code_image, decrypted, dst_start_code = load_original_and_decrypted(exe_path, decrypted_path)

    LOAD_SEG = 0x1000
    LOAD_ADDR = LOAD_SEG << 4
    PSP_SEG = LOAD_SEG - 0x10

    MEM_SIZE = 1024 * 1024
    mu = Uc(UC_ARCH_X86, UC_MODE_16)
    mu.mem_map(0, MEM_SIZE)

    # Load original code image at LOAD_ADDR
    mu.mem_write(LOAD_ADDR, code_image)
    print(f"Loaded original code image at 0x{LOAD_ADDR:05x} ({len(code_image)} bytes)")

    # Overlay decrypted data at its correct location
    dec_addr = LOAD_ADDR + dst_start_code
    mu.mem_write(dec_addr, decrypted)
    print(f"Loaded decrypted data at 0x{dec_addr:05x} ({len(decrypted)} bytes)")

    # PSP
    top_seg = 0x9000
    mu.mem_write(PSP_SEG * 16 + 2, struct.pack('<H', top_seg))

    # The decompressor is at code offset 0x20460 = LOAD_ADDR + 0x20460 = 0x30460
    # CS = LOAD_SEG + (0x20460 >> 4) = 0x1000 + 0x2046 = 0x3046
    decomp_code_offset = dst_start_code + 0x118F0
    DECOMP_SEG = LOAD_SEG + (decomp_code_offset >> 4)
    print(f"Decompressor CS: 0x{DECOMP_SEG:04x}")

    # Verify decompressor code is in place
    decomp_addr = DECOMP_SEG * 16
    first_bytes = bytes(mu.mem_read(decomp_addr, 4))
    print(f"Decompressor first bytes: {first_bytes.hex()} (expect eb49 = JMP +0x4B)")

    # Set up registers: DS = LOAD_SEG (what HackStop sets before jumping)
    # Actually, HackStop's jump target is at jmp_seg:jmp_off = 0x2056:0x0000 (before fixup)
    # After fixup: (0x2056 + PSP):0x0000
    # But the decompressor JMP at offset 0 goes to +0x4B
    # Let me just start at CS:004B

    mu.reg_write(UC_X86_REG_CS, DECOMP_SEG)
    mu.reg_write(UC_X86_REG_DS, LOAD_SEG)
    mu.reg_write(UC_X86_REG_ES, PSP_SEG)
    mu.reg_write(UC_X86_REG_SS, 0x9000)
    mu.reg_write(UC_X86_REG_SP, 0xFFFE)

    start_addr = DECOMP_SEG * 16 + 0x004B

    insn_count = [0]
    stopped = [False]
    stop_reason = [""]

    END_LJMP = DECOMP_SEG * 16 + 0x0149
    END_ERR = DECOMP_SEG * 16 + 0x01A5
    END_EXIT = DECOMP_SEG * 16 + 0x01B7  # INT 21h/4C

    def hook_code(uc, address, size, user_data):
        insn_count[0] += 1
        off = address - DECOMP_SEG * 16

        if address == END_LJMP:
            stopped[0] = True
            stop_reason[0] = "LJMP to unpacked program"
            uc.emu_stop()
            return
        if address == END_ERR:
            stopped[0] = True
            stop_reason[0] = "Error handler"
            uc.emu_stop()
            return

        if insn_count[0] % 2000000 == 0:
            di = uc.reg_read(UC_X86_REG_DI)
            es = uc.reg_read(UC_X86_REG_ES)
            si = uc.reg_read(UC_X86_REG_SI)
            ds = uc.reg_read(UC_X86_REG_DS)
            print(f"  {insn_count[0]//1000000}M insns: DS:SI={ds:04x}:{si:04x} ES:DI={es:04x}:{di:04x}")

    def hook_int(uc, intno, user_data):
        if intno == 0x21:
            ah = (uc.reg_read(UC_X86_REG_AX) >> 8) & 0xFF
            if ah == 0x4C:
                stopped[0] = True
                stop_reason[0] = "DOS EXIT"
                uc.emu_stop()
            elif ah == 0x40:
                bx = uc.reg_read(UC_X86_REG_BX)
                cx = uc.reg_read(UC_X86_REG_CX)
                dx = uc.reg_read(UC_X86_REG_DX)
                ds = uc.reg_read(UC_X86_REG_DS)
                msg = bytes(uc.mem_read(ds * 16 + dx, cx))
                print(f"  DOS WRITE: {msg}")
                stopped[0] = True
                stop_reason[0] = "Error message"
                uc.emu_stop()

    mu.hook_add(UC_HOOK_CODE, hook_code)
    mu.hook_add(UC_HOOK_INTR, hook_int)

    print(f"\nEmulating from CS:004B...")
    try:
        mu.emu_start(start_addr, 0, count=500000000)
    except UcError as e:
        cs = mu.reg_read(UC_X86_REG_CS)
        ip = mu.reg_read(UC_X86_REG_IP)
        ax = mu.reg_read(UC_X86_REG_AX)
        print(f"Error at {cs:04x}:{ip:04x}: {e} (AX={ax:04x})")

    if stopped[0]:
        print(f"Stopped: {stop_reason[0]}")
    print(f"Total instructions: {insn_count[0]}")

    es = mu.reg_read(UC_X86_REG_ES)
    di = mu.reg_read(UC_X86_REG_DI)
    ds = mu.reg_read(UC_X86_REG_DS)
    si = mu.reg_read(UC_X86_REG_SI)
    print(f"Final DS:SI={ds:04x}:{si:04x} ES:DI={es:04x}:{di:04x}")

    # Output is from LOAD_SEG:0100 to ES:DI
    out_start = LOAD_SEG * 16 + 0x0100
    out_end = es * 16 + di
    if out_end <= out_start:
        # Try reading a larger region
        out_end = out_start + 360000
        print(f"Output range wrapped; reading {out_end - out_start} bytes")

    out_size = out_end - out_start
    print(f"Output: 0x{out_start:06x} to 0x{out_end:06x} = {out_size} bytes")

    output = bytes(mu.mem_read(out_start, min(out_size, 400000)))

    # String search
    print(f"\n=== String search ===")
    for target in [b'Trans.BIG', b'TRANS', b'Trans', b'.DAT', b'.NDX',
                   b'COMP', b'WaitCursor', b'HARDDISK', b'CDROM',
                   b'Index entry', b'Overlay', b'.OVR', b'.CFG',
                   b'could not be converted', b'not found', b'Borland',
                   b'Pascal', b'FBOV']:
        pos = output.find(target)
        if pos >= 0:
            ctx = output[max(0,pos-4):pos+len(target)+10]
            ctx_str = ''.join(chr(b) if 32<=b<127 else '.' for b in ctx)
            print(f"  {target!r:30s} at 0x{pos:05x}: {ctx_str}")

    # First 64 bytes
    print(f"\nFirst 64 bytes:")
    for i in range(0, min(64, len(output)), 16):
        hex_str = ' '.join(f'{output[i+j]:02x}' for j in range(min(16, len(output)-i)))
        asc = ''.join(chr(output[i+j]) if 32<=output[i+j]<127 else '.' for j in range(min(16, len(output)-i)))
        print(f"  {i:04x}: {hex_str:48s} {asc}")

    # Write output
    out_file = Path(out_file)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, 'wb') as f:
        f.write(output)
    print(f"\nWritten to: {out_file} ({len(output)} bytes)")

    return output


if __name__ == '__main__':
    exe_path = DEFAULT_EXE_PATH
    decrypted_path = DEFAULT_DECRYPTED_PATH
    out_path = DEFAULT_UNPACKED_PATH
    if len(sys.argv) > 1:
        exe_path = Path(sys.argv[1])
    if len(sys.argv) > 2:
        decrypted_path = Path(sys.argv[2])
    if len(sys.argv) > 3:
        out_path = Path(sys.argv[3])
    emulate(exe_path, decrypted_path, out_path)
