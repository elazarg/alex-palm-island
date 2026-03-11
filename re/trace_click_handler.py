#!/usr/bin/env python3
"""Analyze DOSBox memory dumps and logs to extract click rectangle tables.

This script helps map hotspot rectangles to SCX section IDs by:
1. Parsing DOSBox MEMDUMP output to find rectangle tables
2. Cross-referencing with extract_hotspots.py overlay data
3. Cross-referencing with SCX section IDs from parsed scene files

Usage:
    # Analyze a memory dump from DOSBox (raw binary)
    python3 re/trace_click_handler.py --memdump dump.bin --seg-offset 0x1234

    # Cross-reference overlay hotspots with SCX sections for a scene
    python3 re/trace_click_handler.py --scene Airport

    # Search a memory dump for rectangle-like structures
    python3 re/trace_click_handler.py --search-rects dump.bin

    # Test the linear mapping hypothesis (handler * 10 + 100 = section_id)
    python3 re/trace_click_handler.py --test-mapping

    # Parse a DOSBox debug instruction log for INT 33h / CMP patterns
    python3 re/trace_click_handler.py --parse-log alex_debug.log
"""
import argparse
import json
import os
import struct
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DECRYPTED_CD = os.path.join(PROJECT_ROOT, 'game_decrypted', 'cd')
GAME_CD = os.path.join(PROJECT_ROOT, 'game', 'cd')

# Import sibling modules
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, os.path.join(SCRIPT_DIR, 'formats'))


def load_overlay_hotspots(scene_name=None):
    """Load hotspot data from extract_hotspots.py."""
    try:
        from extract_hotspots import extract_all_scenes
    except ImportError:
        print("ERROR: Cannot import extract_hotspots.py from re/")
        print("Make sure you are running from the project root.")
        return None

    scenes, scene_table = extract_all_scenes()
    if scene_name:
        scenes = [s for s in scenes if s.get('scene') and
                  s['scene'].lower() == scene_name.lower()]
    return scenes


def load_scx_sections(scene_name):
    """Load SCX sections for a scene, returning interactive section IDs."""
    try:
        from parse_scx import parse_file
    except ImportError:
        print("ERROR: Cannot import parse_scx.py from re/formats/")
        return None

    # Try decrypted first, then original CD
    for base_dir in [DECRYPTED_CD, GAME_CD]:
        scx_path = os.path.join(base_dir, f'{scene_name.upper()}.SCX')
        if os.path.exists(scx_path):
            sections = parse_file(scx_path)
            return sections

    # Try case-insensitive search
    for base_dir in [DECRYPTED_CD, GAME_CD]:
        if not os.path.isdir(base_dir):
            continue
        for fname in os.listdir(base_dir):
            if fname.upper() == f'{scene_name.upper()}.SCX':
                sections = parse_file(os.path.join(base_dir, fname))
                return sections

    print(f"WARNING: SCX file not found for scene '{scene_name}'")
    return None


def get_interactive_section_ids(sections):
    """Extract interactive section IDs (100-499 range) from parsed SCX."""
    ids = []
    for s in sections:
        try:
            num_id = int(s['id'].split(',')[0])
        except ValueError:
            continue
        if 100 <= num_id < 500:
            ids.append(num_id)
    return sorted(ids)


