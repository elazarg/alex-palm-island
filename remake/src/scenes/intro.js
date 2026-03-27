// Introduction sequence: OPENING → OPEN2 → SPYMASTR → OPEN3 → OPEN4
// Film-strip scenes use 248px content area at x=36, y=12.
// Click to advance between scenes. Fades between phases.

function range(pfx, a, b) {
  const r = []; for (let i = a; i <= b; i++) r.push(`${pfx}${i}`); return r;
}
const CX = 36, CY = 12; // content area offset
const FADE_TICKS = 18;

// Position data from SCX sections
const WALK_POS = [
  [37,20],[132,35],[142,28],[136,35],[132,29],[128,24],[118,20],[119,32],
  [122,24],[123,20],[136,20],[127,20],[122,20],[117,20],[102,20],[103,20],
  [106,20],[108,20],[125,20],[115,20],[103,20],[93,20],[69,20],[68,20],
  [70,20],[70,20],[97,20],[77,20],[46,20],[37,20],[37,20],[37,20],
  [37,20],[37,20],[37,20],[42,20],[46,20],[44,20],[37,20],[37,20],
  [53,20],[98,20],[97,20],[101,20],[99,20],[95,20],[77,20],[76,20],
  [93,20],[121,20],[119,20],[119,20],[120,20],[116,20],[101,20],[100,20],
  [113,20],[131,20],[130,20],[129,23],[129,24],[126,24],[115,26],[114,32],
  [123,31],[137,32],[136,32],[135,39],[136,39],[132,39],[123,39],[121,43],
  [142,51],
];
const STREET_POS = [
  [260,0],[209,10],[141,34],[75,57],[37,78],[37,100],[37,150],[37,168],
];

// Phone overlay position — from OVR: push 0x5d (93), push 0x42 (66)
const PHONE_X = 93, PHONE_Y = 66;
// BPhone/BStreet at (37, 20) and (37, 10) from OVR
const BPHONE_X = 37, BPHONE_Y = 20;
const BSTREET_X = 37, BSTREET_Y = 10;

const SCENE_ORDER = ['opening', 'open2', 'spymastr', 'open3', 'open4'];

const ASSETS = {
  opening: {
    base: 'assets/opening', bg: 'SNOPENING1',
    sprites: ['BPHONE', ...range('PHONE',1,25), 'BSTREET', ...range('STREET',1,8),
              ...range('LFILM',1,3), ...range('RFILM',1,3)],
    sounds: ['SDPHONE1','SDPHONE2','SDPHONE3','SDPHONE4','SDCAR1','SDSTREET1'],
  },
  open2: {
    base: 'assets/open2', bg: 'SNOPEN21',
    sprites: ['BHALL','BHALL2','BHALL3', ...range('WALK',1,73), ...range('DOOR',1,13),
              ...range('LFILM',1,3), ...range('RFILM',1,3)],
    sounds: ['SDDOOR1','SDDOOR2','SDWALK1'],
  },
  spymastr: {
    base: 'assets/spymastr', bg: 'SNSPYMASTER1',
    sprites: [...range('SPYTLK',1,7), 'BAG', ...range('BAG',1,16),
              'LAMP', 'PHONE',
              'SPYPLAY1','SPYPLAY2','SPYREWIND1','SPYREWIND2'],
    sounds: range('SPY',1,11),
  },
  open3: {
    base: 'assets/open3', bg: 'SNOPEN31',
    sprites: ['BPLANE', ...range('PLANE',1,23), ...range('LFILM',1,3), ...range('RFILM',1,3)],
    sounds: ['SDPLANE1'],
  },
  open4: {
    base: 'assets/open4', bg: 'SNOPEN41',
    sprites: [...range('PLANE',1,25), ...range('PROG',1,8), ...range('GRAPH',1,20),
              ...range('ONDA',1,15), ...range('PROD',1,10)],
    sounds: ['SDPLANE1'],
  },
};

