# Alex Palm Island — File Format Specification

All formats reverse-engineered from the 1996 game by Onda Publications / Eric Cohen Edutainment.

---

## NDX — Resource Index (36 bytes/record)

Fixed-size records mapping named resources to offsets in a DAT file.

| Offset | Size | Type   | Field    | Description |
|--------|------|--------|----------|-------------|
| 0      | 1    | u8     | namelen  | Pascal string length (max 19) |
| 1      | 19   | char[] | name     | Resource name, zero-padded |
| 20     | 2    | u16 LE | type     | Resource type (see below) |
| 22     | 2    | u16 LE | pad1     | Always 0 |
| 24     | 2    | u16 LE | pad2     | Always 0 |
| 26     | 2    | u16 LE | stride   | Resource size (low word) |
| 28     | 4    | u32 LE | flag     | High word of size for sounds; else 0 or 1 |
| 32     | 4    | u32 LE | offset   | Byte offset into decompressed DAT content |

**Resource types:**
- `0x0100` (256) — Graphics: sprites, backgrounds, animations
- `0x0200` (512) — Sound: raw unsigned 8-bit PCM audio
- `0x0400` (1024) — Palette: always 768 bytes (256 × 3 RGB)
- `0x0500` (1280) — Cursor with palette (rare, MENU.NDX only)

**Size calculation:**
- For type 0x0200 (sound): `actual_size = flag * 65536 + stride` (32-bit size)
- For all others: `actual_size = stride`

**Key properties:**
- Records sorted alphabetically by name, NOT by offset
- Offsets point into decompressed DAT content (after COMP decompression)
- `max(offset + size)` across all records = exact decompressed DAT size
- Contiguous packing within resource groups (no gaps between consecutive resources)

**File count:** 101 NDX files, 5,898 total entries across all files.

---

## DAT — Resource Data

Three variants exist:

### COMP-compressed DAT (graphics/mixed)

| Offset | Size | Type   | Field | Description |
|--------|------|--------|-------|-------------|
| 0      | 4    | char[] | magic | "COMP" (0x43 0x4F 0x4D 0x50) |
| 4      | 4    | u32 LE | size  | Total decompressed size |
| 8      | ...  | chunks | data  | One or more compressed chunks |

**Chunk header (5 bytes):**

| Offset | Size | Type   | Field      | Description |
|--------|------|--------|------------|-------------|
| 0      | 2    | u16 LE | decomp_sz  | Chunk decompressed size (includes 4-byte overhead) |
| 2      | 1    | u8     | method     | 0 = uncompressed, 1 = compressed |
| 3      | 2    | u16 LE | comp_sz    | Chunk compressed data size |

**Compression tokens (method=1):**
- `0xFF <len:u8> <offset:u16 LE>` — Copy `len` bytes from absolute position `offset` in output
- `0xFE <len:u8> <byte:u8>` — Repeat `byte` for `len` times (RLE)
- Any other byte — Literal (emit as-is)

First 4 decompressed bytes of each chunk are overhead (always 00 00 00 00) and must be discarded.

### Sound DAT (SD*.DAT)

No header. Raw unsigned 8-bit PCM audio data, generally at 22050 Hz. NDX offsets point directly into the file. Byte 0x80 = silence. One known exception: the NARRATOR resource in SPYMASTR.DAT plays at 11025 Hz.

### ALEX1.DAT (installed to hard disk)

Not encrypted. Despite earlier claims, the CD copy, installed copy, and game_decrypted copy are byte-identical — no XOR 0x80 transformation is needed. NDX offsets apply directly. First 5,719 bytes are zero padding.

---

## Sprite Format (within decompressed DAT)

| Offset | Size | Type   | Field  | Description |
|--------|------|--------|--------|-------------|
| 0      | 2    | u16 LE | width  | Sprite width in pixels |
| 2      | 2    | u16 LE | height | Sprite height in pixels |
| 4      | w×h  | u8[]   | pixels | VGA palette indices, row-major |

Pixel value 0x00 = transparent (for cursors and overlaid sprites).

---

## Palette Format (within decompressed DAT)

