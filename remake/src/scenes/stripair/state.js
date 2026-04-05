export const STRIPAIR_DEFAULT_STATE = Object.freeze({
  palmettoes: 100,
  bag: null,
  infoStandVisited: false,
  catConversationStage: 0,
});

export const STRIPAIR_STATE_KEYS = Object.freeze([
  'palmettoes',
  'bag',
  'infoStandVisited',
  'catConversationStage',
]);

const BAG_ITEM_VALUES = Object.freeze(['passport', 'letter']);

function parseBooleanFlag(value) {
  if (value == null) return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return null;
}

function normalizeBagItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item, index) => BAG_ITEM_VALUES.includes(item) && items.indexOf(item) === index);
}

export function normalizeStripAirState(state = {}) {
  const normalized = { ...STRIPAIR_DEFAULT_STATE };
  if (Array.isArray(state.bag)) normalized.bag = normalizeBagItems(state.bag);
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

export function stripAirHasBag(state = {}) {
  return Array.isArray(state.bag) && state.bag.length > 0;
}

export function buildStripAirCarryState(sourceState = {}) {
  const normalized = normalizeStripAirState(sourceState);
  return normalizeStripAirState({
    palmettoes: normalized.palmettoes,
    bag: normalized.bag,
  });
}
