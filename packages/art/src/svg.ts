/** Small helpers for building SVG markup as strings. */

/** A number rounded to 0.01 (artwork is in mm, so that's 10 µm), without trailing zeros. */
export const n = (x: number) => String(Math.round(x * 100) / 100);

/** A rectangle: its top left, width and height. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A soft blur filter, its region half as big again all round what it blurs. */
export const blur = (id: string, sd: number) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(sd)}"/></filter>`;

/** One SVG fragment: what goes in `<defs>` and what is drawn. */
export interface Fragment {
  defs: string;
  body: string;
}

export const join = (...parts: Fragment[]): Fragment => ({
  defs: parts.map((p) => p.defs).join(''),
  body: parts.map((p) => p.body).join(''),
});

/** Escapes text for use inside SVG markup. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A colour as an `hsl()` string. */
export const hsl = (h: number, s: number, l: number, a = 1) =>
  a === 1 ? `hsl(${n(h)} ${n(s)}% ${n(l)}%)` : `hsl(${n(h)} ${n(s)}% ${n(l)}% / ${n(a)})`;

/** RGB in 0–1 for an HSL colour; used for filter tables, which need numbers rather than CSS colours. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (m: number) => (m + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (m: number) => l - a * Math.max(-1, Math.min(k(m) - 3, Math.min(9 - k(m), 1)));
  return [f(0), f(8), f(4)];
}

export type Hsl = [h: number, s: number, l: number];

/** An RGB colour (0–1, clamped) as `#rrggbb`. */
const rgbHex = (rgb: readonly number[]) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(Math.max(0, Math.min(1, c)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/** A colour as `#rrggbb`: for marks that must survive import into tools like Illustrator, which don't read `hsl()`. */
export const hex = (h: number, s: number, l: number) => rgbHex(hslToRgb(h, s, l));

/**
 * A filter primitive that maps a grey value (0–1, in every channel) to a colour ramp: a "gradient map".
 * `stops` are spread evenly over 0–1; repeat a stop to hold a colour, put two close together for a hard edge.
 */
export function gradientMap(stops: Hsl[], input = '', result = ''): string {
  const rgb = stops.map(([h, s, l]) => hslToRgb(h, s, l));
  const table = (i: number) => rgb.map((c) => n(c[i])).join(' ');
  return (
    `<feComponentTransfer${input ? ` in="${input}"` : ''}${result ? ` result="${result}"` : ''}>` +
    `<feFuncR type="table" tableValues="${table(0)}"/>` +
    `<feFuncG type="table" tableValues="${table(1)}"/>` +
    `<feFuncB type="table" tableValues="${table(2)}"/>` +
    `</feComponentTransfer>`
  );
}

/** Copies the red channel into R, G and B (opaque), so a noise texture becomes one grey value. */
export const greyFromRed = (input = '', result = '') =>
  `<feColorMatrix${input ? ` in="${input}"` : ''}${result ? ` result="${result}"` : ''} type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1"/>`;

/** Stretches contrast around 0.5: fractal noise mostly sits in the middle of its range. */
export const stretch = (slope: number, input = '', result = '') => {
  const icept = n(0.5 - slope / 2);
  return (
    `<feComponentTransfer${input ? ` in="${input}"` : ''}${result ? ` result="${result}"` : ''}>` +
    `<feFuncR type="linear" slope="${n(slope)}" intercept="${icept}"/>` +
    `<feFuncG type="linear" slope="${n(slope)}" intercept="${icept}"/>` +
    `<feFuncB type="linear" slope="${n(slope)}" intercept="${icept}"/>` +
    `</feComponentTransfer>`
  );
};

/** A noise primitive: `fractalNoise` for clouds, `turbulence` for ridge noise (near 0 along thin lines). */
export const turbulence = (freq: string | number, octaves: number, seed: number, result: string, kind = 'fractalNoise') =>
  `<feTurbulence type="${kind}" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="${result}"/>`;

/** Paints one colour, its alpha taken from the input's red channel as `a · red + b`. */
export const tint = (colour: Hsl, a: number, b: number, input = '', result = '') => {
  const [r, g, bl] = hslToRgb(...colour);
  return `<feColorMatrix${input ? ` in="${input}"` : ''}${result ? ` result="${result}"` : ''} type="matrix" values="0 0 0 0 ${n(r)} 0 0 0 0 ${n(g)} 0 0 0 0 ${n(bl)} ${n(a)} 0 0 0 ${n(b)}"/>`;
};

/** Turns ridge noise (`type="turbulence"`) into opaque lines of one colour: higher `sharpness` is thinner. */
export const ridges = (colour: Hsl, sharpness: number, input: string, result: string) => tint(colour, -sharpness, 1, input, result);

/** A mask over `box` (user units) whose strength is the luminance of the paint server `fill` (a gradient's id). */
export const gradientMask = (id: string, box: { x: number; y: number; w: number; h: number }, fill: string) => {
  const at = `x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}"`;
  return `<mask id="${id}" maskUnits="userSpaceOnUse" ${at}><rect ${at} fill="url(#${fill})"/></mask>`;
};

/** Wraps fragments in a standalone SVG document with a viewBox in mm. */
export function document(f: Fragment, view: { x: number; y: number; w: number; h: number }, physical = true, fontCss?: string): string {
  const size = physical ? ` width="${n(view.w)}mm" height="${n(view.h)}mm"` : '';
  const style = fontCss ? `<style>${fontCss}</style>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(view.x)} ${n(view.y)} ${n(view.w)} ${n(view.h)}"${size}>` +
    `<defs>${style}${f.defs}</defs>${f.body}</svg>`
  );
}

/** Clips a printed piece to its die-cut corners (`w` × `h` trim, corner radius `r`), for on-screen previews. */
export const dieCut = (f: Fragment, id: string, w: number, h: number, r: number): Fragment => ({
  defs: f.defs + `<clipPath id="${id}-corners"><rect width="${n(w)}" height="${n(h)}" rx="${n(r)}"/></clipPath>`,
  body: `<g clip-path="url(#${id}-corners)">${f.body}</g>`,
});

/** An SVG document as a `data:` URL, for `<img>` and SVG `<image>`. */
export const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
