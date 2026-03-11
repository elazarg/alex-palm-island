# Alex Palm Island — Animation Command Reference

Analysis of animation commands in SCX scene script files (sections numbered 5000+).
Based on examination of all 153 animation sections and 184 data sections across 53 SCX files.

---

## Architecture

Animation sections come in two flavors:

1. **Command sections** (type `animation`): Contain single-letter commands in `LETTER SPACE args` format.
2. **Data sections** (type `data`): Contain coordinate pairs (`x,y`) defining motion paths or position sequences.

Command sections are paired with data sections. The data section ID is typically
the command section ID + 10 (e.g., anim 5010 pairs with data 5020), or
occasionally + 1 (e.g., CONTROL.SCX anim 5020 pairs with data 5021).

Data section coordinates are pixel positions: X range 0-1089, Y range 0-198.
X values exceed 320 because the game uses scrolling backgrounds wider than the
640x200 VGA display. Y max of 198 confirms 200-pixel vertical resolution.

---

## Command Reference

### F — Frame Select (333 uses)

**Format:** `F frame_index, duration`

Selects and displays a sprite frame from the animation's bound object sprite set.

| Param | Range | Description |
|-------|-------|-------------|
| frame_index | -1 to 31 | Sprite frame number (1-indexed into NDX). 0 = base/rest frame. -1 = hide/clear (1 use). |
| duration | 0-7 | Display time in ticks. 0 = instant (no delay; usually followed by P). >0 = self-timed. |

**Frame-to-NDX mapping:** Frame indices are **per-object** and map to NDX resources
by string concatenation: `F n` loads NDX resource `OBJECTNAME` + `n`, where
OBJECTNAME is the animation object's bound name (set via the interactive `A` command
and the OVR scene init). For example, if the object is "BEAR", `F 31` loads `BEAR31`
from the scene's NDX/DAT. `F 0` loads `OBJECTNAME0` (base/rest frame). `F -1`
hides the sprite entirely (1 use).

**Verified across scenes:**
- BEAR: object BEAR has NDX sprites BEAR1–BEAR42; object MOBILE has MOBILE1–MOBILE3 (max F=3 = sprite count)
- AIRPORT: object FEMGRD has FEMGRD1–FEMGRD10 (max F=10 = sprite count)
- CLOTHES: object CINDY has CINDY1–CINDY11 (max F=11 = sprite count)

**Behavior depends on duration:**
- `F n,0` — Set frame instantly, no delay. Almost always followed by `P` for timing (109 of 127 cases).
- `F n,m` (m>0) — Display frame n for m ticks. Usually followed by another `F` (107 of 206 cases), creating fluid animation chains.

**Evidence:** In AIRPORT.SCX 5020, the repeating `F 1,0 / P 5,20 / F 2,0 / P 1,0` pattern alternates between two frames with different timings — classic blinking/idle animation. In OPENING.SCX 5010, the chain `F 1,1 / F 2,1 / F 1,1 / F 2,1` creates rapid two-frame cycling without separate P commands.

Max frame indices per file: BEAR (31), LOGO (29), CONTROL (25), ROOM303 (20), PHOTO (20), OPENING (16).

Note: Talk sprite sets (e.g., BEARTLK0–BEARTLK6) are numbered from 0 and loaded by
the dialog system, not by F commands. The TLK0 resource is a larger base/composite
image; TLK1+ are differential mouth overlays.

**Confidence: HIGH**

---

### P — Pause / Display at Position (288 uses)

**Format:** `P frame_count, delay`

Advances through the data section's position array while displaying the current frame.

| Param | Range | Description |
|-------|-------|-------------|
| frame_count | 1-40 | Number of positions to step through in the data array. |
| delay | 0-40 | Delay per step in ticks. 0 = advance without visible delay. |

**Key insight:** P is NOT simply "pause." It steps through `frame_count` entries in the paired data section, moving the sprite to each position with `delay` ticks between steps. This is the primary mechanism for smooth motion along paths.

**Evidence:**
- LOGO.SCX 5010: `P 3,0` then `G 8,0` then `P 2,0` — steps through 3 positions, jumps to entry 8, steps through 2 more.
- AIRPORT.SCX 5020: `P 5,20` — slow movement through 5 positions (5 steps, 20 ticks each = 100 ticks total).
- AIRPORT.SCX 5040: `P 1,0` and `P 1,1` — single-step positioning with 0 or 1 tick delay.
- When `delay=0`, sprite teleports through positions instantly (used for initial positioning).

