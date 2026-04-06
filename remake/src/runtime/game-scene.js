import { ACTION_BUTTONS, CURSOR_HOTSPOTS, WHEEL_INPUT_MODES, resolveInteractionMode } from '../ui/action-modes.js';
import { STANDARD_DIALOG_LAYOUT } from '../ui/dialog-layout.js';
import { STANDARD_NOTE_LAYOUT } from '../ui/note-layout.js';
import { STANDARD_PANEL_LAYOUT } from '../ui/panel-layout.js';
import { INVENTORY_ITEM_DEFS } from '../ui/inventory-items.js';
import { startMeterAmountAnimation, tickMeterAnimation } from '../ui/meter-animation.js';
import { renderSceneDebugOverlay, renderSceneDebugText } from '../ui/scene-debug-overlay.js';
import { loadBitmapFont } from '../ui/font-loader.js';
import { computeLinearDepthScale, WIDTH, HEIGHT } from '../core/engine.js';
import { findNearestWalkablePoint, findPathOnGrid, pointInPolygon } from './navigation-graph.js';
import { ScriptedScene } from './script-runtime.js';
import { WALK_DELTAS, WALK_FRAME_CYCLES } from './walk-tables.js';

/**
 * GameScene: intermediate base class for interactive game scenes.
 *
 * Provides shared state initialization, asset loading, and pure utility
 * methods. Does NOT own lifecycle (tick/render/init) or input dispatch —
 * concrete scenes keep those.
 */
export class GameScene extends ScriptedScene {
  constructor({ definition = null, sceneScript, dialogResponseDelayTicks = 0 } = {}) {
    super({
      sceneScript: sceneScript || definition?.script,
      dialogLayout: STANDARD_DIALOG_LAYOUT,
      noteLayout: STANDARD_NOTE_LAYOUT,
      dialogResponseDelayTicks: dialogResponseDelayTicks || definition?.dialogResponseDelayTicks || 0,
    });
    this.definition = definition;
    this.walkDeltas = WALK_DELTAS;
    this.walkFrameCycles = WALK_FRAME_CYCLES;
    this.panelLayout = STANDARD_PANEL_LAYOUT;
    this.uiButtons = ACTION_BUTTONS;

    this.route = {};
    this.onRouteChange = null;

    this.inputMode = 'walk';
    this.pressedMode = null;
    this.selectedItem = null;

    this.alexX = 0;
    this.alexY = 0;
    this.alexDir = 2;
    this.alexFrame = 1;
    this.alexWalking = false;
    this.alexTargetX = 0;
    this.alexTargetY = 0;
    this.alexStepTick = 0;
    this.alexWalkCycleIdx = 0;
    this.alexIdleTick = 0;
    this.alexPath = [];
    this.idleUsesFacingDirection = false;

    this.scrollX = 0;
    this.walkZones = [];
    this.walkMasks = [];
    this.walkMaskPolygons = [];
    this.conditionalWalkMasks = [];

    this.font = null;
    this.objectByName = {};
    this.sceneObjects = [];
    this._frameCounts = {};
    this.debugOverlayHeld = false;
    this.meterAnimation = null;
  }

  // --- Asset loading (shared) ---

  async load(engine) {
    const { images, frameCounts } = this._buildAssetManifest();
    this._frameCounts = frameCounts;
    await engine.loadImages(images);
    await engine.loadSounds(this._buildSoundManifest());
    for (const [name, hotspot] of Object.entries(CURSOR_HOTSPOTS)) {
      engine.registerCursorHotspot(name, hotspot);
    }
    engine.registerCursorHotspot('PASSPORTICON', { x: 0, y: 0 });
    engine.registerCursorHotspot('LETTERICON', { x: 0, y: 0 });
    this.font = await loadBitmapFont();
  }

  // --- Abstract methods (concrete scenes must provide) ---

  _buildAssetManifest() {
    if (typeof this.definition?.buildAssetManifest === 'function') return this.definition.buildAssetManifest();
    throw new Error('_buildAssetManifest not implemented');
  }

  _buildSoundManifest() {
    if (typeof this.definition?.buildSoundManifest === 'function') return this.definition.buildSoundManifest();
    throw new Error('_buildSoundManifest not implemented');
  }