const DIALOG = [
  { text: '"Good morning, Alex."', sound: 'SPY1' },
  { text: '"We have a spy named Walter."', sound: 'SPY2' },
  { text: '"He went to Palm Island but now we don\'t know where he is."', sound: 'SPY3' },
  { text: '"Go to Palm Island.  Find Walter before it\'s too late."', sound: 'SPY4' },
  { text: '"Go everywhere. Look at everything. Talk to everyone."', sound: 'SPY5' },
  { text: '"Take things from the places you visit."', sound: 'SPY6' },
  { text: '"Here is your bag. Don\'t lose it!"', sound: 'SPY7' },
  { text: '"There is also a letter to Walter inside the bag."', sound: 'SPY8' },
  { text: '"When you find him, give it to him."', sound: 'SPY9' },
  { text: '"Palm Island is a very strange place."', sound: 'SPY10' },
  { text: '"Remember! I am watching!"', sound: 'SPY11' },
];

export class IntroScene {
  constructor() {
    this.engine = null;
    this.onDone = null;
    this.sceneIdx = 0;
    this.sceneName = '';

    // Phase-based animation
    this.phase = 0;
    this.phaseTick = 0;

    // Fade: 'in' | 'out' | 'none' | 'wait-click'
    this.fade = 'none';
    this.fadeAlpha = 1;

    // Current sound source (for stopping)
    this.currentSound = null;

    // Rendering
    this.drawFn = null;

    // Dialog (spymastr)
    this.dialogIdx = -1;
    this.dialogText = '';
    this.isTalking = false;
    this.talkFrame = 1;
    this.talkTick = 0;
    this.awaitingClick = false;
  }

  async load(engine) {
    for (const [, sc] of Object.entries(ASSETS)) {
      const imgs = { [sc.bg]: `${sc.base}/${sc.bg}.png` };
      for (const s of sc.sprites) imgs[s] = `${sc.base}/${s}.png`;
      await engine.loadImages(imgs);
      if (sc.sounds.length) {
        const snds = {};
        for (const s of sc.sounds) snds[s] = `${sc.base}/${s}.wav`;
        await engine.loadSounds(snds);
      }
    }
  }

  init() {
    // Check URL for sub-scene
    const hash = location.hash.replace('#', '');
    const sub = hash.startsWith('intro-') ? hash.slice(6) : null;
    const startName = (sub && SCENE_ORDER.includes(sub)) ? sub : SCENE_ORDER[0];
    this.sceneIdx = SCENE_ORDER.indexOf(startName);
    this._startScene(startName);
    const canvas = this.engine.ctx.canvas;
    this._onClick = () => {
      // Resume audio context on first interaction (browser autoplay policy)
      if (this.engine.audioCtx && this.engine.audioCtx.state === 'suspended') {
        this.engine.audioCtx.resume();
      }
      if (this.fade === 'wait-click') {
        this._fadeOut(() => this._nextScene());
      } else if (this.awaitingClick && this.sceneName === 'spymastr') {
        this.awaitingClick = false;
        this._advanceDialog();
      }
    };
    canvas.addEventListener('click', this._onClick);

    // Pause audio when tab hidden
    this._onVis = () => {
      if (document.hidden && this.engine.audioCtx) {
        this.engine.audioCtx.suspend();
      } else if (this.engine.audioCtx) {
        this.engine.audioCtx.resume();
      }
    };
    document.addEventListener('visibilitychange', this._onVis);
  }

  jumpTo(name) {
    const idx = SCENE_ORDER.indexOf(name);
    if (idx >= 0) { this.sceneIdx = idx; this._startScene(name); }
  }

