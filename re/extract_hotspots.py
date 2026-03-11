#!/usr/bin/env python3
"""Extract hotspot/object definitions from ALEX1.OVR overlay file.

The overlay contains per-scene initialization functions that define:
1. Visual objects (sprites) at specific positions - call far 089E:0000
2. Named hotspots - call far 089E:0073
3. Clickable rectangles - call far 10C4:0000 (the actual hit-test regions)

Click rectangles are classified into 6 types by their post-call configuration:
  Type A: Walk zone (0BCE:27A8 with params 1001,256) - navigation boundaries
  Type B: Interactive object (0BCE:27A8 with params 0,0) - has examine/click sections
          [di+0x46] = examine text_ref section, [di+0x48] = click handler section
  Type C: Scene exit (033B:12A0) - directly encodes handler section_id
  Type D: Walk-to trigger (033B:0616) - walk target coordinates
  Type E: Special/animated (033B:0442) - special object configuration
  Type F: Raw trigger rect (no strcopy) - paired with C/D/E types

Usage:
    python3 re/extract_hotspots.py                    # extract all scenes
    python3 re/extract_hotspots.py --scene Airport     # single scene
    python3 re/extract_hotspots.py --json              # JSON output
"""
import struct
import sys
import json
import os

OVR_PATH = os.path.join(os.path.dirname(__file__), '..', 'game', 'ALEX', 'ALEX1.OVR')

# Known call targets in the overlay
CALL_HOTSPOT  = bytes([0x9A, 0x73, 0x00, 0x9E, 0x08])  # call far 089E:0073
CALL_HOTSPOT2 = bytes([0x9A, 0xF3, 0x00, 0x9E, 0x08])  # call far 089E:00F3 (variant)
CALL_OBJECT   = bytes([0x9A, 0x00, 0x00, 0x9E, 0x08])   # call far 089E:0000
CALL_STRCOPY  = bytes([0x9A, 0x74, 0x3C, 0x12, 0x18])   # call far 1812:3c74
CALL_CLICK_RECT = bytes([0x9A, 0x00, 0x00, 0xC4, 0x10])  # call far 10C4:0000
CALL_CONFIG_A   = bytes([0x9A, 0xA8, 0x27, 0xCE, 0x0B])  # call far 0BCE:27A8
CALL_EXIT       = bytes([0x9A, 0xA0, 0x12, 0x3B, 0x03])  # call far 033B:12A0
CALL_WALKTO     = bytes([0x9A, 0x16, 0x06, 0x3B, 0x03])  # call far 033B:0616
CALL_SPECIAL    = bytes([0x9A, 0x42, 0x04, 0x3B, 0x03])  # call far 033B:0442

# Scene table offset in OVR (36 entries starting at 0x719)
SCENE_TABLE_OFFSET = 0x719
SCENE_COUNT = 36


def read_pascal_string(data, offset):
    """Read a Pascal string (length-prefixed) at the given offset."""
    if offset >= len(data):
        return None
    slen = data[offset]
    if slen == 0 or offset + 1 + slen > len(data):
        return None
    try:
        return data[offset + 1:offset + 1 + slen].decode('ascii')
    except UnicodeDecodeError:
        return None


def parse_scene_table(data):
    """Parse the 36-entry scene table from the overlay."""
    offset = SCENE_TABLE_OFFSET
    scenes = []
    for _ in range(SCENE_COUNT):
        sn_name = read_pascal_string(data, offset)
        if sn_name is None:
            break
        offset += 1 + data[offset]
        scene_name = read_pascal_string(data, offset)
        if scene_name is None:
            break
        offset += 1 + data[offset]
        scenes.append((sn_name, scene_name))

    # Two unnamed entries (Prison, Death)
    for _ in range(2):
        name = read_pascal_string(data, offset)
        if name:
            scenes.append((f'sn{name}', name))
            offset += 1 + data[offset]

    return scenes


