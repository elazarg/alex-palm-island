#!/usr/bin/env python3
"""Parse DAT (resource data) files for Alex Palm Island.

DAT files contain the actual resource data (graphics, sounds, palettes) indexed
by a corresponding NDX file. There are three DAT variants:

1. COMP-compressed DATs (graphics/mixed): Start with "COMP" magic header,
   contain compressed resource data. Must be decompressed before NDX offsets apply.

2. Sound DATs (SD*.DAT): No COMP header, contain raw unsigned 8-bit PCM audio.
   NDX offsets point directly into the raw file.

3. ALEX1.DAT: Raw data (installed to hard disk, not on CD).
   NDX offsets apply directly. Not encrypted despite earlier claims.

This parser reads a DAT+NDX pair and extracts individual resources.

COMP compression format:
  Header: "COMP" (4 bytes) + u32 LE decompressed_size
  Body: one or more chunks, each with 5-byte header:
    u16 chunk_decomp_size, u8 method (0=raw, 1=compressed), u16 chunk_comp_size
  Compression tokens (method=1):
    0xFF <len:u8> <offset:u16 LE>  - back-reference (absolute offset in output)
    0xFE <len:u8> <byte:u8>        - RLE fill
    <any other byte>                - literal

Usage:
    python3 re/formats/parse_dat.py game_decrypted/cd/MICE      # extract MICE.NDX+.DAT
    python3 re/formats/parse_dat.py --info game_decrypted/cd/LOBBY  # show resource info
    python3 re/formats/parse_dat.py --extract RESOURCE_NAME game_decrypted/cd/MICE out.bin
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(__file__))
from parse_ndx import parse_ndx, TYPE_GRAPHICS, TYPE_SOUND, TYPE_PALETTE

# Import COMP decompressor
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from decompress_comp import decompress_comp


def load_dat(dat_path, ndx_records=None):
    """Load and decompress a DAT file. Returns raw decompressed bytes."""
    with open(dat_path, 'rb') as f:
        data = f.read()

    basename = os.path.basename(dat_path).upper()

    if data[:4] == b'COMP':
        return decompress_comp(data)
    else:
        # Raw data: sound DATs (SD*.DAT), ALEX1.DAT, etc.
        return data


def extract_resources(dat_path, ndx_path):
    """Extract all resources from a DAT+NDX pair.

    Returns list of dicts with 'name', 'type', 'type_name', 'data', 'offset', 'size'.
    """
    records = parse_ndx(ndx_path)
    decompressed = load_dat(dat_path, records)

    resources = []
    for rec in records:
        offset = rec['offset']
        size = rec['actual_size']
        resource_data = decompressed[offset:offset + size]

        resources.append({
            'name': rec['name'],
            'type': rec['type'],
            'type_name': rec['type_name'],
            'offset': offset,
            'size': size,
            'data': resource_data,
        })

    return resources


def print_info(resources, base_name=None):
    """Print info about extracted resources."""
    if base_name:
        print(f"\n{'='*70}")
        print(f"  {base_name}: {len(resources)} resources")
        print(f"{'='*70}")

    print(f"  {'#':>3} {'Name':<20} {'Type':<12} {'Size':>8} {'Offset':>10} {'Preview'}")
    print(f"  {'-'*3} {'-'*20} {'-'*12} {'-'*8} {'-'*10} {'-'*20}")

    for i, res in enumerate(resources):
        preview = res['data'][:8].hex() if res['data'] else '(empty)'
        print(f"  {i:3d} {res['name']:<20} {res['type_name']:<12} "
              f"{res['size']:>8} {res['offset']:>10} {preview}")


def parse_sprite_header(data):
    """Parse a graphics resource header. Returns dict or None.

    Graphics resources have a 4-byte header:
      u16 LE width
      u16 LE height
    Followed by width*height bytes of VGA palette indices (1 byte per pixel).
    """
    if len(data) < 4:
        return None

    w = struct.unpack_from('<H', data, 0)[0]
    h = struct.unpack_from('<H', data, 2)[0]

    # Sanity check: reasonable dimensions, pixel count matches
    if 0 < w <= 640 and 0 < h <= 480 and w * h == len(data) - 4:
        return {
            'width': w,
            'height': h,
            'pixel_data_offset': 4,
            'pixel_count': w * h,
        }
    return None


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    mode = 'info'
    resource_name = None
    output_path = None

    if args[0] == '--info':
        args = args[1:]
    elif args[0] == '--extract':
        mode = 'extract'
        resource_name = args[1]
        args = args[2:]
        if len(args) > 1:
            output_path = args[-1]
            args = args[:-1]

    for base_path in args:
        # Auto-detect NDX and DAT paths
        base = base_path.rstrip('.').rstrip('/')
        if base.upper().endswith(('.NDX', '.DAT')):
            base = os.path.splitext(base)[0]

        ndx_path = base + '.NDX'
        dat_path = base + '.DAT'

        if not os.path.exists(ndx_path):
            # Try uppercase
            ndx_path = base + '.ndx'
        if not os.path.exists(dat_path):
            dat_path = base + '.dat'

        resources = extract_resources(dat_path, ndx_path)

        if mode == 'info':
            print_info(resources, os.path.basename(base))

            # Try parsing sprite headers for graphics resources
            print(f"\n  Sprite headers:")
            for res in resources:
                if res['type'] == TYPE_GRAPHICS:
                    hdr = parse_sprite_header(res['data'])
                    if hdr:
                        print(f"    {res['name']:<20} {hdr['width']}x{hdr['height']}  "
                              f"{hdr['pixel_count']}B pixels")
                    else:
                        w = struct.unpack_from('<H', res['data'], 0)[0] if len(res['data']) >= 2 else 0
                        h = struct.unpack_from('<H', res['data'], 2)[0] if len(res['data']) >= 4 else 0
                        print(f"    {res['name']:<20} {w}x{h}?  size={res['size']}  "
                              f"w*h={w*h}  data-4={res['size']-4}")
                elif res['type'] == TYPE_PALETTE:
                    print(f"    {res['name']:<20} palette ({res['size']} bytes = "
                          f"{res['size']//3} colors)")

        elif mode == 'extract':
            for res in resources:
                if res['name'].upper() == resource_name.upper():
                    out = output_path or f"{res['name']}.bin"
                    with open(out, 'wb') as f:
                        f.write(res['data'])
                    print(f"Extracted {res['name']} ({res['size']} bytes) -> {out}")
                    break
            else:
                print(f"Resource '{resource_name}' not found")
                print(f"Available: {', '.join(r['name'] for r in resources)}")


if __name__ == '__main__':
    main()
