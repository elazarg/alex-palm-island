#!/usr/bin/env python3
"""
Parse and display Alex Palm Island .GAM save files.

Usage:
    python3 re/parse_save.py re/save_samples/4.GAM
    python3 re/parse_save.py --flags re/save_samples/4.GAM
    python3 re/parse_save.py --compare re/save_samples/3.GAM re/save_samples/4.GAM
    python3 re/parse_save.py --hex re/save_samples/4.GAM
"""

import struct
import sys
import argparse
from pathlib import Path


# === Constants ===

FLAG_AREA_SIZE = 0x4E4       # 1,252 bytes = 9,952+16 bits (9,968 flag positions)
SCENE_HEADER_OFFSET = 0x4E4  # Scene name (Pascal string) + scene state
OBJECTS_START = 0x507         # First object record always starts here
SCENE_HEADER_SIZE = OBJECTS_START - SCENE_HEADER_OFFSET  # 35 bytes

# Known record sizes (base=60, extensions vary by object type)
BASE_RECORD_SIZE = 60


def parse_flags(data):
    """Parse the 0x4E4-byte flag bit array. Returns list of set bit positions."""
    flags = data[:FLAG_AREA_SIZE]
    set_bits = []
    for byte_idx in range(len(flags)):
        byte_val = flags[byte_idx]
        if byte_val == 0:
            continue
        for bit in range(8):
            if byte_val & (1 << bit):
                set_bits.append(byte_idx * 8 + bit)
    return set_bits


def parse_scene_header(data):
    """Parse the 35-byte scene header at 0x4E4."""
    offset = SCENE_HEADER_OFFSET
    name_len = data[offset]
    name = data[offset + 1:offset + 1 + name_len].decode('ascii', errors='replace')
    # Remaining bytes after name (up to 35 total) are scene state
    state_start = offset + 1 + name_len
    state_data = data[state_start:OBJECTS_START]
    return {
        'name': name,
        'raw': data[offset:OBJECTS_START],
        'state_data': state_data,
    }


def find_next_record(data, pos):
    """Find the size of the record at pos by scanning for the next valid Pascal string."""
    for try_size in range(56, 400):
        next_pos = pos + try_size
        if next_pos >= len(data):
            return try_size  # last record extends to EOF
        next_len = data[next_pos]
        if 2 <= next_len <= 20 and next_pos + 1 + next_len <= len(data):
            next_name = data[next_pos + 1:next_pos + 1 + next_len]
            if all(0x20 <= b <= 0x7E for b in next_name):
                return try_size
    return None


def classify_record(name, size):
    """Classify record type based on name and size."""
    if name.endswith('Icon'):
        return 'inventory'
    if name.startswith('sn'):
        return 'scene_state'
    if name == 'ALEX':
        return 'player'
    if name == 'Backdrop':
        return 'backdrop'
    if name == 'Score':
        return 'score_display'
    if name.startswith(' ') or name.startswith('-') or name[0].isdigit():
        return 'score_text'
    if name in ('MoneyBox', 'Money', 'Meter'):
        return name.lower()
    if name in ('NoMap', 'NoBag'):
        return 'ui_state'
    if name.endswith('Button'):
        return 'ui_button'
    if name == 'Panel':
        return 'ui_panel'
    if name == 'Door':
        return 'interactive'
    if size == 69:
        return 'interactive'
    if size == 74:
        return 'scene_block'
    return 'scene_object'


def parse_record_fields(name, rec, size, record_type):
    """Extract known fields from a record based on its type."""
    fields = {}

    # Common fields at fixed offsets (valid for all records >= 42 bytes)
    if size >= 42:
        fields['field_33'] = struct.unpack_from('<H', rec, 33)[0]
        fields['field_35'] = struct.unpack_from('<H', rec, 35)[0]
        fields['field_37'] = struct.unpack_from('<H', rec, 37)[0]
        fields['visibility'] = rec[39]
        fields['field_40'] = rec[40]
        fields['field_41'] = struct.unpack_from('<H', rec, 41)[0]

    if size >= 53:
        fields['slot_id'] = struct.unpack_from('<H', rec, 51)[0]

    if record_type == 'player' and size >= 65:
        fields['x'] = struct.unpack_from('<H', rec, 60)[0]
        fields['y'] = struct.unpack_from('<H', rec, 62)[0]
        fields['direction'] = rec[64]

    if record_type == 'backdrop' and size >= 62:
        fields['scroll_x'] = struct.unpack_from('<H', rec, 60)[0]

    if record_type == 'scene_state' and size >= 64:
        fields['extra'] = rec[60:size]

    if record_type == 'moneybox':
        fields['max_value'] = fields.get('field_41', 0)

    if record_type == 'meter':
        fields['value'] = fields.get('field_35', 0)
        fields['max_value'] = fields.get('field_41', 0)

    if record_type == 'score_text' and size >= 263:
        # Palmettoes stored as u32 LE at offsets +259 and +263
        fields['palmettoes'] = struct.unpack_from('<I', rec, 259)[0]
        fields['palmettoes_dup'] = struct.unpack_from('<I', rec, 263)[0]

    if record_type == 'inventory':
        fields['inv_slot'] = fields.get('slot_id', 0)
        # visibility 4 = in inventory (not acquired), 1 = acquired/carried
        vis = fields.get('visibility', 0)
        if vis == 4:
            fields['acquired'] = False
        elif vis == 1:
            fields['acquired'] = True
        else:
            fields['acquired'] = None

    if record_type == 'interactive' and size >= 69:
        fields['extra_9'] = rec[60:69]

    return fields


