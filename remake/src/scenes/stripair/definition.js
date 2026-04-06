import { GLOBAL_SOUND_MANIFEST } from '../../runtime/global-resources.js';
import { buildNarrationSoundManifest } from '../../runtime/scx-sound-manifest.js';
import {
  buildStripAirRouteFromRuntime,
  normalizeStripAirRoute,
  resolveStripAirInitialScreen,
} from './route.js';
import { STRIPAIR_RESOURCES } from './resources.js';
import { STRIPAIR_SCRIPT } from './script.js';
import { splitStripAirStateLayers, stripAirHasBag } from './state.js';
import {
  STRIPAIR_DIALOG_RESPONSE_DELAY_TICKS,
  STRIPAIR_SOUND_MANIFEST,
  STRIPAIR_WALK_ZONES,
  buildAssetManifest,
  createStripAirObjects,
} from './content.js';
import { STRIPAIR_ACTIVE_INTERACTIONS } from './theme-2d.js';
import { STRIPAIR_STATIC_REGIONS } from './topology.js';

const STRIPAIR_NARRATION_SOUND_MANIFEST = buildNarrationSoundManifest(STRIPAIR_RESOURCES);

export const STRIPAIR_SCENE_DEFINITION = Object.freeze({
  id: 'stripair',
  script: STRIPAIR_SCRIPT,
  dialogResponseDelayTicks: STRIPAIR_DIALOG_RESPONSE_DELAY_TICKS,
  resources: STRIPAIR_RESOURCES,
  buildAssetManifest,
  buildSoundManifest: () => ({ ...STRIPAIR_SOUND_MANIFEST, ...STRIPAIR_NARRATION_SOUND_MANIFEST, ...GLOBAL_SOUND_MANIFEST }),
  createObjects: createStripAirObjects,
  interactions: STRIPAIR_ACTIVE_INTERACTIONS,
  route: Object.freeze({
    normalize: normalizeStripAirRoute,
    buildFromRuntime: buildStripAirRouteFromRuntime,
    resolveInitialScreen: resolveStripAirInitialScreen,
  }),
  state: Object.freeze({
    splitLayers: splitStripAirStateLayers,
    canOpenInventory: stripAirHasBag,
    canOpenMap: (layers) => layers.globalState.map === true,
    getBagButtonState: (layers) => (stripAirHasBag(layers.alexState) ? 'active' : 'covered'),
    getMapButtonState: (layers) => (layers.globalState.map === true ? 'active' : 'covered'),
  }),
  topology: Object.freeze({
    walkZones: STRIPAIR_WALK_ZONES,
    walkMasks: STRIPAIR_STATIC_REGIONS
      .filter((region) => region.kind === 'walkMask')
      .map((region) => region.rect)
      .filter(Boolean),
    conditionalWalkMasks: Object.freeze([]),
    walkMaskPolygons: STRIPAIR_STATIC_REGIONS
      .filter((region) => region.kind === 'walkMaskPolygon')
      .map((region) => region.polygon)
      .filter(Boolean),
  }),
});
