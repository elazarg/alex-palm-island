import { WIDTH, HEIGHT } from '../../core/engine.js';
import { resolveInteractionMode } from '../../ui/action-modes.js';
import { createMeterAnimationState, tickMeterAnimation } from '../../ui/meter-animation.js';
import { renderPanel } from '../../ui/panel-renderer.js';
import { GameScene } from '../../runtime/game-scene.js';
import { AIRPORT_SCENE_DEFINITION } from './definition.js';
import { getAirportLostAndFoundExpectedValues } from './state.js';
import { buildStripAirCarryState } from '../stripair/state.js';
import {
  ENTRY_ALEX_START,
  ENTRY_DESCENT_FRAME_TICKS,
  ENTRY_DESCENT_START_FRAME,
  ENTRY_WALK_TARGET,
} from './content.js';
import { AIRPORT_ENTITIES } from './semantics.js';
import { AIRPORT_ACTIVE_INTERACTIONS } from './theme-2d.js';
import { AIRPORT_STATIC_REGIONS, resolveAirportRegionRect, resolveAirportSelectorRect } from './topology.js';

const FADE_TICKS = 18;
const DEBUG_ENTITY_COLORS = Object.freeze({
  npc: '#ff4d4d',
  npcGroup: '#ff7f50',
  prop: '#4db8ff',
  traversal: '#ffd24d',
  sign: '#66e08a',
  uiForm: '#d78bff',
});
const DEBUG_REGION_COLORS = Object.freeze({
  walkMask: '#ff2d55',
  interactiveZone: '#2ec4ff',
  exitTrigger: '#ffcc00',
  walkTarget: '#00d084',
  waitZone: '#a970ff',
  occlusion: '#8c8c8c',
  uiMask: '#c77dff',
  marker: '#ffffff',
  unclassified: '#999999',
});

export class AirportScene extends GameScene {
  constructor(options = {}) {
    super({
      definition: AIRPORT_SCENE_DEFINITION,
    });
    this.route = AIRPORT_SCENE_DEFINITION.route.normalize(options.route || {});
    this.walkZones = AIRPORT_SCENE_DEFINITION.topology.walkZones;
    this.walkMasks = AIRPORT_SCENE_DEFINITION.topology.walkMasks;
    this.conditionalWalkMasks = AIRPORT_SCENE_DEFINITION.topology.conditionalWalkMasks;
    this.familyQueueWaitZone = resolveAirportRegionRect('queue.waitZone');
    this._debugObjectKinds = Object.fromEntries(
      Object.values(AIRPORT_ENTITIES)
        .flatMap((entity) => (entity.sceneObjects || []).map((name) => [name, entity.kind]))
    );
  }

  init() {
    const { behind, front } = AIRPORT_SCENE_DEFINITION.createObjects();
    this.objectsBehind = behind;
    this.objectsFront = front;
    this.sceneObjects = [...behind, ...front];
    this.objectByName = Object.fromEntries(this.sceneObjects.map((obj) => [obj.name, obj]));

    this.bgWidth = this.engine.getAsset('SCENE_BG')?.width || WIDTH;
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
    this.meterAnimation = createMeterAnimationState(this.state?.palmettoes ?? 100);
    this.scrollX = Math.max(0, this.alexX - 160);
    this._setInputMode('walk');
    this._startEntrySequenceIfNeeded();
    this._openInitialRouteScreen();
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
    const interactionMode = resolveInteractionMode(this.inputMode);
    const interaction = this._findInteraction(worldX, worldY, interactionMode);
    if (interaction) {
      this._handleInteractionAction(interaction.action);
      return;
    }
    if (this.inputMode !== 'walk') {
      this._queueFallbackEvent(interactionMode);
      return;
    }
    if (!this._inWalkZone(worldX, worldY)) return;
    this._startWalk(worldX, worldY);
  }

  _handleModalKeyDown(key, originalEvent) {
    if (this.modal.type === 'form') {
      this._handleFormKeyDown(key, originalEvent);
      return;
    }
    super._handleModalKeyDown(key, originalEvent);
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
    this._maybeArmFamilyQueueClear();
    this._scrollToAlex();
    this.tickScriptRuntime();
  }

