import { wrapText } from './text.js';

export function renderNotePopup(ctx, { assets, font, modal, layout }) {
  const lines = wrapText(font, modal.text, layout.maxWidth);
  const winName = lines.length <= 2 ? layout.windowAssets[2]
    : lines.length === 3 ? layout.windowAssets[3]
      : lines.length === 4 ? layout.windowAssets[4]
        : layout.windowAssets[5];
  const win = assets.get(winName);
  if (!win) return;
  const x = Math.round((layout.screenWidth - win.width) / 2);
  const y = layout.y;
  ctx.drawImage(win, x, y);
  let ty = y + layout.textOffsetY;
  for (const line of lines) {
    font.drawText(ctx, line, x + layout.textOffsetX, ty, layout.color);
    ty += layout.lineHeight;
  }
}
