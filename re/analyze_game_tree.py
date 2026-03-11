#!/usr/bin/env python3
"""Static analysis of all SCX files: extract game logic tree.

Parses all SCX scene scripts and extracts commands, scene transitions,
flag dependencies, Palmettoes flow, dialog chains, and produces a
complete command reference.

Usage:
    python3 re/analyze_game_tree.py                  # full summary
    python3 re/analyze_game_tree.py --transitions    # scene transition graph
    python3 re/analyze_game_tree.py --flags          # flag dependency analysis
    python3 re/analyze_game_tree.py --palmettoes     # all Palmettoes changes
    python3 re/analyze_game_tree.py --quiz-rewards   # reward-bearing dialog sections
    python3 re/analyze_game_tree.py --commands       # command reference with counts
    python3 re/analyze_game_tree.py --scene Airport  # all commands for one scene
    python3 re/analyze_game_tree.py --json           # full analysis as JSON

Command format in interactive sections (100-499):
    flag_id,condition,COMMAND_LETTER,args...
    where flag_id=0,condition=0 means unconditional.

Animation sections (5000+) use a different format: "LETTER args"
and are tracked separately.
"""

import argparse
import json
import os
import sys
from collections import defaultdict

# Import the SCX parser from formats/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'formats'))
from parse_scx import parse_scx


# Default path to decrypted SCX files
DEFAULT_SCX_DIR = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')

# Command letter descriptions
COMMAND_DESCRIPTIONS = {
    'B': 'Object visibility',
    'W': 'Walk to position',
    'H': 'Show text/dialog',
    'D': 'Set direction/facing',
    'V': 'Set variable',
    'L': 'Load resource',
    'K': 'Jump to section',
    'X': 'Exit section (end execution)',
    'A': 'Start animation',
    'F': 'Set flag',
    'T': 'Enter dialog/transition',
    'C': 'Change scene',
    'O': 'Object property',
    'G': 'Graphics-related',
    'Y': 'Unknown',
    'P': 'Palmettoes change',
    'M': 'Music',
    'S': 'Sound',
    'R': 'Unknown',
}

# Section type classification by ID range
SECTION_TYPE_NAMES = {
    'interactive': '100-499: Interactive (hotspot handlers)',
    'text_ref': '500-999: Text/narration',
    'dialog': '1000-1999: Dialog text / 2000-2999: Dialog trees',
    'animation': '5000+: Animation sequences',
    'data': '5000+: Data sections',
}


def load_all_scenes(scx_dir):
    """Load and parse all SCX files from the given directory.

    Returns a dict of scene_name -> list of sections.
    """
    scenes = {}
    for fname in sorted(os.listdir(scx_dir)):
        if not fname.upper().endswith('.SCX'):
            continue
        filepath = os.path.join(scx_dir, fname)
        scene_name = os.path.splitext(fname)[0]
        try:
            with open(filepath, 'rb') as f:
                data = f.read()
            sections = parse_scx(data)
            scenes[scene_name] = sections
        except Exception as e:
            print(f"WARNING: Failed to parse {fname}: {e}", file=sys.stderr)
    return scenes


def parse_interactive_command(line):
    """Parse a comma-separated interactive command line.

    Format: flag_id,condition,COMMAND_LETTER,args...
    Returns dict with keys: flag_id, condition, cmd, args, raw
    or None if the line is not a command.
    """
    line = line.strip()
    if not line or line == '-1':
        return None

    parts = line.split(',')
    if len(parts) < 3:
        return None

    cmd_part = parts[2].strip()
    if not (len(cmd_part) == 1 and cmd_part.isalpha()):
        return None

    try:
        flag_id = int(parts[0].strip())
    except ValueError:
        flag_id = 0
    try:
        condition = int(parts[1].strip())
    except ValueError:
        condition = 0

    return {
        'flag_id': flag_id,
        'condition': condition,
        'cmd': cmd_part,
        'args': [p.strip() for p in parts[3:]],
        'raw': line,
    }


def extract_all_commands(scenes):
    """Extract all interactive commands from all scenes.

    Returns a list of dicts, each with: scene, section_id, section_type,
    flag_id, condition, cmd, args, raw.
    """
    all_cmds = []
    for scene_name, sections in scenes.items():
        for section in sections:
            sec_id = section['id']
            sec_type = section['type']
            for line in section['lines']:
                parsed = parse_interactive_command(line)
                if parsed is not None:
                    parsed['scene'] = scene_name
                    parsed['section_id'] = sec_id
                    parsed['section_type'] = sec_type
                    all_cmds.append(parsed)
    return all_cmds