  _getResources() {
    if (this.definition?.resources) return this.definition.resources;
    throw new Error('_getResources not implemented');
  }

  _getInteractionRect(/* interaction */) { throw new Error('_getInteractionRect not implemented'); }
  _buildCurrentRoute() {
    if (typeof this.definition?.route?.buildFromRuntime === 'function') {
      return this.definition.route.buildFromRuntime({ modal: this.modal, state: this.state, initial: false });
    }
    throw new Error('_buildCurrentRoute not implemented');
  }

  // --- Abstract: debug overlay data (scenes override to provide entries) ---

  _getDebugStaticRegions() { return []; }
  _getDebugActiveInteractions() { return []; }
  _getDebugEntityKind(/* interaction */) { return 'prop'; }

  // --- Lifecycle ---

  destroy() {
    this._stopSound();
  }

  // --- Input handlers (shared) ---

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
    if (button.mode === 'bag') {
      if (this._canOpenInventory()) this._openInventory('bag');
      else this._queueEvent('bagMissing');
      return;
    }
    if (button.mode === 'map') {
      if (this._canOpenMap()) this._openMap();
      else this._queueEvent('mapMissing');
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
    if (this._entrySequence || this.modal) return;
    this.selectedItem = null;
    const currentIdx = WHEEL_INPUT_MODES.indexOf(this.inputMode);
    const nextIdx = ((currentIdx >= 0 ? currentIdx : 0) + (deltaY > 0 ? 1 : -1) + WHEEL_INPUT_MODES.length) % WHEEL_INPUT_MODES.length;
    this._setInputMode(WHEEL_INPUT_MODES[nextIdx]);
    originalEvent.preventDefault();
  }

  onKeyDown({ key, code, originalEvent }) {
    if (code === 'Backquote' || key === '`') {
      this.debugOverlayHeld = true;
      originalEvent.preventDefault();
      return;
    }
    if (this._handleStandardHotkeys({ key, originalEvent })) return;
    if (this._entrySequence || !this.modal) return;
    this._handleModalKeyDown(key, originalEvent);
  }

