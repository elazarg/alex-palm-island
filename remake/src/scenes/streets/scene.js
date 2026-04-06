import { resolveInteractionMode } from '../../ui/action-modes.js';
import { ALEX_DIALOG_ASSET_NAMES, CURSOR_ASSET_NAMES, UI_ASSET_NAMES, UI_VERSION } from '../../ui/assets.js';
import { INVENTORY_ICON_NAME_TO_ITEM_ID } from '../../ui/inventory-items.js';
import { createMeterAnimationState } from '../../ui/meter-animation.js';
import { renderPanel } from '../../ui/panel-renderer.js';
import { WIDTH } from '../../core/engine.js';
import { GameScene } from '../../runtime/game-scene.js';
import { GLOBAL_RESOURCES, GLOBAL_SOUND_MANIFEST } from '../../runtime/global-resources.js';
import { GLOBAL_TEXT } from '../../runtime/generated/global-text.js';
import { STREET_SCENES, WORLD_MAP_HOTSPOTS } from './catalog.js';
import { createStreetRouteFns } from './route.js';
import { buildStreetCarryState, splitStreetStateLayers, streetHasBag } from './state.js';

const DEBUG_REGION_COLORS = Object.freeze({
  walkZone: '#2ec4ff',
  exit: '#ffcc00',
  special: '#66e08a',
});

const STREET_DIALOG_RESPONSE_DELAY_TICKS = 8;

const SPEAKER_NAME_BY_TOKEN = Object.freeze({
  COWTLK: 'Cow',
  ELECTLK: 'Electrician',
  MAILTLK: 'Mailman',
  POLTALK: 'Policeman',
  TAXITLK: 'Taxi Driver',
  JAILTLK: 'Prisoner',
  MAIDTLK: 'Maid',
  STATTLK: 'Statue Girl',
  GRDTLK: 'Guard',
  CHLDTLK: 'Child',
  GUMTLK: 'Bubble Gum Seller',
  VAMPTLK: 'Vampire',
  DIGTALK: 'Digger',
  NEWSTLK: 'Newspaper Boy',
  ZEBTLK: 'Zebra Woman',
  DOTALK: 'Doughnut Seller',
  TCKTLK: 'Ticket Clerk',
  GRANTLK: 'Grandma',
});

const SCENE_NAME_MAP = Object.freeze({
  snStripAir: 'stripair',
  snStrip0: 'strip0',
  snStApart: 'stapart',
  snStBurger: 'stburger',
  snStButcher: 'stbutcher',
  snStButche: 'stbutcher',
  snStChoco: 'stchoco',
  snStHosp: 'sthosp',
  snStHotel: 'sthotel',
  snStSuper: 'stsuper',
  snStZoo: 'stzoo',
  snAptment: 'aptment',
  snButcher: 'butcher',
  snBurger: 'burger',
  snLobby: 'lobby',
  snPhoto: 'photo',
  snZooFront: 'zoofront',
  snFactory: 'factory',
  snWard: 'ward',
  snArrest: 'arrest',
  snDeath: 'death',
});

function parseInteractiveCommands(textEntry) {
  const commands = [];
  for (const line of textEntry?.lines || []) {
    const parts = String(line || '').split(',').map((part) => part.trim());
    if (parts.length < 3 || parts[2].length !== 1 || !/^[A-Z]$/i.test(parts[2])) continue;
    const flag = Number(parts[0]);
    const cond = Number(parts[1]);
    if (!Number.isFinite(flag) || !Number.isFinite(cond)) continue;
    commands.push(Object.freeze({
      flag,
      cond,
      cmd: parts[2].toUpperCase(),
      args: Object.freeze(parts.slice(3)),
    }));
  }
  return Object.freeze(commands);
}

const GLOBAL_INTERACTIVE_SECTIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(GLOBAL_TEXT.textRefs || {})
      .filter(([sectionId]) => Number(sectionId) >= 10001)
      .map(([sectionId, entry]) => [sectionId, parseInteractiveCommands(entry)])
  )
);

function noteMessageFromTextRef(textRef) {
  return Object.freeze({
    speaker: 'Narrator',
    presentation: 'note',
    text: textRef?.text || '',
    sound: textRef?.sound || null,
  });
}

function defaultNote(text) {
  return Object.freeze({
    speaker: 'Narrator',
    presentation: 'note',
    text,
    sound: null,
  });
}

function isStreetTarget(targetScene) {
  return targetScene === 'stripair' || Object.prototype.hasOwnProperty.call(STREET_SCENES, targetScene || '');
}