**Confidence: HIGH**

---

### G — Goto Position Index (237 uses)

**Format:** `G index, 0`

Sets the current position within the paired data section's coordinate array. Second parameter is always 0.

| Param | Range | Description |
|-------|-------|-------------|
| index | -2 to 77 | Target index in data array. Positive = absolute (1-indexed). Negative = modular from end. |
| (unused) | always 0 | — |

**Special values (binary-confirmed modular arithmetic):**
- `G -1,0` (128 uses) — Jump to entry `path_length` (last entry). The handler increments -1→0, then adds path_length → path_length.
- `G -2,0` (3 uses) — Jump to entry `path_length - 1` (second-to-last entry). Seen in BURGER 5040 and CONTROL 5020/5060.
- `G n,0` (n>0) — Jump to entry n directly.

**Note:** G only sets the *target position* — it does NOT control stepping direction.
Direction (forward vs reverse) is controlled by the `D` command, which sets/clears
bit 0x200 in the object's flags word at `+0x3a`. See the D command entry.

**Binary implementation:**
```
inc arg                         ; -1→0, -2→-1
loop: if arg >= 1, break
      arg += [obj+0x37e]        ; path_length
      goto loop
[obj+0x37a] = arg               ; store as goto target
[obj+0x3c] |= 0x100             ; set goto-mode flag
call vtable+0x3c                ; begin goto movement
```

**Evidence:**
- LOGO.SCX 5010: `G 8,0 / P 2,0 / ... / G 11,0 / P 2,0 / ... / G 14,0 / ... / G 18,0 / ... / G 26,0 / ... / G 29,0`. Data section has 29 entries. G values are strictly increasing, jumping to specific waypoints.
- ENDING.SCX 5030: `G 71,0 / X 0,0 / G -1,0` — data section has 92 entries. Jump to entry 71, wait, then jump to end.
- STCHOCO.SCX 5100: `G 3,0 / ... / G 65,0 / ... / G 73,0 / ... / G 77,0 / ... / G -1,0` with 84 data entries.

**Confidence: HIGH** — binary implementation fully decoded.

---

### Q — Quit / End Section (153 uses)

**Format:** `Q` or `Q 0,0`

Terminates the animation sequence. Always the last command in a section.

Both forms appear (`Q` alone and `Q 0,0`). Every animation section ends with Q.

**Confidence: HIGH**

---

### D — Direction / Step Direction (69 uses)

**Format:** `D direction, 0`

Controls the stepping direction of the per-tick position iterator. Also affects the
visual facing of the animated object.

| Param | Range | Description |
|-------|-------|-------------|
| direction | -1, 0, 1 | 0 = forward stepping (47 uses). Nonzero = reverse stepping (22 uses). |
| (unused) | always 0 | — |

**Binary implementation:** The handler pushes `(0x200, bool(arg != 0))` to a vtable
call that sets or clears bit 0x200 in the object's flags word at `+0x3a`:
- `D 0` → clears bit 0x200 → tick handler increments position (`position++`)
- `D 1` or `D -1` → sets bit 0x200 → tick handler decrements position (`position--`)

Both D 1 and D -1 produce the same reverse-stepping effect at the bit level. Any
visual difference (turned-around sprite vs away-facing sprite) comes from frame
selection, not from the stepping direction.

**Behavior:**
- `D 0,0` appears as the first command in 41 of 44 sections that start with D. It initializes forward stepping before animation begins.
- `D 1,0` appears mid-sequence, typically after a walk completes, to reverse stepping direction before a return walk.
- `D -1,0` appears in OPEN4 (5 uses) and ENDING (1 use), always after reaching a destination, before reversing the walk path with `G 1,0`.

**Evidence:** CORRIDOR.SCX 5020: `D 0,0 / P 2,0 / G -1,0 / P 1,0 / X 0,0 / D 1,0 / G 1,0 / P 1,0 / X 0,0` — walk forward (D 0), reach end, turn around (D 1), walk back (G 1 = first position).

**Confidence: HIGH** — binary dispatch and tick handler both confirmed.

---

### V — Visibility Toggle (44 uses)

**Format:** `V visible, 0`

Shows or hides the animated sprite object.

| Param | Range | Description |
|-------|-------|-------------|
| visible | 0 or 1 | 1 = show object (25 uses). 0 = hide object (17 uses). |
| (unused) | always 0 | — |

