#!/usr/bin/env python3
"""Render sprites from Alex Palm Island DAT files as PNG images.

Extracts resources from NDX+DAT pairs and renders them using the palette
from the same DAT file (or a fallback grayscale palette).

Usage:
    python3 re/formats/render_sprite.py game_decrypted/cd/MICE       # render all sprites
    python3 re/formats/render_sprite.py game_decrypted/cd/LOBBY --name LIFTSIGN
    python3 re/formats/render_sprite.py game_decrypted/cd/LOGO --name LOGO20
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(__file__))
from parse_ndx import parse_ndx, TYPE_GRAPHICS, TYPE_PALETTE
from parse_dat import extract_resources, parse_sprite_header


def make_palette_rgb(palette_data):
    """Convert VGA 6-bit palette (768 bytes) to 8-bit RGB tuples."""
    colors = []
    for i in range(256):
        r = palette_data[i * 3] * 4      # 6-bit to 8-bit
        g = palette_data[i * 3 + 1] * 4
        b = palette_data[i * 3 + 2] * 4
        colors.append((min(r, 255), min(g, 255), min(b, 255)))
    return colors


def grayscale_palette():
    """Generate a grayscale palette (fallback)."""
    return [(i, i, i) for i in range(256)]


def render_ppm(width, height, pixels, palette, outpath):
    """Render a sprite to PPM format (no dependencies needed)."""
    with open(outpath, 'wb') as f:
        f.write(f'P6\n{width} {height}\n255\n'.encode())
        for pixel in pixels:
            r, g, b = palette[pixel]
            f.write(bytes([r, g, b]))
    print(f"  Wrote {outpath} ({width}x{height})")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    name_filter = None
    base_path = args[0]
    if '--name' in args:
        idx = args.index('--name')
        name_filter = args[idx + 1].upper()

    # Resolve paths
    base = base_path.rstrip('.')
    if base.upper().endswith(('.NDX', '.DAT')):
        base = os.path.splitext(base)[0]

    resources = extract_resources(base + '.DAT', base + '.NDX')

    # Find palette
    palette = grayscale_palette()
    for res in resources:
        if res['type'] == TYPE_PALETTE:
            palette = make_palette_rgb(res['data'])
            print(f"Using palette: {res['name']}")
            break

    # Create output directory
    out_dir = os.path.join('re', 'renders', os.path.basename(base))
    os.makedirs(out_dir, exist_ok=True)

    count = 0
    for res in resources:
        if res['type'] != TYPE_GRAPHICS:
            continue
        if name_filter and res['name'].upper() != name_filter:
            continue

        hdr = parse_sprite_header(res['data'])
        if not hdr:
            print(f"  Skipping {res['name']} (bad header)")
            continue

        pixels = res['data'][4:]
        outpath = os.path.join(out_dir, f"{res['name']}.ppm")
        render_ppm(hdr['width'], hdr['height'], pixels, palette, outpath)
        count += 1

    print(f"\nRendered {count} sprites to {out_dir}/")


if __name__ == '__main__':
    main()
