#!/usr/bin/env python3
"""
Generate loadable pseudo-saves by mutating a real sample save.

Can either patch fields in-place (conservative) or teleport to a different
scene by stripping scene-specific records and rewriting the scene header.

Examples:
    # Patch fields in the same scene
    python3 re/generate_pseudo_save.py --base stripair --money 250 out.GAM
    python3 re/generate_pseudo_save.py --base airport --set-flag 1010 out.GAM

    # Teleport to a different scene (strips scene objects, keeps globals)
    python3 re/generate_pseudo_save.py --base stapart --scene snControl --money 500 out.GAM
    python3 re/generate_pseudo_save.py --base stapart --scene snFactory out.GAM
    python3 re/generate_pseudo_save.py --base stapart --scene snRoom303 --meter 50 out.GAM

    # Preset scenarios for suspicion testing
    python3 re/generate_pseudo_save.py --preset spy-control out.GAM
    python3 re/generate_pseudo_save.py --preset spy-factory out.GAM
    python3 re/generate_pseudo_save.py --preset spy-room303 out.GAM
    python3 re/generate_pseudo_save.py --preset late-game out.GAM

    # List all presets
    python3 re/generate_pseudo_save.py --list-presets
"""

import argparse
import struct
from pathlib import Path

from parse_save import parse_save, OBJECTS_START, SCENE_HEADER_OFFSET


ROOT = Path(__file__).resolve().parent
SAMPLES = {
    "airport_1": ROOT / "save_samples" / "1.GAM",
    "airport_2": ROOT / "save_samples" / "2.GAM",
    "stripair_1": ROOT / "save_samples" / "3.GAM",
    "stripair_2": ROOT / "save_samples" / "4.GAM",
    "stapart": ROOT / "save_samples" / "5.GAM",
    "airport": ROOT / "save_samples" / "2.GAM",
    "stripair": ROOT / "save_samples" / "4.GAM",
}

# Scene names exactly as used in C commands (case-sensitive Pascal strings)
VALID_SCENES = [
    "snAirport", "snAptment", "snArrest", "snBear", "snBurger", "snButcher",
    "snCaveman", "snClothes", "snControl", "snCorridor", "snDeath",
    "snEnding", "snFactory", "snFloor1", "snFloor2", "snFloor3", "snFloor4",
    "snLiftRoom", "snLionCage", "snLobby", "snLobbyDsk", "snMonkey",
    "snPhoto", "snPrison", "snRoom301", "snRoom302", "snRoom303", "snSafe",
    "snSpyMaster", "snStApart", "snStBurger", "snStButcher", "snStChoco",
    "snStHosp", "snStHotel", "snStrip0", "snStripAir", "snStSuper",
    "snStZoo", "snSuper", "snWaltRoom", "snWard", "snZooBack", "snZooFront",
]

# Flags from SCX analysis (GAME_CONTENT.md):
# Early game: 1001 (passport), 1004-1005 (describe bag), 1008-1009 (correct bag),
#   1010 (entered lobby), 1011 (got room key), 1017 (said "on holiday"), 1824 (StripAir)
# Corridor: 1061-1065, 1077 (quiz), 1076 (room302 toggle)
# Room303: 1106 (light toggle), 1107 (photo appt), 1108-1109 (quiz), 1311 (safe code)
# Ward: 1501 (peanut given), 1504-1509 (quiz), 1918 (letter), 1919 (peanuts consumed)
# LiftRoom: 1651 (hammer used), 1654 (elevator activated)
# Control: 1653 (brain told), 1656 (brain removed), 1657 (brain icon), 1665-1669 (quiz)
# Factory: 1658-1664 (quiz), 1671-1673 (recipes)

# Inventory items (24 total, slots 501-524)
INVENTORY_ITEMS = [
    "PassportIcon", "LetterIcon", "CouponIcon", "ZooCouponIcon",
    "ChocolateIcon", "CreditIcon", "Key303Icon", "PinIcon",
    "DrawerKeyIcon", "GlueIcon", "BurgerIcon", "DrinkIcon",
    "EggIcon", "EnvelopeIcon", "BeefIcon", "HotdogIcon",
    "NotebookIcon", "PhotoIcon", "MilkIcon", "PeanutIcon",
    "IDCardIcon", "ZooTicketIcon", "HammerIcon", "BrainIcon",
]


def set_flag(buf, flag_id, value):
    byte_idx = flag_id // 8
    bit = flag_id % 8
    mask = 1 << bit
    if value:
        buf[byte_idx] |= mask
    else:
        buf[byte_idx] &= (~mask & 0xFF)


def write_u16(buf, offset, value):
    struct.pack_into("<H", buf, offset, value & 0xFFFF)


