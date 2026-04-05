export const UI_VERSION = '20260405a';

export const UI_ASSET_NAMES = Object.freeze([
  'PANEL',
  'LOOKBUTTON',
  'LOOKPRESSED',
  'TALKBUTTON',
  'TALKPRESSED',
  'TOUCHBUTTON',
  'TOUCHPRESSED',
  'WALKBUTTON',
  'WALKPRESSED',
  'CASEBUTTON',
  'CASEPRESSED',
  'NOBAG',
  'MAPBUTTON',
  'MAPPRESSED',
  'NOMAP',
  'EXITBUTTON',
  'EXITPRESSED',
  'METER',
  'MONEYBOX',
  'MONEY1',
  'MONEY2',
  'MONEY3',
  'MONEY4',
  'TALKWINDOW',
  'TEXTWIN2',
  'TEXTWIN3',
  'TEXTWIN4',
  'TEXTWIN5',
  'TLKEXIT1',
  'TLKEXIT2',
  'TALKTOP',
  'HEARWINDOW',
  'HEARMASK',
  'TALKMASK1',
  'TALKMASK2',
  'DIALOGBOX',
  'MAP',
]);

export const ALEX_DIALOG_ASSET_NAMES = Object.freeze(
  Array.from({ length: 18 }, (_, index) => `ALTALK${index + 1}`)
);

export const CURSOR_ASSET_NAMES = Object.freeze([
  'ARROWCURSOR',
  'LOOKCURSOR',
  'TALKCURSOR',
  'TOUCHCURSOR',
  'WALKCURSOR',
]);