def find_scene_init_functions(data):
    """Find all scene init functions (0x0124 stack frame, 0x089E calls)."""
    functions = []
    # Pattern: 55 89 E5 B8 24 01 9A XX XX 12 18 81 EC 24 01
    # push bp; mov bp,sp; mov ax,0x0124; call far 1218:XXXX; sub sp,0x0124
    for i in range(len(data) - 15):
        if (data[i:i+3] == b'\x55\x89\xe5' and
            data[i+3] == 0xB8 and
            struct.unpack_from('<H', data, i+4)[0] in (0x0124, 0x0120, 0x0200, 0x0202)):
            frame_size = struct.unpack_from('<H', data, i+4)[0]
            # call far is 5 bytes at i+6, so sub sp starts at i+11
            if data[i+11:i+13] == b'\x81\xec':
                sub_size = struct.unpack_from('<H', data, i+13)[0]
                if sub_size == frame_size:
                    functions.append((i, frame_size))
    return functions


def find_function_end(data, func_start, next_func_start=None):
    """Find the end of a function (leave + retf pattern)."""
    limit = next_func_start if next_func_start else min(func_start + 20000, len(data))
    for i in range(func_start, limit - 3):
        if data[i] == 0xC9 and data[i+1] in (0xCA, 0xCB):
            if data[i+1] == 0xCA:
                return i + 4  # leave + retf imm16
            return i + 2  # leave + retf
    return limit


def compute_cs_base(data, func_start, func_end):
    """Compute the CS base offset for string resolution.

    Strategy: Find the "Music" string (always last before each function),
    then find the mov di value that references it. CS base = music_file_off - mov_di_val.
    Validate by checking other mov di values resolve to valid strings.
    """
    # Collect all unique mov di (0xBF XX XX) values in the function
    mov_di_values = set()
    for i in range(func_start, min(func_end, len(data) - 3)):
        if data[i] == 0xBF:
            val = struct.unpack_from('<H', data, i + 1)[0]
            mov_di_values.add(val)

    if not mov_di_values:
        return None

    # Find "Music" string (05 4D 75 73 69 63) before the function
    music_bytes = b'\x05Music'
    music_off = None
    search_start = max(0, func_start - 500)
    for i in range(func_start - len(music_bytes), search_start, -1):
        if data[i:i + len(music_bytes)] == music_bytes:
            music_off = i
            break

    if music_off is None:
        # Fallback: try brute-force with all strings before function
        return _compute_cs_base_bruteforce(data, func_start, func_end, mov_di_values)

    # Find which mov di value, when subtracted from music_off, gives a valid base
    best_base = None
    best_score = 0
    for mov_val in mov_di_values:
        candidate_base = music_off - mov_val
        if candidate_base < 0:
            continue
        score = _score_cs_base(data, candidate_base, mov_di_values, func_start)
        if score > best_score:
            best_score = score
            best_base = candidate_base

    return best_base


def _score_cs_base(data, cs_base, mov_di_values, func_start):
    """Score a CS base by counting how many mov_di values resolve to valid strings
    that are located before the function start."""
    score = 0
    for mv in mov_di_values:
        file_off = cs_base + mv
        if file_off < 0 or file_off >= func_start:
            continue
        slen = data[file_off]
        if 1 <= slen <= 30 and file_off + 1 + slen <= len(data):
            try:
                s = data[file_off + 1:file_off + 1 + slen].decode('ascii')
                if s.isprintable() and len(s) >= 1:
                    score += 1
            except UnicodeDecodeError:
                pass
    return score


def _compute_cs_base_bruteforce(data, func_start, func_end, mov_di_values):
    """Fallback CS base computation using brute force string matching."""
    # Find Pascal strings before the function
    strings = []
    scan_start = max(0, func_start - 500)
    i = scan_start
    while i < func_start:
        slen = data[i]
        if 2 <= slen <= 30 and i + 1 + slen <= func_start:
            try:
                s = data[i + 1:i + 1 + slen].decode('ascii')
                if s.isprintable() and s.isalpha():
                    strings.append(i)
            except UnicodeDecodeError:
                pass
        i += 1

    best_base = None
    best_score = 0
    for str_off in strings:
        for mov_val in mov_di_values:
            candidate_base = str_off - mov_val
            if candidate_base < 0:
                continue
            score = _score_cs_base(data, candidate_base, mov_di_values, func_start)
            if score > best_score:
                best_score = score
                best_base = candidate_base

    return best_base


def resolve_string(data, cs_base, cs_offset):
    """Resolve a CS:offset to a Pascal string."""
    if cs_base is None:
        return None
    file_off = cs_base + cs_offset
    return read_pascal_string(data, file_off)


