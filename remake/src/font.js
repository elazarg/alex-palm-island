// Bitmap font renderer using the game's MAINFONT
//
// Font format: 260-byte header + per-glyph bitmaps (16×8 fixed storage)
// Display width from widths[] table (variable, 3-9px)
// White pixels on transparent background

export class BitmapFont {
  constructor(sheetImage, glyphData) {
    this.sheet = sheetImage;  // Image with all glyphs in a row
    this.glyphs = glyphData.glyphs;  // {char: {x, w}}
    this.height = glyphData.height;
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
  drawText(ctx, text, x, y) {
    let cx = x;
    for (const ch of text) {
      const g = this.glyphs[ch];
      if (g) {
        // Draw glyph from sprite sheet: source rect (g.x, 0, g.w, height)
        ctx.drawImage(this.sheet, g.x, 0, g.w, this.height, cx, y, g.w, this.height);
        cx += g.w;
      } else {
        cx += 4;
      }
    }
  }

  // Draw centered text
  drawCentered(ctx, text, centerX, y) {
    const w = this.measureText(text);
    this.drawText(ctx, text, Math.round(centerX - w / 2), y);
  }

  // Word-wrap and draw centered, returns number of lines
  drawWrapped(ctx, text, centerX, y, maxWidth, lineHeight) {
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
      this.drawCentered(ctx, lines[i], centerX, y + i * lh);
    }
    return lines.length;
  }
}
