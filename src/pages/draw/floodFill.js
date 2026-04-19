/**
 * Flood fill on RGBA ImageData from a composite bitmap (base + strokes).
 * Returns a binary mask (width * height) where 1 = pixel should receive fill color on overlay.
 */

const DEFAULT_TOLERANCE = 28;

function matchPixel(data, px, tr, tg, tb, ta, tolerance) {
  const i = px * 4;
  return (
    Math.abs(data[i] - tr) <= tolerance &&
    Math.abs(data[i + 1] - tg) <= tolerance &&
    Math.abs(data[i + 2] - tb) <= tolerance &&
    Math.abs(data[i + 3] - ta) <= tolerance
  );
}

/**
 * @param {ImageData} imageData - composite pixels (RGBA)
 * @param {number} sx - seed x (integer)
 * @param {number} sy - seed y (integer)
 * @param {number} [tolerance] - max delta per RGBA channel vs seed color
 * @returns {{ mask: Uint8Array, count: number, target: { r: number, g: number, b: number, a: number } | null }}
 */
export function floodFillMask(
  imageData,
  sx,
  sy,
  tolerance = DEFAULT_TOLERANCE
) {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  const len = w * h;
  const mask = new Uint8Array(len);

  const emptyTarget = () => ({
    mask,
    count: 0,
    target: null,
  });

  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return emptyTarget();
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return emptyTarget();

  const seed = y0 * w + x0;
  const ti = seed * 4;
  const tr = d[ti];
  const tg = d[ti + 1];
  const tb = d[ti + 2];
  const ta = d[ti + 3];

  const target = { r: tr, g: tg, b: tb, a: ta };

  if (!matchPixel(d, seed, tr, tg, tb, ta, tolerance)) {
    return { mask, count: 0, target };
  }

  const queue = new Int32Array(len);
  let tail = 0;
  let head = 0;
  let count = 0;

  queue[tail++] = seed;

  const tryPush = (p) => {
    if (mask[p]) return;
    if (!matchPixel(d, p, tr, tg, tb, ta, tolerance)) return;
    queue[tail++] = p;
  };

  while (head < tail) {
    const cur = queue[head++];
    if (mask[cur]) continue;
    if (!matchPixel(d, cur, tr, tg, tb, ta, tolerance)) continue;

    mask[cur] = 1;
    count++;

    const x = cur % w;
    const y = (cur / w) | 0;

    if (x > 0) tryPush(cur - 1);
    if (x + 1 < w) tryPush(cur + 1);
    if (y > 0) tryPush(cur - w);
    if (y + 1 < h) tryPush(cur + w);
  }

  return { mask, count, target };
}

/** True if two opaque-ish RGB colors are within tolerance (channel-wise). */
export function rgbWithinTolerance(r1, g1, b1, r2, g2, b2, tolerance = 8) {
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance
  );
}
