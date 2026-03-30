#!/usr/bin/env python3
"""Export all Alex Palm Island assets to modern formats.

Converts the entire game's visual and audio resources:
  - Sprites → PNG (with proper VGA palettes)
  - Sounds → WAV (22050 Hz for SD* dialog, 11025 Hz for embedded cutscene/narrator audio)
  - Music → CMF (Creative Music File, playable in VLC/Foobar/DOSBox)
  - Fonts → PNG specimen sheets
  - Palettes → PNG color swatches

Usage:
    python3 re/export_all_assets.py                    # export everything
    python3 re/export_all_assets.py --sprites-only     # just sprites
    python3 re/export_all_assets.py --sounds-only      # just sounds
    python3 re/export_all_assets.py --music-only       # just music
    python3 re/export_all_assets.py --fonts-only       # just fonts
    python3 re/export_all_assets.py --palettes-only    # just palettes
    python3 re/export_all_assets.py --scene LOBBY      # one scene only

Output goes to re/renders/ (gitignored).
"""
import os
import struct
import sys
import wave

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'formats'))
from parse_ndx import parse_ndx, TYPE_GRAPHICS, TYPE_SOUND, TYPE_PALETTE, TYPE_CURSOR_PAL
from parse_dat import extract_resources, parse_sprite_header

GAME_DIR = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')
OUT_BASE = os.path.join(os.path.dirname(__file__), 'renders')


def make_palette_rgb(palette_data):
    """Convert VGA 6-bit palette (768 bytes) to list of (R, G, B) tuples."""
    colors = []
    for i in range(256):
        r = min(palette_data[i * 3] * 4, 255)
        g = min(palette_data[i * 3 + 1] * 4, 255)
        b = min(palette_data[i * 3 + 2] * 4, 255)
        colors.append((r, g, b))
    return colors


def grayscale_palette():
    return [(i, i, i) for i in range(256)]


