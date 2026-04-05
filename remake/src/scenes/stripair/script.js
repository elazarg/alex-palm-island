import { STRIPAIR_RESOURCES } from './resources.js';
import { STRIPAIR_DEFAULT_STATE } from './state.js';
import { STRIPAIR_ACTIVE_INTERACTIONS } from './theme-2d.js';

const DIALOGS = STRIPAIR_RESOURCES.dialogBySection;
const MESSAGES = STRIPAIR_RESOURCES.messageBySection;
const TEXT_REFS = STRIPAIR_RESOURCES.textRefBySection;

const INFO_SEQUENCE = Object.freeze([1, 1, 2, 1, 3, 4, 3, 1]);
const CAT_SEQUENCE = Object.freeze([1, 2, 3, 4, 5, 6, 5, 4]);

function speakerVisualFromSpritePart(spritePart) {
  const family = spritePart.split(/\s+/)[0];
  switch (family) {
    case 'InfoTlk':
      return Object.freeze({
        speaker: 'Information Man',
        speakerBase: 'INFOTLK0',
        speakerOverlay: Object.freeze({ prefix: 'INFOTLK', ox: 50, oy: 30, rate: 8, sequence: INFO_SEQUENCE }),
      });
    case 'CatTlk':
      return Object.freeze({
        speaker: 'Snow',
        speakerBase: 'CATTLK0',
        speakerOverlay: Object.freeze({ prefix: 'CATTLK', ox: 37, oy: 59, rate: 8, sequence: CAT_SEQUENCE }),
      });
    default:
      return Object.freeze({});
  }
}

function eventStep(id) {
  return [{ type: 'event', id }];
}

function messageStep(id) {
  return [{ type: 'message', id }];
}

