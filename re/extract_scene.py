#!/usr/bin/env python3
"""Extract scene descriptor JSON from OVR + SCX data.

Produces a JSON file with all automatically extractable data,
plus TODO markers for items needing manual input.

Usage: python3 re/extract_scene.py airport AIRPORT [SDAIRPOR]
"""
import sys, os, json, struct
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'formats'))
from parse_scx import parse_file

OVR_PATH = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd', 'ALEX1.OVR')
GAME_DIR = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')


def find_scene_strings(data, cs_base):
    """Find Pascal strings near the scene init function."""
    # Scene init functions are at known CS bases in the OVR.
    # The string table is typically 0x900-0xB00 bytes into the function.
    # Search a wide area for Pascal strings.
    strings = []
    # Convert CS base to file offset (approximate: cs_base * 16 relative to code start)
    # Actually, the strings were found by searching the OVR directly.
    # Let's search the whole OVR for strings near object creation patterns.

    # Find the function area by looking for known patterns
    # The CS base tells us roughly where in the OVR this scene's code lives
    # For airport, cs_base=0x35953, strings found at 0x36930-0x36A50
    # The offset pattern: strings are about (cs_base - 0x35000) * ~1 bytes after a base
    # This is too fragile. Instead, find strings near CALL patterns.

    # Simpler: scan for Pascal strings that look like object names
    # in a range relative to the function code
    return strings


def extract_scx_data(scene_dat_base):
    """Extract animation sections and interactive data from SCX."""
    scx_path = os.path.join(GAME_DIR, f'{scene_dat_base}.SCX')
    if not os.path.exists(scx_path):
        return {}

    sections = parse_file(scx_path)

    result = {
        'animations': {},
        'data_sections': {},
        'interactive': {},
        'entry_section': None,
        'alex_positions': [],
    }

    for section in sections:
        sid = section['id']
        if not sid.isdigit():
            continue
        sid_num = int(sid)

        if section['type'] == 'animation' and sid_num >= 5000:
            result['animations'][sid] = section['lines']
        elif section['type'] == 'data' and sid_num >= 5000:
            # Parse position data
            positions = []
            for line in section['lines']:
                line = line.strip()
                if ',' in line and not line.startswith(('F','P','G','D','R','Q','S','L','M','T','K','V')):
                    parts = line.split(',')
                    if len(parts) == 2:
                        try:
                            x, y = int(parts[0].strip()), int(parts[1].strip())
                            positions.append([x, y])
                        except ValueError:
                            pass
            if positions:
                result['data_sections'][sid] = positions
        elif section['type'] == 'interactive':
            # Extract W commands for Alex positions
            for line in section['lines']:
                if ',W,' in line:
                    parts = line.split(',')
                    # format: flag,cond,W,mode,x,y
                    try:
                        idx = parts.index('W')
                        mode = int(parts[idx+1])
                        x = int(parts[idx+2])
                        y = int(parts[idx+3])
                        result['alex_positions'].append({
                            'section': sid, 'mode': mode, 'x': x, 'y': y
                        })
                    except (ValueError, IndexError):
                        pass

            # Find entry section (usually 110)
            if sid_num == 110:
                result['entry_section'] = sid_num
                result['interactive'][sid] = section['lines']

    return result


def extract_ovr_objects(scene_cs_base):
    """Extract object names and positions from OVR."""
    with open(OVR_PATH, 'rb') as f:
        data = f.read()

    # Find the scene init function area by CS base
    # The OVR stores overlay segments. Each scene's code is at a specific offset.
    # We need to find the function that creates objects for this scene.

    # Import extract_hotspots for the heavy lifting
    sys.path.insert(0, os.path.dirname(__file__))
    from extract_hotspots import extract_all_scenes

    scenes_list, _ = extract_all_scenes()
    for scene in scenes_list:
        if scene['cs_base'] == scene_cs_base:
            return scene
    return None


