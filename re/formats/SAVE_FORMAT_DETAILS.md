# GAM Save File Format

## Overview

Alex Palm Island saves game state to `.GAM` files with arbitrary names (the
game scans `*.GAM` to populate the load menu). Filenames must follow DOS 8.3
convention. Each file stores the complete game state: global flags, current
scene, and all object states including UI elements, inventory, and scene-
specific objects.

`ALEXSAVE.TMP` is a screenshot thumbnail (0 bytes in samples -- may only exist
during active gameplay).

**Live file reads:** The game reads `.GAM` files from disk on demand. Under
DOSBox with a mounted host directory, overwriting a `.GAM` on the host takes
effect immediately without restarting DOSBox — the next Load will read the
new data.

## File Layout

```
Offset   Size      Description
------   --------  -----------
0x000    1252      Bit flag array (9,968 flag positions)
0x4E4    35        Scene header (Pascal string + state)
0x507    variable  Object state records (to EOF)
```

Total file size varies by scene complexity: 4,474 to 5,668 bytes observed.

## Section 1: Flag Bit Array (0x000 - 0x4E3)

1,252 bytes = 10,016 bit positions (bytes 0-1251, 8 bits each).
Each bit represents a global game flag (quest progress, visited locations, etc.).

Observed flag positions across 5 saves:
- Flags 1001, 1004-1005, 1008-1011: Set after initial Airport scene
- Flag 1824: Set after reaching StripAir
- Flags 1840-1842: Set progressively during gameplay

Most bytes are 0x00. Only bytes at 0x7D-0x7E (flags ~1000) and 0xE4-0xE6
(flags ~1824+) are observed to be non-zero in early game saves.

## Section 2: Scene Header (0x4E4 - 0x506)

35 bytes total, fixed position. Contains the current scene name and scene state.

```
Offset  Size  Description
------  ----  -----------
0x4E4   1     Scene name length (Pascal string length byte)
0x4E5   N     Scene name (ASCII, e.g. "snStripAir", "snAirport")
0x4E5+N var   Scene state data (fills remainder of 35 bytes)
```

The scene header content is duplicated in the trailing scene state record
(the last object record in the file).

## Section 3: Object State Records (0x507 - EOF)

Object records start at the fixed offset 0x507. Records are stored sequentially
with no gaps or alignment padding between them.

### Record Order

Records appear in a fixed order:
1. **Scene-specific objects** -- vary by current scene (characters, doors, blocks, etc.)
2. **Global UI objects** -- always present, always in this order:
   - NoMap, NoBag (UI state toggles)
   - ExitButton, TouchButton, LookButton, TalkButton, WalkButton, MapButton, CaseButton (cursor buttons)
   - Panel (bottom UI bar)
   - Score (score display frame)
   - Score text record (e.g. " 105") -- rendered digit bitmaps + Palmettoes value
   - MoneyBox, Money, Meter (economy/status)
   - 24 inventory icons (BrainIcon through PassportIcon, descending slot IDs 524-501)
3. **Trailing scene record** -- duplicates scene header with extended state

The global section always contains exactly 40 records.

### Record Sizes

Records are variable-length. The base size is 60 bytes, with extensions for
objects that need additional state:

| Size | Count | Description |
|------|-------|-------------|
| 60   | most  | Base record: simple objects, buttons, icons, blocks |
| 62   | 2     | Backdrop (+ scroll offset), Score (+ display state) |
| 64   | 1     | Trailing scene state record |
| 65   | 1     | ALEX player character (+ x, y, direction) |
| 69   | varies| Interactive objects with click handler data |
| 74   | varies| Complex scene blocks (+ boundary coordinates) |
| 126  | rare  | PolyFamily (Airport scene, extended animation) |
| 267  | 1     | Score text: digit bitmap data + Palmettoes value |

### Base Record Fields (60 bytes)

The name is a variable-length Pascal string at the start of the record.
Fields at fixed offsets from the record start are structured data.
Bytes between the name end and the first fixed field (offset ~33) contain
visual/animation state data that overlaps with the name buffer.

```
Offset  Size  Type   Description
------  ----  ----   -----------
0       1     u8     Name length (N)
1       N     ASCII  Object name
1+N     ...   bytes  Visual/animation state (path data, sprite refs, etc.)
33      2     u16LE  X position (pixel) — inventory icon X in bag grid
35      2     u16LE  Y position (pixel) — inventory icon Y; Meter Y=180
37      2     u16LE  Field C (flags/sub-state)
39      1     u8     Visibility/type (see below)
40      1     u8     Sub-type
41      2     u16LE  Field D — Meter: Y-max=200; MoneyBox/Panel: 9999 (0x270F)
43      8     bytes  Additional state (zeroed for most records)
51      2     u16LE  Inventory slot ID (for Icon records; 0 for non-inventory)
53      7     bytes  Trailing data (usually zeroed)
```

### Visibility Byte (Offset +39)

| Value | Meaning |
|-------|---------|
| 0     | Hidden / inactive |
| 1     | Visible / active |
| 3     | Player character (ALEX only) |
| 4     | Inventory slot (not yet acquired) |
| 5     | Special state (FamilyBlock) |

### Inventory Icon Positioning

