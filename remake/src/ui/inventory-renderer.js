import { WIDTH, HEIGHT } from '../core/engine.js';
import { resolveActionButtonSprite } from './action-modes.js';

const GRID_POSITIONS = Object.freeze([
  { x: 142, y: 45 },
  { x: 176, y: 45 },
  { x: 210, y: 45 },
  { x: 142, y: 79 },
  { x: 176, y: 79 },
  { x: 210, y: 79 },
  { x: 142, y: 113 },
  { x: 176, y: 113 },
  { x: 210, y: 113 },
]);

const CONTROL_BUTTONS = Object.freeze([
  { mode: 'look', normal: 'LOOKBUTTON', pressed: 'LOOKPRESSED', x: 168, y: 162, w: 44, h: 31 },
  { mode: 'take', normal: 'TOUCHBUTTON', pressed: 'TOUCHPRESSED', x: 214, y: 161, w: 40, h: 32 },
  { mode: 'exit', normal: 'EXITBUTTON', pressed: 'EXITPRESSED', x: 263, y: 162, w: 40, h: 31 },
]);

export function renderInventoryScreen(ctx, { assets, font, modal, selectedItem }) {
  const bg = assets.get('SUITCASE');
  if (bg) ctx.drawImage(bg, 0, 0);
  else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (modal.inspectItem) {
    const window = assets.get('ICONWINDOW');
    if (window) ctx.drawImage(window, 10, 10);
    const picture = modal.inspectItem.pictureAsset ? assets.get(modal.inspectItem.pictureAsset) : null;
    if (picture) ctx.drawImage(picture, 34, 26);
    if (font && modal.inspectItem.description) {
      font.drawWrappedLeft(
        ctx,
        modal.inspectItem.description,
        160,
        50,
        110,
        11,
        '#000000',
      );
    }
    return { itemBoxes: [], controlBoxes: [] };
  }

  const itemBoxes = [];
  for (let i = 0; i < modal.items.length && i < GRID_POSITIONS.length; i++) {
    const item = modal.items[i];
    const icon = assets.get(item.asset);
    const pos = GRID_POSITIONS[i];
    itemBoxes.push({
      itemId: item.id,
      x1: pos.x - 4,
      y1: pos.y - 4,
      x2: pos.x + (icon?.width || 28) + 4,
      y2: pos.y + (icon?.height || 22) + 4,
    });
    if (icon) ctx.drawImage(icon, pos.x, pos.y);
    if (selectedItem === item.id) {
      ctx.strokeStyle = '#fcfc0c';
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x - 2, pos.y - 2, (icon?.width || 28) + 4, (icon?.height || 22) + 4);
    }
  }

  const controlBoxes = [];
  for (const button of CONTROL_BUTTONS) {
    const assetName = resolveActionButtonSprite(button, {
      pressedMode: modal.pressedControlMode || null,
    });
    const img = assets.get(assetName);
    if (img) ctx.drawImage(img, button.x, button.y);
    controlBoxes.push({
      mode: button.mode,
      x1: button.x,
      y1: button.y,
      x2: button.x + button.w,
      y2: button.y + button.h,
    });
  }

  return { itemBoxes, controlBoxes };
}