768 bytes: 256 colors × 3 bytes (R, G, B). Values 0–63 (VGA DAC 6-bit range).
Multiply by 4 to convert to 8-bit RGB.

---

## Font Format (within ALEX1.DAT)

4 font resources: MAINFONT, SMALLFONT, DIGITALFONT, BABYDIGIFONT.

### Header (260 bytes)

| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0 | 1 | u8 | start_char | First character code (typically 32) |
| 1 | 1 | u8 | end_char | Last character code (typically 127) |
| 2 | 1 | u8 | max_width | Maximum character width in pixels |
| 3 | 1 | u8 | height | Character height in pixels |
| 4 | 256 | u8[] | widths | Per-character width table (index = char code) |

### Per-character bitmaps

After the 260-byte header, characters from `start_char` to `end_char` are stored sequentially:

| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0 | 2 | u16 LE | char_h | Character height (usually = header height) |
| 2 | 2 | u16 LE | char_w | Character width (matches widths[char_code]) |
| 4 | h×w | u8[] | pixels | VGA palette indices, row-major |

### Known fonts

| Name | Chars | Max width | Height |
|------|-------|-----------|--------|
| MAINFONT | 32–127 | 14 | 18 |
| SMALLFONT | 32–127 | 10 | 13 |
| DIGITALFONT | 32–127 | 16 | 20 |
| BABYDIGIFONT | 32–127 | 8 | 10 |

---

## CTMF — Music Files (within ALEX1.DAT)

29 music resources in ALEX1.DAT use Creative Technology Music File format (CTMF / Creative Music File).
These are AdLib/OPL2 FM synthesis compositions, identifiable by the "CTMF" magic at offset 0.

| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0 | 4 | char[] | magic | "CTMF" (0x43 0x54 0x4D 0x46) |
| 4 | 2 | u16 LE | version | Format version (typically 0x0101) |
| 6 | ... | ... | ... | Instrument definitions + note data |

The game also contains 3 raw PCM sound resources in ALEX1.DAT alongside the CTMF files.

---

## SCX — Scene Script

Text-based scene scripts, XOR-encrypted on disc.

### Binary structure
| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0      | 1    | u8   | header | Always 0xC0 |
| 1      | ...  | text | body   | Sections separated by 0xFE delimiter |

Sections are separated by `0xFE` bytes. Each section starts with a section ID line, followed by command lines terminated by `\r\n`.

### Encryption
XOR with 255-byte cycling key extracted from TRANS.BIG chain. Key index: `key[i % 255]` for byte position i.

### Section types

**Interactive sections (ID 100–499):** Comma-separated records with conditional commands.
```
110
1900,1,K,120           ← if flag 1900 == 1, jump to section 120
0,0,V,Open2,1          ← unconditional: show object "Open2"
0,0,V,BPhone,1
0,0,A,0,Phone,0        ← animate object "Phone"
0,0,C,snOpen2,100      ← play sound "snOpen2"
-1                      ← end of record list
```
Record format: `pre1,pre2,CMD,arg1,arg2,...`
- `pre1` = flag ID to test (0 = unconditional). All non-zero values are in range 1001–1921.
- `pre2` = expected value (0 or 1). Command executes if `flag[pre1] == pre2`.
- `CMD` = single letter command (see below).
- `-1` terminates the record list.

**Zoom/read sections (type 4):** Close-up display of an object. 79 across all files.
```
520,4,0                            ← section 520, type 4, param 0
HotelAd,2                          ← object name, frame/variant
```
Used for signs, posters, items on shelves (e.g., SUPER.SCX has 19 product close-ups).

**Text reference sections (ID 500–999):** Text + sound pairing.
```
510,1,sdNar91
This is a coupon. Take it!
```
Format: `section_id,type,sound_name` on first line, followed by English text.
The corresponding DCX file contains the Hebrew translation at the same section ID.

Section types: `1` = narrator text (847 uses), `4` = zoom/read close-up (78 uses),
`5` = inventory item description (21 uses, INVENT.SCX only).