def extract_push_before(data, pos):
    """Extract a push value immediately before the given position.

    Returns (value, new_pos) or (None, pos).
    """
    if pos < 2:
        return None, pos
    if data[pos - 2] == 0x6A:  # push imm8
        return struct.unpack_from('b', data, pos - 1)[0], pos - 2
    if pos >= 3 and data[pos - 3] == 0x68:  # push imm16
        return struct.unpack_from('<h', data, pos - 2)[0], pos - 3
    return None, pos


def extract_object_properties(data, func_start, func_end):
    """Extract object property settings from 089E:00F3 calls.

    These calls set fields at +0x44, +0x46 (examine section), +0x48 (click section)
    on already-created objects via `es: mov word [di+offset], value` patterns.
    """
    props = []
    i = func_start
    while i < func_end - 5:
        if data[i:i+5] == CALL_HOTSPOT2:
            fields = _extract_field_writes(data, i, func_start)
            if fields:
                props.append({
                    'offset': i,
                    'fields': fields,
                })
            i += 5
        else:
            i += 1
    return props


def _extract_field_writes(data, call_pos, func_start):
    """Extract es: mov word [di+XX], val patterns before a call."""
    fields = {}
    for j in range(call_pos - 1, max(call_pos - 80, func_start), -1):
        if (j + 8 < len(data) and
            data[j] == 0xC4 and data[j+1] == 0x7E and
            data[j+3] == 0x26 and data[j+4] == 0xC7 and data[j+5] == 0x45):
            field_off = data[j+6]
            field_val = struct.unpack_from('<H', data, j+7)[0]
            fields[field_off] = field_val
    return fields


def extract_click_rects(data, func_start, func_end, cs_base):
    """Extract clickable rectangle definitions from 10C4:0000 calls.

    Each CLICK_RECT is followed by a configuration call that determines its type:
      Type A: 0BCE:27A8 with (1001, 256, ...) → walk zone
      Type B: 0BCE:27A8 with (0, 0, ...) → interactive object
      Type C: 033B:12A0 → scene exit (section_id in first param)
      Type D: 033B:0616 → walk-to trigger (x, y in params)
      Type E: 033B:0442 → special/animated object
      Type F: no strcopy → raw trigger rect

    For Type B, struct fields [di+0x46] and [di+0x48] store:
      +0x46 = examine text_ref section (narration on look)
      +0x48 = click handler section (interactive or text_ref)
    """
    rects = []
    i = func_start
    while i < func_end - 5:
        if data[i:i+5] != CALL_CLICK_RECT:
            i += 1
            continue

        # Extract (x1, y1, x2, y2) from the 4 pushes before lea di,[bp+XX]; push ss; push di
        rect = {'x1': None, 'y1': None, 'x2': None, 'y2': None,
                'type': 'F', 'field_44': None,
                'examine_section': None, 'click_section': None,
                'talk_section': None, 'field_62': None,
                'exit_section': None, 'walk_x': None, 'walk_y': None,
                'name': None, 'offset': i}

        if (i >= 5 and data[i-5] == 0x8D and data[i-4] == 0x7E
                and data[i-2] == 0x16 and data[i-1] == 0x57):
            pos = i - 5
            vals = []
            for _ in range(4):
                v, pos = extract_push_before(data, pos)
                if v is None:
                    break
                vals.insert(0, v)
            if len(vals) == 4:
                rect['x1'], rect['y1'], rect['x2'], rect['y2'] = vals

        # Find the name (strcopy before the pushes) and classify type
        # Look for the config call after the CLICK_RECT call
        config_region = data[i+5:min(i+80, func_end)]
        rect['type'] = _classify_click_rect(data, i, func_start, func_end, rect, cs_base)

        rects.append(rect)
        i += 5

    return rects


