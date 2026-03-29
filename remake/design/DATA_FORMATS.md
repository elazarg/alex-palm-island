# Data Formats

All game content lives in JSON files under `remake/data/`, pre-extracted from original SCX/OVR/NDX files using the Python tools in `re/`.

## Directory Layout

```
remake/data/
  scenes/              36 scene descriptors
  scx/                 Pre-parsed SCX sections per scene
  cutscenes/           5 cutscene descriptors (opening, open2, spymastr, open3, open4)
  dialogs/             Dialog/quiz sections per scene (types 1, 2000+)
  global.json          GLOBAL.SCX: inventory use handlers
  inventory.json       24 items: slot, icon, name, flag
  walk-deltas.json     8 directions x 9 frames of (dx, dy)
  music-map.json       scene -> music track
```

## Scene Descriptor (`data/scenes/{scene}.json`)

One per interactive scene. Contains everything the scene manager needs to initialize the scene: objects, hotspots, click rects, assets.

```json
{
  "id": "airport",
  "background": "SNAIRPORT1",
  "width": 960,
  "scrolling": true,
  "musicTrack": 5,
  "entrySection": 110,
  "alexStart": { "x": 210, "y": 125, "dir": 6 },

  "objects": [
    { "name": "Desk",  "sprite": "Desk",  "x": 120, "y": 50, "visible": true },
    { "name": "Guard", "sprite": "Guard", "x": 49,  "y": 11, "visible": true }
  ],

  "hotspots": [
    { "name": "GuardHotspot", "zOrder": 150 }
  ],

  "clickRects": [
    {
      "name": "WalkZone1",
      "type": "A",
      "rect": [0, 60, 320, 140],
      "enabled": true
    },
    {
      "name": "EscGuard",
      "type": "B",
      "rect": [45, 5, 105, 105],
      "handlers": { "look": 510, "touch": 140, "talk": 150, "useItem": 151 }
    },
    {
      "name": "ToStripAir",
      "type": "C",
      "rect": [300, 80, 380, 200],
      "target": "snStripAir",
      "targetSection": 110
    }
  ],

  "assets": {
    "sprites": ["Desk", "Guard", "GrdTlk1", "GrdTlk2", "ALEX1", "ALEX2"],
    "sounds": ["sdEscl1", "sdNar198"]
  }
}
```

### Field reference

| Field | Type | Description |
|-------|------|-------------|
| objects[].sprite | string | Base sprite name (frame appended: Guard1, Guard2...) |
| objects[].visible | bool | Initial visibility (V command can change at runtime) |
| clickRects[].type | A-F | A=walk zone, B=interactive, C=exit, D=walk-to, E=special, F=raw |
| clickRects[].rect | [x,y,w,h] | Hit-test rectangle in game coordinates |
| clickRects[].handlers | object | Section IDs for look/touch/talk/useItem (type B only) |
| clickRects[].target | string | Scene to transition to (type C only) |
| hotspots[].zOrder | number | 0=back, 200=front (display ordering hint) |

## SCX Sections (`data/scx/{scene}.json`)

Pre-parsed from the encrypted SCX text files. Contains interactive sections, text refs, animations.

```json
{
  "interactive": {
    "110": [
      { "flag": 0, "cond": 0, "cmd": "B", "args": ["DoorTrigger", 1] },
      { "flag": 0, "cond": 0, "cmd": "W", "args": [1, 210, 125] },
      { "flag": 1801, "cond": 0, "cmd": "L", "args": [510] },
      { "flag": 1801, "cond": 1, "cmd": "K", "args": [120] }
    ],
    "140": [
      { "flag": 0, "cond": 0, "cmd": "W", "args": [0, 520, 150] },
      { "flag": 0, "cond": 0, "cmd": "H", "args": [1010] }
    ]
  },

  "textRefs": {
    "510": {
      "type": 1,
      "sound": "sdNar198",
      "en": "This man is a guard.",
      "he": ".רמוש אוה הזה שיאה"
    },
    "650": {
      "type": 4,
      "sprite": "Form",
      "frame": 1
    }
  },

  "npcSpeech": {
    "1010": {
      "sprite": "GrdTlk",
      "sound": "sdEscl1",
      "en": "Not so fast, young man!",
      "he": "!ריעצ ,רהמ ךכ לכ אל"
    }
  },

  "dialogs": {
    "2010": {
      "completionFlag": 1801,
      "prompt": "I am looking for @",
      "choices": [
        { "scrambled": "hot / the / el", "answer": "the hotel", "correct": true },
        { "scrambled": "port / air / the", "answer": "the airport", "correct": false }
      ]
    }
  },

  "animations": {
    "5010": {
      "commands": "D 0,0\nF 1,1\nF 2,1\nF 3,1\nR 0,0\nQ",
      "data": [[120, 140], [115, 138], [110, 135]]
    }
  }
}
```

### Conditional command format

```
{ "flag": 1801, "cond": 1, "cmd": "K", "args": [120] }
```
- `flag = 0`: always execute
- `flag != 0`: execute only if `gameState.getFlag(flag) == cond`
- `cond` is 0 (flag clear) or 1 (flag set)

## Cutscene Descriptor (`data/cutscenes/{name}.json`)

Replaces hardcoded intro.js phases. A cutscene is a linear sequence of phases.