**Dialog sections (ID ≥ 1000 or 2000+):** Dialog trees with multiple-choice responses.
Header: `section_id,completion_flag,speaker` — `completion_flag` is 0 (none) or a flag ID
(e.g., 1840) that gets set when the dialog completes, enabling progression.
```
2010,0,ALTalk                      ← section 2010, completion_flag 0, speaker "ALTalk"
GrdTlk 49,11, sdEscl6             ← NPC sprite, position (x,y), voice sound
Good morning.  Can I help you?     ← NPC's spoken text
Yes, please. I am looking for @.   ← Alex's reply template (@ = choice placeholder)
4                                  ← number of choices
a hotel                            ← choice 1 display text
my bag                             ← choice 2 display text
something to eat                   ← choice 3 display text
a taxi to town                     ← choice 4 display text
4                                  ← number of response records
1,0,151,sdAl62                     ← correct(1), flag=0, goto 151, voice sound
Yes, please. I am looking for a hotel.  ← Alex's full spoken line
1,0,152,sdAl63                     ← correct(1), flag=0, goto 152
Yes, please. I am looking for my bag.
2,0,0,Silence                      ← wrong(2), no flag, no goto, no sound
(wrong answer text)
...
0                                  ← end marker

Response record format: `result,flag_id,goto_section,sound`
- result: 1 = correct answer, 2 = wrong answer
- flag_id: flag to set on correct answer (0 = none)
- goto_section: next section to load (0 for wrong answers)
- sound: voice clip name ("Silence" for wrong answers)
All 114 wrong-answer records are `2,0,0,Silence`. All 190 correct-answer records have result=1.

**Implicit flag setting**: The dialog system sets completion flags automatically
when a dialog tree is completed — these are NOT set by explicit `F` commands in
the SCX. For example, flags 1840–1842 (cat dialog completion in StripAir) are
set implicitly by completing dialog sections, not by any `F` command in the script.
The `completion_flag` field in the dialog header (e.g., `2010,1840,ALTalk`)
controls which flag gets set on completion.

**Reward correlation**: Across the decrypted SCX corpus, the reward-bearing
grammar dialogs are exactly the quiz-style `ALTalk` / `ALTel` sections with
`2,0,0,Silence` wrong-answer records and a non-zero `completion_flag`. These
do not contain positive `P,+N` commands; instead, the engine's talk runtime
applies the positive reward. The lone quiz-style exception is
`STCHOCO.SCX` section `2060,0,ALTalk`, which is only a price question leading
into the explicit gum purchase penalty.
```

**Animation sections (ID ≥ 5000, non-numeric content):** Frame-by-frame animation commands.
```
5010
P 3,0        ← display frame 3, delay 0
V 1,0
G 8,0        ← goto data entry 8
F 7,1        ← fade frame 7, duration 1
Q            ← end animation
```
Commands are `LETTER SPACE args` format. See animation command table below.

**Data sections (ID ≥ 5000, numeric content):** Coordinate/timing arrays referenced by animation sections.
```
5030
260,0        ← entry 1: x=260, y=0
209,10       ← entry 2: x=209, y=10
141,34       ← decreasing x, increasing y = diagonal motion path
75,57
37,78
```
Values typically describe motion paths (position sequences) or timing data.

### Interactive section commands

These commands appear in the `pre1,pre2,CMD,args` record format.
The engine dispatches on the command letter at binary offset 0xAAFB–0xAD5F (two separate dispatch tables exist).

**IMPORTANT**: Command letters have **different meanings** in interactive vs animation sections.
The binary confirms two separate dispatch tables.

