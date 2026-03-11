#!/usr/bin/env python3
"""Cross-reference a scene's overlay hotspot data with its SCX sections.

Combines extract_hotspots.py (OVR click rects, objects, hotspots) with
parse_scx.py (section IDs, text, dialogs) to produce a unified view
of what each clickable region does.

Usage:
    python3 re/scene_xref.py Airport         # full cross-reference
    python3 re/scene_xref.py WaltRoom --brief # summary only
    python3 re/scene_xref.py --list           # list all known scenes
    python3 re/scene_xref.py Airport --json   # JSON output
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'formats'))

from extract_hotspots import extract_all_scenes
from parse_scx import parse_scx

GAME_DIR = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')
GAME_DIR_ORIG = os.path.join(os.path.dirname(__file__), '..', 'game', 'cd')


def find_scx_file(scene_name):
    """Find the SCX file for a scene name, trying various paths."""
    candidates = [
        os.path.join(GAME_DIR, f'{scene_name}.SCX'),
        os.path.join(GAME_DIR, f'{scene_name.upper()}.SCX'),
        # 8.3 truncation (e.g., StButcher → STBUTCHE.SCX)
        os.path.join(GAME_DIR, f'{scene_name.upper()[:8]}.SCX'),
        os.path.join(GAME_DIR_ORIG, f'{scene_name}.SCX'),
        os.path.join(GAME_DIR_ORIG, f'{scene_name.upper()}.SCX'),
        os.path.join(GAME_DIR_ORIG, f'{scene_name.upper()[:8]}.SCX'),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def load_scx_sections(scx_path):
    """Load and index SCX sections by ID."""
    with open(scx_path, 'rb') as f:
        data = f.read()
    sections = parse_scx(data)

    indexed = {}
    for s in sections:
        # Section ID may be "510,1,sdNar198" — use first part
        sid = s['id'].split(',')[0].strip()
        indexed[sid] = s
    return sections, indexed


def xref_scene(scene_name, scenes_data):
    """Cross-reference one scene's overlay data with SCX sections."""
    # Find the scene in overlay data
    scene = None
    for s in scenes_data:
        if s['scene'] and s['scene'].lower() == scene_name.lower():
            scene = s
            break

    if not scene:
        print(f"Scene '{scene_name}' not found in overlay data.")
        print(f"Available: {', '.join(s['scene'] for s in scenes_data if s['scene'])}")
        return None

    # Find SCX file
    scx_path = find_scx_file(scene_name)
    scx_sections = None
    scx_indexed = None
    if scx_path:
        scx_sections, scx_indexed = load_scx_sections(scx_path)

    result = {
        'scene': scene_name,
        'scx_path': scx_path,
        'objects': len(scene['objects']),
        'hotspots': len(scene['hotspots']),
        'click_rects': len(scene.get('click_rects', [])),
        'scx_sections': len(scx_sections) if scx_sections else 0,
        'click_rect_details': [],
    }

    # Cross-reference each click rect with SCX
    for cr in scene.get('click_rects', []):
        detail = {
            'type': cr['type'],
            'bounds': (cr['x1'], cr['y1'], cr['x2'], cr['y2']),
            'name': cr.get('name'),
        }

        # Resolve section references
        for field, key in [('examine_section', 'look'), ('click_section', 'touch'),
                           ('talk_section', 'talk'), ('exit_section', 'exit')]:
            val = cr.get(field)
            if val is not None:
                detail[key] = {'section_id': val}
                if scx_indexed:
                    sid = str(val)
                    if sid in scx_indexed:
                        s = scx_indexed[sid]
                        text = s['lines'][0][:80] if s['lines'] else ''
                        detail[key]['type'] = s['type']
                        detail[key]['text'] = text

        if cr.get('walk_x') is not None:
            detail['walk_to'] = (cr['walk_x'], cr['walk_y'])

        result['click_rect_details'].append(detail)

    return result


def print_xref(xref, brief=False):
    """Print cross-reference results."""
    print(f"\n{'='*80}")
    print(f"  Scene: {xref['scene']}")
    print(f"  SCX: {xref['scx_path'] or 'NOT FOUND'}")
    print(f"  OVR: {xref['objects']} objects, {xref['hotspots']} hotspots, "
          f"{xref['click_rects']} click rects")
    print(f"  SCX: {xref['scx_sections']} sections")
    print(f"{'='*80}")

    if brief:
        # Just count by type
        from collections import Counter
        types = Counter(d['type'] for d in xref['click_rect_details'])
        print(f"\n  Click rect types: {dict(types)}")
        return

    for i, d in enumerate(xref['click_rect_details']):
        bounds = d['bounds']
        b = f"({bounds[0]},{bounds[1]})-({bounds[2]},{bounds[3]})"
        name = d.get('name') or ''
        print(f"\n  [{i:2d}] Type {d['type']}  {b:30s} {name}")

        for action in ('look', 'touch', 'talk', 'exit'):
            if action in d:
                info = d[action]
                sid = info['section_id']
                stype = info.get('type', '?')
                text = info.get('text', '')
                print(f"       {action:6s} → section {sid:>5} ({stype}) {text[:60]}")

        if 'walk_to' in d:
            print(f"       walk   → ({d['walk_to'][0]}, {d['walk_to'][1]})")


def main():
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
        sys.exit(0)

    output_json = '--json' in args
    brief = '--brief' in args
    args = [a for a in args if not a.startswith('--')]

    scenes_data, _ = extract_all_scenes()

    if not args or args[0] == '--list':
        print("Known scenes:")
        for s in sorted(scenes_data, key=lambda s: s['scene'] or 'zzz'):
            if s['scene']:
                cr = len(s.get('click_rects', []))
                print(f"  {s['scene']:<15s}  {len(s['objects']):>3} obj  "
                      f"{len(s['hotspots']):>3} hs  {cr:>3} cr")
        sys.exit(0)

    for scene_name in args:
        xref = xref_scene(scene_name, scenes_data)
        if xref:
            if output_json:
                print(json.dumps(xref, indent=2))
            else:
                print_xref(xref, brief=brief)


if __name__ == '__main__':
    main()
