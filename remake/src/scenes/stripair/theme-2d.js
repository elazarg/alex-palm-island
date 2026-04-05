import { STRIPAIR_SEMANTIC_HOTSPOTS } from './semantics.js';
import { resolveStripAirSemanticRect } from './topology.js';

function buildRuntimeInteraction(hotspot) {
  const rect = resolveStripAirSemanticRect(hotspot.id);
  if (!rect) return null;
  return Object.freeze({
    id: hotspot.id,
    rect,
    actions: hotspot.affordances,
  });
}

export const STRIPAIR_ACTIVE_INTERACTIONS = Object.freeze(
  STRIPAIR_SEMANTIC_HOTSPOTS
    .map(buildRuntimeInteraction)
    .filter(Boolean)
    .concat([
      Object.freeze({
        id: 'floor',
        rect: Object.freeze([0, 90, 320, 180]),
        actions: Object.freeze({
          look: Object.freeze({ kind: 'flow', id: 'lookFloor' }),
          touch: Object.freeze({ kind: 'flow', id: 'touchFloor' }),
          talk: Object.freeze({ kind: 'flow', id: 'talkDefault' }),
        }),
      }),
    ])
);
