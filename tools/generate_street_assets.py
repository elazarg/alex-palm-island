#!/usr/bin/env python3
"""Generate street scene runtime assets with the correct scene palettes."""

from __future__ import annotations

from pathlib import Path
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "re" / "formats"))
sys.path.insert(0, str(ROOT / "re"))

from parse_dat import extract_resources, parse_sprite_header  # type: ignore
from export_all_assets import make_palette_rgb, sprite_to_image  # type: ignore

SCENES = (
    ("strip0", "STRIP0", "SDSTRIP0", "SNSTRIP0PAL"),
    ("stapart", "STAPART", "SDSTAPAR", "SNSTAPARTPAL"),
    ("stburger", "STBURGER", "SDSTBURG", "SNSTBURGERPAL"),
    ("stbutcher", "STBUTCHE", "SDSTBUTC", "SNSTBUTCHERPAL"),
    ("stchoco", "STCHOCO", "SDSTCHOC", "SNSTCHOCOPAL"),
    ("sthosp", "STHOSP", "SDSTHOSP", "SNSTHOSPPAL"),
    ("sthotel", "STHOTEL", "SDSTHOTE", "SNSTHOTELPAL"),
    ("stsuper", "STSUPER", "SDSTSUPE", "SNSTSUPERPAL"),
    ("stzoo", "STZOO", "SDSTZOO", "SNSTZOOPAL"),
)


def resolve_palette(resources, palette_name):
    explicit = next((res for res in resources if res["name"] == palette_name and len(res["data"]) == 768), None)
    if explicit is not None:
        return make_palette_rgb(explicit["data"])
    fallback = next((res for res in resources if "PAL" in res["name"].upper() and len(res["data"]) == 768), None)
    if fallback is not None:
        return make_palette_rgb(fallback["data"])
    raise SystemExit(f"Palette {palette_name} not found")


def export_scene(scene_id, sprite_base, sound_base, palette_name):
    out_dir = ROOT / "assets" / scene_id
    out_dir.mkdir(parents=True, exist_ok=True)

    sprite_resources = extract_resources(
        str(ROOT / "game_decrypted" / "cd" / f"{sprite_base}.DAT"),
        str(ROOT / "game_decrypted" / "cd" / f"{sprite_base}.NDX"),
    )
    palette = resolve_palette(sprite_resources, palette_name)

    for resource in sprite_resources:
        header = parse_sprite_header(resource["data"])
        if not header:
            continue
        width = header["width"]
        height = header["height"]
        pixel_count = header.get("pixel_count", width * height)
        pixels = resource["data"][4:4 + pixel_count]
        is_background = resource["name"].startswith("SN")
        image = sprite_to_image(width, height, pixels, palette, transparent_zero=not is_background)
        image.save(out_dir / f"{resource['name']}.png")

    sound_dat = ROOT / "game_decrypted" / "cd" / f"{sound_base}.DAT"
    sound_ndx = ROOT / "game_decrypted" / "cd" / f"{sound_base}.NDX"
    if sound_dat.exists() and sound_ndx.exists():
        sound_resources = extract_resources(str(sound_dat), str(sound_ndx))
        for resource in sound_resources:
            if resource["type"] != 512:
                continue
            with wave.open(str(out_dir / f"{resource['name']}.wav"), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(1)
                wf.setframerate(22050)
                wf.writeframes(resource["data"])


def main():
    for scene_id, sprite_base, sound_base, palette_name in SCENES:
        export_scene(scene_id, sprite_base, sound_base, palette_name)


if __name__ == "__main__":
    main()