  _startScene(name) {
    this.sceneName = name;
    this.phase = 0;
    this.phaseTick = 0;
    this.dialogIdx = -1;
    this.dialogText = '';
    this.isTalking = false;
    this.awaitingClick = false;
    this._stopSound();
    location.hash = 'intro-' + name;

    if (name === 'spymastr') {
      this._fadeIn();
      // If audio context is suspended (direct load, no prior interaction),
      // wait for a click before starting dialog
      if (this.engine.audioCtx && this.engine.audioCtx.state === 'suspended') {
        this.dialogText = 'click to start';
        this.awaitingClick = true;
      } else {
        this._advanceDialog();
      }
    } else {
      this._fadeIn();
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
    this.fade = 'in'; this.fadeAlpha = 0; this._fadeCb = cb || null;
  }
  _fadeOut(cb) {
    this.fade = 'out'; this.fadeAlpha = 1; this._fadeCb = cb || null;
  }
  _waitClick() {
    this.fade = 'wait-click';
  }

  _playSound(name) {
    this._stopSound();
    this.currentSound = this.engine.playSound(name);
    return this.currentSound;
  }
  _stopSound() {
    if (this.currentSound) {
      try { this.currentSound.stop(); } catch(e) {}
      this.currentSound = null;
    }
  }

  // --- Dialog (SPYMASTR) ---
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

  // --- Tick ---
  tick() {
    // Handle fades
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

    this.phaseTick++;
    switch (this.sceneName) {
      case 'opening': this._tickOpening(); break;
      case 'open2':   this._tickOpen2(); break;
      case 'spymastr': this._tickSpyMaster(); break;
      case 'open3':   this._tickOpen3(); break;
      case 'open4':   this._tickOpen4(); break;
    }
  }

  _tickOpening() {
    const T = this.phaseTick;
    if (this.phase === 0) {
      // Phone ringing
      if (T === 1) this._playSound('SDPHONE1');
      if (T === 78) { this.phase = 1; this.phaseTick = 0; }
    } else if (this.phase === 1) {
      // Alex wakes up
      if (T === 1) this._playSound('SDPHONE2');
      if (T === 36) { this.phase = 2; this.phaseTick = 0; }
    } else if (this.phase === 2) {
      // Alex answers and talks
      if (T === 1) this._playSound('SDPHONE3');
      if (T === 64) { this.phase = 3; this.phaseTick = 0; }
    } else if (this.phase === 3) {
      // Hang up
      if (T === 1) this._playSound('SDPHONE4');
      if (T === 36) {
        this._fadeOut(() => { this.phase = 4; this.phaseTick = 0; this._fadeIn(); });
      }
    } else if (this.phase === 4) {
      // Street: car approaches
      if (T === 1) { this._playSound('SDSTREET1'); }
      if (T === 10) this._playSound('SDCAR1');
      if (T === 8 * 10 + 18) {
        this._fadeOut(() => this._waitClick());
      }
    }
  }

  _tickOpen2() {
    const T = this.phaseTick;
    if (this.phase === 0) {
      // Walk toward camera
      if (T === 1) this._playSound('SDWALK1');
      if (T === 32 * 4) {
        this._fadeOut(() => { this.phase = 1; this.phaseTick = 0; this._fadeIn(); });
      }
    } else if (this.phase === 1) {
      // Walk away from camera
      if (T === 1) this._playSound('SDWALK1');
      if (T === 41 * 4) {
        this._fadeOut(() => { this.phase = 2; this.phaseTick = 0; this._fadeIn(); });
      }
    } else if (this.phase === 2) {
      // Door opens
      if (T === 1) this._playSound('SDDOOR1');
      if (T === 30) this._playSound('SDDOOR2');
      if (T === 13 * 4 + 18) {
        this._fadeOut(() => this._waitClick());
      }
    }
  }

  _tickSpyMaster() {
    if (this.isTalking) {
      this.talkTick++;
      if (this.talkTick >= 4) {
        this.talkTick = 0;
        this.talkFrame = (this.talkFrame % 7) + 1;
      }
    }
  }

  _tickOpen3() {
    const T = this.phaseTick;
    if (T === 1) this._playSound('SDPLANE1');
    if (T === 23 * 8 + 36) {
      this._fadeOut(() => this._waitClick());
    }
  }

  _tickOpen4() {
    const T = this.phaseTick;
    if (T === 1) this._playSound('SDPLANE1');
    if (T === 450) {
      this._fadeOut(() => this._waitClick());
    }
  }

  // --- Render ---
  render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 320, 200);

    switch (this.sceneName) {
      case 'opening': this._renderOpening(ctx); break;
      case 'open2':   this._renderOpen2(ctx); break;
      case 'spymastr': this._renderSpyMaster(ctx); break;
      case 'open3':   this._renderOpen3(ctx); break;
      case 'open4':   this._renderOpen4(ctx); break;
    }

