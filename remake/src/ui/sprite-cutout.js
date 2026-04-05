/**
 * Flood-fill edge transparency: makes black border pixels transparent by
 * flood-filling inward from all four edges of the image data.
 *
 * @param {ImageData} imageData - The image data to modify in place
 * @param {{ opaqueOnly?: boolean }} options
 *   opaqueOnly: true (default) — only flood through fully opaque black (a === 255)
 *   opaqueOnly: false — flood through any non-transparent black (a > 0)
 */
export function makeEdgeTransparent(imageData, { opaqueOnly = true } = {}) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const seen = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const off = idx * 4;
    const isBlack = data[off] === 0 && data[off + 1] === 0 && data[off + 2] === 0;
    const alphaMatch = opaqueOnly ? data[off + 3] === 255 : data[off + 3] > 0;
    if (!isBlack || !alphaMatch) return;
    seen[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
}
