import { WIDTH, HEIGHT } from '../core/engine.js';
import { loadBitmapFont } from '../ui/font-loader.js';

function range(pfx, a, b) {
  const r = [];
  for (let i = a; i <= b; i++) r.push(`${pfx}${i}`);
  return r;
}

const FADE_TICKS = 18;
const ANIM_TICK_SCALE = 2;
export const INTRO_PARTS = Object.freeze(['opening', 'open2', 'spymastr', 'open3', 'open4']);
const SCENE_ORDER = INTRO_PARTS;

const WALK_POS = [
  [37,20],[132,35],[142,28],[136,35],[132,29],[128,24],[118,20],[119,32],[122,24],[123,20],[136,20],[127,20],[122,20],[117,20],[102,20],[103,20],[106,20],[108,20],[125,20],[115,20],[103,20],[93,20],[69,20],[68,20],[70,20],[70,20],[97,20],[77,20],[46,20],[37,20],[37,20],[37,20],[37,20],[37,20],[37,20],[42,20],[46,20],[44,20],[37,20],[37,20],[53,20],[98,20],[97,20],[101,20],[99,20],[95,20],[77,20],[76,20],[93,20],[121,20],[119,20],[119,20],[120,20],[116,20],[101,20],[100,20],[113,20],[131,20],[130,20],[129,23],[129,24],[126,24],[115,26],[114,32],[123,31],[137,32],[136,32],[135,39],[136,39],[132,39],[123,39],[121,43],[142,51],
];
const STREET_POS = [[260,0],[209,10],[141,34],[75,57],[37,78],[37,100],[37,150],[37,168]];
const PHONE_X = 93;
const PHONE_Y = 66;
const BPHONE_X = 37;
const BPHONE_Y = 20;
const BSTREET_X = 37;
const BSTREET_Y = 10;

const ASSETS = {
  opening: {
    base: '../assets/opening', bg: 'SNOPENING1',
    sprites: ['BPHONE', ...range('PHONE',1,25), 'BSTREET', ...range('STREET',1,8), ...range('LFILM',1,3), ...range('RFILM',1,3)],
    sounds: ['SDPHONE1','SDPHONE2','SDPHONE3','SDPHONE4','SDCAR1','SDSTREET1'],
  },
  open2: {
    base: '../assets/open2', bg: 'SNOPEN21',
    sprites: ['BHALL','BHALL2','BHALL3', ...range('WALK',1,73), ...range('DOOR',1,13), ...range('LFILM',1,3), ...range('RFILM',1,3)],
    sounds: ['SDDOOR1','SDDOOR2','SDWALK1'],
  },
  spymastr: {
    base: '../assets/spymastr', bg: 'SNSPYMASTER1',
    sprites: [...range('SPYTLK',1,7), 'BAG', ...range('BAG',1,16), 'LAMP', 'PHONE', 'SPYPLAY1','SPYPLAY2','SPYREWIND1','SPYREWIND2'],
    sounds: range('SPY',1,11),
  },
  open3: {
    base: '../assets/open3', bg: 'SNOPEN31',
    sprites: ['BPLANE', ...range('O3PLANE',1,23), ...range('LFILM',1,3), ...range('RFILM',1,3)],
    sounds: ['SDPLANE1'],
    remap: Object.fromEntries(range('O3PLANE',1,23).map((k,i) => [k, `PLANE${i+1}`])),
  },
  open4: {
    base: '../assets/open4', bg: 'SNOPEN41',
    sprites: [...range('O4PLANE',1,25), ...range('PROG',1,8), ...range('GRAPH',1,20), ...range('LANG',1,20), ...range('HEBR',1,9), ...range('ONDA',1,15), ...range('PROD',1,10)],
    sounds: ['SDPLANE1'],
    remap: Object.fromEntries(range('O4PLANE',1,25).map((k,i) => [k, `PLANE${i+1}`])),
  },
};

