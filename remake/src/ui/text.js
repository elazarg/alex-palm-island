export function wrapText(font, text, maxWidth) {
  const words = text.split(/(\s+)/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line}${word}` : word;
    if (line && !/^\s+$/.test(word) && font.measureText(test) > maxWidth) {
      lines.push(line);
      line = word.trimStart();
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function tokenizePreservingSpaces(text) {
  return text.split(/(\s+)/).filter(Boolean);
}