function talkMessageFromSection(sectionId) {
  const message = MESSAGES[sectionId];
  return {
    presentation: 'talk',
    sound: message.speaker.sound,
    text: message.text,
    ...speakerVisualFromSpritePart(message.speaker.spritePart),
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferCorrectChoiceIndex(question, choices, correctResponse) {
  const responseText = normalizeText(correctResponse?.text);
  if (!responseText) return -1;
  for (let index = 0; index < choices.length; index++) {
    const choice = normalizeText(choices[index]);
    if (choice && responseText.includes(choice)) return index;
  }
  if (String(question || '').includes('@')) {
    for (let index = 0; index < choices.length; index++) {
      const candidate = normalizeText(String(question).replace('@', choices[index]));
      if (candidate && responseText.includes(candidate)) return index;
    }
  }
  return -1;
}

function buildChoiceResponses(dialog, gotoMap, options = {}) {
  const rewardDelta = Number.isFinite(options.rewardDelta) ? options.rewardDelta : 0;
  const responses = dialog.responses || [];
  if (responses.length === dialog.choices.length) {
    return dialog.choices.map((label, index) => {
      const response = responses[index];
      return {
        label,
        result: response.result,
        responseText: response.text,
        responseSound: response.sound === 'SILENCE' ? null : response.sound,
        rewardDelta: response.result === 1 ? rewardDelta : 0,
        event: gotoMap[response.gotoSection] || [],
      };
    });
  }

  const wrongResponse = responses.find((response) => response.result === 2) || null;
  const correctResponses = responses.filter((response) => response.result === 1);
  if (correctResponses.length === 1 && wrongResponse) {
    const correctChoiceIndex = inferCorrectChoiceIndex(dialog.question, dialog.choices, correctResponses[0]);
    if (correctChoiceIndex >= 0) {
      return dialog.choices.map((label, index) => {
        const response = index === correctChoiceIndex ? correctResponses[0] : wrongResponse;
        return {
          label,
          result: response.result,
          responseText: response.text,
          responseSound: response.sound === 'SILENCE' ? null : response.sound,
          rewardDelta: response.result === 1 ? rewardDelta : 0,
          event: gotoMap[response.gotoSection] || [],
        };
      });
    }
  }

  return dialog.choices.map((label, index) => {
    const response = responses[index] || wrongResponse || responses[0] || { result: 2, text: '', sound: 'SILENCE', gotoSection: 0 };
    return {
      label,
      result: response.result,
      responseText: response.text,
      responseSound: response.sound === 'SILENCE' ? null : response.sound,
      rewardDelta: response.result === 1 ? rewardDelta : 0,
      event: gotoMap[response.gotoSection] || [],
    };
  });
}

function dialogFromSection(sectionId, gotoMap, options = {}) {
  const dialog = DIALOGS[sectionId];
  return {
    ...speakerVisualFromSpritePart(dialog.speaker.spritePart),
    prompt: dialog.prompt,
    promptSound: dialog.speaker.sound,
    question: dialog.question,
    choices: buildChoiceResponses(dialog, gotoMap, options),
  };
}

export const STRIPAIR_SCRIPT = {
  initialState: STRIPAIR_DEFAULT_STATE,

  fallbacks: {
    look: 'lookDefault',
    talk: 'talkDefault',
    touch: 'touchDefault',
    item: 'bagDefault',
    bag: 'bagDefault',
  },

  interactions: STRIPAIR_ACTIVE_INTERACTIONS,

  events: {
    'infoStand.ask': [
      { type: 'walkTo', x: 150, y: 65 },
      { type: 'face', dir: 3 },
      {
        if: { state: 'infoStandVisited', equals: true },
        then: [{ type: 'dialog', id: 'infoStandRepeat' }],
        else: [{ type: 'dialog', id: 'infoStandIntro' }],
      },
    ],

    infoHotel: [
      { type: 'setState', key: 'infoStandVisited', value: true },
      { type: 'message', id: 'infoHotel' },
    ],
    infoFood: [
      { type: 'setState', key: 'infoStandVisited', value: true },
      { type: 'message', id: 'infoFood' },
    ],
    infoTaxi: [
      { type: 'setState', key: 'infoStandVisited', value: true },
      { type: 'message', id: 'infoTaxi' },
    ],
    infoDirection: [{ type: 'message', id: 'infoDirection' }],
    infoNeedMap: [{ type: 'message', id: 'infoNeedMap' }],

    'cat.talk': [
      { type: 'walkTo', x: 100, y: 160 },
      { type: 'face', dir: 1 },
      {
        if: { state: 'catConversationStage', gte: 3 },
        then: messageStep('catAfterQuiz'),
        else: [
          {
            if: { state: 'catConversationStage', equals: 2 },
            then: [{ type: 'dialog', id: 'catQuestion3' }],
            else: [
              {
                if: { state: 'catConversationStage', equals: 1 },
                then: [{ type: 'dialog', id: 'catQuestion2' }],
                else: [{ type: 'dialog', id: 'catQuestion1' }],
              },
            ],
          },
        ],
      },
    ],

    'cat.touch': [
      { type: 'walkTo', x: 100, y: 160 },
      { type: 'face', dir: 1 },
      { type: 'message', id: 'catPet' },
    ],

    catStep1: [
      { type: 'incState', key: 'palmettoes', amount: 10 },
      { type: 'setState', key: 'catConversationStage', value: 1 },
      { type: 'dialog', id: 'catQuestion2' },
    ],
    catStep2: [
      { type: 'incState', key: 'palmettoes', amount: 10 },
      { type: 'setState', key: 'catConversationStage', value: 2 },
      { type: 'dialog', id: 'catQuestion3' },
    ],
    catStep3: [
      { type: 'incState', key: 'palmettoes', amount: 10 },
      { type: 'setState', key: 'catConversationStage', value: 3 },
      { type: 'message', id: 'catAfterQuiz' },
    ],

    'town.exit': [
      { type: 'walkTo', x: 90, y: 145 },
      { type: 'face', dir: 8 },
    ],

    bagMissing: [{ type: 'message', id: 'bagMissing' }],
    lookFloor: [{ type: 'message', id: 'lookFloor' }],
    touchFloor: [{ type: 'message', id: 'touchFloor' }],
    lookDefault: [{ type: 'message', id: 'lookDefault' }],
    talkDefault: [{ type: 'message', id: 'talkDefault' }],
    touchDefault: [{ type: 'message', id: 'touchDefault' }],
    bagDefault: [{ type: 'message', id: 'bagDefault' }],
  },

  dialogs: {
    infoStandIntro: dialogFromSection(2010, {
      181: eventStep('infoHotel'),
      182: eventStep('infoFood'),
      183: eventStep('infoTaxi'),
    }),
    infoStandRepeat: dialogFromSection(2020, {
      185: eventStep('infoDirection'),
      186: eventStep('infoNeedMap'),
    }),
    catQuestion1: dialogFromSection(2030, {
      2040: eventStep('catStep1'),
    }, { rewardDelta: 10 }),
    catQuestion2: dialogFromSection(2040, {
      2050: eventStep('catStep2'),
    }, { rewardDelta: 10 }),
    catQuestion3: dialogFromSection(2050, {
      200: eventStep('catStep3'),
    }, { rewardDelta: 10 }),
  },

  messages: {
    infoHotel: talkMessageFromSection(1010),
    infoFood: talkMessageFromSection(1020),
    infoTaxi: talkMessageFromSection(1030),
    infoDirection: talkMessageFromSection(1050),
    infoNeedMap: talkMessageFromSection(1060),
    catAfterQuiz: talkMessageFromSection(1070),
    catPet: talkMessageFromSection(1080),
    bagMissing: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'You have nothing in the bag yet.',
    },
    lookFloor: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'It is the road outside the airport.',
    },
    touchFloor: {
      speaker: 'Narrator',
      presentation: 'note',
      text: 'Touching the road will not help.',
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