def build_transition_graph(commands):
    """Build scene transition graph from C commands.

    Returns list of (source_scene, target_scene, entry_section,
    section_id, flag_id, condition).
    """
    transitions = []
    for cmd in commands:
        if cmd['cmd'] != 'C':
            continue
        args = cmd['args']
        target_scene = args[0] if args else '?'
        entry_section = args[1] if len(args) > 1 else '?'
        # Normalize target: strip "sn" prefix if present (snArrest -> Arrest)
        display_target = target_scene
        if target_scene.startswith('sn'):
            display_target = target_scene[2:]
        transitions.append({
            'source': cmd['scene'],
            'target': target_scene,
            'target_display': display_target,
            'entry_section': entry_section,
            'section_id': cmd['section_id'],
            'flag_id': cmd['flag_id'],
            'condition': cmd['condition'],
        })
    return transitions


def build_flag_analysis(commands):
    """Analyze flag usage: which scenes set flags, which check them.

    Returns dict of flag_id -> {set_by: [...], checked_by: [...]}.
    """
    flags = defaultdict(lambda: {'set_by': [], 'checked_by': []})

    for cmd in commands:
        # F commands set flags
        if cmd['cmd'] == 'F' and cmd['args']:
            try:
                fid = int(cmd['args'][0])
            except ValueError:
                continue
            value = cmd['args'][1] if len(cmd['args']) > 1 else '?'
            flags[fid]['set_by'].append({
                'scene': cmd['scene'],
                'section_id': cmd['section_id'],
                'value': value,
            })

        # Commands with nonzero flag_id check flags
        if cmd['flag_id'] != 0:
            flags[cmd['flag_id']]['checked_by'].append({
                'scene': cmd['scene'],
                'section_id': cmd['section_id'],
                'condition': cmd['condition'],
                'cmd': cmd['cmd'],
                'args': cmd['args'],
            })

    return dict(flags)


def extract_palmettoes(commands):
    """Extract all P (Palmettoes) commands.

    Returns list of (scene, section_id, amount, flag_id, condition).
    """
    results = []
    for cmd in commands:
        if cmd['cmd'] != 'P':
            continue
        amount = cmd['args'][0] if cmd['args'] else '?'
        results.append({
            'scene': cmd['scene'],
            'section_id': cmd['section_id'],
            'amount': amount,
            'flag_id': cmd['flag_id'],
            'condition': cmd['condition'],
        })
    return results


def extract_dialog_chains(commands):
    """Extract T commands (dialog/transition entries).

    Returns list of (scene, section_id, target_section, flag_id, condition).
    """
    results = []
    for cmd in commands:
        if cmd['cmd'] != 'T':
            continue
        target = cmd['args'][0] if cmd['args'] else '?'
        results.append({
            'scene': cmd['scene'],
            'section_id': cmd['section_id'],
            'target_section': target,
            'flag_id': cmd['flag_id'],
            'condition': cmd['condition'],
        })
    return results


def extract_quiz_rewards(scenes):
    """Extract quiz-style dialog sections and reward candidates.

    A "quiz-style" dialog is an ALTalk/ALTel-style section that contains the
    canonical wrong-answer record `2,0,0,Silence`. Across the corpus, the
    reward-bearing subset is the quiz-style sections with a non-zero
    completion_flag in the section header.

    Returns a dict with:
      - reward_sections: list of reward-bearing quiz dialogs
      - nonreward_quiz_sections: quiz-style dialogs with completion_flag == 0
    """
    reward_sections = []
    nonreward_quiz_sections = []

    for scene_name, sections in scenes.items():
        for section in sections:
            parts = section['id'].split(',')
            try:
                sec_id = int(parts[0])
            except ValueError:
                continue
            if sec_id < 2000:
                continue

            speaker = parts[2] if len(parts) > 2 else ''
            completion_flag = parts[1] if len(parts) > 1 else '0'
            lines = section['lines']
            is_quiz_style = any(line.strip() == '2,0,0,Silence' for line in lines)
            if not is_quiz_style:
                continue

            entry = {
                'scene': scene_name,
                'section_id': parts[0],
                'section_header': section['id'],
                'completion_flag': completion_flag,
                'speaker': speaker,
                'correct_answers': [line for line in lines if line.startswith('1,')],
            }

            if completion_flag != '0':
                reward_sections.append(entry)
            else:
                nonreward_quiz_sections.append(entry)

    reward_sections.sort(key=lambda e: (e['scene'], int(e['section_id'])))
    nonreward_quiz_sections.sort(key=lambda e: (e['scene'], int(e['section_id'])))
    return {
        'reward_sections': reward_sections,
        'nonreward_quiz_sections': nonreward_quiz_sections,
    }