**Common patterns:**
- `V 1,0 ... G -1,0 ... V 0,0` — Show object, animate along path, hide when done. Classic pattern in OPEN4 (5 instances): walk-on characters that appear, move along a path, and disappear.
- `V 1,0` at start of animation — make previously hidden object visible.
- `V 0,0` before Q — hide object when animation completes.

**Evidence:** OPEN4.SCX 5025: `P 5,0 / V 1,0 / G 8,0 / P 15,0 / D -1,0 / G 1,0 / V 0,0 / Q` — wait, show character, walk to entry 8, pause, turn around, walk back to start, hide character.

**Confidence: HIGH**

---

### R — Reset / Cleanup (42 uses)

**Format:** `R mode, 0`

Resets animation state before ending. Almost always immediately precedes `Q`.

| Param | Range | Description |
|-------|-------|-------------|
| mode | 0 or 1 | 0 = standard reset (41 uses). 1 = alternate reset (1 use, BURGER 5070). |
| (unused) | always 0 | — |

**Binary implementation:** The handler dispatches based on mode:
- **R 0** → calls vtable+0x30 (standard reset), then vtable+0x40 (shared cleanup)
- **R 1** → calls vtable+0x34 (alternate reset), then vtable+0x40 (shared cleanup)

The difference is vtable+0x30 vs +0x34. Most likely +0x30 restores the base sprite
frame while +0x34 preserves the current frame. The single R 1 use (BURGER 5070,
ketchup dispensing) probably keeps the dispensed ketchup visible after the animation.

**Evidence:** 41 of 42 R commands are followed directly by Q. The single exception (R 0,0 in PHOTO 5090) is in a misclassified section. Pattern `R 0,0 / Q` ends most complex animation sequences.

**Confidence: HIGH** — binary dispatch decoded; vtable method semantics inferred from context.

---

### X — Execute / Wait for Completion (40 uses)

**Format:** `X 0,0`

Parameters are always `0,0`. Synchronization barrier — waits for goto-mode motion
to complete before the animation script proceeds to the next command.

**Binary implementation:** Pushes `(0x100, 0)` to a vtable call. `0x100` is the
same goto-mode flag bit that G sets in `[+0x3c]`. X queries or blocks on this flag,
resuming only when position-stepping reaches its G target and the flag is cleared.

**Evidence:** Appears after `G n,0 / P n,m` motion sequences:
- CORRIDOR.SCX: `G -1,0 / P 1,0 / X 0,0 / D 1,0` — walk to end, wait, then change direction.
- ENDING.SCX 5030: `G 71,0 / X 0,0 / G -1,0` — move to position 71, wait, then jump to end.
- CONTROL.SCX 5010: `G 25,0 / X 0,0 / P 10,20` — move to position, wait, then display.

Also used in two-phase walk sequences: walk one direction, X to wait, then walk back.

**Confidence: HIGH** — binary confirms goto-mode flag synchronization.

---

### S — Sound Trigger (34 uses)

**Format:** `S sound_index, 0`

Triggers a sound effect at a specific point during animation playback. The handler
first checks that the sprite is on-screen before playing; off-screen objects are silent.

| Param | Range | Description |
|-------|-------|-------------|
| sound_index | 1-5 | Sound resource index (1-indexed). 1 is by far most common (25 uses). |
| (unused) | always 0 | — |

**Binary implementation:** Before playing, the handler checks visibility:
- `[obj+2] + [obj+6] > 0` (sprite not entirely off-screen left)
- `[obj+2] < 0x140` (sprite x < 320, not off-screen right)

If either check fails, the sound is skipped. This is an optimization for scrolling
backgrounds — sounds only play when the animated object is visible on screen.

**Evidence:**
- OPENING.SCX 5010 uses `S 1,0`, `S 2,0`, `S 3,0`, `S 4,0` at different points — four distinct sounds during the opening animation sequence. Each S is placed between animation frames, triggering sounds at specific moments.
- AIRPORT.SCX 5030: `S 1,0` appears between frame displays during a character animation.
- Most scenes use only `S 1,0` (a single sound), but OPENING and OPEN2 use multiple sound indices.
- Scenes with dedicated `SD*.NDX` files (for example AIRPORT, BURGER, CONTROL) use low numbered `S`
  values that fit simple 1-indexed resource selection.
