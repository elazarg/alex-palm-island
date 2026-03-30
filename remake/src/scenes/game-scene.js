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
    this.uiTick = 0;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;

    this.uiButtons = [
      { mode: 'bag', normal: 'NOBAG', active: 'CASEBUTTON', pressed: 'CASEPRESSED', x: 4, y: 165, w: 44, h: 33 },
      { mode: 'walk', normal: 'WALKBUTTON', pressed: 'WALKPRESSED', x: 68, y: 168, w: 48, h: 31 },
      { mode: 'talk', normal: 'TALKBUTTON', pressed: 'TALKPRESSED', x: 120, y: 167, w: 40, h: 31 },
      { mode: 'look', normal: 'LOOKBUTTON', pressed: 'LOOKPRESSED', x: 164, y: 168, w: 44, h: 31 },
      { mode: 'touch', normal: 'TOUCHBUTTON', pressed: 'TOUCHPRESSED', x: 212, y: 168, w: 40, h: 32 },
      { mode: 'exit', normal: 'EXITBUTTON', pressed: 'EXITPRESSED', x: 276, y: 168, w: 40, h: 31 },
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
    const uiVersion = '20260330f';
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
    for (let i = 1; i <= 10; i++) sceneImgs[`GRDTLK${i}`] = `${base}/GRDTLK${i}.png`;
    for (let i = 1; i <= 7; i++) sceneImgs[`FEMTLK${i}`] = `${base}/FEMTLK${i}.png`;
    for (let i = 1; i <= 6; i++) sceneImgs[`FAMTLK${i}`] = `${base}/FAMTLK${i}.png`;
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
      PANEL: `assets/ui/PANEL.png?v=${uiVersion}`,
      LOOKBUTTON: `assets/ui/LOOKBUTTON.png?v=${uiVersion}`,
      LOOKPRESSED: `assets/ui/LOOKPRESSED.png?v=${uiVersion}`,
      TALKBUTTON: `assets/ui/TALKBUTTON.png?v=${uiVersion}`,
      TALKPRESSED: `assets/ui/TALKPRESSED.png?v=${uiVersion}`,
      TOUCHBUTTON: `assets/ui/TOUCHBUTTON.png?v=${uiVersion}`,
      TOUCHPRESSED: `assets/ui/TOUCHPRESSED.png?v=${uiVersion}`,
      WALKBUTTON: `assets/ui/WALKBUTTON.png?v=${uiVersion}`,
      WALKPRESSED: `assets/ui/WALKPRESSED.png?v=${uiVersion}`,
      CASEBUTTON: `assets/ui/CASEBUTTON.png?v=${uiVersion}`,
      CASEPRESSED: `assets/ui/CASEPRESSED.png?v=${uiVersion}`,
      NOBAG: `assets/ui/NOBAG.png?v=${uiVersion}`,
      EXITBUTTON: `assets/ui/EXITBUTTON.png?v=${uiVersion}`,
      EXITPRESSED: `assets/ui/EXITPRESSED.png?v=${uiVersion}`,
      METER: `assets/ui/METER.png?v=${uiVersion}`,
      MONEYBOX: `assets/ui/MONEYBOX.png?v=${uiVersion}`,
      MONEY1: `assets/ui/MONEY1.png?v=${uiVersion}`,
      MONEY2: `assets/ui/MONEY2.png?v=${uiVersion}`,
      MONEY3: `assets/ui/MONEY3.png?v=${uiVersion}`,
      MONEY4: `assets/ui/MONEY4.png?v=${uiVersion}`,
      TALKWINDOW: `assets/ui/TALKWINDOW.png?v=${uiVersion}`,
      ALTALK1: `assets/ui/ALTALK1.png?v=${uiVersion}`,
      TEXTWIN2: `assets/ui/TEXTWIN2.png?v=${uiVersion}`,
      TEXTWIN3: `assets/ui/TEXTWIN3.png?v=${uiVersion}`,
      TEXTWIN4: `assets/ui/TEXTWIN4.png?v=${uiVersion}`,
      TEXTWIN5: `assets/ui/TEXTWIN5.png?v=${uiVersion}`,
      TLKEXIT1: `assets/ui/TLKEXIT1.png?v=${uiVersion}`,
      TLKEXIT2: `assets/ui/TLKEXIT2.png?v=${uiVersion}`,
      TALKTOP: `assets/ui/TALKTOP.png?v=${uiVersion}`,
      GRDTLK0: `assets/airport/GRDTLK0.png?v=${uiVersion}`,
      FEMTLK0: `assets/airport/FEMTLK0.png?v=${uiVersion}`,
      FAMTLK0: `assets/airport/FAMTLK0.png?v=${uiVersion}`,
    });
    this._buildTalkResponseSlices();

    const fontImg = new Image();
    const fontData = await (await fetch('assets/mainfont.json')).json();
    await new Promise((resolve, reject) => {
      fontImg.onload = resolve;
      fontImg.onerror = reject;
      fontImg.src = 'assets/mainfont.png';
    });
    this.font = new BitmapFont(fontImg, fontData);

    const digiImg = new Image();
    const digiData = await (await fetch('assets/digitalfont.json')).json();
    await new Promise((resolve, reject) => {
      digiImg.onload = resolve;
      digiImg.onerror = reject;
      digiImg.src = 'assets/digitalfont.png';
    });
    this.digitalFont = new BitmapFont(digiImg, digiData);

    const scoreImg = new Image();
    const scoreData = await (await fetch(`assets/scorefont.json?v=${uiVersion}`)).json();
    await new Promise((resolve, reject) => {
      scoreImg.onload = resolve;
      scoreImg.onerror = reject;
      scoreImg.src = `assets/scorefont.png?v=${uiVersion}`;
    });
    this.scoreFont = new BitmapFont(scoreImg, scoreData, { preserveColors: true });

    // Cursors
    await engine.loadImages({
      'ARROWCURSOR': `assets/cursors/ARROWCURSOR.png?v=${uiVersion}`,
      'LOOKCURSOR': `assets/cursors/LOOKCURSOR.png?v=${uiVersion}`,
      'TALKCURSOR': `assets/cursors/TALKCURSOR.png?v=${uiVersion}`,
      'TOUCHCURSOR': `assets/cursors/TOUCHCURSOR.png?v=${uiVersion}`,
      'WALKCURSOR': `assets/cursors/WALKCURSOR.png?v=${uiVersion}`,
    });
    await engine.loadImages({
      DIALOGBOX: `assets/ui/DIALOGBOX.png?v=${uiVersion}`,
    });

    // Escalator animation state
    this.stairsTick = 0;
    this.stairsFrame = 1;

    this.bgWidth = engine.assets.get('SCENE_BG')?.width || 320;
    this.objectByName = Object.fromEntries(this.sceneObjects.map(obj => [obj.name, obj]));
  }

  _buildTalkResponseSlices() {
    const talk = this.engine?.assets?.get('TALKWINDOW');
    if (!talk) return;
    this.engine.assets.set('TALKRESP_LEFT', this._makeTransparentSlice(talk, 6, 1, 144, 109));
    this.engine.assets.set('TALKRESP_BUBBLE', this._makeTransparentSlice(talk, 120, 1, 200, 99));
  }

  _makeTransparentSlice(source, sx, sy, sw, sh) {
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    const img = ctx.getImageData(0, 0, sw, sh);
    const data = img.data;
    const stack = [];
    const seen = new Uint8Array(sw * sh);
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= sw || y >= sh) return;
      const idx = y * sw + x;
      if (seen[idx]) return;
      seen[idx] = 1;
      const o = idx * 4;
      if (data[o + 3] && data[o] === 0 && data[o + 1] === 0 && data[o + 2] === 0) stack.push(idx);
    };
    for (let x = 0; x < sw; x++) {
      push(x, 0);
      push(x, sh - 1);
    }
    for (let y = 1; y < sh - 1; y++) {
      push(0, y);
      push(sw - 1, y);
    }
    while (stack.length) {
      const idx = stack.pop();
      const o = idx * 4;
      data[o + 3] = 0;
      const x = idx % sw;
      const y = Math.floor(idx / sw);
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
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
        this._pressedButtonMode = button.mode;
        this._pendingButtonMode = button.mode;
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

      if (this.inputMode !== 'walk') {
        this._queueFallbackEvent(this.inputMode);
        return;
      }

      // Only walk to positions inside a walk zone
      if (!this._inWalkZone(worldX, worldY)) return;

      this._startWalk(worldX, worldY);
    };
    canvas.addEventListener('mousedown', this._onMouseDown);

    this._onMouseUp = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / (rect.width / 320);
      const my = (e.clientY - rect.top) / (rect.height / 200);
      const pressedMode = this._pressedButtonMode;
      const pendingMode = this._pendingButtonMode;
      this._pressedButtonMode = null;
      this._pendingButtonMode = null;
      if (!pendingMode || !pressedMode || pendingMode !== pressedMode) return;
      const button = this._getUiButton(mx, my);
      if (!button || button.mode !== pendingMode) return;
      if (button.mode === 'exit') return;
      if (button.mode === 'bag' && !this.state?.bagReceived) {
        this._queueEvent('bagMissing');
        return;
      }
      this._setInputMode(button.mode);
    };
    canvas.addEventListener('mouseup', this._onMouseUp);

    this._onMouseLeave = () => {
      this._pressedButtonMode = null;
      this._pendingButtonMode = null;
    };
    canvas.addEventListener('mouseleave', this._onMouseLeave);

    this._onKeyDown = (e) => {
      if (!this.modal) return;
      if (this.modal.type === 'dialog' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        const count = this.modal.choices.length;
        const current = this.modal.selectedChoice == null ? -1 : this.modal.selectedChoice;
        this.modal.selectedChoice = (current + dir + count) % count;
        e.preventDefault();
        return;
      }
      if (e.key !== 'Enter') return;
      if (this.modal.type === 'dialog' && this.modal.selectedChoice != null) {
        const choice = this.modal.choices[this.modal.selectedChoice];
        this.modal = null;
        this._choiceBoxes = [];
        this._dialogExitBox = null;
        this._enqueueSteps(choice.event);
        this._refreshCursor();
        this._processActionQueue();
      } else if (this.modal.type === 'message') {
        this.modal = null;
        this._refreshCursor();
        this._processActionQueue();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
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
    this._refreshCursor();
  }

  _refreshCursor() {
    if (this.modal) {
      this.engine.cursor = 'ARROWCURSOR';
      return;
    }
    const cursorByMode = {
      walk: 'WALKCURSOR',
      look: 'LOOKCURSOR',
      talk: 'TALKCURSOR',
      touch: 'TOUCHCURSOR',
      bag: 'ARROWCURSOR',
    };
    this.engine.cursor = cursorByMode[this.inputMode] || 'ARROWCURSOR';
  }

  _getUiButton(mx, my) {
    if (!this._buttonsVisible()) return null;
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
      const rect = this._getInteractionRect(interaction);
      if (!rect) continue;
      const [x1, y1, x2, y2] = rect;
      if (worldX >= x1 && worldX <= x2 && worldY >= y1 && worldY <= y2) {
        const eventId = interaction.modes?.[mode];
        if (eventId) return { interaction, eventId };
      }
    }
    return null;
  }

  _getInteractionRect(interaction) {
    if (interaction.object) {
      const obj = this.objectByName?.[interaction.object];
      const spriteName = interaction.sprite || obj?.sprite;
      const img = spriteName ? this.engine.assets.get(spriteName) : null;
      if (obj && img) {
        const pad = interaction.pad || [0, 0, 0, 0];
        return [
          obj.x + pad[0],
          obj.y + pad[1],
          obj.x + img.width + pad[2],
          obj.y + img.height + pad[3],
        ];
      }
    }
    return interaction.rect || null;
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
    this._refreshCursor();
  }

  _openDialog(dialogId) {
    const dialog = this.sceneScript?.dialogs?.[dialogId];
    if (!dialog) return;
    this._dialogExitBox = null;
    this.modal = {
      type: 'dialog',
      speaker: dialog.speaker,
      speakerSprite: dialog.speakerSprite,
      speakerBase: dialog.speakerBase,
      speakerOverlay: dialog.speakerOverlay,
      speakerX: dialog.speakerX,
      speakerY: dialog.speakerY,
      prompt: dialog.prompt,
      question: dialog.question,
      choices: dialog.choices,
      selectedChoice: null,
    };
    this._refreshCursor();
  }

  _handleModalClick(mx, my) {
    if (!this.modal) return;

    if (this.modal.type === 'message') {
      this.modal = null;
      this._refreshCursor();
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
        this._refreshCursor();
        return;
      }

      for (let i = 0; i < this._choiceBoxes.length; i++) {
        const box = this._choiceBoxes[i];
        if (mx >= box.x1 && mx <= box.x2 && my >= box.y1 && my <= box.y2) {
          this.modal.selectedChoice = i;
          return;
        }
      }
    }
  }

  tick() {
    this.uiTick++;
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
    } else if (this.modal.presentation === 'talk') {
      this._renderTalkResponse(ctx);
    } else {
      this._renderNotePopup(ctx);
    }
  }

  _renderPanel(ctx) {
    const meter = this.engine.assets.get('METER');
    if (meter) ctx.drawImage(meter, 0, 180);

    const moneyBox = this.engine.assets.get('MONEYBOX');
    if (moneyBox) {
      const boxX = 126;
      const boxY = 182;
      ctx.drawImage(moneyBox, boxX, boxY);
      this._renderMoneyDigits(ctx, boxX, boxY, this.state?.palmettoes ?? 100);
    }

    const showButtons = this._buttonsVisible();
    if (showButtons) {
      const panel = this.engine.assets.get('PANEL');
      if (panel) ctx.drawImage(panel, 0, 165);
    }

    if (this.modal?.type === 'dialog') return;
    if (!showButtons) return;


    for (const button of this.uiButtons) {
      const isPressed = this._pressedButtonMode === button.mode;
      const sprite = isPressed ? button.pressed : this._buttonSprite(button);
      const img = this.engine.assets.get(sprite);
      if (img) ctx.drawImage(img, button.x, button.y);
    }
  }

  _buttonSprite(button) {
    if (button.mode === 'bag') {
      return this.state?.bagReceived ? button.active : button.normal;
    }
    return button.normal;
  }

  _buttonsVisible() {
    return !this.modal && this.engine.mouseY >= 166;
  }

  _wrapText(text, maxWidth) {
    const words = text.split(/(\s+)/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line}${word}` : word;
      if (line && !/^\s+$/.test(word) && this.font.measureText(test) > maxWidth) {
        lines.push(line);
        line = word.trimStart();
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  _renderNotePopup(ctx) {
    const lines = this._wrapText(this._formatNoteText(this.modal.text), 160);
    const winName = lines.length <= 2 ? 'TEXTWIN2'
      : lines.length === 3 ? 'TEXTWIN3'
        : lines.length === 4 ? 'TEXTWIN4'
          : 'TEXTWIN5';
    const win = this.engine.assets.get(winName);
    if (!win) return;
    const x = Math.round((320 - win.width) / 2);
    const y = 24;
    ctx.drawImage(win, x, y);
    let ty = y + 20;
    for (const line of lines) {
      this.font.drawText(ctx, line, x + 10, ty, '#000000');
      ty += 11;
    }
    this._choiceBoxes = [];
    this._dialogExitBox = null;
  }

  _renderTalkDialog(ctx) {
    const win = this.engine.assets.get('TALKWINDOW');
    if (win) ctx.drawImage(win, 0, 0);

    this._renderDialogSpeaker(ctx);

    const alex = this.engine.assets.get('ALTALK1');
    if (alex) ctx.drawImage(alex, 222, 64);

    const topLines = this._wrapText(this.modal.prompt, 136);
    let y = 14;
    for (const line of topLines) {
      this.font.drawText(ctx, line, 166, y, '#000000');
      y += 11;
    }

    const baseQuestion = this.modal.question.replace(/:\s*$/, '');
    const selectedText = this.modal.selectedChoice != null
      ? this.modal.choices[this.modal.selectedChoice].label
      : '____';
    const questionX = 16;
    const questionY = 103;
    y = this._drawQuestionSelection(ctx, baseQuestion, selectedText, questionX, questionY, 168) + 7;

    this._choiceBoxes = [];
    const numberX = 16;
    const bodyX = 36;
    const highlightX = 32;
    const highlightRight = 184;
    for (let i = 0; i < this.modal.choices.length; i++) {
      const label = `${i + 1}.  ${this.modal.choices[i].label}`;
      const choiceText = this.modal.choices[i].label;
      if (this.modal.selectedChoice === i) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(highlightX, y - 1, highlightRight - highlightX, this.font.height + 2);
        this.font.drawText(ctx, choiceText, bodyX, y, '#ffffff');
        this.font.drawText(ctx, `${i + 1}.`, numberX, y, '#000000');
      } else {
        this.font.drawText(ctx, label, numberX, y, '#000000');
      }
      this._choiceBoxes.push({ x1: numberX, y1: y - 2, x2: highlightRight, y2: y + this.font.height + 2 });
      y += 11;
    }

    const exit = this.engine.assets.get('TLKEXIT1');
    if (exit) {
      ctx.drawImage(exit, 166, 148);
      this._dialogExitBox = { x1: 166, y1: 148, x2: 166 + exit.width, y2: 148 + exit.height };
    }
  }

  _renderTalkResponse(ctx) {
    const leftTile = this.engine.assets.get('TALKRESP_LEFT');
    if (leftTile) ctx.drawImage(leftTile, 6, 1);
    this._renderDialogSpeaker(ctx);
    const bubble = this.engine.assets.get('TALKRESP_BUBBLE');
    if (bubble) ctx.drawImage(bubble, 120, 1);

    const lines = this._wrapText(this.modal.text, 188);
    let y = 14;
    for (const line of lines) {
      this.font.drawText(ctx, line, 166, y, '#000000');
      y += 11;
    }
    this._choiceBoxes = [];
    this._dialogExitBox = null;
  }

  _drawQuestionSelection(ctx, baseQuestion, selectedText, x, y, maxWidth) {
    const prefix = this.modal.selectedChoice != null ? `${baseQuestion} ` : `${baseQuestion}: `;
    let cx = x;
    let cy = y;
    const drawWord = (word, color) => {
      const width = this.font.measureText(word);
      if (cx > x && cx + width > x + maxWidth) {
        cy += 11;
        cx = x;
      }
      this.font.drawText(ctx, word, cx, cy, color);
      cx += width;
    };
    for (const token of prefix.match(/\S+\s*/g) || [prefix]) {
      drawWord(token, '#000000');
    }
    if (this.modal.selectedChoice != null) {
      for (const token of selectedText.match(/\S+\s*/g) || [selectedText]) {
        drawWord(token, '#d40000');
      }
    } else {
      drawWord(selectedText, '#000000');
    }
    return cy;
  }

  _renderDialogSpeaker(ctx) {
    const baseName = this.modal.speakerBase || this.modal.speakerSprite;
    const npc = this.engine.assets.get(baseName);
    if (!npc) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(16, 12, 116, 80);
    ctx.clip();
    ctx.drawImage(npc, this.modal.speakerX, this.modal.speakerY);

    const overlay = this.modal.speakerOverlay;
    if (overlay?.sequence?.length) {
      const idx = Math.floor(this.uiTick / (overlay.rate || 8)) % overlay.sequence.length;
      const frameNum = overlay.sequence[idx];
      if (frameNum) {
        const oImg = this.engine.assets.get(`${overlay.prefix}${frameNum}`);
        if (oImg) {
          ctx.drawImage(oImg, this.modal.speakerX + overlay.ox, this.modal.speakerY + overlay.oy);
        }
      }
    }
    ctx.restore();
  }

  _formatNoteText(text) {
    return text.replace(/([.!?]) (?=[A-Z"])/g, '$1  ');
  }

  _renderMoneyDigits(ctx, boxX, boxY, amount) {
    const text = String(Math.max(0, Math.min(9999, amount))).padStart(4, ' ');
    const digitW = 6;
    const gap = 1;
    const totalW = digitW * text.length + gap * (text.length - 1);
    const startX = boxX + 5 + Math.round((35 - totalW) / 2);
    const startY = boxY + 3;
    for (let i = 0; i < text.length; i++) {
      this._drawSevenSegmentDigit(ctx, startX + i * (digitW + gap), startY, text[i]);
    }
  }

  _drawSevenSegmentDigit(ctx, x, y, ch) {
    const on = '#0ccc0c';
    const off = '#8c5c10';
    const segs = {
      '0': ['a', 'b', 'c', 'd', 'e', 'f'],
      '1': ['b', 'c'],
      '2': ['a', 'b', 'g', 'e', 'd'],
      '3': ['a', 'b', 'g', 'c', 'd'],
      '4': ['f', 'g', 'b', 'c'],
      '5': ['a', 'f', 'g', 'c', 'd'],
      '6': ['a', 'f', 'g', 'e', 'c', 'd'],
      '7': ['a', 'b', 'c'],
      '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      '9': ['a', 'b', 'c', 'd', 'f', 'g'],
      ' ': [],
    };
    const onSet = new Set(segs[ch] || []);
    const segRects = {
      a: [1, 0, 4, 1],
      b: [5, 1, 1, 3],
      c: [5, 5, 1, 3],
      d: [1, 8, 4, 1],
      e: [0, 5, 1, 3],
      f: [0, 1, 1, 3],
      g: [1, 4, 4, 1],
    };
    for (const [name, rect] of Object.entries(segRects)) {
      ctx.fillStyle = onSet.has(name) ? on : off;
      ctx.fillRect(x + rect[0], y + rect[1], rect[2], rect[3]);
    }
  }

  _queueFallbackEvent(mode) {
    const eventId = this.sceneScript?.fallbacks?.[mode];
    if (eventId) this._queueEvent(eventId);
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
    canvas.removeEventListener('mouseup', this._onMouseUp);
    canvas.removeEventListener('mouseleave', this._onMouseLeave);
    window.removeEventListener('keydown', this._onKeyDown);
  }
}
