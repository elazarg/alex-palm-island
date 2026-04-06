import { resolveInteractionMode } from '../../ui/action-modes.js';
import { createMeterAnimationState } from '../../ui/meter-animation.js';
import { renderPanel } from '../../ui/panel-renderer.js';
import { GameScene } from '../../runtime/game-scene.js';
import { buildStripAirCarryState, stripAirHasBag } from './state.js';
import { STRIPAIR_SCENE_DEFINITION } from './definition.js';
import {
  STRIPAIR_ALEX_DEPTH_SCALE,
  STRIPAIR_ENTRY_TARGET,
  STRIPAIR_NAVIGATION_GRAPH,
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

export class StripAirScene extends GameScene {
  constructor(options = {}) {
    super({
      definition: STRIPAIR_SCENE_DEFINITION,
    });
    this.route = STRIPAIR_SCENE_DEFINITION.route.normalize(options.route || {});
    this.alexDepthScale = STRIPAIR_ALEX_DEPTH_SCALE;
    this.idleUsesFacingDirection = true;
    this.navigationGraph = STRIPAIR_NAVIGATION_GRAPH;
    this.walkZones = STRIPAIR_SCENE_DEFINITION.topology.walkZones;
    this.walkMasks = STRIPAIR_SCENE_DEFINITION.topology.walkMasks;
    this.walkMaskPolygons = STRIPAIR_SCENE_DEFINITION.topology.walkMaskPolygons;
    this.roadPolygon = getStripAirRoadPolygon();
  }

  init() {
    const { behind, front } = STRIPAIR_SCENE_DEFINITION.createObjects();
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
    this._sceneAnimation = null;

    this.initScriptRuntime();
    this._applyRouteStateOverrides();
    this.meterAnimation = createMeterAnimationState(this.state?.palmettoes ?? 100);
    this._setInputMode('walk');
    this._openInitialRouteScreen();
    this._publishRoute();
  }

  onMouseDown({ x, y }) {
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
          bag: this._getBagButtonState(),
          map: this._getMapButtonState(),
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
    super._afterStateChanged(key);
  }

  _tickObjects() {
    super._tickObjects();
  }

  _getInteractionRect(interaction) {
    return interaction.rect || resolveStripAirSemanticRect(interaction.id);
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
