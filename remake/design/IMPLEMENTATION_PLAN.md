# Implementation Plan

Build order designed so each phase produces something testable. Earlier phases create foundations; later phases add content.

## Phase 1: Foundation (no visible change)

**Goal**: Core systems that everything else depends on.

### 1a. GameState (`game-state.js`)
- Flag bit array (get/set/toggle)
- Inventory (add/remove/has)
- Palmettoes (add, display value)
- Save to localStorage, load from localStorage
- **Test**: Unit tests for flag set/get, inventory add/remove, save/load round-trip

### 1b. AudioManager (`audio-manager.js`)
- Extract audio code from engine.js (loadSounds, playSound, audioCtx)
- Add `playMusic(name, loop)` / `stopMusic(fadeMs)`
- Add `pauseAll()` / `resumeAll()` on visibilitychange (currently in intro.js)
- Add `ensureUnlocked()` for autoplay policy (currently in intro.js)
- **Test**: Load a sound, play it, verify pause on tab hide

### 1c. SceneManager (`scene-manager.js`)
- `setScene(scene)` — calls destroy on old, init on new
- `changeScene(sceneId, entrySection)` — async load + transition
- Fade system (fadeIn/fadeOut with callback, currently in intro.js)
- Guaranteed cleanup (removeEventListener, stopSound)
- **Test**: Transition between logo and menu uses SceneManager

### 1d. InputManager (`input-manager.js`)
- Wraps engine mouse state
- 5 cursor modes: LOOK, TOUCH, TALK, WALK, BAG
- `hitTest(clickRects, x, y)` → first matching rect
- `getCursorSprite()` → sprite name for current mode
- **Test**: Hit-test against a mock click rect array

## Phase 2: Cutscene Refactor (validates architecture)

**Goal**: Replace intro.js (753 lines) with CutscenePlayer (~200 lines) + 5 JSON descriptors.

### 2a. Extract cutscene data
- Create `data/cutscenes/opening.json` from intro.js phone steps, STREET_POS, etc.
- Create `data/cutscenes/open2.json` from WALK_POS, door sequence
- Create `data/cutscenes/spymastr.json` from DIALOG array, button positions
- Create `data/cutscenes/open3.json` from PLANE3_POS
- Create `data/cutscenes/open4.json` from credit group configs
- **Test**: JSON files parse correctly, contain all position/timing data

### 2b. Build CutscenePlayer (`cutscene-player.js`)
- Loads cutscene descriptor JSON
- Implements phase types: timeline, positionWalk, dialog, credits
- Uses AudioManager, SceneManager (for transitions)
- Handles ANIM_TICK_SCALE uniformly
- **Test**: `#intro-opening` plays identically to current intro.js

### 2c. Port each cutscene incrementally
1. Opening (phone + street) — simplest, validates timeline + positionWalk
2. Open2 (hallway + door) — validates positionWalk + sound sync
3. Open3 (plane takeoff) — validates positionWalk with growing sprites
4. Open4 (credits) — validates credits phase type
5. SpyMaster (dialog) — validates dialog phase type, bag animation
- **Test after each**: Play through from logo, verify identical behavior
- **Final**: Delete intro.js

## Phase 3: SCX Interpreter (enables gameplay)

**Goal**: Generic command executor that can run any SCX section.

### 3a. Core commands (non-blocking)
- B (toggle click rect), D (direction), F (set flag), S (sound), V (variable)
- K (jump to section — tail call within interpreter)
- X (exit section — return)
- Y (first-use branch — check visitedSections)
- **Test**: Execute a simple section with flag checks, verify state changes

### 3b. Blocking commands
- W (walk) — delegates to WalkSystem, await completion
- L (narrator text) — delegates to DialogSystem, await click
- H (NPC speech) — delegates to DialogSystem, await click/sound end
- **Test**: Execute section with W+L, verify Alex walks then text displays

### 3c. Game commands
- G (inventory give/take) — delegates to GameState
- P (score penalty) — delegates to GameState
- M (move object by delta)
- R (refresh scene)
- **Test**: G command adds item to inventory, P command changes score