def count_commands(commands):
    """Count commands by letter. Returns sorted list of (letter, count)."""
    counts = defaultdict(int)
    for cmd in commands:
        counts[cmd['cmd']] += 1
    return sorted(counts.items(), key=lambda x: -x[1])


def commands_for_scene(commands, scenes, scene_name):
    """Get all commands and sections for a specific scene."""
    # Case-insensitive match
    match = None
    for name in scenes:
        if name.upper() == scene_name.upper():
            match = name
            break
    if match is None:
        return None, None

    scene_cmds = [c for c in commands if c['scene'] == match]
    scene_sections = scenes[match]
    return scene_cmds, scene_sections


# --- Display functions ---

def print_summary(scenes, commands, transitions, flags, palmettoes, dialogs):
    """Print full summary of game logic."""
    print('=' * 70)
    print('  ALEX PALM ISLAND — Game Logic Summary')
    print('=' * 70)
    print()

    # Scene overview
    print(f'Scenes: {len(scenes)}')
    for name in sorted(scenes):
        secs = scenes[name]
        types = defaultdict(int)
        for s in secs:
            types[s['type']] += 1
        type_str = ', '.join(f'{v} {k}' for k, v in sorted(types.items()))
        print(f'  {name:20s}  {len(secs):>3} sections  ({type_str})')
    print()

    # Command counts
    print_command_reference(commands)
    print()

    # Transitions summary
    print(f'Scene transitions (C commands): {len(transitions)}')
    sources = sorted(set(t['source'] for t in transitions))
    for src in sources:
        targets = [t for t in transitions if t['source'] == src]
        target_names = sorted(set(t['target_display'] for t in targets))
        print(f'  {src} -> {", ".join(target_names)}')
    print()

    # Flag summary
    print(f'Flags referenced: {len(flags)}')
    print()

    # Palmettoes summary
    total_pos = sum(int(p['amount']) for p in palmettoes
                    if p['amount'].lstrip('-').isdigit() and int(p['amount']) > 0)
    total_neg = sum(int(p['amount']) for p in palmettoes
                    if p['amount'].lstrip('-').isdigit() and int(p['amount']) < 0)
    print(f'Palmettoes changes (P commands): {len(palmettoes)}')
    print(f'  Total possible gain: {total_pos}')
    print(f'  Total possible loss: {total_neg}')
    print()

    # Dialog entries summary
    print(f'Dialog entries (T commands): {len(dialogs)}')
    print()


def print_transitions(transitions):
    """Print scene transition graph."""
    print('=' * 70)
    print('  Scene Transition Graph (C commands)')
    print('=' * 70)
    print()

    # Group by source scene
    by_source = defaultdict(list)
    for t in transitions:
        by_source[t['source']].append(t)

    for src in sorted(by_source):
        print(f'  {src}:')
        for t in by_source[src]:
            cond_str = ''
            if t['flag_id'] != 0:
                cond_str = f'  [flag {t["flag_id"]}={t["condition"]}]'
            print(f'    -> {t["target"]} (entry {t["entry_section"]})  '
                  f'from section {t["section_id"]}{cond_str}')
        print()

    # Find unreachable scenes (no incoming transitions)
    all_targets = set()
    for t in transitions:
        # Normalize target name for matching
        target = t['target']
        if target.startswith('sn'):
            target = target[2:]
        all_targets.add(target.upper())

    all_scenes = set(s.upper() for s in by_source)
    # Also include scenes that are targets but not sources
    for t in transitions:
        target = t['target']
        if target.startswith('sn'):
            target = target[2:]
        all_scenes.add(target.upper())

    source_scenes = set(s.upper() for s in by_source)
    target_scenes = all_targets

    no_outgoing = sorted(all_scenes - source_scenes)
    no_incoming = sorted(source_scenes - target_scenes)

    if no_outgoing:
        print('  Scenes with no outgoing transitions (terminal/leaf):')
        for s in no_outgoing:
            print(f'    {s}')
        print()

    if no_incoming:
        print('  Scenes with no incoming transitions (entry points):')
        for s in no_incoming:
            print(f'    {s}')
        print()


