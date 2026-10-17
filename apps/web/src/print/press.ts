import { crc32 } from './zip';

/**
 * Getting print files ready for a press: a tone curve that lifts the art's deepest shadows above what
 * ink can hold, and PNGs tagged with their colour space and resolution. See docs/GRAPHICS.md §4.
 */

/**
 * The shadow lift, as L* in → L* out (CIE lightness, 0–100). Screens show tones down to L* 0, but a
 * press's darkest black is around L* 9–12 on coated stock and lighter on uncoated, and below that
 * everything prints as one flat black. Much of the art (the space between stars, nebulae, the wells)
 * lives in L* 2–15, so it is lifted: black to L* 6, the darkest tones spread at least as far apart as
 * they were, and the curve back to unchanged from L* 60. Check it against a physical proof (the press test, #lab/proof).
 */
const LIFT: [number, number][] = [
  [0, 6],
  [5, 11.5],
  [10, 16.5],
  [20, 25],
  [30, 33.5],
  [45, 46],
  [60, 60],
  [100, 100],
];

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (y: number) => (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055);
const lightness = (y: number) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y);
const luminance = (l: number) => (l > 8 ? ((l + 16) / 116) ** 3 : (l * 27) / 24389);

/** The lift for one 0–255 channel value, treated as the grey of that value (so greys stay grey). */
const LIFT_TABLE = Uint8ClampedArray.from({ length: 256 }, (_, v) => {
  const l = lightness(toLinear(v / 255));
  const k = LIFT.findIndex(([x]) => x >= l);
  const [x0, y0] = LIFT[Math.max(0, k - 1)];
  const [x1, y1] = LIFT[k];
  const out = x1 === x0 ? y1 : y0 + ((l - x0) / (x1 - x0)) * (y1 - y0);
  return Math.round(fromLinear(luminance(out)) * 255);
});

/** Applies the shadow lift to a canvas, in place. */
export function liftShadows(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = LIFT_TABLE[d[i]];
    d[i + 1] = LIFT_TABLE[d[i + 1]];
    d[i + 2] = LIFT_TABLE[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);
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

/**
 * Tags a PNG for print: an sRGB profile, so the printer's RIP converts the colours as we see them rather
 * than guessing, and the resolution, so the file opens at its physical size rather than at 72 dpi.
 */
export async function tagPng(png: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  // The signature (8 bytes) and IHDR (25) come first; the new chunks must come before the image data.
  const at = 33;
  const icc = Uint8Array.from(atob(SRGB_ICC), (c) => c.charCodeAt(0));
  // Profile name, a zero byte, compression method 0 (zlib), then the compressed profile.
  const iccp = new Uint8Array([...new TextEncoder().encode('sRGB'), 0, 0, ...icc]);
  const phys = new Uint8Array(9);
  const ppm = Math.round(dpi / 0.0254);
  new DataView(phys.buffer).setUint32(0, ppm);
  new DataView(phys.buffer).setUint32(4, ppm);
  phys[8] = 1; // the unit is the metre
  return new Blob([bytes.subarray(0, at), chunk('iCCP', iccp), chunk('pHYs', phys), bytes.subarray(at)], { type: 'image/png' });
}
