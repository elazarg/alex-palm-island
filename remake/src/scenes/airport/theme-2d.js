import { AIRPORT_SEMANTIC_HOTSPOTS } from './semantics.js';
import { resolveAirportSemanticRect, resolveAirportWalkTarget } from './topology.js';

const RECT_BOUND_ENTITIES = Object.freeze(new Set([
  'guard',
  'hotelPoster',
  'orangePoster',
  'baggageCart',
  'passportCounter',
  'passportOfficer',
  'clerk',
  'lostAndFoundCounter',
  'escalator',
  'automaticDoors',
  'exitSign',
  'upstairsExit',
]));

export const AIRPORT_2D_OBJECT_LAYOUT = Object.freeze({
  familyQueue: Object.freeze({ runtimeId: 'familyQueue', object: 'Family', sprite: 'FAMILY1', pad: [0, 0, -76, 0], status: 'mapped' }),
  womanGuard: Object.freeze({ runtimeId: 'womanGuard', object: 'FemGrd', sprite: 'FEMGRD1', pad: [8, -6, -4, 0], status: 'mapped' }),
  queueSign: Object.freeze({ runtimeId: 'queueSign', object: 'LineSign', sprite: 'LINESIGN', pad: [0, 0, 0, 0], status: 'mapped' }),
  arrivalsBoard: Object.freeze({ runtimeId: 'arrivalsBoard', object: 'Arrive', sprite: 'ARRIVE', pad: [0, 0, 0, 0], status: 'mapped' }),
  departuresBoard: Object.freeze({ runtimeId: 'departuresBoard', object: 'Depart', sprite: 'DEPART', pad: [0, 0, 0, 0], status: 'mapped' }),
  lostAndFoundForm: Object.freeze({ status: 'unmapped' }),
  namedBag: Object.freeze({ status: 'unmapped' }),
});

function buildRuntimeInteraction(hotspot) {
  const actions = normalizeActions(hotspot);
  if (!actions) return null;

  if (RECT_BOUND_ENTITIES.has(hotspot.id) || RECT_BOUND_ENTITIES.has(hotspot.entity)) {
    const rect = resolveAirportSemanticRect(hotspot.id) || resolveAirportSemanticRect(hotspot.entity);
    if (!rect) return null;
    return Object.freeze({
      id: hotspot.id,
      rect,
      enabled: hotspot.id === 'familyQueue' ? false : undefined,
      actions,
    });
  }

  const layout = AIRPORT_2D_OBJECT_LAYOUT[hotspot.entity];
  if (!layout || layout.status !== 'mapped' || !layout.object) return null;
  return Object.freeze({
    id: layout.runtimeId || hotspot.id,
    object: layout.object,
    sprite: layout.sprite,
    pad: layout.pad,
    enabled: (layout.runtimeId || hotspot.id) === 'familyQueue' ? false : undefined,
    actions,
  });
}

function normalizeActions(hotspot) {
  const actions = hotspot.affordances;
  if (!actions) return null;
  const normalized = {};
  for (const [mode, action] of Object.entries(actions)) {
    if (
      mode === 'walk' &&
      action?.kind === 'flow' &&
      (hotspot.id === 'automaticDoors' || hotspot.id === 'escalator' || hotspot.id === 'upstairsExit')
    ) {
      const regionId = hotspot.id === 'automaticDoors' ? 'doors.walkTarget' : 'stairs.walkTarget';
      const approach = resolveAirportWalkTarget(regionId);
      normalized[mode] = approach
        ? Object.freeze({ kind: 'approachFlow', id: action.id, approach })
        : action;
    } else {
      normalized[mode] = action;
    }
  }
  return Object.freeze(normalized);
}

export const AIRPORT_ACTIVE_INTERACTIONS = Object.freeze(
  AIRPORT_SEMANTIC_HOTSPOTS
    .map(buildRuntimeInteraction)
    .filter(Boolean)
    .concat([
      Object.freeze({
        id: 'floor',
        rect: [0, 120, 960, 166],
        actions: Object.freeze({
          look: Object.freeze({ kind: 'flow', id: 'lookFloor' }),
          touch: Object.freeze({ kind: 'flow', id: 'touchFloor' }),
          talk: Object.freeze({ kind: 'flow', id: 'talkDefault' }),
        }),
      }),
    ])
);
