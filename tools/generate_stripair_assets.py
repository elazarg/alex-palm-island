#!/usr/bin/env python3
"""Generate StripAir runtime assets with the correct scene palette."""

from __future__ import annotations

from pathlib import Path
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "re" / "formats"))
sys.path.insert(0, str(ROOT / "re"))

from parse_dat import extract_resources, parse_sprite_header  # type: ignore
from export_all_assets import make_palette_rgb, sprite_to_image  # type: ignore

SPRITE_SRC = ROOT / "game_decrypted" / "cd" / "STRIPAIR.DAT"
SPRITE_NDX = ROOT / "game_decrypted" / "cd" / "STRIPAIR.NDX"
SOUND_SRC = ROOT / "game_decrypted" / "cd" / "SDSTRIPA.DAT"
SOUND_NDX = ROOT / "game_decrypted" / "cd" / "SDSTRIPA.NDX"
OUT = ROOT / "assets" / "stripair"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sprite_resources = extract_resources(str(SPRITE_SRC), str(SPRITE_NDX))
    palette_resource = next((res for res in sprite_resources if res["name"] == "SNSTRIPAIRPAL"), None)
    if palette_resource is None:
        raise SystemExit("SNSTRIPAIRPAL not found in STRIPAIR.DAT")
    palette = make_palette_rgb(palette_resource["data"])

    for resource in sprite_resources:
        if resource["type"] != 256 or resource["name"] == "SNSTRIPAIRPAL":
            continue
        header = parse_sprite_header(resource["data"])
        if not header:
            continue
        width = header["width"]
        height = header["height"]
        pixels = resource["data"][4:4 + header["pixel_count"]]
        is_background = resource["name"].startswith("SN") or resource["name"] == "INFOSIGN"
        image = sprite_to_image(width, height, pixels, palette, transparent_zero=not is_background)
        image.save(OUT / f"{resource['name']}.png")

    sound_resources = extract_resources(str(SOUND_SRC), str(SOUND_NDX))
    for resource in sound_resources:
        if resource["type"] != 512:
            continue
        with wave.open(str(OUT / f"{resource['name']}.wav"), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(1)
            wf.setframerate(22050)
            wf.writeframes(resource["data"])


if __name__ == "__main__":
    main()
