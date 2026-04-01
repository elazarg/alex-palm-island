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

  destroy() {
    if (!this.currentSound) return;
    try { this.currentSound.stop(); } catch {}
    this.currentSound = null;
  }

  tick() {
    this.anim?.tick();
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
      this.engine.drawSprite(ctx, this.anim.spriteName, this.anim.x, this.anim.y);
    }
  }
}
