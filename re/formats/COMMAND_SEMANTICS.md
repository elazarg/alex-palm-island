# SCX Interactive Command Semantics

Detailed analysis of partially-understood commands in Alex Palm Island's SCX
scene scripting language. All instances collected from the 53 decrypted SCX files.

---

## 1. G Command — Give/Take Inventory Item (39 interactive uses)

**Format:** `flag,cond,G,icon_name,flag_id,add_remove`

**Parameters:**
- `icon_name`: Inventory icon sprite name (e.g., `BurgerIcon`, `PassportIcon`)
- `flag_id`: Game flag to set/clear (0 = no flag change)
- `add_remove`: `1` = add item to inventory, `0` = remove item from inventory

**Semantics: CONFIRMED** — Give item to player (add_remove=1) or take item away
(add_remove=0), and optionally set or clear the associated possession flag.

**Evidence:**

All 24 inventory items appear across the 39 G commands. The flag_id values
(1901-1922) form a contiguous "possession flag" range, one per item. When
add_remove=1, the flag is set; when add_remove=0, the item is consumed.

| Pattern | Count | Example | Meaning |
|---------|-------|---------|---------|
| `G,Icon,flag,1` | 23 | `G,BurgerIcon,1909,1` | Player acquires item |
| `G,Icon,flag,0` | 8 | `G,BurgerIcon,1909,0` | Player loses item (used/consumed) |
| `G,Icon,0,0` | 8 | `G,DrinkIcon,0,0` in BURGER:153 | Remove item, no flag change |

When flag_id=0, the possession flag is not modified. This is used for items
that are consumed as part of a larger interaction where flag tracking is
handled elsewhere (e.g., exchanging coupon for drink, using hammer to break
glass, Cindy drinking your orange juice).

**Acquisition/consumption pairs** (same item given then taken):

| Item | Acquired in | Consumed in |
|------|-------------|-------------|
| BurgerIcon | BURGER:130 | BURGER:330, LIONCAGE:240 |
| DrinkIcon | BURGER:170 | BURGER:153, BURGER:340 |
| BeefIcon | BUTCHER:125 | LIONCAGE:260 |
| HotdogIcon | BUTCHER:126 | LIONCAGE:250 |
| EggIcon | BUTCHER:165 | SUPER:310 |
| ChocolateIcon | LOBBY:235 | ZOOBACK:240 |
| MilkIcon | PHOTO:145 | PHOTO:201 |
| GlueIcon | ROOM301:125 | SAFE:130 |
| PhotoIcon | PHOTO:180 | SAFE:140 |
| ZooCouponIcon | LOBBY:110 | STZOO:185 |
| PeanutIcon | SUPER:310 | WARD:202 |
| LetterIcon | (from Spy Master) | WARD:174 |

Items acquired but never consumed via G: PassportIcon, CreditIcon, Key303Icon,
IDCardIcon, NotebookIcon, HammerIcon, BrainIcon, EnvelopeIcon, DrawerKeyIcon,
PinIcon.

**Confidence: HIGH**

---

## 2. Y Command — First-Use Branch (15 interactive uses)

**Format:** `0,0,Y,1,target_section`

**Semantics: CONFIRMED** — "If this is the first time executing this section,
continue to the next line; otherwise, jump to `target_section`."

The Y command always has `1` as its first parameter and always targets the
section ID that is exactly `current_section + 1`. It appears exclusively in
GLOBAL.SCX, in inventory item "use on world" handlers.

**All 15 instances:**

| Section | Target | Item | First-use text | Repeat text |
|---------|--------|------|----------------|-------------|
| 10002 | 10003 | PassportIcon | "Hold on to your passport..." | "Don't give anyone your passport." |
| 10005 | 10006 | ChocolateIcon | "You shouldn't leave chocolate..." | "Not everyone likes chocolate..." |
| 10020 | 10021 | BurgerIcon | "You shouldn't leave meat..." | "Nobody wants a cold burger." |
| 10022 | 10023 | DrinkIcon | "You shouldn't leave OJ..." | "Nobody wants warm OJ." |
| 10027 | 10028 | PinIcon | "Hold on to the safety-pin..." | "You don't want to prick anyone..." |
| 10030 | 10031 | GlueIcon | "Hold on to the glue..." | "You don't want to get glue on anyone..." |
| 10034 | 10035 | BeefIcon | "You shouldn't leave raw meat..." | "Nobody wants raw meat!" |
| 10036 | 10037 | HotDogIcon | "You shouldn't leave cold hotdogs..." | "Nobody wants cold hotdogs!" |
| 10038 | 10039 | PeanutIcon | "You shouldn't leave peanuts..." | "Someone may step on them..." |
| 10040 | 10041 | IDCardIcon | "Hold on to your ID card..." | "No one can use it but you!" |
| 10042 | 10043 | NotebookIcon | "Walter's diary is top secret..." | "Don't let it fall into wrong hands." |
| 10044 | 10045 | PhotoIcon | "Hold on to your picture..." | "You don't want people to remember your face!" |
| 10046 | 10047 | MilkIcon | "You shouldn't leave milk..." | "Nobody wants warm milk." |
| 10048 | 10049 | HammerIcon | "Be careful! Don't break anything!" | "If I had a hammer, I'd hammer in the morning!" |
| 10051 | 10052 | EnvelopeIcon | "Don't leave the letter around..." | "You are a spy - not a postman." |

