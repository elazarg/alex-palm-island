import { buildScxResourceTables } from '../../runtime/scx-resource-parser.js';
import { STREET_SCENE_DATA } from './generated/street-data.js';

function mergeExits(generated = [], extras = []) {
  const byKey = new Map();
  for (const exitDef of generated) {
    if (!exitDef?.targetScene) continue;
    const key = `${exitDef.targetScene}:${exitDef.sectionId ?? exitDef.name ?? ''}`;
    byKey.set(key, exitDef);
  }
  for (const exitDef of extras) {
    const key = `${exitDef.targetScene}:${exitDef.sectionId ?? exitDef.name ?? ''}`;
    byKey.set(key, exitDef);
  }
  return Object.freeze([...byKey.values()]);
}

function listBackgroundAssets(sceneData) {
  const prefix = `SN${sceneData.sceneCode}`;
  return Object.freeze(
    (sceneData.spriteNames || [])
      .filter((name) => name.startsWith(prefix))
      .sort((a, b) => {
        const aNum = Number(a.slice(prefix.length)) || 0;
        const bNum = Number(b.slice(prefix.length)) || 0;
        return aNum - bNum;
      })
  );
}

function placeSpriteFromRect(name, asset, rect, width, height, extra = {}) {
  const [x1, y1, x2, y2] = rect;
  const centerX = Math.round((x1 + x2) / 2);
  return Object.freeze({
    name,
    asset,
    x: centerX - Math.round(width / 2),
    y: y2 - height,
    visibleWhen: extra.visibleWhen || null,
    layer: extra.layer || 'front',
  });
}

export const WORLD_MAP_HOTSPOTS = Object.freeze([
  Object.freeze({ scene: 'stripair', rect: Object.freeze([224, 16, 314, 76]), label: 'Airport' }),
  Object.freeze({ scene: 'strip0', rect: Object.freeze([128, 80, 204, 136]), label: 'Town Center' }),
  Object.freeze({ scene: 'stapart', rect: Object.freeze([106, 22, 182, 72]), label: 'Apartment Street' }),
  Object.freeze({ scene: 'stburger', rect: Object.freeze([8, 62, 70, 112]), label: 'Burger Street' }),
  Object.freeze({ scene: 'stbutcher', rect: Object.freeze([92, 126, 172, 182]), label: 'Butcher Street' }),
  Object.freeze({ scene: 'stchoco', rect: Object.freeze([222, 90, 302, 154]), label: 'Chocolate Street' }),
  Object.freeze({ scene: 'sthosp', rect: Object.freeze([60, 74, 132, 124]), label: 'Hospital Street' }),
  Object.freeze({ scene: 'sthotel', rect: Object.freeze([118, 12, 222, 64]), label: 'Hotel Street' }),
  Object.freeze({ scene: 'stsuper', rect: Object.freeze([106, 138, 250, 194]), label: 'Supermarket Street' }),
  Object.freeze({ scene: 'stzoo', rect: Object.freeze([244, 22, 314, 88]), label: 'Zoo Street' }),
]);

const STREET_ALEX_DEPTH_SCALES = Object.freeze({
  strip0: Object.freeze({ yMin: 42, yMax: 207, scaleMin: 0.44, scaleMax: 1.03 }),
  stapart: Object.freeze({ yMin: 42, yMax: 215, scaleMin: 0.44, scaleMax: 1.03 }),
  stburger: Object.freeze({ yMin: 52, yMax: 219, scaleMin: 0.44, scaleMax: 1.03 }),
  stbutcher: Object.freeze({ yMin: 72, yMax: 210, scaleMin: 0.44, scaleMax: 1.03 }),
  stchoco: Object.freeze({ yMin: 42, yMax: 219, scaleMin: 0.44, scaleMax: 1.03 }),
  sthosp: Object.freeze({ yMin: 42, yMax: 207, scaleMin: 0.44, scaleMax: 1.03 }),
  sthotel: Object.freeze({ yMin: 42, yMax: 207, scaleMin: 0.44, scaleMax: 1.03 }),
  stsuper: Object.freeze({ yMin: 42, yMax: 210, scaleMin: 0.44, scaleMax: 1.03 }),
  stzoo: Object.freeze({ yMin: 52, yMax: 219, scaleMin: 0.44, scaleMax: 1.03 }),
});

