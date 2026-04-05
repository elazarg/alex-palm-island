import { ACTION_BUTTONS, CURSOR_HOTSPOTS } from '../ui/action-modes.js';
import { STANDARD_DIALOG_LAYOUT } from '../ui/dialog-layout.js';
import { STANDARD_NOTE_LAYOUT } from '../ui/note-layout.js';
import { STANDARD_PANEL_LAYOUT } from '../ui/panel-layout.js';
import { INVENTORY_ITEM_DEFS } from '../ui/inventory-items.js';
import { loadBitmapFont } from '../ui/font-loader.js';
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
  constructor({ sceneScript, dialogResponseDelayTicks = 0 } = {}) {
    super({
      sceneScript,
      dialogLayout: STANDARD_DIALOG_LAYOUT,
      noteLayout: STANDARD_NOTE_LAYOUT,
      dialogResponseDelayTicks,
    });
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

    this.font = null;
    this.objectByName = {};
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

  _buildAssetManifest() { throw new Error('_buildAssetManifest not implemented'); }
  _buildSoundManifest() { throw new Error('_buildSoundManifest not implemented'); }
  _getResources() { throw new Error('_getResources not implemented'); }
  _getInteractionRect(/* interaction */) { throw new Error('_getInteractionRect not implemented'); }
  _buildCurrentRoute() { throw new Error('_buildCurrentRoute not implemented'); }

  // --- Lifecycle ---

  destroy() {
    this._stopSound();
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
      if (button.mode === 'map') return this.state?.map !== null;
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

  _publishRoute() {
    if (typeof this.onRouteChange !== 'function') return;
    this.onRouteChange(this._buildCurrentRoute());
  }

  // --- Walk helpers ---

  _face(dir) {
    this.alexDir = dir;
    this.alexFrame = 1;
    this.alexIdleTick = 0;
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

  _isScriptBusy() {
    return this.alexWalking || Boolean(this._sceneAnimation) || Boolean(this._entrySequence);
  }

  /**
   * One frame of walk movement. Applies delta from walk tables, advances frame,
   * checks arrival. Returns true if still walking, false if arrived.
   * Called by each scene's _tickWalk.
   */
  _tickWalkStep() {
    if (!this.alexWalking) return false;
    const deltas = this.walkDeltas[this.alexDir];
    const cycles = this.walkFrameCycles[this.alexDir];
    if (!deltas || !cycles) {
      this.alexWalking = false;
      return false;
    }

    this.alexStepTick++;
    if (this.alexStepTick >= deltas.length) {
      this.alexStepTick = 0;
      this.alexWalkCycleIdx = (this.alexWalkCycleIdx + 1) % cycles.length;
      this.alexFrame = cycles[this.alexWalkCycleIdx];
    }
    const delta = deltas[this.alexStepTick];
    this.alexX += delta.dx;
    this.alexY += delta.dy;

    const dx = this.alexTargetX - this.alexX;
    const dy = this.alexTargetY - this.alexY;
    if (Math.abs(dx) <= 6 && Math.abs(dy) <= 6) {
      this.alexX = this.alexTargetX;
      this.alexY = this.alexTargetY;
      this.alexWalking = false;
      this.alexFrame = 1;
      this.alexIdleTick = 0;
      return false;
    }

    return true;
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
    return Array.isArray(this.state?.bag) && this.state.bag.length > 0;
  }

  _canOpenMap() {
    return this.state?.map === true;
  }
}