def write_u32(buf, offset, value):
    struct.pack_into("<I", buf, offset, value & 0xFFFFFFFF)


def rename_pascal_record(original_bytes, new_name):
    """Replace the Pascal string name in a record, preserving all other bytes."""
    buf = bytearray(original_bytes)
    old_len = buf[0]
    new_bytes = new_name.encode("ascii")
    new_len = len(new_bytes)
    # Clear old name area, write new
    buf[1:1 + old_len] = b'\x00' * old_len
    buf[0] = new_len
    buf[1:1 + new_len] = new_bytes
    return buf


def find_global_start(save):
    """Find the offset where global objects start (NoMap record)."""
    for rec in save["records"]:
        if rec["name"] == "NoMap":
            return rec["offset"]
    raise ValueError("NoMap record not found — can't identify global section")


def teleport_scene(data, save, scene_name):
    """Rebuild the save for a different scene: replace header, strip scene
    objects, update trailing scene record.  Preserves the base save's header
    and trailing-record layout bytes so the panel/viewport stay positioned."""
    global_start = find_global_start(save)

    # Find trailing scene state record (last record, starts with "sn")
    trailing_rec = None
    for rec in reversed(save["records"]):
        if rec["name"].startswith("sn"):
            trailing_rec = rec
            break
    if trailing_rec is None:
        raise ValueError("No trailing scene state record found")

    # Build new file:
    # 1. Flag array (unchanged)
    new_data = bytearray(data[:SCENE_HEADER_OFFSET])

    # 2. Scene header: copy original 35 bytes, rename to new scene
    orig_header = data[SCENE_HEADER_OFFSET:SCENE_HEADER_OFFSET + 35]
    new_data += rename_pascal_record(orig_header, scene_name)
    assert len(new_data) == OBJECTS_START

    # 3. Skip scene-specific objects — go straight to globals
    #    Copy from NoMap through the record BEFORE the trailing scene record
    trailing_start = trailing_rec["offset"]
    new_data += data[global_start:trailing_start]

    # 4. Trailing scene record: copy original 64 bytes, rename to new scene
    orig_trailing = data[trailing_start:trailing_start + 64]
    new_data += rename_pascal_record(orig_trailing, scene_name)

    return new_data


def patch_score_text(buf, rec, money):
    raw = rec["raw"]
    old_name_len = raw[0]
    name_start = rec["offset"] + 1
    name_end = name_start + old_name_len
    old_name = bytes(buf[name_start:name_end])

    new_name = f"{money:4d}".encode("ascii")
    if len(new_name) != old_name_len:
        raise ValueError(
            f"score text width mismatch: old={old_name!r} new={new_name!r}; "
            "refusing to shift record layout"
        )

    buf[name_start:name_end] = new_name
    write_u32(buf, rec["offset"] + 259, money)
    write_u32(buf, rec["offset"] + 263, money)


def patch_meter(buf, rec, value=None, max_value=None):
    # NOTE: Meter +35 and +41 appear to be Y-position fields, not value/max.
    # All 5 sample saves have +35=180, +41=200 regardless of game state.
    # Patching these moves the panel vertically. Leave them alone for now.
    if value is not None:
        print(f"WARNING: --meter ignored (field +35 is likely Y-position, not value)")
    if max_value is not None:
        print(f"WARNING: --meter-max ignored (field +41 is likely Y-max, not max value)")


def patch_player(buf, rec, x=None, y=None, direction=None):
    if x is not None:
        write_u16(buf, rec["offset"] + 60, x)
    if y is not None:
        write_u16(buf, rec["offset"] + 62, y)
    if direction is not None:
        buf[rec["offset"] + 64] = direction & 0xFF


def patch_visibility(buf, rec, visibility):
    buf[rec["offset"] + 39] = visibility & 0xFF


# 3x3 inventory grid positions (from Passport=(142,45), Letter=(176,44))
_INV_GRID = [(142, 45), (176, 45), (210, 45),
             (142, 79), (176, 79), (210, 79),
             (142, 113), (176, 113), (210, 113)]

# Track how many items placed so far (reset per run in main)
_inv_slot_counter = 0


def acquire_item(buf, rec):
    """Set an inventory item to acquired with proper grid position."""
    global _inv_slot_counter
    buf[rec["offset"] + 39] = 1  # visibility = acquired
    if _inv_slot_counter < len(_INV_GRID):
        x, y = _INV_GRID[_inv_slot_counter]
    else:
        # Overflow: stack in last slot
        x, y = _INV_GRID[-1]
    write_u16(buf, rec["offset"] + 33, x)
    write_u16(buf, rec["offset"] + 35, y)
    _inv_slot_counter += 1


def find_record(save, name):
    for rec in save["records"]:
        if rec["name"] == name:
            return rec
    raise KeyError(f"record not found: {name}")


