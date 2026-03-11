#!/usr/bin/env python3
"""Parse NDX (index) files for the Alex Palm Island game engine.

NDX files contain fixed 36-byte records that index into a corresponding DAT file.
Each record maps a named resource to an offset and size within the DAT.

Record format (36 bytes):
  Offset  Size  Field
  0       20    name      Pascal string (byte 0 = length, 1-19 = chars, zero-padded)
  20      2     type      Resource type (u16 LE): 0x0100=graphics, 0x0200=sound,
                          0x0400=palette, 0x0500=cursor+palette
  22      2     pad1      Always 0
  24      2     pad2      Always 0
  26      2     stride    Resource size low word (u16 LE)
  28      4     flag      For sound (0x0200): high word of size, actual_size = flag*65536+stride
                          For graphics: usually 0, sometimes 1
  32      4     offset    Byte offset into the decompressed DAT content (u32 LE)

Usage:
    python3 re/formats/parse_ndx.py game_decrypted/cd/MICE.NDX
    python3 re/formats/parse_ndx.py --all game_decrypted/cd/  # parse all NDX files
"""
import struct
import os
import sys

RECORD_SIZE = 36

# Resource type constants
TYPE_GRAPHICS = 0x0100
TYPE_SOUND = 0x0200
TYPE_PALETTE = 0x0400
TYPE_CURSOR_PAL = 0x0500

TYPE_NAMES = {
    TYPE_GRAPHICS: 'graphics',
    TYPE_SOUND: 'sound',
    TYPE_PALETTE: 'palette',
    TYPE_CURSOR_PAL: 'cursor+pal',
}


def parse_record(data, offset=0):
    """Parse a single 36-byte NDX record. Returns a dict."""
    rec = data[offset:offset + RECORD_SIZE]
    if len(rec) < RECORD_SIZE:
        return None

    namelen = rec[0]
    name = rec[1:1 + namelen].decode('ascii', errors='replace')
    rtype = struct.unpack_from('<H', rec, 20)[0]
    pad1 = struct.unpack_from('<H', rec, 22)[0]
    pad2 = struct.unpack_from('<H', rec, 24)[0]
    stride = struct.unpack_from('<H', rec, 26)[0]
    flag = struct.unpack_from('<I', rec, 28)[0]
    dat_offset = struct.unpack_from('<I', rec, 32)[0]

    # For sound resources, actual size spans flag:stride as a 32-bit value
    if rtype == TYPE_SOUND:
        actual_size = flag * 65536 + stride
    else:
        actual_size = stride

    return {
        'name': name,
        'type': rtype,
        'type_name': TYPE_NAMES.get(rtype, f'0x{rtype:04x}'),
        'pad1': pad1,
        'pad2': pad2,
        'stride': stride,
        'flag': flag,
        'offset': dat_offset,
        'actual_size': actual_size,
    }


def parse_ndx(filepath):
    """Parse an entire NDX file. Returns list of record dicts."""
    with open(filepath, 'rb') as f:
        data = f.read()

    if len(data) % RECORD_SIZE != 0:
        print(f"Warning: {filepath} size {len(data)} not multiple of {RECORD_SIZE}",
              file=sys.stderr)

    records = []
    for i in range(len(data) // RECORD_SIZE):
        rec = parse_record(data, i * RECORD_SIZE)
        if rec:
            records.append(rec)
    return records


def print_records(records, filepath=None):
    """Pretty-print NDX records."""
    if filepath:
        print(f"\n{'='*70}")
        print(f"  {filepath}: {len(records)} records")
        print(f"{'='*70}")

    print(f"  {'#':>3} {'Name':<20} {'Type':<12} {'Size':>8} {'Offset':>10} {'Flag':>6}")
    print(f"  {'-'*3} {'-'*20} {'-'*12} {'-'*8} {'-'*10} {'-'*6}")

    max_end = 0
    for i, rec in enumerate(records):
        end = rec['offset'] + rec['actual_size']
        if end > max_end:
            max_end = end
        print(f"  {i:3d} {rec['name']:<20} {rec['type_name']:<12} "
              f"{rec['actual_size']:>8} {rec['offset']:>10} {rec['flag']:>6}")

    print(f"\n  Max offset+size = {max_end} (expected DAT decompressed size)")


def main():
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        sys.exit(1)

    if args[0] == '--all':
        directory = args[1] if len(args) > 1 else '.'
        ndx_files = sorted(f for f in os.listdir(directory) if f.upper().endswith('.NDX'))
        total_records = 0
        type_counts = {}
        for fname in ndx_files:
            filepath = os.path.join(directory, fname)
            records = parse_ndx(filepath)
            total_records += len(records)
            for r in records:
                type_counts[r['type_name']] = type_counts.get(r['type_name'], 0) + 1
            print_records(records, filepath)

        print(f"\n{'='*70}")
        print(f"  Summary: {len(ndx_files)} NDX files, {total_records} total records")
        print(f"  Type distribution: {type_counts}")
    else:
        for filepath in args:
            records = parse_ndx(filepath)
            print_records(records, filepath)


if __name__ == '__main__':
    main()