def cross_reference_scene(scene_name):
    """Cross-reference overlay hotspots with SCX sections for a scene."""
    print(f"\n{'='*70}")
    print(f"  Scene: {scene_name}")
    print(f"{'='*70}")

    # Load overlay data
    scenes = load_overlay_hotspots(scene_name)
    if not scenes:
        print(f"  No overlay data found for '{scene_name}'")
        return

    scene = scenes[0]
    hotspots = scene['hotspots']
    objects = scene['objects']

    print(f"\n  Overlay hotspots ({len(hotspots)}):")
    print(f"  {'#':>3} {'X':>5} {'Y':>5} {'Handler':>8} {'Name'}")
    print(f"  {'-'*3} {'-'*5} {'-'*5} {'-'*8} {'-'*20}")
    for i, hs in enumerate(hotspots):
        x = hs['x'] if hs['x'] is not None else '?'
        y = hs['y'] if hs['y'] is not None else '?'
        handler = hs['handler'] if hs['handler'] is not None else '?'
        name = hs['name'] or '?'
        print(f"  {i:3d} {x:>5} {y:>5} {handler:>8} {name}")

    # Load SCX data
    sections = load_scx_sections(scene_name)
    if not sections:
        return

    interactive_ids = get_interactive_section_ids(sections)
    print(f"\n  SCX interactive sections ({len(interactive_ids)}): {interactive_ids}")

    # Test mapping hypotheses
    print(f"\n  Mapping analysis:")

    # Hypothesis 1: handler * 10 + 100 = section_id
    handler_vals = [hs['handler'] for hs in hotspots if hs['handler'] is not None]
    if handler_vals:
        predicted_linear = sorted(set(h * 10 + 100 for h in handler_vals))
        match_linear = set(predicted_linear) & set(interactive_ids)
        print(f"  Hypothesis: section = handler*10 + 100")
        print(f"    Predicted: {predicted_linear}")
        print(f"    Actual:    {interactive_ids}")
        print(f"    Overlap:   {sorted(match_linear)} "
              f"({len(match_linear)}/{len(predicted_linear)} match)")

        # Show per-hotspot mapping
        print(f"\n  Per-hotspot mapping (linear hypothesis):")
        for hs in hotspots:
            if hs['handler'] is not None:
                predicted = hs['handler'] * 10 + 100
                exists = predicted in interactive_ids
                marker = 'OK' if exists else 'MISS'
                print(f"    {hs['name'] or '?':20s} handler={hs['handler']:3d} "
                      f"-> section {predicted:4d}  [{marker}]")

    # Hypothesis 2: handler = section_id directly
    if handler_vals:
        direct_match = set(handler_vals) & set(interactive_ids)
        if direct_match:
            print(f"\n  Hypothesis: handler IS the section ID")
            print(f"    Direct matches: {sorted(direct_match)}")

    # Hypothesis 3: handler is an index into the section list
    if handler_vals and interactive_ids:
        print(f"\n  Hypothesis: handler is index into section list")
        for hs in hotspots:
            if hs['handler'] is not None:
                idx = hs['handler']
                if 0 <= idx < len(interactive_ids):
                    print(f"    {hs['name'] or '?':20s} handler={idx} "
                          f"-> sections[{idx}] = {interactive_ids[idx]}")
                else:
                    print(f"    {hs['name'] or '?':20s} handler={idx} "
                          f"-> OUT OF RANGE (max {len(interactive_ids)-1})")

    # Show unmatched sections (sections with no corresponding hotspot)
    if handler_vals:
        covered_linear = set(h * 10 + 100 for h in handler_vals)
        unmatched = set(interactive_ids) - covered_linear
        if unmatched:
            print(f"\n  Unmatched interactive sections: {sorted(unmatched)}")
            print(f"  (These may be jump targets via K commands, not direct click handlers)")


def search_rectangles(dump_data, base_offset=0):
    """Search a memory dump for structures that look like click rectangles.

    Looks for sequences of 4 u16 values where:
    - x1 < x2 (both 0-1200 range for scrolling scenes)
    - y1 < y2 (both 0-200)
    - Values are plausible VGA coordinates
    """
    print(f"\nSearching {len(dump_data)} bytes for rectangle-like structures...")
    print(f"Base offset: 0x{base_offset:04x}")

    candidates = []
    stride_candidates = {}

    for i in range(0, len(dump_data) - 8, 2):
        x1, y1, x2, y2 = struct.unpack_from('<HHHH', dump_data, i)

        # Plausibility checks
        if x1 > 1200 or x2 > 1200 or y1 > 200 or y2 > 200:
            continue
        if x1 >= x2 or y1 >= y2:
            continue
        # Rectangle should have reasonable size
        if (x2 - x1) < 5 or (y2 - y1) < 5:
            continue
        if (x2 - x1) > 600 or (y2 - y1) > 200:
            continue

        candidates.append((i, x1, y1, x2, y2))

    print(f"Found {len(candidates)} plausible rectangles\n")

    if not candidates:
        return

    # Look for groups of consecutive rectangles (same stride)
    for i in range(len(candidates) - 1):
        gap = candidates[i+1][0] - candidates[i][0]
        if gap not in stride_candidates:
            stride_candidates[gap] = []
        stride_candidates[gap].append(i)

    # Show the most common strides (likely the record size)
    print("Stride analysis (offset gap between consecutive rectangles):")
    for stride, indices in sorted(stride_candidates.items(),
                                   key=lambda x: -len(x[1])):
        if len(indices) >= 2:
            print(f"  Stride {stride} bytes: {len(indices)+1} rectangles in sequence")

    # Print all candidates grouped by proximity
    print(f"\nAll candidate rectangles:")
    print(f"  {'Offset':>8} {'x1':>5} {'y1':>5} {'x2':>5} {'y2':>5} "
          f"{'Width':>6} {'Height':>7}")
    print(f"  {'-'*8} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*6} {'-'*7}")

    prev_offset = -100
    for offset, x1, y1, x2, y2 in candidates:
        if offset - prev_offset > 32:
            print(f"  --- gap ---")
        abs_offset = base_offset + offset
        print(f"  {abs_offset:>#8x} {x1:5d} {y1:5d} {x2:5d} {y2:5d} "
              f"{x2-x1:6d} {y2-y1:7d}")
        prev_offset = offset


