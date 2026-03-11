# Alex Palm Island — Engine Details

Additional engine mechanics reverse-engineered from the game scripts and binary.
Supplements ENGINE_ARCHITECTURE.md and FORMAT_SPEC.md.

---

## 1. Street Navigation System

### Overview

The outdoor world consists of 10 interconnected street scenes:

```
                    StripAir
                       |
                    Strip0
                   /   |   \
            StChoco  StApart  StButche
               |       |        |
            StZoo   StBurger  StHosp
               \       |        |
              (StBurger) StSuper StHotel
                          |
                       StButche
```

Street scenes are wider than the 320-pixel viewport (typically 2 panels = 640x200).
Alex walks freely within each scene. Navigation between scenes happens when Alex
walks to an edge exit point.

### Navigation mechanism: B + K section pairs

Street exits use a consistent two-section pattern:

**Entry section** (even number): Disables all exit click rects in the target
direction, then jumps to a walk section.

```
160                             <- section triggered by exit click rect
0,0,B,ToStrip01,0              <- disable the exit trigger (prevents re-triggering)
0,0,K,161                      <- jump to walk section
-1
```

**Walk section** (odd number, entry+1): Walks Alex to the edge position, then
re-enables the exit trigger for the adjacent scene.

```
161                             <- walk-to section
0,0,W,0,250,115                <- walk Alex to screen edge
0,0,B,ToStrip01,1              <- re-enable exit for return trips
-1
```

### Multi-exit blocking

When Alex approaches one exit, ALL other exits are disabled to prevent
impossible state transitions during the walk animation:

```
140                             <- StApart: approaching left exit
0,0,B,ToStBurger,0             <- disable Burger Street exit
0,0,B,ToStButcher,0            <- disable Butcher Street exit
0,0,B,FarToStButcher,0         <- disable far Butcher trigger
0,0,B,CrossStreet1,0           <- disable cross-street walk zone 1
0,0,B,CrossStreet2,0           <- disable cross-street walk zone 2
0,0,K,141                      <- jump to walk
-1
```

The corresponding re-enable section (typically entry+1) restores all exits:

```
141
0,0,W,0,110,50                 <- walk to edge
0,0,D,7                        <- face up-left
-1
```

When Alex arrives at the new scene, the new scene's script executes the entry
section which re-enables the relevant exit objects.

### Cross-street objects

Scenes that have intersections (streets crossing at right angles) use special
blocking objects:

- `CrossStreet1`, `CrossStreet2`, `CrossStreet3` -- walk zone blockers at intersections
- `RightSideBlock1`, `RightSideBlock2` -- prevent walking past the right edge
- `BackWallBlock1`, `BackWallBlock2` -- prevent walking past background buildings
- `*Block` objects with scene-specific names (e.g., `BurgerBlock1`, `ButcherBlock`)

These are Type A walk zone click rects (from the OVR) that constrain Alex's
pathfinding. The B command toggles them on/off to open/close navigation corridors
during scene transitions.

### Scene connectivity via click rects (NOT C commands)

Street-to-street transitions do NOT use the `C` (scene change) command. Instead:
1. Alex walks to the screen edge (via W command in the odd-numbered section)
2. The scene's exit click rect (Type C in OVR, config call `033B:12A0`) fires
3. The engine transitions to the adjacent scene automatically

The `C` command is used only for entering buildings and special locations:
- `C,snBurger,495` (StBurger -> Burger restaurant)
- `C,snAptment,160` (StApart -> Apartment building)
- `C,snLobby,0` (StHotel -> Hotel lobby)
- `C,snPhoto,320` (StZoo -> Photo studio)
- `C,snZooFront,130` (StZoo -> Zoo entrance)
- `C,snFactory,290` (StChoco -> Chocolate factory)
- `C,snArrest,511` (StButche -> Arrest, for touching the statue)

### Exit naming convention

Exit objects follow a naming pattern:
- `To{Scene}` -- primary exit trigger (e.g., `ToStChoco`, `ToStrip0`)
- `FarTo{Scene}` -- far-distance trigger (larger click rect for distant approach)
- `JumpTo{Scene}` -- immediate jump trigger (skips walk animation)
- `Into{Building}` -- building entrance (e.g., `IntoSuper`, `IntoBurger`)

