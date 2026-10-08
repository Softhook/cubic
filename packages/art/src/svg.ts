/** Small helpers for building SVG markup as strings. */

/** A number rounded to 0.01 (artwork is in mm, so that's 10 µm), without trailing zeros. */
export const n = (x: number) => String(Math.round(x * 100) / 100);

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

/** A colour as `#rrggbb`: for marks that must survive import into tools like Illustrator, which don't read `hsl()`. */
export const hex = (h: number, s: number, l: number) =>
  '#' + hslToRgb(h, s, l).map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');

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

/** Wraps fragments in a standalone SVG document with a viewBox in mm. */
export function document(f: Fragment, view: { x: number; y: number; w: number; h: number }, physical = true): string {
  const size = physical ? ` width="${n(view.w)}mm" height="${n(view.h)}mm"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(view.x)} ${n(view.y)} ${n(view.w)} ${n(view.h)}"${size}>` +
    `<defs>${f.defs}</defs>${f.body}</svg>`
  );
}

/** Clips a printed piece to its die-cut corners (`w` × `h` trim, corner radius `r`), for on-screen previews. */
export const dieCut = (f: Fragment, id: string, w: number, h: number, r: number): Fragment => ({
  defs: f.defs + `<clipPath id="${id}-corners"><rect width="${n(w)}" height="${n(h)}" rx="${n(r)}"/></clipPath>`,
  body: `<g clip-path="url(#${id}-corners)">${f.body}</g>`,
});

/** An SVG document as a `data:` URL, for `<img>` and SVG `<image>`. */
export const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
