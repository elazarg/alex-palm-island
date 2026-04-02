export const AIRPORT_ENTITIES = Object.freeze({
  guard: Object.freeze({
    kind: 'npc',
    label: 'Airport Guard',
    sceneObjects: Object.freeze(['Guard', 'Maake']),
    speakerFamily: 'GrdTlk',
    textRefs: Object.freeze({ look: 510, genericTouch: 635 }),
    flows: Object.freeze(['guard.directions', 'upstairs.block']),
  }),
  hotelPoster: Object.freeze({
    kind: 'prop',
    label: 'Grand Hotel Poster',
    textRefs: Object.freeze({ inspect: 520, touch: 525, detail: 810 }),
  }),
  orangePoster: Object.freeze({
    kind: 'prop',
    label: 'Orange Juice Poster',
    textRefs: Object.freeze({ inspect: 530, detail: 820 }),
  }),
  baggageCart: Object.freeze({
    kind: 'prop',
    label: 'Baggage Cart',
    textRefs: Object.freeze({ look: 540 }),
  }),
  passportCounter: Object.freeze({
    kind: 'prop',
    label: 'Passport Counter',
    textRefs: Object.freeze({ look: 550 }),
  }),
  passportOfficer: Object.freeze({
    kind: 'npc',
    label: 'Passport Officer',
    sceneObjects: Object.freeze(['BrdTlk']),
    speakerFamily: 'BrdTlk',
    textRefs: Object.freeze({ look: 560, genericTouch: 635 }),
    flows: Object.freeze(['passport.control']),
  }),
  queueSign: Object.freeze({
    kind: 'prop',
    label: 'Please Wait Your Turn Sign',
    sceneObjects: Object.freeze(['LineSign']),
    textRefs: Object.freeze({ look: 570, touch: 575 }),
  }),
  lostAndFoundCounter: Object.freeze({
    kind: 'prop',
    label: 'Lost and Found Counter',
    textRefs: Object.freeze({ look: 580, touch: 600 }),
  }),
  namedBag: Object.freeze({
    kind: 'prop',
    label: 'Named Bag',
    textRefs: Object.freeze({ look: 590, wrongBag: 610, bagMissing: 998, notYourBag: 999 }),
  }),
  clerk: Object.freeze({
    kind: 'npc',
    label: 'Lost and Found Clerk',
    sceneObjects: Object.freeze(['Achu']),
    speakerFamily: 'Lost',
    textRefs: Object.freeze({ look: 620, genericTouch: 635, counterLook: 680 }),
    flows: Object.freeze(['clerk.help']),
  }),
  familyQueue: Object.freeze({
    kind: 'npcGroup',
    label: 'Family Queue',
    sceneObjects: Object.freeze(['Family']),
    speakerFamily: 'FamTlk',
    textRefs: Object.freeze({ look: 630, genericTouch: 635 }),
    flows: Object.freeze(['family.queue']),
  }),
  escalator: Object.freeze({
    kind: 'traversal',
    label: 'Escalator',
    sceneObjects: Object.freeze(['Stairs']),
    textRefs: Object.freeze({ look: 640, touch: 645 }),
    flows: Object.freeze(['upstairs.block']),
  }),
  lostAndFoundForm: Object.freeze({
    kind: 'uiForm',
    label: 'Lost and Found Form',
    textRefs: Object.freeze({ open: 650, fields: 830, capsReminder: 800 }),
    flows: Object.freeze(['clerk.help']),
  }),
  automaticDoors: Object.freeze({
    kind: 'traversal',
    label: 'Automatic Doors',
    sceneObjects: Object.freeze(['Door']),
    textRefs: Object.freeze({ look: 660, touch: 665 }),
    flows: Object.freeze(['exit.doors']),
  }),
  exitSign: Object.freeze({
    kind: 'sign',
    label: 'Exit Sign',
    textRefs: Object.freeze({ look: 670 }),
  }),
  womanGuard: Object.freeze({
    kind: 'npc',
    label: 'Woman Guard',
    sceneObjects: Object.freeze(['FemGrd']),
    speakerFamily: 'FemTlk',
    textRefs: Object.freeze({ look: 690, genericTouch: 1220 }),
    flows: Object.freeze(['womanGuard.block']),
  }),
});