def deinterleave_modex(pixels, width, height):
    """Convert VGA Mode X full-frame planar pixels to linear order.

    The game stores sprites in Mode X planar format: all plane 0 rows first,
    then all plane 1 rows, plane 2, plane 3. Each plane holds every 4th pixel
    (plane P gets pixels at x where x % 4 == P).

    Layout in file (for sprite width W, height H, plane_width PW = W // 4):
      [plane 0: H rows of PW bytes] [plane 1: ...] [plane 2: ...] [plane 3: ...]

    Display pixel (x, y) is at file offset:
      (x % 4) * PW * H + y * PW + (x // 4)
    """
    pw = width // 4
    linear = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            si = (x % 4) * pw * height + y * pw + (x // 4)
            linear[y * width + x] = pixels[si] if si < len(pixels) else 0
    return bytes(linear)


def sprite_to_image(width, height, pixels, palette, transparent_zero=False):
    """Create a PIL Image from sprite data.

    Pixels are assumed to be in Mode X planar format and are deinterleaved
    before rendering. Width must be divisible by 4.
    """
    if width % 4 == 0:
        pixels = deinterleave_modex(pixels, width, height)

    if transparent_zero:
        img = Image.new('RGBA', (width, height))
        px = img.load()
        idx = 0
        for y in range(height):
            for x in range(width):
                c = pixels[idx]
                if c == 0:
                    px[x, y] = (0, 0, 0, 0)
                else:
                    r, g, b = palette[c]
                    px[x, y] = (r, g, b, 255)
                idx += 1
    else:
        img = Image.new('RGB', (width, height))
        px = img.load()
        idx = 0
        for y in range(height):
            for x in range(width):
                px[x, y] = palette[pixels[idx]]
                idx += 1
    return img


def is_overlay_sprite(name):
    """Detect sprites that should use transparency (overlays, icons, cursors, characters)."""
    name_upper = name.upper()
    # Icons, cursors, UI elements, character sprites, talk sprites
    return any(kw in name_upper for kw in (
        'ICON', 'CURSOR', 'ALEX', 'BUTTON', 'PRESSED', 'ARROW',
        'TALK', 'PICT', 'MASK', 'WINDOW', 'PANEL', 'METER',
        'MONEY', 'SCORE', 'CHECK', 'KNOB', 'MENU', 'MAP',
        'SUITCASE', 'BTN', 'EXIT', 'NOMAP', 'NOBAG',
    ))


def export_sprites_for_scene(scene_name, resources, out_dir, stats):
    """Export all sprites from one NDX/DAT pair."""
    # Find palette
    palette = None
    for res in resources:
        if res['type'] == TYPE_PALETTE:
            palette = make_palette_rgb(res['data'])
            break
    if palette is None:
        palette = grayscale_palette()

    os.makedirs(out_dir, exist_ok=True)
    count = 0
    for res in resources:
        if res['type'] not in (TYPE_GRAPHICS, TYPE_CURSOR_PAL):
            continue

        data = res['data']
        # For cursor+pal (0x0500), palette is embedded — skip for now, treat as graphics
        if res['type'] == TYPE_CURSOR_PAL:
            # Cursor resources: 768 bytes palette + 4-byte header + pixels
            if len(data) > 772:
                cursor_pal = make_palette_rgb(data[:768])
                data = data[768:]
                hdr = parse_sprite_header(data)
                if hdr:
                    pixels = data[4:4 + hdr['pixel_count']]
                    if len(pixels) == hdr['pixel_count']:
                        img = sprite_to_image(hdr['width'], hdr['height'], pixels, cursor_pal, transparent_zero=True)
                        img.save(os.path.join(out_dir, f"{res['name']}.png"))
                        count += 1
            continue

        hdr = parse_sprite_header(data)
        if not hdr:
            stats['skipped'] += 1
            continue

        pixels = data[4:4 + hdr['pixel_count']]
        if len(pixels) != hdr['pixel_count']:
            stats['skipped'] += 1
            continue

        transparent = is_overlay_sprite(res['name'])
        img = sprite_to_image(hdr['width'], hdr['height'], pixels, palette, transparent_zero=transparent)
        img.save(os.path.join(out_dir, f"{res['name']}.png"))
        count += 1

    stats['sprites'] += count
    return count


# Per-resource sample rate overrides.
# Most sounds play at 22050 Hz. A few long background/narration tracks
# are recorded at 11025 Hz (confirmed by ear).
RATE_11025_RESOURCES = {
    'NARRATOR',   # SPYMASTR: continuous narration track
}


def export_sounds_for_scene(scene_name, resources, out_dir, stats, sample_rate=22050):
    """Export all sound resources as WAV files."""
    os.makedirs(out_dir, exist_ok=True)
    count = 0
    for res in resources:
        if res['type'] != TYPE_SOUND:
            continue
        if len(res['data']) < 2:
            continue
        # Skip CTMF music files (handled separately)
        if res['data'][:4] == b'CTMF':
            continue

        rate = 11025 if res['name'] in RATE_11025_RESOURCES else sample_rate
        wav_path = os.path.join(out_dir, f"{res['name']}.wav")
        with wave.open(wav_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(1)  # 8-bit
            wf.setframerate(rate)
            wf.writeframes(res['data'])

        count += 1

    stats['sounds'] += count
    return count


def export_music(resources, out_dir, stats):
    """Export CTMF music tracks as .cmf files."""
    os.makedirs(out_dir, exist_ok=True)
    count = 0
    for res in resources:
        if res['data'][:4] != b'CTMF':
            continue
        cmf_path = os.path.join(out_dir, f"{res['name']}.cmf")
        with open(cmf_path, 'wb') as f:
            f.write(res['data'])
        count += 1
    stats['music'] += count
    return count


def export_palette_swatch(palette_data, name, out_dir):
    """Render a 256-color palette as a 16x16 swatch grid PNG."""
    palette = make_palette_rgb(palette_data)
    cell = 16  # pixels per cell
    img = Image.new('RGB', (16 * cell, 16 * cell))
    px = img.load()
    for i, (r, g, b) in enumerate(palette):
        row, col = divmod(i, 16)
        for dy in range(cell):
            for dx in range(cell):
                px[col * cell + dx, row * cell + dy] = (r, g, b)
    img.save(os.path.join(out_dir, f"{name}.png"))


def export_palettes(resources, scene_name, out_dir, stats):
    """Export palette resources as color swatch PNGs."""
    os.makedirs(out_dir, exist_ok=True)
    for res in resources:
        if res['type'] == TYPE_PALETTE and len(res['data']) == 768:
            export_palette_swatch(res['data'], f"{scene_name}_{res['name']}", out_dir)
            stats['palettes'] += 1


def parse_font(data):
    """Parse a bitmap font resource. Returns (header, glyphs) or None."""
    if len(data) < 260:
        return None
    start_char = data[0]
    end_char = data[1]
    max_width = data[2]
    height = data[3]
    widths = list(data[4:260])

    glyphs = {}
    offset = 260
    for ch in range(start_char, end_char + 1):
        if offset + 4 > len(data):
            break
        char_w = struct.unpack_from('<H', data, offset)[0]
        char_h = struct.unpack_from('<H', data, offset + 2)[0]
        offset += 4
        num_pixels = char_h * char_w
        if offset + num_pixels > len(data):
            break
        pixels = data[offset:offset + num_pixels]
        glyphs[ch] = {'width': char_w, 'height': char_h, 'pixels': pixels}
        offset += num_pixels

    return {
        'start_char': start_char,
        'end_char': end_char,
        'max_width': max_width,
        'height': height,
        'widths': widths,
        'glyphs': glyphs,
    }


def export_font_sheet(font_data, name, palette, out_dir):
    """Render a font as a PNG specimen sheet with labeled characters."""
    font = parse_font(font_data)
    if not font or not font['glyphs']:
        return False

    # Layout: 16 columns, enough rows to fit all glyphs
    num_chars = len(font['glyphs'])
    cols = 16
    rows = (num_chars + cols - 1) // cols

    cell_w = font['max_width'] + 4  # padding
    cell_h = font['height'] + 14    # room for label below
    margin = 2

    img_w = cols * cell_w + margin * 2
    img_h = rows * cell_h + margin * 2

    img = Image.new('RGB', (img_w, img_h), (32, 32, 32))
    px = img.load()

    sorted_chars = sorted(font['glyphs'].keys())
    for idx, ch in enumerate(sorted_chars):
        glyph = font['glyphs'][ch]
        pixels = glyph['pixels']
        if glyph['width'] % 4 == 0:
            pixels = deinterleave_modex(pixels, glyph['width'], glyph['height'])
        col = idx % cols
        row = idx // cols
        base_x = margin + col * cell_w + 2
        base_y = margin + row * cell_h + 2

        # Draw glyph pixels
        for gy in range(glyph['height']):
            for gx in range(glyph['width']):
                pi = gy * glyph['width'] + gx
                if pi < len(pixels):
                    c = pixels[pi]
                    if c != 0:
                        r, g, b = palette[c]
                        if base_x + gx < img_w and base_y + gy < img_h:
                            px[base_x + gx, base_y + gy] = (r, g, b)

    img.save(os.path.join(out_dir, f"{name}.png"))
    return True


def export_fonts(resources, out_dir, stats):
    """Export font resources as PNG specimen sheets."""
    os.makedirs(out_dir, exist_ok=True)

    # Get palette from ALEX1.DAT resources
    palette = grayscale_palette()
    for res in resources:
        if res['type'] == TYPE_PALETTE:
            palette = make_palette_rgb(res['data'])
            break

    # Use a light-on-dark palette for fonts: map non-zero to white
    font_palette = [(0, 0, 0)] + [(255, 255, 255)] * 255

    for res in resources:
        if 'FONT' in res['name'].upper() and res['type'] == TYPE_GRAPHICS:
            if export_font_sheet(res['data'], res['name'], font_palette, out_dir):
                stats['fonts'] += 1


def get_all_ndx_bases():
    """Get all NDX base names (without extension) from game directory."""
    bases = set()
    for f in os.listdir(GAME_DIR):
        if f.upper().endswith('.NDX'):
            bases.add(os.path.splitext(f)[0])
    return sorted(bases)


def scene_category(name):
    """Categorize a scene file for directory organization."""
    n = name.upper()
    if n.startswith('SD'):
        return 'sounds'
    if n in ('ALEX1', 'ALEXWALK', 'FONTS', 'ICONS', 'MICE', 'PANEL',
             'WINDOWS', 'MAP', 'MENU', 'MUSIC', 'DRIVERS', 'SPYMASTR'):
        return 'global'
    if n in ('LOGO', 'OPENING', 'OPEN2', 'OPEN3', 'OPEN4', 'DEMO',
             'ENDING', 'ARREST', 'PRISON', 'DEATH'):
        return 'cutscenes'
    if n.startswith('ST') or n.startswith('STRIP'):
        return 'streets'
    if n.startswith('FLOOR') or n in ('CORRIDOR', 'LIFTROOM', 'LOBBY', 'LOBBYDSK',
                                       'ROOM301', 'ROOM302', 'ROOM303', 'WALTROOM'):
        return 'hotel'
    if n.startswith('ZOO') or n in ('BEAR', 'MONKEY', 'LIONCAGE'):
        return 'zoo'
    return 'scenes'


def main():
    args = set(sys.argv[1:])

    scene_filter = None
    if '--scene' in args:
        arg_list = sys.argv[1:]
        idx = arg_list.index('--scene')
        scene_filter = arg_list[idx + 1].upper()
        args.discard('--scene')
        args.discard(scene_filter.lower())
        args.discard(scene_filter)

    do_all = not any(a.endswith('-only') for a in args)
    do_sprites = do_all or '--sprites-only' in args
    do_sounds = do_all or '--sounds-only' in args
    do_music = do_all or '--music-only' in args
    do_fonts = do_all or '--fonts-only' in args
    do_palettes = do_all or '--palettes-only' in args

    stats = {'sprites': 0, 'sounds': 0, 'music': 0, 'fonts': 0, 'palettes': 0, 'skipped': 0}

    bases = get_all_ndx_bases()
    if scene_filter:
        bases = [b for b in bases if b.upper() == scene_filter]
        if not bases:
            print(f"Scene '{scene_filter}' not found.")
            print(f"Available: {', '.join(get_all_ndx_bases())}")
            sys.exit(1)

    total = len(bases)
    for i, base_name in enumerate(bases):
        is_sound_dat = base_name.upper().startswith('SD')
        cat = scene_category(base_name)

        ndx_path = os.path.join(GAME_DIR, base_name + '.NDX')
        dat_path = os.path.join(GAME_DIR, base_name + '.DAT')

        print(f"[{i+1}/{total}] {base_name}...", end=' ', flush=True)

        try:
            resources = extract_resources(dat_path, ndx_path)
        except Exception as e:
            print(f"ERROR: {e}")
            continue

        parts = []

        # Sprites
        if do_sprites and not is_sound_dat:
            out = os.path.join(OUT_BASE, 'sprites', cat, base_name)
            n = export_sprites_for_scene(base_name, resources, out, stats)
            if n:
                parts.append(f"{n} sprites")

        # Sounds
        if do_sounds and is_sound_dat:
            scene = base_name[2:]  # strip SD prefix
            out = os.path.join(OUT_BASE, 'sounds', scene)
            n = export_sounds_for_scene(base_name, resources, out, stats)
            if n:
                parts.append(f"{n} sounds")

        # Sounds from non-SD DATs
        if do_sounds and not is_sound_dat:
            has_sounds = any(r['type'] == TYPE_SOUND for r in resources)
            if has_sounds:
                out = os.path.join(OUT_BASE, 'sounds', base_name)
                n = export_sounds_for_scene(base_name, resources, out, stats)
                if n:
                    parts.append(f"{n} sounds")

        # Music (only in ALEX1)
        if do_music and base_name.upper() == 'ALEX1':
            out = os.path.join(OUT_BASE, 'music')
            n = export_music(resources, out, stats)
            if n:
                parts.append(f"{n} music tracks")

        # Fonts (only in ALEX1)
        if do_fonts and base_name.upper() == 'ALEX1':
            out = os.path.join(OUT_BASE, 'fonts')
            n_before = stats['fonts']
            export_fonts(resources, out, stats)
            n = stats['fonts'] - n_before
            if n:
                parts.append(f"{n} fonts")

        # Palettes
        if do_palettes and not is_sound_dat:
            export_palettes(resources, base_name, os.path.join(OUT_BASE, 'palettes'), stats)

        if parts:
            print(', '.join(parts))
        else:
            print("(no exportable resources)")

    print(f"\n{'='*60}")
    print(f"Export complete!")
    print(f"  Sprites: {stats['sprites']} PNG files")
    print(f"  Sounds:  {stats['sounds']} WAV files")
    print(f"  Music:   {stats['music']} CMF files")
    print(f"  Fonts:   {stats['fonts']} PNG sheets")
    print(f"  Palettes:{stats['palettes']} PNG swatches")
    print(f"  Skipped: {stats['skipped']} (bad/unparseable headers)")
    print(f"\nOutput: {os.path.abspath(OUT_BASE)}/")


if __name__ == '__main__':
    main()
