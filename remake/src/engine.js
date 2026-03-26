// Game engine core: canvas, asset loading, game loop

const WIDTH = 320;
const HEIGHT = 200;
const SCALE = 3;
const TICK_MS = 55; // ~18.2 Hz DOS timer tick

export class Engine {
  constructor(canvas) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.assets = new Map();
    this.scene = null;
    this.lastTick = 0;
    this.running = false;
  }

  async loadImages(paths) {
    const entries = Object.entries(paths);
    const promises = entries.map(([name, url]) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.assets.set(name, img);
          resolve();
        };
        img.onerror = () => reject(new Error(`Failed to load: ${url}`));
        img.src = url;
      });
    });
    await Promise.all(promises);
  }

  getAsset(name) {
    return this.assets.get(name);
  }

  setScene(scene) {
    this.scene = scene;
    scene.engine = this;
    scene.init();
  }

  start() {
    this.running = true;
    this.lastTick = performance.now();
    this._frame(performance.now());
  }

  _frame(now) {
    if (!this.running) return;

    // Accumulate ticks
    while (now - this.lastTick >= TICK_MS) {
      this.lastTick += TICK_MS;
      if (this.scene) this.scene.tick();
    }

    // Render
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.scene) this.scene.render(ctx);

    requestAnimationFrame((t) => this._frame(t));
  }

  drawSprite(ctx, name, x, y) {
    const img = this.assets.get(name);
    if (img) ctx.drawImage(img, x, y);
  }
}
