export const ACTION_MODES = Object.freeze(['walk', 'talk', 'look', 'touch', 'bag']);

export const WHEEL_INPUT_MODES = Object.freeze(['walk', 'talk', 'look', 'touch']);

export const ACTION_BUTTONS = Object.freeze([
  { mode: 'bag', kind: 'utility', covered: 'NOBAG', active: 'CASEBUTTON', pressed: 'CASEPRESSED', x: 2, y: 167, w: 44, h: 33 },
  { mode: 'map', kind: 'utility', covered: 'NOMAP', active: 'MAPBUTTON', pressed: 'MAPPRESSED', x: 47, y: 167, w: 40, h: 33 },
  { mode: 'walk', kind: 'action', normal: 'WALKBUTTON', pressed: 'WALKPRESSED', x: 86, y: 168, w: 48, h: 31 },
  { mode: 'talk', kind: 'action', normal: 'TALKBUTTON', pressed: 'TALKPRESSED', x: 134, y: 169, w: 40, h: 31 },
  { mode: 'look', kind: 'action', normal: 'LOOKBUTTON', pressed: 'LOOKPRESSED', x: 175, y: 168, w: 44, h: 31 },
  { mode: 'touch', kind: 'action', normal: 'TOUCHBUTTON', pressed: 'TOUCHPRESSED', x: 219, y: 168, w: 40, h: 32 },
  { mode: 'exit', kind: 'action', normal: 'EXITBUTTON', pressed: 'EXITPRESSED', x: 280, y: 168, w: 40, h: 31 },
]);

export const CURSOR_HOTSPOTS = Object.freeze({
  ARROWCURSOR: { x: 0, y: 7 },
  WALKCURSOR: { x: 0, y: 5 },
  LOOKCURSOR: { x: 0, y: 0 },
  TALKCURSOR: { x: 0, y: 0 },
  TOUCHCURSOR: { x: 0, y: 0 },
});

export function resolveInteractionMode(inputMode) {
  if (inputMode === 'item') return 'item';
  return inputMode;
}

export function resolveActionButtonSprite(button, { pressedMode = null, buttonStates = {} } = {}) {
  if (button.kind === 'utility') {
    const state = buttonStates[button.mode] || 'covered';
    if (state === 'hidden') return null;
    if (pressedMode === button.mode) return button.pressed;
    return state === 'active' ? button.active : button.covered;
  }
  return pressedMode === button.mode ? button.pressed : button.normal;
}
