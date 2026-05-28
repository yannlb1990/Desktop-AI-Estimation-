/**
 * Some PDFs embed JPEG2000 tiles where the JP2 container header (`colr` box) claims
 * sRGB (Enumerated colorspace 16, 3-channel) while the image header (`ihdr`) says
 * 1 component. The contradiction triggers a silent decode failure in pdfjs/OpenJPEG,
 * so those tile positions render blank.
 *
 * These tiles also carry `pclr` (palette) and `cmap` boxes — the intent was a
 * palette-indexed image, but the `colr` colorspace was wrongly set to sRGB instead
 * of Greyscale. Patching `colr` EnumCS from 16 → 17 (Greyscale) makes the
 * single-channel codestream self-consistent so OpenJPEG decodes it correctly.
 *
 * Only tiles that have BOTH `pclr` present AND `colr` = sRGB are touched; all other
 * JP2 streams (standard RGB tiles, non-JP2 data) are left byte-for-byte identical.
 */
export function patchPaletteJP2Tiles(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer).slice(); // operate on a copy

  const TYPE_JP2H = 0x6A703268; // 'jp2h'
  const TYPE_COLR = 0x636F6C72; // 'colr'
  const TYPE_PCLR = 0x70636C72; // 'pclr'

  const r32 = (o: number) =>
    ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  const w32 = (o: number, v: number) => {
    bytes[o]     = (v >>> 24) & 0xFF;
    bytes[o + 1] = (v >>> 16) & 0xFF;
    bytes[o + 2] = (v >>> 8)  & 0xFF;
    bytes[o + 3] =  v         & 0xFF;
  };

  // JP2 signature box: 00 00 00 0C 6A 50 20 20 0D 0A 87 0A
  const SIG = [0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A];
  let patches = 0;

  for (let i = 0; i <= bytes.length - 12; i++) {
    // Two-byte fast filter before the full 12-byte check
    if (bytes[i] !== 0x00 || bytes[i + 4] !== 0x6A) continue;
    let match = true;
    for (let j = 0; j < 12; j++) if (bytes[i + j] !== SIG[j]) { match = false; break; }
    if (!match) continue;

    // Walk top-level boxes after the 12-byte signature box
    let pos = i + 12;
    let jp2hOff = -1, jp2hEnd = -1;
    while (pos + 8 <= bytes.length) {
      const len  = r32(pos);
      const type = r32(pos + 4);
      if (len < 8 || pos + len > bytes.length) break;
      if (type === TYPE_JP2H) { jp2hOff = pos; jp2hEnd = pos + len; break; }
      pos += len;
    }
    if (jp2hOff === -1) continue;

    // Walk jp2h children looking for colr and pclr
    let colrOff = -1, hasPclr = false;
    let c = jp2hOff + 8;
    while (c + 8 <= jp2hEnd) {
      const cl = r32(c);
      const ct = r32(c + 4);
      if (cl < 8 || c + cl > jp2hEnd) break;
      if (ct === TYPE_COLR) colrOff = c;
      if (ct === TYPE_PCLR) hasPclr = true;
      c += cl;
    }
    if (!hasPclr || colrOff === -1) continue;

    // colr payload layout: METH(1) PREC(1) APPROX(1) EnumCS(4)
    const d = colrOff + 8;
    if (d + 7 > bytes.length) continue;
    if (bytes[d] !== 1) continue;       // not Enumerated colorspace
    if (r32(d + 3) !== 16) continue;    // not sRGB (16)

    w32(d + 3, 17); // patch: sRGB (16) → Greyscale (17)
    patches++;
  }

  if (patches > 0) {
    console.log(`[jp2patch] patched ${patches} palette-indexed JP2 tile(s) → Greyscale`);
  }
  return bytes.buffer;
}
