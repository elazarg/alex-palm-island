import { AnimationPlayer, parseAnimationCommands, parsePositionData } from '../../runtime/animation-player.js';
import { CURSOR_HOTSPOTS } from '../../ui/action-modes.js';

const COMMANDS = parseAnimationCommands([
  'P 3,0',
  'S 1,0',
  'V 1,0',
  'P 3,0',
  'G -1,0',
  'P 1,0',
  'F 5,0',
  'G -1,0',
  'V 0,0',
  'P 3,0',
  'Q',
]);

const POSITIONS = parsePositionData([
  '253,71',
  '255,79',
  '253,70',
  '253,73',
  '262,82',
  '253,70',
  '253,73',
  '253,73',
]);

const HOLD_TICKS = 4;

export class ArrestScene {
  constructor(options = {}) {
    this.engine = null;
    this.reasonCode = options.reasonCode ?? 503;
    this.onDone = null;
    this.anim = null;
    this.currentSound = null;
    this.soundDone = false;
    this.holdTicks = 0;
    this.spriteCache = new Map();
    this.sequenceStarted = false;
  }

  attach(engine) {
    this.engine = engine;
  }

  async load(engine) {
    const images = {
      SNARREST1: '../re/renders/sprites/cutscenes/ARREST/SNARREST1.png',
      ARROWCURSOR: 'assets/cursors/ARROWCURSOR.png',
    };
    for (let i = 1; i <= 8; i++) {
      images[`POLICE${i}`] = `../re/renders/sprites/cutscenes/ARREST/POLICE${i}.png`;
    }
    await engine.loadImages(images);
    await engine.loadSounds({
      SDPOLICE1: '../re/renders/sounds/ARREST/SDPOLICE1.wav',
    });
    engine.registerCursorHotspot('ARROWCURSOR', CURSOR_HOTSPOTS.ARROWCURSOR);
  }

  init() {
    this.engine.cursor = null;
    this.anim = new AnimationPlayer(COMMANDS, POSITIONS, 'POLICE');
    this.currentSound = null;
    this.soundDone = false;
    this.holdTicks = 0;
    this.sequenceStarted = false;
    this.engine.runWhenAudioUnlocked(() => this._startSequence());
  }

  destroy() {
    if (!this.currentSound) return;
    try { this.currentSound.stop(); } catch {}
    this.currentSound = null;
  }

  tick() {
    if (this.sequenceStarted) this.anim?.tick();
    if (this.anim?.done && this.soundDone) {
      this.holdTicks++;
      if (this.holdTicks >= HOLD_TICKS) {
        const cb = this.onDone;
        this.onDone = null;
        cb?.({ scene: 'prison', reasonCode: this.reasonCode });
      }
    }
  }

  render(ctx) {
    this.engine.drawSprite(ctx, 'SNARREST1', 0, 0);
    if (this.anim?.visible) {
      this._drawCutoutSprite(ctx, this.anim.spriteName, this.anim.x, this.anim.y);
    }
  }

  _drawCutoutSprite(ctx, name, x, y) {
    const sprite = this._getCutoutSprite(name);
    if (!sprite) return;
    ctx.drawImage(sprite, x, y);
  }

  _getCutoutSprite(name) {
    if (this.spriteCache.has(name)) return this.spriteCache.get(name);
    const img = this.engine.getAsset(name);
    if (!img) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const cctx = canvas.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(img, 0, 0);
    const imageData = cctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const seen = new Uint8Array(width * height);
    const queue = [];
    const push = (x0, y0) => {
      if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;
      const idx = y0 * width + x0;
      if (seen[idx]) return;
      const off = idx * 4;
      if (data[off] !== 0 || data[off + 1] !== 0 || data[off + 2] !== 0 || data[off + 3] !== 255) return;
      seen[idx] = 1;
      queue.push(idx);
    };
    for (let x0 = 0; x0 < width; x0++) {
      push(x0, 0);
      push(x0, height - 1);
    }
    for (let y0 = 1; y0 < height - 1; y0++) {
      push(0, y0);
      push(width - 1, y0);
    }
    while (queue.length) {
      const idx = queue.pop();
      const off = idx * 4;
      data[off + 3] = 0;
      const x0 = idx % width;
      const y0 = (idx / width) | 0;
      push(x0 - 1, y0);
      push(x0 + 1, y0);
      push(x0, y0 - 1);
      push(x0, y0 + 1);
    }
    cctx.putImageData(imageData, 0, 0);
    this.spriteCache.set(name, canvas);
    return canvas;
  }

  _startSequence() {
    if (this.sequenceStarted) return;
    this.sequenceStarted = true;
    const src = this.engine.playSound('SDPOLICE1');
    this.currentSound = src;
    if (src) {
      src.onended = () => {
        if (this.currentSound === src) this.currentSound = null;
        this.soundDone = true;
      };
    } else {
      this.soundDone = true;
    }
  }
}
