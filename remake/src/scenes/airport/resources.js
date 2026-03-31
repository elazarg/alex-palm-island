import { AIRPORT_TEXT } from './generated/airport-text.js';

function parseSpeakerLine(line) {
  const lastComma = line.lastIndexOf(',');
  const spritePart = lastComma >= 0 ? line.slice(0, lastComma).trim() : line.trim();
  const sound = lastComma >= 0 ? line.slice(lastComma + 1).trim().toUpperCase() : '';
  return {
    spriteLine: line,
    spritePart,
    sound,
  };
}

function parseDialog(sectionId) {
  const lines = AIRPORT_TEXT.dialogs[String(sectionId)];
  if (!lines) throw new Error(`Missing AIRPORT dialog section ${sectionId}`);

  const speaker = parseSpeakerLine(lines[0]);
  const prompt = lines[1];
  const question = lines[2];
  const choiceCount = Number(lines[3]);
  const choices = lines.slice(4, 4 + choiceCount);
  const responseCount = Number(lines[4 + choiceCount]);
  const responses = [];
  let index = 5 + choiceCount;

  for (let i = 0; i < responseCount; i++) {
    const [result, flagId, gotoSection, sound] = lines[index++].split(',').map(part => part.trim());
    const text = lines[index++];
    responses.push({
      result: Number(result),
      flagId: Number(flagId),
      gotoSection: Number(gotoSection),
      sound: sound.toUpperCase(),
      text,
    });
  }

  return Object.freeze({
    sectionId,
    speaker,
    prompt,
    question,
    choices: Object.freeze(choices),
    responses: Object.freeze(responses),
  });
}

function parseMessage(sectionId) {
  const lines = AIRPORT_TEXT.messages[String(sectionId)];
  if (!lines) throw new Error(`Missing AIRPORT message section ${sectionId}`);
  return Object.freeze({
    sectionId,
    speaker: parseSpeakerLine(lines[0]),
    text: lines[1],
  });
}

export const AIRPORT_RESOURCES = Object.freeze({
  dialogs: Object.freeze({
    guardQuestion: parseDialog(2010),
    clerkQuestion: parseDialog(2100),
  }),
  messages: Object.freeze({
    guardHotel: parseMessage(1021),
    guardBag: parseMessage(1022),
    guardFood: parseMessage(1023),
    guardTaxi: parseMessage(1024),
    passportBlocked: parseMessage(1031),
    doorWarning1: parseMessage(1080),
    doorWarning2: parseMessage(1081),
    doorWarning3: parseMessage(1082),
    clerkRepeat1: parseMessage(1191),
    clerkRepeat2: parseMessage(1192),
    clerkRepeat3: parseMessage(1193),
  }),
});