def parse_save(data):
    """Parse a complete .GAM save file. Returns a dict with all parsed info."""
    result = {
        'size': len(data),
        'flags': parse_flags(data),
        'scene': parse_scene_header(data),
        'records': [],
    }

    pos = OBJECTS_START
    while pos < len(data):
        name_len = data[pos]
        if name_len == 0 or name_len > 30:
            break
        name_bytes = data[pos + 1:pos + 1 + name_len]
        if not all(0x20 <= b <= 0x7E for b in name_bytes):
            break
        name = name_bytes.decode('ascii')

        rec_size = find_next_record(data, pos)
        if rec_size is None:
            break

        rec_data = data[pos:pos + rec_size]
        rec_type = classify_record(name, rec_size)
        fields = parse_record_fields(name, rec_data, rec_size, rec_type)

        result['records'].append({
            'offset': pos,
            'name': name,
            'size': rec_size,
            'type': rec_type,
            'fields': fields,
            'raw': rec_data,
        })

        pos += rec_size

    return result


def find_palmettoes(save):
    """Find the Palmettoes value from the score text record."""
    for rec in save['records']:
        if rec['type'] == 'score_text':
            return rec['fields'].get('palmettoes', None)
    return None


def find_meter(save):
    """Find the Meter value."""
    for rec in save['records']:
        if rec['type'] == 'meter':
            return rec['fields'].get('value', None)
    return None


# === Display functions ===

def print_summary(save, filename):
    """Print a concise summary of the save file."""
    palmettoes = find_palmettoes(save)
    meter = find_meter(save)

    print(f"=== {filename} ({save['size']} bytes) ===")
    print(f"Scene: {save['scene']['name']}")
    print(f"Flags set: {len(save['flags'])}")
    if palmettoes is not None:
        print(f"Palmettoes: {palmettoes}")
    if meter is not None:
        print(f"Meter: {meter}")
    print(f"Total records: {len(save['records'])}")

    # Count by type
    scene_recs = []
    global_recs = []
    in_global = False
    for rec in save['records']:
        if rec['name'] == 'NoMap':
            in_global = True
        if in_global:
            global_recs.append(rec)
        else:
            scene_recs.append(rec)

    print(f"  Scene objects: {len(scene_recs)}")
    print(f"  Global objects: {len(global_recs)}")
    print()


def print_records(save):
    """Print all object records with their fields."""
    in_global = False
    for rec in save['records']:
        if rec['name'] == 'NoMap' and not in_global:
            in_global = True
            print("--- Global objects ---")

        fields = rec['fields']
        size_str = f"[{rec['size']:3d}]"
        type_str = f"({rec['type']})"

        extras = []
        if rec['type'] == 'player':
            extras.append(f"x={fields.get('x', '?')}, y={fields.get('y', '?')}, dir={fields.get('direction', '?')}")
        elif rec['type'] == 'backdrop':
            extras.append(f"scroll_x={fields.get('scroll_x', '?')}")
        elif rec['type'] == 'score_text':
            extras.append(f"palmettoes={fields.get('palmettoes', '?')}")
        elif rec['type'] == 'meter':
            extras.append(f"value={fields.get('value', '?')}/{fields.get('max_value', '?')}")
        elif rec['type'] == 'moneybox':
            extras.append(f"max={fields.get('max_value', '?')}")
        elif rec['type'] == 'inventory':
            acq = fields.get('acquired')
            slot = fields.get('inv_slot', 0)
            acq_str = 'acquired' if acq else ('not acquired' if acq is False else 'unknown')
            extras.append(f"slot={slot}, {acq_str}")
        elif rec['type'] == 'scene_state':
            pass

        vis = fields.get('visibility', '')
        vis_str = f" vis={vis}" if vis != '' else ''

        extra_str = f"  [{', '.join(extras)}]" if extras else ''
        print(f"  0x{rec['offset']:04X}: {size_str} {rec['name']:20s} {type_str:16s}{vis_str}{extra_str}")


