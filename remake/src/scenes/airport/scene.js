import { BitmapFont } from '../../ui/bitmap-font.js';
import { ACTION_BUTTONS, CURSOR_HOTSPOTS, WHEEL_INPUT_MODES } from '../../ui/action-modes.js';
import { STANDARD_DIALOG_LAYOUT } from '../../ui/dialog-layout.js';
import { STANDARD_NOTE_LAYOUT } from '../../ui/note-layout.js';
import { STANDARD_PANEL_LAYOUT } from '../../ui/panel-layout.js';
import { createMeterAnimationState, startMeterAmountAnimation, tickMeterAnimation } from '../../ui/meter-animation.js';
import { renderPanel } from '../../ui/panel-renderer.js';
import { ScriptedScene } from '../../runtime/script-runtime.js';
import { AIRPORT_SCRIPT } from './script.js';
import { normalizeAirportRoute } from './route.js';
import { AIRPORT_RESOURCES } from './resources.js';
import { pickAirportRouteState } from './state.js';
import {
  ANIM_TICK_SCALE,
  DIALOG_RESPONSE_DELAY_TICKS,
  INVENTORY_ITEM_DEFS,
  SOUND_MANIFEST,
  WALK_ZONES,
  buildAssetManifest,
  createAirportObjects,
} from './content.js';
import { AIRPORT_STATIC_REGIONS, resolveAirportSelectorRect } from './topology.js';

const FADE_TICKS = 18;
const ENTRY_DESCENT_FRAME_TICKS = 3;
const ENTRY_DESCENT_START_FRAME = 1;
const ENTRY_WALK_TARGET = Object.freeze({ x: 836, y: 140 });
const ENTRY_ALEX_START = Object.freeze({ x: 868, y: 140 });

