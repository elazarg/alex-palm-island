# Scene-to-OVR Function Mapping

Complete mapping of game scenes to their initialization functions in ALEX1.OVR.
All 44 scanner-detected functions and 12 manually-identified functions are now identified.

## Scene Table Structure

The master setup function at OVR offset `0x0996` creates **36 scene descriptors**
by calling two constructors:

- **Main constructor** (`08BB:2624`): Used for 34 scenes. Parameters include
  initial state, walk parameters, boundary height, and music track number.
- **Alternate constructor** (`00AE:0020`): Used for Factory and LiftRoom only.

Scene names are Pascal strings in the code segment (CS base `0x06ee`), copied via
`strcopy` (`1218:3C74`) before each constructor call. Each descriptor stores a music
track number in its 4th parameter, later read from the descriptor's `+0x7E` field
at scene-load time.

The scene table data begins at OVR offset `0x0719` and contains 36 scene name
entries (as `sn`-prefixed + bare name Pascal string pairs), followed by 2 bare
names (Prison, Death) at offsets `0x0989` and `0x0990` -- 38 entries total.

## Complete OVR Function Mapping

### Interactive Scene Init Functions (32 from extract_hotspots.py)

These functions have the standard scene-init prologue and contain
object/hotspot/click-rect definitions recognized by the extractor.

| OVR Offset | Frame | CS Base | Scene     | Objects | Hotspots | Click Rects |
|------------|-------|---------|-----------|---------|----------|-------------|
| `0x0321a`  | 0x0124 | 0x01aad | ZooFront  | 13 | 7 | 46 |
| `0x04cb9`  | 0x0124 | 0x01aad | Bear (variant 1) | 0 | 0 | 8 |
| `0x0514f`  | 0x0124 | 0x01aad | Monkey    | 0 | 0 | 12 |
| `0x05771`  | 0x0120 | 0x01aad | ZooBack   | 6 | 2 | 35 |
| `0x06be4`  | 0x0124 | 0x01aad | Bear (variant 2) | 0 | 3 | 8 |
| `0x07163`  | 0x0124 | 0x01aad | Caveman   | 0 | 0 | 9 |
| `0x08cd3`  | 0x0124 | 0x07c7f | Super     | 22 | 13 | 47 |
| `0x0b2de`  | 0x0124 | 0x0aeba | Butcher   | 6 | 7 | 21 |
| `0x0c566`  | 0x0124 | 0x0c506 | Room303   | 7 | 3 | 22 |
| `0x0e114`  | 0x0124 | 0x0d477 | Clothes   | 10 | 3 | 20 |
| `0x10d67`  | 0x0124 | 0x0ec08 | Floor1    | 5 | 2 | 16 |
| `0x119dc`  | 0x0124 | 0x0ec08 | Floor2    | 5 | 1 | 14 |
| `0x1246d`  | 0x0124 | 0x0ec08 | Floor3    | 5 | 1 | 13 |
| `0x12ecb`  | 0x0124 | 0x0ec08 | Floor4    | 5 | 8 | 12 |
| `0x13ad7`  | 0x0124 | 0x0ec08 | WaltRoom  | 7 | 11 | 16 |
| `0x15058`  | 0x0124 | 0x14f5d | Photo     | 14 | 11 | 21 |
| `0x190f9`  | 0x0124 | 0x17c04 | Aptment   | 10 | 4 | 19 |
| `0x1a6e6`  | 0x0124 | 0x19e51 | Room301   | 8 | 8 | 14 |
| `0x1b488`  | 0x0124 | 0x1b19b | Room302   | 7 | 9 | 15 |
| `0x20147`  | 0x0124 | 0x1ff95 | Ending    | 0 | 2 | 0 |
| `0x20b8c`  | 0x0124 | 0x20572 | Burger    | 18 | 8 | 46 |
| `0x26243`  | 0x0124 | 0x25f01 | StHosp    | 15 | 6 | 39 |
| `0x27c3f`  | 0x0124 | 0x25f01 | StHotel   | 14 | 5 | 43 |
| `0x2a522`  | 0x0124 | 0x29b92 | StSuper   | 15 | 3 | 39 |
| `0x2bc2f`  | 0x0124 | 0x29b92 | StButcher | 20 | 4 | 45 |
| `0x2dfbf`  | 0x0124 | 0x2daf2 | StBurger  | 15 | 3 | 33 |
| `0x2f909`  | 0x0124 | 0x2daf2 | StApart   | 15 | 1 | 46 |
| `0x32144`  | 0x0124 | 0x3174f | StZoo     | 16 | 3 | 40 |
| `0x33a29`  | 0x0124 | 0x3174f | StChoco   | 22 | 5 | 38 |
| `0x36a48`  | 0x0124 | 0x35953 | Airport   | 12 | 5 | 33 |
| `0x39c80`  | 0x0124 | 0x38383 | Lobby     | 14 | 5 | 23 |
| `0x3ac85`  | 0x0124 | 0x38383 | LobbyDsk  | 0 | 3 | 10 |