- Cutscenes without dedicated `SD*.NDX` companions (OPENING, OPEN2, OPEN3, ARREST) still use `S`,
  which strongly suggests fallback to a shared global sound table such as `SDGLOBAL.NDX`.

**Confidence: HIGH** — binary visibility check confirmed; sound index mapping confirmed from data.

---

### T — Transition / Timer (6 uses)

**Format:** `T value, 0`

Stores a small mode/state value for the animated object. Rare command (6 uses across 3 files).

| Param | Range | Description |
|-------|-------|-------------|
| value | 1-6 | Stored as `value - 1` into object field `+0x1383`. |
| (unused) | always 0 | — |

**Occurrences:**
- AIRPORT.SCX 5040: `T 1,0` and `T 6,0` — in a section with `D 0,0 / G -1,0 / P 1,0 / F 1,0 / T 1,0 / D 1,0 / G 1,0 / P 1,1 / F 0,0 / T 6,0 / Q`. Appears between direction changes.
- AIRPORT.SCX 5050/5060: `T 2,0` — in walk sequences with `L` and `M` commands. Appears at the end, just before Q.
- CONTROL.SCX 5010/5060: `T 5,0` — in sequences with frame fading.

Binary evidence from the animation dispatcher:
- `cmp al, 0x54` selects the `T` handler.
- The handler loads the first argument, decrements it, and stores the result at
  object offset `+0x1383`.

This makes `T` a state/mode setter rather than a direct scene-transition opcode.
What consumes `+0x1383` is still unresolved.

**Confidence: MEDIUM**

---

### E — Animation Type Setter (5 uses)

**Format:** `E effect_type, 0`

Stores a small animation-type byte on the live animation object. Very rare.

| Param | Range | Description |
|-------|-------|-------------|
| effect_type | 2, 3, or 6 | Stored directly into object field `+0x375`. |
| (unused) | always 0 | — |

**Occurrences:**
- BURGER.SCX 5050: `E 3,0` then later `E 2,0` — bracket a motion sequence. E 3 may start an effect, E 2 may end it.
- ROOM303.SCX 5020: `E 6,0` then later `E 3,0` — E 6 after a sound trigger (S 2,0), E 3 before showing frame 20.
- PHOTO.SCX 5090: `E 2,0` at start, followed by Y/G/V commands.

Binary evidence from both the dispatcher and the tick handler:
- The `E` handler writes its first argument byte directly into object field `+0x375`.
- The per-tick animation updater (`animation_tick_handler` at `1000:A7E9`) reads
  `+0x375` **every tick** and passes it to `far call 0x10E8:0468`.
- That function returns a boolean: nonzero = continue ticking, zero = stop animation.
- The 0x10E8:0468 function body is too BP7-corrupted to decode.

So `E` sets a persistent **per-tick rendering/processing mode**. The value stays
active across ticks until changed by another `E` command. The pattern of E 3 → E 2
in BURGER (bracketing a motion sequence) is consistent with enabling then disabling
a visual effect mode.

**Confidence: MEDIUM-HIGH** — write path and per-tick consumption confirmed; exact
visual effect of each value still unknown.

---

### M — Move Delta (8 uses)

**Format:** `M dx, dy`

Moves the sprite by a relative offset. Only appears in AIRPORT.SCX sections 5050 and 5060.

| Param | Range | Description |
|-------|-------|-------------|
| dx | -60 to 60 | Horizontal pixel displacement. Negative = left, positive = right. |
| dy | always 0 | Vertical displacement (always 0 in observed uses). |

**Evidence:** AIRPORT.SCX 5050 (arrival animation):
```
L 960,50       -- set start position (960, 50)
F 1,0          -- show frame 1
P 1,1          -- step 1 position
M -60,0        -- shift left 60px
F 2,0          -- show frame 2
P 1,1          -- step 1 position
M -40,0        -- shift left 40px
...
```
Section 5060 mirrors this with positive M values (departure, moving right).
The M command shifts the sprite's base position, working alongside the data section path.

**Confidence: MEDIUM-HIGH** — Clear relative movement, but only 8 uses in one file.

---

### L — Load / Set Position (2 uses)

**Format:** `L x, y`

Sets the initial position for a walk animation sequence. Only in AIRPORT.SCX.

| Param | Range | Description |
|-------|-------|-------------|
| x | 400, 960 | Starting X position (pixel coordinates). |
| y | 50 | Starting Y position. |

