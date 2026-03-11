# Tracing Click-to-Section-ID Mapping in DOSBox-X

How the Alex Palm Island engine maps mouse clicks on hotspot regions to SCX
interactive section IDs.

## Background

The overlay (`ALEX1.OVR`) registers hotspots per scene via `call far 089E:0073`.
Each hotspot has a name, position (x, y), and a handler index. When the player
clicks in a scene, the EXE hit-tests the mouse position against a table of
click rectangles, determines which hotspot was hit, and dispatches to the
corresponding interactive section (IDs 100, 110, 120, etc.).

**What we already know** (from `re/extract_hotspots.py`):
- Hotspot names, positions, and handler indices extracted from the overlay
- The overlay function at `089E:0073` creates hotspot objects
- Mouse/hotspot handling functions in the EXE live at file offsets `0xD02C`-`0xDEB0`

**What we need to find**:
1. The runtime click rectangle table (x1, y1, x2, y2 per hotspot)
2. How the handler index maps to an SCX section ID
3. The hit-test function that checks `x1 <= mouse_x <= x2, y1 <= mouse_y <= y2`

---

## Step 1: Launch DOSBox-X with Debugger

DOSBox-X has a built-in debugger. Start it with:

```bash
dosbox-x -conf game/dosbox-x-play.conf -debug
```

Or use the play config without fullscreen so you can access the debugger:

```bash
# Create a debug-friendly config variant
dosbox-x -conf game/dosbox-x-play.conf -set "sdl fullscreen=false" -debug
```

Press **Alt+Pause** (or **Alt+Break**) at any time to enter the debugger.
The debugger window appears as a separate console.

### Debugger Basics

| Command | Effect |
|---------|--------|
| `F5` | Continue execution |
| `F9` | Toggle breakpoint at cursor |
| `F10` | Step over |
| `F11` | Step into |
| `BP seg:off` | Set breakpoint at address |
| `BPM seg:off` | Memory breakpoint (break on access) |
| `BPINT nn` | Break on interrupt `nn` |
| `D seg:off` | Dump memory |
| `C` | Continue |
| `BPLIST` | List breakpoints |
| `BPDEL n` | Delete breakpoint `n` |
| `LOG text` | Write to log |
| `MEMDUMP seg:off len` | Dump memory to file |
| `SM seg:off "bytes"` | Search memory |

---

## Step 2: Find Runtime Segment Addresses

The binary is relocatable, so segment addresses shift at load time. We need to
find the actual runtime CS values for the EXE and overlay code.

### Strategy A: Break on a Known EXE Function

The EXE has recognizable code at known file offsets. The mouse/hotspot code is
at file offsets `0xD02C`-`0xDEB0` within the main code segment (segment 1000 in
Ghidra). At runtime, this is `CS_runtime:offset`.

**Find CS for the main code segment:**

1. Let the game boot to the main menu
2. Enter debugger (Alt+Pause)
3. Break on INT 33h (mouse interrupt) to find mouse handling code:
   ```
   BPINT 33
   ```
4. Resume (`C`), then move the mouse in the game window
5. The break will fire in the mouse driver or in game code calling INT 33h
6. If you land in game code, note the CS value --- that is the runtime code segment
7. If you land in the mouse driver, step out (look for `IRET`) and the return
   address on the stack gives you the caller's CS

**Alternative: Search for known byte sequences.**

The VGA retrace wait function (`WaitRetrace` at file offset `0x165C4`) has a
distinctive pattern:

```
BA DA 03    ; mov dx, 0x03DA
EC          ; in al, dx
A8 08       ; test al, 0x08
```

In the debugger:
```
SM 0:0 "BA DA 03 EC A8 08"
```

The segment part of the found address is the runtime CS for the main code segment.

### Strategy B: Break on Overlay Load

The overlay `ALEX1.OVR` is loaded dynamically. Its segment `089E` (from Ghidra)
will be relocated. To find the runtime address of the hotspot creation function:

1. The game calls `089E:0073` to create hotspots. The `9A 73 00` byte sequence
   (CALL FAR offset 0073) appears in the overlay init functions.
2. Once you have the main CS, search for `9A 73 00` in the overlay's runtime
   segment to find scene init calls.

---

## Step 3: Find the Click Rectangle Table

### Strategy 1: Trace the Hotspot Creation Function

When a scene loads, the overlay calls `089E:0073` (runtime relocated) to
register each hotspot. This function likely writes a record into a table.

1. Break on scene load (enter a new scene in the game)
2. Search for the `089E:0073` entry point in the overlay segment
3. Set a breakpoint there:
   ```
   BP <ovr_seg>:0073
   ```
4. When it fires, examine what data is being written:
   - Check pushed parameters (on the stack): name, x, y, handler
   - Step through to find where the rectangle (x1, y1, x2, y2) is stored
   - The destination address is the click rectangle table

### Strategy 2: Trace INT 33h (Mouse Status)

The game uses INT 33h function 03h (get mouse position and button status) or
function 05h (get button press info) to read clicks.

```
BPINT 33 AX 0003   ; break on INT 33h AH=0, AL=3 (get position + buttons)
```

Or more broadly:
```
BPINT 33
```

When the break fires during a click:
- `CX` = mouse X position (in virtual pixels, may be doubled for mode 13h)
- `DX` = mouse Y position
- Step out of the INT handler back to game code
- The game code will compare these coordinates against the rectangle table
- Look for CMP/JBE/JAE instruction sequences (range checks)

### Strategy 3: Search for Rectangle Comparison Pattern

The hit-test function compares mouse coordinates against stored rectangles.
The typical pattern in 16-bit x86:

```asm
cmp ax, [bx+offset]    ; compare mouse_x with x1
jb  miss                ; if mouse_x < x1, skip
cmp ax, [bx+offset+2]  ; compare mouse_x with x2
ja  miss                ; if mouse_x > x2, skip
cmp dx, [bx+offset+4]  ; compare mouse_y with y1
jb  miss                ; if mouse_y < y1, skip
cmp dx, [bx+offset+6]  ; compare mouse_y with y2
ja  miss                ; if mouse_y > y2, skip
; hit!
```

The file offset range `0xD02C`-`0xDEB0` is where mouse/hotspot handling lives.
At runtime, this is `CS_main:D02C` through `CS_main:DEB0`. Set a range of
breakpoints or search for the comparison pattern.

### Strategy 4: Memory Breakpoint on Known Hotspot Data

From `re/extract_hotspots.py`, we know the Airport scene has hotspots like
"Guard" at position (x=6, y=155) with handler 5, and "WalkUpstairs" at
(x=0, y=119) with handler 7.

After loading the Airport scene:
1. Search memory for the handler value sequence. Handler values are small
   integers (0-15), so search for the specific pattern from the Airport scene.
2. Set a memory read breakpoint on the table:
   ```
   BPM <seg>:<found_offset>
   ```
3. Click in the scene --- the breakpoint fires when the engine reads the table
   during hit-testing.

---

## Step 4: Trace Section ID Resolution

Once you find the hit-test function, the next step is finding how the handler
index (0, 1, 2, ...) maps to a section ID (100, 110, 120, ...).

### Empirical results (from trace_click_handler.py --test-mapping)

The simple hypotheses have been **ruled out**:

- **Linear mapping (h*10+100)**: Only 6.1% accuracy across all scenes. REJECTED.
- **Index into section list**: Only 31.8% accuracy. REJECTED.
- **Handler IS section ID**: Handler values like 200, 69, 0, 10 don't match
  any interactive section IDs. REJECTED.

The "handler" value pushed before `call far 089E:0073` is NOT a section ID or
index. Example values:
- Airport: handlers 200, 200, 200, 200, 69 (sections 110-464)
- Lobby: handlers 10, 0, 10, 0, 0 (sections 100-400)
- Super: handlers 0-12 range (sections 100-450)

