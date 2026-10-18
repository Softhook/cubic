import { SPACE_BASE } from '@quantum/art';
import { CMYK_TABLE } from './cmykTable';
import { deflateChunks } from './pdf';
import { crc32 } from './zip';

/**
 * Getting print files ready for a press: RGB PNGs with their colour space and resolution, and
 * the conversion to the press's CMYK. See docs/GRAPHICS.md §4.
 */

/**
 * The press the CMYK is made for: its registered printing condition (FOGRA39) and profile name, and how
 * the two relate for notes and READMEs, so a printer doesn't read them as two different targets.
 */
export const PRESS = {
  condition: CMYK_TABLE.condition,
  profile: CMYK_TABLE.profile,
  described: `${CMYK_TABLE.profile}, a profile for the ${CMYK_TABLE.condition} condition`,
  /** For file names: `fogra39`. */
  tag: CMYK_TABLE.condition.toLowerCase(),
};

/** The tag for a CMYK file's name: `fogra39`, or `fogra39-deep` with the deep black (`toCmyk`). */
export const pressTag = (deep: boolean) => (deep ? `${PRESS.tag}-deep` : PRESS.tag);

const N = CMYK_TABLE.grid;
const TABLE = Uint8Array.from(atob(CMYK_TABLE.data), (c) => c.charCodeAt(0));
/** For each 0–255 channel value, the grid point below it and how far it is towards the next (0–1). */
const CELL = Array.from({ length: 256 }, (_, v) => Math.min(Math.floor((v / 255) * (N - 1)), N - 2));
const FRAC = Float32Array.from({ length: 256 }, (_, v) => (v / 255) * (N - 1) - CELL[v]);

/*
 * The deep black, an option on the CMYK exports. The profile's own darkest ink caps black at 94 %, which
 * its measured data prints at L* 11.7 (the space base at 13.7); with full black ink under a cool mix the
 * same press prints L* 9. So from black to the space base, by the brightest channel (so dark colours
 * above it keep theirs), the ink goes from RICH_BLACK to BASE_BLACK, a touch lighter so the dust stays
 * apart from the base; from the base to twice it, it fades back to the profile's. Within the 300 % limit.
 */
const RICH_BLACK = [90, 70, 35, 100]; // L* 9.0
const BASE_BLACK = [80, 65, 42, 100]; // L* 9.5
/** The space base's brightest channel (23), from its HSL lightness and saturation. */
const BASE_V = Math.round(255 * (SPACE_BASE[2] / 100) * (1 + SPACE_BASE[1] / 100));
const FADE_V = 2 * BASE_V;
/** For each brightest-channel value: how much of the profile's ink is kept (0–1), and the deep black's share of the ink, in bytes. */
const KEEP = new Float32Array(256);
const DEEP_INK = new Float32Array(256 * 4);
for (let v = 0; v < 256; v++) {
  const t = Math.min(1, Math.max(0, (v - BASE_V) / (FADE_V - BASE_V)));
  KEEP[v] = t * t * (3 - 2 * t);
  const a = Math.min(1, v / BASE_V);
  for (let k = 0; k < 4; k++) DEEP_INK[v * 4 + k] = (1 - KEEP[v]) * 2.55 * (RICH_BLACK[k] + (BASE_BLACK[k] - RICH_BLACK[k]) * a);
}

/**
 * Converts RGBA pixels (opaque, sRGB) to CMYK bytes for the press, by trilinear interpolation in the
 * table from scripts/cmyk-table.ts (relative colorimetric with black point compensation, so the art's
 * darkest tones stay apart rather than all printing as the press's black). `deep` prints the darkest
 * tones, the space base and below, as a full-black rich black instead (above).
 */
export function toCmyk(rgba: Uint8ClampedArray, deep = false): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(rgba.length);
  // Offsets of a cell's corners in the table, from its lowest corner: red slowest, then green, then blue.
  const sr = N * N * 4;
  const sg = N * 4;
  const corners = [0, 4, sg, sg + 4, sr, sr + 4, sr + sg, sr + sg + 4];
  const w = new Float32Array(8);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const fr = FRAC[r];
    const fg = FRAC[g];
    const fb = FRAC[b];
    w[0] = (1 - fr) * (1 - fg) * (1 - fb);
    w[1] = (1 - fr) * (1 - fg) * fb;
    w[2] = (1 - fr) * fg * (1 - fb);
    w[3] = (1 - fr) * fg * fb;
    w[4] = fr * (1 - fg) * (1 - fb);
    w[5] = fr * (1 - fg) * fb;
    w[6] = fr * fg * (1 - fb);
    w[7] = fr * fg * fb;
    const o = CELL[r] * sr + CELL[g] * sg + CELL[b] * 4;
    // Without the deep black, the brightest value: all the profile's ink, none of the deep black's.
    const m = deep ? Math.max(r, g, b) : 255;
    const keep = KEEP[m];
    for (let k = 0; k < 4; k++) {
      let v = 0;
      for (let c = 0; c < 8; c++) v += w[c] * TABLE[o + corners[c] + k];
      out[i + k] = v * keep + DEEP_INK[m * 4 + k] + 0.5;
    }
  }
  return out;
}

