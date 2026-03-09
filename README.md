# The Adventures of Alex -- Palm Island Mission

A point-and-click adventure game for MS-DOS, published by **Onda Publications Ltd / Eric Cohen Edutainment** (Israel), circa February 1996.

## Game Details

| | |
|---|---|
| Platform | MS-DOS (386+, VGA, DOS 5+, XMS) |
| Engine | Custom, Borland Pascal 7.0 with FBOV overlays |
| Language | English (for Hebrew speakers) |
| Medium | CD-ROM (pressed, single-session ISO 9660) |

## Quick Start

Requires Python 3 and [DOSBox-X](https://dosbox-x.com/).

```bash
git clone https://github.com/elazarg/alex-palm-island.git
cd alex-palm-island
python3 download.py        # downloads and extracts game files (~310 MB)
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
  cd/              305 game files from the original CD-ROM (downloaded)
  ALEX/            Installed game files (downloaded)

recovery/
  recovery.md      Recovery process documentation
  disc_image/      SHA256 hash, ddrescue map (ISO downloaded separately)
  disc_metadata/   ISO 9660 and low-level disc info
  file_manifest.sha256   SHA256 hashes of all 305 original files

PLAN.md            Original recovery methodology
```

## Recovery Summary

This game was recovered from a scratched CD-ROM using GNU ddrescue. **99.98%** of the disc was recovered at the sector level. All 305 files were extracted; 304 are bit-perfect with zero bad sectors.

The only file with damage is **TRANS.BIG** (234.5 MB, 60 KB unreadable across 30 scattered sectors). Despite its high entropy and lack of direct references in executables, TRANS.BIG is a required game resource file — the game checks for it at startup and loads resources (e.g. cursors) from it indirectly through the engine's resource system. The 60 KB of unreadable data (0.025% of the file) falls in non-critical regions; the game starts and plays correctly with the recovered file.

See `recovery/recovery.md` for full details.
