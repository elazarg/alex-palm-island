export function renderSceneDebugOverlay(ctx, entries = []) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';
  ctx.textBaseline = 'top';
  for (const entry of entries) {
    if (!entry?.rect || !entry?.color) continue;
    strokeDebugRect(ctx, entry.rect, entry.color, entry.label, entry.fillAlpha ?? 0.2);
  }
  ctx.restore();
}

function strokeDebugRect(ctx, rect, color, label, fillAlpha) {
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = withAlpha(color, fillAlpha);
  ctx.fillRect(x1, y1, w, h);
  ctx.strokeStyle = color;
  ctx.strokeRect(x1 + 0.5, y1 + 0.5, w, h);
  if (!label) return;
  const paddingX = 3;
  const paddingY = 2;
  const metrics = ctx.measureText(label);
  const textWidth = Math.ceil(metrics.width);
  const boxWidth = Math.min(textWidth + paddingX * 2, 180);
  const boxHeight = 12;
  const labelX = Math.max(0, x1);
  const labelY = Math.max(0, y1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(labelX, labelY, boxWidth, boxHeight);
  ctx.fillStyle = color;
  ctx.fillText(label, labelX + paddingX, labelY + paddingY - 1);
}

function withAlpha(hex, alpha) {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