**Pattern:** Section N has `Y,1,N+1` followed by the first-use message (L) and
X (exit). Section N+1 has only the repeat message (L) and X.

The engine tracks per-section "visited" state. On first execution, Y falls
through to the helpful hint. On subsequent executions, Y jumps to the shorter
"nag" message.

**Confidence: HIGH**

---

## 3. M Command — Move Object by Delta (7 interactive uses)

**Format:** `flag,cond,M,object_name,dx,dy`

**Semantics: CONFIRMED** — Move a named sprite object by (dx, dy) pixels
relative to its current position.

**All 7 instances:**

| Scene | Section | Flag,Cond | Object | dx | dy | Context |
|-------|---------|-----------|--------|----|-----|---------|
| ROOM301 | 150 | 1142,1 | Pillow | +29 | +4 | If drawer opened: slide pillow aside |
| ROOM301 | 150 | 1142,0 | Pillow | -29 | -4 | If drawer closed: slide pillow back |
| ROOM302 | 110 | 1121,1 | Pillow | -45 | +3 | If pillow moved: offset pillow |
| ROOM302 | 110 | 1121,0 | Pillow | +45 | -3 | If pillow not moved: restore pillow |
| STHOSP | 150 | 0,0 | Alex | +52 | +13 | Walk Alex diagonally |
| SUPER | 320 | 0,0 | Alex | -103 | +7 | Move Alex left (entering area) |
| SUPER | 330 | 0,0 | Alex | +103 | -7 | Move Alex right (leaving area) |

**Key observations:**
- Pillow instances come in conditional pairs: flag set moves one way, flag
  unset moves the opposite direction (exact negation of dx,dy).
- SUPER:320 and SUPER:330 are also exact negations, used for entering/leaving
  an area of the supermarket.
- The STHOSP instance moves Alex diagonally, likely through a gate or passage.
- Delta values are small (under 103 pixels), consistent with object nudging.

**Confidence: HIGH**

---

## 4. R Command — Reload/Refresh Scene (2 interactive uses)

**Format:** `0,0,R,1`

**All 2 instances:**

| Scene | Section | Full context |
|-------|---------|-------------|
| APTMENT | 110 | `W,0,140,130; D,9; [if flag 1315 set: L,525 + X]; F,1315,1; R,1` |
| ROOM303 | 140 | `F,1106,-1; R,1` |

**Semantics:** Refresh or reinitialize the current scene's visual state.

**Evidence:**
- In APTMENT:110, after toggling the light switch (flag 1315) and showing the
  "light is already on" text on repeat, R,1 redraws the scene to reflect the
  new light state.
- In ROOM303:140, after toggling flag 1106 (with F,1106,-1), R,1 refreshes
  the scene. The `-1` value in the F command likely toggles the flag, and R,1
  forces visual objects to re-evaluate their conditional visibility.
- The parameter is always `1`. No `R,0` instances exist in interactive sections.
- This differs from animation-context R, which has 42 uses with different
  parameter patterns.

**Confidence: MEDIUM** — Consistent with "refresh scene state" but only 2
instances. Could also mean "re-enter the current section's initialization."

---

## 5. S Command — Play Sound Effect (5 interactive uses)

**Format:** `0,0,S,sound_name`

**All 5 instances:**

| Scene | Section | Sound | Context |
|-------|---------|-------|---------|
| FLOOR1 | 110 | DrBell | Ringing the doctor's doorbell |
| FLOOR2 | 110 | DrBell | Ringing the doctor's doorbell |
| FLOOR3 | 110 | DrBell | Ringing the doctor's doorbell |
| LOBBY | 310 | sdAaargh | Old man screaming (chocolate scene) |
| LOBBYDSK | 110 | sdBell | Ringing the hotel desk bell |