Inventory icons (24 records, slots 501-524) use a 3×3 grid inside the bag
overlay. When an item is **not acquired** (visibility=4), its X/Y at +33/+35
are both 0. When **acquired** (visibility=1), the X/Y must be set to valid
grid positions or the icon renders at (0,0) in the top-left corner.

Observed bag grid positions (pixels, relative to bag coordinate space):

```
         Col 0    Col 1    Col 2
Row 0   (142,45) (176,45) (210,45)
Row 1   (142,79) (176,79) (210,79)
Row 2   (142,113)(176,113)(210,113)
```

Column spacing: 34px. Row spacing: 34px. The top-left ~1/6 of the bag area
is covered by the bag image itself, so Col 0 items partially overlap it.

### Meter/Panel Positioning

The Meter record's +35 and +41 fields are **Y-position** data, not
value/max as initially assumed. All 5 sample saves have Meter +35=180,
+41=200 regardless of game progress. Patching +35 to a low value moves
the panel display to the top of the screen.

### Extended Records

**ALEX (65 bytes):** Base + 5 bytes at offsets 60-64:
```
+60  u16LE  Player X position (pixel)
+62  u16LE  Player Y position (pixel)
+64  u8     Direction/facing (1=left, 4=down, 7=right, etc.)
```

**Backdrop (62 bytes):** Base + 2 bytes at offset 60:
```
+60  u16LE  Horizontal scroll position (pixels from left edge)
```
Values observed: 320 (StripAir), 960 (Airport full width), 0 (StApart)

**Interactive objects (69 bytes):** Base + 9 bytes at offsets 60-68:
```
+60  1  u8     Extra type/count
+61  2  u16LE  Reserved (always 0)
+63  1  u8     Reserved (always 0)
+64  1  u8     Marker (always 0x03)
+65  2  u16LE  Sub-handler ID
+67  2  u16LE  Sub-handler value
```

**Scene state (64 bytes):** Base + 4 bytes at offsets 60-63.
Contains extended scene position/state data.

**Score text (267 bytes):** The record name IS the displayed score text
(e.g. " 105", "  75", " 100"). The data area contains pre-rendered digit
bitmaps (palette indices 0x00, 0x03, 0x81, 0xa1, 0xc1) and the Palmettoes
value stored numerically:
```
+259  u32LE  Palmettoes amount (current money)
+263  u32LE  Palmettoes amount (duplicate)
```

## Key Values: Where to Find Game State

### Palmettoes (Money)

The current Palmettoes amount is stored in three places:
1. Score text record name (formatted string, e.g. " 105")
2. Score text record offset +259 (u32 LE, numeric value)
3. Score text record offset +263 (u32 LE, duplicate)

MoneyBox offset +41 stores the maximum possible value (9999).

### Meter

- Meter offset +35: current value (e.g. 180)
- Meter offset +41: maximum value (200)

### Player Position

- ALEX record offset +60: X position (u16 LE)
- ALEX record offset +62: Y position (u16 LE)
- ALEX record offset +64: direction (u8)

### Scene Scroll

- Backdrop offset +60: horizontal scroll position (u16 LE)

### Inventory

Each inventory item is an "Icon" record (60 bytes) with:
- Visibility byte (+39): 1 = acquired/carried, 4 = not yet acquired
- Slot ID (+51): unique u16 identifier (501-524)

24 possible inventory items (slot IDs 501-524):
```
501 Passport     513 Egg
502 Letter       514 Envelope
503 Coupon       515 Beef
504 ZooCoupon    516 Hotdog
505 Chocolate    517 Notebook
506 Credit       518 Photo
507 Key303       519 Milk
508 Pin          520 Peanut
509 DrawerKey    521 IDCard
510 Glue         522 ZooTicket
511 Burger       523 Hammer
512 Drink        524 Brain
```

## Observed Save Samples

| File  | Size  | Scene      | Palmettoes | Flags | Scene Objects | Acquired Items |
|-------|-------|------------|------------|-------|---------------|----------------|
| 1.GAM | 5,668 | snAirport  | 100        | 0     | 26            | Letter, Passport |
| 2.GAM | 5,668 | snAirport  | 75         | 7     | 26            | Letter, Passport |
| 3.GAM | 4,474 | snStripAir | 75         | 8     | 9             | Letter, Passport |
| 4.GAM | 4,474 | snStripAir | 105        | 11    | 9             | Letter, Passport |
| 5.GAM | 5,060 | snStApart  | 105        | 11    | 18            | Letter, Passport |

## Parser Tool

See `re/parse_save.py` for a Python parser that can:
- Display save file summary (scene, palmettoes, meter, record counts)
- List all object records with types and key fields
- Show inventory items and acquisition status
- Show set flag bit positions
- Compare two save files byte-by-byte
- Hex dump individual records

Usage:
```
python3 re/parse_save.py re/save_samples/4.GAM
python3 re/parse_save.py --flags re/save_samples/4.GAM
python3 re/parse_save.py --inventory re/save_samples/4.GAM
python3 re/parse_save.py --compare re/save_samples/3.GAM re/save_samples/4.GAM
python3 re/parse_save.py --hex re/save_samples/4.GAM
```