def _classify_click_rect(data, call_pos, func_start, func_end, rect, cs_base):
    """Classify a CLICK_RECT by the configuration call that follows it."""
    search_end = min(call_pos + 80, func_end)

    # Look for config calls after the CLICK_RECT
    for j in range(call_pos + 5, search_end - 5):
        if data[j:j+5] == CALL_CONFIG_A:
            # Extract push params between CLICK_RECT return and CONFIG_A
            # Look for the first two pushes (which distinguish type A from B)
            params = _extract_config_a_params(data, call_pos + 5, j)
            if params and len(params) >= 2 and params[0] == 1001:
                return 'A'  # walk zone
            # Type B: interactive object — extract field writes after CONFIG_A
            fields = _extract_field_writes_after_config(data, j + 5, func_end)
            if 0x44 in fields:
                rect['field_44'] = fields[0x44]
            if 0x46 in fields:
                rect['examine_section'] = fields[0x46]
            if 0x48 in fields:
                rect['click_section'] = fields[0x48]
            if 0x4A in fields:
                rect['talk_section'] = fields[0x4A]
            if 0x62 in fields:
                rect['field_62'] = fields[0x62]
            # Find the name from strcopy before CLICK_RECT setup
            name = _find_name_before_click_rect(data, call_pos, func_start, cs_base)
            if name:
                rect['name'] = name
            return 'B'  # interactive object

        if data[j:j+5] == CALL_EXIT:
            # Type C: scene exit — first push param is section_id
            params = _extract_simple_pushes(data, call_pos + 5, j, 3)
            if params and len(params) >= 1:
                rect['exit_section'] = params[0]
            name = _find_name_before_click_rect(data, call_pos, func_start, cs_base)
            if name:
                rect['name'] = name
            return 'C'  # exit

        if data[j:j+5] == CALL_WALKTO:
            # Type D: walk-to trigger
            params = _extract_simple_pushes(data, call_pos + 5, j, 3)
            if params and len(params) >= 2:
                rect['walk_x'] = params[0]
                rect['walk_y'] = params[1]
            return 'D'  # walk-to

        if data[j:j+5] == CALL_SPECIAL:
            return 'E'  # special/animated

    # Check if there was a strcopy before the CLICK_RECT push setup
    # If not, it's type F (raw trigger rect)
    has_strcopy = False
    for j in range(call_pos - 1, max(call_pos - 60, func_start), -1):
        if data[j:j+5] == CALL_STRCOPY:
            has_strcopy = True
            break
        if data[j:j+5] == CALL_CLICK_RECT:
            break  # hit previous CLICK_RECT, stop
    return 'F' if not has_strcopy else 'B'


def _extract_config_a_params(data, start, config_call_pos):
    """Extract push values between CLICK_RECT return and CONFIG_A call."""
    params = []
    pos = start
    while pos < config_call_pos:
        if data[pos] == 0x6A:  # push imm8
            params.append(struct.unpack_from('b', data, pos + 1)[0])
            pos += 2
        elif data[pos] == 0x68:  # push imm16
            params.append(struct.unpack_from('<H', data, pos + 1)[0])
            pos += 3
        elif data[pos] == 0xB8:  # mov ax, imm16
            params.append(struct.unpack_from('<H', data, pos + 1)[0])
            pos += 3
        elif data[pos] == 0x50:  # push ax
            pos += 1
        elif data[pos] == 0x31 and pos + 1 < config_call_pos and data[pos + 1] == 0xC0:
            pos += 2  # xor ax, ax
        else:
            pos += 1
    return params


def _extract_simple_pushes(data, start, call_pos, max_count):
    """Extract push immediate values between two positions."""
    params = []
    pos = start
    while pos < call_pos and len(params) < max_count:
        if data[pos] == 0x6A:
            params.append(struct.unpack_from('B', data, pos + 1)[0])
            pos += 2
        elif data[pos] == 0x68:
            params.append(struct.unpack_from('<H', data, pos + 1)[0])
            pos += 3
        else:
            pos += 1
    return params


def _extract_field_writes_after_config(data, start, func_end):
    """Extract es: mov word [di+XX], val patterns after a CONFIG_A call.
    These set examine_section (+0x46) and click_section (+0x48)."""
    fields = {}
    limit = min(start + 80, func_end)
    for j in range(start, limit - 8):
        if (data[j] == 0xC4 and data[j+1] == 0x7E and
            data[j+3] == 0x26 and data[j+4] == 0xC7 and data[j+5] == 0x45):
            field_off = data[j+6]
            field_val = struct.unpack_from('<H', data, j+7)[0]
            fields[field_off] = field_val
    return fields


def _find_name_before_click_rect(data, click_rect_pos, func_start, cs_base):
    """Find the object name from the strcopy before a CLICK_RECT's push setup."""
    # Search backwards for strcopy, then find mov di before it
    for j in range(click_rect_pos - 1, max(click_rect_pos - 80, func_start), -1):
        if data[j:j+5] == CALL_STRCOPY:
            for k in range(j - 1, max(j - 15, func_start), -1):
                if data[k] == 0xBF:
                    str_cs_off = struct.unpack_from('<H', data, k + 1)[0]
                    return resolve_string(data, cs_base, str_cs_off)
            return None
        if data[j:j+5] == CALL_CLICK_RECT:
            return None  # hit previous CLICK_RECT
    return None


