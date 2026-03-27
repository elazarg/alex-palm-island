// Introduction sequence: OPENING → OPEN2 → SPYMASTR → OPEN3 → OPEN4
// Film-strip scenes use 248px content area at x=36, y=12.
// Click to advance between scenes. Fades between phases.

import { BitmapFont } from '../font.js';

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

// Dialog text from SPYMASTR.SCX sections 501-511, sounds SPY1-SPY11
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
    this.needsAudioUnlock = false;

    // Bag animation (spymastr section 507)
    this.bagAnimPlaying = false;
    this.bagAnimFrame = 1;
    this.bagAnimTick = 0;
    this.bagVisible = false; // static bag stays after animation
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

    // Load bitmap font
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
    // Check URL for sub-scene
    const hash = location.hash.replace('#', '');
    const sub = hash.startsWith('intro-') ? hash.slice(6) : null;
    const startName = (sub && SCENE_ORDER.includes(sub)) ? sub : SCENE_ORDER[0];
    this.sceneIdx = SCENE_ORDER.indexOf(startName);
    this._startScene(startName);
    const canvas = this.engine.ctx.canvas;
    this.pressedBtn = null; // 'play' | 'rewind' | null

    this._getButton = (e) => {
      if (!this.awaitingClick || this.sceneName !== 'spymastr') return null;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / (rect.width / 320);
      const my = (e.clientY - rect.top) / (rect.height / 200);
      if (mx >= 272 && mx <= 300 && my >= 170 && my <= 194) return 'play';
      if (mx >= 20 && mx <= 48 && my >= 170 && my <= 194) return 'rewind';
      return null;
    };

    this._onMouseDown = (e) => {
      if (this.engine.audioCtx && this.engine.audioCtx.state === 'suspended') {
        this.engine.audioCtx.resume();
      }
      if (this.needsAudioUnlock) {
        this.needsAudioUnlock = false;
        if (this.sceneName === 'spymastr') {
          this._advanceDialog();
        }
        return;
      }
      if (this.fade === 'wait-click') {
        this._fadeOut(() => this._nextScene());
        return;
      }
      this.pressedBtn = this._getButton(e);
    };

    this._onMouseUp = (e) => {
      if (this.pressedBtn && this.pressedBtn === this._getButton(e)) {
        if (this.pressedBtn === 'play') {
          this.awaitingClick = false;
          this._advanceDialog();
        } else if (this.pressedBtn === 'rewind') {
          this.awaitingClick = false;
          this._replayDialog();
        }
      }
      this.pressedBtn = null;
    };

    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mouseup', this._onMouseUp);

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

    // Cursor only visible during spymaster (click-to-advance)
    this.engine.cursor = (name === 'spymastr') ? 'MMARROWCURSOR' : null;

    // Initialize scene-specific state before fade
    if (name === 'opening') this._initPhoneSteps();

    // Check if audio needs unlocking (browser autoplay policy)
    if (this.engine.audioCtx && this.engine.audioCtx.state === 'suspended') {
      this.needsAudioUnlock = true;
    }

    // Always fade in (shows static first frame during unlock wait)
    this._fadeIn();

    // Start dialog immediately if audio is available
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

    // Section 507 (dialog index 6): bag animation
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
    // Replay the current line's audio (buttons hidden during playback)
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

  // --- Tick ---
  tick() {
    // Handle fades (even while waiting for audio unlock)
    // This allows fade-in to render before user clicks
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

    // Don't advance scene animation until fade-in completes or audio unlocked
    if (this.fade === 'in') return;
    if (this.needsAudioUnlock) return;

    this.phaseTick++;
    switch (this.sceneName) {
      case 'opening': this._tickOpening(); break;
      case 'open2':   this._tickOpen2(); break;
      case 'spymastr': this._tickSpyMaster(); break;
      case 'open3':   this._tickOpen3(); break;
      case 'open4':   this._tickOpen4(); break;
    }
  }

  // Phone animation: exact sequence from OPENING.SCX section 5010.
  _initPhoneSteps() {
    const S = (snd) => ({ sound: snd });
    const F = (f, t) => ({ frame: f, ticks: t * 4 });
    this._phoneSteps = [
      // Start on frame 1 (dark room, visible during fade-in)
      F(1,4),
      // S1, Ring 1: F1/2 ×3, hold F1 for 7
      S('SDPHONE1'),
      F(1,1), F(2,1), F(1,1), F(2,1), F(1,1), F(2,1), F(1,7),
      // S1, Ring 2: F2/1 ×3
      S('SDPHONE1'),
      F(2,1), F(1,1), F(2,1), F(1,1), F(2,1),
      // Hand reaches for lamp, light turns on (frames 3→4→5→6→7→8)
      F(3,2), F(4,2), F(5,2), F(6,2), F(7,2), F(8,2),
      // S1, Ring 3 + wake: F8/7 ×2
      S('SDPHONE1'),
      F(8,1), F(7,1), F(8,1), F(7,1),
      // Reach for phone (frame 9), pick up (10→11)
      F(9,2), F(10,1), F(11,1), F(10,1), F(11,1),
      // S2, bring phone to bed (12→13→14→15→16)
      S('SDPHONE2'),
      F(12,1), F(13,1), F(14,1), F(15,1), F(16,1),
      // S3, talking: F16/15 ×4
      S('SDPHONE3'),
      F(16,2), F(15,2), F(16,2), F(15,2), F(16,2), F(15,2), F(16,2),
      // Put phone back (17→18→19→20)
      F(17,1), F(18,1), F(19,1), F(20,1),
      // S4, hang up + light off (21→22→23→24→25)
      S('SDPHONE4'),
      F(21,1), F(22,1), F(23,1), F(24,1),
      F(25,4),
      { fadeToStreet: true },
    ];
    this._phoneIdx = 0;
    this._phoneTick = 0;
    this._phoneFrame = 1;
  }

  _tickOpening() {
    if (!this._phoneSteps) this._initPhoneSteps();

    if (this.phase === 0) {
      // Advance through steps — process sounds instantly, only pause on frames
      while (this._phoneIdx < this._phoneSteps.length) {
        const step = this._phoneSteps[this._phoneIdx];

        if (step.fadeToStreet) {
          if (this.fade !== 'none') return; // fade already in progress
          // Fade out phone, then fade in street (drive to spy master)
          this._fadeOut(() => {
            this.phase = 1; // street/driving scene
            this.phaseTick = 0;
            this._fadeIn();
          });
          return;
        }

        if (step.sound) {
          // Play sound and advance immediately (no tick consumed)
          this._playSound(step.sound);
          this._phoneIdx++;
          continue;
        }

        // Frame step — update displayed frame
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
      // Street: car approaches
      const T = this.phaseTick;
      if (T === 1) this._playSound('SDSTREET1');
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
    if (this.bagAnimPlaying) {
      this.bagAnimTick++;
      if (this.bagAnimTick >= 5) {
        this.bagAnimTick = 0;
        this.bagAnimFrame++;
        if (this.bagAnimFrame > 16) {
          this.bagAnimPlaying = false;
          this.bagVisible = true; // static bag stays
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

    if (this.phase === 0 && this._phoneSteps) {
      // Phone scene — BPhone at (37,20), Phone overlay at (93,66)
      draw('BPHONE', BPHONE_X, BPHONE_Y);
      draw(`PHONE${this._phoneFrame}`, PHONE_X, PHONE_Y);
    } else if (this.phase === 1) {
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

    if (this.bagAnimPlaying) {
      // BAG animation replaces spy master (BAG1-16 include his body)
      draw(`BAG${this.bagAnimFrame}`, 79, 37);
    } else {
      draw(`SPYTLK${this.talkFrame}`, 95, 37);
    }

    // Static bag appears after animation, behind lamp
    if (this.bagVisible) {
      draw('BAG', 79, 88);
    }

    draw('LAMP', 32, 68);

    // Black bar at bottom for text + arrows
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 172, 320, 28);

    // Arrows only visible when awaiting click
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
    canvas.removeEventListener('mousedown', this._onMouseDown);
    canvas.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('visibilitychange', this._onVis);
  }
}
