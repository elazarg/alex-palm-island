import { ALEX_DIALOG_ASSET_NAMES, CURSOR_ASSET_NAMES, UI_ASSET_NAMES, UI_VERSION } from '../../ui/assets.js';

export const ANIM_TICK_SCALE = 2;
export const DIALOG_RESPONSE_DELAY_TICKS = 3;

export const ACHU_SEQUENCE = [
  1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 2, 1, 1,
  1, 1, 1, 1, 3, 4, 5, 6,
  7, 8, 9, 10, 11,
];

export const WALK_ZONES = [
  [0, 95, 300, 160],
  [250, 55, 400, 160],
  [350, 95, 960, 160],
  [785, 90, 960, 160],
];

export function createAirportObjects() {
  const behind = [
    { name: 'Achu', sprite: 'ACHU1', x: 111, y: 31, visible: true, anim: { prefix: 'ACHU', rate: 8, sequence: ACHU_SEQUENCE } },
    { name: 'Door', sprite: 'DOOR1', x: 273, y: 0, visible: true },
    { name: 'FemGrd', sprite: 'FEMGRD1', x: 246, y: 20, visible: true,
      anim: { prefix: 'FEMGRD', rate: 4, bottomAlign: 121,
        sequence: [1,1,2,3,4,6,7,8,10,8,10,8,10,8,8,7,6,3,2,1,1],
        framePos: { 1:[246,20], 2:[259,20], 3:[260,20], 4:[261,17], 5:[261,21], 6:[261,21], 7:[260,21], 8:[254,21], 9:[254,21], 10:[254,21] } } },
    { name: 'BrdTlk', sprite: 'BRDTLK0', x: 386, y: 2, visible: true,
      overlay: { prefix: 'BRDTLK', rate: 8, ox: 73, oy: 21,
        sequence: [1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,3,4,3,4,3,1,1,1,5,6,5,6,7,8,7,8,5,6,1,1,9,10,9,10,11,10,9,1,1,1,1,1] } },
    { name: 'Border', sprite: 'BORDER1', x: 454, y: 25, visible: true, anim: { prefix: 'BORDER', rate: 3, sequence: [1,2,3,4,5,6,1,1,1,1,1,1,1,1,1,1,1,1,1,1] } },
    { name: 'Guard', sprite: 'GUARD1', x: 701, y: 13, visible: true,
      anim: { prefix: 'GUARD', rate: 4,
        sequence: [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,4,3,4,3,6,6,6,6,7,7,7,7,6,6,6,6,11,11,11,11,11,11,11,11,12,1,1] } },
    { name: 'Family', sprite: 'FAMILY1', x: 500, y: 40, visible: false, anim: { prefix: 'FAMILY', rate: 5, sequence: [1,1,1,1,1,1,1,1,1,1,2,3,4,5,6,5,4,3,2,1,1,1,1] } },
    { name: 'LineSign', sprite: 'LINESIGN', x: 436, y: 69, visible: true },
    { name: 'Stairs', sprite: 'STAIRS1', x: 825, y: 0, visible: true, anim: 'stairs' },
    { name: 'ALEXDN', sprite: 'ALEXDN1', x: 838, y: 0, visible: false },
    { name: 'Trup', sprite: 'TRUP1', x: 960, y: 50, visible: false },
    { name: 'StaffB', sprite: 'STAFFB1', x: 500, y: 50, visible: false },
    { name: 'Depart', sprite: 'DEPART', x: 811, y: 0, visible: false },
  ];
  const front = [
    { name: 'Maake', sprite: 'MAAKE', x: 776, y: 120, visible: true },
    { name: 'Arrive', sprite: 'ARRIVE', x: 811, y: 0, visible: true },
    { name: 'WallB', sprite: 'WALL_B', x: 0, y: 0, visible: true },
    { name: 'WallK', sprite: 'WALL_K', x: 920, y: 100, visible: true },
  ];
  return { behind, front };
}