function isImplementedStreetTransitionTarget(targetScene) {
  return isStreetTarget(targetScene) || targetScene === 'airport' || targetScene === 'arrest' || targetScene === 'prison';
}

function makeExitEventId(targetScene, sectionId, name) {
  return `exit:${targetScene}:${name || sectionId || 'unnamed'}`;
}

function makeStreetSectionEventId(sectionId) {
  return `section:${sectionId}`;
}

function makeStreetDialogId(sectionId) {
  return `dialog:${sectionId}`;
}

function makeStreetMessageId(sectionId) {
  return `message:${sectionId}`;
}

function targetSceneId(rawTarget) {
  return SCENE_NAME_MAP[String(rawTarget || '').trim()] || null;
}

function normalizeSceneItemId(rawItemId) {
  const itemId = String(rawItemId || '').trim();
  if (INVENTORY_ICON_NAME_TO_ITEM_ID[itemId]) return INVENTORY_ICON_NAME_TO_ITEM_ID[itemId];
  const matchedKey = Object.keys(INVENTORY_ICON_NAME_TO_ITEM_ID).find((key) => key.toLowerCase() === itemId.toLowerCase());
  return matchedKey ? INVENTORY_ICON_NAME_TO_ITEM_ID[matchedKey] : null;
}

function parseSpeakerVisual(sceneData, spritePart = '') {
  const token = String(spritePart || '').split(/[\s,]+/)[0].toUpperCase();
  if (!token) return Object.freeze({});
  const offsetMatch = /(\d+)\s*,\s*(\d+)/.exec(String(spritePart || ''));
  const ox = offsetMatch ? Number(offsetMatch[1]) : 48;
  const oy = offsetMatch ? Number(offsetMatch[2]) : 24;
  const frameNames = (sceneData.spriteNames || [])
    .filter((name) => new RegExp(`^${token}\\d+$`).test(name))
    .map((name) => Number(name.slice(token.length)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const hasBase = frameNames.includes(0);
  const sequence = frameNames.filter((frame) => frame > 0);
  return Object.freeze({
    speaker: SPEAKER_NAME_BY_TOKEN[token] || token.replace(/TLK$/, ''),
    speakerBase: hasBase ? `${token}0` : null,
    speakerOverlay: sequence.length
      ? Object.freeze({ prefix: token, ox, oy, rate: 8, sequence: Object.freeze(sequence) })
      : null,
  });
}

function talkMessageFromSection(sceneData, message) {
  const visual = parseSpeakerVisual(sceneData, message?.speaker?.spritePart || '');
  return Object.freeze({
    presentation: 'talk',
    sound: message?.speaker?.sound || null,
    text: message?.text || '',
    speaker: visual.speaker,
    speakerBase: visual.speakerBase,
    speakerOverlay: visual.speakerOverlay,
  });
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

function buildDialogChoices(dialog) {
  const responses = dialog.responses || [];
  if (responses.length === dialog.choices.length) {
    return dialog.choices.map((label, index) => Object.freeze({ label, response: responses[index] }));
  }
  const wrongResponse = responses.find((response) => response.result === 2) || responses[0] || null;
  const correctResponses = responses.filter((response) => response.result === 1);
  if (correctResponses.length === 1 && wrongResponse) {
    const correctChoiceIndex = inferCorrectChoiceIndex(dialog.question, dialog.choices, correctResponses[0]);
    if (correctChoiceIndex >= 0) {
      return dialog.choices.map((label, index) => Object.freeze({
        label,
        response: index === correctChoiceIndex ? correctResponses[0] : wrongResponse,
      }));
    }
  }
  return dialog.choices.map((label, index) => Object.freeze({
    label,
    response: responses[index] || wrongResponse || responses[0] || { result: 2, text: '', sound: 'SILENCE', gotoSection: 0 },
  }));
}

function buildStreetDialogs(sceneData, resources) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(resources.dialogBySection || {}).map(([sectionId, dialog]) => {
        const visual = parseSpeakerVisual(sceneData, dialog.speaker.spritePart);
        const rewardDelta = dialog.completionFlag ? 10 : 0;
        return [makeStreetDialogId(sectionId), Object.freeze({
          speaker: visual.speaker,
          speakerBase: visual.speakerBase,
          speakerOverlay: visual.speakerOverlay,
          prompt: dialog.prompt,
          promptSound: dialog.speaker.sound || null,
          question: dialog.question,
          choices: Object.freeze(
            buildDialogChoices(dialog).map(({ label, response }) => Object.freeze({
              label,
              result: response.result,
              responseText: response.text,
              responseSound: response.sound === 'SILENCE' ? null : response.sound,
              rewardDelta: response.result === 1 ? rewardDelta : 0,
              event: Object.freeze([
                ...(dialog.completionFlag && response.result === 1 ? [{ type: 'setFlag', flagId: dialog.completionFlag, value: true }] : []),
                ...(Number.isFinite(response.gotoSection) && response.gotoSection > 0
                  ? [{ type: 'event', id: makeStreetSectionEventId(response.gotoSection) }]
                  : []),
              ]),
            }))
          ),
        })];
      })
    )
  );
}

