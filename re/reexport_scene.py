#!/usr/bin/env python3
"""Export scene assets (sprites + sounds) to remake/assets/{scene}/

Note on sprite format:
- Most sprites use VGA Mode X planar storage and need deinterleaving.
- Exception: ALEX walk sprites (ALEX{dir}-{frame}) in ALEX1.DAT are stored LINEARLY.
  Use reexport_alex.py for those.
"""
import sys, os, struct
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'formats'))
from parse_dat import extract_resources, parse_sprite_header
from export_all_assets import make_palette_rgb, sprite_to_image

def export_scene(scene_name, dat_base, sd_base=None, output_dir=None):
    """Export all sprites and sounds for a scene.

    scene_name: e.g. 'airport'
    dat_base: e.g. 'AIRPORT' (for AIRPORT.DAT/NDX)
    sd_base: e.g. 'SDAIRPOR' (for SDAIRPOR.DAT/NDX), or None to skip sounds
    """
    game_dir = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')
    out_dir = output_dir or os.path.join(os.path.dirname(__file__), '..', 'remake', 'assets', scene_name)
    os.makedirs(out_dir, exist_ok=True)

    # Load sprite resources
    dat_path = os.path.join(game_dir, f'{dat_base}.DAT')
    ndx_path = os.path.join(game_dir, f'{dat_base}.NDX')
    resources = extract_resources(dat_path, ndx_path)

    # Find palette
    pal = None
    for r in resources:
        if r['type'] == 1024:  # palette
            pal = make_palette_rgb(r['data'])
            break

    if not pal:
        print(f'WARNING: No palette found in {dat_base}.DAT')
        return

    # Export sprites
    sprite_count = 0
    for r in resources:
        if r['type'] != 256:
            continue
        try:
            hdr = parse_sprite_header(r['data'])
            w, h = hdr['width'], hdr['height']
            pixels = r['data'][4:4 + w * h]
            # Backgrounds (SN*) are opaque, others have transparent index 0
            is_bg = r['name'].startswith('SN') and not r['name'].endswith('PAL')
            img = sprite_to_image(w, h, pixels, pal, transparent_zero=not is_bg)
            out_path = os.path.join(out_dir, f'{r["name"]}.png')
            img.save(out_path)
            sprite_count += 1
        except Exception as e:
            print(f'  ERROR exporting {r["name"]}: {e}')

    print(f'Exported {sprite_count} sprites to {out_dir}')

    # Export sounds
    if sd_base:
        sd_dat = os.path.join(game_dir, f'{sd_base}.DAT')
        sd_ndx = os.path.join(game_dir, f'{sd_base}.NDX')
        if os.path.exists(sd_dat):
            sd_resources = extract_resources(sd_dat, sd_ndx)
            sound_count = 0
            for r in sd_resources:
                if r['type'] == 512:  # sound
                    out_path = os.path.join(out_dir, f'{r["name"]}.wav')
                    # Raw PCM -> WAV
                    _write_wav(out_path, r['data'], 22050)
                    sound_count += 1
            print(f'Exported {sound_count} sounds to {out_dir}')

def _write_wav(path, pcm_data, sample_rate):
    """Write raw 8-bit unsigned PCM as WAV."""
    import wave
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(1)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(f'Usage: {sys.argv[0]} scene_name DAT_BASE [SD_BASE]')
        print(f'Example: {sys.argv[0]} airport AIRPORT SDAIRPOR')
        sys.exit(1)

    scene = sys.argv[1]
    dat = sys.argv[2]
    sd = sys.argv[3] if len(sys.argv) > 3 else None
    export_scene(scene, dat, sd)
