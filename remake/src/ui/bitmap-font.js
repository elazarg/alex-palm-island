// Bitmap font renderer using the game's MAINFONT
//
// Font format: 260-byte header + per-glyph bitmaps (16×8 fixed storage)
// Display width from widths[] table (variable, 3-9px)
// White pixels on transparent background

export class BitmapFont {
  constructor(sheetImage, glyphData, options = {}) {
    this.sheet = sheetImage;  // Image with all glyphs in a row
    this.glyphs = glyphData.glyphs;  // {char: {x, w}}
    this.height = glyphData.height;
    this.preserveColors = !!options.preserveColors;
    this._sheetCache = new Map([['#ffffff', sheetImage]]);
  }

  _getSheetForColor(color) {
    if (this.preserveColors) return this.sheet;
    const key = (color || '#ffffff').toLowerCase();
    if (this._sheetCache.has(key)) return this._sheetCache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = this.sheet.width;
    canvas.height = this.sheet.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sheet, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this._sheetCache.set(key, canvas);
    return canvas;
  }

  // Measure text width in pixels
  measureText(text) {
    let w = 0;
    for (const ch of text) {
      const g = this.glyphs[ch];
      w += g ? g.w : 4; // default space for unknown chars
    }
    return w;
  }

  // Draw text at (x, y) on the canvas context
  drawText(ctx, text, x, y, color = '#ffffff') {
    let cx = x;
    const sheet = this._getSheetForColor(color);
    for (const ch of text) {
      const g = this.glyphs[ch];
      if (g) {
        // Draw glyph from sprite sheet: source rect (g.x, 0, g.w, height)
        ctx.drawImage(sheet, g.x, 0, g.w, this.height, cx, y, g.w, this.height);
        cx += g.w;
      } else {
        cx += 4;
      }
    }
  }

  measureTextScaled(text, scaleX = 1) {
    return Math.round(this.measureText(text) * scaleX);
  }

  drawTextScaled(ctx, text, x, y, scaleX = 1, scaleY = 1, color = '#ffffff') {
    let cx = x;
    const sheet = this._getSheetForColor(color);
    for (const ch of text) {
      const g = this.glyphs[ch];
      if (g) {
        const dw = Math.max(1, Math.round(g.w * scaleX));
        const dh = Math.max(1, Math.round(this.height * scaleY));
        ctx.drawImage(sheet, g.x, 0, g.w, this.height, cx, y, dw, dh);
        cx += dw;
      } else {
        cx += Math.max(1, Math.round(4 * scaleX));
      }
    }
  }

  // Draw centered text
  drawCentered(ctx, text, centerX, y, color = '#ffffff') {
    const w = this.measureText(text);
    this.drawText(ctx, text, Math.round(centerX - w / 2), y, color);
  }

  // Word-wrap and draw centered, returns number of lines
  drawWrapped(ctx, text, centerX, y, maxWidth, lineHeight, color = '#ffffff') {
    const lh = lineHeight || this.height + 2;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (this.measureText(test) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);

    for (let i = 0; i < lines.length; i++) {
      this.drawCentered(ctx, lines[i], centerX, y + i * lh, color);
    }
    return lines.length;
  }

  drawWrappedLeft(ctx, text, x, y, maxWidth, lineHeight, color = '#ffffff') {
    const lh = lineHeight || this.height + 2;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (this.measureText(test) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);

    for (let i = 0; i < lines.length; i++) {
      this.drawText(ctx, lines[i], x, y + i * lh, color);
    }
    return lines.length;
  }
}
