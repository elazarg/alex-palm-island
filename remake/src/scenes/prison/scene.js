import { BitmapFont } from '../../ui/bitmap-font.js';
import { CURSOR_HOTSPOTS } from '../../ui/action-modes.js';
import { STANDARD_NOTE_LAYOUT } from '../../ui/note-layout.js';
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
  }

  attach(engine) {
    this.engine = engine;
  }

  async load(engine) {
    const images = {
      SNPRISON1: '../re/renders/sprites/cutscenes/PRISON/SNPRISON1.png',
      ARROWCURSOR: 'assets/cursors/ARROWCURSOR.png',
    };
    for (let i = 1; i <= 4; i++) {
      images[`DIG${i}`] = `../re/renders/sprites/cutscenes/PRISON/DIG${i}.png`;
    }
    for (const count of [2, 3, 4, 5]) {
      images[`TEXTWIN${count}`] = `assets/ui/TEXTWIN${count}.png`;
    }
    await engine.loadImages(images);

    const soundManifest = {};
    for (const sectionId of PRISON_RESOURCES.sections.messages) {
      const message = PRISON_RESOURCES.messageBySection[sectionId];
      if (message.sound) {
        soundManifest[message.sound] = `../re/renders/sounds/PRISON/${message.sound}.wav`;
      }
    }
    await engine.loadSounds(soundManifest);
    engine.registerCursorHotspot('ARROWCURSOR', CURSOR_HOTSPOTS.ARROWCURSOR);

    const fontImg = new Image();
    const fontData = await (await fetch('assets/mainfont.json')).json();
    await new Promise((resolve, reject) => {
      fontImg.onload = resolve;
      fontImg.onerror = reject;
      fontImg.src = 'assets/mainfont.png';
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
    this._playMessageSound();
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

    this.digTick++;
    if (this.digTick >= DIG_FRAME_TICKS) {
      this.digTick = 0;
      this.digFrame = (this.digFrame % 4) + 1;
    }
  }

  render(ctx) {
    this.engine.drawSprite(ctx, 'SNPRISON1', 0, 0);
    const pos = DIG_POSITIONS[this.digFrame - 1];
    this.engine.drawSprite(ctx, `DIG${this.digFrame}`, pos.x, pos.y);
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
}
