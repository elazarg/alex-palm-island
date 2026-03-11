# Alex Palm Island — Engine Architecture

Reverse-engineered from the 1996 game binary (Borland Pascal 7.0, 129 KB unpacked).

---

## 1. Startup Sequence

From DOSBox-X tracing and static analysis of the startup functions:

1. **Config loading** — Read `ALEX1.CFG` to get CDROM and HARDDISK paths
2. **TRANS.BIG key extraction** — Open `D:\Trans.BIG`, traverse 51-entry chain
   to extract 255-byte XOR key into `DS:0x56D8` (see copy-protection.md)
3. **Global resource loading** — Load 9 resource packs from `ALEX1.PRJ`:
   DRIVERS, PANEL, ALEXWALK, MICE, FONTS, ICONS, WINDOWS, MUSIC, MAP
4. **ALEX1.NDX/DAT** — Load installed resources (not encrypted, despite earlier claims)
5. **Save file** — Create/open `AlexSave.TMP`
6. **Overlay** — Load `ALEX1.OVR` (FBOV format, 253 KB)
7. **First scene** — Load and run `LOGO.SCX` (then OPENING, etc.)

Relevant functions:
- `transbig_assign` (0x174D7): Assigns Trans.BIG file variable, initializes 10 slots
- `transbig_reader` (0x17527): Chain traversal, key extraction (576 bytes, 19 I/O dispatches)
- `transbig_setup` (0x17440): Initialize individual resource slot in the 10-slot array

---

## 2. Resource System

### Data structures

**TTransBigRecord** (137 bytes, 10 slots at `DS:0x50EF`):

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x00   | 4    | ptr   | File offset/segment identifier |
| 0x04   | 128  | filevar | Borland Pascal FileRec structure |
| 0x84   | 2    | alloc_handle | Memory allocation handle |
| 0x86   | 2    | prev_handle | Previous allocation handle |
| 0x88   | 1    | saved_slot | Previously active slot number |

### Loading pipeline

```
NDX file → parse 36-byte records → get name, offset, size, type
DAT file → read raw file
  ├── COMP header? → decompress (chunked, FF/FE/literal tokens)
  ├── ALEX1.DAT?   → raw (not encrypted)
  └── SD*.DAT?     → raw PCM audio
NDX offset → index into decompressed data → extract resource
  ├── type 0x0100 → sprite: 4-byte header (w,h) + w×h pixel bytes
  ├── type 0x0200 → sound: raw unsigned 8-bit PCM
  ├── type 0x0400 → palette: 768 bytes (256 × RGB, 6-bit VGA)
  └── type 0x0500 → cursor with palette
```

### Scene resource loading

Each scene loads up to 4 files:
- `{SCENE}.NDX` + `{SCENE}.DAT` → graphics (sprites, backgrounds, palette)
- `SD{SCENE}.NDX` + `SD{SCENE}.DAT` → sound effects
- `{SCENE}.SCX` → scene script (XOR-encrypted → text commands)
- `{SCENE}.DCX` → dialog text (XOR-encrypted → Hebrew text)

Relevant functions:
- `resource_mgr_1` (0x16E2E): Resource loading (corrupted by inline data)
- `resource_mgr_2` (0x16EC9): Resource loading variant
- `error_index_entry` (0x10EC2): "Index entry not found!" error handler
- `error_convert` (0x1023F): "could not be converted to a number!" error

---

## 2b. Main Menu (hardcoded)

The main menu is **not SCX-driven**. It is implemented in the overlay (ALEX1.OVR)
and loads resources from ALEX1.DAT:

- `MAINMENU` (320×200) — background art
- `MAINMENUPAL` (768 bytes) — palette
- `MMINTRO1` / `MMINTRO2` (236×34) — "Introduction" button (normal / highlighted)
- `MMPLAY1` / `MMPLAY2` (92×40) — "Play" button (normal / highlighted)
- `MMQUIT1` / `MMQUIT2` (84×41) — "Quit" button (normal / highlighted)
- `MMALEX1`–`MMALEX8` (64×105) — Alex walking animation on menu screen
- `MMARROWCURSOR` (28×15) — menu cursor

The overlay at offset 0x00D contains the resource name strings:
`MainMenuPal.MainMenu.MMIntro2.MMIntro1.MMPlay2.MMPlay1`

Clicking "Introduction" loads the OPENING→OPEN2→OPEN3→OPEN4 non-interactive
animation sequence. Clicking "Play" starts the game (loads Strip0 or Airport).
The menu appears after the LOGO animation completes.

---

## 3. Scene System

### SCX interpreter

The engine reads SCX files as text, parsing sections delimited by `0xFE`. Each section has:
- A numeric section ID (sometimes with additional parameters on the same line)
- A list of command lines

### Binary structure

Two separate command dispatch tables exist in the binary:
- **Interactive dispatch** at 0xAAFB–0xAD5F: handles E, F, G, I, K, L, M, O, P, S, T, X, Y, Z
- **Animation dispatch** at 0x3E36–0x44F7: handles I, L, T, F, A, T, X, Y

**IMPORTANT**: The same letter can mean different things in each context.
For example, `F` in interactive sections sets a game flag; in animation sections it displays/fades a frame.

### Section types and flow

```
Scene loaded → Parse SCX → Build section table
  ├── Interactive sections (100-499): conditional command records
  ├── Text ref sections (500-999): text + sound + narration
  ├── Dialog sections (≥1000 or 2000+): multiple-choice dialog trees
  ├── Animation sections (≥5000, command lines): frame sequences
  └── Data sections (≥5000, numeric lines): coordinate/timing arrays
```

### Condition system

Interactive section records: `flag_id,expected_value,CMD,arg1,arg2,...`
- `flag_id` = 0 means unconditional (most commands)
- `flag_id` in range 1001–1921 = test game flag
- `expected_value` is 0 or 1 (boolean)
- 151 unique flag IDs observed across all 53 SCX files
- Flags are set by the `F` command in interactive sections

### What is well understood
- All 19 interactive SCX commands at high confidence:
  A (animate), B (visibility), C (scene change), D (facing direction),
  F (set flag), G (give/take item), H (NPC speech), K (jump), L (narrator/zoom),
  M (move delta), O (item use dispatch), P (Palmettoes penalty), R (refresh scene),
  S (play sound), T (dialog tree), V (set variable), W (walk), X (exit), Y (first-use branch)
- Section structure and parsing (confirmed by parser + binary)
- Condition/flag system (flag range 1001–1921, boolean tests, 151 unique flags)
- Dialog tree structure (NPC line → choices → responses with sound/goto, implicit flag setting)
- Scene transition graph (complete — see below)
- GLOBAL.SCX = inventory use handler (O/G/Y/L/X commands)
- **Animation system**: 17 commands, frame-to-NDX mapping (per-object, 1-indexed by
  string concatenation), data section pairing, motion paths. 10 commands at HIGH
  confidence; remaining 7 have partial binary evidence.
- **Hotspot/click rect system**: complete 6-type classification (A–F), bounding boxes,
  section linkage for look/touch/talk/use-item via struct fields +0x44/+0x46/+0x48/+0x4A,
  +0x62 = auto-trigger/walk-through
- **5 interaction modes**: look, talk, touch, walk, bag — mapped to cursor sprites
  and struct field dispatch
- **OVR scene init structure**: 3-layer object creation (visual → hotspot → click rect),
  all 56 functions identified and mapped to scenes (see `SCENE_MAPPING.md`)
- **Score system**: all 14 P command penalties, engine-side `+10` quiz rewards,
  budget analysis, bankruptcy arrest flow (see `SCORE_SYSTEM.md`)
