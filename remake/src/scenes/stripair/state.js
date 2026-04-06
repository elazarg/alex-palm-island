import { splitStateLayers } from '../../runtime/state-model.js';
import {
  parseBooleanFlag,
  parseTriStateFlag,
  normalizeBagItems,
  normalizeFlagIds,
  normalizeInventoryItems,
  buildCarryState,
  normalizeReasonForComing,
} from '../../runtime/state-utils.js';

export { buildCarryState };

export const STRIPAIR_DEFAULT_STATE = Object.freeze({
  palmettoes: 100,
  bag: null,
  map: false,
  flags: Object.freeze([]),
  items: Object.freeze([]),
  reasonForComing: null,
  infoStandVisited: false,
  catConversationStage: 0,
});

export const STRIPAIR_STATE_KEYS = Object.freeze([
  'palmettoes',
  'bag',
  'map',
  'flags',
  'items',
  'reasonForComing',
  'infoStandVisited',
  'catConversationStage',
]);

export const STRIPAIR_ALEX_STATE_KEYS = Object.freeze([
  'palmettoes',
  'bag',
  'items',
]);

export const STRIPAIR_GLOBAL_STATE_KEYS = Object.freeze([
  'map',
  'flags',
  'reasonForComing',
]);

export const STRIPAIR_SCENE_STATE_KEYS = Object.freeze([
  'infoStandVisited',
  'catConversationStage',
]);


export function normalizeStripAirState(state = {}) {
  const normalized = { ...STRIPAIR_DEFAULT_STATE };
  if (Array.isArray(state.bag)) normalized.bag = normalizeBagItems(state.bag);
  if (state.map === null || typeof state.map === 'boolean') normalized.map = state.map ?? STRIPAIR_DEFAULT_STATE.map;
  if (Array.isArray(state.flags)) normalized.flags = normalizeFlagIds(state.flags);
  if (Array.isArray(state.items)) normalized.items = normalizeInventoryItems(state.items);
  normalized.reasonForComing = normalizeReasonForComing(state.reasonForComing);
  if (typeof state.infoStandVisited === 'boolean') normalized.infoStandVisited = state.infoStandVisited;
  if (Number.isFinite(state.palmettoes)) normalized.palmettoes = state.palmettoes;
  if (Number.isFinite(state.catConversationStage)) {
    normalized.catConversationStage = Math.max(0, Math.min(3, Math.trunc(state.catConversationStage)));
  }
  if (!normalized.bag?.length) normalized.bag = null;
  return normalized;
}

export function parseStripAirStateParams(params) {
  const state = {};
  const bag = params.get('bag');
  if (bag) state.bag = bag.split(',').map((item) => item.trim()).filter(Boolean);
  if (params.has('map')) state.map = parseTriStateFlag(params.get('map'));
  const flags = params.get('flags');
  if (flags) state.flags = flags.split(',').map((value) => Number(value)).filter(Number.isFinite);
  const items = params.get('items');
  if (items) state.items = items.split(',').map((value) => value.trim()).filter(Boolean);
  const reasonForComing = params.get('reasonForComing');
  if (reasonForComing) state.reasonForComing = reasonForComing;
  const infoStandVisited = parseBooleanFlag(params.get('infoStandVisited'));
  if (infoStandVisited != null) state.infoStandVisited = infoStandVisited;
  for (const key of ['palmettoes', 'catConversationStage']) {
    const raw = params.get(key);
    if (raw == null || raw === '') continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) state[key] = parsed;
  }
  return normalizeStripAirState(state);
}

export function serializeStripAirStateParams(state = {}) {
  const params = new URLSearchParams();
  const normalized = normalizeStripAirState(state);
  if (Number.isFinite(normalized.palmettoes) && normalized.palmettoes !== STRIPAIR_DEFAULT_STATE.palmettoes) {
    params.set('palmettoes', String(normalized.palmettoes));
  }
  if (normalized.bag?.length) params.set('bag', normalized.bag.join(','));
  if (normalized.map === true) params.set('map', 'true');
  else if (normalized.map === false) params.set('map', 'false');
  if (normalized.flags?.length) params.set('flags', normalized.flags.join(','));
  if (normalized.items?.length) params.set('items', normalized.items.join(','));
  if (normalized.reasonForComing) params.set('reasonForComing', normalized.reasonForComing);
  if (normalized.infoStandVisited) params.set('infoStandVisited', '1');
  if (normalized.catConversationStage > 0) params.set('catConversationStage', String(normalized.catConversationStage));
  return params;
}

export function pickStripAirRouteState(state = {}) {
  return normalizeStripAirState(
    Object.fromEntries(
      STRIPAIR_STATE_KEYS
        .filter((key) => state[key] != null)
        .map((key) => [key, state[key]])
    )
  );
}

export function splitStripAirStateLayers(state = {}) {
  const normalized = normalizeStripAirState(state);
  return splitStateLayers(normalized, {
    alexKeys: STRIPAIR_ALEX_STATE_KEYS,
    globalKeys: STRIPAIR_GLOBAL_STATE_KEYS,
    sceneKeys: STRIPAIR_SCENE_STATE_KEYS,
  });
}

export function stripAirHasBag(state = {}) {
  return (Array.isArray(state.items) && state.items.length > 0) || (Array.isArray(state.bag) && state.bag.length > 0);
}

export function buildStripAirCarryState(sourceState = {}) {
  const normalized = normalizeStripAirState(sourceState);
  return normalizeStripAirState(buildCarryState(normalized));
}
