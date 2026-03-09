# The Adventures of Alex -- Palm Island Mission

A point-and-click adventure game for MS-DOS, published by **Onda Publications Ltd / Eric Cohen Edutainment** (Israel), circa February 1996.

## Game Details

| | |
|---|---|
| Platform | MS-DOS (386+, VGA, DOS 5+, XMS) |
| Engine | Custom, Borland Pascal 7.0 with FBOV overlays |
| Language | Hebrew |
| Medium | CD-ROM (pressed, single-session ISO 9660) |

## Quick Start

Requires Python 3 and [DOSBox-X](https://dosbox-x.com/).

```bash
git clone https://github.com/elazarg/alex-palm-island.git
cd alex-palm-island
python3 download.py        # downloads and extracts game files (75 MB)
dosbox-x -defaultconf -conf game/dosbox-x-play.conf
```

To also download the raw disc image (351 MB, optional):
```bash
python3 download.py --iso
```

## Repository Structure

```
download.py          Download game files from GitHub release
game/
  dosbox-x-install.conf
  dosbox-x-play.conf
  cd/              304 game files from the original CD-ROM (downloaded)
  installed/       Installed game files (downloaded)

recovery/
  recovery.md      Recovery process documentation
  disc_image/      SHA256 hash, ddrescue map (ISO downloaded separately)
  disc_metadata/   ISO 9660 and low-level disc info
  file_manifest.sha256   SHA256 hashes of all 305 original files

PLAN.md            Original recovery methodology
```

## Recovery Summary

This game was recovered from a scratched CD-ROM using GNU ddrescue. **99.98%** of the disc was recovered at the sector level. All 304 game-functional files are bit-perfect with zero bad sectors.

The only file with damage is **TRANS.BIG** (234.5 MB, 60 KB unreadable), which is copy-protection padding -- a common 1990s anti-copy technique that fills unused disc space with random data. It is not referenced by any game executable or manifest, and the game runs perfectly without it. TRANS.BIG is excluded from `game/cd/` but preserved in the raw disc image under `recovery/disc_image/`.

The game has been runtime-tested in DOSBox and is fully functional.
