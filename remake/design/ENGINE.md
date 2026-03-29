# Engine Architecture

## Module Breakdown

```
remake/src/
  engine.js              Core: canvas, tick loop, asset cache, drawSprite
  scene-manager.js       Scene lifecycle, fade effects, transitions
  scx-interpreter.js     Generic SCX interactive command executor (19 commands)
  animation-player.js    SCX animation command executor (17 commands)
  dialog-system.js       L/H/T command presentation (narrator, NPC speech, quizzes)
  walk-system.js         Alex movement: directions, deltas, zones, scrolling
  game-state.js          Flags, inventory, score, save/load (pure data, no UI)
  input-manager.js       Mouse state, 5 cursor modes, hit-testing click rects
  audio-manager.js       Music tracks (loop, crossfade), SFX, tab-visibility pause
  font.js                Bitmap font renderer (exists, no changes)

  scenes/
    cutscene-player.js   Data-driven cutscene runner (replaces intro.js)
    game-scene.js        Interactive scene runner (the main game)
    logo.js              Logo animation (exists, minor refactor)
    mainmenu.js          Main menu (exists, minor refactor)
```

## Dependency Graph

```
main.js
  SceneManager -> Engine
  GameState

CutscenePlayer
  AnimationPlayer
  AudioManager
  SceneManager (transitions)

GameScene
  ScxInterpreter -> GameState
                 -> DialogSystem -> BitmapFont, AudioManager
                 -> WalkSystem
                 -> AnimationPlayer
  InputManager -> Engine
  AudioManager -> Engine
```

## Engine Core (engine.js)

Keeps current responsibilities. Changes:
- Remove `setScene()` — SceneManager owns this
- Keep `loadImages()`, `loadSounds()`, `drawSprite()`, asset cache
- Keep tick accumulator loop, cursor drawing
- SceneManager registers itself as the tick/render target

## Scene Manager (scene-manager.js)

Owns the scene lifecycle and guarantees cleanup.

```
interface Scene {
  load(engine)          // async: fetch assets
  init()                // setup state, register handlers
  tick()                // fixed-rate update
  render(ctx)           // draw frame
  destroy()             // cleanup handlers, stop sounds
  onDone: Function      // callback for scene completion
}
```

Lifecycle:
```
Load   -> fetch scene descriptor + assets (async)
Init   -> create objects, execute entry section, start music, fade-in
Run    -> per-tick: process animations, walk, dialog, input
           per-frame: render layers, fade overlay, cursor
Transition -> fade-out, destroy current, load+init next, fade-in
Cleanup -> guaranteed: stop sounds, remove listeners, clear state
```

Fade system:
- `fadeIn(callback)` / `fadeOut(callback)`
- Black overlay with alpha, FADE_TICKS = 18 (~1 second)
- Rendered AFTER scene content, BEFORE cursor

## Event Loop

Per tick (55ms, 18.2 Hz):
```
1. SceneManager.tick()
   -> scene.tick()
      GameScene:
        if walkSystem.isWalking(): walkSystem.step()
        for each animation: animationPlayer.tick()
        if dialogSystem.active: dialogSystem.tick()
        if scrolling: updateViewport()
      CutscenePlayer:
        advance timeline, process sound triggers, check phase end
   -> fadeEffect.tick()

2. Engine._frame() (requestAnimationFrame, ~60fps):
   accumulate ticks -> call tick per accumulated
   ctx.clearRect()
   scene.render(ctx)
   fadeOverlay if fading
   cursor at mouse position
```

## Input Manager (input-manager.js)

5 cursor modes (matching original):
```
LOOK   -> click dispatches to clickRect.handlers.look (L command)
TOUCH  -> click dispatches to clickRect.handlers.touch (SCX section)
TALK   -> click dispatches to clickRect.handlers.talk (H command)
WALK   -> click starts walk to clicked position
BAG    -> click dispatches to clickRect.handlers.useItem (O command)
```

Hit-testing:
- Iterate click rects front-to-back (reverse creation order)
- Return first rect containing (mouseX, mouseY)
- Read section ID from rect's handler field for current cursor mode
- Pass section ID to ScxInterpreter.execute()

## SCX Interpreter (scx-interpreter.js)

Executes one SCX section: an array of conditional commands.

```
execute(sectionId):
  commands = scxData.sections[sectionId]
  for { flag, cond, cmd, args } in commands:
    if flag != 0 and gameState.getFlag(flag) != cond: continue
    dispatch(cmd, args)
```

Command dispatch (all 19):