**Semantics: CONFIRMED** — Play a named sound effect from the scene's sound
resource file (SD*.DAT).

**Evidence:**
- All 5 use string resource names (not numeric IDs).
- `DrBell` appears in Floor1/2/3 section 110, all "doorbell ring" interactions.
- `sdBell` is the hotel desk bell.
- `sdAaargh` plays when the old man reacts.
- Sound names match entries in the corresponding SD*.NDX index files.
- This is the interactive-context equivalent of the animation `S` command
  (which has 34 uses with numeric parameters).

**Confidence: HIGH**

---

## 6. W Command — Walk Alex (287 interactive uses)

**Format:** `flag,cond,W,mode,x,y`

**Two modes:**

| Mode | Count | Description |
|------|-------|-------------|
| `W,0,x,y` | 269 | Normal walk: Alex walks to (x,y) using pathfinding and walk animation |
| `W,1,x,y` | 18 | Instant position: Alex is placed at (x,y) immediately, no walk animation |

**All 18 W,1 instances:**

| Scene | Section | Position | Context |
|-------|---------|----------|---------|
| AIRPORT | 210,220,310 | (490,140), (210,125) | After scene transitions into airport |
| BUTCHER | 120-220 | (120,150), (25,148), (70,145), (80,150) | Inside butcher shop interactions |
| CLOTHES | 120 | (270,160) | Cindy's boutique |
| SUPER | 150-240 | (190,90), (230,115), (395,110), (530,106) | Supermarket aisle positions |

**Semantics: CONFIRMED** — W,0 animates Alex walking to the target. W,1
instantly repositions Alex without walking animation.

**Evidence:**
- W,1 appears in scenes where Alex needs to be repositioned after a camera
  angle change or when interacting with objects in close-up views (butcher
  counter, supermarket shelves, airport counters).
- W,0 is used for normal navigation where the player sees Alex walk.
- In BUTCHER, every touch/talk handler starts with W,1 to position Alex at the
  counter before the interaction, because the butcher shop is a close-up view.
- In SUPER, W,1 positions Alex at different shelf locations for each product
  interaction.
- AIRPORT W,1 at (490,140) is used in two sections (210, 220) for positioning
  Alex at the passport counter.

**Confidence: HIGH**

---

## 7. +0x44 Field — Inventory Use Handler (87 OVR writes, 35 extracted)

**Struct offset:** +0x44 on interactive click rectangle objects (Type B)

**Semantics: CONFIRMED** — Section ID to execute when the player uses an
inventory item on this object (the "bag cursor" interaction mode).

**Evidence:**

The +0x44 field stores an interactive section ID that fires when the player
selects an inventory item from the bag and clicks on the object. The target
sections typically dispatch based on which item was used:

| Scene | Object | +0x44 | Touch | Look | Target section does |
|-------|--------|-------|-------|------|---------------------|
| ZOOFRONT | (sign) | 120 | 110 | - | `L,530` (narration) |
| BEAR | (animal) | 130 | 110 | 580 | `H,1020` (NPC speech) |
| MONKEY | (3 areas) | 130,140,150 | 110 | various | `H,1010/1020/1030` (monkey talks) |
| SUPER | (checkout) | 230 | 120 | 540 | Walk to checkout + dialog |
| ROOM303 | (objects) | 170 | 190 | 540,560 | Item use on room objects |
| BURGER | (6 people) | 110-865 | 690-840 | 540-570 | Item use on burger joint NPCs |
| AIRPORT | (family, counter) | 150,210,310 | 635 | various | Item use in airport |
| LOBBY | (2 areas) | 130,330 | 130,605 | 130,600 | Item use in hotel lobby |
| LOBBYDSK | (desk) | 120 | 210 | 570 | Item use on hotel desk |

