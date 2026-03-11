# The Adventures of Alex -- Palm Island Mission

A point-and-click adventure game for MS-DOS, published by **Onda Publications Ltd / Eric Cohen Edutainment** (Israel, 1996). An English-language educational game designed for Hebrew-speaking students learning English, featuring grammar quizzes, inventory puzzles, and a full voice-acted storyline.

Recovered from a scratched CD-ROM and fully reverse-engineered. Copy protection removed. Playable in-browser or via DOSBox.

## Play Online

**[Play in your browser](https://elazarg.github.io/alex-palm-island/)** -- no download needed.

## Game Details

| | |
|---|---|
| Platform | MS-DOS (386+, VGA, DOS 5+, XMS) |
| Engine | Custom, Borland Pascal 7.0 with FBOV overlays |
| Language | English (for Hebrew speakers) |
| Medium | CD-ROM (pressed, single-session ISO 9660) |
| Scenes | 56 locations across a tropical island |
| NPCs | 43 characters, ~1,200 grammar quizzes |
| Audio | 1,622 voice clips + 29 AdLib/OPL2 music tracks |

## Quick Start (Local)

Requires Python 3 and [DOSBox-X](https://dosbox-x.com/).

```bash
git clone https://github.com/elazarg/alex-palm-island.git
cd alex-palm-island
python3 download.py        # downloads and extracts game files (~310 MB)
./run_game.sh              # launches in DOSBox-X (safe: uses temp copy)
```

To also download the raw disc image (351 MB, optional):
```bash
python3 download.py --iso
```

## Extracted Assets

All game assets have been extracted to modern formats and are available as release downloads:

| Download | Contents |
|----------|----------|
| [alex-sprites.zip](https://github.com/elazarg/alex-palm-island/releases/download/v1.0/alex-sprites.zip) (14 MB) | 3,879 PNG sprites -- backgrounds, characters, UI, icons |
| [alex-sounds.zip](https://github.com/elazarg/alex-palm-island/releases/download/v1.0/alex-sounds.zip) (66 MB) | 1,622 WAV voice clips and sound effects (22050 Hz) |
| [alex-music-fonts-palettes.zip](https://github.com/elazarg/alex-palm-island/releases/download/v1.0/alex-music-fonts-palettes.zip) (134 KB) | 29 CMF music tracks, 4 font sheets, 53 palette swatches |

To regenerate from the game files:
```bash
./build_decrypted.sh                   # decrypt scene files
python3 re/export_all_assets.py        # export all assets to re/renders/
```

## Repository Structure

```
download.py              Download game files from GitHub release
run_game.sh              Launch game safely in DOSBox-X (temp copy)
build_decrypted.sh       Decrypt scene files into game_decrypted/
verify_game_files.sh     Verify SHA256 hashes of all game files

game/
  dosbox-x-play.conf     DOSBox-X configuration for gameplay
  dosbox-x-install.conf  DOSBox-X configuration for original installer
  cd/                    305 game files from the original CD-ROM (downloaded)
  ALEX/                  Installed game files (downloaded)

recovery/
  recovery.md            Recovery process documentation
  disc_image/            SHA256 hash, ddrescue map
  disc_metadata/         ISO 9660 and low-level disc info
  file_manifest.sha256   SHA256 hashes of all 305 original files

COPY_PROTECTION.md       How the 245 MB copy protection scheme works

re/                      Reverse engineering tools and documentation
  README.md              Tool guide
  formats/               12 documentation files (see below)
  disasm/                Annotated disassembly excerpts
  save_samples/          Save files from different game stages
  export_all_assets.py   Extract all sprites/sounds/music to modern formats
  extract_hotspots.py    OVR hotspot and click rectangle extractor
  analyze_game_tree.py   Static game tree analysis (flags, transitions)
  scene_xref.py          Cross-reference OVR hotspots with SCX sections
  parse_save.py          Save file parser and analyzer
  formats/parse_*.py     NDX, SCX, DAT, CFG, PRJ parsers
  formats/render_sprite.py  Sprite renderer
```

## Reverse Engineering Documentation

The game engine has been fully reverse-engineered. Documentation lives in `re/formats/`:

| Document | Contents |
|----------|----------|
| [FORMAT_SPEC.md](re/formats/FORMAT_SPEC.md) | All file formats: NDX, DAT, COMP, SCX/DCX, sprites, palettes, fonts, CTMF music, save files |
| [ENGINE_ARCHITECTURE.md](re/formats/ENGINE_ARCHITECTURE.md) | Engine internals: scene system, event loop, dispatch, walk, animation, music, save/load |
| [ENGINE_DETAILS.md](re/formats/ENGINE_DETAILS.md) | Street navigation, walk deltas, map system, text input, display ordering |
| [COMMAND_SEMANTICS.md](re/formats/COMMAND_SEMANTICS.md) | All 19 interactive commands + hotspot field semantics |
| [ANIMATION_COMMANDS.md](re/formats/ANIMATION_COMMANDS.md) | Animation command reference (F, P, G, Q, D, V, S, etc.) |
| [GAME_CONTENT.md](re/formats/GAME_CONTENT.md) | Critical path walkthrough, flag dependency graph, quiz analysis |
| [NPC_MAP.md](re/formats/NPC_MAP.md) | 43 NPCs across 26 scenes, dialog structure |
| [SCENE_MAPPING.md](re/formats/SCENE_MAPPING.md) | All 56 OVR scene functions, scene-to-music mapping |
| [SCORE_SYSTEM.md](re/formats/SCORE_SYSTEM.md) | Palmettoes scoring: 14 penalties, quiz rewards, bankruptcy mechanics |
| [SAVE_FORMAT_DETAILS.md](re/formats/SAVE_FORMAT_DETAILS.md) | GAM save file format: bit array, 60-byte records, field map |
| [FLAG_INVENTORY_REFERENCE.md](re/formats/FLAG_INVENTORY_REFERENCE.md) | All 194 game flags and 24 inventory items with lifecycles |
| [PUZZLE_FORMATS.md](re/formats/PUZZLE_FORMATS.md) | 10 puzzle types, anti-cheat detection |

## Recovery

This game was recovered from a scratched CD-ROM using GNU ddrescue. **99.98%** of the disc was recovered at the sector level. All 305 files were extracted; 304 are bit-perfect.

The only file with damage is **TRANS.BIG** (234.5 MB copy protection file). The 60 KB of unreadable data falls in non-critical regions. The copy protection has been fully reverse-engineered and removed -- see [COPY_PROTECTION.md](COPY_PROTECTION.md).

See `recovery/recovery.md` for full details.
