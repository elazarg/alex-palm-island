function drawSevenSegmentDigit(ctx, x, y, ch, colors) {
  const { on, off } = colors;
  const segs = {
    '0': ['a', 'b', 'c', 'd', 'e', 'f'],
    '1': ['b', 'c'],
    '2': ['a', 'b', 'g', 'e', 'd'],
    '3': ['a', 'b', 'g', 'c', 'd'],
    '4': ['f', 'g', 'b', 'c'],
    '5': ['a', 'f', 'g', 'c', 'd'],
    '6': ['a', 'f', 'g', 'e', 'c', 'd'],
    '7': ['a', 'b', 'c'],
    '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    '9': ['a', 'b', 'c', 'd', 'f', 'g'],
    ' ': [],
  };
  const onSet = new Set(segs[ch] || []);
  const rects = {
    a: [1, 0, 3, 1],
    b: [4, 1, 1, 3],
    c: [4, 5, 1, 3],
    d: [1, 8, 3, 1],
    e: [0, 5, 1, 3],
    f: [0, 1, 1, 3],
    g: [1, 4, 3, 1],
  };
  for (const [name, rect] of Object.entries(rects)) {
    ctx.fillStyle = onSet.has(name) ? on : off;
    ctx.fillRect(x + rect[0], y + rect[1], rect[2], rect[3]);
  }
}

export function renderPanel(ctx, { assets, mouseY, modalOpen, buttons, pressedMode, amount, bagReceived, inputMode, layout, moneyAnimation }) {
  const meter = assets.get(layout.meter.asset);
  if (meter) ctx.drawImage(meter, layout.meter.x, layout.meter.y);

  const text = String(Math.max(0, Math.min(9999, amount))).padStart(4, ' ');
  let x = layout.money.x;
  for (let i = 0; i < text.length; i++) {
    drawSevenSegmentDigit(ctx, x, layout.money.y, text[i], layout.money.colors);
    x += layout.money.digitWidth + layout.money.gap;
  }

  if (moneyAnimation?.coin) {
    const img = assets.get(`MONEY${moneyAnimation.coin.frameIndex + 1}`);
    if (img) ctx.drawImage(img, moneyAnimation.coin.x, moneyAnimation.coin.y);
  }

  if (modalOpen || mouseY < layout.panel.revealY) return;

  const panel = assets.get(layout.panel.asset);
  if (panel) ctx.drawImage(panel, layout.panel.x, layout.panel.y);

  for (const button of buttons) {
    const sprite = button.mode === 'bag'
      ? (pressedMode === 'bag' ? button.pressed : (bagReceived ? button.active : button.normal))
      : (pressedMode === button.mode ? button.pressed : button.normal);
    const img = assets.get(sprite);
    if (img) ctx.drawImage(img, button.x, button.y);
  }
}
