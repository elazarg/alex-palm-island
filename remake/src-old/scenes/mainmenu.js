// Main Menu scene — hardcoded in original OVR, not SCX-driven.
//
// Layout (from original game screenshot):
//   - MAINMENU background (320x200, grayscale Alex art)
//   - "Introduction" button (MMINTRO1/2, 236x34) — top-left area
//   - "Play" button (MMPLAY1/2, 92x40) — middle-left
//   - "Quit" button (MMQUIT1/2, 84x41) — bottom-left
//   - Alex walking animation (MMALEX1-8, 64x105) — right side
//
// Buttons have normal (1) and highlighted (2) states.
// In the remake, "Introduction" could play the intro cutscenes,
// "Play" starts the game, "Quit" is a no-op in browser.

const ASSET_BASE = 'assets/menu';

// Button positions (estimated from original 320x200 layout)
const BUTTONS = [
  {
    name: 'intro',
    normal: 'MMINTRO2',
    hover: 'MMINTRO1',
    x: 11, y: 24,
    w: 236, h: 34,
  },
  {
    name: 'play',
    normal: 'MMPLAY2',
    hover: 'MMPLAY1',
    x: 11, y: 87,
    w: 92, h: 40,
  },
  {
    name: 'quit',
    normal: 'MMQUIT2',
    hover: 'MMQUIT1',
    x: 15, y: 148,
    w: 84, h: 41,
  },
];

// Alex walk animation
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
    this.onButton = null; // callback: (buttonName) => void
  }

  async load(engine) {
    const images = {};
    images['MAINMENU'] = `${ASSET_BASE}/MAINMENU.png`;
    for (const btn of BUTTONS) {
      images[btn.normal] = `${ASSET_BASE}/${btn.normal}.png`;
      images[btn.hover] = `${ASSET_BASE}/${btn.hover}.png`;
    }
    for (let i = 1; i <= ALEX_FRAMES; i++) {
      images[`MMALEX${i}`] = `${ASSET_BASE}/MMALEX${i}.png`;
    }
    images['MMARROWCURSOR'] = `${ASSET_BASE}/MMARROWCURSOR.png`;
    await engine.loadImages(images);
  }

  init() {
    this.hoveredButton = null;
    this.alexFrame = 1;
    this.alexTick = 0;
    this.engine.cursor = 'MMARROWCURSOR';

    // Listen for mouse events on the canvas
    const canvas = this.engine.ctx.canvas;

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / (rect.width / 320);
      const my = (e.clientY - rect.top) / (rect.height / 200);
      this.hoveredButton = null;
      for (const btn of BUTTONS) {
        if (mx >= btn.x && mx < btn.x + btn.w &&
            my >= btn.y && my < btn.y + btn.h) {
          this.hoveredButton = btn.name;
          break;
        }
      }
    };

    canvas.onmousedown = (e) => {
      this.pressedButton = this.hoveredButton;
    };

    canvas.onmouseup = (e) => {
      if (this.pressedButton && this.pressedButton === this.hoveredButton && this.onButton) {
        this.onButton(this.pressedButton);
      }
      this.pressedButton = null;
    };
  }

  tick() {
    // Animate Alex walking
    this.alexTick++;
    if (this.alexTick >= ALEX_TICKS_PER_FRAME) {
      this.alexTick = 0;
      this.alexFrame++;
      if (this.alexFrame > ALEX_FRAMES) this.alexFrame = 1;
    }
  }

  render(ctx) {
    // Background
    this.engine.drawSprite(ctx, 'MAINMENU', 0, 0);

    // Buttons (normal or highlighted)
    for (const btn of BUTTONS) {
      const sprite = this.pressedButton === btn.name ? btn.hover : btn.normal;
      this.engine.drawSprite(ctx, sprite, btn.x, btn.y);
    }

    // Alex walking animation
    this.engine.drawSprite(ctx, `MMALEX${this.alexFrame}`, ALEX_X, ALEX_Y);
  }

  destroy() {
    this.engine.cursor = null;
    const canvas = this.engine.ctx.canvas;
    canvas.onmousemove = null;
    canvas.onmousedown = null;
    canvas.onmouseup = null;
  }
}
