function drawCaret(ctx, x, y, width, color, visible) {
  if (!visible) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(3, width), 1);
}

export function renderTextForm(ctx, { assets, font, modal, uiTick }) {
  const bg = assets.get(modal.asset);
  if (!bg) return;
  ctx.drawImage(bg, 0, 0);

  const blink = Math.floor(uiTick / 8) % 2 === 0;
  for (let i = 0; i < modal.fields.length; i++) {
    const field = modal.fields[i];
    const value = modal.values[i] || '';
    const prefix = field.prefix || '';
    const accepted = Boolean(modal.accepted?.[i]);
    font.drawText(ctx, field.label, field.labelX, field.y + 4, field.labelColor || '#000000');
    font.drawText(ctx, prefix, field.inputX, field.y + 4, field.prefixColor || '#ff2448');
    const valueX = field.inputX + font.measureText(prefix);
    font.drawText(ctx, value, valueX, field.y + 4, field.inputColor || '#000000');
    if (accepted) {
      font.drawText(ctx, '.', valueX + font.measureText(value), field.y + 4, field.inputColor || '#000000');
    }
    if (i === modal.activeField && !accepted) {
      const caretX = valueX + font.measureText(value);
      drawCaret(ctx, caretX + 1, field.y + 10, field.caretWidth || 6, field.inputColor || '#000000', blink);
    }
  }

  if (modal.errorText) {
    font.drawCentered(ctx, modal.errorText, 160, modal.errorY || 172, modal.errorColor || '#000000');
  }
}
