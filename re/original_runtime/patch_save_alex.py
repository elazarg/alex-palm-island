#!/usr/bin/env python3
from __future__ import annotations

import argparse
import struct
from pathlib import Path


OBJECTS_START = 0x507


def find_record(data: bytearray, name: str) -> tuple[int, int]:
    pos = OBJECTS_START
    while pos < len(data):
        name_len = data[pos]
        if name_len == 0 or name_len > 30:
            break
        end = pos + 1 + name_len
        if end > len(data):
            break
        rec_name = data[pos + 1 : end].decode("ascii", errors="replace")
        next_pos = None
        for try_size in range(56, 400):
            candidate = pos + try_size
            if candidate >= len(data):
                next_pos = len(data)
                break
            next_len = data[candidate]
            if 2 <= next_len <= 20 and candidate + 1 + next_len <= len(data):
                next_name = data[candidate + 1 : candidate + 1 + next_len]
                if all(0x20 <= b <= 0x7E for b in next_name):
                    next_pos = candidate
                    break
        if next_pos is None:
            break
        if rec_name == name:
            return pos, next_pos - pos
        pos = next_pos
    raise SystemExit(f"record not found: {name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Patch ALEX position in a GAM save.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--x", type=int, required=True)
    parser.add_argument("--y", type=int, required=True)
    parser.add_argument("--dir", type=int, required=True)
    parser.add_argument("--scroll-x", type=int)
    args = parser.parse_args()

    data = bytearray(args.input.read_bytes())

    alex_pos, alex_size = find_record(data, "ALEX")
    if alex_size < 65:
        raise SystemExit("ALEX record too small")
    struct.pack_into("<H", data, alex_pos + 60, args.x)
    struct.pack_into("<H", data, alex_pos + 62, args.y)
    data[alex_pos + 64] = args.dir & 0xFF

    if args.scroll_x is not None:
        backdrop_pos, backdrop_size = find_record(data, "Backdrop")
        if backdrop_size < 62:
            raise SystemExit("Backdrop record too small")
        struct.pack_into("<H", data, backdrop_pos + 60, args.scroll_x)

    args.output.write_bytes(data)


if __name__ == "__main__":
    main()