def parse_debug_log(logfile):
    """Parse a DOSBox debug instruction log for click-related patterns.

    Looks for:
    - INT 33h calls (mouse interrupt)
    - CMP instructions with plausible coordinate values
    - Sequences suggesting rectangle hit-testing
    """
    print(f"Parsing debug log: {logfile}")

    int33_count = 0
    cmp_coords = []
    last_int33_line = 0

    with open(logfile, 'r') as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()

            # Look for INT 33h
            if 'int 33' in line.lower() or 'INT 33' in line:
                int33_count += 1
                last_int33_line = lineno
                print(f"  [{lineno:6d}] INT 33h: {line}")

            # Look for CMP with values in coordinate range
            if 'cmp' in line.lower():
                # Try to extract compared values
                parts = line.split()
                for p in parts:
                    try:
                        val = int(p, 16)
                        if 0 < val < 1200 and lineno - last_int33_line < 50:
                            cmp_coords.append((lineno, val, line))
                    except ValueError:
                        pass

    print(f"\n  Total INT 33h calls: {int33_count}")
    if cmp_coords:
        print(f"  CMP with coordinate-range values near INT 33h ({len(cmp_coords)}):")
        for lineno, val, line in cmp_coords[:30]:
            print(f"    [{lineno:6d}] val={val:5d}  {line[:80]}")


def test_all_mappings():
    """Test the handler-to-section mapping across all scenes."""
    scenes = load_overlay_hotspots()
    if not scenes:
        return

    print(f"Testing handler-to-section mapping across all scenes\n")
    print(f"{'Scene':15s} {'Hotspots':>8} {'Sections':>8} "
          f"{'Linear':>7} {'Index':>6}")
    print(f"{'-'*15} {'-'*8} {'-'*8} {'-'*7} {'-'*6}")

    total_linear_ok = 0
    total_linear_total = 0
    total_index_ok = 0
    total_index_total = 0

    for scene_data in scenes:
        scene_name = scene_data.get('scene')
        if not scene_name:
            continue

        hotspots = scene_data['hotspots']
        handler_vals = [hs['handler'] for hs in hotspots
                        if hs['handler'] is not None]
        if not handler_vals:
            continue

        sections = load_scx_sections(scene_name)
        if not sections:
            continue

        interactive_ids = get_interactive_section_ids(sections)
        if not interactive_ids:
            continue

        # Test linear: handler * 10 + 100
        linear_ok = sum(1 for h in handler_vals if h * 10 + 100 in interactive_ids)
        linear_pct = f"{linear_ok}/{len(handler_vals)}"

        # Test index: handler is index into sorted section list
        index_ok = sum(1 for h in handler_vals
                       if 0 <= h < len(interactive_ids))
        index_pct = f"{index_ok}/{len(handler_vals)}"

        total_linear_ok += linear_ok
        total_linear_total += len(handler_vals)
        total_index_ok += index_ok
        total_index_total += len(handler_vals)

        print(f"{scene_name:15s} {len(hotspots):8d} {len(interactive_ids):8d} "
              f"{linear_pct:>7} {index_pct:>6}")

    print(f"\n{'TOTAL':15s} {'':8s} {'':8s} "
          f"{total_linear_ok}/{total_linear_total} "
          f"{total_index_ok}/{total_index_total}")

    if total_linear_total > 0:
        pct = total_linear_ok / total_linear_total * 100
        print(f"\nLinear mapping (h*10+100) accuracy: {pct:.1f}%")
    if total_index_total > 0:
        pct = total_index_ok / total_index_total * 100
        print(f"Index mapping accuracy: {pct:.1f}%")