def extract_hotspots(data, func_start, func_end, cs_base):
    """Extract hotspot definitions from a scene init function."""
    hotspots = []

    # Find all call far 089E:0073 within this function
    i = func_start
    while i < func_end - 5:
        if data[i:i+5] == CALL_HOTSPOT:
            # Extract handler (push immediately before call)
            handler, pos = extract_push_before(data, i)

            # Find string copy call before the handler push
            strcopy_off = None
            for j in range(pos - 1, max(pos - 30, func_start), -1):
                if data[j:j+5] == CALL_STRCOPY:
                    strcopy_off = j
                    break

            name = None
            x = y = None
            if strcopy_off:
                # Find mov di, XXXX before string copy (string reference)
                for j in range(strcopy_off - 1, max(strcopy_off - 15, func_start), -1):
                    if data[j] == 0xBF:
                        str_cs_off = struct.unpack_from('<H', data, j + 1)[0]
                        name = resolve_string(data, cs_base, str_cs_off)
                        break

                # Find lea di,[bp+XX] before the mov di
                lea_off = None
                for j in range(strcopy_off - 5, max(strcopy_off - 20, func_start), -1):
                    if data[j] == 0x8D and data[j+1] in (0x7E, 0xBE):
                        lea_off = j
                        break

                if lea_off:
                    # Push y is right before lea, push x before that
                    y, pos2 = extract_push_before(data, lea_off)
                    if y is not None:
                        x, _ = extract_push_before(data, pos2)

            hotspots.append({
                'name': name,
                'x': x,
                'y': y,
                'handler': handler,
                'offset': i,
            })
            i += 5
        else:
            i += 1

    return hotspots


def extract_objects(data, func_start, func_end, cs_base):
    """Extract visual object definitions from a scene init function."""
    objects = []

    # Find all call far 089E:0000 within this function
    i = func_start
    while i < func_end - 5:
        if data[i:i+5] == CALL_OBJECT:
            # Find string copy call before this
            strcopy_off = None
            for j in range(i - 1, max(i - 30, func_start), -1):
                if data[j:j+5] == CALL_STRCOPY:
                    strcopy_off = j
                    break

            name = None
            obj_id = x = y = None
            if strcopy_off:
                # Find mov di (string ref)
                for j in range(strcopy_off - 1, max(strcopy_off - 15, func_start), -1):
                    if data[j] == 0xBF:
                        str_cs_off = struct.unpack_from('<H', data, j + 1)[0]
                        name = resolve_string(data, cs_base, str_cs_off)
                        break

                # Find lea
                lea_off = None
                for j in range(strcopy_off - 5, max(strcopy_off - 20, func_start), -1):
                    if data[j] == 0x8D and data[j+1] in (0x7E, 0xBE):
                        lea_off = j
                        break

                if lea_off:
                    # Push y, then x, then id (3 pushes before lea)
                    y, pos2 = extract_push_before(data, lea_off)
                    if y is not None:
                        x, pos3 = extract_push_before(data, pos2)
                        if x is not None:
                            obj_id, _ = extract_push_before(data, pos3)

            objects.append({
                'name': name,
                'id': obj_id,
                'x': x,
                'y': y,
                'offset': i,
            })
            i += 5
        else:
            i += 1

    return objects