function buildStreetMessages(sceneData, resources, sceneMessages = {}) {
  const entries = Object.entries(sceneMessages);
  for (const [sectionId, message] of Object.entries(resources.messageBySection || {})) {
    entries.push([makeStreetMessageId(sectionId), talkMessageFromSection(sceneData, message)]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function buildStreetAssetManifest(sceneData) {
  const images = {};
  const frameCounts = { 1: 8, 2: 7, 3: 8, 4: 8, 6: 8, 7: 8, 8: 7, 9: 8 };
  const spriteBase = `../assets/${sceneData.id}`;
  for (const spriteName of sceneData.spriteNames || []) {
    images[spriteName] = `${spriteBase}/${spriteName}.png`;
  }
  for (const obj of sceneData.renderObjects || []) {
    if (obj.asset) images[obj.asset] = `${spriteBase}/${obj.asset}.png`;
  }
  for (const [dir, count] of Object.entries(frameCounts)) {
    for (let frame = 0; frame < count; frame++) {
      images[`ALEX${dir}-${frame}`] = `../assets/alex/ALEX${dir}-${frame}.png`;
    }
  }
  const ui = '../assets/ui';
  for (const name of UI_ASSET_NAMES) images[name] = `${ui}/${name}.png?v=${UI_VERSION}`;
  for (const name of ALEX_DIALOG_ASSET_NAMES) images[name] = `${ui}/${name}.png?v=${UI_VERSION}`;
  images.SUITCASE = `${ui}/SUITCASE.png?v=${UI_VERSION}`;
  images.ICONWINDOW = `${ui}/ICONWINDOW.png?v=${UI_VERSION}`;
  const cursorBase = '../assets/cursors';
  for (const name of CURSOR_ASSET_NAMES) images[name] = `${cursorBase}/${name}.png?v=${UI_VERSION}`;
  return { images, frameCounts };
}

function buildStreetSoundManifest(sceneData) {
  const base = `../assets/${sceneData.id}`;
  const manifest = Object.fromEntries((sceneData.soundNames || []).map((name) => [name, `${base}/${name}.wav`]));
  return Object.freeze({
    ...manifest,
    ...GLOBAL_SOUND_MANIFEST,
  });
}

function chooseDefaultEntry(sceneData) {
  if (sceneData.defaultEntry) return sceneData.defaultEntry;
  const bgWidth = (sceneData.backgroundAssets?.length || 1) * WIDTH;
  const masks = (sceneData.world?.clickRects || []).filter((rect) => rect.type === 'A');
  const isBlocked = (x, y) => masks.some((rect) => x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2);
  for (const y of [165, 155, 145, 135]) {
    for (let x = Math.max(48, bgWidth - 80); x >= 48; x -= 8) {
      if (!isBlocked(x, y)) return Object.freeze({ x, y, dir: 4 });
    }
  }
  return Object.freeze({ x: Math.max(48, bgWidth - 120), y: 165, dir: 4 });
}

function buildStreetScript(sceneData) {
  const resources = sceneData.resources;
  const interactions = [];
  const events = {};
  const dialogs = buildStreetDialogs(sceneData, resources);
  const messages = buildStreetMessages(sceneData, resources, {
    bagMissing: defaultNote('You have nothing in the bag.'),
    mapMissing: noteMessageFromTextRef(GLOBAL_RESOURCES.textRefBySection[10999]),
    lookDefault: defaultNote('Nothing special.'),
    talkDefault: defaultNote('Nobody answers.'),
    touchDefault: defaultNote("That doesn't help."),
    bagDefault: defaultNote('That does not seem useful here.'),
    sceneUnavailable: defaultNote('That destination is not implemented yet.'),
    specialMapFound: noteMessageFromTextRef(
      sceneData.specialInteraction?.messageSectionId != null
        ? resources.textRefBySection[sceneData.specialInteraction.messageSectionId]
        : null
    ),
  });

  const exitBySection = new Map(
    (sceneData.exits || [])
      .filter((exitDef) => isStreetTarget(exitDef.targetScene))
      .map((exitDef) => [exitDef.sectionId, exitDef])
  );

  for (const sectionId of Object.keys(sceneData.text?.interactive || {}).map(Number).sort((a, b) => a - b)) {
    events[makeStreetSectionEventId(sectionId)] = Object.freeze([{ type: 'interactiveSection', sectionId }]);
  }

  for (const exitDef of sceneData.exits || []) {
    if (!isStreetTarget(exitDef.targetScene)) continue;
    const interactionId = makeExitEventId(exitDef.targetScene, exitDef.sectionId, exitDef.name);
    interactions.push(Object.freeze({
      id: interactionId,
      rect: exitDef.rect,
      actions: Object.freeze({ walk: Object.freeze({ kind: 'flow', id: interactionId }) }),
    }));
    const steps = [];
    if (exitDef.walkTarget) steps.push({ type: 'walkTo', x: exitDef.walkTarget.x, y: exitDef.walkTarget.y });
    steps.push({ type: 'transition', target: { scene: exitDef.targetScene, initial: true, entry: sceneData.id } });
    events[interactionId] = Object.freeze(steps);
  }

  if (sceneData.specialInteraction) {
    const special = sceneData.specialInteraction;
    interactions.push(Object.freeze({
      id: special.id,
      rect: special.rect,
      actions: Object.freeze({
        walk: Object.freeze({ kind: 'flow', id: special.id }),
        touch: Object.freeze({ kind: 'flow', id: special.id }),
      }),
    }));
    const steps = [];
    if (special.walkTarget) steps.push({ type: 'walkTo', x: special.walkTarget.x, y: special.walkTarget.y });
    steps.push({ type: 'setState', key: 'map', value: true });
    steps.push({ type: 'setFlag', flagId: 1800, value: true });
    steps.push({ type: 'message', id: 'specialMapFound' });
    events[special.id] = Object.freeze(steps);
  }

  const clickRects = sceneData.world?.clickRects || [];
  for (let index = 0; index < clickRects.length; index++) {
    const rect = clickRects[index];
    if (rect.type !== 'B') continue;
    const actions = {};
    if (Number.isFinite(rect.examine_section) && rect.examine_section >= 500) {
      actions.look = Object.freeze({ kind: 'textRef', sectionId: rect.examine_section });
    } else if (Number.isFinite(rect.examine_section) && rect.examine_section > 0) {
      actions.look = Object.freeze({ kind: 'flow', id: makeStreetSectionEventId(rect.examine_section) });
    }
    if (Number.isFinite(rect.click_section)) {
      if (rect.click_section >= 500) {
        actions.touch = Object.freeze({ kind: 'textRef', sectionId: rect.click_section });
      } else if (rect.click_section > 0) {
        const exitDef = exitBySection.get(rect.click_section);
        const eventId = exitDef
          ? makeExitEventId(exitDef.targetScene, exitDef.sectionId, exitDef.name)
          : makeStreetSectionEventId(rect.click_section);
        actions.touch = Object.freeze({ kind: 'flow', id: eventId });
        actions.walk = Object.freeze({ kind: 'flow', id: eventId });
        actions.item = Object.freeze({ kind: 'flow', id: eventId });
      }
    }
    if (Number.isFinite(rect.talk_section) && rect.talk_section >= 500) {
      actions.talk = Object.freeze({ kind: 'textRef', sectionId: rect.talk_section });
    } else if (Number.isFinite(rect.talk_section) && rect.talk_section > 0) {
      actions.talk = Object.freeze({ kind: 'flow', id: makeStreetSectionEventId(rect.talk_section) });
    }
    if (!Object.keys(actions).length) continue;
    interactions.push(Object.freeze({
      id: `rect:${index}`,
      rect: Object.freeze([rect.x1, rect.y1, rect.x2, rect.y2]),
      actions: Object.freeze(actions),
    }));
  }

  for (const interaction of sceneData.manualInteractions || []) {
    const actions = {};
    for (const [mode, sectionId] of Object.entries(interaction.actions || {})) {
      if (Number.isFinite(sectionId) && sectionId > 0) {
        actions[mode] = Object.freeze({ kind: 'flow', id: makeStreetSectionEventId(sectionId) });
      }
    }
    if (!Object.keys(actions).length) continue;
    interactions.push(Object.freeze({
      id: `manual:${interaction.id}`,
      rect: interaction.rect,
      actions: Object.freeze(actions),
    }));
  }

  return Object.freeze({
    initialState: Object.freeze({
      palmettoes: 100,
      bag: null,
      map: false,
      flags: Object.freeze([]),
      items: Object.freeze([]),
      reasonForComing: null,
    }),
    fallbacks: Object.freeze({
      look: 'lookDefault',
      talk: 'talkDefault',
      touch: 'touchDefault',
      item: 'bagDefault',
      bag: 'bagDefault',
    }),
    interactions: Object.freeze(interactions),
    events: Object.freeze({
      ...events,
      bagMissing: Object.freeze([{ type: 'message', id: 'bagMissing' }]),
      mapMissing: Object.freeze([{ type: 'message', id: 'mapMissing' }]),
      lookDefault: Object.freeze([{ type: 'message', id: 'lookDefault' }]),
      talkDefault: Object.freeze([{ type: 'message', id: 'talkDefault' }]),
      touchDefault: Object.freeze([{ type: 'message', id: 'touchDefault' }]),
      bagDefault: Object.freeze([{ type: 'message', id: 'bagDefault' }]),
    }),
    messages,
    dialogs,
  });
}

function buildStreetDefinition(sceneData, routeFns) {
  const worldWidth = (sceneData.backgroundAssets?.length || 1) * WIDTH;
  const walkMasks = sceneData.world.clickRects
    .filter((rect) => rect.type === 'A')
    .map((rect) => Object.freeze([rect.x1, rect.y1, rect.x2, rect.y2]));
  return Object.freeze({
    id: sceneData.id,
    resources: sceneData.resources,
    buildAssetManifest: () => buildStreetAssetManifest(sceneData),
    buildSoundManifest: () => buildStreetSoundManifest(sceneData),
    createObjects: () => {
      const behind = [];
      const front = [];
      for (const obj of sceneData.renderObjects || []) {
        const entry = {
          name: obj.name,
          sprite: obj.asset,
          x: obj.x,
          y: obj.y,
          visible: true,
          _visibleWhen: obj.visibleWhen || null,
        };
        if (obj.layer === 'behind') behind.push(entry);
        else front.push(entry);
      }
      return Object.freeze({
        behind: Object.freeze(behind),
        front: Object.freeze(front),
      });
    },
    route: Object.freeze({
      normalize: routeFns.normalize,
      buildFromRuntime: routeFns.buildFromRuntime,
      resolveInitialScreen: routeFns.resolveInitialScreen,
    }),
    state: Object.freeze({
      splitLayers: splitStreetStateLayers,
      canOpenInventory: (alexState) => streetHasBag(alexState),
      canOpenMap: (layers) => layers.globalState.map === true,
      getBagButtonState: (layers) => (streetHasBag(layers.alexState) ? 'active' : 'covered'),
      getMapButtonState: (layers) => (layers.globalState.map === true ? 'active' : 'covered'),
    }),
    topology: Object.freeze({
      walkZones: Object.freeze([Object.freeze([0, 0, worldWidth, 200])]),
      walkMasks: Object.freeze(walkMasks),
      conditionalWalkMasks: Object.freeze([]),
      walkMaskPolygons: Object.freeze([]),
    }),
  });
}

function splitBackgroundName(name) {
  const match = /^(.*?)(\d+)$/.exec(name);
  if (!match) return { prefix: name, index: 1 };
  return { prefix: match[1], index: Number(match[2]) };
}

export class StreetScene extends GameScene {
  constructor({ sceneId, route } = {}) {
    const sceneData = STREET_SCENES[sceneId];
    if (!sceneData) throw new Error(`Unknown street scene: ${sceneId}`);
    const routeFns = createStreetRouteFns(sceneId);
    const definition = buildStreetDefinition(sceneData, routeFns);
    super({
      definition,
      sceneScript: buildStreetScript(sceneData),
      dialogResponseDelayTicks: STREET_DIALOG_RESPONSE_DELAY_TICKS,
    });
    this.sceneId = sceneId;
    this.sceneData = sceneData;
    this.routeFns = routeFns;
    this.route = routeFns.normalize(route || {});
    this.walkZones = definition.topology.walkZones;
    this.walkMasks = definition.topology.walkMasks;
    this.walkMaskPolygons = definition.topology.walkMaskPolygons;
    this.alexDepthScale = sceneData.alexDepthScale || null;
    this.backgroundSegments = (sceneData.backgroundAssets || [])
      .map((name) => ({ name, index: splitBackgroundName(name).index }))
      .sort((a, b) => a.index - b.index);
  }

  init() {
    const { behind, front } = this.definition.createObjects();
    this.objectsBehind = [...behind];
    this.objectsFront = [...front];
    this.sceneObjects = [...this.objectsBehind, ...this.objectsFront];
    this.objectByName = Object.fromEntries(this.sceneObjects.map((obj) => [obj.name, obj]));

    this.bgWidth = this.backgroundSegments.reduce((total, segment) => {
      const img = this.engine.getAsset(segment.name);
      return total + (img?.width || 0);
    }, 0) || Math.max(WIDTH, this.backgroundSegments.length * WIDTH);
    const entry = this._resolveEntryPosition();
    this.scrollX = 0;
    this.alexX = entry.x;
    this.alexY = entry.y;
    this.alexDir = entry.dir;
    this.alexFrame = 1;
    this.alexWalking = false;
    this.alexTargetX = 0;
    this.alexTargetY = 0;
    this.alexStepTick = 0;
    this.alexWalkCycleIdx = 0;
    this.alexIdleTick = 0;
    this.alexPath = [];
    this.inputMode = 'walk';
    this.selectedItem = null;
    this.uiTick = 0;
    this._pressedButtonMode = null;
    this._pendingButtonMode = null;
    this._pressedInventoryControlMode = null;
    this._sceneAnimation = null;

    this.initScriptRuntime();
    this._applyRouteStateOverrides();
    this._applySpecialObjectVisibility();
    this.meterAnimation = createMeterAnimationState(this.state?.palmettoes ?? 100);
    this._setInputMode('walk');
    this._openInitialRouteScreen();
    this._scrollToAlex(true);
    this._publishRoute();
  }

  onMouseDown({ x, y }) {
    if (this._gestureLockedDialog) {
      const dialog = this._gestureLockedDialog;
      this._gestureLockedDialog = null;
      this._startDialogPrompt(dialog);
      return;
    }
    if (this.modal) {
      if (this.modal.type === 'inventory') {
        if (this.modal.inspectItem) {
          this._handleModalClick(x, y);
          return;
        }
        const control = this._inventoryControlBoxes.find((box) => x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2);
        if (control) {
          this._pressedInventoryControlMode = control.mode;
          this.modal.pressedControlMode = control.mode;
          return;
        }
      }
      this._handleModalClick(x, y);
      return;
    }
    const button = this._getUiButton(x, y);
    if (button) {
      this._pressedButtonMode = button.mode;
      this._pendingButtonMode = button.mode;
      return;
    }
    const worldX = x + this.scrollX;
    const worldY = y;
    if (this.actionQueue.length) return;
    const interactionMode = resolveInteractionMode(this.inputMode);
    const interaction = this._findInteraction(worldX, worldY, interactionMode);
    if (interaction) {
      this._handleInteractionAction(interaction.action);
      return;
    }
    if (this.inputMode !== 'walk') {
      this._queueFallbackEvent(interactionMode);
      return;
    }
    const target = this._closestWalkablePoint(worldX, worldY);
    if (!target) return;
    this._walkTo(target.x, target.y);
  }

  tick() {
    this.uiTick++;
    this._tickWalk();
    this._tickObjects();
    this.tickScriptRuntime();
    this._scrollToAlex();
  }

  render(ctx) {
    let drawX = -this.scrollX;
    for (const segment of this.backgroundSegments) {
      const img = this.engine.getAsset(segment.name);
      if (!img) continue;
      ctx.drawImage(img, drawX, 0);
      drawX += img.width;
    }
    for (const obj of this.objectsBehind) this._renderObject(ctx, obj);
    this._renderSceneAnimation(ctx);
    this._renderAlex(ctx);
    for (const obj of this.objectsFront) this._renderObject(ctx, obj);
    this.renderScriptModal(ctx, this.font, this.uiTick);

    const suppressPanel = this.modal?.presentation === 'resource' || this.modal?.type === 'inventory';
    if (!suppressPanel) {
      renderPanel(ctx, {
        assets: this.engine.assets,
        mouseY: this.engine.mouseY,
        modalOpen: Boolean(this.modal),
        buttons: this.uiButtons,
        pressedMode: this._pressedButtonMode,
        amount: this.state?.palmettoes ?? 100,
        buttonStates: {
          bag: this._getBagButtonState(),
          map: this._getMapButtonState(),
        },
        inputMode: this.inputMode,
        layout: this.panelLayout,
        moneyAnimation: this.meterAnimation,
      });
    }
  }

  _scrollToAlex(force = false) {
    const targetScroll = Math.max(0, Math.min(this.bgWidth - WIDTH, this.alexX - WIDTH / 2));
    if (force) {
      this.scrollX = targetScroll;
      return;
    }
    if (Math.abs(this.scrollX - targetScroll) <= 1) {
      this.scrollX = targetScroll;
      return;
    }
    this.scrollX += Math.sign(targetScroll - this.scrollX) * Math.min(6, Math.abs(targetScroll - this.scrollX));
  }

  _resolveEntryPosition() {
    if (this.route.initial && this.route.entry) {
      if (this.route.entry === 'map') return chooseDefaultEntry(this.sceneData);
      const matchingExit = this.sceneData.exits.find((exitDef) => exitDef.targetScene === this.route.entry && exitDef.walkTarget);
      if (matchingExit?.walkTarget) {
        return {
          x: matchingExit.walkTarget.x,
          y: matchingExit.walkTarget.y,
          dir: this._entryDirectionForRect(matchingExit.rect),
        };
      }
    }
    return chooseDefaultEntry(this.sceneData);
  }

  _entryDirectionForRect(rect) {
    if (!rect) return 4;
    if (rect[0] <= 8) return 6;
    if (rect[2] >= this.bgWidth - 8) return 4;
    if (rect[1] <= 8) return 2;
    return 4;
  }

  _isFlagSet(flagId) {
    const normalizedFlag = Number(flagId);
    if (!Number.isFinite(normalizedFlag)) return false;
    if (normalizedFlag === 1017) return this.state.reasonForComing === 'holiday';
    return Array.isArray(this.state.flags) && this.state.flags.includes(normalizedFlag);
  }

  _resolveInteractiveSection(sectionId) {
    const key = String(sectionId);
    return this.sceneData.text?.interactive?.[key] || GLOBAL_INTERACTIVE_SECTIONS[key] || null;
  }

  _applyStreetEffect(command, args = []) {
    const [objectName, rawValue] = args;
    if (!objectName) return;
    const value = Number(rawValue);
    const object = this.objectByName?.[objectName];
    if (command === 'V' && object) {
      object.visible = value !== 0;
      return;
    }
    if (command === 'M' && object) {
      object.x += Number(args[1]) || 0;
      object.y += Number(args[2]) || 0;
      return;
    }
    if ((command === 'A' || command === 'B') && object) {
      object.visible = value !== 0;
    }
  }

  _expandInteractiveSection(sectionId) {
    const commands = this._resolveInteractiveSection(sectionId);
    if (!Array.isArray(commands) || !commands.length) return;
    const steps = [];
    for (const record of commands) {
      if (record.flag && this._isFlagSet(record.flag) !== (Number(record.cond) === 1)) continue;
      const args = record.args || [];
      switch (record.cmd) {
        case 'W': {
          const mode = Number(args[0]);
          const x = Number(args[1]);
          const y = Number(args[2]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) break;
          if (mode === 0) steps.push({ type: 'walkTo', x, y });
          else {
            this.alexX = x;
            this.alexY = y;
          }
          break;
        }
        case 'D': {
          const dir = Number(args[0]);
          if (Number.isFinite(dir)) steps.push({ type: 'face', dir });
          break;
        }
        case 'T': {
          const dialogSection = Number(args[0]);
          if (Number.isFinite(dialogSection)) steps.push({ type: 'dialog', id: makeStreetDialogId(dialogSection) });
          break;
        }
        case 'H': {
          const messageSection = Number(args[0]);
          if (Number.isFinite(messageSection)) steps.push({ type: 'message', id: makeStreetMessageId(messageSection) });
          break;
        }
        case 'L': {
          const textRefSection = Number(args[0]);
          if (Number.isFinite(textRefSection)) steps.push({ type: 'textRef', sectionId: textRefSection });
          break;
        }
        case 'P': {
          const amount = Number(args[0]);
          if (Number.isFinite(amount)) steps.push({ type: 'incState', key: 'palmettoes', amount });
          break;
        }
        case 'F': {
          const flagId = Number(args[0]);
          if (Number.isFinite(flagId)) steps.push({ type: 'setFlag', flagId, value: Number(args[1]) !== 0 });
          break;
        }
        case 'G': {
          const itemId = normalizeSceneItemId(args[0]);
          const flagId = Number(args[1]);
          const value = Number(args[2]) !== 0;
          if (itemId) steps.push({ type: 'setItem', itemId, value });
          if (Number.isFinite(flagId) && flagId > 0) steps.push({ type: 'setFlag', flagId, value });
          break;
        }
        case 'C': {
          const targetScene = targetSceneId(args[0]);
          if (!targetScene) break;
          const target = { scene: targetScene };
          const targetArg = Number(args[1]);
          if (Number.isFinite(targetArg)) {
            if (targetScene === 'arrest' || targetScene === 'prison') target.reasonCode = targetArg;
            else target.entrySection = targetArg;
          }
          this._prependSteps([...steps, { type: 'transition', target }]);
          return;
        }
        case 'K': {
          const nextSection = Number(args[0]);
          if (Number.isFinite(nextSection) && nextSection > 0) {
            this._prependSteps([...steps, { type: 'interactiveSection', sectionId: nextSection }]);
            return;
          }
          break;
        }
        case 'O': {
          const itemId = normalizeSceneItemId(args[0]);
          const nextSection = Number(args[1]);
          if (itemId && this.selectedItem === itemId && Number.isFinite(nextSection) && nextSection > 0) {
            this._prependSteps([...steps, { type: 'interactiveSection', sectionId: nextSection }]);
            return;
          }
          break;
        }
        case 'V':
        case 'B':
        case 'A':
        case 'M':
          this._applyStreetEffect(record.cmd, args);
          break;
        case 'X':
          this._prependSteps(steps);
          return;
        default:
          break;
      }
    }
    this._prependSteps(steps);
  }

  _handleItemInteractionAction(action) {
    if (!action) return false;
    if (action.kind === 'flow') {
      this._queueEvent(action.id);
      return true;
    }
    if (action.kind === 'interactiveSection') {
      this._enqueueSteps([{ type: 'interactiveSection', sectionId: action.sectionId }]);
      this._processActionQueue();
      return true;
    }
    if (action.kind === 'textRef') {
      this._openTextRefSection(action.sectionId);
      return true;
    }
    return false;
  }

  _applySpecialObjectVisibility() {
    for (const obj of this.sceneObjects) {
      if (typeof obj._visibleWhen === 'function') obj.visible = obj._visibleWhen(this.state);
    }
    if (this.sceneData.specialInteraction?.id === 'smallMap') {
      this._interactionEnabled.smallMap = this.state.map !== true;
    }
  }

  _afterStateChanged(key) {
    super._afterStateChanged(key);
    if (key === 'map' || key === 'items') this._applySpecialObjectVisibility();
  }

  _getInteractionRect(interaction) {
    return interaction.rect || null;
  }

  _requestTransition(target) {
    if (!target?.scene) return;
    if (!isImplementedStreetTransitionTarget(target.scene)) {
      this._openMessage('sceneUnavailable');
      return;
    }
    super._requestTransition({
      ...target,
      state: buildStreetCarryState(this.state),
    });
  }

  _openMap() {
    this._stopSound();
    this.modal = {
      id: 'worldMap',
      type: 'message',
      presentation: 'resource',
      asset: 'MAP',
      locked: false,
      hotspots: WORLD_MAP_HOTSPOTS,
    };
    this._afterModalChanged();
    this._refreshCursor();
  }

  _handleResourceHotspot(hotspot) {
    if (!hotspot?.scene) return false;
    this._stopSound();
    this.modal = null;
    this._afterModalChanged();
    this._refreshCursor();
    this._requestTransition({ scene: hotspot.scene, initial: true, entry: 'map' });
    return true;
  }

  _getDebugStaticRegions() {
    const zones = this.walkZones.map((rect, index) => ({
      id: `walkZone.${index + 1}`,
      rect,
      color: DEBUG_REGION_COLORS.walkZone,
    }));
    const masks = this.walkMasks.map((rect, index) => ({
      id: `walkMask.${index + 1}`,
      rect,
      color: '#ff2d55',
    }));
    const exits = (this.sceneData.exits || []).map((exitDef) => ({
      id: exitDef.name || `exit.${exitDef.targetScene || exitDef.sectionId}`,
      rect: exitDef.rect,
      color: DEBUG_REGION_COLORS.exit,
    }));
    const specials = this.sceneData.specialInteraction
      ? [{
          id: this.sceneData.specialInteraction.id,
          rect: this.sceneData.specialInteraction.rect,
          color: DEBUG_REGION_COLORS.special,
        }]
      : [];
    const manual = (this.sceneData.manualInteractions || []).map((interaction) => ({
      id: interaction.id,
      rect: interaction.rect,
      color: DEBUG_REGION_COLORS.special,
    }));
    return [...zones, ...masks, ...exits, ...specials, ...manual];
  }

  _getDebugActiveInteractions() {
    return (this.sceneScript.interactions || []).map((interaction) => ({
      ...interaction,
      _debugColor: interaction.id.startsWith('exit:') ? DEBUG_REGION_COLORS.exit : DEBUG_REGION_COLORS.special,
    }));
  }
}