export const AIRPORT_SEMANTIC_HOTSPOTS = Object.freeze([
  Object.freeze({
    id: 'upstairsExit',
    entity: 'escalator',
    scope: 'world',
    affordances: Object.freeze({
      walk: Object.freeze({ kind: 'flow', id: 'upstairs.block' }),
    }),
  }),
  Object.freeze({
    id: 'guard',
    entity: 'guard',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 510 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 635 }),
      talk: Object.freeze({ kind: 'flow', id: 'guard.directions' }),
      item: Object.freeze({ kind: 'flow', id: 'guard.directions' }),
    }),
  }),
  Object.freeze({
    id: 'hotelPoster',
    entity: 'hotelPoster',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 520 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 525 }),
    }),
  }),
  Object.freeze({
    id: 'orangePoster',
    entity: 'orangePoster',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 530 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 525 }),
    }),
  }),
  Object.freeze({
    id: 'baggageCart',
    entity: 'baggageCart',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 540 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 610 }),
    }),
  }),
  Object.freeze({
    id: 'passportCounter',
    entity: 'passportCounter',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 550 }),
    }),
  }),
  Object.freeze({
    id: 'passportOfficer',
    entity: 'passportOfficer',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 560 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 635 }),
      talk: Object.freeze({ kind: 'flow', id: 'passport.control' }),
      item: Object.freeze({ kind: 'flow', id: 'passport.control.usePassport' }),
    }),
  }),
  Object.freeze({
    id: 'queueSign',
    entity: 'queueSign',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 570 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 575 }),
    }),
  }),
  Object.freeze({
    id: 'lostAndFoundCounter',
    entity: 'lostAndFoundCounter',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 580 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 600 }),
    }),
  }),
  Object.freeze({
    id: 'clerk',
    entity: 'clerk',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 620 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 635 }),
      talk: Object.freeze({ kind: 'flow', id: 'clerk.help' }),
      item: Object.freeze({ kind: 'flow', id: 'clerk.help' }),
    }),
  }),
  Object.freeze({
    id: 'familyQueue',
    entity: 'familyQueue',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 630 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 635 }),
      talk: Object.freeze({ kind: 'flow', id: 'family.queue' }),
    }),
  }),
  Object.freeze({
    id: 'escalator',
    entity: 'escalator',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 640 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 645 }),
      walk: Object.freeze({ kind: 'flow', id: 'upstairs.block' }),
    }),
  }),
  Object.freeze({
    id: 'automaticDoors',
    entity: 'automaticDoors',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 660 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 665 }),
      walk: Object.freeze({ kind: 'flow', id: 'exit.doors' }),
    }),
  }),
  Object.freeze({
    id: 'exitSign',
    entity: 'exitSign',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 670 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 525 }),
    }),
  }),
  Object.freeze({
    id: 'lostAndFoundDeskFront',
    entity: 'clerk',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 680 }),
    }),
  }),
  Object.freeze({
    id: 'womanGuard',
    entity: 'womanGuard',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 690 }),
      touch: Object.freeze({ kind: 'flow', id: 'womanGuard.touch' }),
      talk: Object.freeze({ kind: 'flow', id: 'womanGuard.block' }),
    }),
  }),
  Object.freeze({
    id: 'lostAndFoundForm',
    entity: 'lostAndFoundForm',
    scope: 'overlay',
    affordances: Object.freeze({
      inspect: Object.freeze({ kind: 'textRef', sectionId: 650 }),
      read: Object.freeze({ kind: 'textRef', sectionId: 830 }),
    }),
  }),
  Object.freeze({
    id: 'bagMissingSystem',
    entity: 'namedBag',
    scope: 'system',
    affordances: Object.freeze({
      item: Object.freeze({ kind: 'textRef', sectionId: 998 }),
    }),
  }),
]);

