const AIRPORT_STATE_KEYS = Object.freeze([
  'bagSize',
  'bagColor',
  'correctBag',
  'bagReceived',
  'passportChecked',
  'palmettoes',
  'doorWarnings',
  'clerkRepeatCount',
]);

function parseBooleanFlag(value) {
  if (value == null) return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return null;
}

export function normalizeAirportRouteState(state = {}) {
  const normalized = {};
  if (state.bagSize && ['big', 'medium', 'small'].includes(state.bagSize)) normalized.bagSize = state.bagSize;
  if (state.bagColor && ['grey', 'purple', 'pink'].includes(state.bagColor)) normalized.bagColor = state.bagColor;
  for (const key of ['correctBag', 'bagReceived', 'passportChecked']) {
    if (typeof state[key] === 'boolean') normalized[key] = state[key];
  }
  for (const key of ['palmettoes', 'doorWarnings', 'clerkRepeatCount']) {
    if (Number.isFinite(state[key])) normalized[key] = state[key];
  }
  return normalized;
}

function parseAirportRouteState(params) {
  const state = {};
  const bagSize = params.get('bagSize');
  if (bagSize && ['big', 'medium', 'small'].includes(bagSize)) state.bagSize = bagSize;
  const bagColor = params.get('bagColor');
  if (bagColor && ['grey', 'purple', 'pink'].includes(bagColor)) state.bagColor = bagColor;
  for (const key of ['correctBag', 'bagReceived', 'passportChecked']) {
    const parsed = parseBooleanFlag(params.get(key));
    if (parsed != null) state[key] = parsed;
  }
  for (const key of ['palmettoes', 'doorWarnings', 'clerkRepeatCount']) {
    const parsed = Number(params.get(key));
    if (Number.isFinite(parsed)) state[key] = parsed;
  }
  return normalizeAirportRouteState(state);
}

function serializeAirportRouteState(state = {}) {
  const params = new URLSearchParams();
  const normalized = normalizeAirportRouteState(state);
  if (normalized.bagSize) params.set('bagSize', normalized.bagSize);
  if (normalized.bagColor) params.set('bagColor', normalized.bagColor);
  if (typeof normalized.correctBag === 'boolean') params.set('correctBag', normalized.correctBag ? '1' : '0');
  if (normalized.bagReceived) params.set('bagReceived', '1');
  if (normalized.passportChecked) params.set('passportChecked', '1');
  if (Number.isFinite(normalized.palmettoes) && normalized.palmettoes !== 100) params.set('palmettoes', String(normalized.palmettoes));
  if (Number.isFinite(normalized.doorWarnings) && normalized.doorWarnings > 0) params.set('doorWarnings', String(normalized.doorWarnings));
  if (Number.isFinite(normalized.clerkRepeatCount) && normalized.clerkRepeatCount > 0) params.set('clerkRepeatCount', String(normalized.clerkRepeatCount));
  return params;
}

export function parseRouteHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/logo';
  const [pathPart, queryPart = ''] = raw.split('?', 2);
  const segments = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart);

  if (!segments.length || segments[0] === 'logo') return { scene: 'logo' };
  if (segments[0] === 'menu') return { scene: 'menu' };
  if (segments[0] === 'intro') return { scene: 'intro', part: segments[1] || null };
  if (segments[0] === 'arrest') {
    const reasonCode = Number(segments[1]);
    return { scene: 'arrest', reasonCode: Number.isFinite(reasonCode) ? reasonCode : 503 };
  }
  if (segments[0] === 'prison') {
    const reasonCode = Number(segments[1]);
    return { scene: 'prison', reasonCode: Number.isFinite(reasonCode) ? reasonCode : 503 };
  }
  if (segments[0] === 'airport') {
    const route = {
      scene: 'airport',
      view: 'scene',
      dialogId: null,
      formId: null,
      resourceSectionId: null,
      state: parseAirportRouteState(params),
    };
    if (segments[1] === 'dialog' && segments[2]) {
      route.view = 'dialog';
      route.dialogId = segments[2];
    } else if (segments[1] === 'form') {
      route.view = 'form';
      route.formId = segments[2] || 'lostAndFoundForm';
    } else if (segments[1] === 'resource' && segments[2]) {
      const sectionId = Number(segments[2]);
      route.view = 'resource';
      route.resourceSectionId = Number.isFinite(sectionId) ? sectionId : null;
    }
    return route;
  }
  return { scene: 'logo' };
}

export function formatRouteHash(route) {
  if (!route || !route.scene) return '#/logo';
  const scene = route.scene;
  if (scene === 'logo' || scene === 'menu') return `#/${scene}`;
  if (scene === 'intro') return route.part ? `#/intro/${route.part}` : '#/intro';
  if ((scene === 'arrest' || scene === 'prison') && Number.isFinite(route.reasonCode)) {
    return `#/${scene}/${route.reasonCode}`;
  }
  if (scene === 'airport') {
    let path = '#/airport';
    if (route.view === 'dialog' && route.dialogId) path += `/dialog/${route.dialogId}`;
    else if (route.view === 'form') path += `/form/${route.formId || 'lostAndFoundForm'}`;
    else if (route.view === 'resource' && Number.isFinite(route.resourceSectionId)) path += `/resource/${route.resourceSectionId}`;
    const params = serializeAirportRouteState(route.state);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }
  return '#/logo';
}

export function routeCacheKey(route) {
  return formatRouteHash(route);
}

export function airportRouteStateKeys() {
  return [...AIRPORT_STATE_KEYS];
}
