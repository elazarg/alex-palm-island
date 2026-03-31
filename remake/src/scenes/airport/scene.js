import { BitmapFont } from '../../ui/bitmap-font.js';
import { renderTalkDialog, renderTalkResponse } from '../../ui/dialog-renderer.js';
import { renderNotePopup } from '../../ui/note-renderer.js';
import { renderPanel } from '../../ui/panel-renderer.js';
import { AIRPORT_SCRIPT } from './script.js';
import {
  ANIM_TICK_SCALE,
  DIALOG_LAYOUT,
  DIALOG_RESPONSE_DELAY_TICKS,
  NOTE_LAYOUT,
  PANEL_LAYOUT,
  SOUND_MANIFEST,
  UI_BUTTONS,
  WALK_ZONES,
  WHEEL_INPUT_MODES,
  CURSOR_HOTSPOTS,
  buildAssetManifest,
  createAirportObjects,
} from './content.js';

const FADE_TICKS = 18;

export class AirportScene {
  constructor(options = {}) {
    this.options = options;
    this.engine = null;
    this.sceneScript = AIRPORT_SCRIPT;
    this.dialogLayout = DIALOG_LAYOUT;
    this.noteLayout = NOTE_LAYOUT;
    this.panelLayout = PANEL_LAYOUT;
    this.uiButtons = UI_BUTTONS;
    this.walkZones = WALK_ZONES;
    this.walkDeltas = {
      1: [{dx:0,dy:0},{dx:-4,dy:2},{dx:-4,dy:3},{dx:0,dy:0},{dx:0,dy:0},{dx:-4,dy:2},{dx:-4,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
      2: [{dx:0,dy:0},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
      3: [{dx:0,dy:0},{dx:4,dy:2},{dx:4,dy:3},{dx:0,dy:0},{dx:0,dy:0},{dx:4,dy:2},{dx:4,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
      4: [{dx:0,dy:0},{dx:0,dy:0},{dx:0,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:0,dy:0},{dx:0,dy:0}],
      6: [{dx:0,dy:0},{dx:0,dy:0},{dx:0,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:0,dy:0},{dx:0,dy:0}],
      7: [{dx:0,dy:0},{dx:-4,dy:-2},{dx:-4,dy:-3},{dx:0,dy:0},{dx:0,dy:0},{dx:-4,dy:-2},{dx:-4,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
      8: [{dx:0,dy:0},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
      9: [{dx:0,dy:0},{dx:4,dy:-2},{dx:4,dy:-3},{dx:0,dy:0},{dx:0,dy:0},{dx:4,dy:-2},{dx:4,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
    };
    this.walkFrameCycles = {
      1: [1, 2, 5, 6], 2: [1, 2, 3, 4, 5, 6], 3: [1, 2, 5, 6], 4: [3, 4, 5, 6],
      6: [3, 4, 5, 6], 7: [1, 2, 5, 6], 8: [1, 2, 3, 4, 5, 6], 9: [1, 2, 5, 6],
    };
  }

  attach(engine) {
    this.engine = engine;
  }

  async load(engine) {
    const { images, frameCounts } = buildAssetManifest();
    this._frameCounts = frameCounts;
    await engine.loadImages(images);
    await engine.loadSounds(SOUND_MANIFEST);
    for (const [name, hotspot] of Object.entries(CURSOR_HOTSPOTS)) {
      engine.registerCursorHotspot(name, hotspot);
    }

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
    const { behind, front } = createAirportObjects();
    this.objectsBehind = behind;
    this.objectsFront = front;
    this.sceneObjects = [...behind, ...front];
    this.objectByName = Object.fromEntries(this.sceneObjects.map((obj) => [obj.name, obj]));

    this.bgWidth = this.engine.getAsset('SCENE_BG')?.width || 320;
    this.scrollX = 0;
    this.alexX = 836;
    this.alexY = 140;
    this.alexDir = 1;
    this.alexFrame = 1;
    this.alexWalking = false;
    this.alexTargetX = 0;
    this.alexTargetY = 0;
    this.alexStepTick = 0;
    this.alexWalkCycleIdx = 0;
    this.alexIdleTick = 0;
    this.stairsTick = 0;
    this.stairsFrame = 1;
    this.fade = 'in';
    this.fadeAlpha = 0;
    this._fadeCb = null;
    this.state = { ...(this.sceneScript.initialState || {}) };
    this.actionQueue = [];
    this.modal = null;
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    this._interactionEnabled = {};
    this.inputMode = 'walk';
    this.uiTick = 0;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
    this.currentSound = null;
    this._gestureLockedDialog = null;
    this._pendingDialogChoiceEvent = null;
    this._pendingDialogDelayTicks = 0;

    for (const interaction of this.sceneScript.interactions || []) {
      this._interactionEnabled[interaction.id] = interaction.enabled !== false;
    }
    this._applyBindings();
    this.scrollX = Math.max(0, this.alexX - 160);
    this._setInputMode('walk');

    if (this.options.previewDialogId) {
      this._openDialog(this.options.previewDialogId, { deferPromptSound: true });
    }
  }

  onMouseDown({ x, y }) {
    if (this._gestureLockedDialog) {
      const dialog = this._gestureLockedDialog;
      this._gestureLockedDialog = null;
      this._startDialogPrompt(dialog);
      return;
    }
    if (this.modal) {
      this._handleModalClick(x, y);
      return;
    }
    const button = this._getUiButton(x, y);
    if (button) {
      this._pressedButtonMode = button.mode;
      this._pendingButtonMode = button.mode;
      return;
    }
    if (this.actionQueue.length) return;
    const worldX = x + this.scrollX;
    const worldY = y;
    const interaction = this._findInteraction(worldX, worldY, this.inputMode);
    if (interaction) {
      this._queueEvent(interaction.eventId);
      return;
    }
    if (this.inputMode !== 'walk') {
      this._queueFallbackEvent(this.inputMode);
      return;
    }
    if (!this._inWalkZone(worldX, worldY)) return;
    this._startWalk(worldX, worldY);
  }

  onMouseUp({ x, y }) {
    const pressedMode = this._pressedButtonMode;
    const pendingMode = this._pendingButtonMode;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
    if (!pendingMode || pressedMode !== pendingMode) return;
    const button = this._getUiButton(x, y);
    if (!button || button.mode !== pendingMode) return;
    if (button.mode === 'exit') return;
    if (button.mode === 'bag' && !this.state?.bagReceived) {
      this._queueEvent('bagMissing');
      return;
    }
    this._setInputMode(button.mode);
  }

  onMouseLeave() {
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
  }

  onWheel({ deltaY, originalEvent }) {
    if (this.modal) return;
    const currentIdx = WHEEL_INPUT_MODES.indexOf(this.inputMode);
    const nextIdx = ((currentIdx >= 0 ? currentIdx : 0) + (deltaY > 0 ? 1 : -1) + WHEEL_INPUT_MODES.length) % WHEEL_INPUT_MODES.length;
    this._setInputMode(WHEEL_INPUT_MODES[nextIdx]);
    originalEvent.preventDefault();
  }

  onKeyDown({ key, originalEvent }) {
    if (!this.modal) return;
    if (this.modal.type === 'dialog' && (key === 'ArrowDown' || key === 'ArrowUp')) {
      if (this.modal.phase !== 'choice') return;
      const dir = key === 'ArrowDown' ? 1 : -1;
      const count = this.modal.choices.length;
      const current = this.modal.selectedChoice == null ? -1 : this.modal.selectedChoice;
      this.modal.selectedChoice = (current + dir + count) % count;
      originalEvent.preventDefault();
      return;
    }
    if (key !== 'Enter') return;
    if (this.modal.type === 'dialog' && this.modal.phase === 'choice' && this.modal.selectedChoice != null) {
      this._confirmDialogChoice(this.modal.selectedChoice);
    } else if (this.modal.type === 'message') {
      this._stopSound();
      this.modal = null;
      this._refreshCursor();
      this._processActionQueue();
    }
  }

  tick() {
    this.uiTick++;
    if (this.modal?.type === 'dialog' && this.modal.phase === 'alexReply' && this.modal.alexTalking) {
      this.modal.replyTick = Math.min(this.modal.replyDurationTicks || 0, (this.modal.replyTick || 0) + 1);
    }
    if (this._pendingDialogDelayTicks > 0) {
      this._pendingDialogDelayTicks--;
      if (this._pendingDialogDelayTicks === 0 && this._pendingDialogChoiceEvent) {
        if (this.modal?.type === 'dialog') this.modal = null;
        const pending = this._pendingDialogChoiceEvent;
        this._pendingDialogChoiceEvent = null;
        this._choiceBoxes = [];
        this._dialogExitBox = null;
        this._refreshCursor();
        this._enqueueSteps(pending);
        this._processActionQueue();
      }
    }

    if (this.fade === 'in') {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + 1 / FADE_TICKS);
      if (this.fadeAlpha >= 1) this.fade = 'none';
    }

    this._tickWalk();
    this._tickObjects();
    this._scrollToAlex();
    this._processActionQueue();
  }

  render(ctx) {
    const bg = this.engine.getAsset('SCENE_BG');
    if (bg) ctx.drawImage(bg, -this.scrollX, 0);

    for (const obj of this.objectsBehind) this._renderObject(ctx, obj);
    this._renderAlex(ctx);
    for (const obj of this.objectsFront) this._renderObject(ctx, obj);

    this._renderModal(ctx);
    renderPanel(ctx, {
      assets: this.engine.assets,
      mouseY: this.engine.mouseY,
      modalOpen: Boolean(this.modal),
      buttons: this.uiButtons,
      pressedMode: this._pressedButtonMode,
      amount: this.state?.palmettoes ?? 100,
      bagReceived: Boolean(this.state?.bagReceived),
      inputMode: this.inputMode,
      layout: this.panelLayout,
    });

    if (this.fadeAlpha < 1) {
      ctx.globalAlpha = 1 - this.fadeAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 320, 200);
      ctx.globalAlpha = 1;
    }
  }

  destroy() {
    this._stopSound();
  }

  _renderModal(ctx) {
    if (!this.modal || !this.font) return;
    if (this.modal.type === 'dialog') {
      const result = renderTalkDialog(ctx, { engine: this.engine, font: this.font, modal: this.modal, uiTick: this.uiTick, layout: this.dialogLayout });
      this._choiceBoxes = result.choiceBoxes;
      this._dialogExitBox = result.dialogExitBox;
      return;
    }
    if (this.modal.presentation === 'talk') {
      const result = renderTalkResponse(ctx, { engine: this.engine, font: this.font, modal: this.modal, uiTick: this.uiTick, layout: this.dialogLayout });
      this._choiceBoxes = result.choiceBoxes;
      this._dialogExitBox = result.dialogExitBox;
      return;
    }
    renderNotePopup(ctx, { assets: this.engine.assets, font: this.font, modal: this.modal, layout: this.noteLayout });
    this._choiceBoxes = [];
    this._dialogExitBox = null;
  }

  _renderObject(ctx, obj) {
    if (!obj.visible) return;
    const o2Active = obj.overlay2 && obj.overlay2.sequence && obj._o2Idx != null && obj.overlay2.sequence[obj._o2Idx] > 0;
    if (o2Active) {
      const frameNum = obj.overlay2.sequence[obj._o2Idx];
      const overlayImg = this.engine.getAsset(`${obj.overlay2.prefix}${frameNum}`);
      if (overlayImg) ctx.drawImage(overlayImg, obj.x + obj.overlay2.ox - this.scrollX, obj.y + obj.overlay2.oy);
      return;
    }
    const img = this.engine.getAsset(obj.sprite);
    if (img) {
      const drawY = (obj.anim && obj.anim.bottomAlign) ? obj.anim.bottomAlign - img.height : obj.y;
      ctx.drawImage(img, obj.x - this.scrollX, drawY);
    }
    if (obj.overlay && obj.overlay.sequence && obj._oIdx != null) {
      const frameNum = obj.overlay.sequence[obj._oIdx];
      if (frameNum > 0) {
        const overlayImg = this.engine.getAsset(`${obj.overlay.prefix}${frameNum}`);
        if (overlayImg) ctx.drawImage(overlayImg, obj.x + obj.overlay.ox - this.scrollX, obj.y + obj.overlay.oy);
      }
    }
  }

  _renderAlex(ctx) {
    const spriteDir = this.alexWalking ? this.alexDir : 1;
    const spriteName = `ALEX${spriteDir}-${this.alexFrame}`;
    const img = this.engine.getAsset(spriteName);
    if (!img) return;
    const screenX = this.alexX - this.scrollX - img.width / 2;
    const screenY = this.alexY - img.height;
    ctx.drawImage(img, Math.round(screenX), Math.round(screenY));
  }

  _tickWalk() {
    if (!this.alexWalking) {
      this.alexIdleTick = (this.alexIdleTick + 1) % 72;
      this.alexFrame = (this.alexIdleTick === 24 || this.alexIdleTick === 25) ? 0 : 1;
      return;
    }
    this.alexStepTick++;
    if (this.alexStepTick < ANIM_TICK_SCALE) return;
    this.alexStepTick = 0;
    this.alexDir = this._calcDirection(this.alexX, this.alexY, this.alexTargetX, this.alexTargetY);
    const cycle = this.walkFrameCycles[this.alexDir] || [1];
    this.alexWalkCycleIdx %= cycle.length;
    this.alexFrame = cycle[this.alexWalkCycleIdx];
    this.alexWalkCycleIdx = (this.alexWalkCycleIdx + 1) % cycle.length;
    const delta = this.walkDeltas[this.alexDir]?.[this.alexFrame] || { dx: 0, dy: 0 };
    const dist = Math.hypot(this.alexTargetX - this.alexX, this.alexTargetY - this.alexY);
    if (dist <= Math.max(Math.abs(delta.dx), Math.abs(delta.dy), 1)) {
      this.alexX = this.alexTargetX;
      this.alexY = this.alexTargetY;
      this.alexWalking = false;
      this.alexFrame = 1;
      this.alexIdleTick = 0;
      return;
    }
    const newX = this.alexX + delta.dx;
    const newY = this.alexY + delta.dy;
    if (this._inWalkZone(newX, newY)) {
      this.alexX = newX;
      this.alexY = newY;
    } else {
      this.alexWalking = false;
      this.alexFrame = 1;
      this.alexIdleTick = 0;
    }
  }

  _tickObjects() {
    this.stairsTick++;
    if (this.stairsTick >= 3) {
      this.stairsTick = 0;
      this.stairsFrame = (this.stairsFrame % 6) + 1;
    }
    for (const obj of this.sceneObjects) {
      if (obj.anim === 'stairs') {
        obj.sprite = `STAIRS${this.stairsFrame}`;
      } else if (obj.overlay?.sequence) {
        if (obj._oTick == null) obj._oTick = 0;
        if (obj._oIdx == null) obj._oIdx = 0;
        obj._oTick++;
        if (obj._oTick >= obj.overlay.rate) {
          obj._oTick = 0;
          obj._oIdx = (obj._oIdx + 1) % obj.overlay.sequence.length;
        }
      } else if (obj.anim?.sequence) {
        if (obj._animTick == null) obj._animTick = 0;
        if (obj._animIdx == null) obj._animIdx = 0;
        obj._animTick++;
        if (obj._animTick >= obj.anim.rate) {
          obj._animTick = 0;
          obj._animIdx = (obj._animIdx + 1) % obj.anim.sequence.length;
          const frameNum = obj.anim.sequence[obj._animIdx];
          obj.sprite = `${obj.anim.prefix}${frameNum}`;
          if (obj.anim.framePos?.[frameNum]) {
            obj.x = obj.anim.framePos[frameNum][0];
            obj.y = obj.anim.framePos[frameNum][1];
          }
        }
      }
    }
  }

  _scrollToAlex() {
    const targetScroll = Math.max(0, Math.min(this.bgWidth - 320, this.alexX - 160));
    if (Math.abs(this.scrollX - targetScroll) > 1) {
      this.scrollX += Math.sign(targetScroll - this.scrollX) * Math.min(4, Math.abs(targetScroll - this.scrollX));
    } else {
      this.scrollX = targetScroll;
    }
  }

  _calcDirection(fromX, fromY, toX, toY) {
    const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
    if (angle >= -22.5 && angle < 22.5) return 6;
    if (angle >= 22.5 && angle < 67.5) return 3;
    if (angle >= 67.5 && angle < 112.5) return 2;
    if (angle >= 112.5 && angle < 157.5) return 1;
    if (angle >= 157.5 || angle < -157.5) return 4;
    if (angle >= -157.5 && angle < -112.5) return 7;
    if (angle >= -112.5 && angle < -67.5) return 8;
    if (angle >= -67.5 && angle < -22.5) return 9;
    return 2;
  }

  _setInputMode(mode) {
    this.inputMode = mode;
    this._refreshCursor();
  }

  _refreshCursor() {
    if (this.modal) {
      this.engine.cursor = 'ARROWCURSOR';
      return;
    }
    this.engine.cursor = ({
      walk: 'WALKCURSOR',
      look: 'LOOKCURSOR',
      talk: 'TALKCURSOR',
      touch: 'TOUCHCURSOR',
      bag: 'ARROWCURSOR',
    })[this.inputMode] || 'ARROWCURSOR';
  }

  _getUiButton(mx, my) {
    if (this.modal || this.engine.mouseY < this.panelLayout.panel.revealY) return null;
    return this.uiButtons.find((button) => mx >= button.x && mx <= button.x + button.w && my >= button.y && my <= button.y + button.h) || null;
  }

  _findInteraction(worldX, worldY, mode) {
    for (const interaction of this.sceneScript.interactions || []) {
      if (!this._interactionEnabled[interaction.id]) continue;
      const rect = this._getInteractionRect(interaction);
      if (!rect) continue;
      const [x1, y1, x2, y2] = rect;
      if (worldX >= x1 && worldX <= x2 && worldY >= y1 && worldY <= y2) {
        const eventId = interaction.modes?.[mode];
        if (eventId) return { interaction, eventId };
      }
    }
    return null;
  }

  _getInteractionRect(interaction) {
    if (interaction.object) {
      const obj = this.objectByName?.[interaction.object];
      const spriteName = interaction.sprite || obj?.sprite;
      const img = spriteName ? this.engine.getAsset(spriteName) : null;
      if (obj && img) {
        const pad = interaction.pad || [0, 0, 0, 0];
        return [obj.x + pad[0], obj.y + pad[1], obj.x + img.width + pad[2], obj.y + img.height + pad[3]];
      }
    }
    return interaction.rect || null;
  }

  _startWalk(x, y) {
    this.alexTargetX = x;
    this.alexTargetY = y;
    this.alexWalking = true;
    this.alexFrame = 1;
    this.alexStepTick = 0;
    this.alexDir = this._calcDirection(this.alexX, this.alexY, x, y);
    this.alexWalkCycleIdx = 0;
    this.alexIdleTick = 0;
  }

  _queueEvent(eventId) {
    const event = this.sceneScript.events?.[eventId];
    if (!event) return;
    this.actionQueue = [];
    this._enqueueSteps(event);
    this._processActionQueue();
  }

  _enqueueSteps(steps) {
    const list = Array.isArray(steps) ? steps : [steps];
    this.actionQueue.push(...list.map((step) => ({ ...step })));
  }

  _processActionQueue() {
    if (this.modal || this.alexWalking) return;
    while (this.actionQueue.length) {
      const step = this.actionQueue.shift();
      if (step.if) {
        this._enqueueSteps(this._evaluateCondition(step.if) ? step.then : step.else);
        continue;
      }
      if (step.type === 'event') { this._enqueueSteps(this.sceneScript.events?.[step.id]); continue; }
      if (step.type === 'walkTo') { this._startWalk(step.x, step.y); return; }
      if (step.type === 'face') { this.alexDir = step.dir; this.alexFrame = 1; this.alexIdleTick = 0; continue; }
      if (step.type === 'message') { this._openMessage(step.id); return; }
      if (step.type === 'dialog') { this._openDialog(step.id); return; }
      if (step.type === 'setState') { this.state[step.key] = step.value; this._applyBindings(); continue; }
      if (step.type === 'incState') { this.state[step.key] = (this.state[step.key] || 0) + (step.amount ?? 1); this._applyBindings(); }
    }
  }

  _openMessage(messageId) {
    const message = this.sceneScript.messages?.[messageId];
    if (!message) return;
    this._stopSound();
    this._dialogExitBox = null;
    this.modal = { type: 'message', presentation: message.presentation || 'note', speakerTalking: false, locked: false, ...message };
    this._refreshCursor();
    if (this.modal.presentation === 'talk' && this.modal.sound) {
      this.modal.speakerTalking = true;
      this.modal.locked = true;
      this._playModalSound(this.modal.sound, () => {
        if (this.modal?.type !== 'message') return;
        this.modal.speakerTalking = false;
        this.modal.locked = false;
      });
    }
  }

  _openDialog(dialogId, options = {}) {
    const dialog = this.sceneScript.dialogs?.[dialogId];
    if (!dialog) return;
    this._stopSound();
    this._dialogExitBox = null;
    this.modal = {
      type: 'dialog',
      speaker: dialog.speaker,
      speakerSprite: dialog.speakerSprite,
      speakerBase: dialog.speakerBase,
      speakerStaticOverlay: dialog.speakerStaticOverlay,
      speakerOverlay: dialog.speakerOverlay,
      prompt: dialog.prompt,
      promptSound: dialog.promptSound || null,
      question: dialog.question,
      choices: dialog.choices,
      selectedChoice: null,
      phase: dialog.promptSound ? 'npcPrompt' : 'choice',
      speakerTalking: false,
      alexTalking: false,
      replyTick: 0,
      replyDurationTicks: 0,
    };
    this._refreshCursor();
    if (dialog.promptSound) {
      if (options.deferPromptSound) this._gestureLockedDialog = dialog;
      else this._startDialogPrompt(dialog);
    }
  }

  _startDialogPrompt(dialog) {
    if (!this.modal || this.modal.type !== 'dialog') return;
    this.modal.phase = 'npcPrompt';
    this.modal.speakerTalking = true;
    this._playModalSound(dialog.promptSound, () => {
      if (this.modal?.type !== 'dialog') return;
      this.modal.phase = 'choice';
      this.modal.speakerTalking = false;
    });
  }

  _confirmDialogChoice(choiceIdx) {
    if (!this.modal || this.modal.type !== 'dialog') return;
    const choice = this.modal.choices[choiceIdx];
    if (!choice) return;
    this.modal.selectedChoice = choiceIdx;
    this.modal.phase = 'alexReply';
    this.modal.speakerTalking = false;
    this.modal.alexTalking = true;
    this.modal.replyTick = 0;
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    const finish = () => {
      if (this.modal?.type !== 'dialog') return;
      this.modal.alexTalking = false;
      this.modal.phase = 'alexPause';
      this._pendingDialogChoiceEvent = choice.event;
      this._pendingDialogDelayTicks = DIALOG_RESPONSE_DELAY_TICKS;
    };
    if (choice.responseSound) this._playModalSound(choice.responseSound, finish);
    else finish();
  }

  _playModalSound(name, onended) {
    this._stopSound();
    const src = this.engine.playSound(name);
    this.currentSound = src;
    if (src?.buffer && this.modal?.type === 'dialog' && this.modal.phase === 'alexReply') {
      this.modal.replyDurationTicks = Math.max(1, Math.round((src.buffer.duration * 1000) / 55));
    }
    if (src) {
      src.onended = () => {
        if (this.currentSound === src) this.currentSound = null;
        if (onended) onended();
      };
    } else if (onended) {
      onended();
    }
  }

  _stopSound() {
    if (!this.currentSound) return;
    try { this.currentSound.stop(); } catch {}
    this.currentSound = null;
  }

  _handleModalClick(mx, my) {
    if (!this.modal) return;
    if (this.modal.type === 'message') {
      if (this.modal.locked) return;
      this._stopSound();
      this.modal = null;
      this._refreshCursor();
      this._processActionQueue();
      return;
    }
    if (this.modal.type !== 'dialog' || this.modal.phase !== 'choice') return;
    if (this._dialogExitBox && mx >= this._dialogExitBox.x1 && mx <= this._dialogExitBox.x2 && my >= this._dialogExitBox.y1 && my <= this._dialogExitBox.y2) {
      this._stopSound();
      this.modal = null;
      this._choiceBoxes = [];
      this._dialogExitBox = null;
      this.actionQueue = [];
      this._refreshCursor();
      return;
    }
    for (let i = 0; i < this._choiceBoxes.length; i++) {
      const box = this._choiceBoxes[i];
      if (mx >= box.x1 && mx <= box.x2 && my >= box.y1 && my <= box.y2) {
        this.modal.selectedChoice = i;
        return;
      }
    }
  }

  _evaluateCondition(condition) {
    if (!condition) return true;
    const value = this.state[condition.state];
    if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return value === condition.equals;
    if (Object.prototype.hasOwnProperty.call(condition, 'gte')) return value >= condition.gte;
    if (Object.prototype.hasOwnProperty.call(condition, 'lte')) return value <= condition.lte;
    return Boolean(value);
  }

  _applyBindings() {
    for (const binding of this.sceneScript.bindings || []) {
      const active = this._evaluateCondition(binding.when);
      if (binding.type === 'objectVisible') {
        const obj = this.objectByName?.[binding.object];
        if (obj) obj.visible = active;
      } else if (binding.type === 'interactionEnabled') {
        this._interactionEnabled[binding.interaction] = active;
      }
    }
  }

  _queueFallbackEvent(mode) {
    const eventId = this.sceneScript.fallbacks?.[mode];
    if (eventId) this._queueEvent(eventId);
  }

  _inWalkZone(x, y) {
    return this.walkZones.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2);
  }
}
