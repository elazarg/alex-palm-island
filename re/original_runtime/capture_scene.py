#!/usr/bin/env python3
from __future__ import annotations

import argparse
import time
from pathlib import Path

from dosbox_harness import ClickStep, DosboxHarness, build_dosbox_conf


def parse_click(value: str) -> ClickStep:
    parts = value.split(",")
    if len(parts) not in (3, 4):
        raise argparse.ArgumentTypeError("click must be x,y,wait[,name]")
    x = int(parts[0])
    y = int(parts[1])
    wait_s = float(parts[2])
    name = parts[3] if len(parts) == 4 else None
    return ClickStep(x=x, y=y, wait_s=wait_s, name=name)


def parse_capture(value: str) -> tuple[float, str]:
    parts = value.split(",")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("capture must be delay,name")
    return float(parts[0]), parts[1]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Launch an original-game scene in DOSBox-X and capture frames."
    )
    parser.add_argument("--scene", required=True, help="Scene argument for ALEX1.EXE")
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory for generated conf and screenshots",
    )
    parser.add_argument(
        "--startup-delay",
        type=float,
        default=8.0,
        help="Seconds to wait after DOSBox-X window appears",
    )
    parser.add_argument(
        "--capture",
        action="append",
        default=[],
        type=parse_capture,
        help="Capture at delay,name relative to startup completion",
    )
    parser.add_argument(
        "--click",
        action="append",
        default=[],
        type=parse_click,
        help="Click at x,y then wait seconds and optionally capture name: x,y,wait[,name]",
    )
    args = parser.parse_args()

    out_dir: Path = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    conf_path = out_dir / f"{args.scene.lower()}-dosbox.conf"
    build_dosbox_conf(args.scene, conf_path)

    with DosboxHarness(conf_path) as harness:
        time.sleep(args.startup_delay)

        elapsed = 0.0
        for delay_s, name in sorted(args.capture, key=lambda item: item[0]):
            sleep_s = max(0.0, delay_s - elapsed)
            if sleep_s:
                time.sleep(sleep_s)
            elapsed = delay_s
            harness.capture(out_dir / f"{name}.png")

        for index, click in enumerate(args.click, start=1):
            harness.click_relative(click.x, click.y)
            time.sleep(click.wait_s)
            if click.name:
                harness.capture(out_dir / f"{click.name}.png")
            else:
                harness.capture(out_dir / f"click-{index}.png")


if __name__ == "__main__":
    main()
