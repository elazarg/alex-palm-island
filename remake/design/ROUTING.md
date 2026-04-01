# Routing Design

This remake uses URL routing for two different purposes:

1. **Canonical gameplay routing**
2. **Debug-only incidental routing**

They are intentionally different.

## Core rule

The canonical URL should describe the **semantic game situation**, not the
current transient rendering moment.

So the URL should answer:

- which scene is active
- which semantic screen/sub-scene is active
- which durable gameplay facts matter for reconstruction

The URL should *not* normally answer:

- Alex's exact pixel location
- current walk frame / blink frame
- temporary hover/selection/caret state
- a transient response bubble that is only the immediate consequence of a click
- sound playback progress

## Route structure

Routes use a path-like hash:

- `#/logo`
- `#/menu`
- `#/intro/open4`
- `#/airport`
- `#/airport/dialog/guardQuestion`
- `#/airport/form/lostAndFoundForm`
- `#/airport/resource/620`
- `#/arrest/503`
- `#/prison/503`

The path identifies the **semantic screen**.

The query string inside the hash identifies **durable scene state** only.

Example:

- `#/airport/form/lostAndFoundForm?bagSize=small&bagColor=pink&correctBag=1`

## Scene-local contracts

Each scene owns its own route contract.

That means:

- `src/core/router.js` is generic
- `src/scenes/registry.js` maps scene ids to scene-specific route logic
- each scene may define:
  - default route
  - route parser
  - route normalizer
  - route formatter

For airport specifically:

- `src/scenes/airport/state.js`
  - durable airport gameplay state
- `src/scenes/airport/route.js`
  - airport screen identity and URL mapping

## Canonical vs incidental state

### Canonical state

Canonical state is:

- published continuously during gameplay
- used to reconstruct a scene meaningfully
- kept minimal

Airport canonical state currently includes:

- `bagSize`
- `bagColor`
- `correctBag`
- `bagReceived`
- `passportChecked`
- `palmettoes`
- `doorWarnings`
- `clerkRepeatCount`

### Incidental debug state

Incidental state is accepted from the URL for debugging, but is **not**
continuously tracked or republished.

That means it acts like a one-time debug injection.

For airport, the debug-only parameters are:

- `x`
- `y`
- `dir`
- `note`

Example:

- `#/airport/debug?x=700&y=120&dir=9&note=620`

This means:

- start airport
- place Alex at that approximate location/direction
- open note/text-ref section `620`

As soon as gameplay continues and the scene republishes its canonical route,
those debug-only parameters disappear from the URL. This is intentional.

Debug-only parameters are only accepted on the explicit `airport/debug` route.
They are ignored on plain `#/airport`, so stale incidental parameters cannot
silently affect normal gameplay startup.

## Publishing rules

### Scenes should publish:

- semantic screen changes
- durable state changes

### Scenes should not publish:

- transient UI state
- animation state
- debug-only incidental state

## Engine rules

There are two kinds of navigation:

1. **Cross-scene transition**
   - recreate/switch scenes
   - example: airport -> arrest

2. **In-scene route publish**
   - update URL only
   - must *not* recreate the current scene

This distinction is critical. Reopening the scene for every in-scene route
change causes resets, stutter, and duplicated startup behavior.

## Design intent

The goal is:

- every meaningful scene/screen is directly reachable
- routes are minimal and canonical
- debug entry remains powerful
- transient rendering state does not pollute gameplay routing

This is not a general-purpose engine requirement. It is a discipline for this
game so future scenes can be added with the same predictable split:

- scene-local semantic state
- scene-local route contract
- generic router/engine
