#!/usr/bin/env python3
"""
HackStop EXE Unpacker - Python implementation

Reverse engineered from the packer stub in ALEX1.EXE.
The packer uses CRC-CCITT (polynomial 0x1021) XOR encryption
with a running key, decrypting backwards (STD flag set).

Decompressor code structure (CS:00AE-0166):
  1. SI = 0x0105 + code[1] (word)    -> points to header in code
  2. Build CRC-CCITT table (256 entries) on stack
  3. Apply segment relocations (add DS to header fields)
  4. Read initial key from header[+0x2E]
  5. Read word count from header[+0x0E], chunk count from header[+0x10]
  6. Read source/dest pointers from header
  7. Decrypt in chunks of 0x4000 words (32KB), backwards (STD)
  8. Verify CRC at end, then jump to unpacked entry point
"""

import struct
import sys

def build_crc_table():
    """Build CRC-CCITT lookup table (polynomial 0x1021, 256 entries).

    From code at CS:00CE-00E3:
      MOV BX, 0x1021   ; polynomial
      XOR DX, DX        ; start at byte 0
    loop:
      MOV AX, DX        ; AX = current byte (in DH)
      MOV CX, 8         ; 8 bits
    bit_loop:
      SHL AX, 1
      JNC skip
      XOR AX, BX        ; XOR with polynomial
    skip:
      LOOP bit_loop
      STOSW             ; store to table
      INC DH            ; next byte
      JNZ loop
    """
    table = []
    for i in range(256):
        val = i << 8  # byte in high position (matching MOV AX, DX where DH=i)
        for _ in range(8):
            if val & 0x8000:
                val = ((val << 1) & 0xFFFF) ^ 0x1021
            else:
                val = (val << 1) & 0xFFFF
        table.append(val)
    return table