**Key pattern:** In scenes where animals refuse items (BEAR, MONKEY, ZOOFRONT,
LIONCAGE), +0x44 = 110, which routes to `C,snArrest,511` ("arrested for
disturbing animals"). The +0x44 handler often starts with walk commands
followed by item-specific branching.

**The 5 interaction modes map to struct offsets as:**
1. +0x46 = **Look** cursor (text narration via L command)
2. +0x48 = **Touch** cursor (interactive handler)
3. +0x4A = **Talk** cursor (NPC dialog)
4. +0x44 = **Use item** cursor (inventory item on object)
5. Walk cursor = handled by Type A/D click rects, not via struct fields

**Confidence: HIGH**

---

## 8. +0x62 Field — Auto-Trigger Section (7 OVR writes)

**Struct offset:** +0x62 on click rectangle objects

**All 7 instances:**

| Scene | +0x62 value | Target section exists? | Nearby objects |
|-------|-------------|----------------------|----------------|
| ZooFront | 125 | Yes: `L,535` ("bear can't hear you") | L-Fence area |
| Floor1 | 130 | Yes: `V,UpRite,1; A,0,UpRite,0; C,snFloor2,130` (go upstairs) | L-Stairs |
| Floor2 | 250 | **No** (max section=170) | L-Stairs |
| Floor3 | 250 | **No** (max section=170) | L-Stairs |
| Floor4 | 135 | **No** (max section=170) | L-Stairs |
| StBurger | 310 | **No** (max section=240) | — |
| StBurger | 310 | **No** (max section=240) | — |

**Semantics:** Walk-through or auto-trigger handler — a section that executes
when Alex walks into or through the click rectangle region, without requiring
a cursor click.

**Evidence:**
- The +0x62 writes appear in isolation (no +0x46/+0x48/+0x4A fields nearby),
  meaning these click rects have no look/touch/talk handlers.
- In Floor1, +0x62=130 triggers scene transition to Floor2 (going upstairs).
  This matches the concept of a walk-through trigger on the staircase.
- In ZooFront, +0x62=125 displays narration text ("bear can't hear you").
- The Floor2/3/4 and StBurger targets (250, 135, 310) don't exist as SCX
  sections. These may be engine-handled auto-walk section IDs, or the section
  IDs reference sections in the *destination* scene rather than the current one.
- The L-Stairs hotspot (at position 0,75) covers the staircase area. Walking
  onto it triggers the scene transition without clicking.

**Confidence: MEDIUM** — The Floor1 case clearly shows walk-through trigger
behavior, but the missing target sections in other scenes suggest the engine
may handle some +0x62 values specially.

---

## 9. Layer 2 Named Hotspot Values

**Created by:** `call far 089E:0073` with parameters (x, y, value, name)

**146 hotspots total, 26 unique handler values: 0, 1, 10, 45, 50, 59, 69, 70,
75, 80, 85, 95, 100, 110, 111, 115, 120, 123, 125, 129, 130, 135, 140-142,
145, 150-151, 155, 158, 160-161, 164-166, 170, 174, 180, 190, 200.**

**Semantics: Y-coordinate depth/priority for sprite ordering (painter's
algorithm).**

**Evidence:**

The values correlate strongly with the Y position of the hotspot, not with
section IDs or cursor types:

| Value | Hotspot examples | Y positions | Interpretation |
|-------|-----------------|-------------|----------------|
| 0 | BackSign, SignEntry, GateUp, SmallPhone | 22, 12, 1, 69 | Background/top objects |
| 1 | BackSign, Egg, WaltBed, Flowers | 38, 22, 82, 139 | Near-background |
| 140 | L-Stairs, Bed, Table | 75, 68, 71 | Mid-depth |
| 150 | Camera, TV, Drawer, Ambulanc | 88, 46, 101, 34 | Mid-foreground |
| 200 | CashRegister, Gate, Bar, Front | 81, 86, 127, 141 | Foreground/bottom |

The values determine the draw order (painter's algorithm depth sorting) for
named hotspot sprites. Objects with higher values are drawn later (in front).
This is a **Z-order / depth priority**, not a section reference or cursor type.

**Additional evidence:**
- Value 200 is the most common (20 instances) and is used for large foreground
  objects (cash registers, gates, fences, walls) that should be drawn on top.
- Value 0 (35 instances) is used for background elements (signs, gates in the
  up position, wall decorations).
- The intermediate values (100-170) correspond to mid-ground interactive
  objects like furniture, animals, and characters.
- The values do NOT correspond to section IDs (many values like 59, 69, 95
  don't match any section pattern).
- Values 141/142 in Room301/302 suggest fine-grained depth sorting between
  objects on the same bed (pillow vs key vs garbage).

**Confidence: HIGH**

---

## 10. L Command — Display Narrator Text (179 interactive uses, 45 animation)

**Format:** `flag,cond,L,section_id`

**Semantics: CONFIRMED** — Display narrator text from a text reference section
(type 1 or type 5) or show a zoom/read close-up (type 4). The narrator's voice
plays the associated sound clip.

**Target section format:** `section_id,type,sound_name` followed by text line(s).

**L targets section types:**
- Type 1 (narrator text): 141 uses — shows narrator text box with voice
- Type 4 (zoom/read): 38 uses — shows close-up image of an object (sign, item)
- Type 5 (inventory description): used in INVENT.SCX and GLOBAL.SCX

### L vs H: The Key Distinction

| Feature | L command | H command |
|---------|-----------|-----------|
| Count | 179 interactive | 250 interactive |
| Target section ID | Has header: `id,type,sound` | Bare number: just `id` |
| Target content | Narrator text (English) | NPC sprite + speech |
| Presentation | Text box with narrator voice | Character sprite with speech bubble |
| Speaker | Always narrator (sdNar*) | NPC character (BrdTlk, CowTlk, etc.) |
| Visual | No sprite change | Shows NPC talk animation sprite |
| Section ID range | 500-900 (local), 10500+ (GLOBAL) | 1000-1700+ |

**H command (250 uses)** displays an NPC character's speech with their talk
sprite animation. The target section starts with a sprite configuration line:
```
SpriteConfig x,y,sound_name
NPC's spoken text
```
Example: `H,1010` -> section `1010` -> `GrdTlk 49,11,sdEscl1` + "Not so fast,
young man!"

**L command (179 uses)** displays narrator text in a text box. The target
section has a typed header:
```
section_id,1,sdNarXXX
Narrator text here.
```
Example: `L,570` -> section `570,1,sdNar203` -> "The sign says 'Please wait
your turn'."

Or for zoom/read (type 4):
```
section_id,4,0
SpriteName,frame
```
Example: `L,520` -> section `520,4,0` -> `HotelAd,2` (shows close-up of hotel
advertisement).

**L in GLOBAL.SCX** targets sections 10501-10550 (narrator responses when
using inventory items inappropriately), all type 1 with sdNar sounds.

**Confidence: HIGH**

---

## Summary Table

| Cmd | Name | Format | Uses | Confidence |
|-----|------|--------|------|------------|
| **G** | Give/Take Item | `G,icon,flag,1/0` | 39 | HIGH |
| **Y** | First-Use Branch | `Y,1,section+1` | 15 | HIGH |
| **M** | Move Object Delta | `M,object,dx,dy` | 7 | HIGH |
| **R** | Refresh Scene | `R,1` | 2 | MEDIUM |
| **S** | Play Sound | `S,sound_name` | 5 | HIGH |
| **W,0** | Walk (animated) | `W,0,x,y` | 269 | HIGH |
| **W,1** | Walk (instant) | `W,1,x,y` | 18 | HIGH |
| **+0x44** | Use Item Handler | struct field | 87 | HIGH |
| **+0x62** | Auto-Trigger | struct field | 7 | MEDIUM |
| **Layer 2 val** | Depth/Z-order | hotspot param | 146 | HIGH |
| **L** | Narrator Text | `L,section_id` | 179 | HIGH |
| **H** | NPC Speech | `H,section_id` | 250 | HIGH |

---

## Appendix: Complete Interactive Command Reference (Updated)

| Cmd | Args | Count | Semantics | Presentation |
|-----|------|-------|-----------|--------------|
| A | `state,object,frame` | 155 | Start named animation | Sets animation state |
| B | `object,0/1` | 491 | Set object visibility | Show(1)/hide(0) named sprite |
| C | `snScene,section_id` | 77 | Scene transition | Load new scene at entry section |
| D | `direction` | 233 | Set Alex facing | 1-9 compass (8 dirs, no 5=center) |
| F | `flag_id,value` | 138 | Set game flag | 1=set, 0=clear, -1=toggle |
| G | `icon,flag_id,add` | 39 | Give/take inventory | 1=add to bag, 0=remove from bag |
| H | `section_id` | 250 | NPC speech bubble | Show NPC sprite + spoken text |
| K | `section_id` | 205 | Jump to section | Continue execution at target |
| L | `section_id` | 179 | Narrator text/zoom | Show narrator text or close-up |
| M | `object,dx,dy` | 7 | Move object by delta | Relative pixel displacement |
| O | `icon,section_id` | 47 | Item use dispatch | Route to handler for specific item |
| P | `amount` | 14 | Score penalty | Subtract Palmettoes (always negative) |
| R | `1` | 2 | Refresh scene | Re-evaluate visual state |
| S | `sound_name` | 5 | Play sound effect | Named sound from SD*.DAT |
| T | `section_id` | 105 | Start dialog tree | Enter multiple-choice dialog (2000+) |
| V | `object,value` | 227 | Set variable | Named object property |
| W | `mode,x,y` | 287 | Walk Alex | 0=animated walk, 1=instant position |
| X | (none) | 115 | Exit/return | End current command sequence |
| Y | `1,section_id` | 15 | First-use branch | Skip to target on repeat visits |