```json
{
  "id": "opening",
  "next": "open2",
  "phases": [
    {
      "type": "timeline",
      "background": { "sprite": "BPHONE", "x": 37, "y": 20 },
      "object": "PHONE",
      "objectPos": { "x": 93, "y": 66 },
      "fadeIn": true,
      "steps": [
        { "frame": 1, "ticks": 4 },
        { "sound": "SDPHONE1" },
        { "frame": 1, "ticks": 1 },
        { "frame": 2, "ticks": 1 },
        { "frame": 1, "ticks": 7 },
        { "sound": "SDPHONE1" },
        { "frame": 2, "ticks": 1 },
        { "frame": 1, "ticks": 1 }
      ],
      "transition": "fadeOut"
    },
    {
      "type": "positionWalk",
      "background": { "sprite": "BSTREET", "x": 37, "y": 10 },
      "object": "STREET",
      "positions": [[260,0],[209,10],[141,34],[75,57],[37,78]],
      "ticksPerStep": 5,
      "sounds": [
        { "atTick": 0, "name": "SDSTREET1" },
        { "atTick": 10, "name": "SDCAR1" }
      ],
      "transition": "fadeOut"
    }
  ],
  "assets": {
    "sprites": ["BPHONE", "PHONE1", "PHONE2", "BSTREET", "STREET1"],
    "sounds": ["SDPHONE1", "SDCAR1", "SDSTREET1"]
  }
}
```

### Phase types

| Type | Fields | Description |
|------|--------|-------------|
| timeline | steps[] | Frame-by-frame playback with sound triggers. Each step: {frame, ticks} or {sound} |
| positionWalk | positions[], ticksPerStep | Object moves through position array. Frame = position index + 1 |
| dialog | lines[] | SpyMaster-style: play sound, show text, await button click |
| credits | groups[] | OPEN4-style: sequential credit overlays with grow/hold/exit |

### Dialog phase (`data/cutscenes/spymastr.json`)

```json
{
  "type": "dialog",
  "background": "SNSPYMASTER1",
  "layers": [
    { "sprite": "SPYTLK", "x": 95, "y": 37, "talkAnim": { "frames": 7, "ticksPerFrame": 4 } },
    { "sprite": "LAMP", "x": 32, "y": 68 }
  ],
  "bagAnimation": {
    "triggerAtLine": 6,
    "sprite": "BAG",
    "animPos": { "x": 79, "y": 37 },
    "staticPos": { "x": 79, "y": 88 },
    "frames": 16,
    "ticksPerFrame": 6
  },
  "lines": [
    { "text": "\"Good morning, Alex.\"", "sound": "SPY1" },
    { "text": "\"We have a spy named Walter.\"", "sound": "SPY2" }
  ],
  "buttons": {
    "play": { "sprite": "SPYPLAY", "x": 272, "y": 174 },
    "rewind": { "sprite": "SPYREWIND", "x": 10, "y": 174 }
  },
  "font": "smallfont"
}
```

### Credits phase (`data/cutscenes/open4.json`)

```json
{
  "type": "credits",
  "planeBackground": { "prefix": "O4PLANE", "count": 25, "ticksPerFrame": 4 },
  "groups": [
    {
      "prefix": "PROG",
      "count": 8,
      "hold": 30,
      "exitMode": "reverse",
      "center": "auto"
    },
    {
      "prefix": "ONDA",
      "count": 8,
      "hold": 40,
      "exitMode": "zoom",
      "exitCount": 7,
      "center": "auto"
    }
  ]
}
```

## Game State (`data/` references)

### Inventory (`data/inventory.json`)

```json
[
  { "slot": 501, "icon": "PassportIcon", "name": "Passport", "flag": 1901 },
  { "slot": 502, "icon": "CreditIcon",   "name": "Credit Card", "flag": 1902 },
  { "slot": 511, "icon": "BurgerIcon",   "name": "Hamburger", "flag": 1909 }
]
```

### Walk Deltas (`data/walk-deltas.json`)

```json
{
  "directions": {
    "1": [{"dx":0,"dy":0},{"dx":-4,"dy":2},{"dx":-4,"dy":3},{"dx":0,"dy":0},...],
    "2": [{"dx":0,"dy":0},{"dx":0,"dy":3},{"dx":0,"dy":3},...]
  },
  "framesPerCycle": 9
}
```

### Music Map (`data/music-map.json`)

```json
{
  "airport": 5,
  "lobby": 5,
  "sthotel": 12,
  "burger": 7
}
```

## Global Handlers (`data/global.json`)

From GLOBAL.SCX — item-use responses for all inventory items across all scenes.

```json
{
  "itemUseDefaults": {
    "PassportIcon": { "look": 10501, "elsewhere": 10520 },
    "CreditIcon": { "look": 10502, "elsewhere": 10520 }
  }
}
```

## Data Extraction Pipeline

All JSON files are generated by Python scripts in `re/`:

| Source | Tool | Output |
|--------|------|--------|
| ALEX1.OVR | extract_hotspots.py | Scene descriptors (objects, hotspots, click rects) |
| *.SCX | formats/parse_scx.py | Interactive sections, animations, dialogs |
| *.DCX | formats/parse_scx.py | Hebrew translations |
| ALEX1.DAT | export_all_assets.py | Sprites, sounds, fonts, palettes |
| ALEX1.SCX | (new script) | Walk deltas, scene music map |
| GLOBAL.SCX | (new script) | Item-use handlers |

The extraction scripts should be idempotent — re-running them regenerates all JSON from the original game files.
