import { WIDTH, HEIGHT, computeLinearDepthScale } from '../../core/engine.js';
import { resolveInteractionMode } from '../../ui/action-modes.js';
import { createMeterAnimationState, startMeterAmountAnimation, tickMeterAnimation } from '../../ui/meter-animation.js';
import { renderPanel } from '../../ui/panel-renderer.js';
import { findNearestWalkablePoint, findPathOnGrid, pointInPolygon } from '../../runtime/navigation-graph.js';
import { GLOBAL_SOUND_MANIFEST } from '../../runtime/global-resources.js';
import { GameScene } from '../../runtime/game-scene.js';
import { buildNarrationSoundManifest } from '../../runtime/scx-sound-manifest.js';
import {
  buildStripAirRouteFromRuntime,
  normalizeStripAirRoute,
  resolveStripAirInitialScreen,
  shouldRunStripAirEntrySequence,
} from './route.js';
import { STRIPAIR_RESOURCES } from './resources.js';
import { STRIPAIR_SCRIPT } from './script.js';
import { buildStripAirCarryState, stripAirHasBag } from './state.js';
import {
  STRIPAIR_ALEX_DEPTH_SCALE,
  STRIPAIR_DIALOG_RESPONSE_DELAY_TICKS,
  STRIPAIR_DOOR_ENTRY_ANIMATION,
  STRIPAIR_ENTRY_START,
  STRIPAIR_ENTRY_TARGET,
  STRIPAIR_NAVIGATION_GRAPH,
  STRIPAIR_SOUND_MANIFEST,
  STRIPAIR_WALK_ZONES,
  buildAssetManifest,
  createStripAirObjects,
} from './content.js';
import { STRIPAIR_ENTITIES } from './semantics.js';
import { STRIPAIR_ACTIVE_INTERACTIONS } from './theme-2d.js';
import { STRIPAIR_STATIC_REGIONS, getStripAirRoadPolygon, resolveStripAirRegionRect, resolveStripAirSemanticRect } from './topology.js';

const DEBUG_ENTITY_COLORS = Object.freeze({
  npc: '#ff4d4d',
  prop: '#4db8ff',
  traversal: '#ffd24d',
  sign: '#66e08a',
});
const DEBUG_REGION_COLORS = Object.freeze({
  walkMask: '#ff2d55',
  interactiveZone: '#2ec4ff',
  exitTrigger: '#ffcc00',
  walkTarget: '#00d084',
  unclassified: '#999999',
});
const STRIPAIR_NARRATION_SOUND_MANIFEST = buildNarrationSoundManifest(STRIPAIR_RESOURCES);

export class StripAirScene extends GameScene {
  constructor(options = {}) {
    super({
      sceneScript: STRIPAIR_SCRIPT,
      dialogResponseDelayTicks: STRIPAIR_DIALOG_RESPONSE_DELAY_TICKS,
    });
    this.route = normalizeStripAirRoute(options.route || {});
    this.alexDepthScale = STRIPAIR_ALEX_DEPTH_SCALE;
    this.navigationGraph = STRIPAIR_NAVIGATION_GRAPH;
    this.walkZones = STRIPAIR_WALK_ZONES;
    this.walkMasks = STRIPAIR_STATIC_REGIONS
      .filter((region) => region.kind === 'walkMask')
      .map((region) => region.rect)
      .filter(Boolean);
    this.walkMaskPolygons = STRIPAIR_STATIC_REGIONS
      .filter((region) => region.kind === 'walkMaskPolygon')
      .map((region) => region.polygon)
      .filter(Boolean);
    this.roadPolygon = getStripAirRoadPolygon();
  }

  _buildAssetManifest() { return buildAssetManifest(); }
  _buildSoundManifest() { return { ...STRIPAIR_SOUND_MANIFEST, ...STRIPAIR_NARRATION_SOUND_MANIFEST, ...GLOBAL_SOUND_MANIFEST }; }
  _getResources() { return STRIPAIR_RESOURCES; }
  _buildCurrentRoute() { return buildStripAirRouteFromRuntime({ modal: this.modal, state: this.state, initial: false }); }

