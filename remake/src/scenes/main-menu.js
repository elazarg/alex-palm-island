const ASSET_BASE = 'assets/menu';

const BUTTONS = [
  { name: 'intro', normal: 'MMINTRO2', hover: 'MMINTRO1', x: 11, y: 24, w: 236, h: 34 },
  { name: 'play', normal: 'MMPLAY2', hover: 'MMPLAY1', x: 11, y: 87, w: 92, h: 40 },
  { name: 'quit', normal: 'MMQUIT2', hover: 'MMQUIT1', x: 15, y: 148, w: 84, h: 41 },
];

const ALEX_X = 241;
const ALEX_Y = 5;
const ALEX_FRAMES = 8;
const ALEX_TICKS_PER_FRAME = 4;

export class MainMenuScene {
  constructor() {
    this.engine = null;
    this.hoveredButton = null;
    this.pressedButton = null;
    this.alexFrame = 1;
    this.alexTick = 0;
    this.onButton = null;
  }

  attach(engine) {
    this.engine = engine;
  }

  async load(engine) {
    const images = { MAINMENU: `${ASSET_BASE}/MAINMENU.png`, MMARROWCURSOR: `${ASSET_BASE}/MMARROWCURSOR.png` };
    for (const btn of BUTTONS) {
      images[btn.normal] = `${ASSET_BASE}/${btn.normal}.png`;
      images[btn.hover] = `${ASSET_BASE}/${btn.hover}.png`;
    }
    for (let i = 1; i <= ALEX_FRAMES; i++) images[`MMALEX${i}`] = `${ASSET_BASE}/MMALEX${i}.png`;
    await engine.loadImages(images);
  }

  init() {
    this.hoveredButton = null;
    this.pressedButton = null;
    this.alexFrame = 1;
    this.alexTick = 0;
    this.engine.cursor = 'MMARROWCURSOR';
  }

  destroy() {
    this.engine.cursor = null;
  }

  onMouseMove({ x, y }) {
    this.hoveredButton = BUTTONS.find((btn) => x >= btn.x && x < btn.x + btn.w && y >= btn.y && y < btn.y + btn.h)?.name || null;
  }

  onMouseDown() {
    this.pressedButton = this.hoveredButton;
  }

  onMouseUp() {
    if (this.pressedButton && this.pressedButton === this.hoveredButton && this.onButton) {
      this.onButton(this.pressedButton);
    }
    this.pressedButton = null;
  }

  tick() {
    this.alexTick++;
    if (this.alexTick >= ALEX_TICKS_PER_FRAME) {
      this.alexTick = 0;
      this.alexFrame++;
      if (this.alexFrame > ALEX_FRAMES) this.alexFrame = 1;
    }
  }

  render(ctx) {
    this.engine.drawSprite(ctx, 'MAINMENU', 0, 0);
    for (const btn of BUTTONS) {
      const sprite = this.pressedButton === btn.name ? btn.hover : btn.normal;
      this.engine.drawSprite(ctx, sprite, btn.x, btn.y);
    }
    this.engine.drawSprite(ctx, `MMALEX${this.alexFrame}`, ALEX_X, ALEX_Y);
  }
}
