import { AIRPORT_WORLD } from './generated/airport-world.js';

const clickRectSelector = (index) => Object.freeze({ kind: 'clickRect', index });
const clickRectGroupSelector = (...indexes) => Object.freeze({ kind: 'clickRectGroup', indexes: Object.freeze(indexes) });

export const AIRPORT_STATIC_REGIONS = Object.freeze([
  Object.freeze({ id: 'occlusion.familyForeground', kind: 'occlusion', selector: clickRectSelector(0) }),
  Object.freeze({ id: 'mask.centerPillar', kind: 'walkMask', selector: clickRectSelector(1) }),
  Object.freeze({ id: 'mask.leftBoundary', kind: 'walkMask', selector: clickRectSelector(2) }),
  Object.freeze({ id: 'mask.leftUpperWall', kind: 'walkMask', selector: clickRectSelector(3) }),
  Object.freeze({ id: 'mask.upperWall', kind: 'walkMask', selector: clickRectSelector(4) }),
  Object.freeze({ id: 'mask.panelStrip', kind: 'uiMask', selector: clickRectSelector(5) }),
  Object.freeze({ id: 'mask.escalatorLip', kind: 'walkMask', selector: clickRectSelector(6) }),
  Object.freeze({ id: 'upstairs.exitTrigger', kind: 'exitTrigger', selector: clickRectSelector(7), semantics: Object.freeze({ flow: 'upstairs.block' }) }),
  Object.freeze({ id: 'mask.upperRightBoundary', kind: 'walkMask', selector: clickRectSelector(8) }),
  Object.freeze({ id: 'mask.rightBoundary', kind: 'walkMask', selector: clickRectSelector(9) }),
  Object.freeze({ id: 'mask.counterTop', kind: 'walkMask', selector: clickRectSelector(10) }),
  Object.freeze({ id: 'mask.queueRail', kind: 'walkMask', selector: clickRectSelector(11) }),
  Object.freeze({
    id: 'guard.blockZone',
    kind: 'interactiveZone',
    selector: clickRectSelector(12),
    semantics: Object.freeze({ entity: 'guard', look: 510, touch: 635, bag: 150 }),
    notes: 'Initial guard inquiry zone. Same physical lane later acts as family blocker.',
  }),
  Object.freeze({
    id: 'poster.hotel.left',
    kind: 'interactiveZone',
    selector: clickRectSelector(13),
    semantics: Object.freeze({ entity: 'hotelPoster', look: 520, touch: 525 }),
  }),
  Object.freeze({
    id: 'poster.hotel.right',
    kind: 'interactiveZone',
    selector: clickRectSelector(14),
    semantics: Object.freeze({ entity: 'hotelPoster', look: 520, touch: 525 }),
  }),
  Object.freeze({
    id: 'sign.exit',
    kind: 'interactiveZone',
    selector: clickRectSelector(15),
    semantics: Object.freeze({ entity: 'exitSign', look: 670, touch: 525 }),
  }),
  Object.freeze({
    id: 'desk.front',
    kind: 'interactiveZone',
    selector: clickRectSelector(16),
    semantics: Object.freeze({ entity: 'lostAndFoundCounter', look: 680 }),
  }),
  Object.freeze({
    id: 'escalator.zone',
    kind: 'interactiveZone',
    selector: clickRectSelector(17),
    semantics: Object.freeze({ entity: 'escalator', look: 640, touch: 645 }),
  }),
  Object.freeze({
    id: 'poster.orange.top',
    kind: 'interactiveZone',
    selector: clickRectSelector(18),
    semantics: Object.freeze({ entity: 'orangePoster', look: 530, touch: 525 }),
  }),
  Object.freeze({
    id: 'poster.orange.side',
    kind: 'interactiveZone',
    selector: clickRectSelector(19),
    semantics: Object.freeze({ entity: 'orangePoster', look: 530, touch: 525 }),
  }),
  Object.freeze({
    id: 'baggage.cart',
    kind: 'interactiveZone',
    selector: clickRectSelector(20),
    semantics: Object.freeze({ entity: 'baggageCart', look: 540, touchFlow: 340 }),
  }),
  Object.freeze({
    id: 'passport.counter',
    kind: 'interactiveZone',
    selector: clickRectSelector(21),
    semantics: Object.freeze({ entity: 'passportCounter', look: 550 }),
  }),
  Object.freeze({
    id: 'passport.officer',
    kind: 'interactiveZone',
    selector: clickRectSelector(22),
    semantics: Object.freeze({ entity: 'passportOfficer', bag: 210, look: 560, touch: 635, talk: 220 }),
  }),
  Object.freeze({
    id: 'clerk.zone',
    kind: 'interactiveZone',
    selector: clickRectSelector(23),
    semantics: Object.freeze({ entity: 'clerk', bag: 310, look: 620, touch: 635 }),
    notes: 'Extractor names the source rect LineSign, but the SCX sections clearly identify the clerk.',
  }),
  Object.freeze({
    id: 'lostAndFound.counter',
    kind: 'interactiveZone',
    selector: clickRectSelector(24),
    semantics: Object.freeze({ entity: 'lostAndFoundCounter', look: 580, touchFlow: 330 }),
  }),
  Object.freeze({
    id: 'lostAndFound.sign',
    kind: 'interactiveZone',
    selector: clickRectSelector(25),
    semantics: Object.freeze({ entity: 'lostAndFoundCounter', look: 580, touch: 575 }),
  }),
  Object.freeze({ id: 'mask.doorApproach', kind: 'walkMask', selector: clickRectSelector(26) }),
  Object.freeze({
    id: 'doors.blockTrigger',
    kind: 'exitTrigger',
    selector: clickRectSelector(27),
    semantics: Object.freeze({ entity: 'automaticDoors', flow: 'exit.doors' }),
  }),
  Object.freeze({
    id: 'doors.walkTarget',
    kind: 'walkTarget',
    selector: clickRectSelector(28),
    semantics: Object.freeze({ walkTo: Object.freeze({ x: 323, y: 95 }) }),
  }),
  Object.freeze({
    id: 'stairs.walkTarget',
    kind: 'walkTarget',
    selector: clickRectSelector(29),
    semantics: Object.freeze({ walkTo: Object.freeze({ x: 845, y: 120 }) }),
  }),
  Object.freeze({ id: 'doors.upperPanel', kind: 'unclassified', selector: clickRectSelector(30) }),
  Object.freeze({ id: 'marker.offscreen', kind: 'marker', selector: clickRectSelector(31) }),
  Object.freeze({ id: 'marker.lostCounterPivot', kind: 'marker', selector: clickRectSelector(32) }),
]);

