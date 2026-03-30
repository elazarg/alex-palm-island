export const AIRPORT_SCRIPT = {
  initialState: {
    bagReceived: false,
    passportChecked: false,
    doorWarnings: 0,
    clerkRepeatCount: 0,
  },

  bindings: [
    { type: 'objectVisible', object: 'Family', when: { state: 'bagReceived', equals: true } },
    { type: 'interactionEnabled', interaction: 'family', when: { state: 'bagReceived', equals: true } },
  ],

  interactions: [
    {
      id: 'upstairsExit',
      rect: [825, 110, 915, 130],
      event: 'upstairsExit',
    },
    {
      id: 'doorExit',
      rect: [273, 85, 373, 100],
      event: 'doorExit',
    },
    {
      id: 'guard',
      rect: [776, 60, 960, 125],
      event: 'guardIntro',
    },
    {
      id: 'clerk',
      rect: [106, 0, 216, 105],
      event: 'clerkIntro',
    },
    {
      id: 'passportOfficer',
      rect: [447, 10, 507, 62],
      event: 'passportCheck',
    },
    {
      id: 'family',
      rect: [737, 12, 773, 94],
      enabled: false,
      event: 'familyQueue',
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
      text: 'Not so fast, young man! You just got here!',
    },
    guardHotel: {
      speaker: 'Guard',
      text: 'Read this sign.',
    },
    guardBag: {
      speaker: 'Guard',
      text: 'Go to the "Lost and Found".',
    },
    guardFood: {
      speaker: 'Guard',
      text: 'Go to Big Bob\'s Burger Bar. The food is great there.',
    },
    guardTaxi: {
      speaker: 'Guard',
      text: 'Sorry, there are no taxis today. All the drivers are on strike.',
    },
    clerkNotInfo: {
      speaker: 'Clerk',
      text: 'You bubble-brain! What do I look like? Information?',
    },
    clerkThanks: {
      speaker: 'Clerk',
      text: 'Thank you.',
    },
    clerkBag: {
      speaker: 'Clerk',
      text: 'Here is your bag. You have to pay to play. That\'ll be ten Palmettoes.',
    },
    clerkRepeat1: {
      speaker: 'Clerk',
      text: 'What do you want from me now? I already gave you your bag!',
    },
    clerkRepeat2: {
      speaker: 'Clerk',
      text: 'Leave me alone! How many bags did you lose?',
    },
    clerkRepeat3: {
      speaker: 'Clerk',
      text: 'Go away! Stop bothering me!',
    },
    passportBlocked: {
      speaker: 'Passport Officer',
      text: 'Read the sign!',
    },
    passportAsk: {
      speaker: 'Passport Officer',
      text: 'May I see your passport, please?',
    },
    passportClear: {
      speaker: 'Passport Officer',
      text: 'Thank you, sir. You may go.',
    },
    passportRepeat: {
      speaker: 'Passport Officer',
      text: 'Why are you giving me your passport again, bubble-brain? I said, "Go!"',
    },
    familyWaiting: {
      speaker: 'Narrator',
      text: 'The family is waiting in line for the passport officer.',
    },
    doorWarning1: {
      speaker: 'Woman Guard',
      text: 'Not so fast, young man! You must show your passport to the passport officer.',
    },
    doorWarning2: {
      speaker: 'Woman Guard',
      text: 'Wasn\'t I clear the first time? The passport officer must check your passport before you leave.',
    },
    doorWarning3: {
      speaker: 'Woman Guard',
      text: 'You must show your passport to the passport officer! Now you are in trouble!',
    },
    upstairsLater: {
      speaker: 'Narrator',
      text: 'You can head back once the rest of the airport is implemented.',
    },
    doorReady: {
      speaker: 'Narrator',
      text: 'The automatic doors are ready, but the next airport scene is not wired yet.',
    },
  },
};