def print_flags(save):
    """Print all set flag bit positions."""
    flags = save['flags']
    if not flags:
        print("No flags set.")
        return

    print(f"{len(flags)} flags set:")
    for bit_pos in flags:
        byte_idx = bit_pos // 8
        bit_num = bit_pos % 8
        print(f"  Bit {bit_pos:5d}  (byte 0x{byte_idx:03X}, bit {bit_num})")


def print_hex_records(save):
    """Print hex dump of each record."""
    for rec in save['records']:
        print(f"--- {rec['name']} (0x{rec['offset']:04X}, {rec['size']} bytes, {rec['type']}) ---")
        raw = rec['raw']
        for i in range(0, len(raw), 16):
            chunk = raw[i:i + 16]
            hex_part = ' '.join(f'{b:02x}' for b in chunk)
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            print(f"  +{i:3d}: {hex_part:<48s}  {ascii_part}")
        print()


def print_inventory(save):
    """Print inventory items with their states."""
    print("Inventory items:")
    for rec in save['records']:
        if rec['type'] == 'inventory':
            fields = rec['fields']
            slot = fields.get('inv_slot', 0)
            acq = fields.get('acquired')
            name = rec['name'].replace('Icon', '')
            status = 'ACQUIRED' if acq else ('not acquired' if acq is False else 'unknown')
            print(f"  Slot {slot:3d}: {name:15s} [{status}]")


def compare_saves(save1, save2, file1, file2):
    """Compare two save files and show differences."""
    print(f"Comparing {file1} vs {file2}")
    print()

    # Flag differences
    flags1 = set(save1['flags'])
    flags2 = set(save2['flags'])
    new_flags = flags2 - flags1
    removed_flags = flags1 - flags2
    if new_flags:
        print(f"New flags in {file2}: {sorted(new_flags)}")
    if removed_flags:
        print(f"Removed flags in {file2}: {sorted(removed_flags)}")
    if not new_flags and not removed_flags:
        print("Flags: identical")
    print()

    # Scene
    if save1['scene']['name'] != save2['scene']['name']:
        print(f"Scene changed: {save1['scene']['name']} -> {save2['scene']['name']}")
    else:
        print(f"Scene: {save1['scene']['name']} (unchanged)")
    print()

    # Build record maps
    recs1 = {r['name']: r for r in save1['records']}
    recs2 = {r['name']: r for r in save2['records']}

    # New/removed records
    names1 = set(recs1.keys())
    names2 = set(recs2.keys())
    new_recs = names2 - names1
    removed_recs = names1 - names2
    if new_recs:
        print(f"New records: {sorted(new_recs)}")
    if removed_recs:
        print(f"Removed records: {sorted(removed_recs)}")

    # Changed records
    common = names1 & names2
    for name in sorted(common):
        r1 = recs1[name]
        r2 = recs2[name]
        if r1['raw'] != r2['raw']:
            diffs = []
            minlen = min(len(r1['raw']), len(r2['raw']))
            for i in range(minlen):
                if r1['raw'][i] != r2['raw'][i]:
                    diffs.append((i, r1['raw'][i], r2['raw'][i]))
            if len(r1['raw']) != len(r2['raw']):
                print(f"  {name}: size changed {r1['size']} -> {r2['size']}")
            if diffs:
                print(f"  {name}: {len(diffs)} byte(s) differ")
                for off, v1, v2 in diffs[:5]:
                    print(f"    +{off}: 0x{v1:02x} -> 0x{v2:02x}")
                if len(diffs) > 5:
                    print(f"    ... and {len(diffs) - 5} more")


def main():
    parser = argparse.ArgumentParser(description='Parse Alex Palm Island .GAM save files')
    parser.add_argument('files', nargs='+', help='GAM file(s) to parse')
    parser.add_argument('--flags', action='store_true', help='Show all set flags')
    parser.add_argument('--hex', action='store_true', help='Hex dump all records')
    parser.add_argument('--inventory', action='store_true', help='Show inventory items')
    parser.add_argument('--compare', action='store_true', help='Compare two files')
    args = parser.parse_args()

    if args.compare:
        if len(args.files) != 2:
            print("--compare requires exactly 2 files", file=sys.stderr)
            sys.exit(1)
        with open(args.files[0], 'rb') as f:
            data1 = f.read()
        with open(args.files[1], 'rb') as f:
            data2 = f.read()
        save1 = parse_save(data1)
        save2 = parse_save(data2)
        compare_saves(save1, save2, args.files[0], args.files[1])
        return

    for filepath in args.files:
        with open(filepath, 'rb') as f:
            data = f.read()

        save = parse_save(data)
        print_summary(save, filepath)

        if args.flags:
            print_flags(save)
            print()

        if args.inventory:
            print_inventory(save)
            print()

        print_records(save)
        print()

        if args.hex:
            print_hex_records(save)


if __name__ == '__main__':
    main()