### Formerly-Unidentified Functions (12 -- now all identified)

These functions match the scene-init prologue pattern but have frame size `0x0200`
(or `0x0124`) and contain no objects, hotspots, or click rects. They are cutscene
handlers, transition wrappers, or scripted-sequence runners.

| OVR Offset | Frame | CS Base | Identity | Evidence |
|------------|-------|---------|----------|----------|
| `0x0de1d`  | 0x0200 | 0x0d477 | **ClothesPalette** | Refs `snClothesPal` + `Music`; calls palette load (`0BCE:0121`) and fade (`10E8:004F`, `10E8:0555`). Palette transition handler for the Clothes shop scene. |
| `0x18285`  | 0x0200 | 0x17c04 | **AptmentCutscene** | Refs `Music` only; calls palette load (`0BCE:0121`) and fade (`10E8:0555`). In Aptment segment near `PhilRap` string at `0x1802d`. TV/cutscene transition for the apartment. |
| `0x1a050`  | 0x0200 | 0x19e51 | **WardClip** | Refs `Clip`; calls `0BCE:125E` (clip playback) and string operations. Film clip / cutscene handler for the Ward/Room301 area. |
| `0x1eed0`  | 0x0200 | 0x1bece | **ControlBrainPanel** | Refs `Btn`, `-`, `B`; calls `0BCE:0C60`. In Factory area segment near `BrainPanel` string at `0x1edbb`. Brain panel puzzle interaction handler for the Control room. |
| `0x1ff98`  | 0x0200 | 0x1ff95 | **Opening** | Refs `sn` (2-byte Pascal string at CS offset 0); calls scene constructor `08BB:2624` after prepending `sn` prefix to a parameter name. Generic scene-registration wrapper at the very start of the Ending CS segment. Creates the Opening scene dynamically -- the only scene in the 36-entry table that uses this wrapper pattern. |
| `0x20424`  | 0x0124 | 0x1ff95 | **Arrest** | Refs `Police` (string at `0x20359`) + `Dig` + `Music`; calls `08BB:1798` (alternate scene loader) and `08BB:2564`; pushes section IDs 5010 and 5020 (arrest sequence sections). The `Police` string uniquely identifies this as the Arrest scene. |
| `0x2084b`  | 0x0200 | (none) | **Death** | No string refs, no CS base; calls only `1812:0530`, `1812:32C6` (state restore), and `08BB:1798` (scene loader). Minimal stub function located between Arrest (`0x20424`) and Burger (`0x20b8c`). The only remaining unaccounted scene from the table is Death, and this minimal handler fits a game-over screen. |
| `0x20963`  | 0x0200 | 0x20572 | **BurgerCutscene** | Refs `Music`; calls `08BB:1C4A`, `08BB:2351` (x2), `0BCE:0C60`, `10E8:0555`, `10E8:09A2`, `15EC:036C` -- animation and sound playback functions. In the Burger segment, this is the non-interactive cutscene/animation handler (jukebox scene intro or Bob interaction). |
| `0x3b858`  | 0x0200 | 0x3b78c | **CheckIn** | Refs `Music` (x2) + `Check` string at CS offset `0x0001`; calls `0BCE:0CE2`, `10E8:0544`, `10E8:0555` (palette/transition). Manipulates global flags at `0x2DA2` and `0x1D26`. Hotel check-in transition handler. |
| `0x3bbab`  | 0x0200 | (none) | **AltSceneLoader** | No string refs; calls `1812:0530`, `1812:32C6` (state restore), and `0BCE:0020` (alternate constructor -- same one used for Factory/LiftRoom in the scene table). Generic wrapper that restores state and creates a scene via the alternate constructor. |
| `0x3c0f0`  | 0x0200 | (none) | **GameStateHandler** | No string refs; calls `1812:0530`, `1812:32C6` (state restore), and `0BCE:3AE6` (unique handler). State management function -- likely save/load/restart handler. |
| `0x3d89d`  | 0x0200 | 0x3b75b | **QuitGame** | Refs `sdTestWave` + `Do you really want to leave the game?` (string at `0x3d876`); 795 bytes with 7 calls to `0BCE:0BC6`, 6 to `0BCE:0CE2`, plus sound test and dialog functions. Quit confirmation dialog and cleanup handler. |