| Cmd | Args | Count | Description | Confidence |
|-----|------|-------|-------------|------------|
| A   | `state,object,value` | 155 | Animate named object. Ex: `A 0,ALEXDN,0` | High |
| B   | `object,state` | 491 | Set object visibility/state. Ex: `B WalkUpstairs,0` | High |
| C   | `snScene,section_id` | 77 | Scene transition. Loads scene identified by `sn*` name from overlay table. `section_id` is the entry point in the target scene. Ex: `C snArrest,501` | High |
| D   | `direction` | 233 | Set Alex facing direction. Values 1-9 (no 5): 8-direction compass grid. | High |
| F   | `flag_id,value` | 138 | Set game flag. Values: 1 (set), 0 (clear), -1 (toggle). **Not fade** (animation F). | High |
| G   | `icon,flag_id,add` | 40 | Give (add=1) / take (add=0) inventory item + optionally set possession flag. Ex: `G BurgerIcon,1909,1`. flag=0 means no flag change. | High |
| H   | `section_id` | 250 | NPC speech bubble. Shows NPC talk sprite + spoken text from a 1000+ section. Ex: `H 1010` | High |
| K   | `section_id` | 205 | Jump to section. `K 212` = within file. `K 10001` (31 uses) = jump to GLOBAL.SCX inventory handler. | High |
| L   | `section_id` | 222 | Narrator text (type 1), zoom close-up (type 4), or inventory desc (type 5). Targets 500+ sections. Ex: `L 570` | High |
| M   | `object,dx,dy` | 7 | Move named object by relative pixel offset. Ex: `M Pillow,29,4` | High |
| O   | `icon_name,section_id` | 77 | Inventory item use dispatch. Ex: `O PassportIcon,10002` | High |
| P   | `amount` | 14 | Score penalty (Palmettoes). ALL values negative: -5, -10, -15, -40, -50, -275. | High |
| R   | `1` | 2 | Refresh/redraw scene state. Only `R 1`. Very rare (2 uses: Aptment, Room303). | Medium |
| S   | `sound_name` | 5 | Play named sound from SD*.DAT. Ex: `S sdBell` | High |
| T   | `section_id` | 105 | Enter dialog tree (2000+ section). Ex: `T 2010` | High |
| V   | `object,value` | 271 | Set named object property. Ex: `V Meter,1` — show; `V ALEXDN,0` — hide | High |
| W   | `mode,x,y` | 287 | Walk Alex. Mode 0 = animated walk, 1 = instant reposition. Ex: `W 0,840,140` | High |
| X   | (none or `0,0`) | 156 | End/return from handler. Terminates current command sequence. | High |
| Y   | `1,section_id` | 15 | First-use branch: fall through on first visit, jump to `section_id` on repeat. Only in GLOBAL.SCX. | High |

### Animation section commands

These commands appear in `LETTER SPACE args` format in sections ≥ 5000.
Dispatched at binary offset 0x3E36–0x44F7.

See `ANIMATION_COMMANDS.md` for detailed reference. Summary:

| Cmd | Args | Count | Description | Confidence |
|-----|------|-------|-------------|------------|
| F   | `frame,duration` | 333 | Select sprite frame by per-object NDX index; duration>0 = self-timed | High |
| P   | `steps,delay` | 288 | Step through N data-section positions with delay per step | High |
| G   | `index,0` | 237 | Jump to position index in data section; -1=end, -2=reverse | High |
| Q   | `[0,0]` | 153 | End animation section | High |
| D   | `direction,0` | 69 | Set facing direction: 0=forward, 1=turned, -1=reversed | High |
| V   | `visible,0` | 44 | Show (1) or hide (0) the sprite | High |
| R   | `mode,0` | 42 | Reset animation state (cleanup before Q) | Medium |
| X   | `0,0` | 40 | Wait for current motion to complete / sync point | Medium |
| S   | `index,0` | 34 | Trigger Nth sound from scene's SD*.NDX (1-indexed) | High |
| M   | `dx,dy` | 8 | Move sprite by relative pixel offset | High |
| Y   | `value,0` | 8 | Set Y position or vertical state | Low-Medium |
| T   | `value,0` | 6 | Store `arg-1` into state field `+0x1383` | Medium |
| E   | `type,0` | 5 | Store animation type byte into `+0x375` | Medium |
| O   | `1,0` | 4 | Overlay/cutscene completion callback | Medium |
| K   | `section,0` | 3 | Jump to interactive section mid-animation | High |
| L   | `x,y` | 2 | Set initial sprite position | Medium |
| I   | `value,0` | 1 | Initialize animation parameters (global setup) | Low |

### Condition/flag system

Every command line in interactive sections has the form:
```
flag_id,condition,COMMAND,arg1,arg2,...
```

