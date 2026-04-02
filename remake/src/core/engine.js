import { InputController } from './input.js';

export const WIDTH = 320;
export const HEIGHT = 200;
export const TICK_MS = 55;

export class Engine {
  constructor(canvas, overlayCanvas = null) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.width = WIDTH;
    this.height = HEIGHT;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.direction = 'ltr';
    this.overlayCanvas = overlayCanvas;
    this.overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;

    this.assets = new Map();
    this.cursor = null;
    this.cursorHotspots = new Map();
    this.scene = null;
    this.running = false;
    this.lastTick = 0;
    this._audioUnlockQueue = [];

    this.input = new InputController(this);
    this.input.attach();
  }

  get mouseX() {
    return this.input.mouseX;
  }

  get mouseY() {
    return this.input.mouseY;
  }

  registerCursorHotspot(name, hotspot) {
    this.cursorHotspots.set(name, hotspot);
  }

  async loadImages(paths) {
    const entries = Object.entries(paths);
    await Promise.all(entries.map(([name, url]) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.assets.set(name, img);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    })));
  }

  async loadSounds(paths) {
    const entries = Object.entries(paths);
    for (const [name, url] of entries) {
      try {
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const decoded = await this.audioCtx.decodeAudioData(buf);
        this.assets.set(name, decoded);
      } catch (error) {
        console.warn(`Failed to load sound ${name}: ${error.message}`);
      }
    }
  }

  async resumeAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this._flushAudioUnlockQueue();
  }

  isAudioLocked() {
    return Boolean(this.audioCtx && this.audioCtx.state === 'suspended');
  }

  runWhenAudioUnlocked(cb) {
    if (typeof cb !== 'function') return;
    if (!this.isAudioLocked()) {
      cb();
      return;
    }
    this._audioUnlockQueue.push(cb);
  }

  playSound(name) {
    const buffer = this.assets.get(name);
    if (!buffer || !this.audioCtx) return null;
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    source.start();
    return source;
  }

  playBeep({ frequency = 660, duration = 0.12, type = 'square', gain = 0.035 } = {}) {
    if (!this.audioCtx) return null;
    const osc = this.audioCtx.createOscillator();
    const amp = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(this.audioCtx.destination);
    const now = this.audioCtx.currentTime;
    osc.start(now);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.stop(now + duration);
    return osc;
  }

  getAsset(name) {
    return this.assets.get(name);
  }

  setScene(scene) {
    if (this.scene && typeof this.scene.destroy === 'function') {
      this.scene.destroy();
    }
    this.scene = scene;
    scene.attach(this);
    scene.init();
  }

  start() {
    this.running = true;
    this.lastTick = performance.now();
    this._frame(performance.now());
  }

  drawSprite(ctx, name, x, y) {
    const img = this.assets.get(name);
    if (!img) {
      console.warn(`Missing sprite: ${name}`);
      return;
    }
    const hotspot = this.cursorHotspots.get(name);
    if (hotspot) {
      ctx.drawImage(img, x - hotspot.x, y - hotspot.y);
    } else {
      ctx.drawImage(img, x, y);
    }
  }

  _frame(now) {
    if (!this.running) return;

    while (now - this.lastTick >= TICK_MS) {
      this.lastTick += TICK_MS;
      this.scene?.tick();
    }

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, this.height);
    this.scene?.render(ctx);

    const overlayCtx = this.overlayCtx;
    if (overlayCtx && this.overlayCanvas) {
      const overlayMetrics = this._prepareOverlayCanvas();
      overlayCtx.clearRect(0, 0, overlayMetrics.cssWidth, overlayMetrics.cssHeight);
      this.scene?.renderOverlay?.(overlayCtx, overlayMetrics);
    }

    if (this.cursor && this.mouseX >= 0) {
      this.drawSprite(ctx, this.cursor, this.mouseX, this.mouseY);
    }

    requestAnimationFrame((t) => this._frame(t));
  }

  _flushAudioUnlockQueue() {
    if (this.isAudioLocked()) return;
    if (!this._audioUnlockQueue.length) return;
    const queue = this._audioUnlockQueue.splice(0, this._audioUnlockQueue.length);
    for (const cb of queue) cb();
  }

  _prepareOverlayCanvas() {
    if (!this.overlayCanvas || !this.overlayCtx) return;
    const cssWidth = Math.max(1, this.overlayCanvas.clientWidth || this.canvas.clientWidth || this.width);
    const cssHeight = Math.max(1, this.overlayCanvas.clientHeight || this.canvas.clientHeight || this.height);
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (this.overlayCanvas.width !== width || this.overlayCanvas.height !== height) {
      this.overlayCanvas.width = width;
      this.overlayCanvas.height = height;
    }
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
      cssWidth,
      cssHeight,
      scaleX: cssWidth / this.width,
      scaleY: cssHeight / this.height,
    };
  }
}