**Occurrences:**
- AIRPORT.SCX 5050: `L 960,50` — start position for arrival walk (character enters from right at x=960).
- AIRPORT.SCX 5060: `L 400,50` — start position for departure walk (character starts at x=400).

Both sections use L+F+P+M sequences for walk animations with frame cycling and position offsets. These sections are classified as "data" by the parser but actually contain animation commands.

**Confidence: MEDIUM** — Clearly position-setting, but only 2 uses.

---

### Y — Y-axis Position / Vertical Offset (8 uses)

**Format:** `Y value, 0`

Sets a vertical position or Y-axis offset. Appears in STAPART.SCX and PHOTO.SCX.

| Param | Range | Description |
|-------|-------|-------------|
| value | 0, 100, 106, 176 | Position or offset value. |
| (unused) | always 0 | — |

**Occurrences:**
- STAPART.SCX 5030: `Y 0,0 / X 0,0 / ... / Y 0,0 / X 0,0 / ... / Y 100,0` — Y appears paired with X (execute). Y 0 = ground level, Y 100 = elevated or final state.
- STHOTEL.SCX 5010: Same pattern as STAPART — `Y 0,0 / X 0,0` repeated, ending with `Y 100,0`.
- PHOTO.SCX 5090: `Y 106,0` then later `Y 176,0` — specific Y coordinates for positioning elements.

In STAPART/STHOTEL, Y 100 at end (without X after it) may signal completion. In PHOTO, the values are pixel Y-coordinates for object placement.

**Confidence: LOW-MEDIUM**

---

### K — Jump to Interactive Section (3 uses)

**Format:** `K section_id, 0`

Jumps to an interactive section (100-499 range) during animation playback. Only in BEAR.SCX.

| Param | Range | Description |
|-------|-------|-------------|
| section_id | 140, 150 | Target interactive section ID. |
| (unused) | always 0 | — |

**Evidence:** BEAR.SCX 5010:
```
D  0,0        -- set direction
F  31,1       -- show frame 31
K  150,0      -- jump to section 150 (show BabyUp, hide BabyDown)
G  -1,0       -- go to end position
P  5,10       -- walk path
F  31,1       -- show frame 31 again
G  -1,0       -- go to end
P  5,10       -- walk path
F  1,1        -- show frame 1
K  140,0      -- jump to section 140 (hide BabyUp, show BabyDown)
G  31,0       -- go to position 31
P  1,1        -- step
K  150,0      -- jump to section 150 again
G  -1,0       -- go to end
R  0,0        -- reset
Q             -- end
```

Sections 140 and 150 toggle visibility of bear cub objects (BabyUp/BabyDown). K allows animation sequences to trigger game state changes mid-animation.

**Confidence: HIGH**

---

### O — Object Callback (4 uses)

**Format:** `O 1, 0`

Triggers an object-level callback or completion event. Only value observed is
`O 1,0`.

**Occurrences:**
- OPEN2.SCX 5020: `G 33,0 / X 0,0 / G -1,0 / O 1,0 / Q` — at end after motion complete.
- OPEN2.SCX 5050: `S 2,0 / G -1,0 / P 1,0 / O 1,0 / Q` — at end after sound and motion.
- OPEN3.SCX 5010: `S 1,0 / V 1,0 / G -1,0 / V 0,0 / P 3,0 / O 1,0 / Q` — at end.
- OPENING.SCX 5020: `I 20,0 / P 3,0 / S 1,0 / G -1,0 / P 4,0 / O 1,0 / Q` — at end.

Binary evidence from the dispatcher:
- The `O` handler pushes `(0, -1, arg)` and far-calls `1000:67C6`.
- The target function writes to object field `+0x10`.
- Separately, the `I` command's handler calls `anim_I_cmd_exec_section` (1000:66CF),
  which reads `+0x10` and passes it to `scx_exec_section` (1000:48BB).
- So O and I share the `+0x10` field: O writes a completion/status code, and the
  section execution chain reads it to determine which interactive section to run next.

Since all four uses are cutscene-terminal and always sit just before `Q`, O likely
signals "this cutscene phase is complete" by writing a status code that the
cutscene sequencer later reads to advance to the next scene.

**Confidence: MEDIUM-HIGH** — write target (+0x10) and reader chain confirmed;
exact computation in the O target function is BP7-corrupted.

---

### I — Execute Interactive Section (1 use)

