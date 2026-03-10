"""BP7-aware disassembler for ALEX1 unpacked binary.

Borland Pascal 7.0 embeds inline data in the code stream for I/O procedure
calls and string constants. This breaks standard disassemblers (both Ghidra
and capstone) because they can't distinguish code from data.

Known inline data patterns:
  - AA XX XX 6F 7E XX  (6 bytes) — ~309 occurrences, likely I/O dispatch
  - AA XX XX            (3 bytes) — shorter variant (seen in transbig_assign)
  - F7 A9 XX XX         (4 bytes) — may also be inline data (~520 occurrences)

This script disassembles functions while detecting and skipping these inline
blocks, producing clean output that can be manually analyzed.

Usage:
    python3 re/dis_bp7_aware.py [start_offset] [end_offset]
    python3 re/dis_bp7_aware.py                    # defaults to transbig_reader
"""
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

BIN_PATH = 'game/ALEX/ALEX1_unpacked.bin'

with open(BIN_PATH, 'rb') as f:
    data = f.read()

md = Cs(CS_ARCH_X86, CS_MODE_16)
md.detail = False

# Default: transbig_reader (0x17527 to next marker)
DEFAULT_START = 0x17527
DEFAULT_END = 0x17767

def find_inline_block(offset):
    """Check if offset starts an inline data block. Returns (size, description) or (0, None).

    Known BP7 inline patterns:
      F7 A9 XX XX           — 4 bytes: LEA DI, [BP + disp16] equivalent
      67 AA XX XX 6F 7E/8E  — 6 bytes: I/O dispatch (function, returns value in AX/DX:AX)
      60 AA XX XX 6F 7E/8E  — 6 bytes: I/O dispatch (procedure, saves regs with PUSHA)
      AA XX XX 6F 7E/8E     — 5 bytes: I/O dispatch (bare, no prefix)
      AA XX XX              — 3 bytes: I/O dispatch (short form, no error handler)

    The 60/67 prefix distinguishes calling convention:
      60 (PUSHA) = procedure call (saves all registers)
      67 (addr override) = function call (returns value, regs not saved)
    The 6F 7E vs 6F 8E suffix distinguishes error handler variants.
    """
    # Pattern: F7 A9 XX XX — LEA DI, [BP + disp16]
    if offset + 4 <= len(data) and data[offset] == 0xF7 and data[offset + 1] == 0xA9:
        disp = struct.unpack_from('<h', data, offset + 2)[0]
        return 4, f"LEA DI, [BP{disp:+d}]  (0x{disp & 0xFFFF:04x})"

    # Pattern: 67 AA XX XX 6F 7E/8E — function dispatch (6 bytes)
    if (offset + 6 <= len(data) and data[offset] == 0x67
            and data[offset + 1] == 0xAA and data[offset + 4] == 0x6F
            and data[offset + 5] in (0x7E, 0x8E)):
        val = struct.unpack_from('<H', data, offset + 2)[0]
        return 6, f"CALL_IO_FN({val:#06x})  [returns value]"

    # Pattern: 60 AA XX XX 6F 7E/8E — procedure dispatch (6 bytes)
    if (offset + 6 <= len(data) and data[offset] == 0x60
            and data[offset + 1] == 0xAA and data[offset + 4] == 0x6F
            and data[offset + 5] in (0x7E, 0x8E)):
        val = struct.unpack_from('<H', data, offset + 2)[0]
        return 6, f"CALL_IO_PROC({val:#06x})  [saves regs]"

    # Pattern: AA XX XX 6F 7E/8E — bare dispatch (5 bytes)
    if (offset + 5 <= len(data) and data[offset] == 0xAA
            and data[offset + 3] == 0x6F
            and data[offset + 4] in (0x7E, 0x8E)):
        val = struct.unpack_from('<H', data, offset + 1)[0]
        return 5, f"CALL_IO({val:#06x})"

    # Pattern: AA XX XX — short dispatch (3 bytes, no error handler)
    if offset + 3 <= len(data) and data[offset] == 0xAA:
        resume = offset + 3
        if resume < len(data):
            insns = list(md.disasm(data[resume:resume+4], resume))
            if insns and insns[0].mnemonic in (
                'mov', 'push', 'pop', 'call', 'cmp', 'xor', 'add', 'sub',
                'test', 'jmp', 'je', 'jne', 'jb', 'ja', 'jle', 'jge',
                'inc', 'dec', 'lea', 'or', 'and', 'not', 'neg', 'ret',
                'retf', 'leave', 'enter', 'lds', 'les', 'rep', 'imul',
                'int', 'shr', 'shl', 'sar', 'sal', 'adc', 'sbb', 'nop',
                'c6',
            ):
                val = struct.unpack_from('<H', data, offset + 1)[0]
                return 3, f"CALL_IO({val:#06x})  [short]"
    return 0, None


def is_suspicious(mnemonic, op_str):
    """Return True if instruction is likely inline data misinterpreted as code."""
    if mnemonic in ('in', 'out', 'outsb', 'outsw', 'insb', 'insw',
                    'stosb', 'hlt', 'into', 'aaa', 'aas', 'daa', 'das',
                    'salc', 'arpl'):
        return True
    if mnemonic == 'int' and op_str not in ('0x21', '0x3d'):
        return True
    return False