    // Fade: overlay black rect over the entire scene
    if (this.fadeAlpha < 1) {
      ctx.globalAlpha = 1 - this.fadeAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 320, 200);
      ctx.globalAlpha = 1;
    }

    if (this.fade === 'wait-click') {
      ctx.fillStyle = '#888';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('click to continue', 160, 196);
    }
  }

  _renderOpening(ctx) {
    const T = this.phaseTick;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);

    if (this.phase <= 3) {
      // Phone scene — BPhone at (37,20), Phone overlay at (93,66)
      draw('BPHONE', BPHONE_X, BPHONE_Y);
      let frame;
      if (this.phase === 0) {
        frame = (Math.floor(T / 6) % 2 === 0) ? 1 : 2;
      } else if (this.phase === 1) {
        frame = (Math.floor(T / 6) % 2 === 0) ? 7 : 8;
      } else if (this.phase === 2) {
        frame = (Math.floor(T / 8) % 2 === 0) ? 15 : 16;
      } else {
        frame = 25;
      }
      draw(`PHONE${frame}`, PHONE_X, PHONE_Y);
    } else if (this.phase === 4) {
      // Street scene — BStreet at (37,10), car at positions from SCX 5030
      draw('BSTREET', BSTREET_X, BSTREET_Y);
      const fi = Math.min(Math.floor(T / 10), 7);
      const p = STREET_POS[fi];
      draw(`STREET${fi + 1}`, p[0], p[1]);
    }
  }

  _renderOpen2(ctx) {
    const T = this.phaseTick;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);

    if (this.phase === 0) {
      draw('BHALL', CX, CY);
      const fi = Math.min(Math.floor(T / 4), 31);
      const p = WALK_POS[fi];
      draw(`WALK${fi + 1}`, p[0], p[1]);
    } else if (this.phase === 1) {
      draw('BHALL2', CX, CY);
      const fi = Math.min(Math.floor(T / 4), 40);
      const idx = 32 + fi;
      const p = WALK_POS[idx] || WALK_POS[72];
      draw(`WALK${idx + 1}`, p[0], p[1]);
    } else if (this.phase === 2) {
      draw('BHALL3', CX, CY);
      const fi = Math.min(Math.floor(T / 4), 12);
      draw(`DOOR${fi + 1}`, CX, CY);
    }
  }

  _renderSpyMaster(ctx) {
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    draw('SNSPYMASTER1', 0, 0);
    draw(`SPYTLK${this.talkFrame}`, 95, 37);
    draw('LAMP', 32, 68);

    // Solid black bar at bottom for text
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 160, 320, 40);

    // Arrows at bottom corners
    draw('SPYREWIND1', 4, 184);
    draw('SPYPLAY1', 288, 184);

    if (this.dialogText) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const words = this.dialogText.split(' ');
      const lines = []; let line = '';
      for (const w of words) {
        const t = line + (line ? ' ' : '') + w;
        if (ctx.measureText(t).width > 260 && line) { lines.push(line); line = w; }
        else line = t;
      }
      lines.push(line);
      const totalH = lines.length * 15;
      const y0 = 180 - totalH / 2 + 8;
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 160, y0 + i * 15);
      ctx.textBaseline = 'alphabetic';
    }
  }

  _renderOpen3(ctx) {
    const T = this.phaseTick;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    draw('BPLANE', CX, CY);
    const fi = Math.min(Math.floor(T / 8), 22);
    draw(`PLANE${fi + 1}`, 140, 80);
  }

  _renderOpen4(ctx) {
    const T = this.phaseTick;
    const draw = this.engine.drawSprite.bind(this.engine, ctx);
    const pf = Math.floor(T / 8) % 25;
    draw(`PLANE${pf + 1}`, CX, CY);

    if (T < 100) {
      const fi = Math.min(Math.floor(T / 12), 7);
      draw(`PROG${fi + 1}`, 44, 34);
    } else if (T < 200) {
      const fi = Math.min(Math.floor((T-100) / 5), 19);
      draw(`GRAPH${fi + 1}`, 68, 34);
    } else if (T < 320) {
      const fi = Math.min(Math.floor((T-200) / 8), 14);
      draw(`ONDA${fi + 1}`, 0, 0);
    } else if (T < 420) {
      const fi = Math.min(Math.floor((T-320) / 10), 9);
      draw(`PROD${fi + 1}`, 46, 30);
    }
  }

  destroy() {
    this._stopSound();
    const canvas = this.engine.ctx.canvas;
    canvas.removeEventListener('click', this._onClick);
    document.removeEventListener('visibilitychange', this._onVis);
  }
}