def print_flags(flags):
    """Print flag dependency analysis."""
    print('=' * 70)
    print('  Flag Dependency Analysis')
    print('=' * 70)
    print()

    for fid in sorted(flags):
        info = flags[fid]
        set_count = len(info['set_by'])
        check_count = len(info['checked_by'])
        print(f'  Flag {fid}:  set {set_count} time(s), checked {check_count} time(s)')

        if info['set_by']:
            print('    Set by:')
            for s in info['set_by']:
                print(f'      {s["scene"]} section {s["section_id"]} -> value={s["value"]}')

        if info['checked_by']:
            print('    Checked by:')
            for c in info['checked_by']:
                cond_str = f'=={c["condition"]}'
                action = f'{c["cmd"]}({",".join(c["args"])})'
                print(f'      {c["scene"]} section {c["section_id"]} '
                      f'[flag{cond_str}] -> {action}')
        print()


def print_palmettoes(palmettoes):
    """Print all Palmettoes changes."""
    print('=' * 70)
    print('  Palmettoes Changes (P commands)')
    print('=' * 70)
    print()

    # Sort by amount (penalties first, then rewards)
    sorted_p = sorted(palmettoes, key=lambda p: (
        int(p['amount']) if p['amount'].lstrip('-').isdigit() else 0,
        p['scene']
    ))

    for p in sorted_p:
        cond_str = ''
        if p['flag_id'] != 0:
            cond_str = f'  [flag {p["flag_id"]}={p["condition"]}]'
        sign = '+' if not p['amount'].startswith('-') else ''
        print(f'  {p["scene"]:20s} section {p["section_id"]:>6s}  '
              f'{sign}{p["amount"]:>4s} Palmettoes{cond_str}')

    print()
    # Totals
    amounts = [int(p['amount']) for p in palmettoes
               if p['amount'].lstrip('-').isdigit()]
    positives = [a for a in amounts if a > 0]
    negatives = [a for a in amounts if a < 0]
    print(f'  Total entries: {len(palmettoes)}')
    print(f'  Rewards:   {len(positives)} entries, total +{sum(positives)}')
    print(f'  Penalties: {len(negatives)} entries, total {sum(negatives)}')
    print()


def print_quiz_rewards(quiz_rewards):
    """Print reward-bearing quiz dialogs inferred from SCX structure."""
    reward_sections = quiz_rewards['reward_sections']
    nonreward_quiz_sections = quiz_rewards['nonreward_quiz_sections']

    print('=' * 70)
    print('  Reward-Bearing Quiz Dialogs')
    print('=' * 70)
    print()
    print('  Rule: quiz-style ALTalk/ALTel sections with non-zero completion_flag')
    print('        are reward-bearing; quiz-style sections with completion_flag=0 are not.')
    print()

    by_scene = defaultdict(list)
    for entry in reward_sections:
        by_scene[entry['scene']].append(entry)

    for scene in sorted(by_scene):
        print(f'  {scene}:')
        for entry in by_scene[scene]:
            print(f'    {entry["section_header"]}')
        print()

    print(f'  Reward-bearing quiz sections: {len(reward_sections)}')
    print(f'  Quiz-style nonreward sections: {len(nonreward_quiz_sections)}')
    for entry in nonreward_quiz_sections:
        print(f'    {entry["scene"]} {entry["section_header"]}')
    print()


def print_command_reference(commands):
    """Print command reference with counts per letter."""
    print('=' * 70)
    print('  Command Reference')
    print('=' * 70)
    print()

    counts = count_commands(commands)
    for letter, count in counts:
        desc = COMMAND_DESCRIPTIONS.get(letter, 'Unknown')
        print(f'  {letter}  {count:>5}  {desc}')
    print()
    print(f'  Total interactive commands: {len(commands)}')
    print()

    # Show example for each command
    print('  Examples:')
    seen = set()
    for cmd in commands:
        if cmd['cmd'] not in seen:
            seen.add(cmd['cmd'])
            print(f'    {cmd["cmd"]}: {cmd["raw"]}')
    print()