# === Presets: named scenarios for quick testing ===

# Common early-game flags (airport completion + street access)
# Note: flag 1017 = "said on holiday" at airport. Base save stapart (5.GAM) does
# NOT have it set, meaning the player said "on business". Do not add 1017 here —
# the guard at StChoco cross-checks consistency with the airport answer.
_EARLY_FLAGS = [1001, 1004, 1005, 1008, 1009, 1010, 1011, 1824]

# Hotel access flags
_HOTEL_FLAGS = [1042, 1043, 1904, 1905, 1906]

PRESETS = {
    "hotel-full": {
        "description": "StApart, all hotel+spy items, walk right to hotel",
        "base": "stapart",
        "money": 500,
        "flags": _EARLY_FLAGS + _HOTEL_FLAGS
            + [1311, 1076, 1907, 1918, 1920]  # safe code, room302 light, drawer key, letter, ID card
            + [1061, 1062, 1063, 1064, 1065, 1077]  # corridor quizzes done
            + [1651, 1654],  # hammer used, elevator active
        "items": ["PassportIcon", "LetterIcon", "Key303Icon", "IDCardIcon",
                  "NotebookIcon", "PhotoIcon", "HammerIcon", "PinIcon",
                  "CreditIcon"],  # 9 items max (grid is 3x3)
    },
    "factory-ready": {
        "description": "StApart, factory gear, walk left to StChoco",
        "base": "stapart",
        "money": 400,
        "flags": _EARLY_FLAGS + [1651, 1807, 1920],
        "items": ["PassportIcon", "LetterIcon", "HammerIcon",
                  "IDCardIcon", "ChocolateIcon"],
    },
    "hotel-no-hammer": {
        "description": "StApart, hotel access but no hammer yet",
        "base": "stapart",
        "money": 400,
        "flags": _EARLY_FLAGS + _HOTEL_FLAGS
            + [1311, 1076, 1918]
            + [1061, 1062, 1063, 1064, 1065, 1077],
        "items": ["PassportIcon", "LetterIcon", "Key303Icon", "IDCardIcon",
                  "PinIcon", "CreditIcon", "PeanutIcon"],
    },
    "early-hotel": {
        "description": "StApart, just arrived at hotel, minimal items",
        "base": "stapart",
        "money": 300,
        "flags": _EARLY_FLAGS + [1042, 1043],
        "items": ["PassportIcon", "LetterIcon", "CreditIcon"],
    },
    "low-money": {
        "description": "StApart, low palmettoes (200), test penalties",
        "base": "stapart",
        "money": 200,
        "flags": _EARLY_FLAGS,
        "items": ["PassportIcon", "LetterIcon"],
    },
}


def apply_preset(args, preset):
    """Apply a preset's settings to the args namespace."""
    if "base" in preset:
        args.base = preset["base"]
    if "scene" in preset:
        args.scene = preset["scene"]
    if "money" in preset:
        args.money = preset["money"]
    if "meter" in preset:
        args.meter = preset["meter"]
    if "flags" in preset:
        args.set_flag = list(set(args.set_flag + preset["flags"]))
    if "items" in preset:
        # Preserve order (preset items first, then any extras from CLI)
        seen = set(args.acquire_item)
        for item in preset["items"]:
            if item not in seen:
                args.acquire_item.append(item)
                seen.add(item)