- `0,0,CMD,args` — unconditional execution
- `flag_id,0,CMD,args` — execute if flag is NOT set (condition=0)
- `flag_id,1,CMD,args` — execute if flag IS set (condition=1)
- Section terminator: `-1` on its own line

151 unique flag IDs observed, all in range **1001–1921**. Flags are stored as a
9,952-bit array in save files (see GAM format). Flags are set by the `F` command.

### Interactive command reference (non-animation)

Commands in sections 100–2999 use the `flag,cond,CMD,args` format:

| Letter | Count | Name | Format | Description |
|--------|-------|------|--------|-------------|
| B | 491 | Visibility | `B,name,0/1` | Show/hide named object |
| W | 287 | Walk | `W,mode,x,y` | Walk Alex to (x,y). Mode 0 = animated walk, 1 = instant reposition. |
| H | 250 | NPC speech | `H,section_id` | Show NPC sprite + spoken text from a 1000+ section |
| D | 233 | Direction | `D,num` | Set Alex facing direction (1–9, no 5) |
| V | 227 | Set variable | `V,name,value` | Set named object property |
| L | 222 | Narrator/zoom | `L,section_id` | Display narrator text (type 1), close-up (type 4), or inventory desc (type 5) from a 500+ section |
| K | 205 | Jump | `K,section_id` | Continue execution at section |
| X | 156 | Exit | (none) | End current command sequence |
| A | 155 | Animation | `A,state,name,frame` | Start named animation |
| F | 138 | Flag | `F,flag_id,value` | Set game flag (1=set, 0=clear, -1=toggle) |
| T | 105 | Dialog | `T,section_id` | Enter dialog tree (2000+ section) |
| C | 77 | Scene change | `C,scene_name,section` | Transition to another scene |
| O | 77 | Item use | `O,icon,section_id` | Dispatch inventory item use. Routes to handler for specific item. |
| G | 40 | Give/take item | `G,icon,flag_id,add` | Add (1) or remove (0) inventory item; optionally set possession flag. See `COMMAND_SEMANTICS.md` §1. |
| Y | 15 | First-use branch | `Y,1,next_section` | In `GLOBAL.SCX`: first execution falls through, repeat execution jumps to the paired follow-up section. See `COMMAND_SEMANTICS.md` §2. |
| P | 14 | Palmettoes | `P,amount` | Subtract Palmettoes (all values negative). See `SCORE_SYSTEM.md`. |
| M | 7 | Move delta | `M,object,dx,dy` | Move named object by relative pixel offset. See `COMMAND_SEMANTICS.md` §3. |
| S | 5 | Sound | `S,sound_name` | Play named sound effect from SD*.DAT |
| R | 2 | Refresh scene | `R,1` | Reinitialize / redraw current scene after a state change. See `COMMAND_SEMANTICS.md` §4. |

### Dialog section format (2000–2999)

Dialog sections present NPC speech and player choices:

```
SpriteConfig name x,y, sound_name    ← talk sprite + voice clip
NPC question text                     ← what NPC says
Player template with @ placeholder    ← player sentence (@ = blank to fill)
num_choices                           ← e.g., 3
choice_1_text                         ← option 1
choice_2_text                         ← option 2
choice_3_text                         ← option 3
num_responses                         ← response entries
wrong_marker,0,0,Silence             ← wrong answer (no transition)
                                      ← blank line
correct_marker,0,next_section,sound  ← correct → next dialog
Full sentence with correct fill       ← display text
0                                     ← end marker
```

The dialog system implicitly sets completion flags (e.g., 1840–1842 for cat
dialogs) and awards Palmettoes for correct answers. These are NOT set by
explicit F/P commands in the SCX—the engine handles them internally.

### All Palmettoes commands

14 P commands across 11 scenes, total possible penalty: **−560**.

