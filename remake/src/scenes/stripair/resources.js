import { buildScxResourceTables } from '../../runtime/scx-resource-parser.js';
import { STRIPAIR_TEXT } from './generated/stripair-text.js';

const tables = buildScxResourceTables(STRIPAIR_TEXT, 'STRIPAIR');

export const STRIPAIR_RESOURCES = Object.freeze({
  ...tables,
});
