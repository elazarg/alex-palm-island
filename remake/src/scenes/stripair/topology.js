import { STRIPAIR_WORLD } from './generated/stripair-world.js';

function toRect(rect) {
  if (!rect) return null;
  return Object.freeze([rect.x1, rect.y1, rect.x2, rect.y2]);
}

function findRect(predicate) {
  const rect = STRIPAIR_WORLD.clickRects.find(predicate);
  return toRect(rect);
}

const EXTRACTED_RECTS = Object.freeze({
  townExit: findRect((rect) => rect.name === 'NoEntry' && rect.x1 === 0 && rect.y1 === 180),
  leftBoundary: findRect((rect) => rect.x1 === 0 && rect.y1 === 0 && rect.x2 === 10 && rect.y2 === 200),
  topWall: findRect((rect) => rect.x1 === 0 && rect.y1 === 0 && rect.x2 === 320 && rect.y2 === 40),
  rightWall: findRect((rect) => rect.x1 === 310 && rect.y1 === 0 && rect.x2 === 330 && rect.y2 === 140),
  palmTrees: findRect((rect) => rect.examine_section === 510),
  fence: findRect((rect) => rect.examine_section === 540),
  airportSign: findRect((rect) => rect.examine_section === 590),
  infoSign: findRect((rect) => rect.examine_section === 600),
  infoStand: findRect((rect) => rect.field_44 === 180),
  map: findRect((rect) => rect.examine_section === 560),
});

const ROAD_POLYGON = Object.freeze([
  Object.freeze({ x: 20, y: 63 }),
  Object.freeze({ x: 93, y: 63 }),
  Object.freeze({ x: 320, y: 180 }),
  Object.freeze({ x: 200, y: 180 }),
]);

export const STRIPAIR_STATIC_REGIONS = Object.freeze([
  Object.freeze({ id: 'mask.topWall', kind: 'walkMask', rect: EXTRACTED_RECTS.topWall || Object.freeze([0, 0, 320, 40]) }),
  Object.freeze({ id: 'mask.leftBoundary', kind: 'walkMask', rect: EXTRACTED_RECTS.leftBoundary || Object.freeze([0, 0, 10, 200]) }),
  Object.freeze({ id: 'mask.rightBoundary', kind: 'walkMask', rect: Object.freeze([310, 0, 320, 200]) }),
  Object.freeze({ id: 'mask.road', kind: 'walkMaskPolygon', polygon: ROAD_POLYGON }),
  Object.freeze({ id: 'mask.infoBoothTop', kind: 'walkMask', rect: Object.freeze([154, 0, 231, 58]) }),
  Object.freeze({ id: 'mask.garbageBulk', kind: 'walkMask', rect: Object.freeze([0, 118, 34, 200]) }),
  Object.freeze({ id: 'mask.doorWall', kind: 'walkMask', rect: Object.freeze([286, 0, 320, 122]) }),
  Object.freeze({ id: 'town.exitStrip', kind: 'exitTrigger', rect: EXTRACTED_RECTS.townExit || Object.freeze([0, 180, 320, 200]) }),
  Object.freeze({ id: 'town.approach', kind: 'walkTarget', rect: EXTRACTED_RECTS.townExit || Object.freeze([0, 180, 320, 200]), semantics: Object.freeze({ walkTo: Object.freeze({ x: 90, y: 145 }) }) }),
  Object.freeze({ id: 'palmTrees.zone', kind: 'interactiveZone', rect: EXTRACTED_RECTS.palmTrees || Object.freeze([100, 0, 165, 50]) }),
  Object.freeze({ id: 'fence.zone', kind: 'interactiveZone', rect: EXTRACTED_RECTS.fence || Object.freeze([0, 10, 130, 35]) }),
  Object.freeze({ id: 'airportSign.zone', kind: 'interactiveZone', rect: EXTRACTED_RECTS.airportSign || Object.freeze([220, 0, 290, 20]) }),
  Object.freeze({ id: 'infoSign.zone', kind: 'interactiveZone', rect: EXTRACTED_RECTS.infoSign || Object.freeze([175, 5, 190, 15]) }),
  Object.freeze({ id: 'infoStand.zone', kind: 'interactiveZone', rect: EXTRACTED_RECTS.infoStand || Object.freeze([180, 30, 205, 55]) }),
  Object.freeze({ id: 'map.zone', kind: 'interactiveZone', rect: EXTRACTED_RECTS.map || Object.freeze([300, 45, 320, 95]) }),
  Object.freeze({ id: 'garbage.zone', kind: 'interactiveZone', rect: Object.freeze([0, 102, 88, 198]) }),
  Object.freeze({ id: 'cat.zone', kind: 'interactiveZone', rect: Object.freeze([18, 132, 84, 172]) }),
  Object.freeze({ id: 'deadEndSign.zone', kind: 'interactiveZone', rect: Object.freeze([107, 58, 154, 180]) }),
  Object.freeze({ id: 'airportDoors.zone', kind: 'interactiveZone', rect: Object.freeze([266, 30, 320, 130]) }),
  Object.freeze({ id: 'lamp.zone', kind: 'interactiveZone', rect: Object.freeze([292, 18, 320, 110]) }),
]);

export const STRIPAIR_SEMANTIC_TO_PHYSICAL = Object.freeze({
  townExit: Object.freeze({ rect: EXTRACTED_RECTS.townExit || Object.freeze([0, 180, 320, 200]) }),
  palmTrees: Object.freeze({ rect: EXTRACTED_RECTS.palmTrees || Object.freeze([100, 0, 165, 50]) }),
  deadEndSign: Object.freeze({ rect: Object.freeze([107, 58, 154, 180]) }),
  garbage: Object.freeze({ rect: Object.freeze([0, 102, 88, 198]) }),
  fence: Object.freeze({ rect: EXTRACTED_RECTS.fence || Object.freeze([0, 10, 130, 35]) }),
  infoStand: Object.freeze({ rect: EXTRACTED_RECTS.infoStand || Object.freeze([180, 30, 205, 55]) }),
  map: Object.freeze({ rect: EXTRACTED_RECTS.map || Object.freeze([300, 45, 320, 95]) }),
  airportDoors: Object.freeze({ rect: Object.freeze([266, 30, 320, 130]) }),
  cat: Object.freeze({ rect: Object.freeze([18, 132, 84, 172]) }),
  airportSign: Object.freeze({ rect: EXTRACTED_RECTS.airportSign || Object.freeze([220, 0, 290, 20]) }),
  infoSign: Object.freeze({ rect: EXTRACTED_RECTS.infoSign || Object.freeze([175, 5, 190, 15]) }),
  lamp: Object.freeze({ rect: Object.freeze([292, 18, 320, 110]) }),
});

export function resolveStripAirRegionRect(regionId) {
  return STRIPAIR_STATIC_REGIONS.find((region) => region.id === regionId)?.rect || null;
}

export function resolveStripAirSemanticRect(id) {
  return STRIPAIR_SEMANTIC_TO_PHYSICAL[id]?.rect || null;
}

export function resolveStripAirWalkTarget(regionId) {
  const walkTo = STRIPAIR_STATIC_REGIONS.find((region) => region.id === regionId)?.semantics?.walkTo;
  return walkTo ? Object.freeze({ x: walkTo.x, y: walkTo.y }) : null;
}

export function getStripAirBackgroundRect() {
  return Object.freeze([0, 0, 320, 200]);
}

export function getStripAirWorld() {
  return STRIPAIR_WORLD;
}

export function getStripAirRoadPolygon() {
  return ROAD_POLYGON;
}
