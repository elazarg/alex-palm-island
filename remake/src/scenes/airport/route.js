import { parseAirportStateParams, pickAirportRouteState, serializeAirportStateParams } from './state.js';

function parseDebugNumber(params, key) {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : null;
}

export function defaultAirportRoute() {
  return {
    scene: 'airport',
    view: 'scene',
    initial: true,
    dialogId: null,
    messageId: null,
    formId: null,
    inventoryId: null,
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
    initial: route.initial === true,
    state: route.state ? pickAirportRouteState(route.state) : base.state,
    debug: route.debug ? { ...route.debug } : null,
  };
  if (normalized.view !== 'dialog') normalized.dialogId = null;
  if (normalized.view !== 'message') normalized.messageId = null;
  if (normalized.view !== 'form') normalized.formId = null;
  if (normalized.view !== 'inventory') normalized.inventoryId = null;
  if (normalized.view !== 'resource') normalized.resourceSectionId = null;
  if (normalized.view === 'form' && !normalized.formId) normalized.formId = 'lostAndFoundForm';
  if (normalized.view === 'resource' && !Number.isFinite(normalized.resourceSectionId)) normalized.view = 'scene';
  return normalized;
}

export function parseAirportRoute(segments = [], params = new URLSearchParams()) {
  const route = defaultAirportRoute();
  route.initial = params.get('initial') === '1';
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
  } else if (segments[0] === 'message' && segments[1]) {
    route.view = 'message';
    route.messageId = segments[1];
  } else if (segments[0] === 'form') {
    route.view = 'form';
    route.formId = segments[1] || 'lostAndFoundForm';
  } else if (segments[0] === 'inventory') {
    route.view = 'inventory';
    route.inventoryId = segments[1] || 'bag';
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
  else if (normalized.view === 'message' && normalized.messageId) segments.push('message', normalized.messageId);
  else if (normalized.view === 'form') segments.push('form', normalized.formId || 'lostAndFoundForm');
  else if (normalized.view === 'inventory') segments.push('inventory', normalized.inventoryId || 'bag');
  else if (normalized.view === 'resource' && Number.isFinite(normalized.resourceSectionId)) segments.push('resource', String(normalized.resourceSectionId));
  const params = serializeAirportStateParams(normalized.state);
  if (normalized.initial) params.set('initial', '1');
  return { segments, params };
}

export function resolveAirportInitialScreen(route = {}) {
  const normalized = normalizeAirportRoute(route);
  if (normalized.view === 'dialog' && normalized.dialogId) {
    return { kind: 'dialog', id: normalized.dialogId };
  }
  if (normalized.view === 'message' && normalized.messageId) {
    return { kind: 'message', id: normalized.messageId };
  }
  if (normalized.view === 'form') {
    return { kind: 'form', id: normalized.formId || 'lostAndFoundForm' };
  }
  if (normalized.view === 'inventory') {
    return { kind: 'inventory', id: normalized.inventoryId || 'bag' };
  }
  if (normalized.view === 'resource' && Number.isFinite(normalized.resourceSectionId)) {
    return { kind: 'resource', id: normalized.resourceSectionId };
  }
  if (normalized.debug?.noteSectionId) {
    return { kind: 'resource', id: normalized.debug.noteSectionId };
  }
  return { kind: 'scene', id: null };
}

export function buildAirportRouteFromRuntime({ modal = null, state = {}, initial = false } = {}) {
  const route = {
    scene: 'airport',
    view: 'scene',
    state: pickAirportRouteState(state),
    initial: initial === true,
  };
  if (modal?.type === 'dialog' && modal.id) {
    route.view = 'dialog';
    route.dialogId = modal.id;
  } else if (modal?.type === 'message' && modal.id) {
    route.view = 'message';
    route.messageId = modal.id;
  } else if (modal?.type === 'form' && modal.id) {
    route.view = 'form';
    route.formId = modal.id;
  } else if (modal?.type === 'inventory') {
    route.view = 'inventory';
    route.inventoryId = modal.id || 'bag';
  } else if (modal?.presentation === 'resource' && Number.isFinite(modal.sourceSectionId)) {
    route.view = 'resource';
    route.resourceSectionId = modal.sourceSectionId;
  }
  return normalizeAirportRoute(route);
}

export function shouldRunAirportEntrySequence(route = {}) {
  const normalized = normalizeAirportRoute(route);
  const hasDebugPlacement = Number.isFinite(normalized.debug?.alexX) || Number.isFinite(normalized.debug?.alexY);
  return normalized.initial === true && normalized.view === 'scene' && !normalized.dialogId && !hasDebugPlacement;
}
