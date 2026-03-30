export const AIRPORT_SCRIPT = {
  initialState: {
    bagReceived: false,
    passportChecked: false,
    doorWarnings: 0,
    clerkRepeatCount: 0,
    palmettoes: 100,
  },

  bindings: [
    { type: 'objectVisible', object: 'Family', when: { state: 'bagReceived', equals: true } },
    { type: 'interactionEnabled', interaction: 'family', when: { state: 'bagReceived', equals: true } },
  ],

  fallbacks: {
    look: 'lookDefault',
    talk: 'talkDefault',
    touch: 'touchDefault',
    bag: 'bagDefault',
  },

  interactions: [
    {
      id: 'upstairsExit',
      rect: [825, 110, 915, 130],
      modes: { look: 'lookExit', walk: 'upstairsExit' },
    },
    {
      id: 'doorExit',
      rect: [273, 85, 373, 100],
      modes: { look: 'lookDoors', touch: 'touchDoors', walk: 'doorExit' },
    },
    {
      id: 'guard',
      object: 'Guard',
      sprite: 'GUARD1',
      pad: [8, 0, -12, -2],
      modes: { look: 'lookGuard', touch: 'touchPeople', talk: 'guardIntro' },
    },
    {
      id: 'clerk',
      object: 'Achu',
      sprite: 'ACHU1',
      pad: [-8, -8, 8, 4],
      modes: { look: 'lookLostCounter', touch: 'touchLostCounter', talk: 'clerkIntro' },
    },
    {
      id: 'passportOfficer',
      object: 'BrdTlk',
      sprite: 'BRDTLK0',
      pad: [28, 0, -6, 0],
      modes: { look: 'lookPassportOfficer', touch: 'touchPeople', talk: 'passportCheck' },
    },
    {
      id: 'family',
      object: 'Family',
      sprite: 'FAMILY1',
      pad: [0, 0, -76, 0],
      enabled: false,
      modes: { look: 'familyQueue', touch: 'touchPeople', talk: 'familyTalk' },
    },
    {
      id: 'womanGuard',
      object: 'FemGrd',
      sprite: 'FEMGRD1',
      pad: [8, -6, -4, 0],
      modes: { look: 'lookWomanGuard', touch: 'touchPeople', talk: 'womanGuardTalk' },
    },
    {
      id: 'lineSign',
      object: 'LineSign',
      sprite: 'LINESIGN',
      pad: [0, 0, 0, 0],
      modes: { look: 'lookLineSign', touch: 'touchSign', talk: 'talkDefault' },
    },
    {
      id: 'stairs',
      object: 'Stairs',
      sprite: 'STAIRS1',
      pad: [0, 24, -60, 0],
      modes: { look: 'lookStairs', touch: 'touchStairs', talk: 'talkDefault' },
    },
    {
      id: 'floor',
      rect: [0, 120, 960, 166],
      modes: { look: 'lookFloor', touch: 'touchFloor', talk: 'talkDefault' },
    },
  ],

  events: {
    guardIntro: [
      { type: 'walkTo', x: 720, y: 120 },
      { type: 'face', dir: 9 },
      { type: 'dialog', id: 'guardQuestion' },
    ],

    clerkIntro: [
      { type: 'walkTo', x: 210, y: 125 },
      { type: 'face', dir: 7 },
      {
        if: { state: 'bagReceived', equals: true },
        then: [{ type: 'event', id: 'clerkRepeat' }],
        else: [{ type: 'dialog', id: 'clerkQuestion' }],
      },
    ],

    clerkRepeat: [
      {
        if: { state: 'clerkRepeatCount', gte: 2 },
        then: [{ type: 'message', id: 'clerkRepeat3' }],
        else: [
          {
            if: { state: 'clerkRepeatCount', equals: 1 },
            then: [{ type: 'message', id: 'clerkRepeat2' }],
            else: [{ type: 'message', id: 'clerkRepeat1' }],
          },
        ],
      },
      { type: 'incState', key: 'clerkRepeatCount', amount: 1 },
    ],

    receiveBag: [
      { type: 'message', id: 'clerkThanks' },
      { type: 'message', id: 'clerkBag' },
      { type: 'setState', key: 'palmettoes', value: 90 },
      { type: 'setState', key: 'bagReceived', value: true },
    ],

    passportCheck: [
      { type: 'walkTo', x: 490, y: 140 },
      { type: 'face', dir: 8 },
      {
        if: { state: 'passportChecked', equals: true },
        then: [{ type: 'message', id: 'passportRepeat' }],
        else: [
          {
            if: { state: 'bagReceived', equals: true },
            then: [
              { type: 'message', id: 'passportAsk' },
              { type: 'message', id: 'passportClear' },
              { type: 'setState', key: 'passportChecked', value: true },
            ],
            else: [{ type: 'message', id: 'passportBlocked' }],
          },
        ],
      },
    ],

    familyQueue: [
      { type: 'message', id: 'familyWaiting' },
    ],

    familyTalk: [
      { type: 'message', id: 'familyNoEnglish' },
    ],
    womanGuardTalk: [
      { type: 'message', id: 'doorWarning1' },
    ],

    lookGuard: [{ type: 'message', id: 'lookGuard' }],
    lookLostCounter: [{ type: 'message', id: 'lookLostCounter' }],
    lookPassportOfficer: [{ type: 'message', id: 'lookPassportOfficer' }],
    lookWomanGuard: [{ type: 'message', id: 'lookWomanGuard' }],
    lookLineSign: [{ type: 'message', id: 'lookLineSign' }],
    lookStairs: [{ type: 'message', id: 'lookStairs' }],
    lookFloor: [{ type: 'message', id: 'lookFloor' }],
    lookExit: [{ type: 'message', id: 'lookExit' }],
    lookDoors: [{ type: 'message', id: 'lookDoors' }],
    touchDoors: [{ type: 'message', id: 'touchDoors' }],
    touchFloor: [{ type: 'message', id: 'touchFloor' }],
    touchStairs: [{ type: 'message', id: 'touchStairs' }],
    touchSign: [{ type: 'message', id: 'touchSign' }],
    touchPeople: [{ type: 'message', id: 'touchPeople' }],
    touchLostCounter: [{ type: 'message', id: 'touchLostCounter' }],
    lookDefault: [{ type: 'message', id: 'lookDefault' }],
    talkDefault: [{ type: 'message', id: 'talkDefault' }],
    touchDefault: [{ type: 'message', id: 'touchDefault' }],
    bagDefault: [{ type: 'message', id: 'bagDefault' }],
    bagMissing: [{ type: 'message', id: 'bagMissing' }],

    upstairsExit: [
      {
        if: { state: 'passportChecked', equals: true },
        then: [{ type: 'message', id: 'upstairsLater' }],
        else: [{ type: 'message', id: 'guardTooSoon' }],
      },
    ],

    doorExit: [
      {
        if: { state: 'passportChecked', equals: true },
        then: [{ type: 'message', id: 'doorReady' }],
        else: [
          { type: 'walkTo', x: 323, y: 130 },
          {
            if: { state: 'doorWarnings', gte: 2 },
            then: [{ type: 'message', id: 'doorWarning3' }],
            else: [
              {
                if: { state: 'doorWarnings', equals: 1 },
                then: [{ type: 'message', id: 'doorWarning2' }],
                else: [{ type: 'message', id: 'doorWarning1' }],
              },
            ],
          },
          { type: 'incState', key: 'doorWarnings', amount: 1 },
        ],
      },
    ],
  },

  dialogs: {
    guardQuestion: {
      speaker: 'Guard',
      speakerSprite: 'GRDTLK0',
      speakerBase: 'GRDTLK0',
      speakerOverlay: { prefix: 'GRDTLK', ox: 52, oy: 12, rate: 8, sequence: [1, 1, 1, 2, 1, 3, 4, 3, 1, 5, 6, 7, 6, 1, 8, 9, 10, 1] },
      speakerX: 17,
      speakerY: 4,
      prompt: 'Good morning. Can I help you?',
      question: 'Yes, please. I am looking for:',
      choices: [
        { label: 'a hotel', event: [{ type: 'message', id: 'guardHotel' }] },
        { label: 'my bag', event: [{ type: 'message', id: 'guardBag' }] },
        { label: 'something to eat', event: [{ type: 'message', id: 'guardFood' }] },
        { label: 'a taxi to town', event: [{ type: 'message', id: 'guardTaxi' }] },
      ],
    },

    clerkQuestion: {
      speaker: 'Clerk',
      speakerSprite: 'LOST0',
      speakerX: 38,
      speakerY: 15,
      prompt: 'Good morning. Can I help you?',
      question: 'Yes, please. I am looking for:',
      choices: [
        { label: 'a hotel', event: [{ type: 'message', id: 'clerkNotInfo' }] },
        { label: 'my bag', event: [{ type: 'event', id: 'receiveBag' }] },
        { label: 'something to eat', event: [{ type: 'message', id: 'clerkNotInfo' }] },
        { label: 'a taxi to town', event: [{ type: 'message', id: 'clerkNotInfo' }] },
      ],
    },
  },

  messages: {
    guardTooSoon: {
      speaker: 'Guard',
      presentation: 'note',
      text: 'Not so fast, young man! You just got here!',
    },
    guardHotel: {
      speaker: 'Guard',
      presentation: 'talk',
      speakerBase: 'GRDTLK0',
      speakerOverlay: { prefix: 'GRDTLK', ox: 52, oy: 12, rate: 8, sequence: [1, 1, 1, 2, 1, 3, 4, 3, 1, 5, 6, 7, 6, 1, 8, 9, 10, 1] },
      speakerX: 17,
      speakerY: 4,
      text: 'Read this sign.',
    },
    guardBag: {
      speaker: 'Guard',
      presentation: 'talk',
      speakerBase: 'GRDTLK0',
      speakerOverlay: { prefix: 'GRDTLK', ox: 52, oy: 12, rate: 8, sequence: [1, 1, 1, 2, 1, 3, 4, 3, 1, 5, 6, 7, 6, 1, 8, 9, 10, 1] },
      speakerX: 17,
      speakerY: 4,
      text: 'Go to the "Lost and Found".',
    },
    guardFood: {
      speaker: 'Guard',
      presentation: 'talk',
      speakerBase: 'GRDTLK0',
      speakerOverlay: { prefix: 'GRDTLK', ox: 52, oy: 12, rate: 8, sequence: [1, 1, 1, 2, 1, 3, 4, 3, 1, 5, 6, 7, 6, 1, 8, 9, 10, 1] },
      speakerX: 17,
      speakerY: 4,
      text: 'Go to Big Bob\'s Burger Bar. The food is great there.',
    },
    guardTaxi: {
      speaker: 'Guard',
      presentation: 'talk',
      speakerBase: 'GRDTLK0',
      speakerOverlay: { prefix: 'GRDTLK', ox: 52, oy: 12, rate: 8, sequence: [1, 1, 1, 2, 1, 3, 4, 3, 1, 5, 6, 7, 6, 1, 8, 9, 10, 1] },
      speakerX: 17,
      speakerY: 4,
      text: 'Sorry, there are no taxis today. All the drivers are on strike.',
    },
    clerkNotInfo: {
      speaker: 'Clerk',
      presentation: 'note',
      text: 'You bubble-brain! What do I look like? Information?',
    },
    clerkThanks: {
      speaker: 'Clerk',
      presentation: 'note',
      text: 'Thank you.',
    },
    clerkBag: {
      speaker: 'Clerk',
      presentation: 'note',
      text: 'Here is your bag. You have to pay to play. That\'ll be ten Palmettoes.',
    },
    clerkRepeat1: {
      speaker: 'Clerk',
      presentation: 'note',
      text: 'What do you want from me now? I already gave you your bag!',
    },
    clerkRepeat2: {
      speaker: 'Clerk',
      presentation: 'note',
      text: 'Leave me alone! How many bags did you lose?',
    },
    clerkRepeat3: {
      speaker: 'Clerk',
      presentation: 'note',
      text: 'Go away! Stop bothering me!',
    },
    passportBlocked: {
      speaker: 'Passport Officer',
      presentation: 'note',
      text: 'Read the sign!',
    },
    passportAsk: {
      speaker: 'Passport Officer',
      presentation: 'note',
      text: 'May I see your passport, please?',
    },
    passportClear: {
      speaker: 'Passport Officer',
      presentation: 'note',
      text: 'Thank you, sir. You may go.',
    },
    passportRepeat: {
      speaker: 'Passport Officer',
      presentation: 'note',
      text: 'Why are you giving me your passport again, bubble-brain? I said, "Go!"',
    },
    familyWaiting: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'The family is waiting in line for the passport officer.',
    },
    familyNoEnglish: {
      speaker: 'Family',
      presentation: 'note',
      text: 'Sorry, we don\'t speak English.',
    },
    bagMissing: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'You lost your bag!',
    },
    doorWarning1: {
      speaker: 'Woman Guard',
      presentation: 'note',
      text: 'Not so fast, young man! You must show your passport to the passport officer.',
    },
    doorWarning2: {
      speaker: 'Woman Guard',
      presentation: 'note',
      text: 'Wasn\'t I clear the first time? The passport officer must check your passport before you leave.',
    },
    doorWarning3: {
      speaker: 'Woman Guard',
      presentation: 'note',
      text: 'You must show your passport to the passport officer! Now you are in trouble!',
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
    lookGuard: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'This man is a guard. He keeps people and places safe.',
    },
    lookLostCounter: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'This is the "Lost and Found" counter. People look for lost belongings here. There are lots of bags on the shelves. Look carefully. Can you see your bag?',
    },
    lookPassportOfficer: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'This is the passport officer. He is standing behind the counter.',
    },
    lookWomanGuard: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'This woman is guarding the exit.',
    },
    lookLineSign: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'People should stand in line here.',
    },
    lookStairs: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'These stairs go up to the departure lounge.',
    },
    lookFloor: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'It is the airport floor.',
    },
    lookExit: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'The sign says "Exit".',
    },
    lookDoors: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'These are automatic doors. They open and shut automatically.',
    },
    touchDoors: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'You shouldn\'t touch these automatic doors. You might get your fingers caught.',
    },
    touchFloor: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'Touching the floor will not help.',
    },
    touchStairs: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'You should use the stairs, not touch them.',
    },
    touchSign: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'There is no need to touch the sign.',
    },
    touchPeople: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'You shouldn\'t go around touching people.',
    },
    touchLostCounter: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'If you want a bag, ask for help.',
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
