import { CMYK_TABLE } from './cmykTable';
import { deflateChunks } from './pdf';
import { crc32 } from './zip';

/**
 * Getting print files ready for a press: RGB PNGs with their colour space and resolution, and
 * the conversion to the press's CMYK. See docs/GRAPHICS.md §4.
 */

/** The press the CMYK is made for: its registered printing condition (FOGRA39) and profile name. */
export const PRESS = { condition: CMYK_TABLE.condition, profile: CMYK_TABLE.profile };

const N = CMYK_TABLE.grid;
const TABLE = Uint8Array.from(atob(CMYK_TABLE.data), (c) => c.charCodeAt(0));
/** For each 0–255 channel value, the grid point below it and how far it is towards the next (0–1). */
const CELL = Array.from({ length: 256 }, (_, v) => Math.min(Math.floor((v / 255) * (N - 1)), N - 2));
const FRAC = Float32Array.from({ length: 256 }, (_, v) => (v / 255) * (N - 1) - CELL[v]);

/**
 * Converts RGBA pixels (opaque, sRGB) to CMYK bytes for the press, by trilinear interpolation in the
 * table from scripts/cmyk-table.ts (relative colorimetric with black point compensation, so the art's
 * darkest tones stay apart rather than all printing as the press's black).
 */
export function toCmyk(rgba: Uint8ClampedArray): Uint8Array<ArrayBuffer> {
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
    for (let k = 0; k < 4; k++) {
      let v = 0;
      for (let c = 0; c < 8; c++) v += w[c] * TABLE[o + corners[c] + k];
      out[i + k] = v + 0.5;
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