def extract_sprite_names(dat_base):
    """List all sprite names in the DAT file."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'formats'))
    from parse_dat import extract_resources

    dat_path = os.path.join(GAME_DIR, f'{dat_base}.DAT')
    ndx_path = os.path.join(GAME_DIR, f'{dat_base}.NDX')

    if not os.path.exists(dat_path):
        return []

    resources = extract_resources(dat_path, ndx_path)
    sprites = []
    for r in resources:
        if r['type'] == 256:  # sprite
            sprites.append(r['name'])
    return sprites


def find_object_strings_in_ovr(cs_base):
    """Find all Pascal strings in the OVR near a scene's function."""
    with open(OVR_PATH, 'rb') as f:
        data = f.read()

    # Search for the scene's code area.
    # The CS base gives us a segment address. Object name strings are
    # typically in the code segment near the object creation calls.
    # Heuristic: search a 4KB window around where we'd expect the strings.

    # From airport example: cs_base=0x35953, strings at 0x36930-0x36A50
    # That's offset 0x36930 in the file. Let's find it by scanning for
    # clusters of Pascal strings that look like object names.

    # Try scanning the whole OVR for the scene's object strings
    # by finding clusters of Pascal strings near each other

    all_strings = []
    i = 0
    while i < len(data) - 2:
        strlen = data[i]
        if 2 <= strlen <= 20 and i + 1 + strlen < len(data):
            s = data[i+1:i+1+strlen]
            try:
                name = s.decode('ascii')
                if name.isprintable() and any(c.isalpha() for c in name) and name[0].isupper():
                    all_strings.append((i, name))
            except:
                pass
        i += 1

    # Find clusters of strings (scenes have 10-30 object names clustered together)
    # Return the cluster nearest to the cs_base offset region
    target_offset = cs_base  # rough approximation

    # Group strings by proximity (within 200 bytes of each other)
    clusters = []
    current_cluster = []
    for offset, name in all_strings:
        if current_cluster and offset - current_cluster[-1][0] > 200:
            if len(current_cluster) >= 5:
                clusters.append(current_cluster)
            current_cluster = []
        current_cluster.append((offset, name))
    if len(current_cluster) >= 5:
        clusters.append(current_cluster)

    # Find the cluster closest to the expected area
    best_cluster = None
    best_dist = float('inf')
    for cluster in clusters:
        center = sum(o for o, _ in cluster) / len(cluster)
        dist = abs(center - target_offset)
        if dist < best_dist:
            best_dist = dist
            best_cluster = cluster

    return best_cluster or []


def group_sprites_by_prefix(sprite_names):
    """Group sprite names into prefix families (e.g., GUARD1-12 → GUARD)."""
    import re
    prefixes = {}
    for name in sprite_names:
        m = re.match(r'^([A-Z]+?)(\d+)$', name)
        if m:
            prefix = m.group(1)
            num = int(m.group(2))
            if prefix not in prefixes:
                prefixes[prefix] = []
            prefixes[prefix].append(num)
        else:
            # standalone sprite (no number suffix)
            if name not in prefixes:
                prefixes[name] = []

    # Sort frame numbers
    for prefix in prefixes:
        prefixes[prefix].sort()

    return prefixes


