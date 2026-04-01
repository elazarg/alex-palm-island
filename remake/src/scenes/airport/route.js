import { parseAirportStateParams, pickAirportRouteState, serializeAirportStateParams } from './state.js';

function parseDebugNumber(params, key) {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : null;
}

export function defaultAirportRoute() {
  return {
    scene: 'airport',
    view: 'scene',
    dialogId: null,
    formId: null,
    resourceSectionId: null,
    state: parseAirportStateParams(new URLSearchParams()),
    debug: null,
  };
}

export function normalizeAirportRoute(route = {}) {
  const base = defaultAirportRoute();
  const normalized = {
    ...base,
    ...route,
    state: route.state ? pickAirportRouteState(route.state) : base.state,
    debug: route.debug ? { ...route.debug } : null,
  };
  if (normalized.view !== 'dialog') normalized.dialogId = null;
  if (normalized.view !== 'form') normalized.formId = null;
  if (normalized.view !== 'resource') normalized.resourceSectionId = null;
  if (normalized.view === 'form' && !normalized.formId) normalized.formId = 'lostAndFoundForm';
  if (normalized.view === 'resource' && !Number.isFinite(normalized.resourceSectionId)) normalized.view = 'scene';
  return normalized;
}

export function parseAirportRoute(segments = [], params = new URLSearchParams()) {
  const route = defaultAirportRoute();
  route.state = parseAirportStateParams(params);
  if (segments[0] === 'debug') {
    const debug = {};
    const alexX = parseDebugNumber(params, 'x');
    const alexY = parseDebugNumber(params, 'y');
    const alexDir = parseDebugNumber(params, 'dir');
    const noteSectionId = parseDebugNumber(params, 'note');
    if (alexX != null) debug.alexX = alexX;
    if (alexY != null) debug.alexY = alexY;
    if (alexDir != null) debug.alexDir = alexDir;
    if (noteSectionId != null) debug.noteSectionId = noteSectionId;
    route.debug = Object.keys(debug).length ? debug : null;
  }
  if (segments[0] === 'dialog' && segments[1]) {
    route.view = 'dialog';
    route.dialogId = segments[1];
  } else if (segments[0] === 'form') {
    route.view = 'form';
    route.formId = segments[1] || 'lostAndFoundForm';
  } else if (segments[0] === 'debug') {
    route.view = 'scene';
  } else if (segments[0] === 'resource' && segments[1]) {
    const sectionId = Number(segments[1]);
    if (Number.isFinite(sectionId)) {
      route.view = 'resource';
      route.resourceSectionId = sectionId;
    }
  }
  return normalizeAirportRoute(route);
}

export function formatAirportRoute(route = {}) {
  const normalized = normalizeAirportRoute(route);
  const segments = ['airport'];
  if (normalized.view === 'dialog' && normalized.dialogId) segments.push('dialog', normalized.dialogId);
  else if (normalized.view === 'form') segments.push('form', normalized.formId || 'lostAndFoundForm');
  else if (normalized.view === 'resource' && Number.isFinite(normalized.resourceSectionId)) segments.push('resource', String(normalized.resourceSectionId));
  return {
    segments,
    params: serializeAirportStateParams(normalized.state),
  };
}