def identify_scene(objects, hotspots, click_rects, scene_table):
    """Try to identify which scene a function belongs to by matching object names."""
    # Collect all names from objects, hotspots, and click rects
    names = set()
    for obj in objects:
        if obj['name']:
            names.add(obj['name'])
    for hs in hotspots:
        if hs['name']:
            names.add(hs['name'])
    for cr in click_rects:
        if cr['name']:
            names.add(cr['name'])

    # Check for "Music" removal (every scene has it)
    names.discard('Music')

    # Match by known patterns
    name_to_scene = {
        # Street scenes identified by To* exit hotspots
        frozenset(['ToStHotel', 'ToStrip0', 'ToStButcher']): 'StHosp',
        frozenset(['ToHotel', 'ToStHosp', 'ToStSuper']): 'StHotel',
        frozenset(['ToStButcher', 'ToStBurger', 'ToStHotel']): 'StSuper',
        frozenset(['ToButcher', 'ToStSuper', 'ToStHosp', 'ToStApart', 'ToStrip0']): 'StButcher',
        frozenset(['IntoBurger', 'ToStApart', 'ToStSuper', 'ToStZoo']): 'StBurger',
        frozenset(['ToStBurger', 'ToStrip0', 'ToStChoco', 'ToStButcher']): 'StApart',
        frozenset(['IntoZoo', 'ToStChoco', 'ToStBurger']): 'StZoo',
        frozenset(['ToStrip0', 'ToStZoo', 'ToStApart']): 'StChoco',
        # Locations identified by unique objects
        frozenset(['WalkUpstairs', 'Guard', 'DoorTrigger']): 'Airport',
        frozenset(['Lift', 'OldMan', 'LunchSign']): 'Lobby',
    }

    for key_names, scene in name_to_scene.items():
        if key_names.issubset(names):
            return scene

    # Try matching by unique object names
    unique_markers = {
        'CheckOut': 'Super', 'PushGate': 'Super',
        'Tripod': 'Photo', 'Camera': 'Photo',
        'Fridge': 'Butcher', 'OpenCage': 'Butcher',
        'Couch': 'WaltRoom', 'Panda': 'WaltRoom',
        'Spider': 'WaltRoom',
        'Fence': 'ZooFront', 'Giraf': 'ZooFront',
        'Gorilla': 'Floor4', 'RedArrow': 'Floor4',
        # 'L-Stairs' is shared by Floor1/2/3 — differentiated below by exit sections
        'Parrot': 'Room303',
        'Maid': 'Room301',
        'RoomSuitcase': 'Room302',
        'LadyOut': 'LobbyDsk', 'SmlBell': 'LobbyDsk',
        'DoSign': 'LobbyDsk',
        'Notebook': 'Bear',
        'MNKY': 'Monkey',
        'Pace': 'LionCage',
        'Flowers': 'Ending',
        'Dig': 'Caveman',
        'JuteBox': 'Burger', 'CashRegister': 'Burger',
        'A-Gum': 'StChoco', 'OpenVent': 'StChoco',
        'Arrive': 'Airport', 'Depart': 'Airport',
        'OutOfOrderSign': 'Lobby', 'LunchSign': 'Lobby',
        'Cindy': 'Clothes', 'Rack': 'Clothes',
        'AlexBed': 'Room303',
        'BabyUp': 'ZooBack', 'R-Sign': 'ZooBack',
        'Ambulanc': 'StHosp', 'GrnLight': 'StHosp',
        'HotelWall': 'StHotel', 'Hammer': 'StHotel',
        'SuperWall': 'StSuper', 'ShopClsd': 'StSuper',
        'ButClose': 'StButcher', 'SmallMap': 'StButcher',
        'BurgerBack': 'StBurger', 'Taxi': 'StBurger',
        'TopDoor': 'StApart',
        'ClsdSign': 'StZoo',
        'CashSign': 'Lobby', 'Letter1': 'Lobby',
        # Floor1/2/3 differentiated by exit sections below, not by markers
        'DnLeft': 'Floor1',
        'FlSign2': 'Floor4',
        'NoLift': 'Ward', 'Lift': 'Ward',
        'LadyFar': 'Ward',
        'SmallPhone': 'Aptment',  # apartment scene has TV + SmallPhone
    }

    for obj_name, scene in unique_markers.items():
        if obj_name in names:
            return scene

    # Collect all section IDs from click rects for cross-referencing
    exit_sections = set()
    examine_sections = set()
    all_section_ids = set()
    for cr in click_rects:
        if cr['exit_section'] is not None:
            exit_sections.add(cr['exit_section'])
        if cr['examine_section'] is not None:
            examine_sections.add(cr['examine_section'])
        for field in ('examine_section', 'click_section', 'talk_section', 'exit_section'):
            val = cr.get(field)
            if val is not None:
                all_section_ids.add(val)

    # Scenes with no objects but identifiable by section IDs
    if not names and all_section_ids:
        section_id_scenes = {
            frozenset([110, 520, 530, 535, 540, 560, 570, 580, 590, 600]): 'Bear',
            frozenset([110, 120, 510, 520, 530, 550, 560, 570, 580]): 'Monkey',
            frozenset([520, 530, 540, 550, 570, 590, 600]): 'Caveman',
            frozenset([520, 535, 540, 550, 560, 580, 590, 600]): 'Strip0',
        }
        for sids, scene in section_id_scenes.items():
            if all_section_ids == sids:
                return scene

    # Floor1/2/3 all share L-Stairs but differ in exit/examine sections
    if 'L-Stairs' in names:
        if 130 in exit_sections:
            return 'Floor1'
        elif 525 in examine_sections and len(click_rects) == 14:
            return 'Floor2'
        elif 525 in examine_sections and len(click_rects) == 13:
            return 'Floor3'

    # Room301 has Bed, Key, Pillow, Drawer
    if 'Bed' in names and 'Key' in names and 'Pillow' in names:
        return 'Room301'

    return None