def build_scene_descriptor(scene_name, dat_base, sd_base=None, cs_base=None):
    """Build a scene descriptor combining OVR + SCX + sprite data."""

    print(f'Extracting scene: {scene_name} (DAT={dat_base})')

    descriptor = {
        'id': scene_name,
        'background': f'SN{dat_base}1',
        'TODO_background': 'Verify background sprite name; check if _FULL composite needed',

        'objects': [],
        'walkZones': [],
        'clickRects': [],
        'animations': {},
        'spriteGroups': {},
    }

    # 1. Extract sprites from DAT
    print('  Extracting sprite names...')
    sprite_names = extract_sprite_names(dat_base)
    sprite_groups = group_sprites_by_prefix(sprite_names)
    descriptor['spriteGroups'] = {k: v for k, v in sprite_groups.items() if v}
    descriptor['allSprites'] = sprite_names
    print(f'  Found {len(sprite_names)} sprites in {len(sprite_groups)} groups')

    # 2. Extract SCX data
    print('  Parsing SCX...')
    scx_data = extract_scx_data(dat_base)
    descriptor['animations'] = scx_data.get('animations', {})
    descriptor['dataPositions'] = scx_data.get('data_sections', {})
    descriptor['alexPositions'] = scx_data.get('alex_positions', [])
    if scx_data.get('entry_section'):
        descriptor['entrySection'] = scx_data['entry_section']
    print(f'  Found {len(descriptor["animations"])} animation sections, '
          f'{len(descriptor["dataPositions"])} data sections')

    # 3. Extract OVR data (objects, hotspots, click rects)
    if cs_base:
        print('  Extracting OVR data...')
        ovr_scene = extract_ovr_objects(cs_base)
        if ovr_scene:
            # Walk zones
            for cr in ovr_scene.get('click_rects', []):
                if cr['type'] == 'A':
                    descriptor['walkZones'].append({
                        'rect': [cr['x1'], cr['y1'], cr['x2'], cr['y2']]
                    })
                elif cr['type'] == 'B':
                    descriptor['clickRects'].append({
                        'type': 'B',
                        'rect': [cr['x1'], cr['y1'], cr['x2'], cr['y2']],
                        'name': cr.get('name'),
                        'examine': cr.get('examine_section'),
                        'click': cr.get('click_section'),
                        'talk': cr.get('talk_section'),
                    })
                elif cr['type'] in ('C', 'D'):
                    descriptor['clickRects'].append({
                        'type': cr['type'],
                        'rect': [cr['x1'], cr['y1'], cr['x2'], cr['y2']],
                        'name': cr.get('name'),
                        'exit': cr.get('exit_section'),
                        'walkTarget': [cr.get('walk_x'), cr.get('walk_y')]
                            if cr.get('walk_x') is not None else None,
                    })

            # Hotspots
            for h in ovr_scene.get('hotspots', []):
                descriptor['objects'].append({
                    'name': h['name'],
                    'x': h['x'], 'y': h['y'],
                    'type': 'hotspot',
                    'handler': h.get('handler'),
                })

            print(f'  Found {len(descriptor["walkZones"])} walk zones, '
                  f'{len(descriptor["clickRects"])} click rects, '
                  f'{len(descriptor["objects"])} hotspots')

    # 4. Find object names from OVR string table
    if cs_base:
        print('  Scanning OVR string table...')
        obj_strings = find_object_strings_in_ovr(cs_base)
        if obj_strings:
            # Add objects not already in the hotspot list
            known_names = {o['name'] for o in descriptor['objects']}
            for offset, name in obj_strings:
                if name not in known_names and len(name) >= 3:
                    descriptor['objects'].append({
                        'name': name,
                        'type': 'object',
                        'ovrOffset': f'0x{offset:X}',
                        'TODO': 'Find x,y position and sprite prefix from OVR disassembly',
                    })
            print(f'  Found {len(obj_strings)} strings, '
                  f'{len(descriptor["objects"])} total objects')

    # 5. Alex start position from entry section W command
    if scx_data.get('alex_positions'):
        entry_pos = None
        for ap in scx_data['alex_positions']:
            if ap['section'] == '110':
                entry_pos = ap
                break
        if not entry_pos:
            entry_pos = scx_data['alex_positions'][0]
        descriptor['alexStart'] = {
            'x': entry_pos['x'], 'y': entry_pos['y'],
            'dir': 4,
            'TODO_dir': 'Verify initial facing direction',
        }

    # 6. Add manual TODO checklist
    descriptor['TODO_manual'] = [
        'Map objects to sprite prefixes (e.g., Guard → GUARD)',
        'Assign animation sections to objects (push 0x13XX in OVR)',
        'Determine render order (objectsBehind vs objectsFront)',
        'Find overlay offsets for base+overlay sprites (pixel matching)',
        'Set initial visibility for each object',
        'Compute bottomAlign values from sprite heights',
        'Verify walk zone Y ranges cover actual walk destinations',
    ]

    return descriptor


# Scene CS base lookup (from extract_hotspots scene identification)
SCENE_CS_BASES = {
    'airport': 0x35953,
    # Add more as scenes are identified
}


def main():
    if len(sys.argv) < 3:
        print(f'Usage: {sys.argv[0]} scene_name DAT_BASE [SD_BASE]')
        print(f'Example: {sys.argv[0]} airport AIRPORT SDAIRPOR')
        sys.exit(1)

    scene_name = sys.argv[1]
    dat_base = sys.argv[2]
    sd_base = sys.argv[3] if len(sys.argv) > 3 else None
    cs_base = SCENE_CS_BASES.get(scene_name)

    descriptor = build_scene_descriptor(scene_name, dat_base, sd_base, cs_base)

    # Output
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'remake', 'data', 'scenes')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f'{scene_name}.json')

    with open(out_path, 'w') as f:
        json.dump(descriptor, f, indent=2)

    print(f'\nWrote {out_path}')
    print(f'Sprite groups: {", ".join(sorted(descriptor["spriteGroups"].keys()))}')
    print(f'\nNext steps:')
    for todo in descriptor['TODO_manual']:
        print(f'  [ ] {todo}')


if __name__ == '__main__':
    main()
