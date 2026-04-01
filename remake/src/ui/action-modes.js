export const ACTION_MODES = Object.freeze(['walk', 'talk', 'look', 'touch', 'bag']);

export const WHEEL_INPUT_MODES = Object.freeze(['walk', 'talk', 'look', 'touch']);

export const ACTION_BUTTONS = Object.freeze([
  { mode: 'bag', normal: 'NOBAG', active: 'CASEBUTTON', pressed: 'CASEPRESSED', x: 4, y: 167, w: 44, h: 33 },
  { mode: 'walk', normal: 'WALKBUTTON', pressed: 'WALKPRESSED', x: 68, y: 168, w: 48, h: 31 },
  { mode: 'talk', normal: 'TALKBUTTON', pressed: 'TALKPRESSED', x: 120, y: 169, w: 40, h: 31 },
  { mode: 'look', normal: 'LOOKBUTTON', pressed: 'LOOKPRESSED', x: 164, y: 168, w: 44, h: 31 },
  { mode: 'touch', normal: 'TOUCHBUTTON', pressed: 'TOUCHPRESSED', x: 212, y: 168, w: 40, h: 32 },
  { mode: 'exit', normal: 'EXITBUTTON', pressed: 'EXITPRESSED', x: 276, y: 168, w: 40, h: 31 },
]);

export const CURSOR_HOTSPOTS = Object.freeze({
  ARROWCURSOR: { x: 0, y: 7 },
  WALKCURSOR: { x: 0, y: 0 },
  LOOKCURSOR: { x: 0, y: 0 },
  TALKCURSOR: { x: 0, y: 0 },
  TOUCHCURSOR: { x: 0, y: 0 },
});

export function resolveActionButtonSprite(button, { pressedMode = null, bagReceived = false } = {}) {
  if (button.mode === 'bag') {
    if (pressedMode === 'bag') return button.pressed;
    return bagReceived ? button.active : button.normal;
  }
  return pressedMode === button.mode ? button.pressed : button.normal;
}
