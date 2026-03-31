function wrapText(font, text, maxWidth) {
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

function makeTransparentSlice(source, slice) {
  const canvas = document.createElement('canvas');
  canvas.width = slice.sw;
  canvas.height = slice.sh;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, slice.sx, slice.sy, slice.sw, slice.sh, 0, 0, slice.sw, slice.sh);
  const img = ctx.getImageData(0, 0, slice.sw, slice.sh);
  const data = img.data;
  const stack = [];
  const seen = new Uint8Array(slice.sw * slice.sh);

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= slice.sw || y >= slice.sh) return;
    const idx = y * slice.sw + x;
    if (seen[idx]) return;
    seen[idx] = 1;
    const offset = idx * 4;
    if (data[offset + 3] && data[offset] === 0 && data[offset + 1] === 0 && data[offset + 2] === 0) {
      stack.push(idx);
    }
  };

  for (let x = 0; x < slice.sw; x++) {
    push(x, 0);
    push(x, slice.sh - 1);
  }
  for (let y = 1; y < slice.sh - 1; y++) {
    push(0, y);
    push(slice.sw - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const offset = idx * 4;
    data[offset + 3] = 0;
    const x = idx % slice.sw;
    const y = Math.floor(idx / slice.sw);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

function getSpeakerPlacement(modal, layout) {
  const bucket = modal.presentation === 'talk' ? 'response' : 'dialog';
  return layout.speakerPlacement?.[bucket]
    || layout.speakerPlacement?.default
    || { x: 0, y: 0 };
}

function drawSpeakerPortrait(ctx, engine, modal, uiTick, layout) {
  const baseName = modal.speakerBase || modal.speakerSprite;
  const npc = engine.assets.get(baseName);
  if (!npc) return;
  const placement = getSpeakerPlacement(modal, layout);

  const clip = modal.presentation === 'talk'
    ? layout.speakerClip.response
    : layout.speakerClip.dialog;
  ctx.save();
  ctx.beginPath();
  ctx.rect(clip.x, clip.y, clip.w, clip.h);
  ctx.clip();
  ctx.drawImage(npc, placement.x, placement.y);

  const shouldAnimateOverlay = Boolean(modal.speakerTalking || modal.presentation === 'talk');
  const overlay = modal.speakerOverlay;
  if (shouldAnimateOverlay && overlay?.sequence?.length) {
    const idx = Math.floor(uiTick / (overlay.rate || 8)) % overlay.sequence.length;
    const frameNum = overlay.sequence[idx];
    if (frameNum) {
      const img = engine.assets.get(`${overlay.prefix}${frameNum}`);
      if (img) ctx.drawImage(img, placement.x + overlay.ox, placement.y + overlay.oy);
    }
  } else if (modal.speakerStaticOverlay?.asset) {
    const img = engine.assets.get(modal.speakerStaticOverlay.asset);
    if (img) {
      ctx.drawImage(
        img,
        placement.x + (modal.speakerStaticOverlay.ox || 0),
        placement.y + (modal.speakerStaticOverlay.oy || 0)
      );
    }
  }
  ctx.restore();

  if (modal.presentation !== 'talk') {
    for (const overlayAsset of layout.foregroundOverlays || []) {
      const img = engine.assets.get(overlayAsset.asset);
      if (img) ctx.drawImage(img, overlayAsset.x, overlayAsset.y);
    }
  }
}

function drawQuestionSelection(ctx, font, modal, layout) {
  const question = layout.question;
  const baseQuestion = modal.question.replace(/:\s*$/, '');
  const prefix = modal.selectedChoice != null ? `${baseQuestion} ` : `${baseQuestion}: `;
  const selectedText = modal.selectedChoice != null
    ? modal.choices[modal.selectedChoice].label
    : question.placeholder;

  let cx = question.x;
  let cy = question.y;

  const drawWord = (word, color) => {
    const width = font.measureText(word);
    if (cx > question.x && cx + width > question.x + question.maxWidth) {
      cy += question.lineHeight;
      cx = question.x;
    }
    font.drawText(ctx, word, cx, cy, color);
    cx += width;
  };

  for (const token of prefix.match(/\S+\s*/g) || [prefix]) {
    drawWord(token, question.color);
  }

  if (modal.selectedChoice != null) {
    for (const token of selectedText.match(/\S+\s*/g) || [selectedText]) {
      drawWord(token, question.selectedColor);
    }
  } else {
    drawWord(selectedText, question.color);
  }

  return cy;
}

function drawChoiceText(ctx, font, text, x, y, maxWidth, lineHeight, color) {
  const lines = wrapText(font, text, maxWidth);
  let cy = y;
  for (const line of lines) {
    font.drawText(ctx, line, x, cy, color);
    cy += lineHeight;
  }
  return Math.max(1, lines.length);
}

function getAlexPortraitAsset(engine, modal, layout) {
  const portrait = layout.alexPortrait;
  if (!portrait) return null;
  let frame = portrait.idleFrame || 1;
  if (modal.phase === 'alexReply' && modal.alexTalking && modal.replyDurationTicks > 0) {
    const frames = portrait.talkingFrames || [frame];
    const elapsed = Math.max(0, modal.replyTick || 0);
    const progress = Math.min(0.999, elapsed / modal.replyDurationTicks);
    frame = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
  }
  return engine.assets.get(`${portrait.prefix}${frame}`);
}

export function buildTalkResponseSlices(engine, layout) {
  void engine;
  void layout;
}

export function renderTalkDialog(ctx, { engine, font, modal, uiTick, layout }) {
  const win = engine.assets.get(layout.dialogWindow.asset);
  if (win) ctx.drawImage(win, layout.dialogWindow.x, layout.dialogWindow.y);

  drawSpeakerPortrait(ctx, engine, modal, uiTick, layout);

  const alex = getAlexPortraitAsset(engine, modal, layout);
  if (alex) ctx.drawImage(alex, layout.alexPortrait.x, layout.alexPortrait.y);

  const topLines = wrapText(font, modal.prompt, layout.prompt.maxWidth);
  let promptY = layout.prompt.y;
  for (const line of topLines) {
    font.drawText(ctx, line, layout.prompt.x, promptY, layout.prompt.color);
    promptY += layout.prompt.lineHeight;
  }

  const phase = modal.phase || 'choice';
  const choiceBoxes = [];
  if (phase === 'npcPrompt') {
    return { choiceBoxes, dialogExitBox: null };
  }

  drawQuestionSelection(ctx, font, modal, layout);

  let y = layout.choices.y;
  for (let i = 0; i < modal.choices.length; i++) {
    const choiceText = modal.choices[i].label;
    const bodyX = layout.choices.numberX + layout.choices.bodyGap;
    const lineCount = wrapText(font, choiceText, layout.choices.maxWidth).length || 1;
    const boxHeight = lineCount * layout.choices.lineHeight + layout.choices.highlightPadTop + layout.choices.highlightPadBottom;

    if (modal.selectedChoice === i) {
      ctx.fillStyle = layout.choices.highlightColor;
      ctx.fillRect(
        layout.choices.highlightX,
        y - layout.choices.highlightPadTop,
        layout.choices.highlightRight - layout.choices.highlightX,
        boxHeight
      );
      drawChoiceText(ctx, font, choiceText, bodyX, y, layout.choices.maxWidth, layout.choices.lineHeight, layout.choices.selectedTextColor);
      font.drawText(ctx, `${i + 1}.`, layout.choices.numberX, y, layout.choices.selectedNumberColor);
    } else {
      font.drawText(ctx, `${i + 1}.`, layout.choices.numberX, y, layout.choices.textColor);
      drawChoiceText(ctx, font, choiceText, bodyX, y, layout.choices.maxWidth, layout.choices.lineHeight, layout.choices.textColor);
    }
    choiceBoxes.push({
      x1: layout.choices.numberX,
      y1: y - 2,
      x2: layout.choices.highlightRight,
      y2: y + lineCount * layout.choices.lineHeight + 2,
    });
    y += lineCount * layout.choices.lineHeight;
  }

  if (phase === 'alexReply') {
    return { choiceBoxes: [], dialogExitBox: null };
  }

  const exit = engine.assets.get(layout.exitButton.asset);
  let dialogExitBox = null;
  if (exit) {
    ctx.drawImage(exit, layout.exitButton.x, layout.exitButton.y);
    dialogExitBox = {
      x1: layout.exitButton.x,
      y1: layout.exitButton.y,
      x2: layout.exitButton.x + exit.width,
      y2: layout.exitButton.y + exit.height,
    };
  }

  return { choiceBoxes, dialogExitBox };
}

export function renderTalkResponse(ctx, { engine, font, modal, uiTick, layout }) {
  const responseWindow = engine.assets.get(layout.responseWindow.asset);
  if (responseWindow) ctx.drawImage(responseWindow, layout.responseWindow.x, layout.responseWindow.y);
  drawSpeakerPortrait(ctx, engine, modal, uiTick, layout);
  for (const overlayAsset of layout.responseForegroundOverlays || []) {
    const img = engine.assets.get(overlayAsset.asset);
    if (img) ctx.drawImage(img, overlayAsset.x, overlayAsset.y);
  }

  const lines = wrapText(font, modal.text, layout.responseText.maxWidth);
  let y = layout.responseText.y;
  for (const line of lines) {
    font.drawText(ctx, line, layout.responseText.x, y, layout.responseText.color);
    y += layout.responseText.lineHeight;
  }

  return { choiceBoxes: [], dialogExitBox: null };
}
