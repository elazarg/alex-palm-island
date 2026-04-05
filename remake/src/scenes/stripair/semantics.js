export const STRIPAIR_ENTITIES = Object.freeze({
  palmTrees: Object.freeze({
    kind: 'prop',
    label: 'Palm Trees',
    textRefs: Object.freeze({ look: 510, touch: 515 }),
  }),
  deadEndSign: Object.freeze({
    kind: 'sign',
    label: 'Dead End Sign',
    textRefs: Object.freeze({ look: 520, touch: 525 }),
  }),
  garbage: Object.freeze({
    kind: 'prop',
    label: 'Rubbish Bin',
    textRefs: Object.freeze({ look: 530, touch: 535 }),
  }),
  fence: Object.freeze({
    kind: 'prop',
    label: 'Airport Fence',
    textRefs: Object.freeze({ look: 540, touch: 545 }),
  }),
  infoStand: Object.freeze({
    kind: 'npc',
    label: 'Information Man',
    speakerFamily: 'InfoTlk',
    textRefs: Object.freeze({ look: 550, touch: 555 }),
    flows: Object.freeze(['infoStand.ask']),
  }),
  map: Object.freeze({
    kind: 'prop',
    label: 'Palm Island Map',
    textRefs: Object.freeze({ look: 560, touch: 565 }),
  }),
  airportDoors: Object.freeze({
    kind: 'traversal',
    label: 'Airport Doors',
    textRefs: Object.freeze({ look: 570, touch: 575 }),
  }),
  cat: Object.freeze({
    kind: 'npc',
    label: 'Snow the Cat',
    sceneObjects: Object.freeze(['Cat']),
    speakerFamily: 'CatTlk',
    textRefs: Object.freeze({ look: 580, touch: 1080 }),
    flows: Object.freeze(['cat.talk', 'cat.touch']),
  }),
  airportSign: Object.freeze({
    kind: 'sign',
    label: 'Airport Sign',
    textRefs: Object.freeze({ look: 590, touch: 595 }),
  }),
  infoSign: Object.freeze({
    kind: 'sign',
    label: 'Information Sign',
    textRefs: Object.freeze({ resource: 600, touch: 605 }),
  }),
  lamp: Object.freeze({
    kind: 'prop',
    label: 'Lamp',
    textRefs: Object.freeze({ look: 610, touch: 615 }),
  }),
  townExit: Object.freeze({
    kind: 'traversal',
    label: 'Road To Town',
    flows: Object.freeze(['town.exit']),
  }),
});

export const STRIPAIR_SEMANTIC_HOTSPOTS = Object.freeze([
  Object.freeze({
    id: 'townExit',
    entity: 'townExit',
    scope: 'world',
    affordances: Object.freeze({
      walk: Object.freeze({ kind: 'flow', id: 'town.exit' }),
    }),
  }),
  Object.freeze({
    id: 'palmTrees',
    entity: 'palmTrees',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 510 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 515 }),
    }),
  }),
  Object.freeze({
    id: 'deadEndSign',
    entity: 'deadEndSign',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 520 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 525 }),
    }),
  }),
  Object.freeze({
    id: 'garbage',
    entity: 'garbage',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 530 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 535 }),
      talk: Object.freeze({ kind: 'flow', id: 'talkDefault' }),
    }),
  }),
  Object.freeze({
    id: 'fence',
    entity: 'fence',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 540 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 545 }),
    }),
  }),
  Object.freeze({
    id: 'infoStand',
    entity: 'infoStand',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 550 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 555 }),
      talk: Object.freeze({ kind: 'flow', id: 'infoStand.ask' }),
    }),
  }),
  Object.freeze({
    id: 'map',
    entity: 'map',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 560 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 565 }),
    }),
  }),
  Object.freeze({
    id: 'airportDoors',
    entity: 'airportDoors',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 570 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 575 }),
    }),
  }),
  Object.freeze({
    id: 'cat',
    entity: 'cat',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 580 }),
      touch: Object.freeze({ kind: 'flow', id: 'cat.touch' }),
      talk: Object.freeze({ kind: 'flow', id: 'cat.talk' }),
    }),
  }),
  Object.freeze({
    id: 'airportSign',
    entity: 'airportSign',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 590 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 595 }),
    }),
  }),
  Object.freeze({
    id: 'infoSign',
    entity: 'infoSign',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 600 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 605 }),
    }),
  }),
  Object.freeze({
    id: 'lamp',
    entity: 'lamp',
    scope: 'world',
    affordances: Object.freeze({
      look: Object.freeze({ kind: 'textRef', sectionId: 610 }),
      touch: Object.freeze({ kind: 'textRef', sectionId: 615 }),
    }),
  }),
]);
