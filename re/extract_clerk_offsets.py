#!/usr/bin/env python3
"""Extract airport clerk overlay anchors.

Produces two things:
1. Exact scene-space origins for the airport clerk-related objects from ALEX1.OVR.
2. Best-fit per-frame offsets for LOST2-LOST8 relative to LOST0 in the remake.

The scene-space origins are extracted from the airport init function in ALEX1.OVR.
The per-frame offsets are derived by aligning the small LOST overlays against
the original clerk patch families (G/P/L-LOST) placed at the extracted origin.
"""

import os
import struct
import sys
from statistics import mean

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import extract_hotspots as eh


ROOT = os.path.join(os.path.dirname(__file__), "..")
OVR_PATH = os.path.join(ROOT, "game", "ALEX", "ALEX1.OVR")
ASSET_DIR = os.path.join(ROOT, "remake", "assets", "airport")

AIRPORT_INIT_MOV_DI = {
    "Achu": 0x37174,
    "P-Lost": 0x371D0,
    "L-Lost": 0x3722A,
    "G-Lost": 0x37284,
}

BASE_X = 86
BASE_Y = 16


def extract_scene_xy(off, data):
    vals = []
    i = off - 16
    while i < off:
        if data[i] == 0x68:
            vals.append(struct.unpack_from("<H", data, i + 1)[0])
            i += 3
            continue
        if data[i] == 0x6A:
            vals.append(data[i + 1])
            i += 2
            continue
        i += 1
    return tuple(vals[:2])


def load_rgba(name):
    return Image.open(os.path.join(ASSET_DIR, f"{name}.png")).convert("RGBA")


def build_reference_composites():
    base = load_rgba("LOST0")
    refs = []
    for fam in ("G-LOST", "P-LOST", "L-LOST"):
        for idx in range(1, 11):
            name = f"{fam}{idx}"
            patch = load_rgba(name)
            comp = base.copy()
            comp.alpha_composite(patch, (18, 0))
            refs.append((name, comp))
    return refs


def fit_overlay(overlay_name, refs):
    ov = load_rgba(overlay_name)
    op = ov.load()
    candidates = []
    for ox in range(24, 48):
        for oy in range(8, 20):
            scores = []
            for _, ref in refs:
                rp = ref.load()
                err = 0
                count = 0
                for y in range(ov.height):
                    for x in range(ov.width):
                        r, g, b, a = op[x, y]
                        if a == 0:
                            continue
                        rr, rg, rb, _ = rp[ox + x, oy + y]
                        err += (r - rr) * (r - rr) + (g - rg) * (g - rg) + (b - rb) * (b - rb)
                        count += 1
                if count:
                    scores.append(err / count)
            scores.sort()
            candidates.append((mean(scores[:5]), ox, oy))
    candidates.sort()
    return candidates[:10]


def main():
    with open(OVR_PATH, "rb") as f:
        data = f.read()

    print("Extracted airport object origins from ALEX1.OVR:")
    scene_xy = {}
    for label, off in AIRPORT_INIT_MOV_DI.items():
        xy = extract_scene_xy(off, data)
        scene_xy[label] = xy
        print(f"  {label}: {xy}")

    print("\nRelative origins in remake coordinates:")
    print(f"  Clerk patch origin: ({scene_xy['G-Lost'][0] - BASE_X}, {scene_xy['G-Lost'][1] - BASE_Y})")
    print(f"  Achu origin: ({scene_xy['Achu'][0] - BASE_X}, {scene_xy['Achu'][1] - BASE_Y})")

    refs = build_reference_composites()
    print("\nBest-fit LOST overlay offsets:")
    for name in ("LOST2", "LOST3", "LOST4", "LOST5", "LOST6", "LOST7", "LOST8"):
        best = fit_overlay(name, refs)
        print(f"  {name}: {best}")


if __name__ == "__main__":
    main()