### Additional Functions Not Detected by Scanner (12 functions)

These functions use non-standard frame sizes (`0x010A`, `0x012A`, `0x0126`,
`0x0128`, `0x012C`, `0x002C`, `0x0040`, `0x0220`) and are therefore not matched
by the `extract_hotspots.py` prologue scanner (which checks only for `0x0120`,
`0x0124`, `0x0200`, `0x0202`).

| OVR Offset | Frame | CS Base | Scene | Key Objects/Evidence |
|------------|-------|---------|-------|---------------------|
| `0x003ae`  | 0x0036 | -- | Logo | Logo, LogoPal, LogoTitle -- game intro/splash screen |
| `0x10106`  | 0x012A | 0x0ec08 | Ward | Envelope, LightSw1, R-Stairs, UpRite, DnRite, FallDn, JumpToStApart, ToStApart |
| `0x146fb`  | 0x0126 | 0x14f5d | Safe | ID-Safe, SafeClosed -- wall safe puzzle sub-scene |
| `0x16905`  | 0x0128 | 0x14f5d | Corridor | Cart1, Basket, DR301R, D302Red, D302Grn, DR303L, RearWall, Lift |
| `0x18035`  | 0x010A | 0x17c04 | PhilRap | PhilRap string at `0x1802d` -- TV/rap cutscene in Aptment segment |
| `0x1d08f`  | 0x0128 | 0x1bece | Factory | S-Danger, S-Worker, Mach-A through Mach-E, DmutA-C |
| `0x1e18e`  | 0x0128 | 0x1bece | LiftRoom | LiftTop, Fireman, LiftBlock, Drip1/2, Door, Bath, Machine |
| `0x1efde`  | 0x012C | 0x1bece | Control | BrainA, BrainB, LiftDn, Escape, Vent, Guard, Wires, BrainBTM |
| `0x20361`  | 0x002C | 0x1ff95 | Police | Police string at `0x20359` -- arrest cutscene preamble |
| `0x2351e`  | 0x0040 | -- | SpyMaster | SpyTlk, Bag, Lamp, SpyRewind, SpyPlay |
| `0x23f6a`  | 0x0220 | 0x25f01 | Strip0 | ToStChoco, ToStApart, ToButcher, ToStHosp, ToStripAir |
| `0x25498`  | 0x0220 | 0x25f01 | StripAir | PalmTree, Garbage, NoEntry, ToStrip0, ToStrip01 |

## Function Count Summary

| Category | Count |
|----------|-------|
| Interactive scene inits (scanner-detected, identified) | 32 |
| Cutscene/transition handlers (scanner-detected, frame 0x0200/0x0124) | 12 |
| Non-standard frame functions (manual identification) | 12 |
| **Total OVR functions identified** | **56** |

## Scene-to-Music Track Mapping

Extracted from the 36 scene descriptors created by the master setup function.

