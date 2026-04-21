/**
 * Composite flood fill for line art (base image + overlay).
 * - Unpremultiplied RGB for color distance vs seed (handles semi-transparent AA).
 * - Luminance-based ink wall + optional dilation to bridge 1px gaps in outlines.
 * - Euclidean color tolerance (single scalar, user-adjustable).
 * - Fringe dilation after BFS, clipped to never paint ink cores (keeps black stroke centers).
 */

const EPS = 1e-3;

function lumRaw(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Squared Euclidean distance in RGB (0–255). */
export function rgbDistanceSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/** @param {Uint8Array} mask - 0/1 per pixel */
function dilateBinary(mask, w, h, iterations) {
  const len = w * h;
  let cur = mask;
  for (let it = 0; it < iterations; it++) {
    const next = new Uint8Array(len);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (cur[p]) {
          next[p] = 1;
          continue;
        }
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h && cur[ny * w + nx]) {
              hit = true;
              break;
            }
          }
        }
        if (hit) next[p] = 1;
      }
    }
    cur = next;
  }
  return cur;
}

const DEFAULT_TOLERANCE = 28;

/**
 * @param {ImageData} imageData
 * @param {number} sx
 * @param {number} sy
 * @param {object} [options]
 * @param {number} [options.colorTolerance=48] max RGB distance from seed (unpremultiplied)
 * @param {number} [options.outlineLumSoft=62] raw luminance threshold for ink (wall source)
 * @param {number} [options.outlineLumHard=28] stricter luminance; never painted in fringe clip
 * @param {number} [options.barrierDilate=1] dilate ink wall (0 = off)
 * @param {number} [options.fringeGrow=1] dilate fill mask after BFS (0 = off)
 * @param {number} [options.alphaMin=8] min alpha to treat pixel as ink for wall/core
 * @returns {{ mask: Uint8Array, count: number, target: { r: number, g: number, b: number, a: number } | null }}
 */
export function floodFillComposite(imageData, sx, sy, options = {}) {
  const {
    colorTolerance = 48,
    outlineLumSoft = 62,
    outlineLumHard = 28,
    barrierDilate = 1,
    fringeGrow = 1,
    alphaMin = 8,
  } = options;

  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  const len = w * h;

  const emptyMask = () => ({
    mask: new Uint8Array(len),
    count: 0,
    target: null,
  });

  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return emptyMask();
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return emptyMask();

  const seed = y0 * w + x0;
  const ti = seed * 4;
  const tr = d[ti];
  const tg = d[ti + 1];
  const tb = d[ti + 2];
  const ta = d[ti + 3];
  const target = { r: tr, g: tg, b: tb, a: ta };

  const dispR = new Uint8Array(len);
  const dispG = new Uint8Array(len);
  const dispB = new Uint8Array(len);
  const rawLum = new Uint16Array(len);

  for (let p = 0; p < len; p++) {
    const i = p * 4;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = d[i + 3];
    rawLum[p] = lumRaw(r, g, b) | 0;
    if (a <= 0) {
      dispR[p] = 255;
      dispG[p] = 255;
      dispB[p] = 255;
    } else {
      const inv = 255 / Math.max(a, EPS);
      dispR[p] = Math.min(255, (r * inv) | 0);
      dispG[p] = Math.min(255, (g * inv) | 0);
      dispB[p] = Math.min(255, (b * inv) | 0);
    }
  }

  const sr = dispR[seed];
  const sg = dispG[seed];
  const sb = dispB[seed];

  const colorTol2 = colorTolerance * colorTolerance;
  const matchFillable = (p) =>
    rgbDistanceSq(dispR[p], dispG[p], dispB[p], sr, sg, sb) <= colorTol2;

  if (!matchFillable(seed)) {
    return { mask: new Uint8Array(len), count: 0, target };
  }

  const inkSoft = new Uint8Array(len);
  const inkCore = new Uint8Array(len);
  for (let p = 0; p < len; p++) {
    const a = d[p * 4 + 3];
    const lum = rawLum[p];
    if (a >= alphaMin && lum <= outlineLumSoft) inkSoft[p] = 1;
    if (a >= alphaMin && lum <= outlineLumHard) inkCore[p] = 1;
  }

  const wall =
    barrierDilate > 0
      ? dilateBinary(inkSoft, w, h, barrierDilate)
      : inkSoft;

  if (wall[seed]) {
    return { mask: new Uint8Array(len), count: 0, target };
  }

  const mask = new Uint8Array(len);
  const queue = new Int32Array(len);
  let tail = 0;
  let head = 0;
  let count = 0;

  const tryPush = (p) => {
    if (mask[p] || wall[p]) return;
    if (!matchFillable(p)) return;
    queue[tail++] = p;
  };

  queue[tail++] = seed;

  while (head < tail) {
    const cur = queue[head++];
    if (mask[cur]) continue;
    if (wall[cur] || !matchFillable(cur)) continue;

    mask[cur] = 1;
    count++;

    const x = cur % w;
    const y = (cur / w) | 0;

    if (x > 0) tryPush(cur - 1);
    if (x + 1 < w) tryPush(cur + 1);
    if (y > 0) tryPush(cur - w);
    if (y + 1 < h) tryPush(cur + w);
  }

  if (count === 0) {
    return { mask, count: 0, target };
  }

  let finalMask = mask;
  if (fringeGrow > 0) {
    finalMask = dilateBinary(mask, w, h, fringeGrow);
  }

  let finalCount = 0;
  for (let p = 0; p < len; p++) {
    if (finalMask[p] && inkCore[p]) {
      finalMask[p] = 0;
    }
    if (finalMask[p]) finalCount++;
  }

  return { mask: finalMask, count: finalCount, target };
}

/**
 * Legacy entry: no wall/fringe (approximates old per-channel fill for callers).
 * @deprecated Prefer floodFillComposite for draw UI.
 */
export function floodFillMask(
  imageData,
  sx,
  sy,
  tolerance = DEFAULT_TOLERANCE
) {
  return floodFillComposite(imageData, sx, sy, {
    colorTolerance: tolerance,
    outlineLumSoft: -1,
    outlineLumHard: -1,
    barrierDilate: 0,
    fringeGrow: 0,
    alphaMin: 256,
  });
}

/** True if two opaque-ish RGB colors are within tolerance (channel-wise). */
export function rgbWithinTolerance(r1, g1, b1, r2, g2, b2, tolerance = 8) {
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance
  );
}
