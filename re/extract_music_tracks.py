#!/usr/bin/env python3
"""Extract scene-to-music-track mappings from ALEX1.OVR overlay file.

The overlay contains a master scene setup function (at OVR offset 0x996)
that creates scene descriptors by calling the constructor at 08BB:2624.
The 4th parameter to this constructor is the CTMF music track number
(1-29, corresponding to MUSIC1-MUSIC29 resources in ALEX1.DAT).

Two types of scene descriptors exist:
  - Main scenes (34 total): created via 08BB:2624, with music track in 4th param
  - Alternate scenes (2 total): Factory and LiftRoom, created via 00AE:0020

The scene init functions (0x0124 stack frame) later read the track number
from the descriptor's +0x7E field, convert it to a string, concatenate
it with "Music", and call the music-play routine at 10E8:0555.

Usage:
    python3 re/extract_music_tracks.py                  # table output
    python3 re/extract_music_tracks.py --json           # JSON output
    python3 re/extract_music_tracks.py --by-track       # group by track
"""
import struct
import sys
import json
import os

OVR_PATH = os.path.join(os.path.dirname(__file__), '..', 'game', 'ALEX', 'ALEX1.OVR')

# Scene setup function location
SETUP_FUNC_START = 0x996
# CS base for the setup function's code segment (determined empirically:
# the "Loading graphics" string at file offset 0x6ef resolves via mov di, 0x0001)
SETUP_CS_BASE = 0x6ee

# Constructor call targets
SCENE_CONSTRUCTOR = bytes([0x9a, 0x24, 0x26, 0xbb, 0x08])  # call far 08BB:2624
ALT_CONSTRUCTOR = bytes([0x9a, 0x20, 0x00, 0xae, 0x00])    # call far 00AE:0020

# String copy routine
STRCOPY = bytes([0x9a, 0x74, 0x3c, 0x12, 0x18])  # call far 1218:3C74


def read_pascal_string(data, offset):
    """Read a Pascal string (length-prefixed) at the given offset."""
    if offset < 0 or offset >= len(data):
        return None
    slen = data[offset]
    if slen == 0 or offset + 1 + slen > len(data):
        return None
    try:
        return data[offset + 1:offset + 1 + slen].decode('ascii')
    except UnicodeDecodeError:
        return None


def resolve_string(data, cs_base, cs_offset):
    """Resolve a CS:offset to a Pascal string."""
    if cs_base is None:
        return None
    return read_pascal_string(data, cs_base + cs_offset)


def find_function_end(data, func_start, limit):
    """Find end of function (leave + retf pattern)."""
    for i in range(func_start, min(limit, len(data)) - 3):
        if data[i] == 0xC9 and data[i + 1] in (0xCA, 0xCB):
            return i + (4 if data[i + 1] == 0xCA else 2)
    return limit


def extract_constructor_params(data, call_pos):
    """Extract the 4 push parameters before a scene constructor call.

    Expected pattern before the call:
        push P1  (initial state / walk timer)
        push P2  (y offset / walk parameter)
        push P3  (height / boundary)
        push P4  (music track number)
        mov ax, imm16  (VMT pointer)
        push ax
        xor ax, ax
        push ax
        push ax
        call far constructor

    Returns (params_list, position_before_pushes) or (None, None).
    """
    p = call_pos
    # Verify the mov ax / push / xor / push / push sequence (8 bytes before call)
    if not (p >= 8 and
            data[p - 1] == 0x50 and data[p - 2] == 0x50 and
            data[p - 4] == 0x31 and data[p - 3] == 0xc0 and
            data[p - 5] == 0x50 and data[p - 8] == 0xb8):
        return None, None

    p = call_pos - 8

    params = []
    for _ in range(4):
        if p >= 2 and data[p - 2] == 0x6a:  # push imm8
            params.insert(0, data[p - 1])
            p -= 2
        elif p >= 3 and data[p - 3] == 0x68:  # push imm16
            params.insert(0, struct.unpack_from('<H', data, p - 2)[0])
            p -= 3
        else:
            break

    return params, p


def find_scene_name(data, search_from, func_start, cs_base):
    """Find the scene name from the nearest strcopy before a position.

    The setup function copies the scene name string to a local buffer via:
        lea di, [bp+XX]
        push ss; push di
        mov di, string_offset
        push cs; push di
        call strcopy

    Returns the resolved scene name or None.
    """
    for j in range(search_from, max(search_from - 80, func_start), -1):
        if data[j:j + 5] == STRCOPY:
            # Find the mov di (bf XX XX) before this strcopy
            for k in range(j - 1, max(j - 15, func_start), -1):
                if data[k] == 0xBF:
                    str_off = struct.unpack_from('<H', data, k + 1)[0]
                    return resolve_string(data, cs_base, str_off)
            return None
    return None