### Walk direction encoding

The D (direction) command sets Alex's facing direction after reaching an exit:

| D value | Direction | Used for |
|---------|-----------|----------|
| 1 | Down-left | Arriving from upper-right |
| 2 | Down | Walking south, entering from north |
| 3 | Down-right | Arriving from upper-left |
| 4 | Left | Walking west |
| 6 | Right | Walking east (absent from data = mapped to 5?) |
| 7 | Up-left | Approaching upper-left exit |
| 8 | Up | Walking north, entering from south |
| 9 | Up-right | Approaching upper-right exit |

Direction 5 (center/neutral) is never used. The 8 directions map to a compass
grid: 7=NW, 8=N, 9=NE, 4=W, 6=E, 1=SW, 2=S, 3=SE.

### ALEX1.SCX -- Walk animation delta table

ALEX1.SCX is not a scene script. It contains the walk animation delta table:
an 8x9 matrix of `(dx, dy)` pairs. Each row is one of the 8 walk directions;
each column is one animation frame.

```
Dir 1 (SW): (0,0) (0,0) (-8,0) (0,6)  (0,0) (-8,5) (-8,4) (0,0) (0,0)
Dir 2 (S):  (0,0) (0,3) (0,3)  (0,3)  (0,3) (0,3)  (0,3)  (0,0) (0,0)
Dir 3 (SE): (0,0) (0,0) (8,0)  (0,6)  (0,0) (8,5)  (8,4)  (0,0) (0,0)
Dir 4 (W):  (0,0) (0,0) (0,0)  (-12,0)(-12,0)(-12,0)(-12,0)(0,0) (0,0)
Dir 5 (E):  (0,0) (0,0) (0,0)  (12,0) (12,0)(12,0) (12,0) (0,0) (0,0)
Dir 6 (NW): (0,0) (0,0) (-8,0) (0,-6) (0,0) (-8,-5)(-8,-4)(0,0) (0,0)
Dir 7 (N):  (0,0) (0,-3)(0,-3) (0,-3) (0,-3)(0,-3) (0,-3) (0,0) (0,0)
Dir 8 (NE): (0,0) (0,0) (8,0)  (0,-6) (0,0) (8,-5) (8,-4) (0,0) (0,0)
```

Properties:
- 9 frames per walk cycle (frames 0 and 8 are always (0,0) = idle/rest frames)
- Horizontal (E/W) walks move 12 pixels/frame (4 active frames = 48px per cycle)
- Vertical (N/S) walks move 3 pixels/frame (6 active frames = 18px per cycle)
- Diagonal walks combine 8px horizontal + 5-6px vertical per frame
- The table is loaded from ALEX1.SCX at startup alongside the walk sprite set
  (ALEXWALK.NDX/DAT: 75 sprites for 9 frames x 8 directions + 3 idle frames)

---

## 2. Map System

### Map button behavior

The UI panel contains MapButton, MapPressed, and NoMap sprites (all in PANEL.NDX,
each 1324 bytes = approximately 33x40 pixels). The map is only available in
outdoor street scenes.

- **NoMap** sprite shown indoors: covers the MapButton, preventing clicks
- **MapButton** shown outdoors: clicking opens the full-screen map
- **MapPressed** is the button's pressed state

### Full-screen map

MAP.NDX/DAT contains:
- `MAP` (64,004 bytes = 320x200 full-screen image): The island map showing all locations
- `MAPPAL` (768 bytes): Dedicated palette for the map view

When the player clicks MapButton, the engine:
1. Switches to the map palette (MAPPAL)
2. Displays the MAP sprite (full 320x200)
3. Waits for the player to click a destination
4. Transitions to the selected street scene

### SmallMap (StButche only)

STBUTCHE.NDX contains a `SMALLMAP` resource (844 bytes = approximately 28x30
sprite). Section 260 in STBUTCHE.SCX shows this being used:

```
260
1800,1,X                       <- if flag 1800 set, exit (already got map)
0,0,W,0,480,90                 <- walk Alex to map location
0,0,D,7                        <- face up-left
0,0,B,SmallMap,0               <- disable SmallMap click rect
0,0,V,SmallMap,0               <- hide SmallMap sprite
0,0,V,NoMap,0                  <- hide NoMap (enables MapButton!)
0,0,L,590                      <- narration: "You found the map!"
0,0,F,1800,1                   <- set flag 1800 (map acquired)
-1
```