def disassemble_bp7(start, end, label=None):
    """Disassemble a BP7 function, skipping inline data blocks."""
    if label:
        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"  File offset: 0x{start:05x} - 0x{end:05x}")
        print(f"{'='*60}")

    offset = start
    inline_count = 0
    last_was_inline = False

    while offset < end:
        # Check for inline data block
        inline_size, inline_desc = find_inline_block(offset)
        if inline_size > 0:
            block = data[offset:offset + inline_size]
            hex_str = ' '.join(f'{b:02x}' for b in block)
            print(f"  {offset:05x}: {hex_str:<20s} ; {inline_desc}")
            offset += inline_size
            inline_count += 1
            last_was_inline = True
            continue

        # Normal disassembly
        chunk = data[offset:min(offset + 15, end)]
        insns = list(md.disasm(chunk, offset))

        if not insns:
            # Can't decode - show as data byte
            print(f"  {offset:05x}: {data[offset]:02x}                    db 0x{data[offset]:02x}")
            offset += 1
            continue

        insn = insns[0]
        hex_str = ' '.join(f'{b:02x}' for b in insn.bytes)
        suspicious = "  <<< SUSPECT" if is_suspicious(insn.mnemonic, insn.op_str) else ""

        if last_was_inline:
            print(f"  ---- resume code ----")
            last_was_inline = False

        print(f"  {offset:05x}: {hex_str:<20s} {insn.mnemonic} {insn.op_str}{suspicious}")

        # Stop at RETF (end of far procedure)
        if insn.mnemonic == 'retf':
            remaining = end - (offset + insn.size)
            if remaining > 0:
                print(f"  --- RETF reached, {remaining} bytes remaining ---")
                # Show remaining bytes as potential data (strings, etc.)
                rem_start = offset + insn.size
                rem_data = data[rem_start:end]
                # Check for Pascal string
                if rem_data and rem_data[0] < 80 and rem_data[0] > 0:
                    slen = rem_data[0]
                    if slen + 1 <= len(rem_data):
                        try:
                            s = rem_data[1:1+slen].decode('ascii')
                            if all(32 <= ord(c) < 127 for c in s):
                                print(f"  {rem_start:05x}: Pascal string: \"{s}\" (len={slen})")
                        except:
                            pass
                # Also show hex dump
                for i in range(0, min(len(rem_data), 64), 16):
                    chunk = rem_data[i:i+16]
                    hexs = ' '.join(f'{b:02x}' for b in chunk)
                    asci = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
                    print(f"  {rem_start+i:05x}: {hexs:<48s} {asci}")
            break

        offset += insn.size

    print(f"\n  [{inline_count} inline data blocks skipped]")


# --- Find all function boundaries ---
def find_functions():
    """Find all BP7 function boundaries using the marker pattern."""
    functions = []
    i = 0
    while i < len(data) - 10:
        if data[i:i+3] == b'\x65\x64\x20' and data[i+3] == 0xB8:
            marker_offset = i
            # Determine entry point
            check11 = i + 11
            check15 = i + 15
            if check11 < len(data) and data[check11] in (0x81, 0x83) and data[check11+1] == 0xEC:
                entry = check11
            elif check15 < len(data) and data[check15] == 0x8C and data[check15+1] == 0xD3:
                entry = check15
            else:
                entry = check11  # fallback
            functions.append((marker_offset, entry))
            i += 8
        else:
            i += 1
    return functions


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        start = int(sys.argv[1], 0)
        end = int(sys.argv[2], 0)
        disassemble_bp7(start, end, f"Custom range")
    elif len(sys.argv) == 2 and sys.argv[1] == '--all-clean':
        # Find and disassemble functions that have NO inline data
        functions = find_functions()
        print(f"Found {len(functions)} functions total\n")
        clean_count = 0
        for idx, (marker, entry) in enumerate(functions):
            # Find end (next marker or EOF)
            if idx + 1 < len(functions):
                end = functions[idx + 1][0]
            else:
                end = len(data)
            # Check for inline data markers in this function
            has_inline = False
            for j in range(entry, end):
                if data[j] == 0xAA and j + 5 < end:
                    if data[j+3] == 0x6F and data[j+4] == 0x7E:
                        has_inline = True
                        break
            if not has_inline:
                # Check function size (skip tiny ones)
                size = end - entry
                if 10 < size < 500:
                    disassemble_bp7(entry, end, f"Clean function #{idx} (size={size})")
                    clean_count += 1
                    if clean_count >= 20:
                        print(f"\n... showing first 20 clean functions")
                        break
    elif len(sys.argv) == 2 and sys.argv[1] == '--key':
        # Disassemble key functions related to TRANS.BIG
        functions = find_functions()
        key_funcs = [
            (0x17440, "transbig_setup"),
            (0x174D7, "transbig_assign"),
            (0x17527, "transbig_reader"),
            (0x16e2e, "resource_mgr_1"),
            (0x16ec9, "resource_mgr_2"),
            (0x16f7f, "resource_mgr_3"),
            (0x17772, "post_transbig_1"),
            (0x177bf, "post_transbig_2"),
        ]
        for start, name in key_funcs:
            # Find end
            end = start + 0x300  # default max
            for marker, entry in functions:
                if entry > start and entry < end:
                    end = marker
                    break
            disassemble_bp7(start, min(end, start + 0x800), name)
    else:
        # Default: transbig_reader
        disassemble_bp7(DEFAULT_START, DEFAULT_END, "transbig_reader (0x17527)")
