#!/usr/bin/env python3
"""Re-export all introduction sequence sprites with correct palettes and transparency."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'formats'))
sys.path.insert(0, os.path.dirname(__file__))

from export_all_assets import sprite_to_image, make_palette_rgb
from parse_dat import extract_resources, parse_sprite_header

GAME_DIR = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')
OUT_BASE = os.path.join(os.path.dirname(__file__), '..', 'remake', 'assets')

SCENES = ['OPENING', 'OPEN2', 'SPYMASTR', 'OPEN3', 'OPEN4']

# Backgrounds are opaque (no transparency); overlays need transparency
BACKGROUND_PREFIXES = ('SN', 'MAINMENU')


def export_scene(scene_name):
    dat = os.path.join(GAME_DIR, f'{scene_name}.DAT')
    ndx = os.path.join(GAME_DIR, f'{scene_name}.NDX')
    if not os.path.exists(dat):
        print(f'  {scene_name}: DAT not found, skipping')
        return

    out_dir = os.path.join(OUT_BASE, scene_name.lower())
    os.makedirs(out_dir, exist_ok=True)

    resources = extract_resources(dat, ndx)

    # Find palette (sometimes typed as graphics with PAL in name)
    palette = None
    for res in resources:
        if res['type_name'] == 'palette' or \
           ('PAL' in res['name'].upper() and res['size'] == 768):
            palette = make_palette_rgb(res['data'])
            break
    if not palette:
        print(f'  {scene_name}: no palette found')
        return

    # Export sounds embedded in the main DAT
    import wave
    sound_count = 0
    for res in resources:
        if res['type_name'] != 'sound':
            continue
        wav_path = os.path.join(out_dir, f"{res['name']}.wav")
        with wave.open(wav_path, 'wb') as wf:
            rate = 11025 if 'NARRATOR' in res['name'].upper() else 22050
            wf.setnchannels(1)
            wf.setsampwidth(1)
            wf.setframerate(rate)
            wf.writeframes(res['data'])
        sound_count += 1

    count = 0
    for res in resources:
        if res['type_name'] != 'graphics':
            continue
        if 'PAL' in res['name'].upper():
            continue  # skip palette resources mistyped as graphics
        hdr = parse_sprite_header(res['data'])
        if not hdr:
            continue
        pixels = res['data'][4:4 + hdr['pixel_count']]
        if len(pixels) != hdr['pixel_count']:
            continue
        is_bg = any(res['name'].upper().startswith(p) for p in BACKGROUND_PREFIXES)
        img = sprite_to_image(hdr['width'], hdr['height'], pixels, palette,
                              transparent_zero=not is_bg)
        img.save(os.path.join(out_dir, f"{res['name']}.png"))
        count += 1

    print(f'  {scene_name}: {count} sprites, {sound_count} sounds -> {out_dir}')


if __name__ == '__main__':
    scenes = sys.argv[1:] if len(sys.argv) > 1 else SCENES
    for scene in scenes:
        export_scene(scene.upper())
    print('Done.')