### 3d. Scene transition
- C (change scene) — delegates to SceneManager, aborts current chain
- A (start animation) — delegates to AnimationPlayer
- O (item-use dispatch)
- **Test**: C command triggers scene transition

## Phase 4: First Playable Scene

**Goal**: Airport scene fully playable — walk, look, talk, exit.

### 4a. Extend AnimationPlayer
- Add D, S, R, M, L commands (see ENGINE.md table)
- Use ANIM_TICK_SCALE instead of hardcoded `* 4` / `Math.max(delay, 4)`
- **Test**: Airport arrival animation plays correctly

### 4b. Scene data extraction
- Run extract_hotspots.py for Airport → `data/scenes/airport.json`
- Parse AIRPORT.SCX → `data/scx/airport.json`
- Export Airport sprites/sounds with reexport script
- **Test**: JSON files contain expected objects, click rects, sections

### 4c. GameScene (`game-scene.js`)
- Load scene descriptor + SCX data
- Create object list, click rect array
- Execute entry section (110) via ScxInterpreter
- Render background + objects in Z-order + Alex + HUD
- Handle clicks: hit-test → dispatch to SCX section
- **Test**: Airport renders, can click on Guard, text appears

### 4d. WalkSystem (`walk-system.js`)
- Load walk-deltas.json
- `walkTo(mode, x, y)` — mode 0: animated, mode 1: instant
- Direction calculation from current pos to target
- Walk zone boundary checking
- Scrolling viewport tracking
- **Test**: Alex walks across Airport, scroll follows

### 4e. DialogSystem (`dialog-system.js`)
- L command: render text box with BitmapFont, play sound, await click
- H command: render speech bubble near NPC, cycle talk animation, await click
- Bilingual support (EN from SCX, HE from DCX)
- **Test**: Click on Guard, speech bubble appears with text

### 4f. HUD
- Panel at bottom: cursor mode buttons, score display, inventory bag
- Score: render palmettoes count with BitmapFont
- Suspicion meter: render bar
- **Test**: Score displays, changes when P command executes

## Phase 5: Remaining Systems

### 5a. Quiz dialog (T command)
- Scrambled word display
- Player rearranges into correct sentence
- +10 palmettoes on correct, flag set
- **Test**: Complete a quiz in Airport, verify score increase

### 5b. Inventory UI
- Bag opens to 3x3 grid overlay
- Click item → set BAG cursor mode
- Click on scene object → dispatch to useItem handler
- **Test**: Acquire passport at Airport, use it

### 5c. Text input puzzles
- Airport form (free-text fields)
- Phone keypad
- Safe code entry
- Drag-and-drop (Panda magazine)
- **Test**: Complete Airport form puzzle

### 5d. Music
- Convert CTMF tracks to playable format (MIDI→MP3 or OPL2 emulation)
- AudioManager.playMusic() on scene entry
- Crossfade between tracks on scene transition
- **Test**: Music plays on Airport entry, changes on scene transition

### 5e. Export remaining scenes
- Run extraction pipeline for all 36 scenes
- Each scene = JSON descriptor + SCX data + sprites + sounds
- **Test**: Walk through first 5 scenes of critical path

### 5f. Save/Load
- Save button writes GameState to localStorage
- Load button reads and restores
- Resume from saved scene + position
- **Test**: Save in Airport, reload page, verify state restored

## Phase 6: Polish

- Street navigation (10 interconnected street scenes with walk edges)
- Map system (flag 1800 gates access)
- Arrest scenes (8 trigger paths → Prison)
- Ending sequence
- DCX Hebrew text for all scenes
- Sound volume controls
- Mobile touch support

## Key Principles

1. **One scene = one JSON file + sprites**. Adding a new scene never requires code changes.
2. **SCX interpreter is generic**. Scene-specific behavior lives in SCX data, not in JS.
3. **Test each phase before moving on**. Each phase produces something playable.
4. **Extract data with scripts, don't hand-author**. The Python tools in `re/` generate all JSON from the original game files.
5. **ANIM_TICK_SCALE everywhere**. One constant controls all animation timing.
