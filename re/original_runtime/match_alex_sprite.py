#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SPRITE_DIR = REPO_ROOT / "re" / "renders" / "sprites" / "global" / "ALEXWALK"


@dataclass(frozen=True)
class MatchResult:
    score: float
    sprite_name: str
    scale: float
    x: int
    y: int
    width: int
    height: int


def load_rgba(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"), dtype=np.uint8)


def iter_sprites(sprite_dir: Path, patterns: list[str]) -> list[tuple[str, np.ndarray]]:
    out: list[tuple[str, np.ndarray]] = []
    for pattern in patterns:
        for path in sorted(sprite_dir.glob(pattern)):
            out.append((path.stem, load_rgba(path)))
    if not out:
        raise SystemExit(f"no sprites matched {patterns} in {sprite_dir}")
    return out


def scale_sprite(sprite_rgba: np.ndarray, scale: float) -> np.ndarray:
    image = Image.fromarray(sprite_rgba, mode="RGBA")
    w = max(1, round(image.width * scale))
    h = max(1, round(image.height * scale))
    return np.array(image.resize((w, h), Image.Resampling.NEAREST), dtype=np.uint8)


def alpha_mse(region_rgb: np.ndarray, sprite_rgba: np.ndarray) -> float:
    alpha = sprite_rgba[:, :, 3] > 0
    if not np.any(alpha):
        return float("inf")
    diff = region_rgb[alpha].astype(np.int32) - sprite_rgba[:, :, :3][alpha].astype(np.int32)
    mse = float(np.mean(diff * diff))
    return mse


def search_best(
    screenshot_rgb: np.ndarray,
    roi: tuple[int, int, int, int],
    sprites: list[tuple[str, np.ndarray]],
    scales: list[float],
    stride: int,
) -> MatchResult:
    rx, ry, rw, rh = roi
    roi_rgb = screenshot_rgb[ry : ry + rh, rx : rx + rw]
    best: MatchResult | None = None
    for sprite_name, sprite_rgba in sprites:
        for scale in scales:
            scaled = scale_sprite(sprite_rgba, scale)
            sh, sw = scaled.shape[:2]
            if sw > rw or sh > rh:
                continue
            for y in range(0, rh - sh + 1, stride):
                for x in range(0, rw - sw + 1, stride):
                    region = roi_rgb[y : y + sh, x : x + sw]
                    score = alpha_mse(region, scaled)
                    candidate = MatchResult(
                        score=score,
                        sprite_name=sprite_name,
                        scale=scale,
                        x=rx + x,
                        y=ry + y,
                        width=sw,
                        height=sh,
                    )
                    if best is None or candidate.score < best.score:
                        best = candidate
    if best is None:
        raise SystemExit("no valid match in ROI")
    return best


def draw_match(image: Image.Image, match: MatchResult, out_path: Path) -> None:
    rgba = image.convert("RGBA")
    arr = np.array(rgba, dtype=np.uint8)
    x0, y0 = match.x, match.y
    x1, y1 = x0 + match.width, y0 + match.height
    arr[y0:y1, [x0, x1 - 1], :3] = (255, 0, 0)
    arr[[y0, y1 - 1], x0:x1, :3] = (255, 0, 0)
    Image.fromarray(arr, mode="RGBA").save(out_path)


def parse_roi(value: str) -> tuple[int, int, int, int]:
    parts = [int(part) for part in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("roi must be x,y,w,h")
    return tuple(parts)  # type: ignore[return-value]


def parse_scales(value: str) -> list[float]:
    if ":" in value:
        start, end, step = (float(part) for part in value.split(":"))
        scales = []
        current = start
        while current <= end + (step / 10.0):
            scales.append(round(current, 4))
            current += step
        return scales
    return [float(part) for part in value.split(",")]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Match original STRIPAIR screenshots against ALEXWALK sprites."
    )
    parser.add_argument("--screenshot", type=Path, required=True)
    parser.add_argument("--roi", type=parse_roi, required=True)
    parser.add_argument(
        "--sprite-dir",
        type=Path,
        default=DEFAULT_SPRITE_DIR,
    )
    parser.add_argument(
        "--sprites",
        action="append",
        default=[],
        help="Glob pattern(s) relative to sprite-dir, e.g. ALEX6-*.png",
    )
    parser.add_argument(
        "--scales",
        type=parse_scales,
        default=parse_scales("1.5:2.4:0.05"),
    )
    parser.add_argument("--stride", type=int, default=1)
    parser.add_argument("--annotate", type=Path)
    args = parser.parse_args()

    screenshot = Image.open(args.screenshot).convert("RGB")
    screenshot_rgb = np.array(screenshot, dtype=np.uint8)
    sprite_patterns = args.sprites or ["ALEX*.png"]
    sprites = iter_sprites(args.sprite_dir, sprite_patterns)
    best = search_best(screenshot_rgb, args.roi, sprites, args.scales, args.stride)
    print(
        f"best {best.sprite_name} scale={best.scale:.3f} "
        f"score={best.score:.2f} at ({best.x},{best.y}) size={best.width}x{best.height}"
    )
    if args.annotate:
        draw_match(screenshot, best, args.annotate)


if __name__ == "__main__":
    main()
