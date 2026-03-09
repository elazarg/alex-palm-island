# Recovery Log: Alex Palm Island Mission CD-ROM

## 1. Physical Assessment

The disc is a commercially pressed CD-ROM with significant light-to-medium read-side scratching, concentrated in one quadrant (outer region). No hub crack or visible label-side delamination. The disc was not cleaned or resurfaced before imaging.

## 2. Disc Identification

- Filesystem: ISO 9660, single session, single data track
- No Joliet extensions, no Rock Ridge
- Volume size: 179,654 logical blocks (2048 bytes each)
- Data preparer: RCD-PC PINNACLE MICRO INC.
- Contents: 305 files in flat root directory (no subdirectories)
- All files timestamped February 19, 1996

## 3. Toolchain

| Tool | Version | Role |
|------|---------|------|
| GNU ddrescue | 1.29 | Disc imaging with retry maps |
| isoinfo | 1.1.11 | ISO 9660 filesystem inspection |
| 7z | (system) | ISO extraction |
| sha256sum | (system) | File integrity verification |
| python3 | 3.13.7 | Analysis scripts |
| cdrdao | (system) | Disc info (blocked by auto-mount) |
| DOSBox 0.74-3 | (system) | Runtime testing |

Drive: TEAC DV-28S-V, firmware 7.0A, SATA internal DVD-ROM (only drive available).

## 4. Imaging

### Pass 1: Fast non-splitting copy
```
ddrescue -n -b 2048 /dev/sr0 alex_palm_island.iso ddrescue_pass1.map
```
- Duration: ~17 minutes
- Rescued: 367,226,880 of 367,955,968 bytes (99.80%)
- Unrecovered: 729,088 bytes (712 KB) across 33 ranges
- All bad sectors located within TRANS.BIG (sectors 59,052-179,123)

### Pass 2: Retry with scraping
```
ddrescue -d -r 3 -b 2048 /dev/sr0 alex_palm_island.iso ddrescue_pass1.map
```
- Duration: ~16 minutes
- Final rescued: 367,894,528 of 367,955,968 bytes (99.98%)
- Final unrecovered: 61,440 bytes (60 KB, 30 sectors, 26 non-contiguous ranges)
- Improvement: recovered 650 KB of the 712 KB that failed in pass 1

All remaining bad sectors are within TRANS.BIG at offsets 216.57-218.83 MB. Zero bad sectors in any other file or filesystem structure.

### Image hash
SHA256: `8fe8738fcad102b284c81951de798418df658c19d51a7312877b3c69c214cd9d`

### Verification
- Pre-imaging: 304 of 305 files individually hashed from mounted filesystem (TRANS.BIG returned I/O error)
- Post-imaging: all 305 files extracted from ISO via 7z, all extracted successfully, SHA256 manifest generated

## 5. File Format Analysis

### Engine
Custom game engine built with Borland Pascal 7.0. The main executable (alex1.ex~, renamed to alex1.exe at install time) is a packed MZ DOS executable. Game logic is loaded from alex1.ovr (FBOV overlay format) containing scene modules.

### File categories (304 game files, all intact)

| Category | Count | Role |
|----------|-------|------|
| Executables (.ex~, .exe) | 2 | Main game + installer |
| Overlay (.ovr) | 1 | Scene code modules |
| Resource indexes (.ndx) | 62 | Name + offset/size entries |
| Resource data (.dat) | 60 | Graphics, sprites |
| Scene scripts (.scx) | 53 | Encrypted scene logic |
| Scene data (.dcx) | 43 | Encrypted scene data |
| Sound data (sd*.dat) | 38 | Digitized audio per scene |
| Sound indexes (sd*.ndx) | 38 | Audio indexes |
| Config/support | 5 | PRJ, LST, etc. |

### Resource system
- alex1.prj: master resource list referencing 9 resource packs
- Each scene has paired .ndx/.dat files (indexes + data) and .scx/.dcx (encrypted scripts/data)
- Sound data similarly paired as sd*.ndx/sd*.dat per scene
- Scene scripts and data are encrypted (entropy ~7.8-7.96 bits/byte)

## 6. TRANS.BIG: Copy-Protection Padding

TRANS.BIG is a 245,905,459-byte (234.5 MB) file occupying 67% of the disc. Analysis determined it is copy-protection padding, not game content:

1. **Not referenced** by any executable (alex1.ex~, alex1.ovr, install.exe)
2. **Not listed** in FILES.LST (installer copy list) or ALEX1.PRJ (resource list)
3. **Uniformly high entropy** (7.997 bits/byte) -- indistinguishable from random data
4. **No file format header** or companion index file
5. **Runtime confirmed**: game launches and runs without TRANS.BIG present

This was a common 1990s technique to make CD-ROM copying impractical by filling unused disc space with random data.

TRANS.BIG is excluded from the playable game files but remains in the raw disc image (`recovery/disc_image/alex_palm_island.iso`) for archival purposes.

## 7. Damage Summary

| Scope | Status |
|-------|--------|
| 304 game-functional files | Bit-perfect, zero bad sectors |
| TRANS.BIG (padding) | 234.44 MB of 234.50 MB recovered; 60 KB in 30 scattered sectors unreadable |
| Filesystem structures | Intact |
| Overall disc | 99.98% recovered |

No bytes were substituted, invented, or reconstructed. All recovered data is exact.

## 8. Runtime Test

Tested in DOSBox 0.74-3 on Linux:
- Original INSTALL.EXE used to create ALEX1.CFG (correct DOS line endings)
- Game launches, displays logo, reaches main menu, gameplay functional
- TRANS.BIG was present on CD mount but never accessed by the game
- Hebrew text requires codepage 862 for correct rendering; game uses internal font resources (FONTS.DAT) for in-game text
