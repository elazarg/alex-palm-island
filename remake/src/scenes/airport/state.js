export const AIRPORT_DEFAULT_STATE = Object.freeze({
  palmettoes: 100,
  bag: null,
  map: null,
  airportBoardMode: 'arrivals',
  familyQueue: 'not-arrived',
  familyQueuePendingClear: false,
  mayExit: false,
  exitWarningLevel: 0,
  clerkAnnoyanceLevel: 0,
  claimSize: null,
  claimColor: null,
  claimMatchesBag: false,
});

export const AIRPORT_STATE_KEYS = Object.freeze([
  'palmettoes',
  'bag',
  'map',
  'airportBoardMode',
  'familyQueue',
  'familyQueuePendingClear',
  'mayExit',
  'exitWarningLevel',
  'clerkAnnoyanceLevel',
  'claimSize',
  'claimColor',
  'claimMatchesBag',
]);

const BAG_ITEM_VALUES = Object.freeze(['passport', 'letter']);
const AIRPORT_BOARD_MODE_VALUES = Object.freeze(['arrivals', 'departures']);
const FAMILY_QUEUE_VALUES = Object.freeze(['not-arrived', 'queued', 'cleared']);

function parseBooleanFlag(value) {
  if (value == null) return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return null;
}

function parseTriStateFlag(value) {
  if (value == null || value === '') return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'null') return null;
  return null;
}

function normalizeBagItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item, index) => BAG_ITEM_VALUES.includes(item) && items.indexOf(item) === index);
}

export function normalizeAirportState(state = {}) {
  const normalized = { ...AIRPORT_DEFAULT_STATE };
  if (Array.isArray(state.bag)) normalized.bag = normalizeBagItems(state.bag);
  if (state.map === null || typeof state.map === 'boolean') normalized.map = state.map;
  if (state.airportBoardMode && AIRPORT_BOARD_MODE_VALUES.includes(state.airportBoardMode)) normalized.airportBoardMode = state.airportBoardMode;
  if (state.claimSize && ['big', 'medium', 'small'].includes(state.claimSize)) normalized.claimSize = state.claimSize;
  if (state.claimColor && ['grey', 'purple', 'pink'].includes(state.claimColor)) normalized.claimColor = state.claimColor;
  if (state.familyQueue && FAMILY_QUEUE_VALUES.includes(state.familyQueue)) normalized.familyQueue = state.familyQueue;
  for (const key of ['familyQueuePendingClear', 'mayExit', 'claimMatchesBag']) {
    if (typeof state[key] === 'boolean') normalized[key] = state[key];
  }
  for (const key of ['palmettoes', 'exitWarningLevel', 'clerkAnnoyanceLevel']) {
    if (Number.isFinite(state[key])) normalized[key] = state[key];
  }
  if (!normalized.bag?.length) normalized.bag = null;
  return normalized;
}

export function parseAirportStateParams(params) {
  const state = {};
  const bag = params.get('bag');
  if (bag) state.bag = bag.split(',').map((item) => item.trim()).filter(Boolean);
  if (params.has('map')) state.map = parseTriStateFlag(params.get('map'));
  const airportBoardMode = params.get('airportBoardMode');
  if (airportBoardMode && AIRPORT_BOARD_MODE_VALUES.includes(airportBoardMode)) state.airportBoardMode = airportBoardMode;
  const familyQueue = params.get('familyQueue');
  if (familyQueue && FAMILY_QUEUE_VALUES.includes(familyQueue)) state.familyQueue = familyQueue;
  const claimSize = params.get('claimSize');
  if (claimSize && ['big', 'medium', 'small'].includes(claimSize)) state.claimSize = claimSize;
  const claimColor = params.get('claimColor');
  if (claimColor && ['grey', 'purple', 'pink'].includes(claimColor)) state.claimColor = claimColor;
  for (const key of ['familyQueuePendingClear', 'mayExit', 'claimMatchesBag']) {
    const parsed = parseBooleanFlag(params.get(key));
    if (parsed != null) state[key] = parsed;
  }
  for (const key of ['palmettoes', 'exitWarningLevel', 'clerkAnnoyanceLevel']) {
    const raw = params.get(key);
    if (raw == null || raw === '') continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) state[key] = parsed;
  }
  return normalizeAirportState(state);
}

export function serializeAirportStateParams(state = {}) {
  const params = new URLSearchParams();
  const normalized = normalizeAirportState(state);
  if (Number.isFinite(normalized.palmettoes) && normalized.palmettoes !== AIRPORT_DEFAULT_STATE.palmettoes) params.set('palmettoes', String(normalized.palmettoes));
  if (normalized.bag?.length) params.set('bag', normalized.bag.join(','));
  if (normalized.map === true) params.set('map', 'true');
  else if (normalized.map === false) params.set('map', 'false');
  if (normalized.airportBoardMode !== AIRPORT_DEFAULT_STATE.airportBoardMode) params.set('airportBoardMode', normalized.airportBoardMode);
  if (normalized.familyQueue !== AIRPORT_DEFAULT_STATE.familyQueue) params.set('familyQueue', normalized.familyQueue);
  if (normalized.familyQueuePendingClear) params.set('familyQueuePendingClear', '1');
  if (normalized.mayExit) params.set('mayExit', '1');
  if (Number.isFinite(normalized.exitWarningLevel) && normalized.exitWarningLevel > 0) params.set('exitWarningLevel', String(normalized.exitWarningLevel));
  if (Number.isFinite(normalized.clerkAnnoyanceLevel) && normalized.clerkAnnoyanceLevel > 0) params.set('clerkAnnoyanceLevel', String(normalized.clerkAnnoyanceLevel));
  if (normalized.claimSize) params.set('claimSize', normalized.claimSize);
  if (normalized.claimColor) params.set('claimColor', normalized.claimColor);
  if (normalized.claimMatchesBag) params.set('claimMatchesBag', '1');
  return params;
}

export function pickAirportRouteState(state = {}) {
  return normalizeAirportState(
    Object.fromEntries(
      AIRPORT_STATE_KEYS
        .filter((key) => state[key] != null)
        .map((key) => [key, state[key]])
    )
  );
}

export function airportHasBag(state = {}) {
  return Array.isArray(state.bag) && state.bag.length > 0;
}

export function getAirportLostAndFoundExpectedValues(state = {}) {
  const normalized = normalizeAirportState(state);
  return [
    'Alex',
    'bag',
    ({ big: 'big', medium: 'medium-size', small: 'small' })[normalized.claimSize] || '',
    ({ grey: 'grey', purple: 'purple', pink: 'pink' })[normalized.claimColor] || '',
  ];
}
