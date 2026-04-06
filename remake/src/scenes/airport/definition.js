import { GLOBAL_SOUND_MANIFEST } from '../../runtime/global-resources.js';
import { buildNarrationSoundManifest } from '../../runtime/scx-sound-manifest.js';
import { AIRPORT_SCRIPT } from './script.js';
import {
  buildAirportRouteFromRuntime,
  normalizeAirportRoute,
  resolveAirportInitialScreen,
  shouldRunAirportEntrySequence,
} from './route.js';
import { AIRPORT_RESOURCES } from './resources.js';
import { airportHasBag, splitAirportStateLayers } from './state.js';
import {
  DIALOG_RESPONSE_DELAY_TICKS,
  SOUND_MANIFEST,
  WALK_ZONES,
  buildAssetManifest,
  createAirportObjects,
} from './content.js';
import { AIRPORT_ACTIVE_INTERACTIONS } from './theme-2d.js';
import { AIRPORT_STATIC_REGIONS, resolveAirportRegionRect, resolveAirportSelectorRect } from './topology.js';

const AIRPORT_NARRATION_SOUND_MANIFEST = buildNarrationSoundManifest(AIRPORT_RESOURCES);

export const AIRPORT_SCENE_DEFINITION = Object.freeze({
  id: 'airport',
  script: AIRPORT_SCRIPT,
  dialogResponseDelayTicks: DIALOG_RESPONSE_DELAY_TICKS,
  resources: AIRPORT_RESOURCES,
  buildAssetManifest,
  buildSoundManifest: () => ({ ...SOUND_MANIFEST, ...AIRPORT_NARRATION_SOUND_MANIFEST, ...GLOBAL_SOUND_MANIFEST }),
  createObjects: createAirportObjects,
  interactions: AIRPORT_ACTIVE_INTERACTIONS,
  route: Object.freeze({
    normalize: normalizeAirportRoute,
    buildFromRuntime: buildAirportRouteFromRuntime,
    resolveInitialScreen: resolveAirportInitialScreen,
    shouldRunEntrySequence: shouldRunAirportEntrySequence,
  }),
  state: Object.freeze({
    splitLayers: splitAirportStateLayers,
    canOpenInventory: airportHasBag,
    canOpenMap: (layers) => layers.globalState.map === true,
    getBagButtonState: (layers) => (airportHasBag(layers.alexState) ? 'active' : 'covered'),
    getMapButtonState: (layers) => (
      layers.globalState.map === null
        ? 'hidden'
        : (layers.globalState.map === true ? 'active' : 'covered')
    ),
  }),
  topology: Object.freeze({
    walkZones: WALK_ZONES,
    walkMasks: AIRPORT_STATIC_REGIONS
      .filter((region) => region.kind === 'walkMask' && !region.activeWhen)
      .map((region) => resolveAirportRegionRect(region.id) || resolveAirportSelectorRect(region.selector))
      .filter(Boolean),
    conditionalWalkMasks: AIRPORT_STATIC_REGIONS
      .filter((region) => region.kind === 'walkMask' && region.activeWhen)
      .map((region) => ({
        rect: resolveAirportRegionRect(region.id) || resolveAirportSelectorRect(region.selector),
        when: region.activeWhen,
      }))
      .filter((entry) => entry.rect),
    walkMaskPolygons: Object.freeze([]),
  }),
});
