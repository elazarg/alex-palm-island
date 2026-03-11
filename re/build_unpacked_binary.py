#!/usr/bin/env python3
"""Build stable decrypted and fully unpacked ALEX1 binary artifacts.

Outputs are written to `game_decrypted/bin/` by default:

- `ALEX1_decrypted.bin`  : HackStop outer layer removed
- `ALEX1_unpacked.bin`   : Fully unpacked executable image

Usage:
    python3 re/build_unpacked_binary.py
    python3 re/build_unpacked_binary.py --exe game/ALEX/ALEX1.EXE --out-dir game_decrypted/bin
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


DEFAULT_EXE = Path("game/ALEX/ALEX1.EXE")
DEFAULT_OUT_DIR = Path("game_decrypted/bin")


def run_step(cmd: list[str]) -> None:
    print("+", " ".join(str(part) for part in cmd))
    subprocess.run(cmd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exe", default=str(DEFAULT_EXE),
                        help=f"Path to packed ALEX1.EXE (default: {DEFAULT_EXE})")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR),
                        help=f"Output directory for generated binaries (default: {DEFAULT_OUT_DIR})")
    args = parser.parse_args()

    exe_path = Path(args.exe)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    decrypted_path = out_dir / "ALEX1_decrypted.bin"
    unpacked_path = out_dir / "ALEX1_unpacked.bin"

    run_step([
        sys.executable,
        "re/unpack_hackstop.py",
        str(exe_path),
        str(decrypted_path),
    ])
    run_step([
        sys.executable,
        "re/emu_decompress.py",
        str(exe_path),
        str(decrypted_path),
        str(unpacked_path),
    ])

    print("\nArtifacts written:")
    print(f"  {decrypted_path}")
    print(f"  {unpacked_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
