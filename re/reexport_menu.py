#!/usr/bin/env python3
"""Re-export main menu sprites with MAINMENUPAL palette and transparency."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 're', 'formats'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 're'))

from export_all_assets import sprite_to_image, make_palette_rgb
from parse_dat import extract_resources, parse_sprite_header

GAME_DIR = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'remake', 'assets', 'menu')

os.makedirs(OUT_DIR, exist_ok=True)

resources = extract_resources(
    os.path.join(GAME_DIR, 'ALEX1.DAT'),
    os.path.join(GAME_DIR, 'ALEX1.NDX'),
)

# Find MAINMENUPAL
palette = None
for res in resources:
    if res['name'] == 'MAINMENUPAL':
        palette = make_palette_rgb(res['data'])
        print(f"Palette: {res['name']}")
        break

if not palette:
    print("ERROR: MAINMENUPAL not found")
    sys.exit(1)

# Export menu sprites
MENU_SPRITES = [
    'MAINMENU',
    'MMINTRO1', 'MMINTRO2',
    'MMPLAY1', 'MMPLAY2',
    'MMQUIT1', 'MMQUIT2',
    'MMALEX1', 'MMALEX2', 'MMALEX3', 'MMALEX4',
    'MMALEX5', 'MMALEX6', 'MMALEX7', 'MMALEX8',
    'MMARROWCURSOR',
]

for res in resources:
    if res['name'] not in MENU_SPRITES:
        continue
    hdr = parse_sprite_header(res['data'])
    if not hdr:
        continue
    pixels = res['data'][4:4 + hdr['pixel_count']]
    if len(pixels) != hdr['pixel_count']:
        continue
    # Background is opaque, everything else uses transparency
    transparent = res['name'] != 'MAINMENU'
    img = sprite_to_image(hdr['width'], hdr['height'], pixels, palette,
                          transparent_zero=transparent)
    out_path = os.path.join(OUT_DIR, f"{res['name']}.png")
    img.save(out_path)
    print(f"  {res['name']}: {hdr['width']}x{hdr['height']}")

print(f"\nDone. Menu sprites saved to {OUT_DIR}")