def main():
    parser = argparse.ArgumentParser(
        description="Generate pseudo-saves from real sample saves",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("output", nargs="?", help="Output .GAM path")
    parser.add_argument("--base", choices=sorted(SAMPLES), default="stripair",
                        help="Base sample save to mutate")
    parser.add_argument("--scene", help="Teleport to a different scene (e.g. snControl)")
    parser.add_argument("--money", type=int, help="Set Palmettoes amount")
    parser.add_argument("--meter", type=int, help="Set Meter current value")
    parser.add_argument("--meter-max", type=int, help="Set Meter max value")
    parser.add_argument("--x", type=int, help="Set ALEX X")
    parser.add_argument("--y", type=int, help="Set ALEX Y")
    parser.add_argument("--dir", type=int, help="Set ALEX facing/direction byte")
    parser.add_argument("--set-flag", type=int, action="append", default=[],
                        help="Set a flag bit")
    parser.add_argument("--clear-flag", type=int, action="append", default=[],
                        help="Clear a flag bit")
    parser.add_argument("--show-object", action="append", default=[],
                        help="Set visibility=1 for a named object record")
    parser.add_argument("--hide-object", action="append", default=[],
                        help="Set visibility=0 for a named object record")
    parser.add_argument("--acquire-item", action="append", default=[],
                        help="Set an inventory icon to acquired (visibility=1)")
    parser.add_argument("--remove-item", action="append", default=[],
                        help="Set an inventory icon to not acquired (visibility=4)")
    parser.add_argument("--preset", choices=sorted(PRESETS),
                        help="Use a named preset scenario")
    parser.add_argument("--list-presets", action="store_true",
                        help="List all available presets and exit")
    parser.add_argument("--list-scenes", action="store_true",
                        help="List all valid scene names and exit")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and show what would be written, but don't write")
    args = parser.parse_args()

    if args.list_presets:
        print("Available presets:")
        for name, preset in sorted(PRESETS.items()):
            scene = preset.get("scene", "(same as base)")
            money = preset.get("money", "?")
            meter = preset.get("meter", "?")
            items = preset.get("items", [])
            flags = preset.get("flags", [])
            print(f"  {name:20s}  {preset['description']}")
            print(f"                        scene={scene}  money={money}  meter={meter}")
            print(f"                        {len(flags)} flags, {len(items)} items")
        return

    if args.list_scenes:
        print("Valid scene names:")
        for s in VALID_SCENES:
            print(f"  {s}")
        return

    if args.preset:
        apply_preset(args, PRESETS[args.preset])

    if not args.output and not args.dry_run:
        parser.error("output path required (or use --dry-run / --list-presets)")

    if args.scene and args.scene not in VALID_SCENES:
        parser.error(f"unknown scene {args.scene!r}; use --list-scenes to see valid names")

    # Load base save
    base_path = SAMPLES[args.base]
    data = bytearray(base_path.read_bytes())
    save = parse_save(bytes(data))

    # Scene teleport: rebuild file with different scene, no scene-specific objects
    teleported = False
    if args.scene:
        data = bytearray(teleport_scene(data, save, args.scene))
        save = parse_save(bytes(data))
        teleported = True

    # Patch money
    if args.money is not None:
        score_text = next(rec for rec in save["records"] if rec["type"] == "score_text")
        patch_score_text(data, score_text, args.money)

    # Patch meter
    meter_rec = next((rec for rec in save["records"] if rec["type"] == "meter"), None)
    if meter_rec and (args.meter is not None or args.meter_max is not None):
        patch_meter(data, meter_rec, args.meter, args.meter_max)

    # Patch player position (only if ALEX record exists — won't after teleport)
    player = next((rec for rec in save["records"] if rec["type"] == "player"), None)
    if player and (args.x is not None or args.y is not None or args.dir is not None):
        patch_player(data, player, args.x, args.y, args.dir)
    elif (args.x is not None or args.y is not None or args.dir is not None) and not player:
        print("WARNING: --x/--y/--dir ignored (no ALEX record after scene teleport)")

    # Patch flags
    for flag in args.set_flag:
        set_flag(data, flag, True)
    for flag in args.clear_flag:
        set_flag(data, flag, False)

    # Patch visibility
    for name in args.show_object:
        try:
            patch_visibility(data, find_record(save, name), 1)
        except KeyError:
            print(f"WARNING: --show-object {name!r} not found (may be scene-specific)")
    for name in args.hide_object:
        try:
            patch_visibility(data, find_record(save, name), 0)
        except KeyError:
            print(f"WARNING: --hide-object {name!r} not found (may be scene-specific)")

    # Patch inventory (with grid positions)
    global _inv_slot_counter
    _inv_slot_counter = 0
    for name in args.acquire_item:
        try:
            acquire_item(data, find_record(save, name))
        except KeyError:
            print(f"WARNING: --acquire-item {name!r} not found")
    for name in args.remove_item:
        try:
            patch_visibility(data, find_record(save, name), 4)
        except KeyError:
            print(f"WARNING: --remove-item {name!r} not found")

    # Report
    final_save = parse_save(bytes(data))
    from parse_save import find_palmettoes, find_meter
    scene_name = final_save["scene"]["name"]
    palmettoes = find_palmettoes(final_save)
    meter_val = find_meter(final_save)
    n_flags = len(final_save["flags"])
    n_records = len(final_save["records"])
    acquired = [r["name"].replace("Icon", "") for r in final_save["records"]
                if r["type"] == "inventory" and r["fields"].get("acquired")]

    print(f"Scene:      {scene_name}{'  (TELEPORTED)' if teleported else ''}")
    print(f"Palmettoes: {palmettoes}")
    print(f"Meter:      {meter_val}/200")
    print(f"Flags:      {n_flags} set")
    print(f"Records:    {n_records}")
    print(f"Inventory:  {', '.join(acquired) if acquired else '(none)'}")
    print(f"Size:       {len(data)} bytes")

    if args.dry_run:
        print("\n(dry run — not writing)")
        return

    out_path = Path(args.output)
    out_path.write_bytes(data)
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
