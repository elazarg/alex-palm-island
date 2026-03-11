#!/usr/bin/env python3
"""Export tracked BP7-aware disassembly ranges to re/disasm/.

The reverse-engineering work kept re-running the same high-value ranges from the
terminal. This script makes those outputs reproducible and check-in friendly.

Usage:
    python3 re/export_disasm.py
    python3 re/export_disasm.py --targets re/disasm_targets.txt
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TARGETS = ROOT / "re" / "disasm_targets.txt"
DEFAULT_OUTPUT_DIR = ROOT / "re" / "disasm"
DEFAULT_BIN = ROOT / "game_decrypted" / "bin" / "ALEX1_unpacked.bin"


def parse_targets(path: Path) -> list[tuple[str, str, str]]:
    targets: list[tuple[str, str, str]] = []
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 3:
            raise ValueError(f"Bad target line: {raw_line!r}")
        name, start, end = parts
        targets.append((name, start, end))
    return targets


def export_target(name: str, start: str, end: str, output_dir: Path, bin_path: Path) -> Path:
    out_path = output_dir / f"{name}.txt"
    cmd = [
        "python3",
        str(ROOT / "re" / "dis_bp7_aware.py"),
        "--bin",
        str(bin_path),
        start,
        end,
    ]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    out_path.write_text(result.stdout)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export tracked disassembly ranges")
    parser.add_argument("--targets", default=str(DEFAULT_TARGETS), help="Path to target list")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output directory")
    parser.add_argument("--bin", default=str(DEFAULT_BIN), help="Unpacked binary path")
    args = parser.parse_args()

    targets_path = Path(args.targets)
    output_dir = Path(args.out_dir)
    bin_path = Path(args.bin)

    if not bin_path.exists():
        raise SystemExit(
            f"Missing unpacked binary at {bin_path}. Run `python3 re/build_unpacked_binary.py` first."
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    for name, start, end in parse_targets(targets_path):
        out_path = export_target(name, start, end, output_dir, bin_path)
        print(out_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
