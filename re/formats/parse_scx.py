#!/usr/bin/env python3
"""Parse SCX (scene script) and DCX (dialog text) files for Alex Palm Island.

Both formats share the same structure after decryption:
  - Byte 0: 0xC0 (format header)
  - Sections separated by 0xFE delimiter byte
  - Each section starts with a section ID line
  - Lines terminated by \\r\\n

SCX files contain scene commands (animation, interaction, transitions).
DCX files contain Hebrew dialog text (CP862 encoding).

Section types in SCX:
  - Animation sections (5000+): frame commands like P, V, G, F, D, R, S, X
  - Interactive sections (100-499): comma-separated records with commands
  - Dialog sections (2000+): dialog trees with speaker, choices, responses
  - Data sections (5000+): coordinate/timing data
  - Text reference sections (500-999): section_id,flags,sound_resource

SCX commands:
  P n,m      - Pause/picture: display frame n, delay m
  V n,m      - Visibility: set state n to value m (or V name,value)
  G n,m      - Goto frame n with mode m
  F n,m      - Fade frame n over duration m
  D n[,m]    - Display/dialog frame n
  S n,m      - Set state/sound
  R n,m      - Reset/return state
  X n,m      - Execute action
  W n,x,y    - Walk/position at (x,y)
  T id       - Transition to scene id
  C snd,val  - Change/call sound resource
  K id       - Keyboard/event trigger
  Q          - Quit section
  O obj,id   - Object interaction
  A s,obj,v  - Animate object
  B obj,s    - Behavior/sprite state
  L id       - Load resource
  H id       - Handle/display dialog
  E n,m      - Effect control
  I n,m      - Initialize

Usage:
    python3 re/formats/parse_scx.py game_decrypted/cd/LOGO.SCX
    python3 re/formats/parse_scx.py --stats game_decrypted/cd/  # stats for all files
"""
import os
import sys

SECTION_DELIMITER = 0xFE
HEADER_BYTE = 0xC0


def parse_scx(data):
    """Parse decrypted SCX/DCX data. Returns list of sections.

    Each section is a dict with:
      - 'id': section ID string (first line after delimiter)
      - 'lines': list of text lines in the section
      - 'type': inferred section type
    """
    if not data or data[0] != HEADER_BYTE:
        raise ValueError(f"Expected 0xC0 header, got 0x{data[0]:02x}")

    # Split on 0xFE delimiter
    parts = data[1:].split(bytes([SECTION_DELIMITER]))

    sections = []
    for part in parts:
        text = part.decode('cp862', errors='replace').strip()
        if not text:
            continue

        lines = text.split('\r\n')
        section_id = lines[0].strip()
        body_lines = lines[1:] if len(lines) > 1 else []

        # Infer section type
        section_type = _classify_section(section_id, body_lines)

        sections.append({
            'id': section_id,
            'lines': body_lines,
            'type': section_type,
        })

    return sections


def _classify_section(section_id, lines):
    """Classify a section based on its ID and content."""
    # Check if ID is purely numeric
    try:
        num_id = int(section_id.split(',')[0])
    except ValueError:
        return 'unknown'

    if num_id >= 5000:
        # Check if it's animation commands or coordinate data
        if lines and any(lines[0].startswith(c) for c in 'PVGFDSRXQ'):
            return 'animation'
        return 'data'
    elif num_id >= 2000:
        return 'dialog'
    elif num_id >= 500:
        return 'text_ref'
    elif num_id >= 100:
        return 'interactive'
    else:
        return 'other'


def parse_command(line):
    """Parse a single SCX command line. Returns (cmd, args) or None."""
    line = line.strip()
    if not line:
        return None
    if line == '-1':
        return ('END', [])
    if line == 'Q':
        return ('Q', [])

    # Single-letter commands: "P 3,0" or "V name,1"
    if len(line) >= 2 and line[0].isalpha() and line[1] == ' ':
        cmd = line[0]
        args = line[2:].split(',')
        return (cmd, [a.strip() for a in args])

    # Comma-separated record: "0,0,W,0,210,155"
    parts = line.split(',')
    if len(parts) >= 3 and parts[2].strip().isalpha() and len(parts[2].strip()) == 1:
        cmd = parts[2].strip()
        return (cmd, [p.strip() for p in parts[:2]] + [p.strip() for p in parts[3:]])

    return ('RAW', [line])


def extract_commands(sections):
    """Extract all unique commands used across sections. Returns dict of cmd -> example."""
    commands = {}
    for section in sections:
        for line in section['lines']:
            parsed = parse_command(line)
            if parsed and parsed[0] not in commands:
                commands[parsed[0]] = line
    return commands


def parse_file(filepath):
    """Read and parse a decrypted SCX/DCX file."""
    with open(filepath, 'rb') as f:
        data = f.read()
    return parse_scx(data)


def print_sections(sections, filepath=None):
    """Pretty-print parsed sections."""
    if filepath:
        ext = os.path.splitext(filepath)[1].upper()
        print(f"\n{'='*70}")
        print(f"  {filepath}: {len(sections)} sections")
        print(f"{'='*70}")

    type_counts = {}
    for s in sections:
        type_counts[s['type']] = type_counts.get(s['type'], 0) + 1
        line_count = len(s['lines'])
        preview = s['lines'][0][:60] if s['lines'] else '(empty)'
        print(f"  [{s['type']:>12}] {s['id']:<20} {line_count:>4} lines  {preview}")

    print(f"\n  Section types: {type_counts}")

    # Show unique commands
    commands = extract_commands(sections)
    if commands:
        print(f"\n  Unique commands ({len(commands)}):")
        for cmd in sorted(commands.keys()):
            print(f"    {cmd:>4}: {commands[cmd]}")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    if args[0] == '--stats':
        directory = args[1] if len(args) > 1 else '.'
        all_commands = {}
        for fname in sorted(os.listdir(directory)):
            if fname.upper().endswith(('.SCX', '.DCX')):
                filepath = os.path.join(directory, fname)
                try:
                    sections = parse_file(filepath)
                    cmds = extract_commands(sections)
                    all_commands.update(cmds)
                    print(f"  {fname:20s} {len(sections):>3} sections, "
                          f"{sum(len(s['lines']) for s in sections):>5} lines")
                except Exception as e:
                    print(f"  {fname:20s} ERROR: {e}")

        print(f"\nAll commands across all files ({len(all_commands)}):")
        for cmd in sorted(all_commands.keys()):
            print(f"  {cmd:>4}: {all_commands[cmd]}")
    else:
        for filepath in args:
            sections = parse_file(filepath)
            print_sections(sections, filepath)


if __name__ == '__main__':
    main()
