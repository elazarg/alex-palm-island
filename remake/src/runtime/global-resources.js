import { buildScxResourceTables } from './scx-resource-parser.js';
import { buildNarrationSoundManifest } from './scx-sound-manifest.js';
import { GLOBAL_TEXT } from './generated/global-text.js';

const tables = buildScxResourceTables(GLOBAL_TEXT, 'GLOBAL');

export const GLOBAL_RESOURCES = Object.freeze({
  ...tables,
});

export const GLOBAL_SOUND_MANIFEST = buildNarrationSoundManifest(tables);