/** An sRGB ICC profile (LittleCMS's built-in one, free to use), zlib-compressed as a PNG `iCCP` chunk wants it. */
const SRGB_ICC =
  'eNqVkbtLQmEYxn9qYZghUUNEg4NdBoUoiMaywUVCzCCrRY+3wMvhHCWiNWhpCBqilm5D/0GtQWtBEBRBRHNjtyXk9H4qKFFD38d33h/Pd56X9zwH7OG8VjDbpqBQLBvRUNC7EF/0Ol9w0S17GF9CM/XpSCTMn+vzDpuqtwHVi/+tzlTa1MDWITyh6UZZWKYhvFrWFW8J92q5REr4UNhvyIDCV0pP1vlZcbbO74qNWHQG7KqnN9vCyRbWckZBeETYV8hXtMY86kvc6eL8nNR+OQOYRAkRxEuSCivkKROQWpTMfveN1nyzlMSjyVNnDUMcWXLi9Ytaka5pqRnR07LzrKncf+ZpZsbH6t3dQWh/sqy3QXDuQHXbsr6OLKt6DI5HuCg2/SXJafJD9O2m5jsAzwacXTa15C6cb0Lfg54wEjXJIceeycDrKXTFoecGXEv1rBr3nNxDbF1+0TXs7cOQvO9Z/gY8MWgl';

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Each band of RGBA rows (opaque) as PNG scanlines: RGB, each row Paeth-filtered, which suits smooth art. */
async function* scanlines(bands: AsyncIterable<Uint8ClampedArray>, w: number) {
  const n = w * 3;
  let prev = new Uint8Array(n);
  let row = new Uint8Array(n);
  for await (const rgba of bands) {
    const rows = rgba.length / (w * 4);
    const out = new Uint8Array(rows * (n + 1));
    for (let r = 0; r < rows; r++) {
      for (let x = 0, i = r * w * 4; x < n; x += 3, i += 4) {
        row[x] = rgba[i];
        row[x + 1] = rgba[i + 1];
        row[x + 2] = rgba[i + 2];
      }
      const o = r * (n + 1);
      out[o] = 4;
      for (let i = 0; i < n; i++) {
        const a = i < 3 ? 0 : row[i - 3];
        const b = prev[i];
        const c = i < 3 ? 0 : prev[i - 3];
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        out[o + 1 + i] = row[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      [prev, row] = [row, prev];
    }
    yield out;
  }
}

/**
 * A PNG for print from RGBA pixels (opaque) in bands of rows, top to bottom (files.ts `drawBands`): RGB,
 * with an sRGB profile, so the printer's RIP converts the colours as we see them rather than guessing, and
 * the resolution, so the file opens at its physical size rather than at 72 dpi. Written here rather than
 * by the canvas, whose PNGs in Safari carry their own sRGB and EXIF chunks, which the profile would clash with.
 */
export async function encodePng(bands: AsyncIterable<Uint8ClampedArray>, w: number, h: number, dpi: number): Promise<Blob> {
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, w);
  new DataView(ihdr.buffer).setUint32(4, h);
  ihdr[8] = 8; // bits per channel; colour type 2 (RGB) next, then compression, filter and interlace, all 0
  ihdr[9] = 2;
  const icc = Uint8Array.from(atob(SRGB_ICC), (c) => c.charCodeAt(0));
  // Profile name, a zero byte, compression method 0 (zlib), then the compressed profile.
  const iccp = new Uint8Array([...new TextEncoder().encode('sRGB'), 0, 0, ...icc]);
  const phys = new Uint8Array(9);
  const ppm = Math.round(dpi / 0.0254);
  new DataView(phys.buffer).setUint32(0, ppm);
  new DataView(phys.buffer).setUint32(4, ppm);
  phys[8] = 1; // the unit is the metre
  const idat = await deflateChunks(scanlines(bands, w));
  return new Blob(
    [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('iCCP', iccp),
      chunk('pHYs', phys),
      ...idat.map((d) => chunk('IDAT', d)),
      chunk('IEND', new Uint8Array()),
    ],
    { type: 'image/png' },
  );
}