export class AirportScene extends ScriptedScene {
  constructor(options = {}) {
    super({
      sceneScript: AIRPORT_SCRIPT,
      dialogLayout: STANDARD_DIALOG_LAYOUT,
      noteLayout: STANDARD_NOTE_LAYOUT,
      dialogResponseDelayTicks: DIALOG_RESPONSE_DELAY_TICKS,
    });
    this.route = normalizeAirportRoute(options.route || {});
    this.onRouteChange = null;
    this.panelLayout = STANDARD_PANEL_LAYOUT;
    this.uiButtons = ACTION_BUTTONS;
    this.walkZones = WALK_ZONES;
    this.walkMasks = AIRPORT_STATIC_REGIONS
      .filter((region) => region.kind === 'walkMask')
      .map((region) => resolveAirportSelectorRect(region.selector))
      .filter(Boolean);
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

  async load(engine) {
    const { images, frameCounts } = buildAssetManifest();
    this._frameCounts = frameCounts;
    await engine.loadImages(images);
    await engine.loadSounds(SOUND_MANIFEST);
    for (const [name, hotspot] of Object.entries(CURSOR_HOTSPOTS)) {
      engine.registerCursorHotspot(name, hotspot);
    }
    engine.registerCursorHotspot('PASSPORTICON', { x: 0, y: 0 });
    engine.registerCursorHotspot('LETTERICON', { x: 0, y: 0 });

    const fontImg = new Image();
    const fontData = await (await fetch('../assets/mainfont.json')).json();
    await new Promise((resolve, reject) => {
      fontImg.onload = resolve;
      fontImg.onerror = reject;
      fontImg.src = '../assets/mainfont.png';
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
    this.inputMode = 'walk';
    this.selectedItem = null;
    this.uiTick = 0;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
    this._pressedInventoryControlMode = null;
    this._sceneAnimation = null;
    this._entrySequence = null;
    this._pendingWalkSteps = null;

    this.initScriptRuntime();
    this._applyRouteStateOverrides();
    this._applyDebugRouteOverrides();
    this._armRouteDrivenQueueClearIfNeeded();
    this._processActionQueue();
    this.meterAnimation = createMeterAnimationState(this.state?.palmettoes ?? 100);
    this.scrollX = Math.max(0, this.alexX - 160);
    this._setInputMode('walk');
    this._startEntrySequenceIfNeeded();

    if (this.route.dialogId) {
      this._openDialog(this.route.dialogId, { deferPromptSound: true });
    } else if (this.route.view === 'form') {
      this._openForm(this.route.formId || 'lostAndFoundForm');
    } else if (this.route.view === 'inventory') {
      this._openInventory(this.route.inventoryId || 'bag');
    } else if (this.route.view === 'resource' && Number.isFinite(this.route.resourceSectionId)) {
      this._openTextRefSection(this.route.resourceSectionId);
    } else if (this.route.debug?.noteSectionId) {
      this._openTextRefSection(this.route.debug.noteSectionId);
    }
    this._publishRoute();
  }

  onMouseDown({ x, y }) {
    if (this._entrySequence) return;
    if (this._gestureLockedDialog) {
      const dialog = this._gestureLockedDialog;
      this._gestureLockedDialog = null;
      this._startDialogPrompt(dialog);
      return;
    }
    if (this.modal) {
      if (this.modal.type === 'inventory') {
        if (this.modal.inspectItem) {
          this._handleModalClick(x, y);
          return;
        }
        const control = this._inventoryControlBoxes.find((box) => x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2);
        if (control) {
          this._pressedInventoryControlMode = control.mode;
          this.modal.pressedControlMode = control.mode;
          return;
        }
      }
      if (this.modal.type === 'form') {
        this._handleFormMouseDown(x, y);
        return;
      }
      this._handleModalClick(x, y);
      return;
    }
    const button = this._getUiButton(x, y);
    if (button) {
      this._pressedButtonMode = button.mode;
      this._pendingButtonMode = button.mode;
      return;
    }
    const worldX = x + this.scrollX;
    const worldY = y;
    if (this.actionQueue.length) {
      if (this._pendingDelayTicks > 0 && this.inputMode === 'walk' && this._inWalkZone(worldX, worldY)) {
        this._startWalk(worldX, worldY);
      }
      return;
    }
    const interactionMode = this.inputMode === 'item' ? 'bag' : this.inputMode;
    const interaction = this._findInteraction(worldX, worldY, interactionMode);
    if (interaction) {
      this._handleInteractionAction(interaction.action);
      return;
    }
    if (this.inputMode === 'item') {
      this._queueEvent('bagDefault');
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
    if (this._entrySequence) return;
    if (this.modal?.type === 'inventory' && this._pressedInventoryControlMode) {
      const mode = this._pressedInventoryControlMode;
      this._pressedInventoryControlMode = null;
      this.modal.pressedControlMode = null;
      const control = this._inventoryControlBoxes.find((box) => box.mode === mode && x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2);
      if (control) {
        if (control.mode === 'exit') this._closeInventory();
        else {
          this.modal.mode = control.mode;
          this._refreshCursor();
        }
      }
      return;
    }
    const pressedMode = this._pressedButtonMode;
    const pendingMode = this._pendingButtonMode;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
    if (!pendingMode || pressedMode !== pendingMode) return;
    const button = this._getUiButton(x, y);
    if (!button || button.mode !== pendingMode) return;
    if (button.mode === 'exit') return;
    if (button.mode === 'bag' && !this.state?.bag?.length) {
      this._queueEvent('bagMissing');
      return;
    }
    if (button.mode === 'bag' && this.state?.bag?.length) {
      this._openInventory('bag');
      return;
    }
    this.selectedItem = null;
    this._setInputMode(button.mode);
  }

  onMouseLeave() {
    if (this._entrySequence) return;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
    this._pressedInventoryControlMode = null;
    if (this.modal?.type === 'inventory') this.modal.pressedControlMode = null;
  }

  onWheel({ deltaY, originalEvent }) {
    if (this._entrySequence) return;
    if (this.modal) return;
    this.selectedItem = null;
    const currentIdx = WHEEL_INPUT_MODES.indexOf(this.inputMode);
    const nextIdx = ((currentIdx >= 0 ? currentIdx : 0) + (deltaY > 0 ? 1 : -1) + WHEEL_INPUT_MODES.length) % WHEEL_INPUT_MODES.length;
    this._setInputMode(WHEEL_INPUT_MODES[nextIdx]);
    originalEvent.preventDefault();
  }

  onKeyDown({ key, originalEvent }) {
    if (this._entrySequence) return;
    if (!this.modal) return;
    if (this.modal.type === 'form') {
      this._handleFormKeyDown(key, originalEvent);
      return;
    }
    if (this.modal.type === 'inventory') {
      if (key === 'Escape') {
        if (this.modal.inspectItem) {
          this.modal.inspectItem = null;
          this._afterModalChanged();
          this._refreshCursor();
        } else {
          this._closeInventory();
        }
        originalEvent.preventDefault();
        return;
      }
      if (this.modal.inspectItem) return;
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        this.modal.mode = this.modal.mode === 'take' ? 'look' : 'take';
        originalEvent.preventDefault();
        return;
      }
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        this.modal.mode = this.modal.mode === 'look' ? 'take' : 'look';
        originalEvent.preventDefault();
        return;
      }
      return;
    }
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

    if (this.fade === 'in') {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + 1 / FADE_TICKS);
      if (this.fadeAlpha >= 1) this.fade = 'none';
    }

    this._tickEntrySequence();
    this._tickWalk();
    this._tickObjects();
    this._scrollToAlex();
    this.tickScriptRuntime();
  }

  render(ctx) {
    const bg = this.engine.getAsset('SCENE_BG');
    if (bg) ctx.drawImage(bg, -this.scrollX, 0);

    for (const obj of this.objectsBehind) this._renderObject(ctx, obj);
    this._renderSceneAnimation(ctx);
    this._renderAlex(ctx);
    for (const obj of this.objectsFront) this._renderObject(ctx, obj);

    this.renderScriptModal(ctx, this.font, this.uiTick);
    const suppressPanel = this.modal?.presentation === 'resource' || this.modal?.type === 'form' || this.modal?.type === 'inventory';
    if (!suppressPanel) {
      renderPanel(ctx, {
        assets: this.engine.assets,
        mouseY: this.engine.mouseY,
        modalOpen: Boolean(this.modal),
        buttons: this.uiButtons,
        pressedMode: this._pressedButtonMode,
        amount: this.state?.palmettoes ?? 100,
        bagReceived: Boolean(this.state?.bag?.length),
        inputMode: this.inputMode,
        layout: this.panelLayout,
        moneyAnimation: this.meterAnimation,
      });
    }

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

  _afterModalChanged() {
    this._publishRoute();
  }

  _afterStateChanged() {
    if (arguments[0] === 'palmettoes') {
      startMeterAmountAnimation(
        this.meterAnimation,
        this.meterAnimation?.amount ?? AIRPORT_SCRIPT.initialState?.palmettoes ?? 100,
        this.state?.palmettoes ?? 100,
        this.panelLayout,
      );
    }
    this._publishRoute();
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
    if (this._entrySequence?.renderDescendingOnly) return;
    const spriteDir = this.alexWalking ? this.alexDir : 1;
    const spriteName = `ALEX${spriteDir}-${this.alexFrame}`;
    const img = this.engine.getAsset(spriteName);
    if (!img) return;
    const screenX = this.alexX - this.scrollX - img.width / 2;
    const screenY = this.alexY - img.height;
    ctx.drawImage(img, Math.round(screenX), Math.round(screenY));
  }

  _renderSceneAnimation(ctx) {
    if (!this._sceneAnimation) return;
    const frame = this._sceneAnimation.sequence[this._sceneAnimation.index];
    const img = this.engine.getAsset(`${this._sceneAnimation.prefix}${frame}`);
    if (img) ctx.drawImage(img, this._sceneAnimation.x - this.scrollX, this._sceneAnimation.y);
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
      if (this._pendingWalkSteps?.length) {
        const steps = this._pendingWalkSteps;
        this._pendingWalkSteps = null;
        this._prependSteps(steps);
      }
      this._processActionQueue();
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
      if (this._pendingWalkSteps?.length) {
        const steps = this._pendingWalkSteps;
        this._pendingWalkSteps = null;
        this._prependSteps(steps);
      }
      this._processActionQueue();
    }
  }

  _tickObjects() {
    tickMeterAnimation(this.meterAnimation);
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
    if (this._sceneAnimation) {
      const anim = this._sceneAnimation;
      anim.tick++;
      if (anim.tick >= anim.rate) {
        anim.tick = 0;
        anim.index++;
        if (anim.index >= anim.sequence.length) {
          this._sceneAnimation = null;
          this._processActionQueue();
        }
      }
    }
  }

  _scrollToAlex() {
    const focusX = this._entrySequence?.focusX ?? this.alexX;
    const targetScroll = Math.max(0, Math.min(this.bgWidth - 320, focusX - 160));
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
      if (this.modal.type === 'inventory') {
        if (this.modal.inspectItem) {
          this.engine.cursor = 'ARROWCURSOR';
          return;
        }
        this.engine.cursor = this.modal.mode === 'look' ? 'LOOKCURSOR' : 'TOUCHCURSOR';
        return;
      }
      this.engine.cursor = 'ARROWCURSOR';
      return;
    }
    if (this.inputMode === 'item' && this.selectedItem) {
      this.engine.cursor = `${this.selectedItem.toUpperCase()}ICON`;
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
    let best = null;
    const interactions = this.sceneScript.interactions || [];
    for (let index = 0; index < interactions.length; index++) {
      const interaction = interactions[index];
      if (!this._interactionEnabled[interaction.id]) continue;
      const rect = this._getInteractionRect(interaction);
      if (!rect) continue;
      const [x1, y1, x2, y2] = rect;
      if (worldX >= x1 && worldX <= x2 && worldY >= y1 && worldY <= y2) {
        const action = interaction.actions?.[mode];
        if (!action) continue;
        const area = Math.max(1, (x2 - x1) * (y2 - y1));
        if (!best || area < best.area || (area === best.area && index > best.index)) {
          best = { interaction, action, area, index };
        }
      }
    }
    return best ? { interaction: best.interaction, action: best.action } : null;
  }

  _handleInteractionAction(action) {
    if (!action) return;
    if (this.inputMode === 'item') {
      if (this.selectedItem === 'passport' && action.kind === 'flow' && action.id === 'passport.control.usePassport') {
        this._queueEvent(action.id);
      } else {
        this._queueEvent('bagDefault');
      }
      return;
    }
    if (action.kind === 'approachFlow') {
      this.actionQueue = [];
      this._enqueueSteps({
        type: 'walkThenEvent',
        x: action.approach.x,
        y: action.approach.y,
        then: [{ type: 'event', id: action.id }],
      });
      this._processActionQueue();
      return;
    }
    if (action.kind === 'flow') {
      this._queueEvent(action.id);
      return;
    }
    if (action.kind === 'textRef') {
      this._openTextRefSection(action.sectionId);
      return;
    }
  }

  _openTextRefSection(sectionId) {
    const textRef = AIRPORT_RESOURCES.textRefBySection[sectionId];
    if (!textRef) return;
    this._stopSound();
    if (textRef.resource?.asset) {
      this.modal = {
        id: `resource:${sectionId}`,
        type: 'message',
        presentation: 'resource',
        asset: textRef.resource.asset,
        sourceSectionId: sectionId,
        locked: false,
      };
      this._afterModalChanged();
      this._refreshCursor();
      return;
    }
    this.modal = {
      id: `textRef:${sectionId}`,
      type: 'message',
      presentation: 'note',
      speaker: 'Narrator',
      text: textRef.text,
      sourceSectionId: sectionId,
      locked: false,
    };
    this._afterModalChanged();
    this._refreshCursor();
  }

  _openInventory(inventoryId = 'bag') {
    this._stopSound();
    this.modal = {
      id: inventoryId,
      type: 'inventory',
      mode: 'take',
      pressedControlMode: null,
      inspectItem: null,
      items: (this.state?.bag || [])
        .map((itemId) => INVENTORY_ITEM_DEFS[itemId])
        .filter(Boolean)
        .map((item) => ({
          id: item.id,
          asset: item.iconAsset,
          pictureAsset: item.pictureAsset,
          description: item.description,
        })),
    };
    this._afterModalChanged();
    this._refreshCursor();
  }

  _closeInventory() {
    if (this.modal?.type !== 'inventory') return;
    this.modal = null;
    this._afterModalChanged();
    this._refreshCursor();
  }

  _selectInventoryItem(itemId) {
    this.selectedItem = itemId;
    this.inputMode = 'item';
    this.modal = null;
    this._afterModalChanged();
    this._refreshCursor();
  }

  _handleInventoryItemClick(itemId) {
    if (!this.modal || this.modal.type !== 'inventory') return;
    const item = this.modal.items.find((entry) => entry.id === itemId);
    if (!item) return;
    if (this.modal.mode === 'take') {
      this._selectInventoryItem(itemId);
      return;
    }
    if (this.modal.mode === 'look') {
      this.modal.inspectItem = item;
      this._afterModalChanged();
      this._refreshCursor();
    }
  }

  _handleFormMouseDown(mx, my) {
    if (!this.modal || this.modal.type !== 'form') return;
    if (this.modal.awaitingSubmitConfirm) {
      this._submitLostAndFoundForm();
      return;
    }
    for (let i = 0; i < this.modal.fields.length; i++) {
      const field = this.modal.fields[i];
      const top = field.y;
      const bottom = field.y + 18;
      if (my >= top && my <= bottom) {
        this.modal.activeField = i;
        this.modal.errorText = '';
        return;
      }
    }
  }

  _handleFormKeyDown(key, originalEvent) {
    const modal = this.modal;
    if (!modal || modal.type !== 'form') return;
    if (modal.awaitingSubmitConfirm) {
      if (key === 'Enter') {
        this._submitLostAndFoundForm();
        originalEvent.preventDefault();
      }
      return;
    }
    const field = modal.fields[modal.activeField];
    const current = modal.values[modal.activeField] || '';
    const accepted = Boolean(modal.accepted?.[modal.activeField]);
    const setValue = (next) => {
      if (this.font.measureText((field.prefix || '') + next) > (field.maxWidth || 999)) return;
      modal.values[modal.activeField] = next;
      modal.errorText = '';
    };

    if (key === 'ArrowUp') {
      modal.activeField = (modal.activeField + modal.fields.length - 1) % modal.fields.length;
      modal.errorText = '';
      originalEvent.preventDefault();
      return;
    }
    if (key === 'ArrowDown' || key === 'Tab') {
      modal.activeField = (modal.activeField + 1) % modal.fields.length;
      modal.errorText = '';
      originalEvent.preventDefault();
      return;
    }
    if (key === 'Backspace') {
      if (accepted) {
        originalEvent.preventDefault();
        return;
      }
      setValue(current.slice(0, -1));
      originalEvent.preventDefault();
      return;
    }
    if (key === 'Enter') {
      this._submitLostAndFoundFormField();
      originalEvent.preventDefault();
      return;
    }
    if (key.length === 1 && /[a-zA-Z -]/.test(key)) {
      if (accepted) {
        originalEvent.preventDefault();
        return;
      }
      setValue(current + key);
      originalEvent.preventDefault();
    }
  }

  _submitLostAndFoundFormField() {
    const modal = this.modal;
    if (!modal || modal.type !== 'form') return;
    const fieldIdx = modal.activeField;
    const expected = this._getLostAndFoundExpectedValues();
    const rawActual = this._normalizeFormValue(modal.values[fieldIdx]);
    const actual = rawActual.toLowerCase();
    const expectedValue = expected[fieldIdx];
    const expectedNormalized = expectedValue.toLowerCase();
    if (actual === expectedNormalized && rawActual !== expectedValue) {
      this._openFormReminderNote(800);
      return;
    }
    if (actual === expectedNormalized) {
      modal.values[fieldIdx] = expectedValue;
      modal.accepted[fieldIdx] = true;
      modal.errorText = '';
      this._advanceLostAndFoundForm();
      return;
    }
    modal.values[fieldIdx] = '';
    modal.mistakes[fieldIdx] = (modal.mistakes[fieldIdx] || 0) + 1;
    modal.errorText = '';
    this.engine.playBeep?.();
    if (modal.mistakes[fieldIdx] >= 3) {
      modal.values[fieldIdx] = expected[fieldIdx];
      modal.accepted[fieldIdx] = true;
      modal.autoFilled[fieldIdx] = true;
      this._advanceLostAndFoundForm();
    }
  }

  _advanceLostAndFoundForm() {
    const modal = this.modal;
    if (!modal || modal.type !== 'form') return;
    const nextIdx = modal.accepted.findIndex((accepted) => !accepted);
    if (nextIdx >= 0) {
      modal.activeField = nextIdx;
      return;
    }
    modal.awaitingSubmitConfirm = true;
  }

  _submitLostAndFoundForm() {
    const modal = this.modal;
    if (!modal || modal.type !== 'form') return;
    this.modal = null;
    this._afterModalChanged();
    this._refreshCursor();
    this._enqueueSteps(this.state.claimMatchesBag ? this.sceneScript.events.receiveBag : this.sceneScript.events.wrongBag);
    this._processActionQueue();
  }

  _playSceneAnimation(step) {
    if (step.id === 'familyQueueLeave') {
      this._sceneAnimation = {
        prefix: 'FAMGO',
        sequence: [1, 2, 3, 4, 5, 6, 7, 8],
        x: 500,
        y: 40,
        rate: 3,
        tick: 0,
        index: 0,
      };
      return;
    }
    if (step.id !== 'clerkHandOff') {
      this._processActionQueue();
      return;
    }
    const familyByColor = {
      grey: { prefix: 'G-LOST', sequence: Array.from({ length: 20 }, (_, i) => i) },
      purple: { prefix: 'L-LOST', sequence: Array.from({ length: 19 }, (_, i) => i + 1) },
      pink: { prefix: 'P-LOST', sequence: Array.from({ length: 20 }, (_, i) => i) },
    };
    const chosen = familyByColor[this.state.claimColor];
    if (!chosen) {
      this._processActionQueue();
      return;
    }
    this._sceneAnimation = {
      prefix: chosen.prefix,
      sequence: chosen.sequence,
      x: 104,
      y: 16,
      rate: 2,
      tick: 0,
      index: 0,
    };
  }

  _getLostAndFoundExpectedValues() {
    return [
      'Alex',
      'bag',
      ({ big: 'big', medium: 'medium-size', small: 'small' })[this.state.claimSize] || '',
      ({ grey: 'grey', purple: 'purple', pink: 'pink' })[this.state.claimColor] || '',
    ];
  }

  _normalizeFormValue(value) {
    return (value || '').trim().replace(/\s+/g, ' ');
  }

  _openFormReminderNote(sectionId) {
    if (!this.modal || this.modal.type !== 'form') return;
    const returnModal = this.modal;
    const textRef = AIRPORT_RESOURCES.textRefBySection[sectionId];
    if (!textRef) return;
    this._stopSound();
    this.modal = {
      id: `textRef:${sectionId}`,
      type: 'message',
      presentation: 'note',
      speaker: 'Narrator',
      text: textRef.text,
      sourceSectionId: sectionId,
      locked: false,
      returnModal,
    };
    this._afterModalChanged();
    this._refreshCursor();
  }

  _applyRouteStateOverrides() {
    const overrides = this.route.state || {};
    for (const [key, value] of Object.entries(overrides)) {
      this.state[key] = value;
    }
    this._applyBindings();
  }

  _applyDebugRouteOverrides() {
    const debug = this.route.debug || {};
    if (Number.isFinite(debug.alexX)) this.alexX = debug.alexX;
    if (Number.isFinite(debug.alexY)) this.alexY = debug.alexY;
    if (Number.isFinite(debug.alexDir)) this.alexDir = debug.alexDir;
  }

  _armRouteDrivenQueueClearIfNeeded() {
    if (this.state?.familyQueue === 'queued' && this.state?.familyQueuePendingClear === true && this._pendingDelayTicks <= 0) {
      this._enqueueSteps([
        { type: 'delay', ticks: 90 },
        { type: 'event', id: 'familyQueue.clear' },
      ]);
    }
  }

  _publishRoute() {
    if (typeof this.onRouteChange !== 'function') return;
    this.onRouteChange(this._buildRoute());
  }

  _buildRoute() {
    const state = pickAirportRouteState(this.state);
    if (this.modal?.type === 'dialog' && this.modal.id) {
      return { scene: 'airport', view: 'dialog', dialogId: this.modal.id, state, initial: false };
    }
    if (this.modal?.type === 'form' && this.modal.id) {
      return { scene: 'airport', view: 'form', formId: this.modal.id, state, initial: false };
    }
    if (this.modal?.type === 'inventory') {
      return { scene: 'airport', view: 'inventory', inventoryId: 'bag', state, initial: false };
    }
    if (this.modal?.presentation === 'resource' && Number.isFinite(this.modal.sourceSectionId)) {
      return { scene: 'airport', view: 'resource', resourceSectionId: this.modal.sourceSectionId, state, initial: false };
    }
    return { scene: 'airport', view: 'scene', state, initial: false };
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

  _walkTo(x, y) {
    this._startWalk(x, y);
  }

  _walkThenEvent(x, y, steps) {
    this._pendingWalkSteps = Array.isArray(steps) ? steps.map((step) => ({ ...step })) : [{ ...steps }];
    this._startWalk(x, y);
  }

  _face(dir) {
    this.alexDir = dir;
    this.alexFrame = 1;
    this.alexIdleTick = 0;
  }

  _isScriptBusy() {
    return this.alexWalking || Boolean(this._sceneAnimation) || Boolean(this._entrySequence);
  }

  _inWalkZone(x, y) {
    const inBaseZone = this.walkZones.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2);
    if (!inBaseZone) return false;
    if (this.walkMasks.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2)) return false;
    if (this.state?.familyQueue === 'queued') {
      const familyBlock = this._getInteractionRect({ object: 'Family', sprite: 'FAMILY1', pad: [0, 0, -76, 0] });
      if (familyBlock) {
        const [x1, y1, x2, y2] = familyBlock;
        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return false;
      }
    }
    return true;
  }