const STREET_MANUAL_CONFIG = Object.freeze({
  strip0: Object.freeze({
    exits: Object.freeze([
      Object.freeze({
        name: 'ToStripAir',
        rect: Object.freeze([0, 35, 80, 100]),
        walkTarget: Object.freeze({ x: 70, y: 95 }),
        targetScene: 'stripair',
      }),
      Object.freeze({
        name: 'ToStButcher',
        rect: Object.freeze([130, 40, 280, 100]),
        walkTarget: Object.freeze({ x: 140, y: 90 }),
        targetScene: 'stbutcher',
      }),
      Object.freeze({
        name: 'ToStApart',
        rect: Object.freeze([390, 0, 505, 100]),
        walkTarget: Object.freeze({ x: 420, y: 90 }),
        targetScene: 'stapart',
      }),
      Object.freeze({
        name: 'ToStChoco',
        rect: Object.freeze([545, 0, 640, 140]),
        walkTarget: Object.freeze({ x: 620, y: 130 }),
        targetScene: 'stchoco',
      }),
    ]),
    defaultEntry: Object.freeze({ x: 320, y: 140, dir: 4 }),
    interactions: Object.freeze([
      Object.freeze({
        id: 'cow',
        rect: Object.freeze([220, 85, 335, 150]),
        actions: Object.freeze({ look: 160, touch: 160 }),
      }),
    ]),
  }),
  stapart: Object.freeze({
    renderObjects: Object.freeze([
      placeSpriteFromRect('Mailman', 'MAIL1', [390, 95, 500, 165], 56, 90),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'electricians',
        rect: Object.freeze([1020, 30, 1165, 130]),
        actions: Object.freeze({ talk: 110, touch: 120 }),
      }),
      Object.freeze({
        id: 'mailman',
        rect: Object.freeze([390, 95, 500, 165]),
        actions: Object.freeze({ talk: 230, touch: 240 }),
      }),
    ]),
  }),
  stburger: Object.freeze({
    renderObjects: Object.freeze([
      placeSpriteFromRect('Police', 'FEM-POL1', [705, 55, 805, 125], 36, 80),
      placeSpriteFromRect('Driver', 'DRIVER', [20, 35, 205, 105], 64, 62),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'burgerDoor',
        rect: Object.freeze([250, 60, 330, 120]),
        actions: Object.freeze({ walk: 110, touch: 110 }),
      }),
      Object.freeze({
        id: 'police',
        rect: Object.freeze([705, 55, 805, 125]),
        actions: Object.freeze({ talk: 120, look: 121, touch: 122 }),
      }),
      Object.freeze({
        id: 'taxi',
        rect: Object.freeze([20, 35, 205, 105]),
        actions: Object.freeze({ talk: 250, look: 255 }),
      }),
      Object.freeze({
        id: 'jail',
        rect: Object.freeze([935, 55, 1030, 145]),
        actions: Object.freeze({ talk: 140, touch: 150, look: 155 }),
      }),
    ]),
  }),
  stchoco: Object.freeze({
    exits: Object.freeze([
      Object.freeze({
        name: 'FarToStApart',
        rect: Object.freeze([0, 65, 150, 95]),
        walkTarget: Object.freeze({ x: 145, y: 80 }),
        targetScene: 'stapart',
      }),
    ]),
    renderObjects: Object.freeze([
      placeSpriteFromRect('GumSeller', 'GUMSELL', [250, 75, 365, 135], 40, 75),
      placeSpriteFromRect('Child', 'CHILD1', [470, 120, 560, 175], 148, 65),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'factoryGuard',
        rect: Object.freeze([1080, 70, 1170, 140]),
        actions: Object.freeze({ talk: 120, walk: 130, touch: 110, look: 122 }),
      }),
      Object.freeze({
        id: 'gumSeller',
        rect: Object.freeze([250, 75, 365, 135]),
        actions: Object.freeze({ talk: 240, touch: 250 }),
      }),
      Object.freeze({
        id: 'child',
        rect: Object.freeze([470, 120, 560, 175]),
        actions: Object.freeze({ talk: 210, look: 220, touch: 230 }),
      }),
      Object.freeze({
        id: 'bicycle',
        rect: Object.freeze([170, 85, 230, 125]),
        actions: Object.freeze({ touch: 260, look: 260 }),
      }),
    ]),
  }),
  sthosp: Object.freeze({
    renderObjects: Object.freeze([
      placeSpriteFromRect('Digger', 'DIGGER1', [105, 50, 175, 95], 108, 96),
      placeSpriteFromRect('Vampire', 'VAMP1', [360, 90, 455, 145], 44, 87),
      Object.freeze({ name: 'OJMachine', asset: 'OJ1', x: 515, y: 0, layer: 'front' }),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'orangeJuice',
        rect: Object.freeze([515, 0, 690, 130]),
        actions: Object.freeze({ touch: 140, walk: 140 }),
      }),
      Object.freeze({
        id: 'spinRide',
        rect: Object.freeze([680, 65, 760, 125]),
        actions: Object.freeze({ touch: 150 }),
      }),
      Object.freeze({
        id: 'runOverGate',
        rect: Object.freeze([875, 85, 980, 145]),
        actions: Object.freeze({ walk: 160, touch: 160 }),
      }),
      Object.freeze({
        id: 'vampire',
        rect: Object.freeze([360, 90, 455, 145]),
        actions: Object.freeze({ talk: 230, touch: 235 }),
      }),
      Object.freeze({
        id: 'digger',
        rect: Object.freeze([105, 50, 175, 95]),
        actions: Object.freeze({ talk: 260, look: 260 }),
      }),
    ]),
  }),
  sthotel: Object.freeze({
    renderObjects: Object.freeze([
      Object.freeze({
        name: 'Hammer',
        asset: 'HAMMER',
        x: 895,
        y: 100,
        visibleWhen: (state) => !(Array.isArray(state.items) && state.items.includes('hammer')),
        layer: 'front',
      }),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'hammer',
        rect: Object.freeze([860, 80, 930, 125]),
        actions: Object.freeze({ touch: 120, walk: 120 }),
      }),
      Object.freeze({
        id: 'hotelDoor',
        rect: Object.freeze([330, 65, 470, 135]),
        actions: Object.freeze({ walk: 140, touch: 130 }),
      }),
      Object.freeze({
        id: 'zebra',
        rect: Object.freeze([20, 50, 190, 145]),
        actions: Object.freeze({ talk: 200, look: 210, touch: 220 }),
      }),
    ]),
  }),
  stsuper: Object.freeze({
    exits: Object.freeze([
      Object.freeze({
        name: 'FarToStBurger',
        sectionId: 200,
        rect: Object.freeze([150, 60, 250, 90]),
        walkTarget: Object.freeze({ x: 215, y: 80 }),
        targetScene: 'stburger',
      }),
      Object.freeze({
        name: 'FarToStHotel',
        rect: Object.freeze([0, 65, 150, 105]),
        walkTarget: Object.freeze({ x: 120, y: 80 }),
        targetScene: 'sthotel',
      }),
    ]),
    renderObjects: Object.freeze([
      placeSpriteFromRect('DoughnutMan', 'DOMAN1', [295, 20, 400, 120], 24, 22),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'doughnutMan',
        rect: Object.freeze([295, 20, 400, 120]),
        actions: Object.freeze({ talk: 110, touch: 111, look: 120 }),
      }),
      Object.freeze({
        id: 'shopDoor',
        rect: Object.freeze([860, 40, 940, 120]),
        actions: Object.freeze({ walk: 140, touch: 140 }),
      }),
      Object.freeze({
        id: 'superDoor',
        rect: Object.freeze([295, 20, 405, 130]),
        actions: Object.freeze({ walk: 150, touch: 160 }),
      }),
    ]),
  }),
  stzoo: Object.freeze({
    exits: Object.freeze([
      Object.freeze({
        name: 'FarToStBurger',
        rect: Object.freeze([0, 70, 140, 105]),
        walkTarget: Object.freeze({ x: 150, y: 80 }),
        targetScene: 'stburger',
      }),
    ]),
    renderObjects: Object.freeze([
      placeSpriteFromRect('Grandma', 'GRAND1', [610, 95, 690, 145], 76, 90),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'photoDoor',
        rect: Object.freeze([940, 75, 995, 110]),
        actions: Object.freeze({ walk: 120, touch: 120 }),
      }),
      Object.freeze({
        id: 'zooTicketClerk',
        rect: Object.freeze([390, 45, 455, 130]),
        actions: Object.freeze({ talk: 160, look: 170, touch: 180, walk: 150 }),
      }),
      Object.freeze({
        id: 'grandma',
        rect: Object.freeze([610, 95, 690, 145]),
        actions: Object.freeze({ talk: 240, look: 245, touch: 250 }),
      }),
    ]),
  }),
  stbutcher: Object.freeze({
    exits: Object.freeze([
      Object.freeze({
        name: 'FarToStApart',
        sectionId: 200,
        rect: Object.freeze([0, 65, 145, 90]),
        walkTarget: Object.freeze({ x: 135, y: 70 }),
        targetScene: 'stapart',
      }),
    ]),
    specialInteraction: Object.freeze({
      id: 'smallMap',
      rect: Object.freeze([430, 40, 458, 70]),
      walkTarget: Object.freeze({ x: 480, y: 90 }),
      messageSectionId: 590,
    }),
    renderObjects: Object.freeze([
      placeSpriteFromRect('Maid', 'MAID1', [690, 65, 790, 130], 112, 61),
      Object.freeze({
        name: 'SmallMap',
        asset: 'SMALLMAP',
        x: 430,
        y: 40,
        visibleWhen: (state) => state.map !== true,
        layer: 'front',
      }),
    ]),
    interactions: Object.freeze([
      Object.freeze({
        id: 'butcherDoor',
        rect: Object.freeze([875, 55, 980, 130]),
        actions: Object.freeze({ walk: 150, touch: 150 }),
      }),
      Object.freeze({
        id: 'maidStatue',
        rect: Object.freeze([690, 65, 790, 130]),
        actions: Object.freeze({ talk: 270, look: 280, touch: 290 }),
      }),
      Object.freeze({
        id: 'walls',
        rect: Object.freeze([410, 70, 535, 120]),
        actions: Object.freeze({ touch: 110, look: 310 }),
      }),
    ]),
  }),
});

export const STREET_SCENES = Object.freeze(
  Object.fromEntries(
    Object.entries(STREET_SCENE_DATA).map(([sceneId, sceneData]) => {
      const manual = STREET_MANUAL_CONFIG[sceneId] || {};
      const resources = Object.freeze(buildScxResourceTables(sceneData.text, sceneData.sceneCode));
      return [sceneId, Object.freeze({
        ...sceneData,
        backgroundAssets: listBackgroundAssets(sceneData),
        alexDepthScale: STREET_ALEX_DEPTH_SCALES[sceneId] || null,
        resources,
        exits: mergeExits(sceneData.exitDefs, manual.exits || []),
        specialInteraction: manual.specialInteraction || null,
        manualInteractions: manual.interactions || Object.freeze([]),
        renderObjects: manual.renderObjects || Object.freeze([]),
        defaultEntry: manual.defaultEntry || null,
      })];
    })
  )
);
