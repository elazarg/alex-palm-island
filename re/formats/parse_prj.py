#!/usr/bin/env python3
"""Parse ALEX1.PRJ project file.

Contains 9 records of 64 bytes each. Each record starts with a Pascal string
naming a resource group (.NDT extension, maps to .NDX files on disc).

Record format (64 bytes):
  Offset  Size  Field
  0       1     Name length
  1       12    Name string (Pascal string, e.g., "DRIVERS.NDT")
  13      51    Configuration data (flags, sizes, addresses — TBD)

The 9 groups are the "always loaded" global resource packs:
  DRIVERS, PANEL, ALEXWALK, MICE, FONTS, ICONS, WINDOWS, MUSIC, MAP

Usage:
    python3 re/formats/parse_prj.py game_decrypted/cd/ALEX1.PRJ
"""
import struct
import sys

RECORD_SIZE = 64


def parse_prj(filepath):
    """Parse ALEX1.PRJ. Returns list of resource group records."""
    with open(filepath, 'rb') as f:
        data = f.read()

    records = []
    for i in range(len(data) // RECORD_SIZE):
        offset = i * RECORD_SIZE
        rec = data[offset:offset + RECORD_SIZE]

        namelen = rec[0]
        name = rec[1:1 + namelen].decode('ascii', errors='replace')

        # Remaining bytes after the name
        config_data = rec[1 + namelen:]

        records.append({
            'index': i,
            'name': name,
            'raw': rec,
            'config_bytes': config_data,
        })

    return records


def print_records(records, filepath=None):
    """Pretty-print PRJ records."""
    if filepath:
        print(f"\n{filepath}: {len(records)} resource groups")
        print(f"{'='*60}")

    for rec in records:
        # Map .NDT to the actual .NDX file name used on disc
        ndx_name = rec['name'].replace('.NDT', '.NDX').replace('.ndt', '.ndx')
        # Hex dump of config bytes (first 20 bytes)
        config_hex = rec['config_bytes'][:20].hex()
        print(f"  [{rec['index']}] {rec['name']:<16} -> {ndx_name:<16}  config: {config_hex}...")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    for filepath in sys.argv[1:]:
        records = parse_prj(filepath)
        print_records(records, filepath)


if __name__ == '__main__':
    main()