Flag 1800 gates the map: until the player finds the SmallMap object in StButche,
the MapButton is covered by the NoMap sprite. After pickup, the `V,NoMap,0`
command hides the NoMap overlay, revealing the MapButton for the rest of the game.

The error message in GLOBAL.SCX section 10999 confirms: "You have not found a map!"
(displayed when trying to use the map before acquiring it).

---

## 3. Form / Text Input System

### Zoom/read sections (type 4)

Sections with the header `section_id,4,0` are zoom/read sections. Most display a
close-up sprite (e.g., `HotelAd,2` shows a hotel advertisement). Two special
instances use this mechanism for text input:

### Text input instances

The engine supports keyboard text input via type-4 zoom sections. At least 4
instances exist (confirmed by gameplay, not just static analysis):

**1. Airport lost-and-found form** (section 650, `Form,1`):
The player must type answers to 4 questions (section 830):
- "What is your name?"
- "What did you lose?"
- "What size is it?"
- "What colour is it?"

Section 800 instructs: "Remember! Capital letters!" — the engine validates
input and rejects incorrect answers. Wrong details lead to `C,snArrest`
(arrested). This is a reading comprehension + spelling exercise.

**2. Hotel guest book** (LobbyDsk section 600, `Form,3`):
Hotel registration form (section 800 defines fields):
- "Why are you here?" (business / holiday)
- "What kind of room do you want?" (single/double, shower/bath, telephone)

**3. Room303 telephone** (section 820, `Phone,3`):
A dial-by-number interface. Section 850 shows the phone directory:
- 1 = Front desk, 2 = Room service, 3 = Information
- "For an outside line, dial nine."

Wrong numbers give feedback: "Sorry, the line is busy" (830) or "Sorry,
nobody is answering" (840). Dialing Phil's number (201936, from WaltRoom
section 820) is part of the critical path.

**4. Safe code** (WaltRoom section 900, `SafeClsd,1`):
Enter `FEEDBIGBADDAD` (section 910). All hex-valid letters (A-F), mnemonic =
"Feed Big Bad Dad." Section 780: "You need the correct code to open the safe."

The `Form,N` parameter in type-4 sections selects different input modes:
- Mode 1: Multi-field text form (Airport)
- Mode 3: Selection/checkbox form (Hotel) or dial interface (Phone)

---

## 4. Drag-and-Drop Word Puzzle

### WaltRoom panda article (sections 110, 740, 810, 820, 920)

The word puzzle is a reading comprehension exercise integrated into the game's
spy narrative. Walter's guest spilled coffee on a magazine article about the
Giant Panda, obscuring certain words.

**Trigger sequence:**
1. Section 110: Alex walks to the magazine (190,131), faces up-right (D,9)
2. Flag 1302 checked: if already done, jump to section 115 (re-view safe)
3. First time: set flag 1302, swap Panda sprite states, display narration (L,700):
   "Good for you! You found the safe. Now can you break into it?"

**Article display (section 740):**
```
740,4,0
Article,2
```
Type-4 zoom section showing the `Article` sprite at variant 2 (coffee-stained
version with blanked words).

**Instruction (section 810):**
"Drag the words at the bottom of the screen to the right place."

**Article text with blanks (section 820):**
Contains 18 lines -- each sentence appears twice (once as the "answer" text,
once as the displayed text with blank). The lines are:

```
The Giant Panda lives in _____.          <- blank: China
It _____ only bamboo shoots.             <- blank: eats
When there are _____ enough bamboo...    <- blank: not
There are not many pandas left...        <- (no blank, context line)
...is the symbol of the World Wide Fund for _____.  <- blank: Nature
It stands for all the _____ we want to save...      <- blank: animals
```

**Word bank with coordinates (section 920):**
```
5                                <- 5 words to place
245,145,animals                  <- target position (245,145), word "animals"
177,25,China                     <- target position (177,25), word "China"
308,40,not                       <- target position (308,40), word "not"
228,25,eats                      <- target position (228,25), word "eats"
230,130,Nature                   <- target position (230,130), word "Nature"
```

The engine renders the words at the bottom of the screen. The player drags each
word to its correct (x,y) position in the article. The coordinates specify where
the word must be dropped (pixel position within the zoomed article view).