| Cmd | Action | Blocking? |
|-----|--------|-----------|
| A | Start animation on object | No |
| B | Toggle click rect enabled/disabled | No |
| C | Change scene (abort current chain) | Yes (transition) |
| D | Set Alex facing direction | No |
| F | Set/clear flag | No |
| G | Give/take inventory item + set flag | No |
| H | NPC speech bubble | Yes (await click) |
| K | Jump to another section (tail call) | Replaces |
| L | Narrator text box | Yes (await click) |
| M | Move object by delta pixels | No |
| O | Item-use dispatch (bag cursor) | Delegates |
| P | Score penalty (add palmettoes) | No |
| R | Refresh scene | No |
| S | Play sound effect | No |
| T | Start quiz dialog | Yes (await completion) |
| V | Set variable | No |
| W | Walk Alex to position | Yes if mode=0 |
| X | Exit section | Returns |
| Y | First-use branch | Conditional jump |

Blocking commands (H, L, T, W mode 0) are async — the interpreter awaits them before continuing to the next command.

## Animation Player (animation-player.js)

Extend existing AnimationPlayer with all 17 SCX animation commands:

| Cmd | Current | Action |
|-----|---------|--------|
| F | Yes | Set frame, optional duration wait |
| P | Yes | Step through positions (advance frame+pos) |
| G | Yes | Jump to data index |
| V | Yes | Toggle visibility |
| Q | Yes | End animation |
| D | Add | Set stepping direction (forward/reverse) |
| R | Add | Reset animation state |
| S | Add | Trigger sound by index |
| X | Add | Wait for goto completion |
| M | Add | Relative move (dx, dy) |
| L | Add | Set absolute position |
| K | Add | Jump to interactive section |
| O | Add | Completion callback |
| I | Add | Execute interactive section from animation |
| T | Add | State setter |
| E | Add | Effect type |
| Y | Add | Y-axis position |

Key: AnimationPlayer needs a reference to AudioManager (for S) and ScxInterpreter (for K, I).

Timing: Use ANIM_TICK_SCALE constant (currently 2) applied to P delay and F duration. The AnimationPlayer currently hardcodes `Math.max(delay, 4)` and `duration * 4` — replace with `* ANIM_TICK_SCALE`.

## Audio Manager (audio-manager.js)

Extract from engine.js + intro.js visibility handling:
- `playSound(name)` — one-shot SFX, returns source for .onended
- `playMusic(trackName)` — looping background, crossfade between tracks
- `stopMusic()` — fade out current track
- `pauseOnHidden()` / `resumeOnVisible()` — automatic via visibilitychange
- `ensureUnlocked()` — handle browser autoplay policy (resume on first interaction)

## Walk System (walk-system.js)

Alex's 8-directional movement:
```
walkTo(mode, x, y):
  mode 0: animated walk — compute direction, step 9 frames per cycle
  mode 1: instant teleport

step():
  apply walk deltas for current direction + frame
  check walk zone boundaries (Type A click rects, toggled by B command)
  re-evaluate direction each 9-frame cycle
  scroll viewport for scrolling scenes (>320px wide)
  fire completion callback when target reached
```

Walk delta table loaded from `data/walk-deltas.json` (8 directions x 9 frames of dx,dy).

## Game State (game-state.js)

Pure data, no UI. Serializable for save/load.

```
GameState:
  flags: Uint8Array(1252)       // 194 used flags, range 1001-1921
  inventory: Set<number>        // acquired item slot IDs (501-524)
  palmettoes: number            // score, starts at 100
  suspicion: number             // meter value
  currentScene: string          // scene ID
  alexPos: {x, y, dir}         // position + facing
  visitedSections: Set<number>  // for Y command (first-use branch)
  objectStates: Map<string, any> // per-object visibility, position overrides

  getFlag(id): boolean
  setFlag(id, value): void
  save(): JSON string           // serialize to localStorage
  load(json): void              // deserialize
```

## Dialog System (dialog-system.js)

Three presentation modes:

**L (narrator)**: Text box at screen bottom with bilingual text (EN from SCX, HE from DCX). Sound plays. Click to dismiss.

**H (NPC speech)**: Speech bubble near NPC sprite. NPC talk animation cycles (SPYTLK pattern). Sound plays. Click to dismiss after sound ends.

**T (quiz)**: Scrambled words displayed. Player arranges into correct sentence. +10 palmettoes on correct. Completion flag set. Anti-cheat: flag cleared if wrong, preventing score farming.

All three use BitmapFont for text rendering. All block the SCX interpreter until dismissed.

## Rendering Pipeline

Per frame:
```
1. Black background (320x200)
2. Scene background (with scroll offset for wide scenes)
3. Objects in Z-order (painter's algorithm by creation order)
   - Each object: if visible, drawSprite(name+frame, x, y)
4. Alex sprite at current position/direction/frame
5. Active animations (rendered at their current frame/position)
6. Dialog overlay (text box or speech bubble) if active
7. HUD: score counter, suspicion meter, inventory panel
8. Fade overlay (black rect with alpha) if fading
9. Cursor at mouse position
```

For interactive scenes, Z-order = creation order from scene descriptor.
For cutscenes, layer order is explicit in the phase descriptor.
