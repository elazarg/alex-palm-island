import { PRISON_TEXT } from './generated/prison-text.js';

function parseMessage(sectionId) {
  const record = PRISON_TEXT.messages[String(sectionId)];
  if (!record) throw new Error(`Missing PRISON message section ${sectionId}`);
  const parts = record.header.split(',').map((part) => part.trim());
  return Object.freeze({
    sectionId,
    speaker: 'Narrator',
    sound: parts[2]?.toUpperCase() || '',
    text: record.lines.join('\n'),
  });
}

const messageSections = Object.freeze(
  Object.keys(PRISON_TEXT.messages).map((key) => Number(key)).sort((a, b) => a - b)
);

export const PRISON_RESOURCES = Object.freeze({
  sections: Object.freeze({
    messages: messageSections,
  }),
  messageBySection: Object.freeze(
    Object.fromEntries(messageSections.map((sectionId) => [sectionId, parseMessage(sectionId)]))
  ),
});
