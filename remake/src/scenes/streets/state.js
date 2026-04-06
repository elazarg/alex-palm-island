import { splitStateLayers } from '../../runtime/state-model.js';
import {
  buildCarryState,
  normalizeBagItems,
  normalizeFlagIds,
  normalizeInventoryItems,
  normalizeReasonForComing,
  parseTriStateFlag,
} from '../../runtime/state-utils.js';

export const STREET_DEFAULT_STATE = Object.freeze({
  palmettoes: 100,
  bag: null,
  map: false,
  flags: Object.freeze([]),
  items: Object.freeze([]),
  reasonForComing: null,
});

const STREET_ALEX_STATE_KEYS = Object.freeze(['palmettoes', 'bag', 'items']);
const STREET_GLOBAL_STATE_KEYS = Object.freeze(['map', 'flags', 'reasonForComing']);

export function normalizeStreetState(state = {}) {
  const normalized = { ...STREET_DEFAULT_STATE };
  if (Number.isFinite(state.palmettoes)) normalized.palmettoes = Math.max(0, Math.trunc(state.palmettoes));
  if (Array.isArray(state.bag)) normalized.bag = normalizeBagItems(state.bag);
  if (state.map === null || typeof state.map === 'boolean') normalized.map = state.map ?? STREET_DEFAULT_STATE.map;
  normalized.flags = normalizeFlagIds(state.flags);
  normalized.items = normalizeInventoryItems(state.items);
  normalized.reasonForComing = normalizeReasonForComing(state.reasonForComing);
  if (!normalized.bag?.length) normalized.bag = null;
  return normalized;
}

export function parseStreetStateParams(params) {
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
  const palmettoes = Number(params.get('palmettoes'));
  if (Number.isFinite(palmettoes)) state.palmettoes = palmettoes;
  return normalizeStreetState(state);
}

export function serializeStreetStateParams(state = {}) {
  const normalized = normalizeStreetState(state);
  const params = new URLSearchParams();
  if (normalized.palmettoes !== STREET_DEFAULT_STATE.palmettoes) params.set('palmettoes', String(normalized.palmettoes));
  if (normalized.bag?.length) params.set('bag', normalized.bag.join(','));
  if (normalized.map === true) params.set('map', 'true');
  else if (normalized.map === false) params.set('map', 'false');
  if (normalized.flags?.length) params.set('flags', normalized.flags.join(','));
  if (normalized.items?.length) params.set('items', normalized.items.join(','));
  if (normalized.reasonForComing) params.set('reasonForComing', normalized.reasonForComing);
  return params;
}

export function pickStreetRouteState(state = {}) {
  return normalizeStreetState({
    palmettoes: state.palmettoes,
    bag: state.bag,
    map: state.map,
    flags: state.flags,
    items: state.items,
    reasonForComing: state.reasonForComing,
  });
}

export function splitStreetStateLayers(state = {}) {
  const normalized = normalizeStreetState(state);
  return splitStateLayers(normalized, {
    alexKeys: STREET_ALEX_STATE_KEYS,
    globalKeys: STREET_GLOBAL_STATE_KEYS,
    sceneKeys: [],
  });
}

export function streetHasBag(state = {}) {
  return (Array.isArray(state.items) && state.items.length > 0) || (Array.isArray(state.bag) && state.bag.length > 0);
}

export function buildStreetCarryState(sourceState = {}) {
  return normalizeStreetState(buildCarryState(normalizeStreetState(sourceState)));
}