  init() {
    const { behind, front } = createStripAirObjects();
    this.objectsBehind = [...behind];
    this.objectsFront = [...front];
    this.sceneObjects = [...this.objectsBehind, ...this.objectsFront];
    this.objectByName = Object.fromEntries(this.sceneObjects.map((obj) => [obj.name, obj]));

    this.bgWidth = this.engine.getAsset('SCENE_BG')?.width || WIDTH;
    this.scrollX = 0;
    this.alexX = STRIPAIR_ENTRY_TARGET.x;
    this.alexY = STRIPAIR_ENTRY_TARGET.y;
    this.alexDir = STRIPAIR_ENTRY_TARGET.dir;
    this.alexFrame = 1;
    this.alexWalking = false;
    this.alexTargetX = 0;
    this.alexTargetY = 0;
    this.alexStepTick = 0;
    this.alexWalkCycleIdx = 0;
    this.alexIdleTick = 0;
    this.alexPath = [];
    this.inputMode = 'walk';
    this.selectedItem = null;
    this.uiTick = 0;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
    this._pressedInventoryControlMode = null;
    this._entrySequence = null;
    this._sceneAnimation = null;

    this.initScriptRuntime();
    this._applyRouteStateOverrides();
    this.meterAnimation = createMeterAnimationState(this.state?.palmettoes ?? 100);
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
    if (this.actionQueue.length) return;
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
    const target = this._closestWalkablePoint(worldX, worldY);
    if (!target) return;
    this._walkTo(target.x, target.y);
  }


  tick() {
    this.uiTick++;
    this._tickWalk();
    this._tickObjects();
    this.tickScriptRuntime();
  }

  render(ctx) {
    const bg = this.engine.getAsset('SCENE_BG');
    if (bg) ctx.drawImage(bg, 0, 0);
    for (const obj of this.objectsBehind) this._renderObject(ctx, obj);
    this._renderSceneAnimation(ctx);
    this._renderAlex(ctx);
    for (const obj of this.objectsFront) this._renderObject(ctx, obj);
    this.renderScriptModal(ctx, this.font, this.uiTick);

    const suppressPanel = this.modal?.presentation === 'resource' || this.modal?.type === 'inventory';
    if (!suppressPanel) {
      renderPanel(ctx, {
        assets: this.engine.assets,
        mouseY: this.engine.mouseY,
        modalOpen: Boolean(this.modal),
        buttons: this.uiButtons,
        pressedMode: this._pressedButtonMode,
        amount: this.state?.palmettoes ?? 100,
        buttonStates: {
          bag: stripAirHasBag(this.state) ? 'active' : 'covered',
          map: this.state?.map === true ? 'active' : 'covered',
        },
        inputMode: this.inputMode,
        layout: this.panelLayout,
        moneyAnimation: this.meterAnimation,
      });
    }
  }

  applyRoute(route) {
    this.route = normalizeStripAirRoute(route);
    this._applyRouteStateOverrides();
    this._openInitialRouteScreen();
    this._publishRoute();
  }

  _getDebugStaticRegions() {
    return STRIPAIR_STATIC_REGIONS
      .filter((region) => region.rect || region.polygon)
      .map((region) => ({
        id: region.id,
        rect: region.rect || null,
        polygon: region.polygon || null,
        color: DEBUG_REGION_COLORS[region.kind] || '#ffffff',
      }));
  }

  _getDebugActiveInteractions() {
    return STRIPAIR_ACTIVE_INTERACTIONS.map((interaction) => {
      const kind = STRIPAIR_ENTITIES[interaction.id]?.kind || 'prop';
      return { ...interaction, _debugColor: DEBUG_ENTITY_COLORS[kind] || '#ffffff' };
    });
  }

  _afterStateChanged(key) {
    if (key === 'palmettoes') {
      startMeterAmountAnimation(
        this.meterAnimation,
        this.meterAnimation?.amount ?? STRIPAIR_SCRIPT.initialState?.palmettoes ?? 100,
        this.state?.palmettoes ?? 100,
        this.panelLayout,
      );
    }
    this._publishRoute();
  }

  _renderObject(ctx, obj) {
    if (!obj.visible) return;
    const img = this.engine.getAsset(obj.sprite);
    if (!img) return;
    if (obj.sourceRect) {
      const { x, y, w, h } = obj.sourceRect;
      ctx.drawImage(img, x, y, w, h, obj.x, obj.y, w, h);
      return;
    }
    ctx.drawImage(img, obj.x, obj.y);
  }

