function addName(names, sound) {
  const name = String(sound || '').trim().toUpperCase();
  if (!name) return;
  names.add(name);
}

export function collectScxSoundNames(tables, { dialogs = true, messages = true, textRefs = true, filter = null } = {}) {
  const names = new Set();
  if (dialogs) {
    for (const dialog of Object.values(tables.dialogBySection || {})) {
      addName(names, dialog.speaker?.sound);
      for (const response of dialog.responses || []) addName(names, response.sound);
    }
  }
  if (messages) {
    for (const message of Object.values(tables.messageBySection || {})) {
      addName(names, message.speaker?.sound);
      addName(names, message.sound);
    }
  }
  if (textRefs) {
    for (const textRef of Object.values(tables.textRefBySection || {})) {
      addName(names, textRef.sound);
    }
  }
  const sorted = [...names].sort();
  return filter ? sorted.filter((name) => filter(name)) : sorted;
}

export function buildSoundManifest(soundNames, basePath) {
  return Object.freeze(
    Object.fromEntries(soundNames.map((name) => [name, `${basePath}/${name}.wav`]))
  );
}

export function buildNarrationSoundManifest(tables, basePath = '../assets/narration') {
  return buildSoundManifest(
    collectScxSoundNames(tables, {
      dialogs: false,
      messages: true,
      textRefs: true,
      filter: (name) => name.startsWith('SDNAR'),
    }),
    basePath
  );
}
