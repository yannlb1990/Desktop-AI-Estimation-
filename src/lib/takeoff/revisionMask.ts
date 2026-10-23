/** Pure pixel maths for plan revision compare (no browser APIs, so it can be tested in node). */

/** Dark enough to be linework (0-255 luma) */
// 230 so light grey vector hairlines (common in CAD exports) count as linework
export const INK_LUMA = 230;

export function inkMask(rgba: Uint8ClampedArray, w: number, h: number, threshold = INK_LUMA): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; i += 4, p++) {
    const a = rgba[i + 3];
    if (a < 32) continue;
    const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    if (luma < threshold) mask[p] = 1;
  }
  return mask;
}

/** Grow a mask by r pixels (square), so near-identical lines count as the same line. */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = 0;
    const row = y * w;
    // horizontal pass with a sliding window of width 2r+1
    for (let x = -r; x < w; x++) {
      const add = x + r < w ? mask[row + x + r] : 0;
      const drop = x - r - 1 >= 0 ? mask[row + x - r - 1] : 0;
      run += add - drop;
      if (x >= 0) tmp[row + x] = run > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = -r; y < h; y++) {
      const add = y + r < h ? tmp[(y + r) * w + x] : 0;
      const drop = y - r - 1 >= 0 ? tmp[(y - r - 1) * w + x] : 0;
      run += add - drop;
      if (y >= 0) out[y * w + x] = run > 0 ? 1 : 0;
    }
  }
  return out;
}

export interface MaskDiff { overlay: Uint8ClampedArray; added: number; removed: number; ink: number }

export function diffMasks(oldMask: Uint8Array, newMask: Uint8Array, w: number, h: number, tolerancePx = 2): MaskDiff {
  const oldNear = dilate(oldMask, w, h, tolerancePx);
  const newNear = dilate(newMask, w, h, tolerancePx);
  const overlay = new Uint8ClampedArray(w * h * 4);
  let added = 0, removed = 0, ink = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (newMask[p]) ink++;
    if (newMask[p] && !oldNear[p]) {
      added++;
      overlay[i] = 0; overlay[i + 1] = 170; overlay[i + 2] = 80; overlay[i + 3] = 235;
    } else if (oldMask[p] && !newNear[p]) {
      removed++;
      overlay[i] = 225; overlay[i + 1] = 40; overlay[i + 2] = 40; overlay[i + 3] = 235;
    }
  }
  return { overlay, added, removed, ink };
}