def decrypt_block(src_data, src_offset, count_words, key, crc_table, backwards=True):
    """Decrypt a block using CRC-XOR algorithm.

    From code at CS:0146-0166:
      LODSW           ; AX = [DS:SI], SI adjusted by direction flag
      XOR AX, DX      ; decrypt with running key
      STOSW           ; store decrypted word
      ; Update key via CRC table:
      BX = DH << 1
      DH = DL, DL = AL
      DX ^= table[BX>>1]
      BX = DH << 1
      DH = DL, DL = AH
      DX ^= table[BX>>1]
    """
    result = bytearray(count_words * 2)
    dx = key

    for i in range(count_words):
        if backwards:
            pos = src_offset - i * 2
        else:
            pos = src_offset + i * 2

        if pos < 0 or pos + 2 > len(src_data):
            print(f"  WARNING: out of bounds at word {i}, pos={pos}")
            break

        encrypted_word = struct.unpack_from('<H', src_data, pos)[0]

        # XOR with key
        ax = encrypted_word ^ dx

        # Store result
        if backwards:
            out_pos = (count_words - 1 - i) * 2
        else:
            out_pos = i * 2
        struct.pack_into('<H', result, out_pos, ax)

        # Update key
        al = ax & 0xFF
        ah = (ax >> 8) & 0xFF
        dh = (dx >> 8) & 0xFF
        dl = dx & 0xFF

        # First CRC step: feed AL
        idx = dh
        dh = dl
        dl = al
        dx = ((dh << 8) | dl) ^ crc_table[idx]

        # Second CRC step: feed AH
        dh = (dx >> 8) & 0xFF
        dl = dx & 0xFF
        idx = dh
        dh = dl
        dl = ah
        dx = ((dh << 8) | dl) ^ crc_table[idx]

    return bytes(result), dx


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <packed.exe> [output.exe]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    with open(input_file, 'rb') as f:
        data = f.read()

    print(f"Input: {input_file} ({len(data)} bytes)")

    # Parse MZ header
    magic = struct.unpack_from('<H', data, 0)[0]
    if magic != 0x5A4D:
        print(f"ERROR: Not an MZ executable (magic=0x{magic:04x})")
        sys.exit(1)

    header_paras = struct.unpack_from('<H', data, 8)[0]
    header_size = header_paras * 16
    init_ss = struct.unpack_from('<H', data, 14)[0]
    init_sp = struct.unpack_from('<H', data, 16)[0]
    init_ip = struct.unpack_from('<H', data, 20)[0]
    init_cs = struct.unpack_from('<H', data, 22)[0]
    min_extra = struct.unpack_from('<H', data, 10)[0]

    print(f"  Header: {header_size} bytes, Entry: {init_cs:04x}:{init_ip:04x}")
    print(f"  Stack: {init_ss:04x}:{init_sp:04x}")
    print(f"  Min extra: {min_extra} paragraphs ({min_extra*16} bytes)")

    code = bytearray(data[header_size:])
    print(f"  Code image: {len(code)} bytes")

    # Verify HackStop signature
    hack_pos = bytes(code).find(b'Hack!')
    if hack_pos >= 0:
        print(f"  HackStop signature at code offset 0x{hack_pos:04x}")
    else:
        print("  WARNING: No 'Hack!' signature found")

    # Calculate SI (header pointer in DS-relative addressing)
    # SI = 0x0105 + word_at_DS:0x0101
    # DS = PSP = load_seg - 0x10
    # DS:0x0101 = code[1] (word)  [since PSP+0x100 = code start]
    si_add = struct.unpack_from('<H', code, 1)[0]
    si_val = (0x0105 + si_add) & 0xFFFF
    print(f"  SI = 0x0105 + 0x{si_add:04x} = 0x{si_val:04x}")

    # Header fields are at DS:SI+offset = code[si_val - 0x100 + offset]
    # Because DS:X maps to code[X - 0x100] (PSP is 0x100 bytes before code)
    hdr_base = si_val - 0x100
    print(f"  Header base in code: 0x{hdr_base:04x}")

    def hdr_word(off):
        return struct.unpack_from('<H', code, hdr_base + off)[0]

    def hdr_dword(off):
        return struct.unpack_from('<I', code, hdr_base + off)[0]

    # Read header fields
    anti_debug = hdr_word(0x0C)
    word_count_first = hdr_word(0x0E)
    chunk_count = hdr_word(0x10)
    src_dword = hdr_dword(0x12)
    src_off = src_dword & 0xFFFF
    src_seg = (src_dword >> 16) & 0xFFFF
    dst_dword = hdr_dword(0x16)
    dst_off = dst_dword & 0xFFFF
    dst_seg = (dst_dword >> 16) & 0xFFFF
    fixup1 = hdr_word(0x18)  # entry CS
    jmp_target = hdr_dword(0x1A)
    jmp_off = jmp_target & 0xFFFF
    jmp_seg = (jmp_target >> 16) & 0xFFFF
    fixup3 = hdr_word(0x1C)
    initial_key = hdr_word(0x2E)
    crc_check = hdr_word(0x30)

    print(f"\n=== HackStop Header ===")
    print(f"  Anti-debug check [+0C]: 0x{anti_debug:04x}")
    print(f"  Word count (first chunk) [+0E]: 0x{word_count_first:04x} ({word_count_first})")
    print(f"  Chunk count [+10]: 0x{chunk_count:04x} ({chunk_count})")
    print(f"  Source ptr [+12]: {src_seg:04x}:{src_off:04x}")
    print(f"  Dest ptr [+16]: {dst_seg:04x}:{dst_off:04x}")
    print(f"  Entry CS (fixup1) [+18]: 0x{fixup1:04x}")
    print(f"  Jump target [+1A]: {jmp_seg:04x}:{jmp_off:04x}")
    print(f"  Fixup3 [+1C]: 0x{fixup3:04x}")
    print(f"  Initial key [+2E]: 0x{initial_key:04x}")
    print(f"  CRC check [+30]: 0x{crc_check:04x}")

    # The source pointer is relative to the load segment (before fixup).
    # In the file, the source data is at:
    # src_seg * 16 + src_off (relative to code image start)
    # But the fixup adds DS (= PSP = load_seg - 0x10) to src_seg.
    # So the actual runtime address is (src_seg + load_seg - 0x10) * 16 + src_off
    # = (src_seg + load_seg) * 16 - 0x100 + src_off
    # For our purposes, in the file: the source is at src_seg * 16 + src_off - 0x100
    # (subtracting 0x100 for PSP offset, since the header stores DS-relative segments)

    # Actually, let me think again. The code does:
    # 1. MOV DX, DS (DX = PSP segment)
    # 2. ADD [SI+0x14], DX  -> src_seg += PSP
    # 3. Then: LDS SI, [SI+0x12] -> loads src_off and (src_seg + PSP) as new DS:SI
    # At runtime: new DS = src_seg + PSP, new SI = src_off
    # Linear address = (src_seg + PSP) * 16 + src_off
    # = (src_seg + load_seg - 0x10) * 16 + src_off
    # = src_seg*16 + load_seg*16 - 0x100 + src_off
    # Relative to code image start (at load_seg*16):
    # = src_seg*16 - 0x100 + src_off

    src_code_offset = src_seg * 16 - 0x100 + src_off
    dst_code_offset = dst_seg * 16 - 0x100 + dst_off

    print(f"\n=== Computed Offsets ===")
    print(f"  Source in code image: 0x{src_code_offset:05x} ({src_code_offset})")
    print(f"  Dest in code image: 0x{dst_code_offset:05x} ({dst_code_offset})")

    # STD is set before decryption, so LODSW goes backwards (SI -= 2)
    # The source starts at src_code_offset and goes backwards
    # The dest starts at dst_code_offset and goes backwards

    # Total words to decrypt:
    # First chunk: word_count_first words
    # Subsequent chunks: 0x4000 words each (from code at 0x122: MOV CX, 0x4000)
    # Number of chunks: chunk_count (from [+0x10])
    # But the first chunk has word_count_first words, then (chunk_count - 1) chunks of 0x4000

    total_words = word_count_first + (chunk_count - 1) * 0x4000
    total_bytes = total_words * 2
    print(f"  Total words: {total_words} ({total_bytes} bytes)")
    print(f"    First chunk: {word_count_first} words ({word_count_first*2} bytes)")
    print(f"    Remaining {chunk_count-1} chunks: {0x4000} words each")

    # Build CRC table
    crc_table = build_crc_table()
    print(f"\n  CRC table built (first 8 entries: {[f'0x{x:04x}' for x in crc_table[:8]]})")

    # Decrypt the data
    # With STD, LODSW decrements SI by 2 each time
    # So source starts at the given offset and goes backwards
    print(f"\n=== Decrypting ===")

    all_decrypted = bytearray(total_bytes)
    key = initial_key

    # Process chunks backwards in memory but building output forwards
    # Actually, let me think about this differently.
    #
    # The decryption writes to ES:DI with STOSW + STD, so DI decreases.
    # The source reads from DS:SI with LODSW + STD, so SI decreases.
    #
    # After each chunk:
    #   SI += 0x8000 (wraps within segment), DS -= 0x800 (advance back)
    #   DI += 0x8000 (wraps within segment), ES -= 0x800 (advance back)
    # Net effect: move to earlier data (lower addresses)
    #
    # So the overall decryption starts from the END of the packed data
    # and works backwards to the beginning.

    # First chunk starts at the high end
    current_src = src_code_offset  # This is the HIGH end starting position
    current_dst_offset = total_bytes  # Write position (from end)

    for chunk_idx in range(chunk_count):
        if chunk_idx == 0:
            count = word_count_first
        else:
            count = 0x4000

        print(f"  Chunk {chunk_idx}: {count} words, src_end=0x{current_src:05x}, key=0x{key:04x}")

        # Decrypt this chunk (backwards)
        decrypted, key = decrypt_block(code, current_src, count, key, crc_table, backwards=True)

        # Place in output
        current_dst_offset -= len(decrypted)
        all_decrypted[current_dst_offset:current_dst_offset+len(decrypted)] = decrypted

        # Move source backwards by the chunk size
        current_src -= count * 2

    print(f"  Final key: 0x{key:04x}")
    print(f"  Expected CRC: 0x{crc_check:04x}")
    if key == crc_check:
        print(f"  *** CRC MATCH! Decryption successful! ***")
    else:
        print(f"  *** CRC MISMATCH! key=0x{key:04x} vs expected=0x{crc_check:04x} ***")

    # Check for sensible content
    # Look for strings in the decrypted data
    print(f"\n=== Decrypted content analysis ===")
    print(f"  Total decrypted: {len(all_decrypted)} bytes")

    # Find ASCII strings
    strings_found = []
    i = 0
    while i < len(all_decrypted) - 3:
        if all(0x20 <= all_decrypted[i+j] < 0x7f for j in range(4)):
            s = ''
            j = i
            while j < len(all_decrypted) and 0x20 <= all_decrypted[j] < 0x7f:
                s += chr(all_decrypted[j])
                j += 1
            if len(s) >= 6:  # Only show strings of 6+ chars
                strings_found.append((i, s))
            i = j
        else:
            i += 1

    print(f"  Strings found (>= 6 chars): {len(strings_found)}")
    for off, s in strings_found[:50]:
        print(f"    0x{off:05x}: {s!r}")
    if len(strings_found) > 50:
        print(f"    ... and {len(strings_found) - 50} more")

    # First 64 bytes
    print(f"\n  First 64 bytes of decrypted data:")
    for i in range(0, min(64, len(all_decrypted)), 16):
        hex_str = ' '.join(f'{all_decrypted[i+j]:02x}' for j in range(min(16, len(all_decrypted)-i)))
        ascii_str = ''.join(chr(all_decrypted[i+j]) if 0x20 <= all_decrypted[i+j] < 0x7f else '.' for j in range(min(16, len(all_decrypted)-i)))
        print(f"    {i:04x}: {hex_str:48s} {ascii_str}")

    # Write output
    if output_file:
        # Build a new MZ executable with the decrypted code
        # The original entry point (before packing) can be found from the header
        # jmp_target [+1A] contains the original entry point (with fixup)
        # But since we don't know the original relocations, let's write the raw data

        # Actually, let's construct a proper MZ EXE
        # The unpacked code replaces the packed code (which starts after the decompressor)
        # The decompressor is at the beginning of the code image

        # For now, just dump the raw decrypted code
        raw_file = output_file.replace('.exe', '.bin').replace('.EXE', '.BIN')
        with open(raw_file, 'wb') as f:
            f.write(all_decrypted)
        print(f"\n  Raw decrypted code written to: {raw_file}")

        # Also try to build a proper MZ EXE
        # The jump target gives us the original entry point
        # jmp_off and jmp_seg (before fixup) give the relative entry
        print(f"\n  Original entry point: {jmp_seg:04x}:{jmp_off:04x} (relative to load seg)")

        # The destination tells us where the unpacked code goes in memory
        print(f"  Unpacked code destination: {dst_seg:04x}:{dst_off:04x}")

    # Write full decrypted dump regardless
    dump_file = input_file.replace('.EXE', '_decrypted.bin').replace('.exe', '_decrypted.bin')
    with open(dump_file, 'wb') as f:
        f.write(all_decrypted)
    print(f"\n  Decrypted dump: {dump_file}")

if __name__ == '__main__':
    main()