  _startEntrySequenceIfNeeded() {
    const hasDebugPlacement = Number.isFinite(this.route.debug?.alexX) || Number.isFinite(this.route.debug?.alexY);
    const shouldRun = this.route.initial === true && this.route.view === 'scene' && !this.route.dialogId && !hasDebugPlacement;
    if (!shouldRun) return;
    const descending = this.objectByName?.ALEXDN;
    if (!descending) return;
    descending.visible = true;
    descending.sprite = `ALEXDN${ENTRY_DESCENT_START_FRAME}`;
    this.alexX = ENTRY_WALK_TARGET.x;
    this.alexY = ENTRY_WALK_TARGET.y;
    this._entrySequence = {
      frame: ENTRY_DESCENT_START_FRAME,
      tick: 0,
      renderDescendingOnly: true,
      focusX: 838,
    };
  }

  _tickEntrySequence() {
    if (!this._entrySequence) return;
    const descending = this.objectByName?.ALEXDN;
    if (!descending) {
      this._entrySequence = null;
      return;
    }
    if (this._entrySequence.renderDescendingOnly) {
      this._entrySequence.tick++;
      if (this._entrySequence.tick >= ENTRY_DESCENT_FRAME_TICKS) {
        this._entrySequence.tick = 0;
        this._entrySequence.frame++;
        if (this._entrySequence.frame > 18) {
          descending.visible = false;
          this._entrySequence.renderDescendingOnly = false;
          this.alexX = ENTRY_ALEX_START.x;
          this.alexY = ENTRY_ALEX_START.y;
          this.alexDir = 4;
          this.alexFrame = 1;
          this._startWalk(ENTRY_WALK_TARGET.x, ENTRY_WALK_TARGET.y);
          this._entrySequence.focusX = this.alexX;
          return;
        }
        descending.sprite = `ALEXDN${this._entrySequence.frame}`;
      }
      return;
    }
    this._entrySequence.focusX = this.alexX;
    if (!this.alexWalking) {
      this._entrySequence = null;
    }
  }
}
