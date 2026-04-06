#!/usr/bin/env python3
"""Generate shared remake data for the outdoor street scenes."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "re"))
sys.path.insert(0, str(ROOT / "re" / "formats"))

from extract_hotspots import (  # type: ignore
    compute_cs_base,
    extract_click_rects,
    extract_hotspots,
    extract_object_properties,
    extract_objects,
    find_function_end,
    find_scene_init_functions,
    identify_scene,
    parse_scene_table,
)
from parse_scx import parse_command, parse_file  # type: ignore

SCENES = (
    ("strip0", "Strip0", "STRIP0"),
    ("stapart", "StApart", "STAPART"),
    ("stburger", "StBurger", "STBURGER"),
    ("stbutcher", "StButcher", "STBUTCHE"),
    ("stchoco", "StChoco", "STCHOCO"),
    ("sthosp", "StHosp", "STHOSP"),
    ("sthotel", "StHotel", "STHOTEL"),
    ("stsuper", "StSuper", "STSUPER"),
    ("stzoo", "StZoo", "STZOO"),
)

SCENE_FUNCTION_OVERRIDES = {
    "Strip0": 0x23F6A,
}

OVR_PATH = ROOT / "game_decrypted" / "cd" / "ALEX1.OVR"
OUT_PATH = ROOT / "remake" / "src" / "scenes" / "streets" / "generated" / "street-data.js"
SPRITE_ROOT = ROOT / "re" / "renders" / "sprites" / "streets"
SOUND_ROOT = ROOT / "re" / "renders" / "sounds"
SCX_ROOT = ROOT / "game_decrypted" / "cd"


def js(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def sanitize_asset_name(name: str) -> str:
    return "".join(ch for ch in name.upper() if ch.isalnum() or ch in ("-", "_"))


def find_scene_function(data: bytes, scene_name: str) -> tuple[int, int, int]:
    if scene_name in SCENE_FUNCTION_OVERRIDES:
        func_start = SCENE_FUNCTION_OVERRIDES[scene_name]
        functions = find_scene_init_functions(data)
        next_start = min((start for start, _ in functions if start > func_start), default=len(data))
        func_end = find_function_end(data, func_start, next_start)
        cs_base = compute_cs_base(data, func_start, func_end)
        return func_start, func_end, cs_base

    scene_table = parse_scene_table(data)
    functions = find_scene_init_functions(data)
    functions.sort(key=lambda item: item[0])
    for index, (func_start, _) in enumerate(functions):
        next_start = functions[index + 1][0] if index + 1 < len(functions) else len(data)
        func_end = find_function_end(data, func_start, next_start)
        cs_base = compute_cs_base(data, func_start, func_end)
        objects = extract_objects(data, func_start, func_end, cs_base)
        hotspots = extract_hotspots(data, func_start, func_end, cs_base)
        click_rects = extract_click_rects(data, func_start, func_end, cs_base)
        identified = identify_scene(objects, hotspots, click_rects, scene_table)
        if identified == scene_name:
            return func_start, func_end, cs_base
    raise RuntimeError(f"Unable to locate scene function for {scene_name}")


def parse_text_module(scx_path: Path) -> dict[str, object]:
    sections: dict[int, dict[str, object]] = {}
    interactive: dict[int, list[str]] = {}
    for section in parse_file(str(scx_path)):
        head = section["id"].split(",")[0]
        if not head.isdigit():
            continue
        section_id = int(head)
        if section["type"] == "interactive":
            interactive[section_id] = list(section["lines"])
            continue
        sections[section_id] = {
            "header": section["id"],
            "lines": list(section["lines"]),
        }

    dialogs = {str(section_id): sections[section_id] for section_id in sections if 2000 <= section_id < 3000}
    text_refs = {str(section_id): sections[section_id] for section_id in sections if 500 <= section_id < 1000}
    messages = {str(section_id): sections[section_id] for section_id in sections if 1000 <= section_id < 1300}
    return {
        "dialogs": dialogs,
        "textRefs": text_refs,
        "messages": messages,
        "interactive": interactive,
    }


def parse_interactive_record(line: str) -> dict[str, object] | None:
    parts = [part.strip() for part in line.split(",")]
    if len(parts) < 3 or len(parts[2]) != 1 or not parts[2].isalpha():
        return None
    try:
        flag = int(parts[0])
        cond = int(parts[1])
    except ValueError:
        return None
    return {
        "flag": flag,
        "cond": cond,
        "cmd": parts[2],
        "args": parts[3:],
    }


def collect_interactive_sections(interactive_sections: dict[int, list[str]]) -> dict[str, list[dict[str, object]]]:
    parsed_sections: dict[str, list[dict[str, object]]] = {}
    for section_id, lines in interactive_sections.items():
        commands = []
        for line in lines:
            record = parse_interactive_record(line)
            if record is not None:
                commands.append(record)
        parsed_sections[str(section_id)] = commands
    return parsed_sections


def extract_section_targets(interactive_sections: dict[int, list[str]]) -> dict[int, dict[str, object]]:
    section_targets: dict[int, dict[str, object]] = {}
    for section_id, lines in interactive_sections.items():
        exit_names: list[str] = []
        direct_scene = None
        for line in lines:
            parsed = parse_command(line)
            if not parsed:
                continue
            cmd, args = parsed
            if cmd == "B" and len(args) >= 4:
                obj_name = args[2]
                if obj_name.startswith(("To", "FarTo", "JumpTo", "Into")):
                    exit_names.append(obj_name)
            elif cmd == "C" and len(args) >= 3:
                direct_scene = args[2]
        if exit_names or direct_scene:
            section_targets[section_id] = {
                "exitNames": exit_names,
                "directScene": direct_scene,
            }
    return section_targets


def choose_background_asset(sprite_names: list[str], scene_code: str) -> str:
    preferred_prefix = f"SN{scene_code}"
    for name in sprite_names:
        upper = name.upper()
        if upper.startswith(preferred_prefix) and upper[-1].isdigit():
            return upper
    for name in sprite_names:
        upper = name.upper()
        if upper.startswith("SN") and upper[-1].isdigit():
            return upper
    raise RuntimeError(f"No background sprite found for {scene_code}")


def normalize_exit_target_name(exit_name: str | None, direct_scene: str | None) -> str | None:
    if direct_scene:
        return direct_scene
    if not exit_name:
        return None
    if exit_name.startswith("FarTo"):
        return f"sn{exit_name[5:]}"
    if exit_name.startswith("JumpTo"):
        return f"sn{exit_name[6:]}"
    if exit_name.startswith("To"):
        return f"sn{exit_name[2:]}"
    if exit_name.startswith("Into"):
        return f"sn{exit_name[4:]}"
    return None


SCENE_NAME_MAP = {
    "snStripAir": "stripair",
    "snStrip0": "strip0",
    "snStApart": "stapart",
    "snStBurger": "stburger",
    "snStButcher": "stbutcher",
    "snStButche": "stbutcher",
    "snStChoco": "stchoco",
    "snStHosp": "sthosp",
    "snStHotel": "sthotel",
    "snStSuper": "stsuper",
    "snStZoo": "stzoo",
    "snAptment": "aptment",
    "snButcher": "butcher",
    "snBurger": "burger",
    "snLobby": "lobby",
    "snPhoto": "photo",
    "snZooFront": "zoofront",
    "snFactory": "factory",
    "snWard": "ward",
    "snArrest": "arrest",
    "snDeath": "death",
}


def target_scene_id(raw_target: str | None) -> str | None:
    return SCENE_NAME_MAP.get(raw_target or "")


def rect_center(rect: dict[str, object]) -> tuple[float, float]:
    return (
        (rect["x1"] + rect["x2"]) / 2,  # type: ignore[operator]
        (rect["y1"] + rect["y2"]) / 2,  # type: ignore[operator]
    )


def find_walk_target(click_rects: list[dict[str, object]], index: int) -> dict[str, int] | None:
    current = click_rects[index]
    cx, cy = rect_center(current)
    best = None
    best_distance = None
    for candidate in click_rects:
        if candidate["type"] != "D":
            continue
        tx = candidate["walk_x"]
        ty = candidate["walk_y"]
        if tx is None or ty is None:
            continue
        ccx, ccy = rect_center(candidate)
        distance = abs(cx - ccx) + abs(cy - ccy)
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best = {"x": int(tx), "y": int(ty)}
    return best


def collect_exit_defs(click_rects: list[dict[str, object]], section_targets: dict[int, dict[str, object]]) -> list[dict[str, object]]:
    exit_defs: list[dict[str, object]] = []
    for index, rect in enumerate(click_rects):
        if rect["type"] != "C":
            continue
        section_id = rect["exit_section"]
        section_target = section_targets.get(section_id, {})
        exit_names = section_target.get("exitNames", [])
        name = rect.get("name") or (exit_names[0] if exit_names else None)
        raw_target = normalize_exit_target_name(name, section_target.get("directScene"))
        exit_defs.append({
            "name": name,
            "sectionId": section_id,
            "targetScene": target_scene_id(raw_target),
            "rawTarget": raw_target,
            "rect": [int(rect["x1"]), int(rect["y1"]), int(rect["x2"]), int(rect["y2"])],
            "walkTarget": find_walk_target(click_rects, index),
        })
    return exit_defs


def collect_scene_data(data: bytes, scene_id: str, scene_name: str, scene_code: str) -> dict[str, object]:
    func_start, func_end, cs_base = find_scene_function(data, scene_name)
    objects = [{k: v for k, v in obj.items() if k != "offset"} for obj in extract_objects(data, func_start, func_end, cs_base)]
    object_properties = [{k: v for k, v in prop.items() if k != "offset"} for prop in extract_object_properties(data, func_start, func_end)]
    named_hotspots = [{k: v for k, v in hs.items() if k != "offset"} for hs in extract_hotspots(data, func_start, func_end, cs_base)]
    click_rects = [{k: v for k, v in rect.items() if k != "offset"} for rect in extract_click_rects(data, func_start, func_end, cs_base)]

    text_data = parse_text_module(SCX_ROOT / f"{scene_code}.SCX")
    sprite_dir = SPRITE_ROOT / scene_code
    sound_dir = SOUND_ROOT / scene_code
    sprite_names = sorted(path.stem.upper() for path in sprite_dir.glob("*.png"))
    sound_names = sorted(path.stem.upper() for path in sound_dir.glob("*.wav"))
    section_targets = extract_section_targets(text_data["interactive"])

    return {
        "id": scene_id,
        "sceneName": scene_name,
        "sceneCode": scene_code,
        "backgroundAsset": choose_background_asset(sprite_names, scene_code),
        "spriteNames": sprite_names,
        "soundNames": sound_names,
        "world": {
            "objects": objects,
            "objectProperties": object_properties,
            "namedHotspots": named_hotspots,
            "clickRects": click_rects,
            "functionOffset": func_start,
            "functionEnd": func_end,
            "csBase": cs_base,
        },
        "text": {
            "textRefs": text_data["textRefs"],
            "dialogs": text_data["dialogs"],
            "messages": text_data["messages"],
            "interactive": collect_interactive_sections(text_data["interactive"]),
        },
        "exitDefs": collect_exit_defs(click_rects, section_targets),
        "sectionTargets": section_targets,
    }


def main() -> None:
    data = OVR_PATH.read_bytes()
    scene_data = {
        scene_id: collect_scene_data(data, scene_id, scene_name, scene_code)
        for scene_id, scene_name, scene_code in SCENES
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        "// Generated by tools/generate_street_scene_data.py from ALEX1.OVR / *.SCX / re/renders\n"
        f"export const STREET_SCENE_DATA = Object.freeze({js(scene_data)});\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