export const AIRPORT_SEMANTIC_TO_PHYSICAL = Object.freeze({
  guard: Object.freeze({ selectors: Object.freeze([clickRectSelector(12)]) }),
  hotelPoster: Object.freeze({ selectors: Object.freeze([clickRectSelector(13), clickRectSelector(14)]) }),
  orangePoster: Object.freeze({ selectors: Object.freeze([clickRectSelector(18), clickRectSelector(19)]) }),
  baggageCart: Object.freeze({ selectors: Object.freeze([clickRectSelector(20)]) }),
  passportCounter: Object.freeze({ selectors: Object.freeze([clickRectSelector(21)]) }),
  passportOfficer: Object.freeze({ selectors: Object.freeze([clickRectSelector(22)]) }),
  clerk: Object.freeze({ selectors: Object.freeze([clickRectSelector(23)]) }),
  lostAndFoundCounter: Object.freeze({ selectors: Object.freeze([clickRectSelector(24), clickRectSelector(25)]) }),
  lostAndFoundDeskFront: Object.freeze({ selectors: Object.freeze([clickRectSelector(16)]) }),
  familyQueue: Object.freeze({ selectors: Object.freeze([clickRectSelector(12)]) }),
  escalator: Object.freeze({ selectors: Object.freeze([clickRectSelector(17)]) }),
  automaticDoors: Object.freeze({ selectors: Object.freeze([clickRectSelector(27), clickRectSelector(28)]) }),
  exitSign: Object.freeze({ selectors: Object.freeze([clickRectSelector(15)]) }),
  upstairsExit: Object.freeze({ selectors: Object.freeze([clickRectSelector(7)]) }),
});

function getClickRect(index) {
  const rect = AIRPORT_WORLD.clickRects[index];
  if (!rect) return null;
  return [rect.x1, rect.y1, rect.x2, rect.y2];
}

function unionRects(rects) {
  if (!rects.length) return null;
  return [
    Math.min(...rects.map((rect) => rect[0])),
    Math.min(...rects.map((rect) => rect[1])),
    Math.max(...rects.map((rect) => rect[2])),
    Math.max(...rects.map((rect) => rect[3])),
  ];
}

export function resolveAirportSelectorRect(selector) {
  if (!selector) return null;
  if (selector.kind === 'clickRect') return getClickRect(selector.index);
  if (selector.kind === 'clickRectGroup') {
    const rects = selector.indexes.map(getClickRect).filter(Boolean);
    return unionRects(rects);
  }
  return null;
}

export function resolveAirportSemanticRect(id) {
  const binding = AIRPORT_SEMANTIC_TO_PHYSICAL[id];
  if (!binding) return null;
  return unionRects(binding.selectors.map(resolveAirportSelectorRect).filter(Boolean));
}