**Format:** `I section_id, 0`

Triggers execution of an interactive SCX section from within animation context.
Single occurrence in OPENING.SCX section 5020: `I 20,0`.

Appears at the very start of the section, before any other animation commands.
`I 20,0` likely executes interactive section 20 as initialization/setup before
the animation plays (e.g., setting flags, showing/hiding objects).

**Binary implementation:**
- Handler at `0xAB84` loads the scene manager pointer `[0x30A8]`, accesses
  offset `+0x0A`, and does setup (middle section heavily BP7-corrupted).
- Eventually calls `anim_I_cmd_exec_section` (1000:66CF).
- That function reads object field `+0x10` and passes it to `scx_exec_section`
  (1000:48BB) — the standard SCX section executor.

The I/O command pair shares the `+0x10` field: I reads it to execute a section,
O writes to it to set a completion code.

**Confidence: MEDIUM-HIGH** — function call chain confirmed (I → exec_section →
scx_exec_section); exact argument passing is BP7-corrupted.

---

## Common Command Sequences

### 1. Frame-Pause Loop (idle/blinking animation)

```
F 1,0          -- show frame 1
P 5,20         -- hold for 5 steps, 20 ticks each
F 2,0          -- show frame 2 (e.g., eyes closed)
P 1,0          -- hold for 1 step, 0 ticks (brief)
```

Repeated 5-6 times in AIRPORT.SCX 5020/5030. Creates a blinking/breathing effect where frame 1 (eyes open) is shown for a long time and frame 2 (eyes closed) is shown briefly.

### 2. Rapid Frame Chain (fluid animation)

```
F 1,1          -- frame 1 for 1 tick
F 2,1          -- frame 2 for 1 tick
F 1,1          -- frame 1 for 1 tick
F 2,1          -- frame 2 for 1 tick
```

Consecutive F commands with duration > 0. Used in OPENING.SCX 5010 for walking cycle. No P needed because duration is built into each F command.

### 3. Walk Path (most common overall)

```
G -1,0         -- go to end of path
Q              -- done
```

The simplest pattern (22 occurrences). Tells the object to walk the entire data path and end. Used for background characters in FLOOR1-4.

### 4. Walk-On/Walk-Off Character

```
P 5,0          -- wait 5 steps (delay before appearing)
V 1,0          -- show character
G -1,0         -- walk to end of path
P 10,0         -- pause at destination
D -1,0         -- turn around
G 1,0          -- walk back to start
V 0,0          -- hide character
Q
```

5 instances in OPEN4.SCX. Characters walk on-screen, pause, then walk off.

### 5. Walk-and-Wait (interactive)

```
D 0,0          -- face forward
P 2,0          -- walk 2 steps
G -1,0         -- go to end
P 1,0          -- step to final position
X 0,0          -- wait/sync
D 1,0          -- turn around
G 1,0          -- go to start
P 1,0          -- step back
X 0,0          -- wait/sync
Q
```

CORRIDOR.SCX 5020/5050. Two-phase walk with direction changes and synchronization.

### 6. Standard Ending

```
R 0,0          -- reset state
Q              -- end
```

41 of 42 R commands are followed by Q. This is the standard cleanup pattern for complex animations.

### 7. Direction-Frame-Walk (NPC animation)

```
D 0,0          -- set initial direction
F 1,1          -- show walking frame
G -1,0         -- walk to end of path
R 0,0          -- reset
Q
```

Most common pattern for simple NPC walk animations (STBUTCHE, STRIPAIR, STHOSP, etc.).

---

## Bigram Analysis (command-pair frequencies)

| Pair | Count | Interpretation |
|------|-------|----------------|
| F -> P | 113 | Frame then pause (display frame at positions) |
| P -> F | 111 | After pause, change frame |
| F -> F | 107 | Consecutive self-timed frames |
| G -> P | 102 | Jump to position then walk |
| P -> G | 74 | After walking, jump to new position |
| F -> G | 63 | After setting frame, jump position |
| G -> Q | 53 | Walk to end and finish |
| R -> Q | 41 | Reset and finish |
| D -> F | 37 | Set direction then show frame |
| D -> G | 24 | Set direction then jump position |
| G -> X | 24 | Jump position then wait |

---

## Data Section Analysis

### Coordinate Pairs

95 data sections contain pure numeric pairs. 85 additional sections contain mixed numeric/single-value lines.

