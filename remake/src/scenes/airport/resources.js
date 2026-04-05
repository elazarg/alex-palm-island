import { buildScxResourceTables } from '../../runtime/scx-resource-parser.js';
import { AIRPORT_TEXT } from './generated/airport-text.js';

const tables = buildScxResourceTables(AIRPORT_TEXT, 'AIRPORT');

export const AIRPORT_RESOURCES = Object.freeze({
  ...tables,
  dialogs: Object.freeze({
    guardQuestion: tables.dialogBySection[2010],
    clerkQuestion: tables.dialogBySection[2100],
  }),
  messages: Object.freeze({
    guardHotel: tables.messageBySection[1021],
    guardBag: tables.messageBySection[1022],
    guardFood: tables.messageBySection[1023],
    guardTaxi: tables.messageBySection[1024],
    passportBlocked: tables.messageBySection[1031],
    doorWarning1: tables.messageBySection[1080],
    doorWarning2: tables.messageBySection[1081],
    doorWarning3: tables.messageBySection[1082],
    clerkRepeat1: tables.messageBySection[1191],
    clerkRepeat2: tables.messageBySection[1192],
    clerkRepeat3: tables.messageBySection[1193],
    clerkNotInfo: tables.messageBySection[1194],
  }),
});