The handler value may be a **pixel extent** (height or width of the clickable
region), an **object type code**, or part of a more complex dispatch system.
The actual click-to-section mapping must happen elsewhere in the engine ---
likely by matching the hotspot name string against B (behavior) commands in
the SCX interactive sections.

### Next step: name-based dispatch hypothesis

Each interactive section contains B commands like `B,Guard,0` or
`B,WalkUpstairs,0`. The engine may:
1. Hit-test mouse against registered hotspot rectangles
2. Get the hotspot name (e.g., "Guard")
3. Scan interactive sections for a B command referencing that name
4. Execute that section

Test this by comparing hotspot names from `extract_hotspots.py` with B-command
arguments in the corresponding SCX files:

```bash
python3 re/trace_click_handler.py --scene Airport
python3 re/formats/parse_scx.py game_decrypted/cd/AIRPORT.SCX | grep ',B,'
```

---

## Step 5: Capture a Full Click Trace

Once you have identified the key addresses, use this procedure to log a
complete click-to-action trace:

### 1. Set breakpoints

```
BP <cs>:<hit_test_entry>        ; the rectangle comparison function
BP <cs>:<section_dispatch>       ; where the section ID is used
BPINT 33                         ; mouse interrupt
```

### 2. Log register state

When each breakpoint fires, note:
- Mouse position (CX, DX after INT 33h)
- Which rectangle matched (BX or SI pointing into table)
- The handler/index value
- The section ID passed to the SCX interpreter

### 3. Dump the rectangle table

Once you find the table address, dump it:
```
MEMDUMP <seg>:<table_start> <table_size>
```

Save the dump for offline analysis with `trace_click_handler.py`.

---

## Step 6: DOSBox-X Debug Log

For automated logging, use DOSBox-X's log facility:

```ini
# In dosbox-x config or at runtime:
[log]
logfile=alex_debug.log
```

Or use the DEBUGBOX feature: DOSBox-X can log all executed instructions to a
file when in debug mode. This generates huge output but captures everything:

```
# In debugger:
LOG "=== CLICK TRACE START ==="
LOGINSTRUCTION 1000    ; log next 1000 instructions
C                      ; continue
; ... click in scene ...
; breakpoint fires
LOGINSTRUCTION 0       ; stop logging
```

---

## Expected Output Format

The trace should reveal data like this:

```
Scene: Airport
Click at (156, 142)

Rectangle table (dumped from DS:XXXX):
  [0] x1=  0, y1=119, x2=320, y2=200  name=WalkUpstairs  handler=7  -> section 170
  [1] x1= 80, y1= 50, x2=160, y2=120  name=Guard         handler=5  -> section 150
  [2] x1=200, y1= 30, x2=280, y2= 90  name=DoorTrigger   handler=3  -> section 130
  ...

Hit: rectangle [1] (Guard), dispatching to section 150
```

---

## Scrolling Scenes

Some scenes (streets) are wider than 320 pixels (up to 1200+). In these:
- The viewport scrolls horizontally as Alex walks
- Mouse X in screen coordinates (0-319) maps to `viewport_x + mouse_x` in
  scene coordinates
- The rectangle table uses scene coordinates, not screen coordinates
- There must be a viewport offset variable added to the mouse X before hit-testing

Look for an ADD or adjustment to the mouse X coordinate before the comparison
loop. The viewport X offset is likely stored in a global variable near the
display/scroll state.

---

## Quick Reference: File Offset to Runtime Address

The main EXE code segment starts at a base that depends on the DOS load address.
Typically for a .EXE loaded at segment `S`:

```
runtime_address = (S + header_paragraphs) : file_offset_within_segment
```

For this game:
- Main code segment = `1000` in Ghidra notation
- File offset `0xD02C` = `CS_main:D02C` at runtime
- Overlay segments are loaded dynamically and their base changes

Use the VGA retrace signature search (Strategy A above) to pin down the actual
runtime CS value, then compute offsets from there.
