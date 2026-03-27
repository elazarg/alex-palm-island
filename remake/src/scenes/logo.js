// LOGO scene — ECE intro splash
//
// Animation sequence:
//   1. LOGOTITLE banner appears at bottom ("eric cohen edutainment")
//   2. Red "C" (open circle) drops from top, bounces on the banner
//      with squash/stretch deformation (LOGO1-19)
//   3. Hands push "E"s from both sides, forming the ECE logo (LOGO20-29)
//   4. Hold final logo
//
// The SCX section 5010 drives the animation. Position data in 5020 gives
// the (x,y) for each frame. Frame index tracks position index (P command
// advances both together). F command overrides the frame independently.

import { AnimationPlayer, parseAnimationCommands, parsePositionData } from '../animation.js';

const ASSET_BASE = 'assets/logo';

// SCX section 5010 — animation commands
const ANIM_COMMANDS = `
P 3,0
V 1,0
G 8,0
P 2,0
F 7,1
F 9,1
G 11,0
P 2,0
G 14,0
P 2,0
G 18,0
P 2,0
G 26,0
P 2,0
G 29,0
F 29,0
V 1,0
P 40,0
F 29,0
Q
`.trim().split('\n');

// SCX section 5020 — frame positions (x, y)
const POSITION_DATA = `
133,0
125,0
116,0
111,0
110,0
110,37
110,80
110,107
122,48
117,37
110,13
110,37
110,80
110,87
110,80
122,48
110,37
110,80
110,48
0,48
0,48
0,48
0,48
0,48
0,48
0,48
0,48
0,48
29,48
`.trim().split('\n');

// LOGOTITLE: 264x23, placed as the "floor" the C bounces on.
// C lands at y=107 with LOGO8 (108x28), bottom edge at y=135.
const TITLE_X = 28;  // (320 - 264) / 2
const TITLE_Y = 134;

export class LogoScene {
  constructor() {
    this.engine = null;
    this.anim = null;
    this.titleOpacity = 0;
    this.titleFadeIn = true;
    this.tickCount = 0;
    this.animStarted = false;
    this.onDone = null; // callback when scene finishes
  }

  async load(engine) {
    const images = {};
    for (let i = 1; i <= 29; i++) {
      images[`LOGO${i}`] = `${ASSET_BASE}/LOGO${i}.png`;
    }
    images['LOGOTITLE'] = `${ASSET_BASE}/LOGOTITLE.png`;
    await engine.loadImages(images);
  }

  init() {
    const commands = parseAnimationCommands(ANIM_COMMANDS);
    const positions = parsePositionData(POSITION_DATA);
    this.anim = new AnimationPlayer(commands, positions, 'LOGO');
    this.titleOpacity = 0;
    this.titleFadeIn = true;
    this.tickCount = 0;
    this.animStarted = false;
    this.holdTicks = 0;

    // Skip on click or keypress
    this._skip = () => {
      if (this.onDone) { this.onDone(); this.onDone = null; }
    };
    const canvas = this.engine.ctx.canvas;
    canvas.addEventListener('click', this._skip);
    document.addEventListener('keydown', this._skip);
  }

  destroy() {
    const canvas = this.engine.ctx.canvas;
    canvas.removeEventListener('click', this._skip);
    document.removeEventListener('keydown', this._skip);
  }

  tick() {
    this.tickCount++;

    // Phase 1: Fade in title over ~1 second (18 ticks)
    if (this.titleFadeIn) {
      this.titleOpacity = Math.min(1, this.titleOpacity + 1 / 18);
      if (this.titleOpacity >= 1) this.titleFadeIn = false;
    }

    // Phase 2: Start animation after banner is fully visible (~1s delay)
    if (!this.animStarted && !this.titleFadeIn) {
      this.animStarted = true;
    }

    if (this.animStarted && this.anim) {
      this.anim.tick();
      if (this.anim.done) {
        this.holdTicks++;
        if (this.holdTicks >= 18 && this.onDone) { // ~1s hold then transition
          this.onDone();
          this.onDone = null;
        }
      }
    }
  }

  render(ctx) {
    // Black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 320, 200);

    // LOGOTITLE banner (the "floor")
    if (this.titleOpacity > 0) {
      ctx.globalAlpha = this.titleOpacity;
      this.engine.drawSprite(ctx, 'LOGOTITLE', TITLE_X, TITLE_Y);
      ctx.globalAlpha = 1;
    }

    // Animation frame (transparent sprites composited over background)
    if (this.anim && this.anim.visible) {
      this.engine.drawSprite(ctx, this.anim.spriteName, this.anim.x, this.anim.y);
    }
  }
}