  render(ctx) {
    const bg = this.engine.getAsset('SCENE_BG');
    if (bg) ctx.drawImage(bg, -this.scrollX, 0);

    for (const obj of this.objectsBehind) this._renderObject(ctx, obj);
    this._renderSceneAnimation(ctx, 'behindAlex');
    this._renderAlex(ctx);
    this._renderSceneAnimation(ctx, 'beforeFront');
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
        buttonStates: {
          bag: this._getBagButtonState(),
          map: this._getMapButtonState(),
        },
        inputMode: this.inputMode,
        layout: this.panelLayout,
        moneyAnimation: this.meterAnimation,
      });
    }

    if (this.fadeAlpha < 1) {
      ctx.globalAlpha = 1 - this.fadeAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    }
  }

  _afterStateChanged(key) {
    this._applyAirportBoardMode();
    super._afterStateChanged(key);
  }

  _getDebugStaticRegions() {
    const regions = [];
    for (const region of AIRPORT_STATIC_REGIONS) {
      const rect = resolveAirportRegionRect(region.id) || resolveAirportSelectorRect(region.selector);
      if (!rect || region.kind === 'uiMask') continue;
      regions.push({ id: region.id, rect, color: DEBUG_REGION_COLORS[region.kind] || '#ffffff' });
    }
    for (const obj of this.sceneObjects) {
      if (!obj?.visible) continue;
      const kind = this._debugObjectKinds[obj.name];
      if (!kind) continue;
      const img = this.engine.getAsset(obj.sprite);
      if (!img) continue;
      const drawY = (obj.anim && obj.anim.bottomAlign) ? obj.anim.bottomAlign - img.height : obj.y;
      regions.push({ id: obj.name, rect: [obj.x, drawY, obj.x + img.width, drawY + img.height], color: DEBUG_ENTITY_COLORS[kind] || '#ffffff' });
    }
    return regions;
  }

  _getDebugActiveInteractions() {
    return AIRPORT_ACTIVE_INTERACTIONS.map((interaction) => {
      const kind = AIRPORT_ENTITIES[interaction.id]?.kind || AIRPORT_ENTITIES[interaction.entity]?.kind || this._debugObjectKinds[interaction.object] || 'prop';
      return { ...interaction, _debugColor: DEBUG_ENTITY_COLORS[kind] || '#ffffff' };
    });
  }


  _tickObjects() {
    this.stairsTick++;
    if (this.stairsTick >= 3) {
      this.stairsTick = 0;
      this.stairsFrame = (this.stairsFrame % 6) + 1;
    }
    for (const obj of this.sceneObjects) {
      if (obj.anim === 'stairs') obj.sprite = `STAIRS${this.stairsFrame}`;
    }
    super._tickObjects();
  }

  _scrollToAlex() {
    const focusX = this._entrySequence?.focusX ?? this.alexX;
    const targetScroll = Math.max(0, Math.min(this.bgWidth - WIDTH, focusX - WIDTH / 2));
    if (Math.abs(this.scrollX - targetScroll) > 1) {
      this.scrollX += Math.sign(targetScroll - this.scrollX) * Math.min(4, Math.abs(targetScroll - this.scrollX));
    } else {
      this.scrollX = targetScroll;
    }
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
    super._handleInteractionAction(action);
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
    const expected = getAirportLostAndFoundExpectedValues(this.state);
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
    if (step.id === 'airportBoardArrivals') {
      this._sceneAnimation = this._createAirportBoardPass({
        prefix: 'TRUP',
        startX: 960,
        y: 50,
        deltas: [-60, -40, -40, -40],
        exitDirection: 'left',
        layer: 'beforeFront',
      });
      return;
    }
    if (step.id === 'airportBoardDepartures') {
      this._sceneAnimation = this._createAirportBoardPass({
        prefix: 'STAFFB',
        startX: 400,
        y: 50,
        deltas: [60, 40, 40, 40],
        exitDirection: 'right',
        layer: 'beforeFront',
      });
      return;
    }
    if (step.id === 'familyQueueLeave') {
      this._sceneAnimation = {
        prefix: 'FAMGO',
        sequence: [1, 2, 3, 4, 5, 6, 7, 8],
        x: 500,
        y: 40,
        layer: 'behindAlex',
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
      layer: 'behindAlex',
      rate: 2,
      tick: 0,
      index: 0,
    };
  }

  _createAirportBoardPass({ prefix, startX, y, deltas, exitDirection, layer }) {
    const baseSequence = [1, 2, 3, 4];
    const sequence = [];
    const positions = [];
    let x = startX;
    let guard = 0;
    while (guard < 64) {
      const frame = baseSequence[guard % baseSequence.length];
      const img = this.engine.getAsset(`${prefix}${frame}`);
      sequence.push(frame);
      positions.push([x, y]);
      if (img) {
        if (exitDirection === 'left' && x + img.width <= 0) break;
        if (exitDirection === 'right' && x >= this.bgWidth) break;
      }
      x += deltas[guard % deltas.length];
      guard++;
    }
    return {
      prefix,
      sequence,
      positions,
      x: positions[0]?.[0] ?? startX,
      y,
      layer: layer || 'behindAlex',
      rate: 2,
      tick: 0,
      index: 0,
    };
  }

  _normalizeFormValue(value) {
    return (value || '').trim().replace(/\s+/g, ' ');
  }

  _openFormReminderNote(sectionId) {
    if (!this.modal || this.modal.type !== 'form') return;
    const returnModal = this.modal;
    const textRef = AIRPORT_RESOURCES.textRefBySection[sectionId];
    if (!textRef) return;
    this._openTextRefRecord(textRef, { sectionId, returnModal });
  }

  _afterApplyRouteStateOverrides() {
    this._applyAirportBoardMode();
  }

  _applyDebugRouteOverrides() {
    const debug = this.route.debug || {};
    if (Number.isFinite(debug.alexX)) this.alexX = debug.alexX;
    if (Number.isFinite(debug.alexY)) this.alexY = debug.alexY;
    if (Number.isFinite(debug.alexDir)) this.alexDir = debug.alexDir;
  }

  _maybeArmFamilyQueueClear() {
    if (this.state?.familyQueue !== 'queued') return;
    if (this.state?.familyQueuePendingClear !== true) return;
    if (this._pendingDelayTicks > 0) return;
    if (!this._isInsideRect(this.alexX, this.alexY, this.familyQueueWaitZone)) return;
    if (this.actionQueue.some((step) => step.type === 'event' && step.id === 'familyQueue.clear')) return;
    if (this._sceneAnimation?.prefix === 'FAMGO') return;
    this._enqueueSteps([
      { type: 'delay', ticks: 90 },
      { type: 'event', id: 'familyQueue.clear' },
    ]);
    this._processActionQueue();
  }

  _getInteractionRect(interaction) {
    if (interaction.object) {
      const obj = this.objectByName?.[interaction.object];
      if (!obj?.visible) return null;
      const spriteName = interaction.sprite || obj?.sprite;
      const img = spriteName ? this.engine.getAsset(spriteName) : null;
      if (obj && img) {
        const pad = interaction.pad || [0, 0, 0, 0];
        return [obj.x + pad[0], obj.y + pad[1], obj.x + img.width + pad[2], obj.y + img.height + pad[3]];
      }
    }
    return interaction.rect || null;
  }


  _playOneShotSound(name) {
    if (!name || this.engine.isAudioLocked?.()) return;
    this.engine.playSound?.(name);
  }

  _isObjectVisibleOnScreen(obj, spriteName = obj?.sprite) {
    if (this.modal) return false;
    if (!obj?.visible || !spriteName) return false;
    const img = this.engine.getAsset(spriteName);
    if (!img) return false;
    const drawY = (obj.anim && obj.anim.bottomAlign) ? obj.anim.bottomAlign - img.height : obj.y;
    const x1 = obj.x - this.scrollX;
    const x2 = x1 + img.width;
    const y1 = drawY;
    const y2 = y1 + img.height;
    return x2 > 0 && x1 < WIDTH && y2 > 0 && y1 < HEIGHT;
  }

  _onObjectFrameAdvanced(obj, frameNum) {
    if (obj.name === 'Achu' && frameNum === 3 && this._isObjectVisibleOnScreen(obj, obj.sprite)) {
      this._playOneShotSound('SDACHU1');
    }
  }


  _startEntrySequenceIfNeeded() {
    const shouldRun = AIRPORT_SCENE_DEFINITION.route.shouldRunEntrySequence?.(this.route);
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

  _requestTransition(target) {
    if (!target) return;
    if (target.scene === 'stripair') {
      super._requestTransition({
        ...target,
        state: buildStripAirCarryState(this.state),
      });
      return;
    }
    super._requestTransition(target);
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

  _applyAirportBoardMode() {
    const mode = this.state?.airportBoardMode === 'departures' ? 'departures' : 'arrivals';
    const arrive = this.objectByName?.Arrive;
    const depart = this.objectByName?.Depart;
    const trup = this.objectByName?.Trup;
    const staffB = this.objectByName?.StaffB;
    const stairs = this.objectByName?.Stairs;
    if (arrive) arrive.visible = mode === 'arrivals';
    if (depart) depart.visible = mode === 'departures';
    if (trup) trup.visible = false;
    if (staffB) staffB.visible = false;
    this.stairsFrame = mode === 'departures' ? 6 : 1;
    if (stairs) stairs.sprite = `STAIRS${this.stairsFrame}`;
  }
}