def dump_table_formatted(dump_data, record_size, base_offset=0, max_records=50):
    """Display a memory dump as a table of records.

    Tries multiple interpretations of each record:
    - As u16 fields (most likely for coordinate data)
    - As mixed u16 + u8 fields
    """
    num_records = min(len(dump_data) // record_size, max_records)
    print(f"\nDump as {record_size}-byte records ({num_records} records):")
    print(f"  {'#':>3} {'Offset':>8}  Fields (u16 LE)")
    print(f"  {'-'*3} {'-'*8}  {'-'*60}")

    for i in range(num_records):
        offset = i * record_size
        record = dump_data[offset:offset + record_size]

        # Show as u16 values
        u16_count = record_size // 2
        vals = []
        for j in range(u16_count):
            if j * 2 + 2 <= len(record):
                v = struct.unpack_from('<H', record, j * 2)[0]
                vals.append(f"{v:5d}")
            else:
                vals.append("  ???")

        abs_off = base_offset + offset
        print(f"  {i:3d} {abs_off:>#8x}  {' '.join(vals)}")

        # Check if this looks like a rectangle
        if len(vals) >= 4:
            raw = [struct.unpack_from('<H', record, j * 2)[0] for j in range(4)]
            if (raw[0] < raw[2] and raw[1] < raw[3] and
                raw[2] <= 1200 and raw[3] <= 200):
                print(f"              ^^^ looks like rect: "
                      f"({raw[0]},{raw[1]})-({raw[2]},{raw[3]}) "
                      f"= {raw[2]-raw[0]}x{raw[3]-raw[1]}")


def main():
    parser = argparse.ArgumentParser(
        description='Analyze DOSBox memory dumps for click handler data')

    parser.add_argument('--scene', type=str,
                        help='Cross-reference overlay hotspots with SCX for a scene')
    parser.add_argument('--memdump', type=str,
                        help='Path to DOSBox MEMDUMP binary file')
    parser.add_argument('--seg-offset', type=str, default='0',
                        help='Base segment:offset for the dump (hex)')
    parser.add_argument('--record-size', type=int, default=0,
                        help='Record size for table display')
    parser.add_argument('--search-rects', type=str,
                        help='Search a memory dump for rectangle structures')
    parser.add_argument('--test-mapping', action='store_true',
                        help='Test handler-to-section mapping across all scenes')
    parser.add_argument('--parse-log', type=str,
                        help='Parse a DOSBox debug instruction log')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')

    args = parser.parse_args()

    if args.test_mapping:
        test_all_mappings()
        return

    if args.scene:
        if args.json:
            scenes = load_overlay_hotspots(args.scene)
            if scenes:
                scene = scenes[0]
                sections = load_scx_sections(args.scene)
                interactive_ids = get_interactive_section_ids(sections) if sections else []
                output = {
                    'scene': args.scene,
                    'hotspots': scene['hotspots'],
                    'interactive_sections': interactive_ids,
                    'mapping_linear': {
                        hs['name']: {
                            'handler': hs['handler'],
                            'predicted_section': hs['handler'] * 10 + 100
                            if hs['handler'] is not None else None,
                            'exists': (hs['handler'] * 10 + 100 in interactive_ids)
                            if hs['handler'] is not None else False,
                        }
                        for hs in scene['hotspots']
                    }
                }
                print(json.dumps(output, indent=2))
        else:
            cross_reference_scene(args.scene)
        return

    if args.search_rects:
        with open(args.search_rects, 'rb') as f:
            dump_data = f.read()
        base = int(args.seg_offset, 0)
        search_rectangles(dump_data, base)
        return

    if args.memdump:
        with open(args.memdump, 'rb') as f:
            dump_data = f.read()
        base = int(args.seg_offset, 0)

        if args.record_size > 0:
            dump_table_formatted(dump_data, args.record_size, base)
        else:
            # Try common record sizes
            for rs in [8, 10, 12, 16, 20, 24]:
                dump_table_formatted(dump_data, rs, base, max_records=10)
            # Also search for rectangles
            search_rectangles(dump_data, base)
        return

    if args.parse_log:
        parse_debug_log(args.parse_log)
        return

    # Default: test mapping across all scenes
    print("No action specified. Running --test-mapping by default.\n")
    test_all_mappings()


if __name__ == '__main__':
    main()