  _handleModalKeyDown(key, originalEvent) {
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
    if (key === 'Escape') {
      if (this.modal.type === 'dialog') {
        this._dismissDialogModal?.();
        originalEvent.preventDefault();
        return;
      }
      if (this.modal.type === 'message') {
        this._dismissMessageModal?.();
        originalEvent.preventDefault();
        return;
      }
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

  onKeyUp({ key, code, originalEvent }) {
    if (code === 'Backquote' || key === '`') {
      this.debugOverlayHeld = false;
      originalEvent.preventDefault();
    }
  }

  // --- Debug overlay (generic) ---

  renderOverlay(ctx, overlayMetrics) {
    if (!this.debugOverlayHeld) return;
    const entries = [];
    const toScreenRect = (rect) => this._projectOverlayRect(rect, overlayMetrics);
    const toScreenPolygon = (polygon) => this._projectOverlayPolygon(polygon, overlayMetrics);

    for (const region of this._getDebugStaticRegions()) {
      if (region.rect) {
        entries.push({
          rect: toScreenRect(region.rect),
          color: region.color || '#ffffff',
          label: region.id,
          fillAlpha: 0.22,
        });
      }
      if (region.polygon) {
        entries.push({
          polygon: toScreenPolygon(region.polygon),
          color: region.color || '#ffffff',
          label: region.id,
          fillAlpha: 0.22,
        });
      }
    }
    for (const interaction of this._getDebugActiveInteractions()) {
      const rect = this._getInteractionRect(interaction);
      if (!rect) continue;
      entries.push({
        rect: toScreenRect(rect),
        color: interaction._debugColor || '#ffffff',
        label: interaction.id,
        fillAlpha: 0.35,
      });
    }
    renderSceneDebugOverlay(ctx, entries);
    renderSceneDebugText(
      ctx,
      [
        `mouse: (${Math.round(this.engine.mouseX + this.scrollX)}, ${Math.round(this.engine.mouseY)})`,
        `alex: (${Math.round(this.alexX)}, ${Math.round(this.alexY)})`,
      ],
      { x: 8, y: 8 },
    );
  }

  _projectOverlayRect(rect, overlayMetrics) {
    const [x1, y1, x2, y2] = rect;
    const scaleX = overlayMetrics?.scaleX ?? 1;
    const scaleY = overlayMetrics?.scaleY ?? 1;
    return [
      (x1 - this.scrollX) * scaleX,
      y1 * scaleY,
      (x2 - this.scrollX) * scaleX,
      y2 * scaleY,
    ];
  }

  _projectOverlayPolygon(polygon, overlayMetrics) {
    const scaleX = overlayMetrics?.scaleX ?? 1;
    const scaleY = overlayMetrics?.scaleY ?? 1;
    return polygon.map((point) => ({
      x: (point.x - this.scrollX) * scaleX,
      y: point.y * scaleY,
    }));
  }

  // --- Cursor and input mode ---

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

  // --- UI helpers ---

  _getUiButton(mx, my) {
    if (this.modal || this.engine.mouseY < this.panelLayout.panel.revealY) return null;
    return this.uiButtons.find((button) => {
      if (!(mx >= button.x && mx <= button.x + button.w && my >= button.y && my <= button.y + button.h)) return false;
      if (button.mode === 'map') return this._getMapButtonState() !== 'hidden';
      return true;
    }) || null;
  }

  // --- Interaction lookup ---

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

  // --- Text refs ---

  _openTextRefSection(sectionId) {
    const resources = this._getResources();
    const textRef = resources.textRefBySection[sectionId];
    if (!textRef) return;
    this._openTextRefRecord(textRef, { sectionId });
  }

  // --- Inventory and map ---

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

  _openMap() {
    this._stopSound();
    this.modal = {
      id: 'worldMap',
      type: 'message',
      presentation: 'resource',
      asset: 'MAP',
      locked: false,
    };
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

  // --- Route publication ---

  _afterModalChanged() {
    this._publishRoute();
  }

  _afterStateChanged(key) {
    if (key === 'palmettoes' && this.meterAnimation) {
      startMeterAmountAnimation(
        this.meterAnimation,
        this.meterAnimation?.amount ?? this.sceneScript?.initialState?.palmettoes ?? 100,
        this.state?.palmettoes ?? 100,
        this.panelLayout,
      );
    }
    this._publishRoute();
  }

  _publishRoute() {
    if (typeof this.onRouteChange !== 'function') return;
    this.onRouteChange(this._buildCurrentRoute());
  }

  _getStateLayers(state = this.state) {
    if (typeof this.definition?.state?.splitLayers === 'function') {
      return this.definition.state.splitLayers(state);
    }
    return {
      alexState: state || {},
      globalState: {},
      sceneState: {},
    };
  }

  // --- Geometry helpers ---

  _isInsideRect(x, y, rect) {
    if (!rect) return false;
    const [x1, y1, x2, y2] = rect;
    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  }

  _matchesStateCondition(condition) {
    if (!condition?.state) return false;
    const value = this.state?.[condition.state];
    if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return value === condition.equals;
    if (Object.prototype.hasOwnProperty.call(condition, 'notEquals')) return value !== condition.notEquals;
    return false;
  }

  // --- Walk system ---

  _face(dir) {
    this.alexDir = dir;
    this.alexFrame = 1;
    this.alexIdleTick = 0;
  }

  _startWalk(x, y, options = {}) {
    this.alexTargetX = x;
    this.alexTargetY = y;
    this.alexWalking = true;
    this.alexFrame = 1;
    this.alexStepTick = 0;
    this.alexDir = this._calcDirection(this.alexX, this.alexY, x, y);
    this.alexWalkCycleIdx = 0;
    this.alexIdleTick = 0;
    if (!options.preservePath) this.alexPath = [];
  }

  _walkTo(x, y) {
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
    return this.alexWalking || Boolean(this._sceneAnimation) || Boolean(this._entrySequence);
  }

  _tickWalk() {
    if (!this.alexWalking) {
      this.alexIdleTick = (this.alexIdleTick + 1) % 72;
      this.alexFrame = (this.alexIdleTick === 24 || this.alexIdleTick === 25) ? 0 : 1;
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
        this._onWalkArrived();
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

  _onWalkArrived() {
    this._processActionQueue();
  }

  _inWalkZone(x, y) {
    const inBaseZone = this.walkZones.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2);
    if (!inBaseZone) return false;
    if (this.walkMasks.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2)) return false;
    if (this.walkMaskPolygons.some((polygon) => pointInPolygon({ x, y }, polygon))) return false;
    if (this.conditionalWalkMasks.some(({ rect, when }) => this._matchesStateCondition(when) && this._isInsideRect(x, y, rect))) return false;
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

  // --- Hotkey intent handling ---

  _handleHotkeyIntent(intent) {
    if (intent === 'walk' || intent === 'talk' || intent === 'look' || intent === 'touch') {
      this.selectedItem = null;
      this._setInputMode(intent);
      return true;
    }
    if (intent === 'inventory') {
      if (this._canOpenInventory()) this._openInventory('bag');
      else this._queueEvent('bagMissing');
      return true;
    }
    if (intent === 'map') {
      if (this._canOpenMap()) this._openMap();
      else this._queueEvent('mapMissing');
      return true;
    }
    return false;
  }

  _canOpenInventory() {
    const layers = this._getStateLayers();
    if (typeof this.definition?.state?.canOpenInventory === 'function') {
      return this.definition.state.canOpenInventory(layers.alexState, layers.globalState, layers.sceneState);
    }
    return Array.isArray(layers.alexState?.bag) && layers.alexState.bag.length > 0;
  }

  _canOpenMap() {
    const layers = this._getStateLayers();
    if (typeof this.definition?.state?.canOpenMap === 'function') {
      return this.definition.state.canOpenMap(layers);
    }
    return layers.globalState?.map === true;
  }

  _getBagButtonState() {
    const layers = this._getStateLayers();
    if (typeof this.definition?.state?.getBagButtonState === 'function') {
      return this.definition.state.getBagButtonState(layers);
    }
    return this._canOpenInventory() ? 'active' : 'covered';
  }

  _getMapButtonState() {
    const layers = this._getStateLayers();
    if (typeof this.definition?.state?.getMapButtonState === 'function') {
      return this.definition.state.getMapButtonState(layers);
    }
    return this._canOpenMap() ? 'active' : 'covered';
  }

  _applyRouteStateOverrides() {
    const overrides = this.route?.state || {};
    for (const [key, value] of Object.entries(overrides)) {
      this.state[key] = value;
    }
    this._applyBindings?.();
    this._afterApplyRouteStateOverrides?.();
  }

  _afterApplyRouteStateOverrides() {}

  _openInitialRouteScreen() {
    const screen = this.definition?.route?.resolveInitialScreen?.(this.route);
    if (!screen || screen.kind === 'scene') return;
    if (screen.kind === 'dialog') {
      this._openDialog(screen.id, { deferPromptSound: true });
      return;
    }
    if (screen.kind === 'message') {
      this._openMessage(screen.id);
      return;
    }
    if (screen.kind === 'form') {
      this._openForm(screen.id);
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

  applyRoute(route) {
    if (typeof this.definition?.route?.normalize === 'function') {
      this.route = this.definition.route.normalize(route);
    } else {
      this.route = route;
    }
    this._applyRouteStateOverrides();
    this._openInitialRouteScreen();
    this._publishRoute();
  }

  // --- Shared interaction dispatch ---

  _handleInteractionAction(action) {
    if (!action) return;
    if (this.inputMode === 'item') {
      if (this._handleItemInteractionAction?.(action)) return;
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

  // --- Shared object/render helpers ---

  _afterSceneAnimationAdvanced(/* anim */) {}

  _onObjectFrameAdvanced(/* obj, frameNum */) {}

  _tickObjects() {
    tickMeterAnimation(this.meterAnimation);
    for (const obj of this.sceneObjects) {
      if (obj.anim === 'stairs') continue;
      if (obj.overlay?.sequence) {
        if (obj._oTick == null) obj._oTick = 0;
        if (obj._oIdx == null) obj._oIdx = 0;
        obj._oTick++;
        if (obj._oTick >= obj.overlay.rate) {
          obj._oTick = 0;
          obj._oIdx = (obj._oIdx + 1) % obj.overlay.sequence.length;
        }
        continue;
      }
      if (!obj.anim?.sequence) continue;
      if (obj._animTick == null) obj._animTick = 0;
      if (obj._animIdx == null) obj._animIdx = 0;
      obj._animTick++;
      const frameRate = obj.anim.frameDurations?.[obj._animIdx] ?? obj.anim.rate;
      if (obj._animTick >= frameRate) {
        obj._animTick = 0;
        obj._animIdx = (obj._animIdx + 1) % obj.anim.sequence.length;
        const frameNum = obj.anim.sequence[obj._animIdx];
        obj.sprite = `${obj.anim.prefix}${frameNum}`;
        if (obj.anim.framePos?.[frameNum]) {
          obj.x = obj.anim.framePos[frameNum][0];
          obj.y = obj.anim.framePos[frameNum][1];
        }
        this._onObjectFrameAdvanced(obj, frameNum);
      }
    }
    if (this._sceneAnimation) {
      const anim = this._sceneAnimation;
      anim.tick++;
      if (anim.tick >= anim.rate) {
        anim.tick = 0;
        if (Array.isArray(anim.positions)) {
          const nextPos = anim.positions[Math.min(anim.index + 1, anim.positions.length - 1)];
          if (nextPos) {
            anim.x = nextPos[0];
            anim.y = nextPos[1];
          }
        }
        anim.index++;
        if (anim.index >= anim.sequence.length) {
          this._sceneAnimation = null;
          this._processActionQueue();
        } else {
          this._afterSceneAnimationAdvanced(anim);
        }
      }
    }
  }

  _renderObject(ctx, obj) {
    if (!obj.visible) return;
    const o2Active = obj.overlay2?.sequence && obj._o2Idx != null && obj.overlay2.sequence[obj._o2Idx] > 0;
    if (o2Active) {
      const frameNum = obj.overlay2.sequence[obj._o2Idx];
      const overlayImg = this.engine.getAsset(`${obj.overlay2.prefix}${frameNum}`);
      if (overlayImg) {
        ctx.drawImage(overlayImg, obj.x + obj.overlay2.ox - this.scrollX, obj.y + obj.overlay2.oy);
      }
      return;
    }
    const img = this.engine.getAsset(obj.sprite);
    if (!img) return;
    const drawX = obj.x - this.scrollX;
    const drawY = (obj.anim && obj.anim.bottomAlign) ? obj.anim.bottomAlign - img.height : obj.y;
    if (obj.sourceRect) {
      const { x, y, w, h } = obj.sourceRect;
      ctx.drawImage(img, x, y, w, h, drawX, drawY, w, h);
    } else {
      ctx.drawImage(img, drawX, drawY);
    }
    if (obj.overlay?.sequence && obj._oIdx != null) {
      const frameNum = obj.overlay.sequence[obj._oIdx];
      if (frameNum > 0) {
        const overlayImg = this.engine.getAsset(`${obj.overlay.prefix}${frameNum}`);
        if (overlayImg) ctx.drawImage(overlayImg, obj.x + obj.overlay.ox - this.scrollX, obj.y + obj.overlay.oy);
      }
    }
  }

  _renderAlex(ctx) {
    if (this._entrySequence?.renderDescendingOnly) return;
    const spriteDir = (this.alexWalking || this.idleUsesFacingDirection) ? this.alexDir : 1;
    const spriteName = `ALEX${spriteDir}-${this.alexFrame}`;
    const img = this.engine.getAsset(spriteName);
    if (!img) return;
    const scale = this.alexDepthScale
      ? computeLinearDepthScale(this.alexY, this.alexDepthScale)
      : null;
    const effectiveScale = Number.isFinite(scale) ? scale : 1;
    const dw = Math.round(img.width * effectiveScale);
    const dh = Math.round(img.height * effectiveScale);
    const screenX = this.alexX - this.scrollX - dw / 2;
    const screenY = this.alexY - dh;
    ctx.drawImage(img, Math.round(screenX), Math.round(screenY), dw, dh);
  }

  _renderSceneAnimation(ctx, layer = 'behindAlex') {
    if (!this._sceneAnimation) return;
    if ((this._sceneAnimation.layer || 'behindAlex') !== layer) return;
    const frame = this._sceneAnimation.sequence[this._sceneAnimation.index];
    const img = this.engine.getAsset(`${this._sceneAnimation.prefix}${frame}`);
    if (img) ctx.drawImage(img, this._sceneAnimation.x - this.scrollX, this._sceneAnimation.y);
  }
}