const DIALOG = [
  { text: '"Good morning, Alex."', sound: 'SPY1' },
  { text: '"We have a spy named Walter."', sound: 'SPY2' },
  { text: '"He went to Palm Island but now we don\'t know where he is."', sound: 'SPY3' },
  { text: '"Go to Palm Island.  Find Walter before it\'s too late."', sound: 'SPY4' },
  { text: '"Go everywhere.  Look at everything.  Talk to everyone."', sound: 'SPY5' },
  { text: '"Take things from the places you visit.  You never know what may come in handy."', sound: 'SPY6' },
  { text: '"Here is your bag.  Don\'t lose it!  Your passport is inside."', sound: 'SPY7' },
  { text: '"There is also a letter to Walter inside the bag."', sound: 'SPY8' },
  { text: '"When you find him, give it to him."', sound: 'SPY9' },
  { text: '"Palm Island is a very strange place.  Anything can happen there, so be careful!"', sound: 'SPY10' },
  { text: '"Remember!  I am watching!"', sound: 'SPY11' },
];

export class IntroScene {
  constructor(options = {}) {
    this.engine = null;
    this.options = options;
    this.onDone = null;
    this.onRouteChange = null;
    this.sceneIdx = 0;
    this.sceneName = '';
    this.phase = 0;
    this.phaseTick = 0;
    this.fade = 'none';
    this.fadeAlpha = 1;
    this.currentSound = null;
    this.dialogIdx = -1;
    this.dialogText = '';
    this.isTalking = false;
    this.talkFrame = 1;
    this.talkTick = 0;
    this.awaitingClick = false;
    this.needsAudioUnlock = false;
    this.bagAnimPlaying = false;
    this.bagAnimFrame = 1;
    this.bagAnimTick = 0;
    this.bagVisible = false;
    this.pressedBtn = null;
  }

  attach(engine) {
    this.engine = engine;
  }

  async load(engine) {
    for (const [, sc] of Object.entries(ASSETS)) {
      const imgs = { [sc.bg]: `${sc.base}/${sc.bg}.png` };
      for (const s of sc.sprites) {
        const filename = (sc.remap && sc.remap[s]) || s;
        imgs[s] = `${sc.base}/${filename}.png`;
      }
      await engine.loadImages(imgs);
      if (sc.sounds.length) {
        const snds = {};
        for (const s of sc.sounds) snds[s] = `${sc.base}/${s}.wav`;
        await engine.loadSounds(snds);
      }
    }
    await engine.loadImages({ MMARROWCURSOR: '../assets/menu/MMARROWCURSOR.png' });

    this.font = await loadBitmapFont();
  }

  init() {
    const sub = this.options.startPart || null;
    const startName = (sub && SCENE_ORDER.includes(sub)) ? sub : SCENE_ORDER[0];
    this.sceneIdx = SCENE_ORDER.indexOf(startName);
    this._startScene(startName);
  }

  destroy() {
    this._stopSound();
  }

  onMouseMove({ x, y }) {
    if (!this.awaitingClick || this.sceneName !== 'spymastr') {
      this.hoveredBtn = null;
      return;
    }
    this.hoveredBtn = this._getButtonAt(x, y);
  }

  onMouseDown({ x, y }) {
    this.engine.resumeAudio();
    if (this.needsAudioUnlock) {
      this.needsAudioUnlock = false;
      if (this.sceneName === 'spymastr') this._advanceDialog();
      return;
    }
    this.pressedBtn = this._getButtonAt(x, y);
  }

  onMouseUp({ x, y }) {
    const released = this._getButtonAt(x, y);
    if (this.pressedBtn && this.pressedBtn === released) {
      if (this.pressedBtn === 'play') {
        this.awaitingClick = false;
        this._advanceDialog();
      } else if (this.pressedBtn === 'rewind') {
        this.awaitingClick = false;
        this._replayDialog();
      }
    }
    this.pressedBtn = null;
  }