**Position ranges:**
- X: 0 to 1089 (supports scrolling backgrounds wider than 640px display)
- Y: 0 to 198 (within 200px vertical resolution)

**Motion patterns across 94 pure-numeric data sections:**
- Complex/multi-directional paths: 38
- Static positions (small variation): 22
- Decreasing X (moving left): 15
- Y-stable with X variation (horizontal walk): 13
- Increasing X (moving right): 6

### Section Pairing Rules

1. **Primary pairing (offset +10):** Animation section N pairs with data section N+10 (e.g., 5010 -> 5020). Most common pattern.
2. **Alternate pairing (offset +1):** Used in CONTROL, FACTORY, LIFTROOM (e.g., 5020 -> 5021).
3. **No data section:** Some animation sections have no paired data (e.g., simple frame-only animations in BEAR, CLOTHES, LOBBY).

---

## Misclassified Sections

The parser's classification heuristic (checking if the first line starts with PVGFDSRXQ) causes some sections to be misclassified:

1. **AIRPORT.SCX 5050/5060** — Classified as "data" but contain L/F/P/M/T/Q command sequences (walk animations with delta movement).
2. **OPENING.SCX 5020** — Classified as "data" but contains I/P/S/G/O/Q commands.
3. **PHOTO.SCX 5090** — Classified as "data" but contains E/Y/G/P/V/F/Q commands.

These sections start with commands (L, I, E) not in the heuristic's check list.

---

## GLOBAL.SCX (Special Case)

GLOBAL.SCX sections numbered 10000+ are NOT animation sections despite having numeric IDs >= 5000. They are text reference sections with the format `section_id,type,sound_name` (e.g., `10502,1,sdNar131`). The body contains English narrator text. These should be excluded from animation analysis.

---

## Open Questions

1. **E effect values:** ~~Mostly resolved via game context analysis.~~
   `E` writes to `+0x375`, consumed every tick by overlay function `10E8:0468`
   (overlay segment, not in flat dump). The consumer can pause the animation
   tick (skip redraw) while the effect plays. Game context reveals:
   - `E 2`: camera flash / bright overlay (PHOTO: camera flash sequence;
     BURGER: ketchup effect reset). Also hardcoded at 0x5C44, 0x5D29 via `[+0x7b]`/`[+0x7f]`.
   - `E 3`: transition/state change (BURGER: ketchup squirt activation;
     ROOM303: post-flicker state). Also hardcoded at 0x0A5B9.
   - `E 6`: flicker/strobe effect (ROOM303: TV screen flicker, paired with
     object "Flicker" and `V Flicker,1`).
   - `E 1`: only hardcoded (0x07A8D), not used in SCX data.
   - `E 0`: implicit clear (field zeroed elsewhere).
   Confidence: **MEDIUM-HIGH** (effect types identified from game scenes;
   exact rendering in overlay function `10E8:0468` unverified).

2. **T state signal:** ~~Mostly resolved via game context analysis.~~
   `T` writes `arg-1` to `+0x1383`. The nearby field `+0x137f` (4 bytes
   earlier) suppresses per-tick redraw when nonzero. Each field has exactly
   one access in the visible code — the connection likely runs through the
   overlay at `10E8:0468` or a vtable method. Game context reveals T is a
   **completion/state signal** for multi-phase animations:
   - `T 1`: "forward phase active" (AIRPORT guard walk forward)
   - `T 2`: "arrival complete" (AIRPORT NPC walk-on from off-screen)
   - `T 5`: "cutscene segment complete" (CONTROL passport check)
   - `T 6`: "reverse phase active" (AIRPORT guard walk reverse)
   Used only in AIRPORT (4 uses) and CONTROL (2 uses).
   Confidence: **MEDIUM-HIGH** (semantics clear from animation context;
   exact mechanism linking `+0x1383` → `+0x137f` unverified).

3. **Y depth update:** ~~Resolved via cross-site abstract interpretation.~~
   Pushes (arg, object_segment) then calls target `0x0D1A` via `b1 9a` stub.
   Cross-referencing all 4 call sites for this target reveals it is a
   **Y-coordinate / depth notification callback**:
   - Site 2 (0x9B03): writes new (x,y) to object `+0x02`,`+0x04`, then calls
     with `+0x04` (y position) — position update notification.
   - Site 4 (0xB844): copies `(+0x62, +0x64)` to scene_mgr `(+0x02, +0x04)`,
     then calls with `+0x64` — walk-trigger coordinate → scene manager.
   - Site 3 (0xAD4E): the Y animation command itself.
   All values (0, 100, 106, 176) are valid Y pixel coordinates on a 200-line
   screen. `Y n` sets the animated object's Y depth/position for z-order sorting.
   Confidence: **HIGH** (only the callback's internal implementation remains
   unverified due to `b1 9a` stub).