### Implementation

The drag-and-drop is a built-in engine feature, not scripted by SCX commands.
The section 920 data format (`count`, then `x,y,word` lines) is a special
section type parsed by the engine when the panda puzzle is active.

### Uniqueness

This is the **only** drag-and-drop puzzle in the game. No other SCX file
contains a section with the `x,y,word` coordinate format. The puzzle is
self-contained in WaltRoom and combines with the safe code input
(`FEEDBIGBADDAD` in section 910) as a two-part educational mini-game.

### Signs and posters (section 800+)

Many scenes have sections 800+ containing multi-line text for signs and posters
displayed via type-4 zoom sections. These are **not** drag puzzles -- they are
static text rendered on sign sprites:

| Scene | Section | Content |
|-------|---------|---------|
| StripAir | 800 | "Information" |
| StApart | 800 | "Coming to Palm Island / Coco's Coconuts / Buy your tickets today!" |
| StApart | 810 | "123 Main Street" |
| StButche | 800 | "Please don't walk on the grass." |
| StButche | 810 | "The butcher's shop is closed. / Butch went hunting." |
| StChoco | 800 | "Danger! / Electric fence! / Don't touch!" |
| StChoco | 810/820 | "Palm Island Chocolate" / "Chocolate" |
| StHotel | 800 | "DANGER! / BE CAREFUL!" |
| StSuper | 800-840 | "BBBB / Best food in town", "Chinese Specials...", "Supermarket", "Doughnuts" |
| StZoo | 800-820 | "Visit Palm Island Zoo...", Phil's ad, "Closed / Feeding time" |

---

## 5. SCN Files

**No SCN files exist.** A thorough search of the game directory, decrypted
directory, and installed directory found zero `.SCN` files. The game does not
use a separate scene state file format.

Scene state is instead stored in:
- **GAM save files**: Per-object state records with Pascal-string names and
  property bytes (documented in FORMAT_SPEC.md)
- **ALEXSAVE.TMP**: 61,440-byte screen thumbnail (320x192 pixels)
- **In-memory flag bit array**: 1,252 bytes = 9,952 boolean flags, serialized
  to the first 0x4E4 bytes of each save file

The `sn*` identifier strings in save files (e.g., `snAirport`, `snStripAir`)
serve as scene state keys, not file references.

---

## 6. DCX Hebrew Text Catalog

All 44 DCX files use the same binary format as SCX (0xC0 header, 0xFE delimiters,
XOR encryption, CP862 encoding for Hebrew text). Each DCX parallels an SCX file,
providing Hebrew translations of the English narration and dialog text.

### Statistics

