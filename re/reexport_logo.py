#!/usr/bin/env python3
"""Re-export LOGO sprites with transparency (palette index 0 = transparent)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 're', 'formats'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 're'))

from export_all_assets import sprite_to_image
from parse_dat import extract_resources, parse_sprite_header

GAME_DIR = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'remake', 'assets', 'logo')

os.makedirs(OUT_DIR, exist_ok=True)

resources = extract_resources(
    os.path.join(GAME_DIR, 'LOGO.DAT'),
    os.path.join(GAME_DIR, 'LOGO.NDX'),
)

# Find palette
palette = None
for res in resources:
    if res['type_name'] == 'palette' or 'PAL' in res['name'].upper():
        pal_data = res['data']
        palette = []
        for i in range(256):
            r = pal_data[i * 3] * 4
            g = pal_data[i * 3 + 1] * 4
            b = pal_data[i * 3 + 2] * 4
            palette.append((r, g, b))
        print(f"Palette: {res['name']} (index 0 color = {palette[0]})")
        break

if not palette:
    print("ERROR: No palette found")
    sys.exit(1)

# Export all sprites with transparency
for res in resources:
    if res['type_name'] != 'graphics':
        continue

    hdr = parse_sprite_header(res['data'])
    if not hdr:
        continue

    pixels = res['data'][4:4 + hdr['pixel_count']]
    if len(pixels) != hdr['pixel_count']:
        continue

    img = sprite_to_image(hdr['width'], hdr['height'], pixels, palette, transparent_zero=True)
    out_path = os.path.join(OUT_DIR, f"{res['name']}.png")
    img.save(out_path)
    print(f"  {res['name']}: {hdr['width']}x{hdr['height']}")

print(f"\nDone. Sprites with transparency saved to {OUT_DIR}")