def print_scene_detail(commands, sections, scene_name):
    """Print all commands and sections for one scene."""
    print('=' * 70)
    print(f'  Scene: {scene_name}')
    print('=' * 70)
    print()

    # Group sections by type
    by_type = defaultdict(list)
    for s in sections:
        by_type[s['type']].append(s)

    for sec_type in ['interactive', 'text_ref', 'dialog', 'animation', 'data', 'other', 'unknown']:
        secs = by_type.get(sec_type, [])
        if not secs:
            continue
        print(f'  --- {sec_type} ({len(secs)} sections) ---')
        for s in secs:
            print(f'  Section {s["id"]}:')
            for line in s['lines']:
                parsed = parse_interactive_command(line)
                if parsed:
                    cond_str = ''
                    if parsed['flag_id'] != 0:
                        cond_str = f' [flag {parsed["flag_id"]}={parsed["condition"]}]'
                    print(f'    {parsed["cmd"]}({",".join(parsed["args"])}){cond_str}')
                elif line.strip() and line.strip() != '-1':
                    # Text or non-command line
                    display = line[:76]
                    if len(line) > 76:
                        display += '...'
                    print(f'    "{display}"')
            print()


def build_json_output(scenes, commands, transitions, flags, palmettoes, dialogs):
    """Build complete analysis as JSON-serializable dict."""
    return {
        'scenes': {
            name: {
                'section_count': len(secs),
                'section_types': dict(
                    _count_types(secs)
                ),
            }
            for name, secs in scenes.items()
        },
        'command_counts': dict(count_commands(commands)),
        'total_commands': len(commands),
        'transitions': transitions,
        'flags': {
            str(k): v for k, v in flags.items()
        },
        'palmettoes': palmettoes,
        'dialog_entries': dialogs,
    }


def _count_types(sections):
    """Count section types."""
    counts = defaultdict(int)
    for s in sections:
        counts[s['type']] += 1
    return counts


def main():
    parser = argparse.ArgumentParser(
        description='Static analysis of Alex Palm Island SCX game scripts.')
    parser.add_argument('--scx-dir', default=DEFAULT_SCX_DIR,
                        help='Directory containing decrypted SCX files')
    parser.add_argument('--transitions', action='store_true',
                        help='Show scene transition graph')
    parser.add_argument('--flags', action='store_true',
                        help='Show flag dependency analysis')
    parser.add_argument('--palmettoes', action='store_true',
                        help='Show all Palmettoes changes')
    parser.add_argument('--quiz-rewards', action='store_true',
                        help='Show reward-bearing quiz dialog sections')
    parser.add_argument('--commands', action='store_true',
                        help='Show command reference with counts')
    parser.add_argument('--scene', type=str, default=None,
                        help='Show all commands for a specific scene')
    parser.add_argument('--json', action='store_true',
                        help='Output full analysis as JSON')

    args = parser.parse_args()
    scx_dir = os.path.normpath(args.scx_dir)

    if not os.path.isdir(scx_dir):
        print(f"ERROR: SCX directory not found: {scx_dir}", file=sys.stderr)
        print("Run build_decrypted.sh first to generate game_decrypted/cd/",
              file=sys.stderr)
        sys.exit(1)

    # Load all scenes
    scenes = load_all_scenes(scx_dir)
    if not scenes:
        print(f"ERROR: No SCX files found in {scx_dir}", file=sys.stderr)
        sys.exit(1)

    # Extract all interactive commands
    commands = extract_all_commands(scenes)

    # Build derived analyses
    transitions = build_transition_graph(commands)
    flags = build_flag_analysis(commands)
    palmettoes = extract_palmettoes(commands)
    dialogs = extract_dialog_chains(commands)
    quiz_rewards = extract_quiz_rewards(scenes)

    # Dispatch to requested mode
    if args.json:
        output = build_json_output(scenes, commands, transitions,
                                   flags, palmettoes, dialogs)
        print(json.dumps(output, indent=2, ensure_ascii=False))
    elif args.transitions:
        print_transitions(transitions)
    elif args.flags:
        print_flags(flags)
    elif args.palmettoes:
        print_palmettoes(palmettoes)
    elif args.quiz_rewards:
        print_quiz_rewards(quiz_rewards)
    elif args.commands:
        print_command_reference(commands)
    elif args.scene:
        scene_cmds, scene_secs = commands_for_scene(commands, scenes, args.scene)
        if scene_secs is None:
            available = ', '.join(sorted(scenes.keys()))
            print(f"ERROR: Scene '{args.scene}' not found.", file=sys.stderr)
            print(f"Available scenes: {available}", file=sys.stderr)
            sys.exit(1)
        print_scene_detail(scene_cmds, scene_secs, args.scene)
    else:
        # Full summary
        print_summary(scenes, commands, transitions, flags, palmettoes, dialogs)


if __name__ == '__main__':
    main()