| DCX File | Sections | Lines | Section Types |
|----------|----------|-------|---------------|
| AIRPORT | 84 | 84 | 77 text_ref, 7 dialog |
| APTMENT | 20 | 20 | 20 text_ref |
| BEAR | 13 | 13 | 13 text_ref |
| BURGER | 97 | 97 | 84 text_ref, 13 dialog |
| BUTCHER | 59 | 59 | 48 text_ref, 11 dialog |
| CAVEMAN | 9 | 9 | 9 text_ref |
| CLOTHES | 30 | 30 | 22 text_ref, 8 dialog |
| CONTROL | 26 | 26 | 20 text_ref, 6 dialog |
| CORRIDOR | 40 | 40 | 34 text_ref, 6 dialog |
| DEATH | 10 | 10 | 10 text_ref |
| FACTORY | 35 | 35 | 27 text_ref, 8 dialog |
| FLOOR1 | 24 | 24 | 21 text_ref, 3 dialog |
| FLOOR2 | 12 | 12 | 12 text_ref |
| FLOOR3 | 11 | 11 | 11 text_ref |
| FLOOR4 | 20 | 20 | 18 text_ref, 2 dialog |
| GLOBAL | 46 | 46 | 46 data |
| INVENT | 56 | 56 | 56 text_ref |
| LIFTROOM | 25 | 25 | 25 text_ref |
| LIONCAGE | 13 | 13 | 13 text_ref |
| LOBBY | 41 | 41 | 38 text_ref, 3 dialog |
| LOBBYDSK | 54 | 54 | 51 text_ref, 3 dialog |
| MONKEY | 11 | 11 | 11 text_ref |
| PHOTO | 45 | 45 | 38 text_ref, 7 dialog |
| PRISON | 20 | 20 | 20 text_ref |
| ROOM301 | 19 | 19 | 19 text_ref |
| ROOM302 | 21 | 21 | 21 text_ref |
| ROOM303 | 32 | 32 | 29 text_ref, 3 dialog |
| SAFE | 6 | 6 | 6 text_ref |
| SPYMASTR | 11 | 11 | 11 text_ref |
| STAPART | 30 | 30 | 26 text_ref, 4 dialog |
| STBURGER | 43 | 43 | 35 text_ref, 8 dialog |
| STBUTCHE | 41 | 41 | 38 text_ref, 3 dialog |
| STCHOCO | 36 | 36 | 29 text_ref, 7 dialog |
| STHOSP | 40 | 40 | 39 text_ref, 1 dialog |
| STHOTEL | 46 | 46 | 43 text_ref, 3 dialog |
| STRIP0 | 21 | 21 | 21 text_ref |
| STRIPAIR | 33 | 33 | 28 text_ref, 5 dialog |
| STSUPER | 39 | 39 | 35 text_ref, 4 dialog |
| STZOO | 47 | 47 | 41 text_ref, 6 dialog |
| SUPER | 66 | 66 | 59 text_ref, 7 dialog |
| WALTROOM | 57 | 57 | 54 text_ref, 3 dialog |
| WARD | 35 | 35 | 29 text_ref, 6 dialog |
| ZOOBACK | 48 | 48 | 48 text_ref |
| ZOOFRONT | 42 | 42 | 38 text_ref, 4 dialog |

**Totals:** 44 DCX files, 1,538 sections, 1,538 lines of Hebrew text.

### Content types

**text_ref sections** (1,354 total): Hebrew translations of English narration.
Each section matches the same ID in the corresponding SCX file. Format:
`section_id,type,sound_resource` header, followed by Hebrew text (CP862).

Example (AIRPORT.DCX section matching SCX 690):
```
.תומוקמו םישנא חטבאמ אוה .רמוש אוה הזה שיאה
```
(Translation: "This man is a guard. He secures people and places.")

**dialog sections** (184 total): Hebrew translations of dialog tree content.
These parallel the dialog sections in SCX files, providing localized question
text, answer choices, and response lines.

**data sections** (46 total, GLOBAL.DCX only): Hebrew translations of the
inventory item use messages from GLOBAL.SCX (sections 10501+).

### Bilingual educational design

The game's educational purpose is teaching English to Hebrew-speaking children.
The SCX files contain English text with voice narration (via `sdNar*` sound
resources). The DCX files provide Hebrew translations, displayed alongside the
English text. This dual-language approach lets the learner:
1. Hear the English narration (audio)
2. Read the English text (SCX)
3. Read the Hebrew translation (DCX)

The `L` command in interactive sections triggers this bilingual display: `L,570`
loads section 570 from both the SCX (English text + audio) and the DCX (Hebrew
translation) simultaneously.

---

## 7. Display List and Sprite Layering

### Z-order model

Sprites are rendered in **creation order** as defined by the OVR scene init
function. Each scene init creates objects in three layers:

1. **Visual objects** (Layer 1, call `089E:0000`): Background decorations, props
2. **Named hotspots** (Layer 2, call `089E:0073`): Interactive anchors
3. **Click rectangles** (Layer 3, call `10C4:0000`): Hit-test regions (invisible)

Within each layer, objects are created sequentially. Objects created earlier are
drawn first (behind). Objects created later are drawn on top.

### Display list traversal

From Ghidra decompilation of `FUN_1000_7DD3` and `FUN_1000_7E08`:
- A linked list at globals `DS:0x2FF2`/`DS:0x3FF2` holds all drawable objects
- Each object's type is checked against `0x2C08` (scene object class ID)
- Objects that pass the type check have their paint method called (vtable+0x14)
- Traversal order = creation order = front-to-back or back-to-front rendering

### V command (visibility)

The `V` command controls sprite visibility at runtime:
- `V,ObjectName,1` -- show the object (add to render list / set visible flag)
- `V,ObjectName,0` -- hide the object (remove from render / clear visible flag)