| Scene     | Track | Resource |
|-----------|------:|----------|
| Airport   | 26 | MUSIC26 |
| Aptment   | 7 | MUSIC7 |
| Arrest    | 27 | MUSIC27 |
| Burger    | 3 | MUSIC3 |
| Butcher   | 10 | MUSIC10 |
| Clothes   | 9 | MUSIC9 |
| Control   | 15 | MUSIC15 |
| Corridor  | 6 | MUSIC6 |
| Ending    | 13 | MUSIC13 |
| Factory   | 24 | MUSIC24 |
| Floor1    | 25 | MUSIC25 |
| Floor2    | 25 | MUSIC25 |
| Floor3    | 25 | MUSIC25 |
| Floor4    | 22 | MUSIC22 |
| LiftRoom  | 20 | MUSIC20 |
| Lobby     | 4 | MUSIC4 |
| Opening   | 1 | MUSIC1 |
| Photo     | 29 | MUSIC29 |
| Room301   | 14 | MUSIC14 |
| Room302   | 8 | MUSIC8 |
| Room303   | 14 | MUSIC14 |
| StApart   | 12 | MUSIC12 |
| StBurger  | 12 | MUSIC12 |
| StButcher | 12 | MUSIC12 |
| StChoco   | 12 | MUSIC12 |
| StHosp    | 12 | MUSIC12 |
| StHotel   | 12 | MUSIC12 |
| StSuper   | 12 | MUSIC12 |
| StZoo     | 12 | MUSIC12 |
| Strip0    | 21 | MUSIC21 |
| StripAir  | 21 | MUSIC21 |
| Super     | 16 | MUSIC16 |
| WaltRoom  | 13 | MUSIC13 |
| Ward      | 6 | MUSIC6 |
| ZooBack   | 19 | MUSIC19 |
| ZooFront  | 18 | MUSIC18 |

### Tracks Grouped by Usage

| Track | Resource | Scenes |
|------:|----------|--------|
| 1 | MUSIC1 | Opening |
| 3 | MUSIC3 | Burger |
| 4 | MUSIC4 | Lobby |
| 6 | MUSIC6 | Corridor, Ward |
| 7 | MUSIC7 | Aptment |
| 8 | MUSIC8 | Room302 |
| 9 | MUSIC9 | Clothes |
| 10 | MUSIC10 | Butcher |
| 12 | MUSIC12 | StApart, StBurger, StButcher, StChoco, StHosp, StHotel, StSuper, StZoo |
| 13 | MUSIC13 | Ending, WaltRoom |
| 14 | MUSIC14 | Room301, Room303 |
| 15 | MUSIC15 | Control |
| 16 | MUSIC16 | Super |
| 18 | MUSIC18 | ZooFront |
| 19 | MUSIC19 | ZooBack |
| 20 | MUSIC20 | LiftRoom |
| 21 | MUSIC21 | Strip0, StripAir |
| 22 | MUSIC22 | Floor4 |
| 24 | MUSIC24 | Factory |
| 25 | MUSIC25 | Floor1, Floor2, Floor3 |
| 26 | MUSIC26 | Airport |
| 27 | MUSIC27 | Arrest |
| 29 | MUSIC29 | Photo |

**Unused tracks:** MUSIC2, MUSIC5, MUSIC11, MUSIC17, MUSIC23, MUSIC28 (6 out of 29 available).

## Frame Size Variants

| Frame Size | Functions | Purpose |
|------------|-----------|---------|
| `0x0036` | Logo | Splash screen (minimal frame) |
| `0x002C` | Police | Arrest preamble (small frame) |
| `0x0040` | SpyMaster | Spy encounter (small frame) |
| `0x010A` | PhilRap | TV cutscene |
| `0x0120` | ZooBack | Scene init (near-standard) |
| `0x0124` | 31 functions | Standard scene init |
| `0x0126` | Safe | Sub-scene puzzle |
| `0x0128` | Factory, LiftRoom, Corridor | Alternate-constructor scenes + corridor |
| `0x012A` | Ward | Ward scene init |
| `0x012C` | Control | Control room |
| `0x0200` | 11 functions | Cutscene/transition/utility handlers |
| `0x0220` | Strip0, StripAir | Street scrolling scenes |

## Scenes NOT in the Main 36-Entry Table

The following scenes have OVR init functions but do not appear in the master
setup function's 36 scene descriptors:

| Scene | Offset | Evidence | Notes |
|-------|--------|----------|-------|
| Logo | `0x003ae` | Logo, LogoPal, LogoTitle | Splash screen, separate from gameplay |
| LobbyDsk | `0x3ac85` | LadyOut, SmlBell, DoSign | Sub-scene of Lobby (reception desk closeup) |
| Safe | `0x146fb` | ID-Safe, SafeClosed | Sub-scene puzzle (wall safe in a room) |
| SpyMaster | `0x2351e` | SpyTlk, Bag, Lamp | Spy encounter scene |
| Bear (x2) | `0x04cb9`, `0x06be4` | Notebook (v2 has hotspots) | Two init functions for zoo bear exhibit |
| Monkey | `0x0514f` | MNKY | Zoo sub-scene |
| Caveman | `0x07163` | Dig | Zoo sub-scene |
| Police | `0x20361` | Police string | Arrest cutscene preamble |
| PhilRap | `0x18035` | PhilRap string | TV/rap cutscene in apartment |

