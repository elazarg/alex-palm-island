import { ALEX_DIALOG_ASSET_NAMES, CURSOR_ASSET_NAMES, UI_ASSET_NAMES, UI_VERSION } from '../../ui/assets.js';

export const STRIPAIR_DIALOG_RESPONSE_DELAY_TICKS = 3;
export const STRIPAIR_ENTRY_TARGET = Object.freeze({ x: 236, y: 106, dir: 4 });
export const STRIPAIR_ALEX_DEPTH_SCALE = Object.freeze({
  yMin: 37,
  yMax: 204,
  scaleMin: 0.44,
  scaleMax: 1.03,
});
export const STRIPAIR_DOOR_ENTRY_ANIMATION = Object.freeze({
  prefix: 'DOOR',
  sequence: Object.freeze([3, 2, 1]),
  x: 240,
  y: 22,
  rate: 4,
});
export const STRIPAIR_NAVIGATION_GRAPH = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ id: 'left-top', x: 74, y: 98 }),
    Object.freeze({ id: 'bottom-left', x: 70, y: 165 }),
    Object.freeze({ id: 'left-bottom', x: 96, y: 164 }),
    Object.freeze({ id: 'bottom-mid', x: 148, y: 164 }),
    Object.freeze({ id: 'bottom-right', x: 224, y: 132 }),
    Object.freeze({ id: 'door-base', x: 248, y: 122 }),
    Object.freeze({ id: 'top-mid', x: 188, y: 103 }),
    Object.freeze({ id: 'top-left', x: 135, y: 103 }),
  ]),
  edges: Object.freeze([
    Object.freeze(['left-top', 'top-left']),
    Object.freeze(['left-top', 'left-bottom']),
    Object.freeze(['left-bottom', 'bottom-left']),
    Object.freeze(['left-bottom', 'bottom-mid']),
    Object.freeze(['bottom-mid', 'bottom-right']),
    Object.freeze(['bottom-right', 'door-base']),
    Object.freeze(['door-base', 'top-mid']),
    Object.freeze(['top-mid', 'top-left']),
  ]),
});
export const STRIPAIR_CAT_FRAME_POSITIONS = Object.freeze([
  Object.freeze({ x: 38, y: 144 }),
  Object.freeze({ x: 35, y: 144 }),
  Object.freeze({ x: 31, y: 144 }),
  Object.freeze({ x: 38, y: 144 }),
  Object.freeze({ x: 38, y: 144 }),
  Object.freeze({ x: 37, y: 144 }),
  Object.freeze({ x: 38, y: 144 }),
  Object.freeze({ x: 38, y: 144 }),
  Object.freeze({ x: 38, y: 144 }),
  Object.freeze({ x: 38, y: 144 }),
]);

export const STRIPAIR_WALK_ZONES = Object.freeze([
  Object.freeze([0, 0, 320, 200]),
]);

export function createStripAirObjects() {
  return Object.freeze({
    behind: Object.freeze([]),
    front: Object.freeze([
      {
        name: 'PalmTreeForeground',
        sprite: 'PALMTREE',
        x: 0,
        y: 23,
        visible: true,
      },
      {
        name: 'GarbageForeground',
        sprite: 'GARBAGE',
        x: 0,
        y: 102,
        visible: true,
      },
      {
        name: 'Cat',
        sprite: 'CAT1',
        x: 38,
        y: 144,
        visible: true,
        anim: Object.freeze({
          prefix: 'CAT',
          rate: 5,
          sequence: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
          framePos: Object.fromEntries(
            STRIPAIR_CAT_FRAME_POSITIONS.map((pos, index) => [index + 1, [pos.x, pos.y]])
          ),
        }),
      },
      {
        name: 'DeadEndSign',
        sprite: 'NOENTRY',
        x: 112,
        y: 80,
        visible: true,
      },
    ]),
  });
}

export function buildAssetManifest() {
  const base = '../assets/stripair';
  const images = { SCENE_BG: `${base}/SNSTRIPAIR1.png` };
  const frameCounts = { 1: 8, 2: 7, 3: 8, 4: 8, 6: 8, 7: 8, 8: 7, 9: 8 };
  for (const [dir, count] of Object.entries(frameCounts)) {
    for (let frame = 0; frame < count; frame++) {
      images[`ALEX${dir}-${frame}`] = `../assets/alex/ALEX${dir}-${frame}.png`;
    }
  }
  for (let i = 1; i <= 10; i++) images[`CAT${i}`] = `${base}/CAT${i}.png`;
  images.CATTLK0 = `${base}/CATTLK0.png`;
  for (let i = 1; i <= 6; i++) images[`CATTLK${i}`] = `${base}/CATTLK${i}.png`;
  images.INFOTLK0 = `${base}/INFOTLK0.png`;
  for (let i = 1; i <= 4; i++) images[`INFOTLK${i}`] = `${base}/INFOTLK${i}.png`;
  for (let i = 1; i <= 3; i++) images[`DOOR${i}`] = `${base}/DOOR${i}.png`;
  images.INFOSIGN = `${base}/INFOSIGN.png`;
  images.NOENTRY = `${base}/NOENTRY.png`;
  images.PALMTREE = `${base}/PALMTREE.png`;
  images.GARBAGE = `${base}/GARBAGE.png`;
  const ui = '../assets/ui';
  for (const name of UI_ASSET_NAMES) images[name] = `${ui}/${name}.png?v=${UI_VERSION}`;
  for (const name of ALEX_DIALOG_ASSET_NAMES) images[name] = `${ui}/${name}.png?v=${UI_VERSION}`;
  images.SUITCASE = `${ui}/SUITCASE.png?v=${UI_VERSION}`;
  images.ICONWINDOW = `${ui}/ICONWINDOW.png?v=${UI_VERSION}`;
  images.PASSPORTICON = `../assets/icons/PASSPORTICON.png?v=${UI_VERSION}`;
  images.LETTERICON = `../assets/icons/LETTERICON.png?v=${UI_VERSION}`;
  images.PASSPORTPICT = `../assets/icons/PASSPORTPICT.png?v=${UI_VERSION}`;
  images.LETTERPICT = `../assets/icons/LETTERPICT.png?v=${UI_VERSION}`;
  const cursorBase = '../assets/cursors';
  for (const name of CURSOR_ASSET_NAMES) images[name] = `${cursorBase}/${name}.png?v=${UI_VERSION}`;
  return { images, frameCounts };
}

const STRIPAIR_SOUND_NAMES = Object.freeze([
  'SDAL100', 'SDAL92', 'SDAL93', 'SDAL94', 'SDAL95', 'SDAL96', 'SDAL97', 'SDAL98', 'SDAL99',
  'SDINFO1', 'SDINFO2', 'SDINFO3', 'SDINFO4', 'SDINFO5', 'SDINFO6', 'SDINFO7',
  'SDNAR363', 'SDNAR364', 'SDNAR365', 'SDNAR366', 'SDNAR367', 'SDNAR368', 'SDNAR369', 'SDNAR370',
  'SDNAR371', 'SDNAR372', 'SDNAR373', 'SDNAR374', 'SDNAR375', 'SDNAR376', 'SDNAR377', 'SDNAR378',
  'SDNAR379', 'SDNAR380', 'SDNAR381', 'SDNAR382',
  'SDPCAT1', 'SDPCAT2', 'SDPCAT3', 'SDPCAT4', 'SDPCAT5',
]);

export const STRIPAIR_SOUND_MANIFEST = Object.freeze(
  Object.fromEntries(
    STRIPAIR_SOUND_NAMES.map((name) => [name, `../assets/stripair/${name}.wav`])
  )
);
