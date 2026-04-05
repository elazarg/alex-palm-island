# Scene Extraction Guide

This document defines the target shape for a remake scene and the procedure for
extracting a scene from the original game.

The goal is not to clone the original implementation. The goal is:

- preserve original observable behavior
- keep scene content declarative
- keep engine/runtime reusable
- make the next scene easier to extract than the previous one

This guide is intentionally scene-oriented, not engine-oriented.

## Principles

Separate these four concerns:

1. Semantics
- What the player can interact with.
- What those things mean in the fiction.
- Which flows, text references, dialogs, forms, or transitions they trigger.

2. Topology
- Physical scene geometry extracted from the original data.
- Click rects, walk masks, walk targets, blockers, auto-trigger strips, depth.

3. Runtime script
- Scene-local logic and progression.
- Conditions, delayed steps, walk-then-trigger flows, dialog branches, payments,
  arrests, and scene transitions.

4. Theme/layout
- How a specific presentation maps semantic hotspots to the current 2D remake.
- A future theme could render the same scene in another visual style.

The engine should not know scene facts like "guard", "passport officer", or
"family queue". It should only know reusable primitives:

- walk
- face
- play scene animation
- open dialog
- open message
- open resource
- open form
- open inventory
- set/inc state
- conditional branch
- delay
- transition

## Target Files Per Scene

For a scene `foo`, the target structure should be:

- `remake/src/scenes/foo/content.js`
- `remake/src/scenes/foo/resources.js`
- `remake/src/scenes/foo/state.js`
- `remake/src/scenes/foo/route.js`
- `remake/src/scenes/foo/semantics.js`
- `remake/src/scenes/foo/topology.js`
- `remake/src/scenes/foo/theme-layout.js`
- `remake/src/scenes/foo/script.js`
- `remake/src/scenes/foo/scene.js`
- `remake/src/scenes/foo/generated/...`

Responsibilities:

### `content.js`
- asset manifest
- sound manifest
- declarative object list
- static animation sequences local to the scene
- scene-local item definitions if the scene owns them

### `resources.js`
- normalized SCX/DCX-derived content
- dialog records
- message records
- text references
- resource references

This file should not hand-transcribe prose if extraction is possible.

### `state.js`
- minimal durable semantic state for the scene
- normalization/parsing/serialization
- defaults

Keep only state that affects behavior. Do not store transient rendering state.

### `route.js`
- route schema for this scene
- screen/view identity
- route-state mapping
- canonical formatting/parsing
- optional debug-only one-shot parameters

### `semantics.js`
- semantic entities in the scene
- semantic hotspots
- affordances by mode: look/talk/touch/walk/bag
- semantic flow ids

No physical rectangles here.

### `topology.js`
- extracted physical regions from OVR/scene init
- walk masks
- click rects
- walk targets
- trigger strips
- occlusion or depth markers if needed
- semantic-to-physical bindings

No gameplay branching here.

### `theme-layout.js`
- maps semantic hotspots onto the current theme/runtime interaction model
- handles special mapping patterns such as "walk to approach target, then trigger flow"

This is where a different visual theme could diverge while reusing scene
semantics and script.

### `script.js`
- scene-local logic only
- events, bindings, forms, dialogs, messages
- progression logic
- semantic state transitions
- scene transitions

This is the declarative runtime description.

### `scene.js`
- concrete composition root for the current theme
- rendering orchestration
- movement implementation
- object ticking
- theme-specific hit-testing glue

This should not contain scene story logic if it can live in `script.js`.

## Runtime Contract

The current reusable runtime is `ScriptedScene`:

- [`scripted-scene.js`](/home/elazarg/workspace/alex/remake/src/runtime/scripted-scene.js)

It already supports a useful subset:

- `event`
- `if`
- `walkTo`
- `walkThenEvent`
- `delay`
- `face`
- `message`
- `dialog`
- `form`
- `setState`
- `incState`
- `transition`
- `sceneAnimation`

This is the right level of abstraction for scene scripts.

What should remain outside the runtime:

- scene-specific movement deltas
- scene-specific object animation clocks
- theme-specific hotspot lookup
- exact sprite composition rules for a particular NPC family

## Review Of Current Airport Design

The airport scene is already close to the intended split:

- semantics:
  - [`semantics.js`](/home/elazarg/workspace/alex/remake/src/scenes/airport/semantics.js)
- topology:
  - [`topology.js`](/home/elazarg/workspace/alex/remake/src/scenes/airport/topology.js)
- runtime script:
  - [`script.js`](/home/elazarg/workspace/alex/remake/src/scenes/airport/script.js)
- route/state:
  - [`route.js`](/home/elazarg/workspace/alex/remake/src/scenes/airport/route.js)
  - [`state.js`](/home/elazarg/workspace/alex/remake/src/scenes/airport/state.js)

This is the right direction.

But there are still architectural leaks that should guide the next scene:

### 1. Scene logic still leaks into `scene.js`