export function buildAssetManifest() {
  const base = 'assets/airport';
  const images = { SCENE_BG: `${base}/SNAIRPORT_FULL.png` };
  const frameCounts = {1:8, 2:7, 3:8, 4:8, 6:8, 7:8, 8:7, 9:8};
  for (const [dir, count] of Object.entries(frameCounts)) {
    for (let frame = 0; frame < count; frame++) {
      images[`ALEX${dir}-${frame}`] = `assets/alex/ALEX${dir}-${frame}.png`;
    }
  }
  const { behind, front } = createAirportObjects();
  for (const obj of [...behind, ...front]) images[obj.sprite] = `${base}/${obj.sprite}.png`;
  for (let i = 1; i <= 6; i++) images[`STAIRS${i}`] = `${base}/STAIRS${i}.png`;
  for (let i = 1; i <= 12; i++) images[`GUARD${i}`] = `${base}/GUARD${i}.png`;
  for (let i = 1; i <= 6; i++) images[`FAMILY${i}`] = `${base}/FAMILY${i}.png`;
  for (let i = 1; i <= 10; i++) images[`FEMGRD${i}`] = `${base}/FEMGRD${i}.png`;
  for (let i = 0; i <= 11; i++) images[`BRDTLK${i}`] = `${base}/BRDTLK${i}.png`;
  for (let i = 1; i <= 10; i++) images[`GRDTLK${i}`] = `${base}/GRDTLK${i}.png`;
  for (let i = 0; i <= 10; i++) images[`GRDPNT${i}`] = `${base}/GRDPNT${i}.png`;
  for (let i = 1; i <= 7; i++) images[`FEMTLK${i}`] = `${base}/FEMTLK${i}.png`;
  for (let i = 1; i <= 6; i++) images[`FAMTLK${i}`] = `${base}/FAMTLK${i}.png`;
  for (let i = 1; i <= 11; i++) images[`ACHU${i}`] = `${base}/ACHU${i}.png`;
  for (let i = 0; i <= 8; i++) images[`CLRK${i}`] = `${base}/CLRK${i}.png`;
  for (let i = 0; i <= 8; i++) images[`LOST${i}`] = `${base}/LOST${i}.png`;
  for (let i = 1; i <= 6; i++) images[`BORDER${i}`] = `${base}/BORDER${i}.png`;
  for (const name of ['TRUP1','STAFFB1','DOOR1','DOOR2','FEMGRD1','ALEXDN1','WALL_B','WALL_K','MAAKE','ARRIVE','DEPART','LINESIGN','DALPAK','HOTELAD','ORANGEAD','FORM']) {
    images[name] = `${base}/${name}.png`;
  }
  const ui = 'assets/ui';
  for (const name of UI_ASSET_NAMES) images[name] = `${ui}/${name}.png?v=${UI_VERSION}`;
  for (const name of ALEX_DIALOG_ASSET_NAMES) images[name] = `${ui}/${name}.png?v=${UI_VERSION}`;
  images.GRDTLK0 = `${base}/GRDTLK0.png?v=${UI_VERSION}`;
  images.FEMTLK0 = `${base}/FEMTLK0.png?v=${UI_VERSION}`;
  images.FAMTLK0 = `${base}/FAMTLK0.png?v=${UI_VERSION}`;
  const cursorBase = 'assets/cursors';
  for (const name of CURSOR_ASSET_NAMES) {
    images[name] = `${cursorBase}/${name}.png?v=${UI_VERSION}`;
  }
  return { images, frameCounts };
}

const AIRPORT_SOUND_NAMES = [
  'SDACHU1',
  'SDAL62', 'SDAL63', 'SDAL64', 'SDAL65', 'SDAL66', 'SDAL67', 'SDAL68', 'SDAL69',
  'SDAL70', 'SDAL71', 'SDAL72', 'SDAL73', 'SDAL74', 'SDAL75', 'SDAL76', 'SDAL77',
  'SDAL78', 'SDAL79', 'SDAL80', 'SDAL81', 'SDAL82', 'SDAL83',
  'SDESCL1', 'SDESCL2', 'SDESCL3', 'SDESCL4', 'SDESCL5', 'SDESCL6',
  'SDFAML1',
  'SDJUDY1', 'SDJUDY2', 'SDJUDY3', 'SDJUDY4', 'SDJUDY5', 'SDJUDY6', 'SDJUDY7', 'SDJUDY8', 'SDJUDY9',
  'SDLOST1', 'SDLOST2', 'SDLOST3', 'SDLOST4', 'SDLOST5', 'SDLOST6', 'SDLOST7', 'SDLOST8', 'SDLOST9',
  'SDLOST10', 'SDLOST11', 'SDLOST12', 'SDLOST13', 'SDLOST14', 'SDLOST15', 'SDLOST16', 'SDLOST17',
  'SDLOST18', 'SDLOST19', 'SDLOST20', 'SDLOST21', 'SDLOST22', 'SDLOST23', 'SDLOST24', 'SDLOST25',
  'SDPASS1', 'SDPASS2', 'SDPASS3', 'SDPASS4', 'SDPASS5', 'SDPASS6', 'SDPASS7', 'SDPASS8',
];

export const SOUND_MANIFEST = Object.freeze(
  Object.fromEntries(
    AIRPORT_SOUND_NAMES.map((name) => [name, `../re/renders/sounds/AIRPOR/${name}.wav`])
  )
);