  onKeyDown({ key }) {
    if (key !== 'Enter') return;
    if (this.sceneName !== 'open4') return;
    if (this.fade !== 'none') return;
    this._fadeOut(() => {
      if (this.onDone) this.onDone();
    });
  }

  tick() {
    if (document.hidden && this.engine.audioCtx) {
      this.engine.audioCtx.suspend();
    } else if (this.engine.audioCtx) {
      this.engine.audioCtx.resume();
    }

    if (this.fade === 'in') {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + 1 / FADE_TICKS);
      if (this.fadeAlpha >= 1) {
        this.fade = 'none';
        if (this._fadeCb) { this._fadeCb(); this._fadeCb = null; }
      }
    } else if (this.fade === 'out') {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - 1 / FADE_TICKS);
      if (this.fadeAlpha <= 0) {
        this.fade = 'none';
        if (this._fadeCb) { this._fadeCb(); this._fadeCb = null; }
      }
    }

    if (this.fade === 'in') return;
    if (this.needsAudioUnlock) return;

    this.phaseTick++;
    switch (this.sceneName) {
      case 'opening': this._tickOpening(); break;
      case 'open2': this._tickOpen2(); break;
      case 'spymastr': this._tickSpyMaster(); break;
      case 'open3': this._tickOpen3(); break;
      case 'open4': this._tickOpen4(); break;
    }
  }

  render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    switch (this.sceneName) {
      case 'opening': this._renderOpening(ctx); break;
      case 'open2': this._renderOpen2(ctx); break;
      case 'spymastr': this._renderSpyMaster(ctx); break;
      case 'open3': this._renderOpen3(ctx); break;
      case 'open4': this._renderOpen4(ctx); break;
    }

    if (this.fadeAlpha < 1) {
      ctx.globalAlpha = 1 - this.fadeAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    }
  }

  _getButtonAt(x, y) {
    if (!this.awaitingClick || this.sceneName !== 'spymastr') return null;
    if (x >= 272 && x <= 300 && y >= 170 && y <= 194) return 'play';
    if (x >= 20 && x <= 48 && y >= 170 && y <= 194) return 'rewind';
    return null;
  }

  _startScene(name) {
    this.sceneName = name;
    this.phase = 0;
    this.phaseTick = 0;
    this.dialogIdx = -1;
    this.dialogText = '';
    this.isTalking = false;
    this.awaitingClick = false;
    this.hoveredBtn = null;
    this.pressedBtn = null;
    this._stopSound();
    this.onRouteChange?.({ scene: 'intro', part: name });
    this.engine.cursor = name === 'spymastr' ? 'MMARROWCURSOR' : null;

    if (name === 'opening') this._initPhoneSteps();
    if (this.engine.audioCtx && this.engine.audioCtx.state === 'suspended') {
      this.needsAudioUnlock = true;
    } else {
      this.needsAudioUnlock = false;
    }

    this._fadeIn();
    if (name === 'spymastr' && !this.needsAudioUnlock) {
      this._advanceDialog();
    }
  }

  _nextScene() {
    this.sceneIdx++;
    if (this.sceneIdx >= SCENE_ORDER.length) {
      if (this.onDone) this.onDone();
    } else {
      this._startScene(SCENE_ORDER[this.sceneIdx]);
    }
  }

  _fadeIn(cb) {
    this.fade = 'in';
    this.fadeAlpha = 0;
    this._fadeCb = cb || null;
  }

  _fadeOut(cb) {
    this.fade = 'out';
    this.fadeAlpha = 1;
    this._fadeCb = cb || null;
  }

  _playSound(name) {
    this._stopSound();
    this.currentSound = this.engine.playSound(name);
    return this.currentSound;
  }

  _stopSound() {
    if (!this.currentSound) return;
    try { this.currentSound.stop(); } catch {}
    this.currentSound = null;
  }

  _advanceDialog() {
    this.dialogIdx++;
    if (this.dialogIdx >= DIALOG.length) {
      this._fadeOut(() => this._nextScene());
      return;
    }
    const entry = DIALOG[this.dialogIdx];
    this.dialogText = entry.text;
    this.talkFrame = 1;
    this.isTalking = true;
    this.awaitingClick = false;
    if (this.dialogIdx === 6) {
      this.bagAnimPlaying = true;
      this.bagAnimFrame = 1;
      this.bagAnimTick = 0;
    }
    const src = this._playSound(entry.sound);
    if (src) {
      src.onended = () => {
        this.isTalking = false;
        this.talkFrame = 1;
        this.awaitingClick = true;
      };
    } else {
      this.isTalking = false;
      this.awaitingClick = true;
    }
  }

  _replayDialog() {
    const entry = DIALOG[this.dialogIdx];
    if (!entry) return;
    this.talkFrame = 1;
    this.isTalking = true;
    this.awaitingClick = false;
    const src = this._playSound(entry.sound);
    if (src) {
      src.onended = () => {
        this.isTalking = false;
        this.talkFrame = 1;
        this.awaitingClick = true;
      };
    } else {
      this.isTalking = false;
      this.awaitingClick = true;
    }
  }

  _initPhoneSteps() {
    const S = (snd) => ({ sound: snd });
    const F = (f, t) => ({ frame: f, ticks: Math.max(t * ANIM_TICK_SCALE, ANIM_TICK_SCALE) });
    this._phoneSteps = [
      F(1,4), S('SDPHONE1'),
      F(1,1), F(2,1), F(1,1), F(2,1), F(1,1), F(2,1), F(1,7),
      S('SDPHONE1'),
      F(2,1), F(1,1), F(2,1), F(1,1), F(2,1),
      F(3,2), F(4,2), F(5,2), F(6,2), F(7,2), F(8,2),
      S('SDPHONE1'),
      F(8,1), F(7,1), F(8,1), F(7,1),
      F(9,2), F(10,1), F(11,1), F(10,1), F(11,1),
      S('SDPHONE2'),
      F(12,1), F(13,1), F(14,1), F(15,1), F(16,1),
      S('SDPHONE3'),
      F(16,2), F(15,2), F(16,2), F(15,2), F(16,2), F(15,2), F(16,2),
      F(17,1), F(18,1), F(19,1), F(20,1),
      S('SDPHONE4'),
      F(21,1), F(22,1), F(23,1), F(24,1), F(25,4),
      { fadeToStreet: true },
    ];
    this._phoneIdx = 0;
    this._phoneTick = 0;
    this._phoneFrame = 1;
  }

  _tickOpening() {
    if (!this._phoneSteps) this._initPhoneSteps();
    if (this.phase === 0) {
      while (this._phoneIdx < this._phoneSteps.length) {
        const step = this._phoneSteps[this._phoneIdx];
        if (step.fadeToStreet) {
          if (this.fade !== 'none') return;
          this._fadeOut(() => {
            this.phase = 1;
            this.phaseTick = 0;
            this._fadeIn();
          });
          return;
        }
        if (step.sound) {
          this._playSound(step.sound);
          this._phoneIdx++;
          continue;
        }
        this._phoneFrame = step.frame;
        if (step.ticks === 0) {
          this._phoneIdx++;
          continue;
        }
        this._phoneTick++;
        if (this._phoneTick >= step.ticks) {
          this._phoneTick = 0;
          this._phoneIdx++;
        }
        break;
      }
    } else if (this.phase === 1) {
      const T = this.phaseTick;
      const S = ANIM_TICK_SCALE;
      if (T === 1) this._playSound('SDSTREET1');
      if (T === 5 * S) this._playSound('SDCAR1');
      if (T === 8 * 5 * S + FADE_TICKS) this._fadeOut(() => this._nextScene());
    }
  }

  _tickOpen2() {
    const T = this.phaseTick;
    const S = ANIM_TICK_SCALE;
    if (this.phase === 0) {
      if (T === 1) this._playSound('SDWALK1');
      if (T === 32 * S) { this.phase = 1; this.phaseTick = 0; }
    } else if (this.phase === 1) {
      if (T === 1) this._playSound('SDWALK1');
      if (T === 41 * S) { this.phase = 2; this.phaseTick = 0; }
    } else if (this.phase === 2) {
      const openEnd = 6 * S;
      const holdEnd = openEnd + 10 * S;
      const closeEnd = holdEnd + 7 * S;
      if (T === 1) this._playSound('SDDOOR1');
      if (T === holdEnd) this._playSound('SDDOOR2');
      if (T === closeEnd + 4 * S) this._fadeOut(() => this._nextScene());
    }
  }

  _tickSpyMaster() {
    if (this.bagAnimPlaying) {
      this.bagAnimTick++;
      if (this.bagAnimTick >= 3 * ANIM_TICK_SCALE) {
        this.bagAnimTick = 0;
        this.bagAnimFrame++;
        if (this.bagAnimFrame > 16) {
          this.bagAnimPlaying = false;
          this.bagVisible = true;
        }
      }
    } else if (this.isTalking) {
      this.talkTick++;
      if (this.talkTick >= 4) {
        this.talkTick = 0;
        this.talkFrame = (this.talkFrame % 7) + 1;
      }
    }
  }

  _tickOpen3() {
    const T = this.phaseTick;
    const S = ANIM_TICK_SCALE;
    if (T === 1) this._playSound('SDPLANE1');
    if (T === 23 * S + 8 * S) this._fadeOut(() => this._nextScene());
  }

  _tickOpen4() {
    if (!this._creditGroups) this._initCredits();
    const T = this.phaseTick;
    const S = ANIM_TICK_SCALE;
    const lastGroup = this._creditGroups[this._creditGroups.length - 1];
    const endTick = lastGroup._startTick + lastGroup._totalTicks + 5 * S;
    if (T >= endTick) {
      this._fadeOut(() => {
        if (this.onDone) this.onDone();
      });
    }
  }

  _initCredits() {
    const S = ANIM_TICK_SCALE;
    this._creditGroups = [
      { prefix: 'PROG', count: 8, hold: 30, exitMode: 'reverse' },
      { prefix: 'GRAPH', count: 20, hold: 25, exitMode: 'reverse' },
      { prefix: 'LANG', count: 20, hold: 30, exitMode: 'reverse' },
      { prefix: 'HEBR', count: 9, hold: 30, exitMode: 'reverse' },
      { prefix: 'PROD', count: 10, hold: 25, exitMode: 'reverse' },
      { prefix: 'ONDA', count: 8, hold: 40, exitMode: 'zoom', exitCount: 7 },
    ];
    let t = 5 * S;
    for (const g of this._creditGroups) {
      const exitFrames = g.exitCount || g.count;
      g._enterTicks = g.count * S;
      g._holdTicks = g.hold * S;
      g._exitTicks = exitFrames * S;
      g._totalTicks = g._enterTicks + g._holdTicks + g._exitTicks;
      g._startTick = t;
      t += g._totalTicks + 5 * S;
    }
  }

  _renderOpening(ctx) {
    const T = this.phaseTick;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    if (this.phase === 0 && this._phoneSteps) {
      draw('BPHONE', BPHONE_X, BPHONE_Y);
      draw(`PHONE${this._phoneFrame}`, PHONE_X, PHONE_Y);
    } else if (this.phase === 1) {
      draw('BSTREET', BSTREET_X, BSTREET_Y);
      const fi = Math.min(Math.floor(T / (5 * ANIM_TICK_SCALE)), 7);
      const p = STREET_POS[fi];
      draw(`STREET${fi + 1}`, p[0], p[1]);
    }
  }

  _renderOpen2(ctx) {
    const T = this.phaseTick;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    if (this.phase === 0) {
      draw('BHALL', 37, 20);
      const fi = Math.min(Math.floor(T / ANIM_TICK_SCALE), 31);
      const p = WALK_POS[fi];
      draw(`WALK${fi + 1}`, p[0], p[1]);
    } else if (this.phase === 1) {
      draw('BHALL2', 37, 20);
      const fi = Math.min(Math.floor(T / ANIM_TICK_SCALE), 40);
      const idx = 32 + fi;
      const p = WALK_POS[idx] || WALK_POS[72];
      draw(`WALK${idx + 1}`, p[0], p[1]);
    } else if (this.phase === 2) {
      draw('BHALL3', 37, 20);
      const S = ANIM_TICK_SCALE;
      const openEnd = 6 * S;
      const holdEnd = openEnd + 10 * S;
      const closeEnd = holdEnd + 7 * S;
      let doorFrame;
      if (T < openEnd) doorFrame = Math.min(Math.floor(T / S) + 1, 6);
      else if (T < holdEnd) doorFrame = 6;
      else if (T < closeEnd) doorFrame = Math.min(7 + Math.floor((T - holdEnd) / S), 13);
      else doorFrame = 13;
      draw(`DOOR${doorFrame}`, 37, 20);
    }
  }

  _renderSpyMaster(ctx) {
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    draw('SNSPYMASTER1', 0, 0);
    if (this.bagAnimPlaying) draw(`BAG${this.bagAnimFrame}`, 79, 37);
    else draw(`SPYTLK${this.talkFrame}`, 95, 37);
    if (this.bagVisible) draw('BAG', 79, 88);
    draw('LAMP', 32, 68);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 172, WIDTH, 28);
    if (this.awaitingClick) {
      draw(this.pressedBtn === 'rewind' ? 'SPYREWIND1' : 'SPYREWIND2', 10, 174);
      draw(this.pressedBtn === 'play' ? 'SPYPLAY1' : 'SPYPLAY2', 272, 174);
    }
    if (this.dialogText && this.font) {
      this.font.drawWrapped(ctx, this.dialogText, 158, 174, 215, 11);
    }
  }

  _renderOpen3(ctx) {
    const T = this.phaseTick;
    const S = ANIM_TICK_SCALE;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    draw('BPLANE', 37, 20);
    const POS = [[279,89],[272,73],[265,68],[256,66],[247,64],[239,62],[230,62],[219,59],[208,59],[197,56],[184,55],[171,53],[157,51],[143,48],[127,47],[109,42],[91,34],[69,23],[46,20],[37,20],[37,20],[37,20],[37,20]];
    const fi = Math.min(Math.floor(T / S), 22);
    const p = POS[fi];
    draw(`O3PLANE${fi + 1}`, p[0], p[1]);
  }

  _renderOpen4(ctx) {
    const T = this.phaseTick;
    const S = ANIM_TICK_SCALE;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    const pf = Math.floor(T / (2 * S)) % 25;
    draw(`O4PLANE${pf + 1}`, 37, 20);
    if (!this._creditGroups) return;
    const CEN_X = 161;
    const CEN_Y = 99;
    for (const g of this._creditGroups) {
      const localT = T - g._startTick;
      if (localT < 0 || localT >= g._totalTicks) continue;
      let fi;
      if (localT < g._enterTicks) fi = Math.min(Math.floor(localT / S), g.count - 1);
      else if (localT < g._enterTicks + g._holdTicks) fi = g.count - 1;
      else if (g.exitMode === 'zoom') fi = g.count + Math.min(Math.floor((localT - g._enterTicks - g._holdTicks) / S), (g.exitCount || g.count) - 1);
      else fi = g.count - 1 - Math.min(Math.floor((localT - g._enterTicks - g._holdTicks) / S), g.count - 1);

      const spriteName = `${g.prefix}${fi + 1}`;
      const img = this.engine.assets.get(spriteName);
      if (img) {
        const x = CEN_X - Math.floor(img.width / 2);
        const y = g.prefix === 'HEBR' ? 28 : CEN_Y - Math.floor(img.height / 2);
        draw(spriteName, x, y);
      }
      break;
    }
  }
}