| Scene | Amount | Context |
|-------|--------|---------|
| Airport | −15 | Passport officer (section 229) |
| Airport | −10 | Lost baggage (section 325) |
| Burger | −50, −10 | (sections 130, 210) |
| Butcher | −15, −10, −10 | (sections 125, 126, 161) |
| LobbyDsk | −40 | (section 150) |
| Photo | −50 | (section 170) |
| StChoco | −10 | (section 250) |
| StHosp | −5 | (section 140) |
| StSuper | −10 | (section 111) |
| StZoo | −50 | (section 185) |
| Super | −275 | Massive penalty (section 290) |

Known rewards: +10 × 3 from cat dialog (StripAir) = +30. Start: 100.

---

## DCX — Dialog Text

Same binary structure as SCX (0xC0 header, 0xFE section delimiters, XOR encrypted).
Contains Hebrew text (CP862 encoding) for educational content.

Sections are keyed by the same IDs as SCX text reference sections (500+).
Each section contains one or more lines of Hebrew text.

```
510
!ותוא חק .החנה רבוש והז
```

---

## CFG — Configuration

Plain text, key = value format.
```
CDROM = D:\
HARDDISK = C:\ALEX\
```

---

## PRJ — Project / Resource Group List

9 records of 64 bytes each. Each record starts with a Pascal string naming a global resource group:

| Index | Name | Purpose |
|-------|------|---------|
| 0 | DRIVERS.NDT | Display drivers |
| 1 | PANEL.NDT | UI panel |
| 2 | ALEXWALK.NDT | Walk animation |
| 3 | MICE.NDT | Mouse cursors |
| 4 | FONTS.NDT | Fonts |
| 5 | ICONS.NDT | Inventory icons |
| 6 | WINDOWS.NDT | Window frames |
| 7 | MUSIC.NDT | Background music |
| 8 | MAP.NDT | World map |

The `.NDT` extension maps to `.NDX` files on disc. Remaining bytes in each 64-byte record contain configuration data (sizes, flags).

---

## FILES.LST — Installer File List

Plain text listing files to copy from CD to hard disk:
```
Alex1.EX~=Alex1.EXE
Alex1.OVR
Alex1.DAT
Alex1.NDX
```
The `EX~=EXE` syntax means copy `Alex1.EX~` from CD and rename to `Alex1.EXE`.

---

## OVR — Overlay / Scene Definitions (ALEX1.OVR)

FBOV-format overlay (253,346 bytes). Contains per-scene initialization code that
defines visual objects, named hotspots, and clickable rectangles.

### Scene table (offset 0x719)

36 entries as consecutive Pascal string pairs (`sn*` identifier + scene filename),
followed by 2 unnamed entries (Prison, Death). See ENGINE_ARCHITECTURE.md §3 for
the full table.

### Scene init functions

Each scene has one initialization function in the overlay. Functions are identified
by their prologue pattern:

```
55              push bp
89 E5           mov bp, sp
B8 XX XX        mov ax, frame_size    ; 0x0120, 0x0124, 0x0200, or 0x0202
9A XX XX 12 18  call far 1218:XXXX    ; stack check
81 EC XX XX     sub sp, frame_size
```

44 scene init functions found. 29 identified by name (matched via object/hotspot
names to scene table entries). The remaining are close-up dialog views, special
scenes (Opening, Corridor, Factory, etc.), and utility functions.

### Three-layer object system

Each scene init function creates objects in sequence via far calls:

**Layer 1: Visual objects** — `call far 089E:0000`
Sprite-based scene decoration. Parameters (via pushes before call):
- Object ID (65+), X position, Y position, name (Pascal string via strcopy)

**Layer 2: Named hotspots** — `call far 089E:0073`
Named interactive anchors. Parameters:
- X position, Y position, handler value, name (Pascal string via strcopy)
- Handler values vary (0, 1, 10, 69, 85–200); exact dispatch mechanism unclear

**Layer 3: Click rectangles** — `call far 10C4:0000`
The actual hit-test regions that respond to player clicks. Parameters:
- x1, y1, x2, y2 (bounding box in screen coordinates)
- Followed by a type-specific configuration call

### Click rectangle types

Each click rectangle is classified by the configuration call that follows it:

| Type | Config call | Distinguishing params | Purpose |
|------|------------|----------------------|---------|
| A | `0BCE:27A8` | first param = 1001 | Walk zone (navigation boundary) |
| B | `0BCE:27A8` | first param = 0 | Interactive object (look/touch/talk) |
| C | `033B:12A0` | `(section_id, 1, 6658)` | Scene exit |
| D | `033B:0616` | `(walk_x, walk_y, 6734)` | Walk-to trigger point |
| E | `033B:0442` | `(obj_num, 0, flag)` | Special/animated object |
| F | (no strcopy) | — | Raw trigger rect (paired with C/D/E) |

Constants: 11112 (0x2B68) = class/vtable ID for click rect objects.
6658 (0x1A02) = exit type marker. 6734 (0x1A4E) = walk-to type marker.

### Interactive object struct fields (Type B)

After the `0BCE:27A8` config call, field writes set handler section IDs on the
returned object via `es: mov word [di+offset], value` patterns:

| Struct offset | Occurrences | Interaction mode | Description |
|--------------|-------------|-----------------|-------------|
| +0x44 | 87 | Use item? | Handler section; always paired with touch=110 |
| +0x46 | 677 | **Look** | Text_ref section ID → narration on examine |
| +0x48 | 645 | **Touch** | Interactive section ID → action on click |
| +0x4A | 33 | **Talk** | Dialog handler section (NPC scenes only) |
| +0x62 | 7 | Special | Rare additional handler |

These fields correspond to the 5 cursor-based interaction modes:
1. **Look** (LOOKCURSOR) → executes section at +0x46 (text narration)
2. **Talk** (TALKCURSOR) → executes section at +0x4A (dialog tree)
3. **Touch** (TOUCHCURSOR) → executes section at +0x48 (interactive handler)
4. **Walk** (WALKCURSOR) → Type A/D click rects handle navigation
5. **Bag/inventory** → likely dispatched through +0x44 or GLOBAL.SCX

### Type C/D/E/F grouping

Exit-related click rects often form triplets:
1. Type D: defines walk-to position (where Alex walks before triggering)
2. Type C: defines the scene exit (section_id encodes the transition)
3. Type F: defines the actual click detection zone (larger area)

### Extraction statistics

| Metric | Count |
|--------|-------|
| Scene init functions | 44 |
| Identified scenes | 29 |
| Visual objects (Layer 1) | 306 |
| Named hotspots (Layer 2) | 146 |
| Click rectangles (Layer 3) | 803 |
| Type A (walk zones) | ~250 |
| Type B (interactive) | ~400 |
| Type C (exits) | ~30 |
| Type D (walk-to) | ~20 |
| Type E (special) | ~50 |
| Type F (raw trigger) | ~50 |

Extractor tool: `re/extract_hotspots.py`

### CS base resolution

String references in scene init functions use `mov di, offset` where `offset` is
relative to the function's code segment base. The CS base is computed by locating
the "Music" Pascal string (present before every scene init function) and matching
it against one of the `mov di` values. Validated by checking that multiple `mov di`
values resolve to valid Pascal strings at `cs_base + offset`.

---

## Scene File Pairing

Each scene location has up to 4 associated files:
- `{SCENE}.NDX` + `{SCENE}.DAT` — Graphics resources
- `SD{SCENE}.NDX` + `SD{SCENE}.DAT` — Sound resources
- `{SCENE}.SCX` — Scene script (encrypted)
- `{SCENE}.DCX` — Dialog text (encrypted)

Scene names: Logo, Opening, Ending, Strip0, StripAir, Airport, Lobby, LobbyDsk, Corridor, Room301–303, Floor1–4, WaltRoom, Burger, StBurger, Butcher, StButche, Clothes, Photo, Ward, Super, StSuper, StHosp, StHotel, StApart, StChoco, StZoo, ZooBack, ZooFront, LionCage, Monkey, Bear, Factory, LiftRoom, Control, Arrest, Prison, Death, etc.

---

## TRANS.BIG — Copy Protection

245 MB file containing a chained navigation structure. Only 459 bytes of data matter:
- 51 entries, each: 4-byte NOT-encoded pointer + 5 data bytes
- Chain yields 255-byte XOR key for decrypting SCX/DCX files
- See `re/copy-protection.md` for full details

