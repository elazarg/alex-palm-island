import { SCENE_REGISTRY } from '../scenes/registry.js';

function getDescriptor(scene) {
  return SCENE_REGISTRY[scene] || SCENE_REGISTRY.logo;
}

export function parseRouteHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/logo';
  const [pathPart, queryPart = ''] = raw.split('?', 2);
  const segments = pathPart.split('/').filter(Boolean);
  const scene = segments[0] || 'logo';
  const descriptor = getDescriptor(scene);
  return descriptor.parse(segments.slice(1), new URLSearchParams(queryPart));
}

export function defaultRouteForScene(scene) {
  return getDescriptor(scene).defaultRoute();
}

export function normalizeRoute(route = {}) {
  return getDescriptor(route.scene).normalize(route);
}

export function formatRouteHash(route = {}) {
  const normalized = normalizeRoute(route);
  const descriptor = getDescriptor(normalized.scene);
  const { segments, params } = descriptor.format(normalized);
  const path = `#/${segments.join('/')}`;
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function routeCacheKey(route = {}) {
  return formatRouteHash(route);
}