Examples:
- entry sequence constants and behavior:
  - [`scene.js:24`](/home/elazarg/workspace/alex/remake/src/scenes/airport/scene.js#L24)
- bag-item routing through `item -> bag` lookup:
  - [`scene.js:184`](/home/elazarg/workspace/alex/remake/src/scenes/airport/scene.js#L184)
- route-driven queue timer arming:
  - [`scene.js:121`](/home/elazarg/workspace/alex/remake/src/scenes/airport/scene.js#L121)
  - [`scene.js:927`](/home/elazarg/workspace/alex/remake/src/scenes/airport/scene.js#L927)

These are acceptable for now, but the target is:
- scene.js should orchestrate
- script/state/route should decide semantics

### 2. Physical rect precedence is still theme/runtime knowledge

The original engine distinguished typed regions (`B/C/D/...`) rather than flat
hotspots. Airport currently approximates that via `approachFlow` and explicit
walk targets.

This is correct behaviorally, but the reusable engine concept should be:

- ordinary interaction hotspot
- traversal-with-approach
- auto-trigger strip
- walk blocker

That should become first-class topology/runtime concepts, not airport-specific
patches.

### 3. Speaker visual composition is still ad hoc

In airport:
- [`script.js:16`](/home/elazarg/workspace/alex/remake/src/scenes/airport/script.js#L16)

This currently mixes:
- original SCX sprite family names
- remake sprite asset naming
- overlay anchors

For future scenes, the extraction result should normalize this into a scene-local
"speaker visual record" rather than hand-switching on family names.

### 4. Route state is good, but still not fully declarative

The airport route/state split is a strong improvement, but route-triggered
continuations still need explicit scene-side bootstrap logic.

That is acceptable, but the desired contract is:

- route -> state
- state -> pending runtime triggers

without scene-specific repair code scattered through init.

### 5. Note audio must come from SCX headers, not scene-local hardcoding

Original note/narrator popups carry sound names in SCX section headers, for
example:

- scene-local text refs like `590,1,sdNar206`
- global/system notes like `10999,1,sdNar176` in `GLOBAL.SCX`

Extraction rules:

- generated text modules must preserve the full section header, not just lines
- text-ref parsing must keep `sound`
- note popups should use one shared runtime path that plays `textRef.sound`
- narrator note sounds should come from a shared `assets/narration/` soundbank,
  generated from all `SD*.DAT/NDX` resources with names `sdNar*`

Do not reintroduce scene-local hacks like:

- manual `if sectionId === ... then play sound`
- separate note-audio code paths per scene
- generators that discard SCX headers

Also distinguish clearly between:

- source-backed notes: must use original text + original sound
- remake placeholder notes: may remain silent until mapped to original content

## Lessons From `STRIPAIR`

`STRIPAIR` added several extraction lessons that should be treated as part of
the standard procedure for future scenes.

### 1. Scene-specific Alex presentation is real

Do not assume Alex has one global presentation across scenes.

`STRIPAIR` requires scene-local tuning for:
- scale
- entry start and target
- idle pose
- door/entry animation placement

So `content.js` should own explicit scene-level Alex presentation constants
when needed, rather than inheriting airport defaults by accident.

### 2. Foreground props must be real scene objects

If a static prop visually occludes Alex, it must exist as a foreground object,
not only as:
- a hotspot
- a walk mask
- a region in topology

Example from `STRIPAIR`:
- the dead-end sign needs a front-layer object (`NOENTRY`) so Alex can walk
  behind it

Extraction rule:
- every visible occluding prop should be classified as `behind`, `front`, or
  fully baked into the background with no expected depth interaction

### 3. Some dialogs use grouped response records

`STRIPAIR` cat quiz dialogs are not one-choice -> one-response in the simple
airport sense.

They use:
- one shared wrong-answer response
- one correct-answer response

So SCX dialog extraction must allow:
- direct per-choice responses
- grouped wrong/correct quiz formats

This logic belongs in resource normalization/parsing, not in ad hoc scene
patches.

### 4. Reward/cost feedback is generic UI behavior

The cat quiz exposes a reusable game rule:
- positive money rewards animate into the meter from the left
- negative amounts animate out to the right
- rewards may also need a short in-dialog indicator

That should be treated as reusable panel/dialog behavior, not scene-local code.

### 5. Roads need dedicated navigation, not free walking

`STRIPAIR` shows that walk zones alone are not enough for street-like scenes.

If the original behavior is "walk around the road/obstacle", use a scene-local
navigation graph or equivalent declarative path structure. Do not force this
through increasingly complicated walk masks unless the scene is actually mask-
driven.

### 6. Use integer viewport sizing for scaled canvases

When the canvas is displayed with fractional CSS dimensions, the result can look
like the top or side row of pixels is clipped or softened.

For the remake:
- the runtime viewport should be sized to integer CSS pixels
- this is a presentation concern, not a scene concern

This should be part of the default bootstrap, because scenes with visible top
edge detail make this issue obvious.

## Extraction Procedure

This is the recommended order for a new scene.

### Step 1. Inventory the scene

From original files:

- `{SCENE}.SCX`
- `{SCENE}.DCX`
- scene OVR init functions / world extraction
- `{SCENE}.NDX` / `{SCENE}.DAT`
- `SD{SCENE}.NDX` / `SD{SCENE}.DAT`

Goal:

- list scene objects
- list click rects / blockers / walk targets / trigger strips
- list interactive handlers
- list text refs
- list dialogs
- list forms or other subsystem screens
- list scene-local flags and inventory dependencies

For airport, the original script structure is in:

- [`AIRPORT.SCX`](/home/elazarg/workspace/alex/game_decrypted/cd/AIRPORT.SCX)

The relevant reverse docs are:

- [`ENGINE_ARCHITECTURE.md`](/home/elazarg/workspace/alex/re/formats/ENGINE_ARCHITECTURE.md)
- [`FORMAT_SPEC.md`](/home/elazarg/workspace/alex/re/formats/FORMAT_SPEC.md)
- [`GAME_CONTENT.md`](/home/elazarg/workspace/alex/re/formats/GAME_CONTENT.md)

### Step 2. Extract generated raw data

Generated scene-local modules should contain raw extracted facts, not remake policy.

Examples:

- `generated/scene-text.js`
- `generated/scene-world.js`
- `generated/scene-dialogs.js` if useful

These should be produced from `tools/`, not from `re/`.

Rule:
- `re/` teaches us what the original means
- `tools/` emits remake-facing generated data

### Step 3. Build `semantics.js`

Define:

- entities
- labels
- affordances
- semantic hotspot ids
- semantic flow ids
- text-ref usage

Do not put rectangles here.

Test question:
- Could another theme render this same semantic scene without changing this file?

If no, it is not semantic enough.

### Step 4. Build `topology.js`

Map original physical data into reusable region types:

- `walkMask`
- `interactiveZone`
- `walkTarget`
- `exitTrigger`
- `occlusion`
- `marker`

This should be a translation of extracted world geometry, not gameplay logic.

Test question:
- Could we change the story logic without touching this file?

If no, logic leaked into topology.

### Step 5. Build `theme-layout.js`

This file answers:
- how does the current remake theme turn semantics + topology into runtime interactions?

Examples:
- union of multiple rects for one semantic hotspot
- `approachFlow`
- current 2D object sprite bounds

If a different theme would need different hotspot selection rules, this is the
place to diverge.

### Step 6. Build `resources.js`

Normalize extracted content into remake-facing records:

- messages
- dialogs
- forms
- text refs
- close-up resources

Do not manually retype strings unless extraction is impossible.
Preserve original spacing and punctuation.

### Step 7. Build `state.js`

Only store durable semantic state.

Good examples:
- `mayExit`
- `familyQueue`
- `bag`
- `claimColor`

Bad examples:
- current walk frame
- blink timer
- currently highlighted choice
- sound playback position

### Step 8. Build `script.js`

Use semantic events and reusable step types.

Prefer:
- `walkTo`
- `walkThenEvent`
- `delay`
- `message`
- `dialog`
- `transition`

Avoid burying content in scene.js methods unless the runtime truly lacks a
generic primitive.

### Step 9. Build `scene.js`

Only after the above exists.

Responsibilities:

- load assets
- create scene objects
- implement movement and rendering
- delegate logic to runtime script
- delegate route/state to route.js/state.js

This file should not be the first place where we discover what the scene means.

## Observable-Behavior Rule

When the original implementation mechanism is unclear:

- prefer the original observable behavior
- keep the remake primitive reusable if possible
- do not overfit to a guessed binary detail

Examples:

- blocked exits:
  - the important behavior is approach -> warning -> fallback
  - not whether the original used one rect type or two

- family queue leave:
  - the important behavior is family blocks briefly, then leaves
  - not whether the original callback was timer-driven or object-driven

## What To Reuse For Next Scenes

Before adding scene-specific code, ask if the new scene needs:

- a new step type in `ScriptedScene`
- a new reusable region kind in topology/theme mapping
- a new generic UI screen type
- a new route/view type

Add reusable primitives only when at least one scene clearly needs them, and the
primitive is still scene-agnostic.

## Checklist For A “Complete Enough” Scene

- All visible scene objects identified
- All meaningful hotspots identified
- Walk blockers and approach/trigger regions identified
- All original text refs extracted
- All dialogs extracted
- Special screens identified: form, inventory, close-up, cutscene
- Minimal durable state defined
- Route model defined
- Script model defined
- Observable blocked-exit behavior reproduced
- Payments and inventory effects are relative, not hardcoded totals
- Scene transitions are semantic and engine-level

## Airport As Baseline

Airport should remain the baseline scene for refining this guide.

The next scene should not re-solve the same problems from scratch. It should:

- reuse the current route/state/runtime contracts where they are good
- improve them where airport exposed weak boundaries
- update this document after extraction

That refinement loop is expected. This guide is intentionally not final.