def extract_store_addr(data, call_pos, func_end):
    """Extract the global variable address where the result pointer is stored.

    After the constructor call, the result (far pointer in dx:ax) is stored via:
        mov [addr], ax
        mov [addr+2], dx
    """
    j = call_pos + 5
    if j < func_end and data[j] == 0xa3:
        return struct.unpack_from('<H', data, j + 1)[0]
    return None


def extract_scene_descriptors(data):
    """Extract all scene descriptor creations from the master setup function.

    Scans the setup function (at OVR offset 0x996) for constructor calls
    and extracts the scene name and music track number from each.

    Returns list of dicts with: scene, music_track, store_addr, constructor, ovr_offset
    """
    func_start = SETUP_FUNC_START
    func_end = find_function_end(data, func_start, func_start + 20000)
    cs_base = SETUP_CS_BASE

    results = []
    i = func_start
    while i < func_end - 5:
        is_main = data[i:i + 5] == SCENE_CONSTRUCTOR
        is_alt = data[i:i + 5] == ALT_CONSTRUCTOR

        if is_main or is_alt:
            params, search_pos = extract_constructor_params(data, i)
            store_addr = extract_store_addr(data, i, func_end)

            scene_name = None
            if search_pos is not None:
                scene_name = find_scene_name(data, search_pos, func_start, cs_base)

            music_track = None
            if params and len(params) >= 4:
                music_track = params[3]

            results.append({
                'scene': scene_name,
                'music_track': music_track,
                'store_addr': store_addr,
                'constructor': 'main' if is_main else 'alt',
                'ovr_offset': i,
            })
            i += 5
        else:
            i += 1

    return results


def extract_music_tracks(ovr_path=None):
    """Extract scene-to-music-track mappings from the overlay file.

    Returns a list of dicts with scene name and music track information.
    """
    if ovr_path is None:
        ovr_path = OVR_PATH

    with open(ovr_path, 'rb') as f:
        data = f.read()

    return extract_scene_descriptors(data)


def print_table(descriptors):
    """Print a clean scene-to-music table."""
    print(f"{'Scene':<15s} {'Track':>5s}  {'Resource':<10s}")
    print(f"{'-' * 15} {'-' * 5}  {'-' * 10}")

    for d in sorted(descriptors, key=lambda x: (x['scene'] or 'zzz')):
        scene = d['scene'] or '???'
        track = d['music_track']
        track_str = str(track) if track is not None else '-'
        resource = f"MUSIC{track}" if track is not None else '-'
        print(f"{scene:<15s} {track_str:>5s}  {resource:<10s}")


def print_by_track(descriptors):
    """Print scenes grouped by music track."""
    by_track = {}
    for d in descriptors:
        track = d['music_track']
        if track is not None:
            by_track.setdefault(track, []).append(d['scene'] or '???')

    print(f"{'Track':>5s}  {'Resource':<10s}  Scenes")
    print(f"{'-' * 5}  {'-' * 10}  {'-' * 50}")

    for track in sorted(by_track.keys()):
        scenes = sorted(by_track[track])
        resource = f"MUSIC{track}"
        print(f"{track:5d}  {resource:<10s}  {', '.join(scenes)}")

    # Show unused tracks
    used_tracks = set(by_track.keys())
    all_tracks = set(range(1, 30))
    unused = sorted(all_tracks - used_tracks)
    if unused:
        print(f"\nUnused tracks: {', '.join(f'MUSIC{t}' for t in unused)}")


def print_json(descriptors):
    """Print JSON output."""
    output = []
    for d in sorted(descriptors, key=lambda x: (x['scene'] or 'zzz')):
        entry = {
            'scene': d['scene'],
            'music_track': d['music_track'],
            'resource': f"MUSIC{d['music_track']}" if d['music_track'] is not None else None,
        }
        output.append(entry)
    print(json.dumps(output, indent=2))


def main():
    args = sys.argv[1:]
    ovr_path = OVR_PATH
    output_json = False
    by_track = False

    i = 0
    while i < len(args):
        if args[i] == '--json':
            output_json = True
            i += 1
        elif args[i] == '--by-track':
            by_track = True
            i += 1
        elif args[i] == '--ovr' and i + 1 < len(args):
            ovr_path = args[i + 1]
            i += 2
        else:
            print(f"Unknown argument: {args[i]}")
            print(__doc__)
            sys.exit(1)

    descriptors = extract_music_tracks(ovr_path)

    if output_json:
        print_json(descriptors)
    elif by_track:
        print(f"Scene-to-music mappings from {os.path.basename(ovr_path)}")
        print(f"Found {len(descriptors)} scene descriptors\n")
        print_by_track(descriptors)
    else:
        print(f"Scene-to-music mappings from {os.path.basename(ovr_path)}")
        print(f"Found {len(descriptors)} scene descriptors\n")
        print_table(descriptors)

    # Summary
    if not output_json:
        print(f"\nTotal: {len(descriptors)} scenes, "
              f"{len(set(d['music_track'] for d in descriptors if d['music_track'] is not None))} "
              f"unique tracks used out of 29 available")


if __name__ == '__main__':
    main()