- **Named hotspot values**: confirmed as Y-coordinate depth/Z-order for sprite
  ordering (painter's algorithm), not section IDs (see `COMMAND_SEMANTICS.md` §9)

### Remaining gaps

- **Animation edge cases**: `T`, `E`, `Y` resolved via abstract interpretation
  (cross-site analysis, game context). Only the internal implementation of
  overlay function `10E8:0468` (E effect renderer) and the `b1 9a` call stub
  target `0x0D1A` (Y depth callback) remain unverified at the instruction level.
  See `ANIMATION_COMMANDS.md` §Open Questions.
- **Palmettoes reward trigger**: the engine applies `+10` via a shared money-delta
  helper at `0x3763`, gated by dialog completion state. The reward-bearing dialogs
  are the ~113 quiz-style `ALTalk`/`ALTel` sections with non-zero `completion_flag`.
  The binary path is well-constrained but one upstream node-field copy remains
  untraced. See `SCORE_SYSTEM.md` for full details.
- **Meter / suspicion**: RESOLVED. The `Meter` object at `[0x2FF6]` (value=180,
  max=200) is a suspicion meter separate from Palmettoes. Trigger: vtable+0x38
  returns "suspicious" → handler at `0x402B` checks scene_mgr+0x3C bit 9 →
  calls `[0x361E]` with (1, 0x708) to increment. Gated by Meter+0x3A bit 0
  (suspicion enabled flag). See `SCORE_SYSTEM.md` §Suspicion System.
- **Street/map overlay logic**: high-level behavior is known, but not every overlay
  helper is documented instruction-by-instruction.
- **Auto-trigger edge cases**: `+0x62` is a walk-through trigger field, but some
  target values route to non-obvious overlay-side handlers.

### Phase 1 Completion Status

All major engine systems are documented across 11 markdown files in `re/formats/`.

**Fully resolved:**
- Save/load system: OVR overlay architecture (34 functions mapped), UI construction, file scanning, serialization via indirect calls `[0x309C]`/`[0x30A0]`, raw struct dump format
- File formats: NDX, DAT, COMP, SCX/DCX, CFG, PRJ, OVR, sprites, palettes, fonts, CTMF, GAM saves
- All 19 interactive commands (A–Y) with high-confidence semantics
- All 56 OVR scene init functions identified and mapped
- Scene-to-music track mapping (36 scenes, 29 tracks)
- Dialog system: section format, answer records, implicit flag setting, reward correlation
- Score system: all 14 penalties, budget analysis, bankruptcy/arrest flow
- Animation system: all 17 commands decoded, frame-to-NDX mapping (per-object, 1-indexed), data section pairing
- Walk system: mode 0/1, walk deltas, direction compass
- Hotspot/click-rect system: 6 types (A–F), 5 cursor interaction modes, struct field dispatch
- Copy protection: TRANS.BIG chain, 255-byte XOR key
- Game content: critical path, flag graph, 43 NPCs, ~1200 grammar quizzes, 10 puzzles

**Partially resolved (needs runtime tracing):**
- Animation commands T, E, Y: semantics resolved via game context and cross-site analysis; internal overlay/stub implementations unverified
- Palmettoes reward trigger: binary path constrained to dialog `+10` hook, but one upstream field copy untraced
- Meter/suspicion: trigger path resolved (vtable+0x38 → 0x402B → [0x361E]); overlay internals unverified
- Street/map overlay helpers: high-level behavior known, instruction-level gaps remain
- A few `+0x62` auto-trigger edge cases

**Not needed for Phase 2:** The remaining gaps are all internal engine implementation
details. All game content, formats, and scripting semantics needed to build a reimplementation are documented.

### Animation system (data-driven)

Animation sections come in pairs: a **data section** and a **command section**.

**Data section** (e.g. 5020, 5030): Array of `x,y` coordinate pairs, one per frame.
Each entry positions the animated sprite for that frame.

**Command section** (e.g. 5025, 5035): Script that steps through the data array.

**Animation command semantics** (confirmed across LOGO, OPENING, OPEN2-4):

| Cmd | Args | Confidence | Meaning | Ghidra |
|-----|------|------------|---------|--------|
| P   | delay,0 | High | Step through path entries using the same tick field as `F` duration. | Confirmed: computes delay, stores in +0x36f |
| V   | 1,0 / 0,0 | High | Show (1) or hide (0) the animated sprite. | — |
| G   | target,0 | High | Goto frame `target` in data array. -1 = end. | Confirmed: sets +0x37a (target), enables goto-mode (bit 0x100). Negative wraps via +0x37e. |
| F   | frame,duration | High | Advance frame + set delay if duration nonzero. | Confirmed: increments frame counter, calls vtable+0x50, stores duration in +0x36f |
| E   | type,0 | Medium | Set animation type byte. | Confirmed: writes arg to +0x375; tick updater later consumes it and far-calls 0x10E8:0468 |
| S   | N,0 | Medium | Trigger sound segment N. | — |
| D   | frame,param | Medium | Display frame. `D 0,0` = show background. | — |
| O   | param,0 | Medium | Overlay/cutscene callback with params (0, -1, arg). | Confirmed: calls func 0x167c6 |
| L   | x,y | Medium | Set absolute position (subtracts current X). | Confirmed: computes delta, calls vtable+0x48 |
| M   | dx,dy | Medium | Relative move: add dx to X, dy to Y. | Confirmed: adds to +0x02, +0x04 |
| R   | 0,0 | Medium | Reset animation state. | All 42 uses are `R 0,0` (40) or `R 1,0` (1) |
| Q   | (0,0) | High | End animation sequence. | — |
| I   | N,0 | Low | Initialization/global setup hook. | Handler touches helper/global pointer path rather than frame fields |
| X   | 0,0 | Low | May be per-tick advance trigger. | Possibly `FUN_1000_a7e9` |

**Section 5000 convention**: Standard scene initialization:
`D 0,0 / F 1,1 / F 2,1 / F 3,1 / R 0,0 / Q` = display background, 3-step fade-in, reset.
Appears in OPENING, OPEN2, OPEN3, ENDING.

**Multiple tracks**: Animation sections can run simultaneously within a scene.
OPEN4 has 7 parallel tracks. The interactive section activates each with `A state,object,0`.

**Data/command pairing**: Usually consecutive IDs (5020/5025, 5030/5035).
OPENING uses a looser layout where 5010 is a standalone timeline referencing
frame numbers directly.

### Introduction sequence

Triggered from main menu → "Introduction" button. Loads 4 scenes sequentially:

1. **OPENING** (50 resources): Filmstrip-framed title card. Phone ringing animation
   (25 frames, 92×83), street/car animation (8 frames, perspective path from
   260,0 → 37,168). Film sprocket borders flicker. Flag 1900 controls intro skip.
2. **OPEN2** (101 resources): Perspective hallway walk — 73 frames shrinking from
   248×158 to 28×75 as Alex recedes. 3 background swaps (BHALL→BHALL2→BHALL3).
   13-frame door opening with sound. Ends with Spy Master reveal.
3. **OPEN3** (34 resources): Biplane fly-by — plane enters right (279,89), flies left
   across screen, sprites grow then shrink (4×3 → 224×80 → 84×28). 23 waypoints.
4. **OPEN4** (110 resources): Credits with 7 parallel animation tracks. Each credit
   text (Prog, Graph, Lang, Hebr, Prod) follows its own motion path (smooth drift,
   chaotic bounce, diagonal slide). Onda logo zooms to full screen (320×200).
   Ends: `C,snAirport,110` → loads AIRPORT scene.

The `C sn*,section_id` command transitions to a new scene. The `sn*` identifier
maps to a scene in the overlay scene table (36 named pairs + Prison + Death).

### Scene table (from ALEX1.OVR at offset 0x719)

36 `sn*` → scene name pairs stored as consecutive Pascal strings:

| # | sn* identifier | Scene file | # | sn* identifier | Scene file |
|---|---------------|------------|---|---------------|------------|
| 1 | snOpening | Opening | 19 | snRoom303 | Room303 |
| 2 | snEnding | Ending | 20 | snAptment | Aptment |
| 3 | snStrip0 | Strip0 | 21 | snFloor1 | Floor1 |
| 4 | snStripAir | StripAir | 22 | snFloor2 | Floor2 |
| 5 | snStHosp | StHosp | 23 | snFloor3 | Floor3 |
| 6 | snStHotel | StHotel | 24 | snFloor4 | Floor4 |
| 7 | snStButcher | StButcher | 25 | snWaltRoom | WaltRoom |
| 8 | snStApart | StApart | 26 | snClothes | Clothes |
| 9 | snStSuper | StSuper | 27 | snButcher | Butcher |
| 10 | snStBurger | StBurger | 28 | snPhoto | Photo |
| 11 | snStZoo | StZoo | 29 | snWard | Ward |
| 12 | snStChoco | StChoco | 30 | snSuper | Super |
| 13 | snAirport | Airport | 31 | snZooBack | ZooBack |
| 14 | snBurger | Burger | 32 | snZooFront | ZooFront |
| 15 | snLobby | Lobby | 33 | snFactory | Factory |
| 16 | snCorridor | Corridor | 34 | snLiftRoom | LiftRoom |
| 17 | snRoom301 | Room301 | 35 | snControl | Control |
| 18 | snRoom302 | Room302 | 36 | snArrest | Arrest |

Plus 2 unnamed entries at end: **Prison** (0x98A), **Death** (0x991).

Additional scenes in overlay (not in main table): Bear, Monkey, LionCage, Caveman,
SpyMastr, LobbyDsk, Safe. These are **sub-scenes** entered from parent scenes via
hotspot clicks (not C commands). The overlay contains their `sn*` names and handles
entry directly.

### OVR scene initialization

Each scene's overlay function creates the scene's object hierarchy via a fixed
call sequence:

```
Scene init function (0x0124 stack frame):
  1. Create visual objects     × N  (call far 089E:0000)
     - sprites positioned at (x,y), named via strcopy
  2. Create named hotspots     × M  (call far 089E:0073)
     - interactive anchors at (x,y) with handler values
  3. Create click rectangles   × K  (call far 10C4:0000)
     - each followed by a type-specific config call:
       - 0BCE:27A8 (1001,256,...) → Type A walk zone
       - 0BCE:27A8 (0,0,...)     → Type B interactive object
         - then field writes: [di+0x46]=look, [di+0x48]=touch, [di+0x4A]=talk
       - 033B:12A0              → Type C scene exit
       - 033B:0616              → Type D walk-to trigger
       - 033B:0442              → Type E special/animated
       - (no strcopy)           → Type F raw trigger
```

Typical counts per scene: 5–22 visual objects, 1–13 named hotspots, 8–47 click
rectangles. Total across all scenes: 306 objects, 146 hotspots, 803 click rects.

Street scenes (St*) have the most click rects (33–46) due to many walk zones,
exits, and far-interaction hotspots. Close-up scenes (LobbyDsk, Bear) have
fewer (8–10), mostly Type B interactive objects.

Non-scene SCX files: ALEX1 (walk delta table), GLOBAL (inventory handler),
INVENT (inventory inspection data), LOGO (pre-menu splash), DEMO (demo end screen).
OPEN2-4 have no overlay entry but are chained from OPENING via C commands.

Note: `StButcher` in table maps to `STBUTCHE.SCX` on disc (8.3 filename truncation).

### Scene transition graph

Extracted from all `C,sn*` commands across 53 SCX files. Shows which scenes load
which other scenes via the `C` command:

```
LOGO → (main menu)
Main Menu → OPENING (intro) or Strip0/Airport (play)

Introduction chain:
  OPENING → OPEN2, OPEN3
  OPEN2 → SPYMASTER
  OPEN3 → OPEN4
  OPEN4 → AIRPORT

Main game hub:
  AIRPORT → ARREST (3 arrest paths), StripAir (through doors, overlay-triggered)
  STRIPAIR: talking cat (CAT1-10) + information stand with unhelpful person
  STRIPAIR → STRIP0 (going down = entering the town center, walk left/right)
  LOBBY → CORRIDOR, DEATH, LOBBY(self)
  CORRIDOR → ROOM301, ROOM302, ROOM303, LOBBY

Hotel:
  ROOM301 → CORRIDOR
  ROOM302 → CORRIDOR, ARREST
  ROOM303 → CORRIDOR, ARREST

Apartment building:
  APTMENT → FLOOR1, DEATH
  FLOOR1 → FLOOR2, APTMENT, DEATH
  FLOOR2 → FLOOR1, FLOOR3, DEATH
  FLOOR3 → FLOOR2, FLOOR4
  FLOOR4 → FLOOR3, WALTROOM
  WALTROOM → FLOOR4
  SAFE → WALTROOM

Shops/locations:
  BURGER → STBURGER
  STBURGER → BURGER
  PHOTO → STZOO
  STZOO → PHOTO, ZOOFRONT
  STHOTEL → LOBBY, WARD
  STAPART → APTMENT
  STCHOCO → FACTORY, ARREST, DEATH

Zoo:
  ZOOFRONT → ARREST
  ZOOBACK → CAVEMAN, ARREST, DEATH
  BEAR → ARREST
  MONKEY → ARREST
  LIONCAGE → ARREST, DEATH
  CAVEMAN → ARREST

Factory/endgame:
  FACTORY → ARREST
  LIFTROOM → CONTROL, ARREST, DEATH
  CONTROL → LIFTROOM, ENDING, ARREST, DEATH

Dead ends (no outgoing C):
  ENDING (game won), PRISON (game over), DEATH (game over), SPYMASTER (overlay-loaded)

Street navigation (via B,To* exit hotspots — walk off screen edge):
  StripAir ↔ Strip0
  Strip0 → StApart, StButcher, StChoco, StripAir, Butcher
  StApart → StBurger, StButcher, StChoco, Strip0
  StBurger → StApart, StSuper, StZoo
  StButche → Butcher, StApart, StHosp, StSuper, Strip0
  StChoco → StApart, StZoo, Strip0
  StHosp → StButcher, StHotel, Strip0
  StHotel → Hotel(=Lobby), StHosp, StSuper
  StSuper → StBurger, StButcher, StHotel
  StZoo → StBurger, StChoco
  Aptment → StApart
  ZooBack → LionCage
```

### Airport — Reference Scene Analysis

The first playable scene. Entered from OPEN4 via `C,snAirport,110`. Demonstrates
all core engine systems: scrolling, animation, interaction modes, dialogs, inventory.

**Resources**: 220 graphics in AIRPORT.DAT, 3 background panels (SNAIRPORT1-3,
each 320×200), 1 palette (SNAIRPORTPAL). The scene scrolls horizontally across
960×200 pixels (3 panels). Viewport follows Alex as he walks.

**Entry sequence** (section 110):
```
0,0,V,Meter,1          ← show the persistent Meter UI element
0,0,B,WalkUpstairs,0   ← disable walk-upstairs behavior
0,0,A,0,ALEXDN,0       ← start Alex descending escalator animation
0,0,V,ALEXDN,0         ← hide static Alex (animation takes over)
0,0,A,1,Stairs,0       ← start escalator animation
0,0,W,0,840,140        ← walk Alex to position (840,140) — near guard
0,0,B,WalkUpstairs,1   ← re-enable walk-upstairs
```
Alex arrives from top-right, descends the animated escalator, walks to the guard
area. The "Arrivals" sign (ARRIVE hotspot) occludes Alex during descent — confirmed
pseudo-3D layering with display list priority.

**Scene layout** (right to left, matching scroll direction):
```
x=960─────────────────────────────────────────────────────────0
 escalator → guard(MAAKE) → bags → advertisement(HOTELAD/ORANGEAD)
 → counter+passport officer(BRDTLK) → exit sign → automatic doors(DOOR1-4)
 → woman guard(FEMTLK) → lost-and-found counter → clerk(G-LOST/P-LOST/L-LOST)
```

**Animated objects** (from SCX B/A commands + DAT frame sequences):
- Escalator: STAIRS1-6 (6 frames, 136×131, looping)
- Guard (MAAKE): near escalator, idle animation
- Passport officer: BRDTLK0 + BRDTLK1-11 (base 132×82 + mouth 32×26)
- Woman guard: FEMTLK0 + FEMTLK1-7 (base 132×82 + mouth 16×16)
- Lost-and-found clerks: G-LOST, P-LOST, L-LOST (3 clerks, each with talking frames)
- Automatic doors: DOOR1-4 (opening animation, 100×93)
- Alex descending: ALEXDN1-18 (18 frames, 124×120)

**Sections 120/130** toggle the guard between two poses (STAFFB=standing still,
TRUP=looking around) with corresponding visibility changes — the guard is animated.

**Interaction examples** (confirmed by user):
- Look at guard → section 510: "This man is a guard. He keeps people and places safe."
- Touch guard → section 635: "You shouldn't go around touching people."
- Talk to guard → section 150 → walk to (720,120) → face NE (D 9) → dialog 2010

**Dialog 2010** (guard conversation):
```
Speaker: GrdTlk (guard talking animation, position 49,11)
Voice: sdEscl6
NPC: "Good morning.  Can I help you?"
Alex: "Yes, please. I am looking for @."     ← @ = choice placeholder
Choices: a hotel | my bag | something to eat | a taxi to town
```
All 4 answers are correct (result=1), each leading to a different continuation
section (151–154). Dialog screen shows: NPC animated top-left, NPC text top-right,
Alex animated bottom-right, Alex text + choices bottom-left. Door icon below Alex
exits dialog. Player can click choices or use up/down arrows; selected choice
appears in red replacing the @ placeholder.

**Dialog format confirmed**:
- `GrdTlk 49,11, sdEscl6` = sprite_name x,y, sound_resource
- The (x,y) positions the NPC sprite on the dialog screen (not the main scene)
- Alex position is fixed (bottom-right) using the ALTalk speaker template

**NPCs and animations**:
- Guard (MAAKE, 184×60): idle animation near escalator. Toggles between
  STAFFB (standing) and TRUP (looking around) poses via sections 120/130.
- Lost-and-found clerk: **sneezes** (ACHU1-11, 88×56, 11 frames) with sound
  effects. Has a "monologue" popup where they repeat previous information
  before handing you the form.
- Passport officer (BRDTLK): animated talking head.
- Woman guard (FEMTLK): animated talking head.
- Family in queue (FAMILY1-6, 144×96): appears after getting bag. 2 adults +
  2 kids. The kids "do not speak English" (educational element).

**Palmettoes animations**: When the bag "costs" 10 Palmettoes, an animation
shows a person rolling a coin from the Palmettoes counter in the mid-panel to
the right and out of the panel. The passport check costs 15 Palmettoes.
Saying it's a "holiday" to the passport officer passes the check.

**Key game mechanics demonstrated**:
- **Inventory starts empty**: no bag at first. The bag (and inventory system)
  becomes accessible only after retrieving it from lost-and-found.
- **Lost-and-found puzzle** (section 310+): Talk to clerk → fill out a form
  (section 650 = FORM, a 320×200 close-up). Incorrect details → `C,snArrest`
  (arrested/prison). Correct details → receive bag with passport inside.
  Flags 1006-1009 track returned items. Section 325 orchestrates the multi-step
  sequence with 3 animated clerks (G-LOST, P-LOST, L-LOST).
- **Queue trigger**: After getting the bag+passport (flag 1009), a queue/family
  appears in front of the passport officer: `V,Family,1` + `B,FamilyBlock,1` +
  `B,PolyFamily,1` in section 325. FAMILY1-6 sprites (144×96, 6 frames).
  The FamilyBlock click rect (737,12)-(773,94) with look=630: "The family is
  waiting in line for the passport officer."
- Section 410 (automatic doors): `B DoorTrigger,0` + conditional on flag 1010
  (passport cleared). If not cleared → section 430 → woman guard dialog.
- Score: starts at 100 Palmettoes. Section 229: `P,-15` (penalty for wrong action).
  Section 325: `P,-10`. All penalties negative.

**UI panel** (from user description):
- Green/olive colored panel at bottom of screen
- Shows Palmettoes count + a P-shaped palm tree logo
- Hovering over the panel replaces it with an action menu
- Action menu includes cursor mode buttons: Look, Talk, Touch, Walk, Bag
- PANEL resource (320×33): the green panel background with the Palmettoes
  P-palm-tree logo. Rendered at the bottom of the screen.
- On hover, panel is replaced by 7 action buttons:
  LOOKBUTTON (44×31), TALKBUTTON (40×31), TOUCHBUTTON (40×32),
  WALKBUTTON (48×31), CASEBUTTON (44×33, = bag/inventory),
  MAPBUTTON (40×33, only appears on outdoor/street scenes),
  EXITBUTTON (40×31, = door icon → settings/save/load panel)
- Score display: METER (320×20) + MONEY1-4 (24×14 digit sprites) +
  MONEYBOX (68×16)

**Text input system**: The engine supports keyboard text input via type-4 zoom
sections. Four instances exist:
1. **Airport form** (section 650, `Form,1`): 4 questions — name, lost item,
   size, colour. Section 800: "Remember! Capital letters!" Validates input,
   wrong answers → arrest. Triggers bag retrieval sequence.
2. **Hotel guest book** (LobbyDsk section 600, `Form,3`): Registration form
   with business/holiday + room type selection.
3. **Room303 telephone** (section 820, `Phone,3`): Dial numbers from directory.
   Phil's number (201936) is part of the critical path.
4. **Safe code** (WaltRoom section 900): Enter `FEEDBIGBADDAD`.

**Generic responses for walk zones**: Looking at Type A walk zones (walkable
ground) produces a generic response like "This is just a waste of time" — likely
from a shared handler, not per-scene SCX. This may be hardcoded in the engine or
in GLOBAL.SCX.

**Scrolling confirmed**: x coordinates in hotspot data go up to 960 (3× screen
width). Walk commands use full-scene coordinates: `W,0,840,140`. The viewport
scrolls to follow Alex.

### WaltRoom — Safe Puzzle

Walter's room contains a safe with a two-part puzzle:

1. **Panda article word puzzle** (section 810–820): "Drag the words at the bottom
   of the screen to the right place." A Giant Panda article has blanks; the player
   drags words (`animals`, `China`, `not`, `eats`, `Nature`) to their correct
   positions (coordinates in section 920). Educational reading comprehension.

2. **Safe code**: `FEEDBIGBADDAD` (section 910). All letters A-F — looks like a
   hex code, mnemonic = "Feed Big Bad Dad." The safe contains Walter's ID card;
   the player must then forge it using glue + photo (SAFE.SCX sections 130/140).

Related flags: 1303 (safe opened), 1308 (left safe scene), 1309 (glue applied),
1310 (photo applied). Incorrect safe attempts → section 780: "You need the
correct code to open the safe."

### Photo — Phil the Photographer

Phil is a singing photographer NPC. His studio (PHOTO.SCX) is accessed from
StZoo. Getting a photo taken costs **50 Palmettoes** (the second-largest penalty).
The photo is needed to forge Walter's ID card in the safe puzzle.

**Phil's song** — he sings rhyming verses as sales patter:
- "I take pictures of the young! I take pictures of the old!" (SDPHIL2, 9.6s)
- "I take pictures when it's hot! I take pictures when it's cold!" (SDPHIL4, 9.9s)
- The voice audio contains additional lyrics not in the SCX text, including
  "I'm Phil the photographer, I'm blind as a bat" (per player memory).

**Grammar quizzes**: Two dialog puzzles with Phil:
- PHOTO 2010: "Do you @ pictures?" → choices: does/do/take/taking → "take"
- PHOTO 2025: "Okay! Okay! @ my picture!" → choices: Take/Do take/Takes/Taking → "Take"

Phil also appears via phone in **Room303** (section 2020–2030): "I'm Phil the
photographer! What can I do for you?" → word-ordering puzzle: "I want to make
an appointment" and "I'm on my way!" (flags 1107, 1551).

Audio resources: SDPHIL1 (8.3s), SDPHIL2 (9.6s), SDPHIL3 (3.9s), SDPHIL4
(9.9s), SDPHIL5 (3.3s) — the long clips are Phil's singing performances.

### Inventory system (GLOBAL.SCX)

GLOBAL.SCX is not a scene — it's the global inventory handler loaded alongside
every scene. Contains sections 10001+ with inventory item interactions.

**Structure**: Section 10001 is the dispatch table, listing each inventory item
with its handler section via `O` commands:
```
10001
0,0,O,PassportIcon,10002    ← using Passport → section 10002
0,0,O,LetterIcon,10004
0,0,O,ChocolateIcon,10005
...
```

**Handler pattern** (typical):
```
10002                         ← Passport handler
0,0,Y,1,10003                ← if already used, jump to 10003 (repeat message)
0,0,L,10510                  ← first-time message: "Hold on to your passport..."
0,0,X                         ← end/return
-1
```

**Commands in GLOBAL.SCX**:
- `O icon,section` — dispatch to item handler
- `Y 1,target` — conditional branch (if item already used → jump to repeat message)
- `L section_id` — display text from text section (10500+ range)
- `G icon,flag_id,value` — give/take inventory item + set flag
- `X` — end handler, return to game

**G command in interactive context** (40 uses across all files): `G,icon_name,flag_id,value`
- Adds or removes an inventory item
- Sets `flag_id` to `value` (or flag=0 means no flag change)
- Example: `G,BurgerIcon,1909,1` = receive burger, set flag 1909

### Scene object internals (from Ghidra decompilation)

The scene interpreter uses objects with ~50+ fields. Key offsets from Ghidra:

| Offset | Type | Field | Description |
|--------|------|-------|-------------|
| +0x02 | Word | x | X position |
| +0x04 | Word | y | Y position |
| +0x3a | Word | flags | Bit field: 0x01=refresh, 0x12=walk trigger, 0x100=direction, 0x200=reverse |
| +0x3c | Word | mode_flags | 0x100=goto-mode active |
| +0x55 | DWord | vmt_ptr | Virtual method table pointer |
| +0x67 | Byte | state_type | Command/state type (1-5) |
| +0x77 | DWord | walk_node | Pointer to circular linked list of walk path nodes |
| +0x375 | Byte | anim_type | Animation type (set by E command) |
| +0x36f | Word | delay | Delay/pause counter (set by F/P, decremented per tick) |
| +0x37a | Word | target_frame | Target frame (set by G command) |
| +0x37c | Word | current_frame | Current frame index |
| +0x37e | Word | total_frames | Total frame count (max) |
| +0x1383 | Word | t_mode | Large mode/state field written by animation `T` as `arg-1` |

**Animation command dispatch** (`FUN_1000_aac6`): Clean switch on command byte:
- **E** → set `anim_type` at +0x375
- **F** → increment frame counter, call vtable+0x50; if second arg nonzero, set delay counter
- **G** → set target frame at +0x37a, enable goto-mode (bit 0x100 in +0x3c); negative values wrap via +0x37e
- **L** → set absolute position (subtracts current X, then moves)
- **M** → relative move: add dx to +0x02, dy to +0x04
- **O** → call overlay function `0x167c6` with params (0, -1, arg)
- **P** → compute delay, store in +0x36f
- **T** → store `arg-1` at +0x1383

**Walk/advance handler** (`FUN_1000_a7e9`): Per-tick handler for animation:
1. If goto-mode (bit 0x100): return early
2. If delay counter nonzero: decrement and wait
3. Otherwise: advance frame (+1 or -1 based on direction flag at +0x3a & 0x200)
4. Copy coordinates from walk path linked list node
5. If current_frame == target_frame: clear goto-mode flag

**Walk path** uses a **circular linked list** of position nodes, navigated by
`FUN_1000_af3e`. Frame index wraps: negative → add total, > total → subtract total.
`F` duration and `P` delay both feed the same per-tick field at `+0x36F`.

Animation `T` is present in the animation dispatcher (`cmp al, 0x54` at 0xACEA)
and writes `(arg - 1)` into object field `+0x1383`. The exact meaning of that
field remains unclear.

---

## 3b. Walk / Pathfinding System

The walk system handles Alex's movement between positions within a scene. It is
**not a pathfinding system** — there is no A*, Dijkstra, or grid-based navigation.
The engine uses simple **line-of-sight direction picking** with a fixed walk cycle.

### W command

Format: `W,mode,x,y` in interactive SCX sections.

| Mode | Count | Description |
|------|-------|-------------|
| 0 | 269 | **Animated walk**: Alex walks toward (x,y) with sprite animation |
| 1 | 18 | **Instant teleport**: position set immediately, no animation |

W,1 is used only in interior/shop scenes (Airport, Butcher, Clothes, Super) where
animated walking would look awkward or cross obstacles.

### Walk delta table (ALEX1.SCX)

ALEX1.SCX contains the walk delta table: 8 directions x 9 frames of (dx, dy)
pixel deltas per walk cycle. The table encodes how Alex's position changes each
animation frame:

```
Direction 1 (down-left):  total (-24, +15) per cycle — frames 2,3,5,6 active
Direction 2 (down):       total (  0, +18) per cycle — frames 1-6 active (+3 each)
Direction 3 (down-right): total (+24, +15) per cycle — frames 2,3,5,6 active
Direction 4 (left):       total (-48,   0) per cycle — frames 3-6 active (-12 each)
Direction 6 (right):      total (+48,   0) per cycle — frames 3-6 active (+12 each)
Direction 7 (up-left):    total (-24, -15) per cycle — frames 2,3,5,6 active
Direction 8 (up):         total (  0, -18) per cycle — frames 1-6 active (-3 each)
Direction 9 (up-right):   total (+24, -15) per cycle — frames 2,3,5,6 active
```

Frames 0 and 8 are always (0,0) — standing still at cycle start/end. The 9th
entry (index 8) serves as the end-of-cycle sentinel (delta == 0 triggers
re-evaluation of direction).

### ALEXWALK sprites

62 sprites in ALEXWALK.NDX/DAT, named `ALEX{dir}-{frame}`:
- Directions 1-4, 6-9 (skip 5 = center) match the numpad compass layout
- 7-8 frames per direction (standing pose + walk cycle)
- Sprite sizes vary by direction: front-facing ~53x96, side ~60x93, back ~32x95

### Direction selection algorithm

The direction picker at `walk_message_handler` (1000:9C3B) uses **octant detection**
(atan2-like), not pathfinding:

1. Calculate `dx = target_x - current_x`, `dy = target_y - current_y`
2. If `dx == 0`: pick direction 2 (down, if `dy > 0`) or 8 (up)
3. Otherwise: compare `|dx|` vs `|dy|` magnitudes to determine one of 8 octants
4. Each octant maps to a numpad direction:
   ```
   7(up-left)    8(up)      9(up-right)
   4(left)       ·(center)  6(right)
   1(down-left)  2(down)    3(down-right)
   ```
5. Direction is **re-evaluated every walk cycle** (9 frames), so Alex adjusts
   heading as he approaches the target — creating smooth curved paths to diagonal
   targets

### Walk object fields

| Offset | Type | Field | Description |
|--------|------|-------|-------------|
| +0x02 | Word | x | Current X position (scene coordinates) |
| +0x04 | Word | y | Current Y position (scene coordinates) |
| +0x4B | Array | delta_table | Walk deltas: 8 directions × 9 frames × 2 bytes |
| +0x55 | DWord | vmt_ptr | Virtual method table pointer |
| +0x57 | Word | scroll_offset | Viewport scroll position |
| +0x1A1 | Byte | direction | Current walk direction (1-9, skip 5) |
| +0x1A2 | Byte | walk_phase | Walk state: 0=idle, 1=walking, 2=cycle complete, 0x11=stopping |
| +0x1A3 | Byte | frame_counter | Walk frame within current cycle (1-based) |
| +0x1A4 | Byte | dir_changed | Direction changed flag (triggers sprite switch) |
| +0x1A5 | Word | start_x | Walk start X (screen-adjusted) |
| +0x1A7 | Word | start_y | Walk start Y |
| +0x1A9 | Word | target_x | Walk target X (screen-adjusted, clamped to >= -60) |
| +0x1AB | Word | target_y | Walk target Y |
| +0x1AD | Word | angle_dx | Direction computation: delta X component |
| +0x1B3 | DWord | callback | Walk completion callback pointer |

### Walk lifecycle

```
SCX: "W,0,840,140"
  │
  ├─ Engine sends msg_type=5, subtype=0x3E8 to walk object
  │    walk_message_handler (1000:9C3B):
  │    ├─ +0x1A3 = 1 (start frame counter)
  │    ├─ Store target (840,140) in +0x1A9/+0x1AB
  │    ├─ Compare current pos vs target → pick direction (octant)
  │    ├─ Set +0x1A1 = direction, +0x1A4 = 1 (changed)
  │    └─ SCX execution BLOCKS (walk is asynchronous)
  │
  ├─ Per-tick updates:
  │    walk_step_with_scroll (1000:9B44):
  │    ├─ Calculate scroll offset via walk_calc_scroll_offset (1000:9685)
  │    ├─ Boundary check: if x > 260 → scroll right; if x < 60 → scroll left
  │    └─ Call walk_advance_frame (1000:9BAF):
  │         ├─ Increment +0x1A2 (frame within cycle)
  │         ├─ Index delta table: delta_table[direction * 18 + frame * 2]
  │         ├─ Apply (dx, dy) to position (+0x02, +0x04)
  │         ├─ If delta == 0: set +0x1A2 = 2 (cycle complete)
  │         └─ Call vtable+0x40 (update sprite display)
  │
  ├─ After each cycle (phase == 2):
  │    ├─ Re-evaluate direction (octant check against target)
  │    ├─ If new direction != old: switch sprite set, reset frame counter
  │    └─ If at target: walk complete
  │
  └─ Walk complete:
       ├─ +0x1A2 = 0 (idle)
       ├─ DS:0x3633 = 0 (global "walk in progress" flag cleared)
       ├─ Message type 0x0B dispatched
       ├─ If +0x1B3 (callback) non-null: call vtable+0x34
       └─ SCX execution RESUMES at next command after W
```

### Type A walk zone constraints

Type A click rectangles (configured via `0BCE:27A8` with param=1001) define
**blocking boundaries**, not walkable areas. They work as negative constraints:

1. **Hit test**: When Alex attempts to walk, the engine checks if the target
   position falls within any **enabled** Type A rect
2. **Blocking**: If a collision is detected, the walk is blocked or redirected
3. **Dynamic toggle**: The `B` command enables/disables block objects at runtime:
   - `B,WalkUpstairs,0` — disable block (allow passage)
   - `B,WalkUpstairs,1` — enable block (prevent passage)

Common block objects (51 unique names across all scenes):
- `*Block*` — wall/doorway barriers (e.g., HotelDoorBlock, RightWallBlock)
- `*Wall*` — scene-edge barriers (e.g., BackWallBlock, StreetWall)
- `RearWall` — elevator/back wall in Lobby

### Scripted walk patterns

**B+K pattern** (disable exits during walk):
```
0,0,B,WalkUpstairs,0     ← disable barrier
0,0,W,0,840,140          ← walk Alex to destination
0,0,B,WalkUpstairs,1     ← re-enable barrier
```
This prevents Alex from walking back through exits during scripted sequences.

**Walk → Direction → Dialog** pattern:
```
0,0,W,0,720,120          ← walk to NPC
0,0,D,9                  ← face up-right (toward NPC)
0,0,T,2010               ← start dialog
```
The D command sets facing direction independently of the walk direction.

### Viewport scrolling

Scrolling scenes (Airport=960px, St*=640px) use viewport tracking:
- `walk_calc_scroll_offset` (1000:9685) computes viewport position
- Boundary thresholds: x > 260 → scroll right; x < 60 → scroll left
- Stored in walk object at +0x57
- All coordinates (click rects, walk targets, objects) use scene-global coordinates;
  the engine subtracts viewport offset for rendering

### Relevant Ghidra functions

| Address | Name | Description |
|---------|------|-------------|
| 1000:9C3B | `walk_message_handler` | Main walk message dispatcher (direction picking, completion) |
| 1000:9BAF | `walk_advance_frame` | Per-frame delta application and cycle detection |
| 1000:9B44 | `walk_step_with_scroll` | Walk step + viewport scroll adjustment |
| 1000:94AB | `walk_load_delta_table` | Loads 8×9 delta table into walk object at +0x4B |
| 1000:9685 | `walk_calc_scroll_offset` | Computes viewport scroll offset from position |
| 1000:A286 | `walk_set_idle` | Sets walk phase to idle/stopping (0x11), calls vtable+0x40 |

---

## 3b. Main Event Loop and Section Dispatch

### Architecture overview

The engine uses a **message-based object system** with virtual method tables (VMTs).
All scene objects (sprites, hotspots, click rects, walk controller) share a common
base class with a VMT pointer at +0x55. The main loop is not a single function but
a **vtable-driven dispatch chain**: the runtime calls vtable methods on the scene
object each frame, and those methods process events, advance animations, and execute
SCX commands.

No direct INT 33h calls exist in the EXE — mouse input comes through a driver
library (likely loaded from DRIVERS.DAT) that posts events to the object system.

### Event flow (per frame)

```
scene_tick_update (1000:5601) [vtable method, called each frame]
  ├── Check +0x65 (scene active) and +0x5E (scene enabled)
  ├── If music object at +0x7F: call vtable+0x4C (music tick)
  ├── Call vtable+0x38 (hit test) on current scene
  ├── FUN_1000_5965 (read mouse state)
  ├── Check +0x1CF (cursor mode) against +0x1E0 (mode object)
  │   └── If changed: call vtable+0x38 on mode object
  ├── FUN_1000_00d2 (update cursor display)
  ├── FUN_1000_5b34 (check panel hover)
  ├── If inventory open: inventory_layout_grid (1000:732C)
  └── inventory_layout_update (1000:73AB)

scene_event_dispatcher (1000:5316) [vtable method, receives events]
  ├── event type 0x0C (12) = cursor mode change
  │   └── Updates +0x1CF count, stores cursor in +0x1B6 array
  ├── event type 0x02 (2) = mouse click
  │   ├── FUN_1000_5b34 (validate click area)
  │   ├── vtable+0x38 on +0x18F object (hit test against click rects)
  │   │   └── Returns: clicked object pointer or null
  │   ├── If hit: read section ID from click rect struct
  │   │   ├── +0x46 = look section, +0x48 = touch section, +0x4A = talk section
  │   │   └── Selection based on current cursor mode (+0x1E4)
  │   ├── Access +0x65 (scene name), +0x7F (sub-object) → vtable+0x4C
  │   └── Check +0x1E0 object → vtable+0x38 (secondary hit test)
  ├── event type 0x05 (5) = UI action
  │   ├── subtype 1 → click_handler_setup (1000:5006)
  │   ├── subtype 8 → interaction mode change (resets +0x1CF, rebuilds +0x1B7)
  │   └── subtype 4 → vtable+0x50 (direct action)
  ├── event type 0x64 (100) = custom/object event
  │   ├── Match +0x0C/+0x0E against +0x7D (event source filter)
  │   ├── If +0x1D2 == 0: click_handler_setup (1000:5006)
  │   └── If +0x1D2 != 0: scene_cleanup_objects + dispatch section +0x1D2
  └── event type 0x09 (9) = keyboard
      ├── key 0x0D (Enter) → push action (walk/interact)
      └── key 0x1B (Escape) → back/cancel action
```

### Section dispatch mechanism

When a click is resolved to a section ID (from the click rect's +0x46/+0x48/+0x4A
fields depending on cursor mode), the engine executes that section:

```
click_handler_setup (1000:5006)
  ├── Check global flag at [0x1547]
  ├── Read handler ID from +0x1D4 on scene object
  ├── Store scene pointer to globals [0x358A]/[0x358C]
  └── Store handler ID to global [0x29DF]
        ↓
scx_exec_section (1000:48BB)
  ├── Validate section exists, bounds-check section ID
  └── Call scx_interpreter_exec (1000:493E)
        ↓
scx_interpreter_exec (1000:493E)
  ├── Iterate command records in section buffer
  ├── For each record: check flag condition (flag_id, expected_value)
  ├── If condition met: dispatch command letter
  └── Call interactive_cmd_dispatch (1000:3D59)
        ↓
interactive_cmd_dispatch (1000:3D59) [vtable method]
  ├── Object type 5 (section reference):
  │   ├── subtype 0x14C3 (5315) → scx_exec_handler_section (exec only)
  │   └── subtype 0x04B2 (1202) → scx_exec_and_load_scene (exec + scene load)
  ├── Object type 9 (command record):
  │   ├── Check flags at +0x3A bit 0x01 (refresh needed)
  │   ├── Read command byte at +0x0C, convert to uppercase
  │   └── Dispatch on command letter:
  │       ├── I → scx_exec_and_load_scene (1000:3ACA) — scene transition
  │       ├── L → scx_dispatch_by_type(4) — display text section
  │       ├── T → scx_dispatch_by_type(3) — dialog command
  │       ├── F → func_0x8BA8 — set game flag
  │       └── * → scx_exec_handler_section (1000:3B9D) — generic
  └── Object type 2 (end-of-section marker):
      └── Check +0x3A flags, return
```

### Scene entry: which section runs first?

When a scene loads via `C,snAirport,110`:

1. `scx_exec_and_load_scene` (1000:3ACA) is called
2. It calls `scx_exec_section` (1000:48BB) with the specified section ID (e.g. 110)
3. Then calls `scene_load_wrapper` (1000:4BA4) → `scene_load_and_init` (1000:4459)
4. The scene init function in the OVR creates objects, hotspots, click rects
5. The entry section (110) executes setup commands: V (show sprites), A (start anims),
   W (walk Alex), B (toggle behaviors)
6. After entry section completes, the engine enters the event loop (vtable-driven)

For the first scene from main menu (no C command), the overlay code directly calls
the scene loading functions with a hardcoded scene name and entry section.

### Hit testing: how overlapping rects are resolved

The hit test (vtable+0x38) is called on the click rect container object at +0x18F.
Click rects are stored in a linked list. The hit test iterates the list and returns
the **first match** (front-to-back order, matching the registration order from the
OVR scene init function). Later-registered rects (higher layer) are checked first.

The cursor mode at +0x1E4 determines which field to read from the matched click rect:
- Mode 0 (look/eye) → field +0x46 (look section ID)
- Mode 1 (touch/hand) → field +0x48 (touch section ID)
- Mode 2 (talk/mouth) → field +0x4A (talk section ID)
- Mode 3 (walk/shoe) → walk handler (Type A/D rects)
- Mode 4 (bag/inventory) → field +0x44 (item-use section ID)

If the field value is 0, no handler exists for that mode on that object.

### Key function table

| Address | Name | Role |
|---------|------|------|
| 1000:5601 | `scene_tick_update` | Per-frame scene update (vtable) |
| 1000:5316 | `scene_event_dispatcher` | Event handler dispatcher (vtable) |
| 1000:5064 | `scene_tick_inner` | Inner tick processing |
| 1000:5006 | `click_handler_setup` | Prepares handler ID for execution |
| 1000:493E | `scx_interpreter_exec` | SCX command interpreter loop |
| 1000:48BB | `scx_exec_section` | Execute one SCX section by ID |
| 1000:3D59 | `interactive_cmd_dispatch` | Interactive command letter dispatcher |
| 1000:3ACA | `scx_exec_and_load_scene` | Execute section + load new scene |
| 1000:3B9D | `scx_exec_handler_section` | Execute section only (no scene load) |
| 1000:3D23 | `scx_dispatch_by_type` | Dispatch by numeric type code |
| 1000:4459 | `scene_load_and_init` | Load scene resources and init objects |
| 1000:4BA4 | `scene_load_wrapper` | Scene loading entry point |
| 1000:AAC6 | `animation_cmd_dispatch` | Animation command letter dispatcher |
| 1000:61F7 | `scene_cleanup_objects` | Destroy scene objects on transition |
| 1000:732C | `inventory_layout_grid` | Position inventory items in grid |
| 1000:9C3B | `walk_message_handler` | Walk system message processor |
| 1000:B9CC | `click_rect_set_coords` | Set click rect bounding coordinates |

### Global variables

| Address | Type | Name | Description |
|---------|------|------|-------------|
| 0x30A8 | DWord | scene_mgr_ptr | Pointer to scene manager object |
| 0x358A | DWord | current_scene_obj | Active scene object pointer |
| 0x29DF | Word | pending_section_id | Section ID queued for execution |
| 0x1547 | Byte | handler_active_flag | Non-zero when handler is running |
| 0x3564 | Byte | walk_mode | Current walk state |
| 0x3670 | Byte | music_enabled | Music playback flag |
| 0x2DA3 | Byte | sound_enabled | Sound effects flag |

---

## 4. Graphics Subsystem

### Display mode

VGA Mode 13h (320×200, 256 colors) based on:
- Full-screen backgrounds are 320×200 (64,004 bytes = 4 header + 64,000 pixels)
- Port I/O to 0x3C7/0x3C8/0x3C9 (VGA DAC registers) confirmed in decompiled code
- Palette values 0-63 (6-bit VGA DAC range)

### Scrolling scenes

Some scenes (Airport, all St* street scenes) are wider than 320 pixels. They use
multiple 320×200 background panels tiled horizontally:
- Airport: 3 panels (SNAIRPORT1-3) = 960×200, coordinates 0–960
- Street scenes: typically 2 panels = 640×200, coordinates 0–640

The viewport (320×200 window) scrolls to follow Alex. All object coordinates
(hotspots, click rects, walk targets) use full-scene coordinates. The engine
subtracts the viewport offset for rendering.

Close-up/dialog scenes use 320×180 (leaving 20px for the UI panel at bottom).
Dialog screens use the full 320×200.

### Sprite layering (pseudo-3D)

Sprites occlude each other based on display list order. The Airport "Arrivals"
sign hides Alex as he descends the escalator — confirming Z-order based on either
Y-position or explicit priority. Objects registered first (lower layer) are drawn
under objects registered later (higher layer).

### Palette management

Identified functions:
- `ReadPalette` (0x165F1): Reads 768 bytes from VGA port 0x3C9
- `WritePalette` (0x16608): Writes 768 bytes to VGA DAC
- `WaitRetrace` (0x165C4): Polls VGA status register (port 0x3DA, bit 3)
- `PaletteFadeRange` (0x16632): Fades palette range toward black by percentage
- `PaletteFadeIn` (0x166BE): Animated fade from black to target palette
- `PaletteFadeOut` (0x167B5): Animated fade to black

Fade animation runs at VGA retrace rate (~70 Hz), with 63/speed steps.

### Sprite rendering

Sprites are stored as raw VGA palette indices (1 byte per pixel, row-major).
Pixel value 0x00 appears to be transparent for overlay sprites.

The `post_transbig_1` and `post_transbig_2` functions (0x17772, 0x177BF) are blit variants
that marshal parameters and call `FUN_2000_7747` (the actual blitter, corrupted in Ghidra).

### Walk animation

ALEXWALK.DAT contains numbered animation frames for 8 directions:
- ALEX1-0 through ALEX1-7: Direction 1 = SW (down-left)
- ALEX2-0 through ALEX2-6: Direction 2 = S (down)
- ALEX3-0+: Direction 3 = SE (down-right)
- ALEX4-0+: Direction 4 = W (left)
- ALEX5-0+: Direction 5 = E (right)
- ALEX6-0+: Direction 6 = NW (up-left)
- ALEX7-0+: Direction 7 = N (up)
- ALEX8-0+: Direction 8 = NE (up-right)

Frame sizes vary slightly between directions (49×97, 53×96, 53×98, etc.).

**ALEX1.SCX** is NOT a scene — it's a walk delta table: 8 rows × 9 entries of (dx,dy) pairs
defining per-frame position deltas for each direction. Frames 0 and 8 are (0,0) = idle.
Examples: direction 4 (W) moves -12 pixels/frame; direction 2 (S) moves +3 pixels/frame.

**W command**: `W mode,x,y` where mode 0 = walk facing right (269 uses),
mode 1 = walk facing left (18 uses). Engine auto-selects actual walk direction from the
8-direction table based on angle from current to target position.

**D command** (interactive): Sets Alex's facing direction using an 8-direction compass grid:
```
7(NW)  8(N)  9(NE)
4(W)   [5]   6(E)      ← value 5 never used (center = no direction)
1(SW)  2(S)  3(SE)
```
This matches the ALEXWALK direction numbering (1=SW through 8=NE).

### Palmettoes (score/currency system)

The game starts with **100 Palmettoes**. The Palmettoes display uses `MoneyBox`
plus the `MONEY1-4` digit resources. `Meter` is a separate persistent UI bar
shown in the same panel, not the numeric money readout.

The `V,Meter,1` command in section 110 (Airport entry) shows the Meter UI
element. The `P` command modifies Palmettoes. All 14 `P`-command uses are
negative (penalties or costs). `SUSPICIONUP` (40,890 bytes PCM) is a nearby
panel resource, but its exact runtime tie to either Meter or Palmettoes is not
yet proven.

**Palmettoes can also increase** through correct dialog answers (e.g., cat dialog
in StripAir awards +10 per correct answer, 3 answers = +30 total). These rewards
are handled implicitly by the dialog system, not by explicit P commands.

**Total possible penalties across all scenes: -560**

| Scene | Penalties | Total |
|-------|-----------|-------|
| Airport | -15 (passport), -10 (bag) | -25 |
| Burger | -50, -10 | -60 |
| Butcher | -15, -10, -10 | -35 |
| LobbyDsk | -40 | -40 |
| Photo | -50 | -50 |
| StChoco | -10 | -10 |
| StHosp | -5 | -5 |
| StSuper | -10 | -10 |
| StZoo | -50 | -50 |
| Super | -275 | -275 |

The SCX corpus contains many dialog sections with answer templates, and later
content analysis identifies over a hundred quiz-style dialogs across the game.
The exact reward path is still engine-side, but the cat dialog shows that +10
rewards are real and not isolated.

**Balance**: Starting at 100 with -560 total possible penalties, the player
cannot survive hitting every penalty. In normal play this is offset by dialog
rewards, while the -275 supermarket penalty remains the most dangerous single loss.

**Rendering**: The meter works as a progress bar (METER background) with
numeric display (MONEY digit sprites overlaid). The MONEYBOX frames the number.

### Game flag system

9,952 flags stored as a bit array in save files (1,252 bytes at offset 0x000–0x4E3).
Flags are boolean (0/1) and organized by scene/area. 151 unique flag IDs observed
across all SCX files, all in range 1001–1921.

**Flag ranges by area:**

| Range | Area |
|-------|------|
| 1000–1017 | Airport |
| 1023–1056 | Hotel (Lobby, Corridor, Rooms) |
| 1100–1106 | Room 303 |
| 1120–1123 | Room 302 |
| 1140–1142 | Room 301 |
| 1151 | Clothes |
| 1201–1232 | Burger |
| 1301–1321 | Floor/WaltRoom/Safe/Aptment |
| 1401–1423 | Butcher |
| 1457–1478 | Super(market) |
| 1501–1503 | Ward |
| 1551–1558 | Photo |
| 1605–1611 | Zoo (LionCage, ZooBack) |
| 1651–1674 | Lift/Control |
| 1800–1818 | Streets (various) |
| 1824 | StripAir info dialog |
| 1840–1842 | Cat dialog completion |

Flags are set by:
- `F flag_id,value` commands in interactive sections (value: 1=set, 0=clear, -1=toggle?)
- Dialog completion (implicit, via `completion_flag` in dialog section headers)
- `G icon,flag_id,value` commands (inventory give/take + flag set)

Flag bit position in save file: `byte_offset = flag_id / 8`, `bit = flag_id % 8`.

---

## 5. Input System

### Interaction modes

The game has 5 cursor-based interaction modes, selectable from the UI panel:

| # | Mode | Cursor sprite | Size | Action |
|---|------|--------------|------|--------|
| 1 | Look | LOOKCURSOR | 24×13 | Examine object → narration text |
| 2 | Talk | TALKCURSOR | 24×14 | Talk to NPC → dialog tree |
| 3 | Touch | TOUCHCURSOR | 16×18 | Interact with object → handler |
| 4 | Walk | WALKCURSOR | 32×14 | Walk Alex to position (shoe-shaped cursor) |
| 5 | Bag | (inventory UI) | — | Select item, then use on object |

Plus: ARROWCURSOR (28×15) = default pointer, WAITCURSOR (4×4) = loading.
All 6 cursor sprites in MICE.NDX.

### Click rectangle dispatch

When the player clicks, the engine:

1. Hit-tests mouse (x,y) against registered click rectangles (up to 47 per scene)
2. Determines the click rect type (A–F, set during scene init from OVR)
3. Dispatches based on interaction mode × click rect type:

| Click rect type | Look (+0x46) | Touch (+0x48) | Talk (+0x4A) | Walk | Bag (+0x44?) |
|----------------|-------------|--------------|-------------|------|-------------|
| **A** (walk zone) | — | — | — | Walk to position | — |
| **B** (interactive) | text_ref section | interactive section | dialog section | walk to object? | item-use handler? |
| **C** (exit) | — | transition section | — | — | — |
| **D** (walk-to) | — | — | — | walk to (x,y) | — |
| **E** (special) | — | special handler | — | — | — |
| **F** (raw trigger) | — | paired C/D/E handler | — | — | — |

For **Type B** objects, the struct fields store which SCX section to execute for
each interaction mode:
- `+0x46` → Look: always a text_ref section (500+) → plays narration audio + shows text
- `+0x48` → Touch: interactive section (100-499) or text_ref (500+)
- `+0x4A` → Talk: dialog section. Only 33 uses, only in scenes with NPCs
  (Room303, Photo, Burger, StZoo, StChoco, Airport)
- `+0x44` → 87 uses, always with touch=110 (the "approach" handler). May be
  the item-use dispatch section

### Verified example: WaltRoom

16 click rects, 16 SCX interactive sections. Cross-referenced:

| Click rect | Type | Bounds | Look section | Touch section | SCX text |
|-----------|------|--------|-------------|--------------|----------|
| 9 | B | (270,75)-(300,125) | 660 | 190 | 660="Walter's pyjamas are on the couch" |
| 10 | B | (45,10)-(120,90) | 570 | 150 | 570="Behind this curtain there is a window" |
| 14 | B | (135,30)-(155,120) | 630 | 220 | 630="This is a birdcage. A parrot used to live here." |
| 0-1 | C | (0,176)-(120,200) | — | exit=230 | 230="C,snFloor4,170" (scene transition) |

Type A walk zones (7 rects) and Type C exits (2 rects) do NOT consume interactive
sections. The remaining interactive sections (110, 115, 120, etc.) are triggered
indirectly — through walk zone entry, conditional logic, or chained K commands.

### Hotspot naming

Click rects and hotspots share a naming system. Names are Pascal strings stored in
the overlay before each scene init function, referenced via `mov di, offset` +
`call far 1812:3C74` (strcopy). Many click rects are unnamed (especially Type A
walk zones); named ones include scene exits ("ToCaveMan", "FarToStButcher"),
interactive objects ("L-Stairs"), and special triggers ("FamilyBlock").

### Inventory

From decompiled function `FUN_1000_7300` (inventory grid layout):
- Items arranged in a 36-pixel grid
- First row starts at (140, 40), subsequent rows at (46, y)
- Items centered within 32×32 cells
- Grid wraps at x=280

When player opens the bag, inventory items display as a grid. Selecting an item
and clicking an object dispatches through GLOBAL.SCX section 10001 (O command
table). Per-scene item interactions may also dispatch through the +0x44 struct
field on Type B click rects.

ICONS.NDX contains inventory item sprites.
PANEL.NDX contains the UI chrome (buttons, windows, meter).

---

## 6. Object/UI Framework

### Object model

The engine uses Borland Pascal 7.0 objects with virtual method tables (VMTs).

From decompiled functions:
- Objects have flags at offset +0x3A (bit fields)
- Boolean state at offset +0x366
- Sub-objects at offsets +0x266, +699
- VMT dispatch through offsets +0x40, +0x50, etc.
- Linked lists via +0x2F/+0x31 (head) and +0x33/+0x35 (next)

### Event loop

From `FUN_1000_7B1A` (main UI event loop):
```
clear quit_flag
repeat
  walk UI element linked list
  for each element:
    dispatch to element's event handler (vtable)
    check if event was handled
  if element active:
    call draw method (vtable[6])
    call idle method (vtable[4])
until quit_flag or no elements
```

### Display list

Functions `FUN_1000_7DD3` and `FUN_1000_7E08` traverse a display list at globals
`0x2FF2`/`0x3FF2`, checking object types against `0x2C08` and calling paint methods
(vtable+0x14).

---

## 7. CD-ROM Access

From decompiled MSCDEX functions:
- `FUN_2000_76D4`: Check MSCDEX presence (INT 2Fh)
- `FUN_2000_76E0`: Get MSCDEX entry point
- `FUN_2000_76EE`: Get CD-ROM drive count/letter
- `FUN_2000_76FD`: MSCDEX function call
- `FUN_2000_780C`: Initialize CD-ROM access

The game requires MSCDEX for CD access. The CDROM drive letter comes from ALEX1.CFG.

---

## 8. Save/Load System

### Overview

The save/load system is implemented entirely in the OVR overlay, not the main
EXE. The settings panel is accessed via EXITBUTTON (door icon) and provides:

- **File list**: scrollable list of `*.GAM` files (scanned from game directory)
- **File name**: text input field for naming saves (DOS 8.3 format)
- **Load / Save / Quit / Play** buttons
- **Audio settings**:
  - "Speech & effects" volume slider (0–10 scale)
  - "Music On / Off" checkbox toggle
  - "Narration On / Off" checkbox toggle — controls whether text_ref narration
    audio (sdNar* resources) plays alongside the text popup
- **Play** returns to the game; **Quit** prompts "Do you really want to leave
  the game?" with a 3-button dialog

### OVR Code Layout

All save/load code resides in ALEX1.OVR at offsets `0x3BF32`–`0x3DBB8`.
CS base for string references: `0x3B78C`.

#### String table (OVR 0x3D365–0x3D425)

Pascal strings used by the UI constructor:
```
FileWindow, LoadBtn1, LoadBtn2, SaveBtn1, SaveBtn2,
QuitBtn1, QuitBtn2, PlayBtn1, PlayBtn2,
FileSlider, FileKnob, FileList, *.GAM,
UpArrow1, UpArrow2, DnArrow1, DnArrow2,
SpeechSlider, VolumeKnob, Music, Narrate
```

Also: `DialogBox`, `TextBtn1`–`TextBtn2` (for confirmation dialogs),
`sdTestWave` (volume test sound), `"Do you really want to leave the game?"`.

#### Function map (34 functions, OVR 0x3BF32–0x3DBB8)

| OVR offset | Frame | Purpose |
|------------|-------|---------|
| `0x3BF32` | 0x18 | **Scrollbar position handler** — calculates slider position from scroll state |
| `0x3C089` | 0x00 | **Scroll arrow click handler** — adjusts file list scroll by ±1 |
| `0x3C0F0` | 0x200 | **GameStateHandler** — scene init: copies two Pascal strings (scene name, resource path) to stack, calls `state_restore`, creates scene object via `0xBCE:3AE6`, sets flags `+0x3C |= 0x100`, clears `+0x77`/`+0x79` |
| `0x3C173` | 0x00 | **Settings tick handler** — animates slider knob position on each tick |
| `0x3C1EE` | 0x02 | **Settings event router** — dispatches events (type 1 = keyboard, type 2 = mouse) to appropriate handlers |
| `0x3C28A` | 0x12 | **Text button creator** — creates labeled buttons from `TextBtn1`/`TextBtn2` sprites at computed positions, spacing 0x44 px apart |
| `0x3C316` | 0x116 | **Dialog box builder** — creates `DialogBox` backdrop, click rect, and up to 3 text buttons (with conditional enabling) |
| `0x3C404` | 0x00 | **Dialog cleanup** — disposes dialog objects and calls `state_cleanup` |
| `0x3C427` | 0x00 | **Button selection handler** — stores selected button ID to `[0x1D27]`, sets `[0x355F]=1`, triggers scene transition |
| `0x3C457` | 0x02 | **Button click dispatcher** — loops through 4 button slots, compares clicked object name with slot names at `DS:[0x1D1D + slot*0xB]`, calls button selection handler on match |
| `0x3C4BB` | 0x106 | **Show dialog and wait** — creates dialog box, enters modal event loop (`lcall [0x30A4]`), sets visibility, returns selected button ID |
| `0x3C52D` | 0x108 | **File list item constructor** — creates a scrollable list entry (one save filename) with associated click rect |
| `0x3C597` | 0x00 | **File list cleanup** — disposes all file list items and calls `state_cleanup` |
| `0x3C5BA` | 0x00 | **File list click handler** — on click (event type 1), creates click rect and triggers scene transition to load the selected file |
| `0x3C61C` | 0x114 | **File list widget init** — creates the scrollable file list widget: sets up display area, calculates visible item count (`items_per_page`), computes scroll range, creates scroll track rect and slider knob |
| `0x3C86F` | 0x02 | **File list destructor** — frees all allocated file list entry objects (loops 1–255), then calls object cleanup |
| `0x3C8D4` | 0x100 | **Add file entry** — adds a filename (Pascal string) to the file list at position `[obj+0x57]++`, stores far pointer at `[obj + slot*4 + 0x5D]` via `0x147B:0609` (string duplicate) |
| `0x3C92C` | 0x02 | **Repaint visible items** — iterates visible items (1 to `items_per_page`), calls vtable+0x1C on each to trigger redraw |
| `0x3C986` | 0x08 | **Refresh file list display** — updates which items are visible based on scroll position (`start_index`), sets display text for each visible slot, highlights selected item (byte 0xF7 vs 0xA0 at entry+0x25D), repaints all |
| `0x3CAE1` | 0x00 | **Reset and refresh** — resets `item_count=0`, `selected=0`, `start_index=1`, then calls refresh |
| `0x3CB0A` | 0x00 | **Scroll event handler** — dispatches scroll commands: 0x148=up, 0x150=down, 0x149=page up, 0x151=page down, 0x147=home, 0x14F=end |
| `0x3CC38` | 0x02 | **File list/keyboard event dispatcher** — handles click events (type 5/0x0E = file click → navigate to entry), mouse events (type 0x0C → delegate to scroll handler), keyboard events (type 9 → map keys to scroll commands: 0x148/0x150/0x147/0x14F/0x149/0x151) |
| `0x3CD61` | 0x00 | **Navigate to entry** — scrolls list to bring entry N into view, clamps to valid range, updates `start_index` and `selected`, repaints, updates scroll knob position, highlights selected item |
| `0x3CEA0` | 0x00 | **Get selected filename** — copies the selected file list entry's name to output buffer (max 255 bytes) |
| `0x3CEE0` | 0x108 | **Find and select by name** — searches file list for entry matching given Pascal string name, navigates to it if found |
| `0x3CF82` | 0x0A | **Quicksort** — recursive quicksort of the file list entries by name. Pivot = random index, uses string comparison (`0x1812:3D65`), partitions and recurses on both halves |
| `0x3D0EC` | 0x302 | **Scan directory for *.GAM** — calls `0x168A:00B5` (FindFirst) then `0x168A:0106` (FindNext) in a loop, filtering by `*.GAM` pattern. For each match, extracts filename (stripping extension via `"."` search), adds to file list via `add_file_entry`. After scan, sorts the list with quicksort |
| `0x3D1D0` | 0x210 | **File list widget with filter init** — wraps `file_list_widget_init`, copies an additional filter/path string to `obj+0x4CC`, clears dirty flag at `obj+0x4CB` |
| `0x3D267` | 0x00 | **File list widget destructor wrapper** — calls file list destructor then state_cleanup |
| `0x3D289` | 0x00 | **Lazy file scan** — if dirty flag (`obj+0x4CB`) is 0, calls scan directory then sets flag=1. Then delegates to base event handler (`0xBCE:0B9D`) |
| `0x3D2BD` | 0x130 | **Scan directory** — saves cursor state, opens directory via `0x1788:0067` (DOS FindFirst `*.GAM`), loops calling `0x1788:00A5` (FindNext) while `[0x57E4]` (DOS error) is 0, strips extension, adds each entry, sorts result, restores cursor |
| `0x3D426` | 0x112 | **SaveLoadUI_Init** (1058 bytes) — the main settings panel constructor. Creates all UI widgets: FileWindow backdrop, LoadBtn1/2, SaveBtn1/2, QuitBtn1/2, PlayBtn1/2, FileSlider, FileKnob, FileList, UpArrow1/2, DnArrow1/2, SpeechSlider, VolumeKnob, Music toggle, Narrate toggle. Each button pair = normal + pressed sprite |
| `0x3D848` | 0x00 | **SaveLoadUI_Cleanup** — disposes UI objects and calls state_cleanup |
| `0x3D89D` | 0x200 | **SaveLoadUI_EventHandler** (795 bytes) — main event dispatcher for the settings panel. Handles: file list click (type 0x0C → get selected name), ESC key (0x1B), Enter (0x0C), Ctrl+S (0x10), Ctrl+N (0x11), Space (0x13) → button actions. **Button handlers**: Load (type 9) = calls `scan_directory` then `lcall [0x309C]` (load game), Save (type 10) = calls `lcall [0x30A0]` (save game) then stores `[0x358A]` (current scene obj). Quit (type 5) = "Do you really want to leave the game?" dialog → `0x153D:0026` (exit). Volume (type 0x65) = updates `[0x2DA4]` sound driver or `[0x382F]`/`[0x2D7C]` volume vars. Play (type 1) = stores `[0x358A]` and returns |

### Save/Load Mechanism

The actual save and load operations use **indirect far calls** through global
function pointers, not direct OVR code:

- **Load**: `lcall [0x309C]` — dereferences the far pointer at DS:0x309C
- **Save**: `lcall [0x30A0]` — dereferences the far pointer at DS:0x30A0

These pointers are set during engine initialization (in the main EXE), pointing
to the serialization routines that dump/restore the complete object list. The
OVR overlay code handles only the UI (file selection, button dispatch) and file
scanning (FindFirst/FindNext `*.GAM`). The actual state serialization lives in
the main EXE's object framework.

### Serialization Format

The save file is a **raw memory dump** of every game object's struct. Each
object record in the `.GAM` file is the object's in-memory representation
written byte-for-byte, including:
- Screen pixel coordinates (X, Y at +33/+35)
- Visibility state (+39)
- Sprite/animation state (bytes between name and +33)
- Game-relevant fields (slot IDs, handler values)

This is why the Meter object stores its Y-pixel position (180) rather than a
gameplay value — the engine doesn't distinguish between layout data and game
state. It serializes every object's complete struct in one pass.

### File Scanning

`func_3d2bd` (scan directory) performs:
1. Open cursor (`0x1788:0067`)
2. Call FindFirst for `*.GAM` pattern (`0x1788:00A5` loop while `[0x57E4]==0`)
3. For each match: strip `.GAM` extension (search for `"."` character),
   add base name to the file list widget
4. Sort entries alphabetically (quicksort at `0x3CF82`)
5. Restore cursor

Filenames are DOS 8.3 format. The game creates saves with user-typed names.
`AlexSave.TMP` is a separate temp file created at startup.

**Live reload**: Since DOSBox mounts the host directory, overwriting `.GAM`
files on the host takes effect immediately — the next Load reads the new data.

### Key Indirect Calls

| Address | Purpose |
|---------|---------|
| `[0x309C]` | Load game — reads `.GAM` file, deserializes object list |
| `[0x30A0]` | Save game — serializes object list, writes `.GAM` file |
| `[0x30A4]` | Modal event loop — enters blocking wait for user input |
| `[0x358A]` | Current scene object pointer (stored on Load/Play) |
| `[0x355F]` | Dialog-active flag (set to 1 when button selected) |
| `[0x57E4]` | DOS error code (0 = success, from FindFirst/FindNext) |
| `[0x2DA4]` | Sound driver present flag |
| `[0x382F]` | Volume level (raw) |
| `[0x2D7C]` | Volume level (halved, for hardware) |

### UI Layout Constants

The settings panel uses these fixed coordinates:
- File list widget: positioned at (0xAB, 0x2A) = (171, 42)
- Save buttons: (0xAB, 0x46) = (171, 70)
- Quit buttons: (0xAB, 0x69) = (171, 105)
- Button text spacing: 0x44 (68) pixels vertical between button rows
- Dialog box: positioned at (0x3C, 0x1E) = (60, 30)
- Scroll commands: Up=0x148, Down=0x150, PgUp=0x149, PgDn=0x151, Home=0x147, End=0x14F

### Save file layout

1. **Flag bit array** (0x000–0x4E3, 1252 bytes): 9,952 boolean game flags,
   `flag_id = byte_offset × 8 + bit_position`
2. **Scene name** (0x4E4): Pascal string, e.g., `snAirport`
3. **Scene objects**: variable-count records, each with a Pascal-string name and
   property bytes — includes scene-specific sprites, NPC state, and positions
4. **UI panel objects**: always present — Panel, Score, **MoneyBox** (stores
   Palmettoes as u32 LE, appears twice), Money, **Meter** (Y-position fields:
   +35=180 is panel Y, +41=200 is Y-max; NOT gameplay values)
5. **Inventory icons** (24 items, slots 501–524, always present)
6. **Current scene name** (repeated at end)

See `SAVE_FORMAT_DETAILS.md` for the complete field-level specification.

### Complete inventory

24 inventory items (slot IDs 501–524):
```
Passport(501), Letter(502), Coupon(503), ZooCoupon(504), Chocolate(505),
Credit(506), Key303(507), Pin(508), DrawerKey(509), Glue(510), Burger(511),
Drink(512), Egg(513), Envelope(514), Beef(515), Hotdog(516), Notebook(517),
Photo(518), Milk(519), Peanut(520), IDCard(521), ZooTicket(522),
Hammer(523), Brain(524)
```

Acquired items (visibility=1) need X,Y coordinates in the 3×3 bag grid:
```
     Col 0    Col 1    Col 2
Row 0 (142,45) (176,45) (210,45)
Row 1 (142,79) (176,79) (210,79)
Row 2 (142,113)(176,113)(210,113)
```

---

## 9. Sound System

Sound resources are stored as raw unsigned 8-bit PCM in SD*.DAT files (no COMP header).
Byte 0x80 = silence. Likely played at 11025 Hz or 22050 Hz.

Sound resource naming convention: `sd{Speaker}{Number}` (e.g., sdOldM6, sdNar91).

---

## 10. Music System

29 CTMF music tracks are stored in PANEL.NDX/PANEL.DAT as MUSIC1–MUSIC29.

### Scene-to-track assignment

The master scene setup function at OVR offset 0x996 creates 36 scene descriptors.
Each descriptor passes a music track number as the 4th parameter to the scene
constructor at `08BB:2624`. At scene init time, the track number is read from
descriptor field `+0x7E`, converted to a string, concatenated with `"Music"`,
and passed to the music-play routine at `10E8:0555`.

### Track mapping

| Track | Resource | Scenes |
|-------|----------|--------|
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

Track 12 is the street theme, shared by all eight street scenes. Tracks 2, 5, 11,
17, 23, and 28 are unused — present in the DAT but never referenced by any scene
descriptor. Prison and Death scenes use a different constructor (`00B5:002F`) that
takes no music parameter, so they play in silence.

---

## 11. Global Variables

| Address | Type | Name | Description |
|---------|------|------|-------------|
| DS:0x2E6E | Word | GameActiveFlag | 0 = inactive, nonzero = active |
| DS:0x2FB0 | DWord | WorkingFileHandle | Current file handle for I/O |
| DS:0x2FFA | Word | MoneyObjectPtr | Likely offset half of the global Palmettoes object pointer; used by the signed money helper at `0x3763` |
| DS:0x2FFC | Word | MoneyObjectSeg | Likely segment half of the global Palmettoes object pointer |
| DS:0x361E | DWord | DialogObjectPtr | Live dialog/talk object pointer used by reward/completion paths |
| DS:0x3626 | DWord | ActiveUIObjectPtr | Likely active UI element pointer; methods `+0x08/+0x0C` are called on it in UI event loops |
| DS:0x3633 | Byte | QuitFlag | Nonzero = exit event loop |
| DS:0x400A | Byte | DisplayMode | Current display/rendering mode |
| DS:0x50EF | Array | TransBigRecords | 10 × 137-byte resource slot array |
| DS:0x56D2 | DWord | TransBigFileHandle | Trans.BIG file variable pointer |
| DS:0x56D6 | Byte | CurrentActiveSlot | Active resource slot (1-10) |
| DS:0x56D7 | — | (KeyTableBase) | Base for 1-indexed key access |
| DS:0x56D8 | Byte[255] | XorKeyTable | 255-byte XOR decryption key |
| DS:0x57DE | DWord | MSCDEXEntryPoint | MSCDEX driver entry point |

---

## 12. Borland Pascal 7.0 Runtime

### System unit (at file offset 0x1B189)

| Function | File Offset | Description |
|----------|-------------|-------------|
| Assign | 0x1B46F | Assign filename to file variable |
| Reset | 0x1B4ED | Open file for reading |
| I/O Dispatcher | 0x1B583 | Dispatch I/O through FileRec function pointers |
| BlockRead | 0x1B594 | Read block of data from file |
| BlockWrite | 0x1B5C4 | Write block of data to file |
| Close | 0x1B609 | Close file |

### Inline dispatch mechanism

The BP7 compiler uses `AA XX XX` inline data blocks in the code stream to dispatch
to runtime I/O procedures. These are NOT real x86 instructions — they encode:
- `AA XX XX 6F 7E/8E` (5 bytes): I/O procedure call with error handler
- `60 AA XX XX 6F 7E/8E` (6 bytes): Procedure call (saves registers)
- `67 AA XX XX 6F 7E/8E` (6 bytes): Function call (returns value)
- `F7 A9 XX XX` (4 bytes): LEA DI equivalent (load stack variable address)

Additionally, procedure call stubs use a different inline pattern:
- `B1 XX YY YY CE 0B` (6 bytes): 237 occurrences. XX = call type
  (0x1c: 187 calls, 0x9a: 46 calls, 0x2c: 4 calls), YYYY = target reference.
  These encode external/runtime procedure calls resolved by BP7 startup code.
  They are absent from the pre-decompression image (generated during LZSS unpack)
  and cannot be resolved statically — the EXE has zero MZ relocation entries.
  The X and Y animation command handlers both use this mechanism.

All of these mechanisms break standard disassemblers and decompilers. Ghidra produces
garbage output for any function containing these patterns.

### Key dispatch addresses

| Dispatch | Role | Call sites |
|----------|------|------------|
| 0x39B3 | BlockRead | 34 |
| 0x3A1B | Seek | 7 |
| 0x3949 | Close | 9 |
| 0x38C8 | Reset/Open | 7 |
| 0x4634 | FilePos | 1 |
| 0x6E74 | String Concat | 32 |
| 0x6EF3 | Chained Concat | 38 |
| 0x6E8E | String Copy | 58 |
| 0x3D90 | ByteToStr | 16 |
| 0x46E4 | Assign/Init | 11 |
| 0x04ED | Error check | 7 |

---

## Function Map

232 functions identified in the unpacked binary. Key function groups:

| Address Range | Count | Subsystem |
|---------------|-------|-----------|
| 0x00D2-0x0B96 | ~10 | Entry/initialization |
| 0x0C40-0x12E8 | ~10 | Object framework (TRect, etc.) |
| 0x13C4-0x1816 | ~5 | UI chrome/layout |
| 0x338E-0x3EF8 | ~15 | String handling, game logic |
| 0x4459-0x5316 | ~20 | Scene interpreter core |
| 0x5601-0x5B4B | ~8 | Animation system |
| 0x61F7-0x6975 | ~15 | Resource management |
| 0x6B40-0x6FBA | ~10 | File I/O, NDX parsing |
| 0x7210-0x7EB3 | ~15 | UI event loop, display list |
| 0x809F-0x8EFE | ~15 | Game state, inventory |
| 0x8F48-0x9C3B | ~10 | Dialog system |
| 0xA286-0xB9CC | ~15 | Scene commands |
| 0xBAE1-0xCFFC | ~20 | Graphics rendering |
| 0xD02C-0xDEB0 | ~15 | Mouse/hotspot handling |
| 0xE290-0xFE91 | ~20 | Walk system, pathfinding |

(Address offsets within segment 1000. Segment 2000 contains overlay + runtime support.)