export const AIRPORT_TRIGGER_TREES = Object.freeze({
  'upstairs.block': Object.freeze({
    rootSection: 140,
    kind: 'gate',
    purpose: 'Prevent immediate upstairs departure',
    outcome: Object.freeze({ type: 'speech', sectionId: 1010 }),
  }),
  'guard.directions': Object.freeze({
    rootSection: 150,
    kind: 'choiceDialog',
    dialogSection: 2010,
    purpose: 'Ask the guard where to go',
    branches: Object.freeze([
      Object.freeze({ choice: 'a hotel', sectionId: 151, outcomeSection: 1021 }),
      Object.freeze({ choice: 'my bag', sectionId: 152, outcomeSection: 1022 }),
      Object.freeze({ choice: 'something to eat', sectionId: 153, outcomeSection: 1023 }),
      Object.freeze({ choice: 'a taxi to town', sectionId: 154, outcomeSection: 1024 }),
    ]),
  }),
  'family.queue': Object.freeze({
    rootSection: 170,
    kind: 'singleResponse',
    outcomeSection: 1210,
    purpose: 'Family blocks the passport line until later',
  }),
  'passport.control': Object.freeze({
    rootSections: Object.freeze([210, 220, 221, 222, 225, 226, 229]),
    kind: 'gatedConversation',
    purpose: 'Passport check, payment, and departure permission',
    gates: Object.freeze([
      Object.freeze({ flag: 1010, meaning: 'passport fee paid / stay admitted' }),
      Object.freeze({ flag: 1011, meaning: 'bag retrieval state influences repeat path' }),
      Object.freeze({ flag: 1009, meaning: 'correct bag identified' }),
    ]),
    outcomes: Object.freeze([
      Object.freeze({ sectionId: 1030, meaning: 'ask for passport' }),
      Object.freeze({ sectionId: 1031, meaning: 'read the sign / blocked' }),
      Object.freeze({ sectionId: 1032, meaning: 'you may go' }),
      Object.freeze({ sectionId: 1040, meaning: 'thanks before quiz' }),
      Object.freeze({ sectionId: 1050, meaning: 'redundant passport retry' }),
      Object.freeze({ sectionId: 1060, meaning: 'holiday fee line' }),
      Object.freeze({ sectionId: 1070, meaning: 'work fee line' }),
    ]),
  }),
  'passport.control.usePassport': Object.freeze({
    rootSection: 221,
    kind: 'itemUse',
    item: 'PassportIcon',
    followupSection: 222,
  }),
  'clerk.help': Object.freeze({
    rootSection: 310,
    kind: 'puzzleDialog',
    purpose: 'Lost-and-found bag recovery puzzle',
    stages: Object.freeze([
      Object.freeze({ sectionId: 2100, meaning: 'initial question' }),
      Object.freeze({ sectionId: 2110, meaning: 'is it big?' }),
      Object.freeze({ sectionId: 2120, meaning: 'is it small?' }),
      Object.freeze({ sectionId: 2150, meaning: 'what colour is it?' }),
      Object.freeze({ sectionId: 324, meaning: 'show form' }),
      Object.freeze({ sectionId: 325, meaning: 'bag handout + fee / arrest' }),
    ]),
    repeatBranches: Object.freeze([
      Object.freeze({ gateFlag: 1016, outcomeSection: 1193 }),
      Object.freeze({ gateFlag: 1015, outcomeSection: 1192 }),
      Object.freeze({ gateFlag: 1005, outcomeSection: 1191 }),
    ]),
    wrongIntentBranch: Object.freeze({ sectionId: 311, outcomeSection: 1194 }),
    puzzleFlags: Object.freeze([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1011, 1015, 1016]),
  }),
  'exit.doors': Object.freeze({
    rootSections: Object.freeze([410, 420, 430, 440]),
    kind: 'gate',
    purpose: 'Automatic door exit with warning/escalation and family blocker release',
    warningSections: Object.freeze([1080, 1081, 1082]),
    stateFlags: Object.freeze([1010, 1011, 1012, 1013]),
  }),
  'womanGuard.touch': Object.freeze({
    rootSection: 450,
    kind: 'singleResponse',
    outcomeSection: 1220,
  }),
  'womanGuard.block': Object.freeze({
    rootSections: Object.freeze([460, 461, 462, 463, 464]),
    kind: 'choiceDialog',
    dialogSection: 2310,
    branches: Object.freeze([
      Object.freeze({ outcomeSection: 1221, meaning: 'read the sign' }),
      Object.freeze({ outcomeSection: 1222, meaning: 'go to lost and found' }),
      Object.freeze({ outcomeSection: 1223, meaning: 'go to burger bar' }),
      Object.freeze({ outcomeSection: 1224, meaning: 'no taxis today' }),
    ]),
  }),
});
