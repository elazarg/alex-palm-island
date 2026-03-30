// Interactive game scene — data-driven from scene descriptor + SCX
// First implementation: Airport. Will generalize as more scenes are added.

import { BitmapFont } from '../font.js';
import { AIRPORT_SCRIPT } from './scripts/airport-script.js';

const ANIM_TICK_SCALE = 2;
const FADE_TICKS = 18;

const ACHU_SEQUENCE = [
  1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 2, 1, 1,
  1, 1, 1, 1, 3, 4, 5, 6,
  7, 8, 9, 10, 11,
];

export class GameScene {
  constructor(sceneId) {
    this.sceneId = sceneId;
    this.engine = null;
    this.onDone = null;
    this.sceneScript = sceneId === 'airport' ? AIRPORT_SCRIPT : null;

    // Scene state
    this.bgWidth = 320;    // total background width (960 for scrolling)
    this.scrollX = 0;      // viewport scroll offset

    // Alex state
    this.alexX = 160;
    this.alexY = 100;
    this.alexDir = 2;      // facing direction (numpad: 1-9, skip 5)
    this.alexFrame = 0;    // current walk frame (0-7)
    this.alexWalking = false;
    this.alexTargetX = 0;
    this.alexTargetY = 0;
    this.alexStepTick = 0;
    this.alexWalkCycleIdx = 0;

    // Fade
    this.fade = 'none';
    this.fadeAlpha = 1;
    this._fadeCb = null;

    // Declarative scene logic runtime
    this.state = {};
    this.actionQueue = [];
    this.modal = null;
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    this._interactionEnabled = {};
    this.inputMode = 'walk';

    this.uiButtons = [
      { mode: 'walk', normal: 'WALKBUTTON', pressed: 'WALKPRESSED', x: 4, y: 168, w: 48, h: 31 },
      { mode: 'look', normal: 'LOOKBUTTON', pressed: 'LOOKPRESSED', x: 56, y: 168, w: 44, h: 31 },
      { mode: 'talk', normal: 'TALKBUTTON', pressed: 'TALKPRESSED', x: 104, y: 168, w: 40, h: 31 },
      { mode: 'touch', normal: 'TOUCHBUTTON', pressed: 'TOUCHPRESSED', x: 148, y: 168, w: 40, h: 32 },
      { mode: 'bag', normal: 'CASEBUTTON', pressed: 'CASEPRESSED', x: 192, y: 167, w: 44, h: 33 },
    ];

    // Walk deltas per direction (from ALEX1.SCX walk delta table)
    // Direction mapping: 1=SW, 2=S, 3=SE, 4=W, 6=E, 7=NW, 8=N, 9=NE
    this.walkDeltas = {
      1: [{dx:0,dy:0},{dx:-4,dy:2},{dx:-4,dy:3},{dx:0,dy:0},{dx:0,dy:0},{dx:-4,dy:2},{dx:-4,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
      2: [{dx:0,dy:0},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
      3: [{dx:0,dy:0},{dx:4,dy:2},{dx:4,dy:3},{dx:0,dy:0},{dx:0,dy:0},{dx:4,dy:2},{dx:4,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
      4: [{dx:0,dy:0},{dx:0,dy:0},{dx:0,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:0,dy:0},{dx:0,dy:0}],
      6: [{dx:0,dy:0},{dx:0,dy:0},{dx:0,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:0,dy:0},{dx:0,dy:0}],
      7: [{dx:0,dy:0},{dx:-4,dy:-2},{dx:-4,dy:-3},{dx:0,dy:0},{dx:0,dy:0},{dx:-4,dy:-2},{dx:-4,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
      8: [{dx:0,dy:0},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
      9: [{dx:0,dy:0},{dx:4,dy:-2},{dx:4,dy:-3},{dx:0,dy:0},{dx:0,dy:0},{dx:4,dy:-2},{dx:4,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
    };
    this.walkFrameCycles = {
      1: [1, 2, 5, 6],
      2: [1, 2, 3, 4, 5, 6],
      3: [1, 2, 5, 6],
      4: [3, 4, 5, 6],
      6: [3, 4, 5, 6],
      7: [1, 2, 5, 6],
      8: [1, 2, 3, 4, 5, 6],
      9: [1, 2, 5, 6],
    };
  }

  async load(engine) {
    // Load scene-specific assets
    const base = `assets/${this.sceneId}`;

    // Background
    await engine.loadImages({
      'SCENE_BG': `${base}/SNAIRPORT_FULL.png`,
    });

    // Alex walk sprites (global)
    // Alex walk sprites: 8 directions, variable frame count per direction
    const alexImgs = {};
    const frameCounts = {1:8, 2:7, 3:8, 4:8, 6:8, 7:8, 8:7, 9:8};
    for (const [dir, count] of Object.entries(frameCounts)) {
      for (let frame = 0; frame < count; frame++) {
        const name = `ALEX${dir}-${frame}`;
        alexImgs[name] = `assets/alex/${name}.png`;
      }
    }
    this._frameCounts = frameCounts;
    await engine.loadImages(alexImgs);

    // Scene objects — sprites that overlay the background
    // Position and z-order from OVR scene init (extract_hotspots.py)
    const sceneImgs = {};
    // Scene objects from OVR disassembly — exact positions verified.
    // Hotspots (named, interactive):
    //   Maake (776,120), Arrive (811,0), Depart (811,0), LineSign (436,69)
    // Animated objects (named, with sprites set via SCX):
    //   Stairs (825,0), ALEXDN (838,0), Family (500,40), Guard (701,13),
    //   Trup (960,50), StaffB (500,50), P/L/G-Lost (104,16),
    //   Border (454,25), Door (273,0), FemGrd (0,0)
    // Objects split into behind-Alex and front-of-Alex layers.
    // Positions from OVR disassembly.
    this.objectsBehind = [
      // NPCs use base+overlay pattern: large base frame always drawn,
      // small overlay frames cycle on top at a matched offset.
      // Animation sequences from SCX sections, positions from data sections.

      // Lost-and-found clerk: OVR creates Achu at (111,31) and binds it to
      // section 5030. The generic SCX player was too aggressive here because
      // Achu has no position table; this explicit forward-only frame schedule
      // matches the original blink-blink-blink-then-sneeze pacing much more
      // closely.
      { name: 'Achu',    sprite: 'ACHU1',   x: 111, y: 31,  visible: true,
        anim: { prefix: 'ACHU', rate: 8, sequence: ACHU_SEQUENCE } },
      { name: 'Door',    sprite: 'DOOR1',   x: 273, y: 0,   visible: true },
      // FemGrd: F1=hat at side (idle off), F8/F10=hat on head (idle on/heels).
      // Hat ON:  F1→F2→F3→F4→F6→F7 (lift hat, diagonal place, hand down)
      // Hat OFF: F7→F6→F3→F2→F1 (hand up, grab hat, bring down; skip F4)
      { name: 'FemGrd',  sprite: 'FEMGRD1', x: 246, y: 20,  visible: true,
        anim: { prefix: 'FEMGRD', rate: 4, bottomAlign: 121,
          //       idle   hat on               heels              hat off          idle
          sequence: [1,1, 2,3,4,6,7, 8,10,8,10,8,10, 8,8, 7,6,3,2, 1,1],
          framePos: {
            1:[246,20], 2:[259,20], 3:[260,20], 4:[261,17], 5:[261,21],
            6:[261,21], 7:[260,21], 8:[254,21], 9:[254,21], 10:[254,21]
          } } },
      // Passport officer: base BRDTLK0, face overlays BRDTLK1-11 at (73,21)
      { name: 'BrdTlk',  sprite: 'BRDTLK0', x: 386, y: 2,   visible: true,
        overlay: { prefix: 'BRDTLK', rate: 8, ox: 73, oy: 21,
          sequence: [1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,
                     3,4,3,4,3,1,1,1,
                     5,6,5,6,7,8,7,8,5,6,1,1,
                     9,10,9,10,11,10,9,1,1,1,1,1] } },
      // Border (SCX 5100): hand/stamp tapping — drawn AFTER BrdTlk so it's on top.
      { name: 'Border',  sprite: 'BORDER1', x: 454, y: 25,  visible: true,
        anim: { prefix: 'BORDER', rate: 3,
          sequence: [1,2,3,4,5,6, 1,1,1,1,1,1,1,1,1,1,1,1,1,1] } },
      // Guard (SCX 5020): F1/F2 blink ×6, then discrete yawn gestures:
      // F4↔F3 arm shake, F6↔F7 hand at face, F11 yawn hold, F12→F1 return
      // (retraction skips stretched-arm frames — matches original)
      { name: 'Guard',   sprite: 'GUARD1',  x: 701, y: 13,  visible: true,
        anim: { prefix: 'GUARD', rate: 4,
          sequence: [1,1,1,1,1,1,1,2, 1,1,1,1,1,1,1,2,
                     1,1,1,1,1,1,1,2, 1,1,1,1,1,1,1,2,
                     1,1,1,1,1,1,1,2, 1,1,1,1,1,1,1,2,
                     4,3,4,3,
                     6,6,6,6, 7,7,7,7, 6,6,6,6,
                     11,11,11,11,11,11,11,11,
                     12, 1,1] } },
      // Family in front of passport officer (rendered after BrdTlk)
      { name: 'Family',  sprite: 'FAMILY1', x: 500, y: 40,  visible: false,
        anim: { prefix: 'FAMILY', rate: 5,
          sequence: [1,1,1,1,1,1,1,1,1,1,2,3,4,5,6,5,4,3,2,1,1,1,1] } },
      // Desk sign — drawn after BrdTlk so it appears on top of the desk
      { name: 'LineSign',sprite: 'LINESIGN', x: 436, y: 69, visible: true },
      { name: 'Stairs',  sprite: 'STAIRS1', x: 825, y: 0,   visible: true, anim: 'stairs' },
      // Hidden until triggered by SCX
      { name: 'ALEXDN',  sprite: 'ALEXDN1', x: 838, y: 0,   visible: false },
      { name: 'Trup',    sprite: 'TRUP1',   x: 960, y: 50,  visible: false },
      { name: 'StaffB',  sprite: 'STAFFB1', x: 500, y: 50,  visible: false },
      { name: 'Depart',  sprite: 'DEPART',  x: 811, y: 0,   visible: false },
    ];
    this.objectsFront = [
      // In front of Alex: ceiling signs, wall bases
      { name: 'Maake',   sprite: 'MAAKE',   x: 776, y: 120, visible: true },
      { name: 'Arrive',  sprite: 'ARRIVE',  x: 811, y: 0,   visible: true },
      { name: 'WallB',   sprite: 'WALL_B',  x: 0,   y: 0,   visible: true },
      { name: 'WallK',   sprite: 'WALL_K',  x: 920, y: 100, visible: true },
    ];
    this.sceneObjects = [...this.objectsBehind, ...this.objectsFront];
    for (const obj of this.sceneObjects) {
      if (!sceneImgs[obj.sprite]) {
        sceneImgs[obj.sprite] = `${base}/${obj.sprite}.png`;
      }
    }
    // Load animation frames for all animated objects
    for (let i = 1; i <= 6; i++) sceneImgs[`STAIRS${i}`] = `${base}/STAIRS${i}.png`;
    for (let i = 1; i <= 12; i++) sceneImgs[`GUARD${i}`] = `${base}/GUARD${i}.png`;
    for (let i = 1; i <= 6; i++) sceneImgs[`FAMILY${i}`] = `${base}/FAMILY${i}.png`;
    for (let i = 1; i <= 10; i++) sceneImgs[`FEMGRD${i}`] = `${base}/FEMGRD${i}.png`;
    for (let i = 0; i <= 11; i++) sceneImgs[`BRDTLK${i}`] = `${base}/BRDTLK${i}.png`;
    for (let i = 1; i <= 11; i++) sceneImgs[`ACHU${i}`] = `${base}/ACHU${i}.png`;
    // Load additional character sprites
    for (let i = 1; i <= 6; i++) sceneImgs[`BORDER${i}`] = `${base}/BORDER${i}.png`;
    for (const name of ['TRUP1','STAFFB1',
                         'DOOR1','DOOR2','FEMGRD1','ALEXDN1',
                         'WALL_B','WALL_K',
                         'MAAKE','ARRIVE','DEPART','LINESIGN','DALPAK']) {
      if (!sceneImgs[name]) sceneImgs[name] = `${base}/${name}.png`;
    }
    await engine.loadImages(sceneImgs);

    await engine.loadImages({
      PANEL: 'assets/ui/PANEL.png',
      LOOKBUTTON: 'assets/ui/LOOKBUTTON.png',
      LOOKPRESSED: 'assets/ui/LOOKPRESSED.png',
      TALKBUTTON: 'assets/ui/TALKBUTTON.png',
      TALKPRESSED: 'assets/ui/TALKPRESSED.png',
      TOUCHBUTTON: 'assets/ui/TOUCHBUTTON.png',
      TOUCHPRESSED: 'assets/ui/TOUCHPRESSED.png',
      WALKBUTTON: 'assets/ui/WALKBUTTON.png',
      WALKPRESSED: 'assets/ui/WALKPRESSED.png',
      CASEBUTTON: 'assets/ui/CASEBUTTON.png',
      CASEPRESSED: 'assets/ui/CASEPRESSED.png',
      EXITBUTTON: 'assets/ui/EXITBUTTON.png',
      EXITPRESSED: 'assets/ui/EXITPRESSED.png',
      TALKWINDOW: 'assets/ui/TALKWINDOW.png',
      ALTALK1: 'assets/ui/ALTALK1.png',
      TEXTWIN2: 'assets/ui/TEXTWIN2.png',
      TEXTWIN3: 'assets/ui/TEXTWIN3.png',
      TEXTWIN4: 'assets/ui/TEXTWIN4.png',
      TEXTWIN5: 'assets/ui/TEXTWIN5.png',
      TLKEXIT1: 'assets/ui/TLKEXIT1.png',
      TLKEXIT2: 'assets/ui/TLKEXIT2.png',
      GRDTLK0: 'assets/ui/GRDTLK0.png',
      FEMTLK0: 'assets/ui/FEMTLK0.png',
      FAMTLK0: 'assets/ui/FAMTLK0.png',
    });

    const fontImg = new Image();
    const fontData = await (await fetch('assets/mainfont.json')).json();
    await new Promise((resolve, reject) => {
      fontImg.onload = resolve;
      fontImg.onerror = reject;
      fontImg.src = 'assets/mainfont.png';
    });
    this.font = new BitmapFont(fontImg, fontData);

    // Cursors
    await engine.loadImages({
      'ARROWCURSOR': 'assets/cursors/ARROWCURSOR.png',
      'LOOKCURSOR': 'assets/cursors/LOOKCURSOR.png',
      'TALKCURSOR': 'assets/cursors/TALKCURSOR.png',
      'TOUCHCURSOR': 'assets/cursors/TOUCHCURSOR.png',
      'WALKCURSOR': 'assets/cursors/WALKCURSOR.png',
    });

    // Escalator animation state
    this.stairsTick = 0;
    this.stairsFrame = 1;

    this.bgWidth = engine.assets.get('SCENE_BG')?.width || 320;
    this.objectByName = Object.fromEntries(this.sceneObjects.map(obj => [obj.name, obj]));
  }

  init() {
    this._setInputMode('walk');
    this._initSceneScript();

    // Airport: Alex starts at escalator area (right side of 960px scene)
    this.alexX = 840;
    this.alexY = 140;
    this.alexDir = 4; // facing left (west)
    this.scrollX = Math.max(0, this.alexX - 160); // center viewport on Alex

    // Walk zones — type A rectangles from OVR, expanded to cover actual
    // walk destinations from SCX W commands (y ranges 60-150).
    // Original zones define click-target areas; floor Y extends further.
    this.walkZones = [
      [0, 95, 300, 160],       // left floor (lobby/lost&found area)
      [250, 55, 400, 160],     // door corridor
      [350, 95, 960, 160],     // main floor (passport to escalator)
      [785, 90, 960, 160],     // right floor near escalator
    ];

    this._fadeIn();

    // Click handler
    const canvas = this.engine.ctx.canvas;
    this._onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / (rect.width / 320);
      const my = (e.clientY - rect.top) / (rect.height / 200);

      if (this.modal) {
        this._handleModalClick(mx, my);
        return;
      }

      const button = this._getUiButton(mx, my);
      if (button) {
        this._setInputMode(button.mode);
        return;
      }

      if (this.actionQueue.length) return;

      // Convert screen coords to world coords
      const worldX = mx + this.scrollX;
      const worldY = my;

      const interaction = this._findInteraction(worldX, worldY, this.inputMode);
      if (interaction) {
        this._queueEvent(interaction.eventId);
        return;
      }

      if (this.inputMode !== 'walk') return;

      // Only walk to positions inside a walk zone
      if (!this._inWalkZone(worldX, worldY)) return;

      this._startWalk(worldX, worldY);
    };
    canvas.addEventListener('mousedown', this._onMouseDown);
  }

  _calcDirection(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180 to 180
    // Map angle to numpad direction
    if (angle >= -22.5 && angle < 22.5) return 6;   // E
    if (angle >= 22.5 && angle < 67.5) return 3;    // SE
    if (angle >= 67.5 && angle < 112.5) return 2;   // S
    if (angle >= 112.5 && angle < 157.5) return 1;  // SW
    if (angle >= 157.5 || angle < -157.5) return 4;  // W
    if (angle >= -157.5 && angle < -112.5) return 7; // NW
    if (angle >= -112.5 && angle < -67.5) return 8;  // N
    if (angle >= -67.5 && angle < -22.5) return 9;   // NE
    return 2;
  }

  _initSceneScript() {
    this.state = { ...(this.sceneScript?.initialState || {}) };
    this.actionQueue = [];
    this.modal = null;
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    this._interactionEnabled = {};

    const interactions = this.sceneScript?.interactions || [];
    for (const interaction of interactions) {
      this._interactionEnabled[interaction.id] = interaction.enabled !== false;
    }
    this._applyBindings();
  }

  _evaluateCondition(condition) {
    if (!condition) return true;
    const value = this.state[condition.state];
    if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return value === condition.equals;
    if (Object.prototype.hasOwnProperty.call(condition, 'gte')) return value >= condition.gte;
    if (Object.prototype.hasOwnProperty.call(condition, 'lte')) return value <= condition.lte;
    return Boolean(value);
  }

  _applyBindings() {
    if (!this.sceneScript?.bindings) return;
    for (const binding of this.sceneScript.bindings) {
      const active = this._evaluateCondition(binding.when);
      if (binding.type === 'objectVisible') {
        const obj = this.objectByName?.[binding.object];
        if (obj) obj.visible = active;
      } else if (binding.type === 'interactionEnabled') {
        this._interactionEnabled[binding.interaction] = active;
      }
    }
  }

  _setInputMode(mode) {
    this.inputMode = mode;
    const cursorByMode = {
      walk: 'WALKCURSOR',
      look: 'LOOKCURSOR',
      talk: 'TALKCURSOR',
      touch: 'TOUCHCURSOR',
      bag: 'ARROWCURSOR',
    };
    this.engine.cursor = cursorByMode[mode] || 'ARROWCURSOR';
  }

  _getUiButton(mx, my) {
    for (const button of this.uiButtons) {
      if (mx >= button.x && mx <= button.x + button.w &&
          my >= button.y && my <= button.y + button.h) {
        return button;
      }
    }
    return null;
  }

  _findInteraction(worldX, worldY, mode) {
    const interactions = this.sceneScript?.interactions || [];
    for (const interaction of interactions) {
      if (!this._interactionEnabled[interaction.id]) continue;
      const [x1, y1, x2, y2] = interaction.rect;
      if (worldX >= x1 && worldX <= x2 && worldY >= y1 && worldY <= y2) {
        const eventId = interaction.modes?.[mode];
        if (eventId) return { interaction, eventId };
      }
    }
    return null;
  }

  _startWalk(x, y) {
    this.alexTargetX = x;
    this.alexTargetY = y;
    this.alexWalking = true;
    this.alexFrame = 0;
    this.alexStepTick = 0;
    this.alexDir = this._calcDirection(this.alexX, this.alexY, x, y);
    this.alexWalkCycleIdx = 0;
  }

  _queueEvent(eventId) {
    const event = this.sceneScript?.events?.[eventId];
    if (!event) return;
    this.actionQueue = [];
    this._enqueueSteps(event);
    this._processActionQueue();
  }

  _enqueueSteps(steps) {
    if (!steps) return;
    const list = Array.isArray(steps) ? steps : [steps];
    this.actionQueue.push(...list.map(step => ({ ...step })));
  }

  _processActionQueue() {
    if (this.modal || this.alexWalking) return;

    while (this.actionQueue.length) {
      const step = this.actionQueue.shift();

      if (step.if) {
        this._enqueueSteps(this._evaluateCondition(step.if) ? step.then : step.else);
        continue;
      }

      if (step.type === 'event') {
        this._enqueueSteps(this.sceneScript?.events?.[step.id]);
        continue;
      }

      if (step.type === 'walkTo') {
        this._startWalk(step.x, step.y);
        return;
      }

      if (step.type === 'face') {
        this.alexDir = step.dir;
        this.alexFrame = 0;
        continue;
      }

      if (step.type === 'message') {
        this._openMessage(step.id);
        return;
      }

      if (step.type === 'dialog') {
        this._openDialog(step.id);
        return;
      }

      if (step.type === 'setState') {
        this.state[step.key] = step.value;
        this._applyBindings();
        continue;
      }

      if (step.type === 'incState') {
        this.state[step.key] = (this.state[step.key] || 0) + (step.amount ?? 1);
        this._applyBindings();
      }
    }
  }

  _openMessage(messageId) {
    const message = this.sceneScript?.messages?.[messageId];
    if (!message) return;
    this._dialogExitBox = null;
    this.modal = { type: 'message', presentation: message.presentation || 'note', ...message };
  }

  _openDialog(dialogId) {
    const dialog = this.sceneScript?.dialogs?.[dialogId];
    if (!dialog) return;
    this._dialogExitBox = null;
    this.modal = {
      type: 'dialog',
      speaker: dialog.speaker,
      speakerSprite: dialog.speakerSprite,
      speakerX: dialog.speakerX,
      speakerY: dialog.speakerY,
      prompt: dialog.prompt,
      question: dialog.question,
      choices: dialog.choices,
    };
  }

  _handleModalClick(mx, my) {
    if (!this.modal) return;

    if (this.modal.type === 'message') {
      this.modal = null;
      this._processActionQueue();
      return;
    }

    if (this.modal.type === 'dialog') {
      if (this._dialogExitBox &&
          mx >= this._dialogExitBox.x1 && mx <= this._dialogExitBox.x2 &&
          my >= this._dialogExitBox.y1 && my <= this._dialogExitBox.y2) {
        this.modal = null;
        this._choiceBoxes = [];
        this._dialogExitBox = null;
        this.actionQueue = [];
        return;
      }

      for (let i = 0; i < this._choiceBoxes.length; i++) {
        const box = this._choiceBoxes[i];
        if (mx >= box.x1 && mx <= box.x2 && my >= box.y1 && my <= box.y2) {
          const choice = this.modal.choices[i];
          this.modal = null;
          this._choiceBoxes = [];
          this._dialogExitBox = null;
          this._enqueueSteps(choice.event);
          this._processActionQueue();
          return;
        }
      }
    }
  }

  tick() {
    // Fade
    if (this.fade === 'in') {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + 1 / FADE_TICKS);
      if (this.fadeAlpha >= 1) {
        this.fade = 'none';
        if (this._fadeCb) { this._fadeCb(); this._fadeCb = null; }
      }
    } else if (this.fade === 'out') {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - 1 / FADE_TICKS);
      if (this.fadeAlpha <= 0) {
        this.fade = 'none';
        if (this._fadeCb) { this._fadeCb(); this._fadeCb = null; }
      }
    }

    // Walk
    if (this.alexWalking) {
      this.alexStepTick++;
      if (this.alexStepTick >= ANIM_TICK_SCALE) {
        this.alexStepTick = 0;
        this.alexDir = this._calcDirection(this.alexX, this.alexY, this.alexTargetX, this.alexTargetY);
        const cycle = this.walkFrameCycles[this.alexDir] || [1];
        this.alexWalkCycleIdx %= cycle.length;
        this.alexFrame = cycle[this.alexWalkCycleIdx];
        this.alexWalkCycleIdx = (this.alexWalkCycleIdx + 1) % cycle.length;
        const deltas = this.walkDeltas[this.alexDir];
        const delta = deltas ? deltas[this.alexFrame] : { dx: 0, dy: 0 };
        const distX = this.alexTargetX - this.alexX;
        const distY = this.alexTargetY - this.alexY;
        const dist = Math.hypot(distX, distY);

        if (dist <= Math.max(Math.abs(delta.dx), Math.abs(delta.dy), 1)) {
          this.alexX = this.alexTargetX;
          this.alexY = this.alexTargetY;
          this.alexWalking = false;
          this.alexFrame = 0;
        } else {
          const newX = this.alexX + delta.dx;
          const newY = this.alexY + delta.dy;
          if (this._inWalkZone(newX, newY)) {
            this.alexX = newX;
            this.alexY = newY;
          } else {
            this.alexWalking = false;
            this.alexFrame = 0;
            return;
          }
        }
      }
    }

    // Animate scene objects
    this.stairsTick++;
    if (this.stairsTick >= 3) {
      this.stairsTick = 0;
      this.stairsFrame = (this.stairsFrame % 6) + 1;
    }
    // Update all animated objects
    for (const obj of this.sceneObjects) {
      if (obj.anim === 'stairs') {
        obj.sprite = `STAIRS${this.stairsFrame}`;
      } else if (obj.overlay && obj.overlay.sequence) {
        // Base+overlay with sequence
        if (obj._oTick == null) obj._oTick = 0;
        if (obj._oIdx == null) obj._oIdx = 0;
        obj._oTick++;
        if (obj._oTick >= obj.overlay.rate) {
          obj._oTick = 0;
          obj._oIdx = (obj._oIdx + 1) % obj.overlay.sequence.length;
        }
        // Second overlay (e.g., ACHU sneeze)
        if (obj.overlay2 && obj.overlay2.sequence) {
          if (obj._o2Tick == null) obj._o2Tick = 0;
          if (obj._o2Idx == null) obj._o2Idx = 0;
          obj._o2Tick++;
          if (obj._o2Tick >= obj.overlay2.rate) {
            obj._o2Tick = 0;
            obj._o2Idx = (obj._o2Idx + 1) % obj.overlay2.sequence.length;
          }
        }
      } else if (obj.anim && obj.anim.sequence) {
        // Full-frame animation with sequence
        if (obj._animTick == null) obj._animTick = 0;
        if (obj._animIdx == null) obj._animIdx = 0;
        obj._animTick++;
        if (obj._animTick >= obj.anim.rate) {
          obj._animTick = 0;
          obj._animIdx = (obj._animIdx + 1) % obj.anim.sequence.length;
          const frameNum = obj.anim.sequence[obj._animIdx];
          obj.sprite = `${obj.anim.prefix}${frameNum}`;
          // Per-frame positions from SCX data section (same frame = same position always)
          if (obj.anim.framePos && obj.anim.framePos[frameNum]) {
            obj.x = obj.anim.framePos[frameNum][0];
            obj.y = obj.anim.framePos[frameNum][1];
          }
        }
      }
    }

    // Scroll viewport to follow Alex
    const targetScroll = Math.max(0, Math.min(this.bgWidth - 320, this.alexX - 160));
    // Smooth scroll
    if (Math.abs(this.scrollX - targetScroll) > 1) {
      this.scrollX += Math.sign(targetScroll - this.scrollX) * Math.min(4, Math.abs(targetScroll - this.scrollX));
    } else {
      this.scrollX = targetScroll;
    }

    this._processActionQueue();
  }

  render(ctx) {
    // Draw scrolling background
    const bg = this.engine.assets.get('SCENE_BG');
    if (bg) {
      ctx.drawImage(bg, -this.scrollX, 0);
    }

    // Draw objects BEHIND Alex
    for (const obj of this.objectsBehind) {
      if (!obj.visible) continue;

      // Check if overlay2 is active (e.g., ACHU sneeze replaces clerk)
      const o2Active = obj.overlay2 && obj.overlay2.sequence &&
        obj._o2Idx != null && obj.overlay2.sequence[obj._o2Idx] > 0;

      if (o2Active) {
        // Skip base sprite entirely (its pixels match the background anyway)
        // and draw overlay2 directly on the background
        const frameNum = obj.overlay2.sequence[obj._o2Idx];
        const oImg = this.engine.assets.get(`${obj.overlay2.prefix}${frameNum}`);
        if (oImg) ctx.drawImage(oImg, obj.x + obj.overlay2.ox - this.scrollX, obj.y + obj.overlay2.oy);
      } else {
        // Draw base sprite
        const img = this.engine.assets.get(obj.sprite);
        if (img) {
          // Bottom-aligned: sprites with different heights align at feet
          const drawY = (obj.anim && obj.anim.bottomAlign)
            ? obj.anim.bottomAlign - img.height
            : obj.y;
          ctx.drawImage(img, obj.x - this.scrollX, drawY);
        }
        // Draw overlay1 (face) on top of base
        if (obj.overlay && obj.overlay.sequence && obj._oIdx != null) {
          const frameNum = obj.overlay.sequence[obj._oIdx];
          if (frameNum > 0) {
            const oImg = this.engine.assets.get(`${obj.overlay.prefix}${frameNum}`);
            if (oImg) ctx.drawImage(oImg, obj.x + obj.overlay.ox - this.scrollX, obj.y + obj.overlay.oy);
          }
        }
      }
    }

    // Draw Alex (idle = frame 1, not 0 which is eyes-closed)
    const displayFrame = (!this.alexWalking && this.alexFrame === 0) ? 1 : this.alexFrame;
    const spriteName = `ALEX${this.alexDir}-${displayFrame}`;
    const alexImg = this.engine.assets.get(spriteName);
    if (alexImg) {
      const screenX = this.alexX - this.scrollX - alexImg.width / 2;
      const screenY = this.alexY - alexImg.height; // feet at alexY
      ctx.drawImage(alexImg, Math.round(screenX), Math.round(screenY));
    }

    // Draw objects IN FRONT of Alex (signs, foreground elements)
    for (const obj of this.objectsFront) {
      if (!obj.visible) continue;
      const img = this.engine.assets.get(obj.sprite);
      if (img) ctx.drawImage(img, obj.x - this.scrollX, obj.y);
    }

    this._renderModal(ctx);
    this._renderPanel(ctx);

    // Fade overlay
    if (this.fadeAlpha < 1) {
      ctx.globalAlpha = 1 - this.fadeAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 320, 200);
      ctx.globalAlpha = 1;
    }
  }

  _renderModal(ctx) {
    if (!this.modal || !this.font) return;
    if (this.modal.type === 'dialog') {
      this._renderTalkDialog(ctx);
    } else {
      this._renderNotePopup(ctx);
    }
  }

  _renderPanel(ctx) {
    const panel = this.engine.assets.get('PANEL');
    if (panel) ctx.drawImage(panel, 0, 167);

    const moneyBox = this.engine.assets.get('MONEYBOX');
    if (moneyBox) {
      const boxX = Math.round((320 - moneyBox.width) / 2);
      const boxY = 171;
      ctx.drawImage(moneyBox, boxX, boxY);

      const money = '100';
      const text = `${money} P`;
      const textX = Math.round(boxX + (moneyBox.width - this.font.measureText(text)) / 2);
      this.font?.drawText(ctx, text, textX, boxY + 3);
    }

    if (this.modal?.type === 'dialog') return;

    for (const button of this.uiButtons) {
      const sprite = this.inputMode === button.mode ? button.pressed : button.normal;
      const img = this.engine.assets.get(sprite);
      if (img) ctx.drawImage(img, button.x, button.y);
    }
  }

  _wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && this.font.measureText(test) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  _renderNotePopup(ctx) {
    const lines = this._wrapText(this.modal.text, 160);
    const winName = lines.length <= 2 ? 'TEXTWIN2'
      : lines.length === 3 ? 'TEXTWIN3'
        : lines.length === 4 ? 'TEXTWIN4'
          : 'TEXTWIN5';
    const win = this.engine.assets.get(winName);
    if (!win) return;
    const x = Math.round((320 - win.width) / 2);
    const y = 24;
    ctx.drawImage(win, x, y);
    let ty = y + 14;
    for (const line of lines) {
      this.font.drawText(ctx, line, x + 16, ty);
      ty += 11;
    }
    this._choiceBoxes = [];
    this._dialogExitBox = null;
  }

  _renderTalkDialog(ctx) {
    const win = this.engine.assets.get('TALKWINDOW');
    if (win) ctx.drawImage(win, 0, 0);

    const npc = this.engine.assets.get(this.modal.speakerSprite);
    if (npc) ctx.drawImage(npc, this.modal.speakerX, this.modal.speakerY);

    const alex = this.engine.assets.get('ALTALK1');
    if (alex) ctx.drawImage(alex, 228, 64);

    const topLines = this._wrapText(this.modal.prompt, 136);
    let y = 14;
    for (const line of topLines) {
      this.font.drawText(ctx, line, 166, y);
      y += 11;
    }

    const questionLines = this._wrapText(this.modal.question, 140);
    y = 103;
    for (const line of questionLines) {
      this.font.drawText(ctx, line, 14, y);
      y += 11;
    }

    this._choiceBoxes = [];
    for (let i = 0; i < this.modal.choices.length; i++) {
      const label = `${i + 1}.  ${this.modal.choices[i].label}`;
      this.font.drawText(ctx, label, 24, y);
      const width = this.font.measureText(label);
      this._choiceBoxes.push({ x1: 20, y1: y - 2, x2: 24 + width + 4, y2: y + this.font.height + 2 });
      y += 11;
    }

    const exit = this.engine.assets.get('TLKEXIT1');
    if (exit) {
      ctx.drawImage(exit, 166, 148);
      this._dialogExitBox = { x1: 166, y1: 148, x2: 166 + exit.width, y2: 148 + exit.height };
    }
  }

  _inWalkZone(x, y) {
    for (const [x1, y1, x2, y2] of this.walkZones) {
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return true;
    }
    return false;
  }

  _fadeIn(cb) { this.fade = 'in'; this.fadeAlpha = 0; this._fadeCb = cb || null; }
  _fadeOut(cb) { this.fade = 'out'; this.fadeAlpha = 1; this._fadeCb = cb || null; }

  destroy() {
    const canvas = this.engine.ctx.canvas;
    canvas.removeEventListener('mousedown', this._onMouseDown);
  }
}
