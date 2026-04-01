import { AIRPORT_RESOURCES } from './resources.js';
import { AIRPORT_DEFAULT_STATE } from './state.js';
import { AIRPORT_ACTIVE_INTERACTIONS } from './theme-layout.js';

const DIALOGS = AIRPORT_RESOURCES.dialogBySection;
const MESSAGES = AIRPORT_RESOURCES.messageBySection;
const TEXT_REFS = AIRPORT_RESOURCES.textRefBySection;

const GUARD_SEQUENCE = Object.freeze([1, 1, 1, 2, 1, 3, 4, 3, 1, 5, 6, 7, 6, 1, 8, 9, 10, 1]);
const CLERK_SEQUENCE = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
const BRDTLK_SEQUENCE = Object.freeze([1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,3,4,3,4,3,1,1,1,5,6,5,6,7,8,7,8,5,6,1,1,9,10,9,10,11,10,9,1,1,1,1,1]);
const FEMTLK_SEQUENCE = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
const FAMTLK_SEQUENCE = Object.freeze([1, 2, 3, 4, 5, 6]);

function speakerVisualFromSpritePart(spritePart) {
  const family = spritePart.split(/\s+/)[0];
  switch (family) {
    case 'GrdTlk':
      return {
        speaker: 'Guard',
        speakerBase: 'GRDTLK0',
        speakerOverlay: { prefix: 'GRDTLK', ox: 49, oy: 11, rate: 8, sequence: GUARD_SEQUENCE },
        speakerStaticOverlay: { asset: 'GRDPNT1', ox: 49, oy: 11 },
      };
    case 'GrdPnt':
      return {
        speaker: 'Guard',
        speakerBase: 'GRDPNT0',
        speakerOverlay: { prefix: 'GRDPNT', ox: 49, oy: 11, rate: 8, sequence: GUARD_SEQUENCE },
        speakerStaticOverlay: { asset: 'GRDPNT1', ox: 49, oy: 11 },
      };
    case 'Lost':
      return {
        speaker: 'Clerk',
        speakerBase: 'CLRK0',
        speakerFrames: { prefix: 'CLRK', rate: 8, sequence: CLERK_SEQUENCE },
      };
    case 'BrdTlk':
      return {
        speaker: 'Passport Officer',
        speakerBase: 'BRDTLK0',
        speakerOverlay: { prefix: 'BRDTLK', ox: 73, oy: 21, rate: 8, sequence: BRDTLK_SEQUENCE },
      };
    case 'FemTlk':
      return {
        speaker: 'Woman Guard',
        speakerBase: 'FEMTLK0',
        speakerOverlay: { prefix: 'FEMTLK', ox: 59, oy: 15, rate: 8, sequence: FEMTLK_SEQUENCE },
        speakerStaticOverlay: { asset: 'FEMTLK1', ox: 59, oy: 15 },
      };
    case 'FamTlk':
      return {
        speaker: 'Family',
        speakerBase: 'FAMTLK0',
        speakerOverlay: { prefix: 'FAMTLK', ox: 48, oy: 41, rate: 8, sequence: FAMTLK_SEQUENCE },
        speakerStaticOverlay: { asset: 'FAMTLK1', ox: 48, oy: 41 },
      };
    default:
      return {};
  }
}

function eventStep(id) {
  return [{ type: 'event', id }];
}

function messageStep(id) {
  return [{ type: 'message', id }];
}

function talkMessageFromSection(sectionId, extra = {}) {
  const message = MESSAGES[sectionId];
  return {
    presentation: 'talk',
    sound: message.speaker.sound,
    text: message.text,
    ...speakerVisualFromSpritePart(message.speaker.spritePart),
    ...extra,
  };
}

function dialogFromSection(sectionId, gotoMap) {
  const dialog = DIALOGS[sectionId];
  return {
    ...speakerVisualFromSpritePart(dialog.speaker.spritePart),
    prompt: dialog.prompt,
    promptSound: dialog.speaker.sound,
    question: dialog.question,
    choices: dialog.choices.map((label, index) => {
      const response = dialog.responses[index];
      const event = gotoMap[response.gotoSection] || [];
      return {
        label,
        responseText: response.text,
        responseSound: response.sound,
        event,
      };
    }),
  };
}