def extract_all_scenes(ovr_path=None):
    """Extract hotspot data for all scenes from the overlay file."""
    if ovr_path is None:
        ovr_path = OVR_PATH

    with open(ovr_path, 'rb') as f:
        data = f.read()

    scene_table = parse_scene_table(data)
    functions = find_scene_init_functions(data)

    # Sort functions by offset
    functions.sort(key=lambda x: x[0])

    scenes = []
    for idx, (func_start, frame_size) in enumerate(functions):
        next_start = functions[idx + 1][0] if idx + 1 < len(functions) else len(data)
        func_end = find_function_end(data, func_start, next_start)
        cs_base = compute_cs_base(data, func_start, func_end)

        objects = extract_objects(data, func_start, func_end, cs_base)
        hotspots = extract_hotspots(data, func_start, func_end, cs_base)
        click_rects = extract_click_rects(data, func_start, func_end, cs_base)
        obj_props = extract_object_properties(data, func_start, func_end)

        scene_name = identify_scene(objects, hotspots, click_rects, scene_table)

        scenes.append({
            'scene': scene_name,
            'func_offset': func_start,
            'frame_size': frame_size,
            'cs_base': cs_base,
            'objects': objects,
            'hotspots': hotspots,
            'click_rects': click_rects,
            'obj_props': obj_props,
        })

    return scenes, scene_table


def print_scene(scene, verbose=False):
    """Print a single scene's hotspot data."""
    name = scene['scene'] or f"Unknown_0x{scene['func_offset']:05x}"
    print(f"\n{'='*70}")
    print(f"  Scene: {name}")
    print(f"  Function at OVR offset 0x{scene['func_offset']:05x}, "
          f"frame=0x{scene['frame_size']:04x}, "
          f"CS base={'0x'+format(scene['cs_base'],'05x') if scene['cs_base'] else 'unknown'}")
    print(f"  Objects: {len(scene['objects'])}, Hotspots: {len(scene['hotspots'])}, "
          f"Click Rects: {len(scene.get('click_rects', []))}")
    print(f"{'='*70}")

    if scene['objects']:
        print(f"\n  Visual Objects ({len(scene['objects'])}):")
        print(f"  {'#':>3} {'ID':>4} {'X':>5} {'Y':>5} {'Name'}")
        print(f"  {'-'*3} {'-'*4} {'-'*5} {'-'*5} {'-'*20}")
        for i, obj in enumerate(scene['objects']):
            oid = obj['id'] if obj['id'] is not None else '?'
            x = obj['x'] if obj['x'] is not None else '?'
            y = obj['y'] if obj['y'] is not None else '?'
            name = obj['name'] or '?'
            print(f"  {i:3d} {oid:>4} {x:>5} {y:>5} {name}")

    if scene['hotspots']:
        print(f"\n  Hotspots ({len(scene['hotspots'])}):")
        print(f"  {'#':>3} {'X':>5} {'Y':>5} {'Handler':>8} {'Name'}")
        print(f"  {'-'*3} {'-'*5} {'-'*5} {'-'*8} {'-'*20}")
        for i, hs in enumerate(scene['hotspots']):
            x = hs['x'] if hs['x'] is not None else '?'
            y = hs['y'] if hs['y'] is not None else '?'
            handler = hs['handler'] if hs['handler'] is not None else '?'
            name = hs['name'] or '?'
            print(f"  {i:3d} {x:>5} {y:>5} {handler:>8} {name}")

    click_rects = scene.get('click_rects', [])
    if click_rects:
        print(f"\n  Click Rects ({len(click_rects)}):")
        print(f"  {'#':>3} {'Type'} {'X1':>5} {'Y1':>5} {'X2':>5} {'Y2':>5} "
              f"{'Look':>6} {'Touch':>6} {'Talk':>6} {'Exit':>6} {'Name'}")
        print(f"  {'-'*3} {'-'*4} {'-'*5} {'-'*5} {'-'*5} {'-'*5} "
              f"{'-'*6} {'-'*6} {'-'*6} {'-'*6} {'-'*20}")
        for i, cr in enumerate(click_rects):
            x1 = cr['x1'] if cr['x1'] is not None else '?'
            y1 = cr['y1'] if cr['y1'] is not None else '?'
            x2 = cr['x2'] if cr['x2'] is not None else '?'
            y2 = cr['y2'] if cr['y2'] is not None else '?'
            look = cr['examine_section'] if cr['examine_section'] is not None else ''
            touch = cr['click_section'] if cr['click_section'] is not None else ''
            talk = cr['talk_section'] if cr['talk_section'] is not None else ''
            exit_s = cr['exit_section'] if cr['exit_section'] is not None else ''
            name = cr['name'] or ''
            extra = ''
            if cr['walk_x'] is not None:
                extra += f" walk=({cr['walk_x']},{cr['walk_y']})"
            if cr['field_44'] is not None:
                extra += f" f44={cr['field_44']}"
            if cr['field_62'] is not None:
                extra += f" f62={cr['field_62']}"
            print(f"  {i:3d} {cr['type']:>4} {x1:>5} {y1:>5} {x2:>5} {y2:>5} "
                  f"{look:>6} {touch:>6} {talk:>6} {exit_s:>6} {name}{extra}")


