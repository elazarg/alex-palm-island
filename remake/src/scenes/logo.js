import { WIDTH, HEIGHT } from '../core/engine.js';
import { AnimationPlayer, parseAnimationCommands, parsePositionData } from '../runtime/animation-player.js';

const ASSET_BASE = '../assets/logo';
const TITLE_X = 28;
const TITLE_Y = 134;

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

export class LogoScene {
  constructor() {
    this.engine = null;
    this.anim = null;
    this.titleOpacity = 0;
    this.titleFadeIn = true;
    this.animStarted = false;
    this.holdTicks = 0;
    this.onDone = null;
  }

  attach(engine) {
    this.engine = engine;
  }

  async load(engine) {
    const images = {};
    for (let i = 1; i <= 29; i++) images[`LOGO${i}`] = `${ASSET_BASE}/LOGO${i}.png`;
    images.LOGOTITLE = `${ASSET_BASE}/LOGOTITLE.png`;
    await engine.loadImages(images);
  }

  init() {
    const commands = parseAnimationCommands(ANIM_COMMANDS);
    const positions = parsePositionData(POSITION_DATA);
    this.anim = new AnimationPlayer(commands, positions, 'LOGO');
    this.titleOpacity = 0;
    this.titleFadeIn = true;
    this.animStarted = false;
    this.holdTicks = 0;
  }

  onMouseDown() {
    this._finish();
  }

  onKeyDown() {
    this._finish();
  }

  tick() {
    if (this.titleFadeIn) {
      this.titleOpacity = Math.min(1, this.titleOpacity + 1 / 18);
      if (this.titleOpacity >= 1) this.titleFadeIn = false;
    }

    if (!this.animStarted && !this.titleFadeIn) {
      this.animStarted = true;
    }

    if (this.animStarted && this.anim) {
      this.anim.tick();
      if (this.anim.done) {
        this.holdTicks++;
        if (this.holdTicks >= 18) this._finish();
      }
    }
  }

  render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (this.titleOpacity > 0) {
      ctx.globalAlpha = this.titleOpacity;
      this.engine.drawSprite(ctx, 'LOGOTITLE', TITLE_X, TITLE_Y);
      ctx.globalAlpha = 1;
    }
    if (this.anim?.visible) {
      this.engine.drawSprite(ctx, this.anim.spriteName, this.anim.x, this.anim.y);
    }
  }

  _finish() {
    if (this.onDone) {
      const cb = this.onDone;
      this.onDone = null;
      cb();
    }
  }
}
