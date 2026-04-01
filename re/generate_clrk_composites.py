#!/usr/bin/env python3
"""Regenerate airport clerk composite frames from corrected base + offsets."""

import os

from PIL import Image


ROOT = os.path.join(os.path.dirname(__file__), "..")
ASSET_DIR = os.path.join(ROOT, "remake", "assets", "airport")

# Extracted from ALEX1.OVR + face-local validation.
OVERLAY_OFFSETS = {
    0: None,
    1: None,       # LOST1 is blank in source data; composite is just the base frame.
    2: (35, 12),
    3: (37, 13),
    4: (39, 13),
    5: (39, 13),
    6: (41, 12),
    7: (42, 13),
    8: (42, 13),
}


def load_rgba(name):
    return Image.open(os.path.join(ASSET_DIR, f"{name}.png")).convert("RGBA")


def build_corrected_base():
    """Use LOST0 for the body/background but patch in the correct eye pixels.

    LOST0 has the pupils too low. G-LOST0 carries the correct centered-pupil
    face. Restrict the replacement to the small face-difference area so we do
    not import the G-LOST0 lower-body/background differences.
    """
    base = load_rgba("LOST0")
    ref = load_rgba("G-LOST0")
    for y in range(20, 30):
        for x in range(30, 68):
            if base.getpixel((x, y)) != ref.getpixel((x, y)):
                base.putpixel((x, y), ref.getpixel((x, y)))
    return base


def main():
    base = build_corrected_base()
    for frame, offset in OVERLAY_OFFSETS.items():
        out = base.copy()
        if offset is not None:
            overlay = load_rgba(f"LOST{frame}")
            out.alpha_composite(overlay, offset)
        out.save(os.path.join(ASSET_DIR, f"CLRK{frame}.png"))
        print(f"wrote CLRK{frame}.png offset={offset}")


if __name__ == "__main__":
    main()