  _renderAlex(ctx) {
    if (this._entrySequence?.phase === 'opening') return;
    const spriteDir = this.alexDir;
    const spriteName = `ALEX${spriteDir}-${this.alexFrame}`;
    const img = this.engine.getAsset(spriteName);
    if (!img) return;
    // Empirical approximation from original StripAir captures. We recovered
    // the scene's Y-range bounds from the original code, but not the exact
    // runtime scaling implementation, so keep this scene-local and explicit.
    const scale = computeLinearDepthScale(this.alexY, this.alexDepthScale);
    const dw = Math.round(img.width * scale);
    const dh = Math.round(img.height * scale);
    const screenX = this.alexX - dw / 2;
    const screenY = this.alexY - dh;
    ctx.drawImage(img, Math.round(screenX), Math.round(screenY), dw, dh);
  }

  _renderSceneAnimation(ctx) {
    if (!this._sceneAnimation) return;
    const frame = this._sceneAnimation.sequence[this._sceneAnimation.index];
    const img = this.engine.getAsset(`${this._sceneAnimation.prefix}${frame}`);
    if (img) ctx.drawImage(img, this._sceneAnimation.x, this._sceneAnimation.y);
  }

  _tickWalk() {
    if (!this.alexWalking) {
      this.alexIdleTick = (this.alexIdleTick + 1) % 72;
      this.alexFrame = (this.alexIdleTick === 24 || this.alexIdleTick === 25) ? 0 : 1;
      if (this._entrySequence?.phase === 'walk') this._entrySequence = null;
      return;
    }
    this.alexStepTick++;
    if (this.alexStepTick < 2) return;
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
      if (this.alexPath.length) {
        const next = this.alexPath.shift();
        this._startWalk(next.x, next.y, { preservePath: true });
      } else {
        this.alexWalking = false;
        this.alexFrame = 1;
        this.alexIdleTick = 0;
        if (this._entrySequence?.phase === 'walk') {
          this._entrySequence.phase = 'closing';
          this._startDoorEntryAnimation('closing');
          return;
        }
        this._processActionQueue();
      }
      return;
    }
    const newX = this.alexX + delta.dx;
    const newY = this.alexY + delta.dy;
    if (this._inWalkZone(newX, newY)) {
      this.alexX = newX;
      this.alexY = newY;
    } else {
      this.alexPath = [];
      this.alexWalking = false;
      this.alexFrame = 1;
      this.alexIdleTick = 0;
      this._processActionQueue();
    }
  }

  _tickObjects() {
    tickMeterAnimation(this.meterAnimation);
    for (const obj of this.sceneObjects) {
      if (!obj.anim?.sequence) continue;
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
    if (this._sceneAnimation) {
      const anim = this._sceneAnimation;
      anim.tick++;
      if (anim.tick >= anim.rate) {
        anim.tick = 0;
        anim.index++;
        if (anim.index >= anim.sequence.length) {
          if (anim.holdLastFrame) {
            anim.index = anim.sequence.length - 1;
            anim.holdLastFrame = false;
            if (this._entrySequence?.phase === 'opening') {
              this._entrySequence.phase = 'walk';
              this._startWalk(STRIPAIR_ENTRY_TARGET.x, STRIPAIR_ENTRY_TARGET.y);
            }
          } else {
            this._sceneAnimation = null;
            if (this._entrySequence?.phase === 'closing') {
              this._entrySequence = null;
            }
          }
        }
      }
    }
    if (this._entrySequence?.phase === 'opening' && !this._sceneAnimation) {
      this._startDoorEntryAnimation('opening');
    }
  }

  _handleInteractionAction(action) {
    if (!action) return;
    if (this.inputMode === 'item') {
      this._queueEvent('bagDefault');
      return;
    }
    if (action.kind === 'flow') {
      this._queueEvent(action.id);
      return;
    }
    if (action.kind === 'textRef') {
      this._openTextRefSection(action.sectionId);
    }
  }

  _applyRouteStateOverrides() {
    const overrides = this.route.state || {};
    for (const [key, value] of Object.entries(overrides)) {
      this.state[key] = value;
    }
  }

  _getInteractionRect(interaction) {
    return interaction.rect || resolveStripAirSemanticRect(interaction.id);
  }

  _startWalk(x, y, options = {}) {
    super._startWalk(x, y);
    if (!options.preservePath) this.alexPath = [];
  }

  _walkTo(x, y, options = {}) {
    const goal = { x, y };
    const path = findPathOnGrid(
      { x: this.alexX, y: this.alexY },
      goal,
      (px, py) => this._inWalkZone(px, py),
      {
        width: WIDTH,
        height: HEIGHT,
        cellSize: 8,
        canTraverseSegment: (from, to) => this._canWalkSegment(from, to),
      },
    );
    const [first, ...rest] = path.length ? path : [goal];
    this.alexPath = rest;
    this._startWalk(first.x, first.y, { preservePath: true });
  }

  _walkThenEvent(x, y, steps) {
    this._startWalk(x, y);
    this.actionQueue.unshift(...(Array.isArray(steps) ? steps : [steps]).map((step) => ({ ...step })));
  }

  _isScriptBusy() {
    return this.alexWalking || Boolean(this._entrySequence);
  }

  _inWalkZone(x, y) {
    const inBaseZone = this.walkZones.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2);
    if (!inBaseZone) return false;
    if (this.walkMasks.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2)) return false;
    if (this.walkMaskPolygons.some((polygon) => pointInPolygon({ x, y }, polygon))) return false;
    return true;
  }

  _closestWalkablePoint(x, y) {
    const point = findNearestWalkablePoint(
      { x, y },
      (px, py) => this._inWalkZone(px, py),
      { width: WIDTH, height: HEIGHT, step: 2, maxRadius: 220 },
    );
    return this._inWalkZone(point.x, point.y) ? point : null;
  }

  _canWalkSegment(from, to) {
    let x = from.x;
    let y = from.y;
    let walkCycleIdx = 0;
    for (let safety = 0; safety < 512; safety++) {
      const dir = this._calcDirection(x, y, to.x, to.y);
      const cycle = this.walkFrameCycles[dir] || [1];
      const frame = cycle[walkCycleIdx % cycle.length];
      walkCycleIdx += 1;
      const delta = this.walkDeltas[dir]?.[frame] || { dx: 0, dy: 0 };
      const dist = Math.hypot(to.x - x, to.y - y);
      if (dist <= Math.max(Math.abs(delta.dx), Math.abs(delta.dy), 1)) return true;
      const nextX = x + delta.dx;
      const nextY = y + delta.dy;
      if (!this._inWalkZone(nextX, nextY)) return false;
      x = nextX;
      y = nextY;
    }
    return false;
  }

  _openInitialRouteScreen() {
    const screen = resolveStripAirInitialScreen(this.route);
    if (screen.kind === 'dialog') {
      this._openDialog(screen.id, { deferPromptSound: true });
      return;
    }
    if (screen.kind === 'message') {
      this._openMessage(screen.id);
      return;
    }
    if (screen.kind === 'inventory') {
      this._openInventory(screen.id);
      return;
    }
    if (screen.kind === 'resource') {
      this._openTextRefSection(screen.id);
    }
  }

  _startEntrySequenceIfNeeded() {
    if (!shouldRunStripAirEntrySequence(this.route)) return;
    this.alexX = STRIPAIR_ENTRY_TARGET.x;
    this.alexY = STRIPAIR_ENTRY_TARGET.y;
    this.alexDir = STRIPAIR_ENTRY_TARGET.dir;
    this._entrySequence = { kind: this.route.entry, phase: 'closing' };
    this._startDoorEntryAnimation('closing');
  }

  _startDoorEntryAnimation(kind = 'opening') {
    const sequence = kind === 'closing'
      ? [2, 3]
      : [2, 1];
    this._sceneAnimation = {
      prefix: STRIPAIR_DOOR_ENTRY_ANIMATION.prefix,
      sequence,
      x: STRIPAIR_DOOR_ENTRY_ANIMATION.x,
      y: STRIPAIR_DOOR_ENTRY_ANIMATION.y,
      rate: STRIPAIR_DOOR_ENTRY_ANIMATION.rate,
      tick: 0,
      index: 0,
      holdLastFrame: kind === 'opening',
      kind,
    };
  }

  _requestTransition(target) {
    if (!target) return;
    if (target.scene === 'strip0') {
      super._requestTransition({
        ...target,
        state: buildStripAirCarryState(this.state),
      });
      return;
    }
    super._requestTransition(target);
  }
}
