#!/usr/bin/env python3
"""Parse ALEX1.CFG configuration file.

Simple key=value text format with two known keys:
  CDROM = D:\\
  HARDDISK = C:\\ALEX\\

Usage:
    python3 re/formats/parse_cfg.py game/ALEX/ALEX1.CFG
"""
import sys


def parse_cfg(filepath):
    """Parse a CFG file. Returns dict of key -> value."""
    config = {}
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or '=' not in line:
                continue
            key, _, value = line.partition('=')
            config[key.strip()] = value.strip()
    return config


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    for filepath in sys.argv[1:]:
        config = parse_cfg(filepath)
        print(f"{filepath}:")
        for key, value in config.items():
            print(f"  {key} = {value}")


if __name__ == '__main__':
    main()
