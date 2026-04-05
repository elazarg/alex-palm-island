function parseSpeakerLine(line) {
  const lastComma = line.lastIndexOf(',');
  const spritePart = lastComma >= 0 ? line.slice(0, lastComma).trim() : line.trim();
  const sound = lastComma >= 0 ? line.slice(lastComma + 1).trim().toUpperCase() : '';
  return Object.freeze({
    spriteLine: line,
    spritePart,
    sound,
  });
}

function resolveEntry(textModule, kind, sectionId, sceneName) {
  const entry = textModule[kind][String(sectionId)];
  if (!entry) throw new Error(`Missing ${sceneName} ${kind.slice(0, -1)} section ${sectionId}`);
  if (Array.isArray(entry)) {
    return { header: '', lines: entry };
  }
  return { header: entry.header || '', lines: entry.lines || [] };
}

function parseDialogSection(textModule, sectionId, sceneName) {
  const { lines } = resolveEntry(textModule, 'dialogs', sectionId, sceneName);

  const speaker = parseSpeakerLine(lines[0]);
  const prompt = lines[1];
  const question = lines[2];
  const choiceCount = Number(lines[3]);
  const choices = lines.slice(4, 4 + choiceCount);
  let responseCountIndex = 4 + choiceCount;
  while (responseCountIndex < lines.length && lines[responseCountIndex] === '') responseCountIndex++;
  const responseCount = Number(lines[responseCountIndex]);
  const responses = [];
  let index = responseCountIndex + 1;

  for (let i = 0; i < responseCount; i++) {
    const [result, flagId, gotoSection, sound] = lines[index++].split(',').map((part) => part.trim());
    const text = lines[index++];
    responses.push(Object.freeze({
      result: Number(result),
      flagId: Number(flagId),
      gotoSection: Number(gotoSection),
      sound: sound.toUpperCase(),
      text,
    }));
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

function parseMessageSection(textModule, sectionId, sceneName) {
  const { lines } = resolveEntry(textModule, 'messages', sectionId, sceneName);
  return Object.freeze({
    sectionId,
    speaker: parseSpeakerLine(lines[0]),
    text: lines[1],
  });
}

function parseTextRefSection(textModule, sectionId, sceneName) {
  const { header, lines } = resolveEntry(textModule, 'textRefs', sectionId, sceneName);
  const resourceMatch = lines.length === 1 ? /^([A-Za-z0-9_-]+),(\d+)$/.exec(lines[0]) : null;
  const narrationMatch = /^(\d+),1,([^,]+)$/i.exec(header);
  return Object.freeze({
    sectionId,
    lines: Object.freeze([...lines]),
    text: lines.join('\n'),
    sound: narrationMatch ? narrationMatch[2].toUpperCase() : '',
    resource: resourceMatch
      ? Object.freeze({
          kind: 'resource',
          name: resourceMatch[1],
          variant: Number(resourceMatch[2]),
          asset: resourceMatch[1].toUpperCase(),
        })
      : null,
  });
}

function parseSectionMap(sectionIds, parser) {
  return Object.freeze(
    Object.fromEntries(sectionIds.map((sectionId) => [sectionId, parser(sectionId)]))
  );
}

export function buildScxResourceTables(textModule, sceneName) {
  const dialogSections = Object.freeze(
    Object.keys(textModule.dialogs).map((key) => Number(key)).sort((a, b) => a - b)
  );
  const messageSections = Object.freeze(
    Object.keys(textModule.messages).map((key) => Number(key)).sort((a, b) => a - b)
  );
  const textRefSections = Object.freeze(
    Object.keys(textModule.textRefs).map((key) => Number(key)).sort((a, b) => a - b)
  );

  return Object.freeze({
    sections: Object.freeze({
      dialogs: dialogSections,
      messages: messageSections,
      textRefs: textRefSections,
    }),
    dialogBySection: parseSectionMap(dialogSections, (sectionId) => parseDialogSection(textModule, sectionId, sceneName)),
    messageBySection: parseSectionMap(messageSections, (sectionId) => parseMessageSection(textModule, sectionId, sceneName)),
    textRefBySection: parseSectionMap(textRefSections, (sectionId) => parseTextRefSection(textModule, sectionId, sceneName)),
  });
}
