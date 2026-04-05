import { BitmapFont } from '../../ui/bitmap-font.js';
import { CURSOR_HOTSPOTS } from '../../ui/action-modes.js';
import { STANDARD_NOTE_LAYOUT } from '../../ui/note-layout.js';
import { buildNarrationSoundManifest } from '../../runtime/scx-sound-manifest.js';
import { renderNotePopup } from '../../ui/note-renderer.js';
import { PRISON_RESOURCES } from './resources.js';

const DIG_POSITIONS = Object.freeze([
  { x: 164, y: 171 },
  { x: 160, y: 118 },
  { x: 174, y: 116 },
  { x: 160, y: 141 },
]);
const DIG_FRAME_TICKS = 6;
const FADE_TICKS = 18;
const PRISON_NARRATION_SOUND_MANIFEST = buildNarrationSoundManifest(PRISON_RESOURCES);

export class PrisonScene {
  constructor(options = {}) {
    this.engine = null;
    this.reasonCode = options.reasonCode ?? 503;
    this.onDone = null;
    this.font = null;
    this.noteLayout = STANDARD_NOTE_LAYOUT;
    this.message = null;
    this.currentSound = null;
    this.soundLocked = false;
    this.fade = 'in';
    this.fadeAlpha = 0;
    this.fadeCb = null;
    this.digFrame = 1;
    this.digTick = 0;
    this.spriteCache = new Map();
    this.sequenceStarted = false;
  }

  attach(engine) {
    this.engine = engine;
  }

  async load(engine) {
    const images = {
      SNPRISON1: '../assets/prison/SNPRISON1.png',
      ARROWCURSOR: '../assets/cursors/ARROWCURSOR.png',
    };
    for (let i = 1; i <= 4; i++) {
      images[`DIG${i}`] = `../assets/prison/DIG${i}.png`;
    }
    for (const count of [2, 3, 4, 5]) {
      images[`TEXTWIN${count}`] = `../assets/ui/TEXTWIN${count}.png`;
    }
    await engine.loadImages(images);

    await engine.loadSounds(PRISON_NARRATION_SOUND_MANIFEST);
    engine.registerCursorHotspot('ARROWCURSOR', CURSOR_HOTSPOTS.ARROWCURSOR);

    const fontImg = new Image();
    const fontData = await (await fetch('../assets/mainfont.json')).json();
    await new Promise((resolve, reject) => {
      fontImg.onload = resolve;
      fontImg.onerror = reject;
      fontImg.src = '../assets/mainfont.png';
    });
    this.font = new BitmapFont(fontImg, fontData);
  }

  init() {
    this.engine.cursor = 'ARROWCURSOR';
    this.message = PRISON_RESOURCES.messageBySection[this.reasonCode] || PRISON_RESOURCES.messageBySection[503];
    this.digFrame = 1;
    this.digTick = 0;
    this.fade = 'in';
    this.fadeAlpha = 0;
    this.fadeCb = null;
    this.sequenceStarted = false;
    this.soundLocked = Boolean(this.message?.sound);
    this.engine.runWhenAudioUnlocked(() => this._startSequence());
  }

  destroy() {
    this._stopSound();
  }

  onMouseDown() {
    if (this.soundLocked || this.fade === 'out') return;
    this._fadeOut(() => this.onDone?.({ scene: 'menu' }));
  }

  onKeyDown({ key }) {
    if (key !== 'Enter') return;
    if (this.soundLocked || this.fade === 'out') return;
    this._fadeOut(() => this.onDone?.({ scene: 'menu' }));
  }

  tick() {
    if (this.fade === 'in') {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + 1 / FADE_TICKS);
      if (this.fadeAlpha >= 1) this.fade = 'none';
    } else if (this.fade === 'out') {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - 1 / FADE_TICKS);
      if (this.fadeAlpha <= 0) {
        this.fade = 'none';
        const cb = this.fadeCb;
        this.fadeCb = null;
        cb?.();
      }
    }

    if (this.sequenceStarted) {
      this.digTick++;
      if (this.digTick >= DIG_FRAME_TICKS) {
        this.digTick = 0;
        this.digFrame = (this.digFrame % 4) + 1;
      }
    }
  }

  render(ctx) {
    this.engine.drawSprite(ctx, 'SNPRISON1', 0, 0);
    const pos = DIG_POSITIONS[this.digFrame - 1];
    this._drawCutoutSprite(ctx, `DIG${this.digFrame}`, pos.x, pos.y);
    if (this.message && this.font) {
      renderNotePopup(ctx, {
        assets: this.engine.assets,
        font: this.font,
        modal: { text: this.message.text },
        layout: this.noteLayout,
      });
    }

    if (this.fadeAlpha < 1) {
      ctx.globalAlpha = 1 - this.fadeAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 320, 200);
      ctx.globalAlpha = 1;
    }
  }

  _playMessageSound() {
    this._stopSound();
    this.soundLocked = Boolean(this.message?.sound);
    if (!this.soundLocked) return;
    const src = this.engine.playSound(this.message.sound);
    this.currentSound = src;
    if (src) {
      src.onended = () => {
        if (this.currentSound === src) this.currentSound = null;
        this.soundLocked = false;
      };
    } else {
      this.soundLocked = false;
    }
  }

  _stopSound() {
    if (!this.currentSound) return;
    try { this.currentSound.stop(); } catch {}
    this.currentSound = null;
    this.soundLocked = false;
  }

  _fadeOut(cb) {
    this.fade = 'out';
    this.fadeCb = cb;
  }

  _startSequence() {
    if (this.sequenceStarted) return;
    this.sequenceStarted = true;
    this._playMessageSound();
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
}