Resolved since the earlier draft:
- `F` duration and `P` delay both use the same per-tick timing field `+0x36F`.
- `P` path stepping is wraparound rather than clamp when it overruns the data
  section length.
- `T` is a state/mode setter that stores `arg-1` into `+0x1383`.
- Frame indexing: F indices are per-object, 1-indexed, mapping to NDX resources
  by name concatenation (`OBJECTNAME` + `n`). Verified across BEAR, AIRPORT,
  CLOTHES scenes.
- Cutscene sound fallback: S selects the Nth sound from the scene's SD*.NDX;
  cutscenes without a dedicated SD file fall back to SDGLOBAL.NDX.
- G negative indices: modular arithmetic (`arg + path_length`), not direction control.
  G -1 = last entry, G -2 = second-to-last.
- D controls stepping direction: sets/clears bit 0x200 in `+0x3a`. D 0 = forward
  (inc), D nonzero = reverse (dec).
- R mode 0 vs 1: mode 0 calls vtable+0x30, mode 1 calls vtable+0x34; both then
  call vtable+0x40. The BURGER ketchup animation uses R 1 (likely preserves frame).
- X: pushes (0x100, 0) — synchronizes on the goto-mode flag set by G.
- I: calls `anim_I_cmd_exec_section` → `scx_exec_section`. Executes an interactive
  section from animation context. Shares `+0x10` field with O.
- O: writes completion code to `+0x10` via far call to 1000:67C6. Cutscene-terminal
  signal.
- S: visibility-gated — checks `x+width > 0` and `x < 320` before playing sound.
- Y: calls target `0x0D1A` (Y-depth notification) via `b1 9a` inline stub.
  Cross-site analysis of all 4 callers confirms it updates Y position for z-order.
  Values 0, 100, 106, 176 are pixel Y coordinates on a 200-line screen.

---

## Summary Table

| Cmd | Format | Count | Meaning | Confidence |
|-----|--------|-------|---------|------------|
| F | `F frame,duration` | 333 | Select per-object NDX sprite frame (1-indexed by name concat); duration>0 = self-timed | HIGH |
| P | `P steps,delay` | 288 | Step through N data positions with delay per step | HIGH |
| G | `G index,0` | 237 | Jump to position index (modular: -1=last, -2=second-to-last) | HIGH |
| Q | `Q [0,0]` | 153 | End animation section | HIGH |
| D | `D direction,0` | 69 | Set stepping direction: 0=forward (clear bit 0x200), nonzero=reverse (set bit 0x200) | HIGH |
| V | `V visible,0` | 44 | Show (1) or hide (0) the sprite | HIGH |
| R | `R mode,0` | 42 | Reset/refresh: mode 0→vtable+0x30, mode 1→vtable+0x34, both→vtable+0x40 | HIGH |
| X | `X 0,0` | 40 | Synchronize: push (0x100,0) — wait for G goto-mode flag to clear | HIGH |
| S | `S index,0` | 34 | Play Nth sound from scene's SD*.NDX (1-indexed, visibility-gated) | HIGH |
| M | `M dx,dy` | 8 | Move sprite by relative pixel offset | HIGH |
| Y | `Y value,0` | 8 | Set Y depth/position for z-order sorting (0x0D1A callback) | HIGH |
| T | `T value,0` | 6 | Animation phase/completion signal: 1=fwd, 2=arrived, 5=done, 6=rev | MEDIUM-HIGH |
| E | `E type,0` | 5 | Visual effect: 2=flash, 3=transition, 6=flicker (overlay 10E8:0468) | MEDIUM-HIGH |
| O | `O 1,0` | 4 | Write completion code to `+0x10` via 1000:67C6 (cutscene terminal) | MEDIUM-HIGH |
| K | `K section,0` | 3 | Jump to interactive section mid-animation | HIGH |
| L | `L x,y` | 2 | Set initial sprite position | MEDIUM |
| I | `I value,0` | 1 | Execute interactive section from animation (via scx_exec_section) | MEDIUM-HIGH |
