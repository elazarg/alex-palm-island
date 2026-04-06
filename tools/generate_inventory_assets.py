#!/usr/bin/env python3
"""Export inventory icons and inspect pictures from ICONS.DAT using the suitcase palette."""

from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "re"))
sys.path.insert(0, str(ROOT / "re" / "formats"))

from export_all_assets import make_palette_rgb, sprite_to_image  # type: ignore
from parse_dat import extract_resources, parse_sprite_header  # type: ignore

ICONS_DAT = ROOT / "game_decrypted" / "cd" / "ICONS.DAT"
ICONS_NDX = ROOT / "game_decrypted" / "cd" / "ICONS.NDX"
WINDOWS_DAT = ROOT / "game_decrypted" / "cd" / "WINDOWS.DAT"
WINDOWS_NDX = ROOT / "game_decrypted" / "cd" / "WINDOWS.NDX"
OUT_DIR = ROOT / "assets" / "icons"


def load_palette():
    for resource in extract_resources(str(WINDOWS_DAT), str(WINDOWS_NDX)):
        if resource["name"].upper() in {"SUITCASEPAL", "MAPPAL"} and len(resource["data"]) == 768:
            return make_palette_rgb(resource["data"])
    raise RuntimeError("Unable to find inventory palette (SUITCASEPAL/MAPPAL)")


def export_sprite(resource, palette):
    header = parse_sprite_header(resource["data"])
    if not header:
      return
    pixels = resource["data"][4:4 + header["pixel_count"]]
    if len(pixels) != header["pixel_count"]:
      return
    image = sprite_to_image(header["width"], header["height"], pixels, palette, transparent_zero=True)
    image.save(OUT_DIR / f"{resource['name'].upper()}.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    palette = load_palette()
    for resource in extract_resources(str(ICONS_DAT), str(ICONS_NDX)):
        name = resource["name"].upper()
        if not (name.endswith("ICON") or name.endswith("PICT")):
            continue
        export_sprite(resource, palette)


if __name__ == "__main__":
    main()