export const AIRPORT_SCRIPT = {
  initialState: AIRPORT_DEFAULT_STATE,

  bindings: [
    { type: 'objectVisible', object: 'Family', when: { state: 'familyQueue', equals: 'queued' } },
    { type: 'interactionEnabled', interaction: 'familyQueue', when: { state: 'familyQueue', equals: 'queued' } },
  ],

  fallbacks: {
    look: 'lookDefault',
    talk: 'talkDefault',
    touch: 'touchDefault',
    bag: 'bagDefault',
  },

  interactions: AIRPORT_ACTIVE_INTERACTIONS,

  forms: {
    lostAndFoundForm: {
      asset: 'FORM',
      reminder: TEXT_REFS[800].text,
      fields: Object.freeze([
        { label: TEXT_REFS[830].lines[0], labelX: 20, inputX: 130, y: 84, maxWidth: 162, prefix: 'My name is ' },
        { label: TEXT_REFS[830].lines[1], labelX: 20, inputX: 130, y: 102, maxWidth: 162, prefix: 'I lost my ' },
        { label: TEXT_REFS[830].lines[2], labelX: 20, inputX: 130, y: 120, maxWidth: 162, prefix: 'It is ' },
        { label: TEXT_REFS[830].lines[3], labelX: 20, inputX: 130, y: 138, maxWidth: 162, prefix: 'It is ' },
      ]),
      errorY: 172,
      errorColor: '#000000',
    },
  },

  events: {
    'guard.directions': [
      { type: 'walkTo', x: 720, y: 120 },
      { type: 'face', dir: 9 },
      { type: 'dialog', id: 'guardQuestion' },
    ],

    'clerk.help': [
      { type: 'walkTo', x: 210, y: 125 },
      { type: 'face', dir: 7 },
      {
        if: { state: 'bag' },
        then: [{ type: 'event', id: 'clerkRepeat' }],
        else: [{ type: 'dialog', id: 'clerkQuestion' }],
      },
    ],

    clerkRepeat: [
      {
        if: { state: 'clerkAnnoyanceLevel', gte: 2 },
        then: messageStep('clerkRepeat3'),
        else: [
          {
            if: { state: 'clerkAnnoyanceLevel', equals: 1 },
            then: messageStep('clerkRepeat2'),
            else: messageStep('clerkRepeat1'),
          },
        ],
      },
      { type: 'incState', key: 'clerkAnnoyanceLevel', amount: 1 },
    ],

    'passport.control': [
      { type: 'walkTo', x: 490, y: 140 },
      { type: 'face', dir: 8 },
      {
        if: { state: 'mayExit', equals: true },
        then: messageStep('passportRepeat'),
        else: [
          {
            if: { state: 'familyQueue', equals: 'queued' },
            then: messageStep('passportBlocked'),
            else: messageStep('passportAsk'),
          },
        ],
      },
    ],

    'family.queue': [
      { type: 'walkTo', x: 520, y: 150 },
      { type: 'face', dir: 9 },
      { type: 'message', id: 'familyNoEnglish' },
    ],
    'womanGuard.block': [
      { type: 'walkTo', x: 330, y: 130 },
      { type: 'face', dir: 7 },
      { type: 'dialog', id: 'womanGuardQuestion' },
    ],
    'womanGuard.touch': [
      { type: 'walkTo', x: 330, y: 130 },
      { type: 'face', dir: 7 },
      { type: 'message', id: 'womanGuardTouch' },
    ],
    lookFloor: [{ type: 'message', id: 'lookFloor' }],
    touchFloor: [{ type: 'message', id: 'touchFloor' }],
    lookDefault: [{ type: 'message', id: 'lookDefault' }],
    talkDefault: [{ type: 'message', id: 'talkDefault' }],
    touchDefault: [{ type: 'message', id: 'touchDefault' }],
    bagDefault: [{ type: 'message', id: 'bagDefault' }],
    bagMissing: [{ type: 'message', id: 'bagMissing' }],

    'upstairs.block': [
      { type: 'walkTo', x: 820, y: 135 },
      {
        if: { state: 'mayExit', equals: true },
        then: [{ type: 'message', id: 'upstairsLater' }],
        else: [{ type: 'message', id: 'guardTooSoon' }],
      },
    ],

    'exit.doors': [
      {
        if: { state: 'mayExit', equals: true },
        then: [{ type: 'message', id: 'doorReady' }],
        else: [
          { type: 'walkTo', x: 323, y: 130 },
          {
            if: { state: 'exitWarningLevel', gte: 2 },
            then: [
              { type: 'message', id: 'doorWarning3' },
              { type: 'incState', key: 'exitWarningLevel', amount: 1 },
              { type: 'transition', target: { scene: 'arrest', reasonCode: 503 } },
            ],
            else: [
              {
                if: { state: 'exitWarningLevel', equals: 1 },
                then: [
                  { type: 'message', id: 'doorWarning2' },
                  { type: 'incState', key: 'exitWarningLevel', amount: 1 },
                ],
                else: [
                  { type: 'message', id: 'doorWarning1' },
                  { type: 'incState', key: 'exitWarningLevel', amount: 1 },
                ],
              },
            ],
          },
        ],
      },
    ],
    'passport.control.usePassport': [
      { type: 'walkTo', x: 490, y: 140 },
      { type: 'face', dir: 8 },
      {
        if: { state: 'mayExit', equals: true },
        then: messageStep('passportRepeat'),
        else: [
          {
            if: { state: 'familyQueue', equals: 'queued' },
            then: [
              { type: 'message', id: 'passportThanks' },
              { type: 'dialog', id: 'passportQuestion' },
            ],
            else: messageStep('passportBlocked'),
          },
        ],
      },
    ],

    clerkBig: [
      { type: 'setState', key: 'claimSize', value: 'big' },
      { type: 'message', id: 'clerkBig' },
      { type: 'dialog', id: 'clerkColorQuestion' },
    ],
    clerkSmall: [
      { type: 'setState', key: 'claimSize', value: 'small' },
      { type: 'message', id: 'clerkSmall' },
      { type: 'dialog', id: 'clerkColorQuestion' },
    ],
    clerkMedium: [
      { type: 'setState', key: 'claimSize', value: 'medium' },
      { type: 'message', id: 'clerkMedium' },
      { type: 'dialog', id: 'clerkColorQuestion' },
    ],
    clerkGrey: [
      { type: 'setState', key: 'claimColor', value: 'grey' },
      { type: 'setState', key: 'claimMatchesBag', value: false },
      {
        if: { state: 'claimSize', equals: 'big' },
        then: messageStep('clerkGreyBig'),
        else: [
          {
            if: { state: 'claimSize', equals: 'medium' },
            then: messageStep('clerkGreyMedium'),
            else: messageStep('clerkGreySmall'),
          },
        ],
      },
      { type: 'event', id: 'clerkForm' },
    ],
    clerkPurple: [
      { type: 'setState', key: 'claimColor', value: 'purple' },
      { type: 'setState', key: 'claimMatchesBag', value: false },
      {
        if: { state: 'claimSize', equals: 'big' },
        then: messageStep('clerkPurpleBig'),
        else: [
          {
            if: { state: 'claimSize', equals: 'medium' },
            then: messageStep('clerkPurpleMedium'),
            else: messageStep('clerkPurpleSmall'),
          },
        ],
      },
      { type: 'event', id: 'clerkForm' },
    ],
    clerkPink: [
      { type: 'setState', key: 'claimColor', value: 'pink' },
      {
        if: { state: 'claimSize', equals: 'small' },
        then: [{ type: 'setState', key: 'claimMatchesBag', value: true }],
        else: [{ type: 'setState', key: 'claimMatchesBag', value: false }],
      },
      {
        if: { state: 'claimSize', equals: 'big' },
        then: messageStep('clerkPinkBig'),
        else: [
          {
            if: { state: 'claimSize', equals: 'medium' },
            then: messageStep('clerkPinkMedium'),
            else: messageStep('clerkPinkSmall'),
          },
        ],
      },
      { type: 'event', id: 'clerkForm' },
    ],
    clerkForm: [
      { type: 'message', id: 'clerkFillForm' },
      { type: 'form', id: 'lostAndFoundForm' },
    ],
    receiveBag: [
      { type: 'message', id: 'clerkThanks' },
      { type: 'sceneAnimation', id: 'clerkHandOff' },
      { type: 'message', id: 'clerkBag' },
      { type: 'setState', key: 'palmettoes', value: 90 },
      { type: 'setState', key: 'bag', value: ['passport', 'letter'] },
      { type: 'setState', key: 'familyQueue', value: 'queued' },
      { type: 'setState', key: 'clerkAnnoyanceLevel', value: 0 },
      { type: 'setState', key: 'claimSize', value: null },
      { type: 'setState', key: 'claimColor', value: null },
      { type: 'setState', key: 'claimMatchesBag', value: false },
    ],
    wrongBag: [
      { type: 'message', id: 'clerkThanks' },
      { type: 'sceneAnimation', id: 'clerkHandOff' },
      { type: 'message', id: 'clerkBag' },
      { type: 'message', id: 'clerkWrongBag' },
      { type: 'transition', target: { scene: 'arrest', reasonCode: 504 } },
    ],

    passportHoliday: [
      { type: 'message', id: 'passportHolidayFee' },
      { type: 'setState', key: 'palmettoes', value: 85 },
      { type: 'setState', key: 'mayExit', value: true },
      { type: 'setState', key: 'familyQueue', value: 'cleared' },
      { type: 'message', id: 'passportClear' },
    ],
    passportBusiness: [
      { type: 'message', id: 'passportBusinessFee' },
      { type: 'setState', key: 'palmettoes', value: 85 },
      { type: 'setState', key: 'mayExit', value: true },
      { type: 'setState', key: 'familyQueue', value: 'cleared' },
      { type: 'message', id: 'passportClear' },
    ],
    passportSpy: [
      { type: 'transition', target: { scene: 'arrest', reasonCode: 501 } },
    ],
  },

  dialogs: {
    guardQuestion: dialogFromSection(2010, {
      151: messageStep('guardHotel'),
      152: messageStep('guardBag'),
      153: messageStep('guardFood'),
      154: messageStep('guardTaxi'),
    }),
    clerkQuestion: dialogFromSection(2100, {
      311: messageStep('clerkNotInfo'),
      2110: [{ type: 'dialog', id: 'clerkBigQuestion' }],
    }),
    clerkBigQuestion: dialogFromSection(2110, {
      316: eventStep('clerkBig'),
      2120: [{ type: 'dialog', id: 'clerkSmallQuestion' }],
    }),
    clerkSmallQuestion: dialogFromSection(2120, {
      317: eventStep('clerkSmall'),
      318: eventStep('clerkMedium'),
    }),
    clerkColorQuestion: dialogFromSection(2150, {
      321: eventStep('clerkGrey'),
      322: eventStep('clerkPurple'),
      323: eventStep('clerkPink'),
    }),
    passportQuestion: dialogFromSection(2300, {
      225: eventStep('passportHoliday'),
      226: eventStep('passportBusiness'),
      227: eventStep('passportSpy'),
    }),
    womanGuardQuestion: dialogFromSection(2310, {
      461: messageStep('womanGuardHotel'),
      462: messageStep('womanGuardBag'),
      463: messageStep('womanGuardFood'),
      464: messageStep('womanGuardTaxi'),
    }),
  },

  messages: {
    guardTooSoon: talkMessageFromSection(1010),
    guardHotel: talkMessageFromSection(1021),
    guardBag: talkMessageFromSection(1022),
    guardFood: talkMessageFromSection(1023),
    guardTaxi: talkMessageFromSection(1024),
    passportAsk: talkMessageFromSection(1030),
    passportBlocked: talkMessageFromSection(1031),
    passportClear: talkMessageFromSection(1032),
    passportThanks: talkMessageFromSection(1040),
    passportRepeat: talkMessageFromSection(1050),
    passportHolidayFee: talkMessageFromSection(1060),
    passportBusinessFee: talkMessageFromSection(1070),
    doorWarning1: talkMessageFromSection(1080),
    doorWarning2: talkMessageFromSection(1081),
    doorWarning3: talkMessageFromSection(1082),
    clerkBig: talkMessageFromSection(1100),
    clerkSmall: talkMessageFromSection(1110),
    clerkMedium: talkMessageFromSection(1120),
    clerkGreyBig: talkMessageFromSection(1121),
    clerkGreyMedium: talkMessageFromSection(1122),
    clerkGreySmall: talkMessageFromSection(1123),
    clerkPurpleBig: talkMessageFromSection(1124),
    clerkPurpleMedium: talkMessageFromSection(1125),
    clerkPurpleSmall: talkMessageFromSection(1126),
    clerkPinkBig: talkMessageFromSection(1127),
    clerkPinkMedium: talkMessageFromSection(1128),
    clerkPinkSmall: talkMessageFromSection(1129),
    clerkFillForm: talkMessageFromSection(1135),
    clerkThanks: talkMessageFromSection(1136),
    clerkBag: talkMessageFromSection(1137),
    clerkRepeat1: talkMessageFromSection(1191),
    clerkRepeat2: talkMessageFromSection(1192),
    clerkRepeat3: talkMessageFromSection(1193),
    clerkNotInfo: talkMessageFromSection(1194),
    clerkWrongBag: talkMessageFromSection(1195),
    familyNoEnglish: talkMessageFromSection(1210),
    womanGuardTouch: talkMessageFromSection(1220),
    womanGuardHotel: talkMessageFromSection(1221),
    womanGuardBag: talkMessageFromSection(1222),
    womanGuardFood: talkMessageFromSection(1223),
    womanGuardTaxi: talkMessageFromSection(1224),
    bagMissing: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'You lost your bag!',
    },
    upstairsLater: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'You can head back once the rest of the airport is implemented.',
    },
    doorReady: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'The automatic doors are ready, but the next airport scene is not wired yet.',
    },
    lookFloor: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'It is the airport floor.',
    },
    touchFloor: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'Touching the floor will not help.',
    },
    lookDefault: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'There is nothing special to look at there.',
    },
    talkDefault: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'Talking to that will not help.',
    },
    touchDefault: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'Touching that will not help.',
    },
    bagDefault: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'That is not the right place to use the bag.',
    },
  },
};