---

## GAM — Save Files

User-named save files with `.GAM` extension (e.g., `1.GAM`, `2.GAM`).
Variable size: 4,474–5,668 bytes observed.

### Structure

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x000 | 1252 | flags | Bit array of 9,952 game flags (1,252 bytes) |
| 0x4E4 | varies | scene | Pascal string: current scene `sn*` name |
| 0x4E4+ | varies | state | Variable-length scene-specific state data |

### Flag bit array (bytes 0x000–0x4E3)

The 1,252-byte state area is a **bit array** encoding 9,952 boolean game flags:
- Each byte stores 8 flags, bit 0 = lowest flag ID
- Flag ID = `byte_offset × 8 + bit_position`
- Example: byte at offset 0xE6 with value 0x07 = flags 1840, 1841, 1842 are set
  (0xE6 × 8 = 1840; value 7 = bits 0,1,2 set)

At game start (Airport entry), the entire flag area is zero. Flags are set
progressively as the player completes puzzles and dialogs.

### Scene name field (offset 0x4E4)

Pascal string (1 length byte + ASCII characters):
- `snAirport` — save at airport
- `snStripAir` — outside airport
- `snStApart` — apartment street

### Post-scene object state

After the scene name, the save contains per-object state records for every
scene object plus the global UI objects. Each record has a Pascal-string name
and associated property bytes. Objects appear in this order:

1. **Scene-specific objects** — sprites, blocking regions, NPCs
   (e.g., `Depart`, `Arrive`, `Guard`, `Achu`, `Cat`, `Mail`, `L-Elect`)
2. **Navigation objects** — `ALEX`, `ALEXDN*`, `Door`, `Backdrop`
3. **UI panel** — always present:
   - `NoMap`, `NoBag`, `ExitButton`, `TouchButton`, `LookButton`,
     `TalkButton`, `WalkButton`, `MapButton`, `CaseButton`
   - `Panel`, `Score`, `MoneyBox`, `Money`, `Meter`
4. **Inventory icons** (22 items, always present in this order):
   `BrainIcon`, `HammerIcon`, `ZooTicketIcon`, `IDCardIcon`, `PeanutIcon`,
   `MilkIcon`, `PhotoIcon`, `NotebookIcon`, `HotdogIcon`, `BeefIcon`,
   `EnvelopeIcon`, `EggIcon`, `DrinkIcon`, `BurgerIcon`, `GlueIcon`,
   `DrawerKeyIcon`, `PinIcon`, `Key303Icon`, `CreditIcon`, `ChocolateIcon`,
   `ZooCouponIcon`, `CouponIcon`, `LetterIcon`, `PassportIcon`
5. **Current scene name** — repeated at end as Pascal string

### Palmettoes storage

The Palmettoes (score) value is stored as a **u32 LE** in the **MoneyBox** object
state, appearing twice (4 bytes apart). The absolute offset varies by scene
(depends on number of scene objects before MoneyBox), but can be located by
searching for the Pascal string `\x08MoneyBox`:

```
...03 01 00 00 [u32 Palmettoes] 00 00 00 [u32 Palmettoes] 00 00 00 08 "MoneyBox" ...
```

The **Meter** object is a persistent UI meter stored in saves separately from the
numeric Palmettoes count. In the bundled early-game save samples its value stays
at 180/200 across both 75 and 105 Palmettoes, so its exact gameplay semantics
remain unresolved.

### Palmettoes display string

The ASCII representation of the Palmettoes value is stored near the Score object
(e.g., `" 75"` or `"105"`). Two bytes that differ encode the display string.

### ALEXSAVE.TMP

Separate file, 61,440 bytes = 320×192 pixels. Screen thumbnail used in the
save/load UI file list display. Not the actual save data.

---

## Resource Counts

| Type | Count |
|------|-------|
| NDX files | 101 |
| DAT files | 101 |
| SCX files | 53 |
| DCX files | 44 |
| Total NDX entries | 5,898 |
| COMP-compressed DATs | 61 |
| Sound DATs (raw) | 40 |