These are sub-scenes, puzzles, or non-interactive sequences that are loaded
dynamically by their parent scene rather than registered in the global scene table.

## 0x0200-Frame Function Classification

The 11 functions with frame `0x0200` (plus Arrest at `0x0124`) share a common
pattern: large local buffer (512 bytes), parameter copying from caller stack
frame, and a single "do something" call at the end. They fall into three categories:

### Palette/Transition Handlers (3 functions)
These load a palette and/or trigger a visual transition for their parent scene:
- `0x0de1d` **ClothesPalette**: loads `snClothesPal`, fades palette
- `0x18285` **AptmentCutscene**: loads music, fades palette
- `0x3b858` **CheckIn**: hotel check-in transition with flag toggling

### Cutscene/Script Runners (4 functions)
These run scripted sequences or play cutscenes:
- `0x1a050` **WardClip**: plays a film clip (`Clip` string)
- `0x1eed0` **ControlBrainPanel**: brain panel puzzle interaction (`Btn`, `-`)
- `0x20963` **BurgerCutscene**: animation/sound sequence in Burger
- `0x3d89d` **QuitGame**: quit confirmation dialog with sound test

### Scene Loader Wrappers (4 functions)
These restore state and delegate to a scene constructor:
- `0x1ff98` **Opening**: calls main constructor `08BB:2624` with `sn` prefix
- `0x2084b` **Death**: calls `08BB:1798` (alternate loader), no strings
- `0x3bbab` **AltSceneLoader**: calls `0BCE:0020` (Factory/LiftRoom constructor)
- `0x3c0f0` **GameStateHandler**: calls `0BCE:3AE6` (state management)

### Scene Init (1 function with 0x0124 frame, no objects)
- `0x20424` **Arrest**: creates Police/Dig scene via `08BB:1798`, sections 5010/5020

## OVR Segment Organization

Functions sharing the same CS base are grouped in the same overlay segment:

| CS Base | Segment | Functions |
|---------|---------|-----------|
| `0x01aad` | Zoo | ZooFront, Bear (x2), Monkey, ZooBack, Caveman |
| `0x06ee` | MasterSetup | Scene table + master setup (not a scene init) |
| `0x07c7f` | Super | Super |
| `0x0aeba` | Butcher | Butcher |
| `0x0c506` | Room303 | Room303 |
| `0x0d477` | Clothes | Clothes, ClothesPalette |
| `0x0ec08` | Floors | Floor1, Floor2, Floor3, Floor4, WaltRoom, Ward |
| `0x14f5d` | Photo | Photo, Safe, Corridor |
| `0x17c04` | Aptment | Aptment, PhilRap, AptmentCutscene |
| `0x19e51` | Room301 | Room301, WardClip |
| `0x1b19b` | Room302 | Room302 |
| `0x1bece` | FactoryArea | Factory, LiftRoom, Control, ControlBrainPanel |
| `0x1ff95` | Ending | Opening (loader), Ending, Police, Arrest |
| `0x20572` | Burger | Burger, BurgerCutscene |
| `0x25f01` | Streets1 | StHosp, StHotel, Strip0, StripAir |
| `0x29b92` | Streets2 | StSuper, StButcher |
| `0x2daf2` | Streets3 | StBurger, StApart |
| `0x3174f` | Streets4 | StZoo, StChoco |
| `0x35953` | Airport | Airport |
| `0x38383` | Lobby | Lobby, LobbyDsk |
| `0x3b75b` | Utility1 | QuitGame |
| `0x3b78c` | Utility2 | CheckIn |
| (none) | Utility3 | Death, AltSceneLoader, GameStateHandler |

## Reproduction

```bash
python3 re/extract_hotspots.py          # Scene init functions + object/hotspot data
python3 re/extract_music_tracks.py      # Scene table + music track assignments
python3 re/extract_music_tracks.py --by-track  # Tracks grouped by usage
```
