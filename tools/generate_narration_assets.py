#!/usr/bin/env python3
"""Export all sdNar* narration sounds into a shared runtime soundbank."""

from __future__ import annotations

from pathlib import Path
import hashlib
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "re" / "formats"))

from parse_dat import extract_resources  # type: ignore

GAME_DIR = ROOT / "game_decrypted" / "cd"
OUT = ROOT / "assets" / "narration"


def write_wav(path: Path, pcm_data: bytes, sample_rate: int = 22050) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(1)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    seen_hashes: dict[str, str] = {}

    for ndx_path in sorted(GAME_DIR.glob("SD*.NDX")):
        dat_path = ndx_path.with_suffix(".DAT")
        if not dat_path.exists():
          continue
        for resource in extract_resources(str(dat_path), str(ndx_path)):
            name = resource["name"].upper()
            if resource["type_name"] != "sound" or not name.startswith("SDNAR"):
                continue
            digest = hashlib.sha1(resource["data"]).hexdigest()
            previous = seen_hashes.get(name)
            if previous and previous != digest:
                raise SystemExit(f"Conflicting narration sound data for {name}")
            if previous == digest:
                continue
            write_wav(OUT / f"{name}.wav", resource["data"])
            seen_hashes[name] = digest


if __name__ == "__main__":
    main()
