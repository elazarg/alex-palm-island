"""Build a synthetic TRANS.BIG with a zero XOR key.

The synthetic file encodes a valid 51-entry chain where every data byte is 0x00.
When the game reads this chain, it builds an all-zero key table at DS:0x56D8.
XOR with zero = identity, so pre-decrypted SCX/DCX files pass through unchanged.

Chain structure per entry:
  - 4-byte pointer: 0xFFFFFFFF → NOT = 0 → seek target = 0 + FilePos = FilePos
  - 5 zero data bytes

With ptr=0xFFFFFFFF, the seek target equals the current FilePos after reading
the pointer, so the seek is effectively a no-op. Entries pack sequentially:
  offset 0:   FF FF FF FF 00 00 00 00 00  (entry 0)
  offset 9:   FF FF FF FF 00 00 00 00 00  (entry 1)
  ...
  offset 450: FF FF FF FF 00 00 00 00 00  (entry 50)
  Total: 459 bytes

Threshold check: min_file_size = NOT(0xFFFFFFFF) + 409 = 0 + 409 = 409.
Our file is 459 > 409. ✓

Usage:
    python3 re/build_synthetic_transbig.py [output_path]
"""
import struct
import sys
import os

NUM_ENTRIES = 51
BYTES_PER_ENTRY = 9  # 4 ptr + 5 data

def build_synthetic():
    """Build the synthetic TRANS.BIG content."""
    buf = bytearray()
    for _ in range(NUM_ENTRIES):
        buf += struct.pack('<I', 0xFFFFFFFF)  # NOT(0xFFFFFFFF) = 0
        buf += b'\x00' * 5                     # zero data bytes
    return bytes(buf)


def verify_chain(data):
    """Verify the synthetic file produces a valid zero chain."""
    pos = 0
    for i in range(NUM_ENTRIES):
        ptr = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        target = ((~ptr) & 0xFFFFFFFF) + pos
        target &= 0xFFFFFFFF

        if target + 5 > len(data):
            print(f"  FAIL at entry {i}: seek 0x{target:08X} past EOF ({len(data)})")
            return False

        d = data[target:target + 5]
        if any(b != 0 for b in d):
            print(f"  FAIL at entry {i}: data not zero: {d.hex()}")
            return False

        pos = target + 5

    return True


def main():
    output_path = sys.argv[1] if len(sys.argv) > 1 else 'game/cd/TRANS.BIG.synthetic'

    content = build_synthetic()

    print(f"Synthetic TRANS.BIG: {len(content)} bytes")
    print(f"  Entries: {NUM_ENTRIES}")
    print(f"  All pointers: 0xFFFFFFFF (seek = FilePos, no-op)")
    print(f"  All data: 0x00 (zero XOR key)")

    # Verify before writing
    if verify_chain(content):
        print(f"  Chain verification: PASS")
    else:
        print(f"  Chain verification: FAIL — aborting")
        sys.exit(1)

    # Verify threshold
    first4 = struct.unpack_from('<I', content, 0)[0]
    threshold = ((~first4 & 0xFFFFFFFF) + 409) & 0xFFFFFFFF
    print(f"  Threshold: {threshold} bytes (file is {len(content)} bytes)")
    if len(content) >= threshold:
        print(f"  Threshold check: PASS")
    else:
        print(f"  Threshold check: FAIL — file too small")
        sys.exit(1)

    # Also verify with extract_chain.py
    sys.path.insert(0, os.path.dirname(__file__))
    from extract_chain import extract_chain
    import tempfile

    with tempfile.NamedTemporaryFile(suffix='.bin', delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        entries = extract_chain(tmp_path)
        all_data = bytearray()
        for e in entries:
            all_data.extend(e['data'])

        if len(entries) == NUM_ENTRIES and all(b == 0 for b in all_data):
            print(f"  extract_chain verification: PASS ({len(entries)} entries, all zeros)")
        else:
            print(f"  extract_chain verification: FAIL")
            print(f"    entries: {len(entries)}, non-zero bytes: {sum(1 for b in all_data if b != 0)}")
            sys.exit(1)
    finally:
        os.unlink(tmp_path)

    with open(output_path, 'wb') as f:
        f.write(content)
    print(f"\n  Written to: {output_path}")


if __name__ == '__main__':
    main()