def main():
    args = sys.argv[1:]
    ovr_path = OVR_PATH
    target_scene = None
    output_json = False

    i = 0
    while i < len(args):
        if args[i] == '--scene' and i + 1 < len(args):
            target_scene = args[i + 1]
            i += 2
        elif args[i] == '--json':
            output_json = True
            i += 1
        elif args[i] == '--ovr' and i + 1 < len(args):
            ovr_path = args[i + 1]
            i += 2
        else:
            print(f"Unknown argument: {args[i]}")
            print(__doc__)
            sys.exit(1)

    scenes, scene_table = extract_all_scenes(ovr_path)

    if target_scene:
        scenes = [s for s in scenes if s['scene'] and
                  s['scene'].lower() == target_scene.lower()]
        if not scenes:
            print(f"Scene '{target_scene}' not found. Available scenes:")
            for s, _ in extract_all_scenes(ovr_path)[0]:
                if s.get('scene'):
                    print(f"  {s['scene']}")
            sys.exit(1)

    if output_json:
        # Clean up for JSON (remove file offsets)
        output = []
        for scene in scenes:
            output.append({
                'scene': scene['scene'],
                'objects': [{k: v for k, v in obj.items() if k != 'offset'}
                           for obj in scene['objects']],
                'hotspots': [{k: v for k, v in hs.items() if k != 'offset'}
                            for hs in scene['hotspots']],
                'click_rects': [{k: v for k, v in cr.items() if k != 'offset'}
                               for cr in scene.get('click_rects', [])],
            })
        print(json.dumps(output, indent=2))
    else:
        print(f"Scene table: {len(scene_table)} entries")
        print(f"Scene init functions found: {len(scenes)}")

        identified = sum(1 for s in scenes if s['scene'])
        total_objects = sum(len(s['objects']) for s in scenes)
        total_hotspots = sum(len(s['hotspots']) for s in scenes)
        total_click_rects = sum(len(s.get('click_rects', [])) for s in scenes)
        print(f"Identified scenes: {identified}")
        print(f"Total objects: {total_objects}, Total hotspots: {total_hotspots}, "
              f"Total click rects: {total_click_rects}")

        for scene in scenes:
            print_scene(scene)

        # Summary
        print(f"\n{'='*70}")
        print("SUMMARY")
        print(f"{'='*70}")
        for scene in sorted(scenes, key=lambda s: s['scene'] or 'zzz'):
            name = scene['scene'] or f"Unknown_0x{scene['func_offset']:05x}"
            print(f"  {name:<15s}  {len(scene['objects']):>3} objects  "
                  f"{len(scene['hotspots']):>3} hotspots  "
                  f"{len(scene.get('click_rects', [])):>3} click_rects")


if __name__ == '__main__':
    main()
