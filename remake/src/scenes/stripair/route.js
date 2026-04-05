import { parseStripAirStateParams, pickStripAirRouteState, serializeStripAirStateParams } from './state.js';

const ENTRY_VALUES = Object.freeze(['airport', 'strip0']);

export function defaultStripAirRoute() {
  return {
    scene: 'stripair',
    view: 'scene',
    initial: false,
    entry: 'airport',
    dialogId: null,
    messageId: null,
    inventoryId: null,
    resourceSectionId: null,
    state: parseStripAirStateParams(new URLSearchParams()),
  };
}

export function normalizeStripAirRoute(route = {}) {
  const base = defaultStripAirRoute();
  const normalized = {
    ...base,
    ...route,
    initial: route.initial === true,
    entry: ENTRY_VALUES.includes(route.entry) ? route.entry : base.entry,
    state: route.state ? pickStripAirRouteState(route.state) : base.state,
  };
  if (normalized.view !== 'dialog') normalized.dialogId = null;
  if (normalized.view !== 'message') normalized.messageId = null;
  if (normalized.view !== 'inventory') normalized.inventoryId = null;
  if (normalized.view !== 'resource') normalized.resourceSectionId = null;
  if (normalized.view === 'resource' && !Number.isFinite(normalized.resourceSectionId)) normalized.view = 'scene';
  return normalized;
}

export function parseStripAirRoute(segments = [], params = new URLSearchParams()) {
  const route = defaultStripAirRoute();
  route.initial = params.get('initial') === '1';
  route.entry = ENTRY_VALUES.includes(params.get('entry')) ? params.get('entry') : route.entry;
  route.state = parseStripAirStateParams(params);
  if (segments[0] === 'dialog' && segments[1]) {
    route.view = 'dialog';
    route.dialogId = segments[1];
  } else if (segments[0] === 'message' && segments[1]) {
    route.view = 'message';
    route.messageId = segments[1];
  } else if (segments[0] === 'inventory') {
    route.view = 'inventory';
    route.inventoryId = segments[1] || 'bag';
  } else if (segments[0] === 'resource' && segments[1]) {
    const sectionId = Number(segments[1]);
    if (Number.isFinite(sectionId)) {
      route.view = 'resource';
      route.resourceSectionId = sectionId;
    }
  }
  return normalizeStripAirRoute(route);
}

export function formatStripAirRoute(route = {}) {
  const normalized = normalizeStripAirRoute(route);
  const segments = ['stripair'];
  if (normalized.view === 'dialog' && normalized.dialogId) segments.push('dialog', normalized.dialogId);
  else if (normalized.view === 'message' && normalized.messageId) segments.push('message', normalized.messageId);
  else if (normalized.view === 'inventory') segments.push('inventory', normalized.inventoryId || 'bag');
  else if (normalized.view === 'resource' && Number.isFinite(normalized.resourceSectionId)) segments.push('resource', String(normalized.resourceSectionId));
  const params = serializeStripAirStateParams(normalized.state);
  if (normalized.initial) params.set('initial', '1');
  if (normalized.initial && normalized.entry !== 'airport') params.set('entry', normalized.entry);
  return { segments, params };
}

export function resolveStripAirInitialScreen(route = {}) {
  const normalized = normalizeStripAirRoute(route);
  if (normalized.view === 'dialog' && normalized.dialogId) return { kind: 'dialog', id: normalized.dialogId };
  if (normalized.view === 'message' && normalized.messageId) return { kind: 'message', id: normalized.messageId };
  if (normalized.view === 'inventory') return { kind: 'inventory', id: normalized.inventoryId || 'bag' };
  if (normalized.view === 'resource' && Number.isFinite(normalized.resourceSectionId)) return { kind: 'resource', id: normalized.resourceSectionId };
  return { kind: 'scene', id: null };
}

export function buildStripAirRouteFromRuntime({ modal = null, state = {}, initial = false } = {}) {
  const route = {
    scene: 'stripair',
    view: 'scene',
    state: pickStripAirRouteState(state),
    initial: initial === true,
  };
  if (modal?.type === 'dialog' && modal.id) {
    route.view = 'dialog';
    route.dialogId = modal.id;
  } else if (modal?.type === 'message' && modal.id) {
    route.view = 'message';
    route.messageId = modal.id;
  } else if (modal?.type === 'inventory') {
    route.view = 'inventory';
    route.inventoryId = modal.id || 'bag';
  } else if (modal?.presentation === 'resource' && Number.isFinite(modal.sourceSectionId)) {
    route.view = 'resource';
    route.resourceSectionId = modal.sourceSectionId;
  }
  return normalizeStripAirRoute(route);
}

export function shouldRunStripAirEntrySequence(route = {}) {
  const normalized = normalizeStripAirRoute(route);
  return normalized.initial === true && normalized.view === 'scene';
}