227 V commands across all interactive sections control 127 unique objects.
Common patterns:
- Show/hide Alex variants: `V,Alex,0` then `V,AlexSit,1` (swap standing->sitting)
- Toggle NPCs: `V,LadyBG,1` (show lady at desk)
- Reveal collectibles: `V,Envelope,0` (hide envelope after pickup)
- Scene state changes: `V,Depart,1` / `V,Depart,0` (toggle airport departure sign)

### B command (behavior/state)

The `B` command controls object behavior state, distinct from visibility:
- `B,ObjectName,1` -- enable behavior (click rect active, animation running)
- `B,ObjectName,0` -- disable behavior (click rect inactive, animation stopped)

491 B commands across all interactive sections. B primarily controls click rect
activation -- whether an object responds to mouse clicks. This is how the
navigation system works: `B,ToStrip0,0` disables the exit trigger during a walk
animation, `B,ToStrip0,1` re-enables it after Alex arrives.

**V vs B**: V controls rendering (is the sprite drawn?). B controls interaction
(does the click rect respond?). They are often used together but serve different
purposes. Example: a door that is visible but non-interactive uses `V,Door,1`
with `B,Door,0`.

### Pseudo-3D depth sorting

The engine does not use Y-sorting or depth buffering. Z-order is purely
determined by creation order in the OVR. This means:
- Background scenery sprites (created first) are always behind foreground objects
- The "Arrivals" sign in the Airport is created after Alex, so it draws on top
  of Alex as he descends the escalator
- Walk zone boundaries (Type A click rects) don't affect rendering -- they only
  constrain Alex's pathfinding

For scenes where Alex must appear behind an object and then in front of it
(e.g., walking behind a counter), the engine uses sprite-swapping: hide one
Alex sprite and show another positioned differently, rather than re-sorting
the display list.

---

## 8. Complete Scene Transition Graph

All scene transitions via the `C` command (38 scenes, 71 transitions):

```
OPENING -> OPEN2 -> OPEN3 -> OPEN4 -> Airport

Airport -> Arrest (3 paths)
StripAir <-> Strip0 (walk edges)
Strip0 <-> StChoco, StApart, StButche (walk edges)
StApart <-> StBurger, StChoco, StButche (walk edges)
StApart -> Aptment (C command)
StBurger <-> StSuper, StZoo, StApart (walk edges)
StBurger -> Burger (C command)
StButche <-> Strip0, StApart, StHosp, StSuper (walk edges)
StButche -> Arrest (statue touching)
StChoco <-> Strip0, StApart, StZoo (walk edges)
StChoco -> Death, Arrest, Factory (C commands)
StHosp <-> StButche, StHotel (walk edges, inferred)
StHosp -> Death (C command)
StHotel <-> StHosp, StSuper (walk edges)
StHotel -> Lobby, Ward (C commands)
StSuper <-> StBurger, StHotel, StButche (walk edges)
StZoo <-> StBurger, StChoco (walk edges)
StZoo -> Photo, ZooFront (C commands)

Lobby <-> Corridor (C commands)
Corridor -> Room301, Room302, Room303 (C commands)
Room301/302/303 -> Corridor (C command, return)
Room302 -> Arrest (snooping)

Floor1 <-> Floor2 <-> Floor3 <-> Floor4 (elevator)
Floor1 -> Aptment, Death (C commands)
Floor4 -> WaltRoom (C command)
WaltRoom -> Floor4 (C command, return)
WaltRoom/Safe: WaltRoom <-> Safe (implied)

ZooFront -> ZooBack -> Caveman (C commands)
ZooBack -> Death, Arrest (C commands)
LionCage -> Death, Arrest (C commands)

Factory -> LiftRoom -> Control -> Ending (C commands)
Control -> Death, Arrest (C commands)
LiftRoom -> Death, Arrest (C commands)

Arrest -> Prison (C command, one-way)
```

### Building entry patterns

Buildings are entered via `C` commands in street scenes:
- Door animation plays first (`A,0,Door,1` or similar)
- Walk-to section moves Alex into the doorway
- `C,snTarget,section` loads the interior scene
- The entry section_id (e.g., 495 for Burger, 160 for Aptment) controls where
  Alex appears inside

Building exits reverse the process, returning to the street scene with Alex
positioned at the door location.
