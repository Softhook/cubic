import type { Rng } from '../rng';
import { planet } from '../planet';
import { PLANET_FAMILY } from '../tokens';
import { hsl, n, type Fragment } from '../svg';
import { f, line } from './core';
import { arrowPath } from './effects';
import { ship, type DieOptions } from './ships';

/** A planet from the tile artwork, with a seeded number and type. */
export function world(id: string, r2: Rng, cx: number, cy: number, r: number, number?: number): Fragment {
  const num = number ?? r2.pick([7, 8, 9, 10]);
  return planet({ rng: r2.fork('planet'), id, cx, cy, r, number: num, type: r2.pick(PLANET_FAMILY[num].types) });
}

/** Projects board spaces (i, j) to the page, isometric like the dice: a die of edge `c` fills a space. */
export interface Iso {
  c: number;
  x(i: number, j: number): number;
  y(i: number, j: number): number;
}

export function iso(ox: number, oy: number, c: number): Iso {
  return { c, x: (i, j) => ox + (i - j) * c * 0.866, y: (i, j) => oy + (i + j) * c * 0.5 };
}

/** Board lines over spaces i0..i1 × j0..j1, fading out towards the edge of the patch. */
export function grid(id: string, g: Iso, i0: number, i1: number, j0: number, j1: number, hue: number, a = 0.55): Fragment {
  let d = '';
  for (let i = i0 - 0.5; i <= i1 + 0.5; i++) d += `M${n(g.x(i, j0 - 0.5))} ${n(g.y(i, j0 - 0.5))}L${n(g.x(i, j1 + 0.5))} ${n(g.y(i, j1 + 0.5))}`;
  for (let j = j0 - 0.5; j <= j1 + 0.5; j++) d += `M${n(g.x(i0 - 0.5, j))} ${n(g.y(i0 - 0.5, j))}L${n(g.x(i1 + 0.5, j))} ${n(g.y(i1 + 0.5, j))}`;
  const ci = (i0 + i1) / 2;
  const cj = (j0 + j1) / 2;
  const cx = g.x(ci, cj);
  const cy = g.y(ci, cj);
  const rx = Math.abs(g.x(i1 + 0.5, j0 - 0.5) - g.x(i0 - 0.5, j1 + 0.5)) / 2;
  return {
    defs:
      `<radialGradient id="${id}-fade" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(rx)}" gradientTransform="translate(${n(cx)} ${n(cy)}) scale(1 .58) translate(${n(-cx)} ${n(-cy)})"><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>` +
      `<mask id="${id}-mask" maskUnits="userSpaceOnUse" x="${n(cx - rx * 1.2)}" y="${n(cy - rx)}" width="${n(rx * 2.4)}" height="${n(rx * 2)}"><rect x="${n(cx - rx * 1.2)}" y="${n(cy - rx)}" width="${n(rx * 2.4)}" height="${n(rx * 2)}" fill="url(#${id}-fade)"/></mask>`,
    body: `<path d="${d}" fill="none" stroke="${hsl(hue, 80, 72)}" stroke-width=".18" opacity="${n(a)}" mask="url(#${id}-mask)"/>`,
  };
}

/** One board space, lit: a move, a deployment zone, a forbidden space. */
export function space(g: Iso, i: number, j: number, hue: number, o: { a?: number; inset?: number; stroke?: boolean; dash?: boolean; light?: number } = {}): string {
  const k = 0.5 - (o.inset ?? 0.06);
  const pts = [[i - k, j - k], [i + k, j - k], [i + k, j + k], [i - k, j + k]].map(([a, b]) => `${n(g.x(a, b))},${n(g.y(a, b))}`).join(' ');
  const l = o.light ?? 62;
  return `<polygon points="${pts}" fill="${hsl(hue, 90, l, o.a ?? 0.28)}"${o.stroke === false ? '' : ` stroke="${hsl(hue, 90, l + 14)}" stroke-width=".22"${o.dash ? ' stroke-dasharray=".8 .6"' : ''}`}/>`;
}

/** A ship standing on space (i, j). */
export const shipOn = (id: string, g: Iso, i: number, j: number, s: number, value: number, hue: number, o: DieOptions = {}) => ship(id, g.x(i, j), g.y(i, j) - s * 0.5, s, value, hue, o);

/** A planet sitting on space (i, j), with its shadow ring on the board. */
export function worldOn(id: string, r2: Rng, g: Iso, i: number, j: number, rad: number, hue: number, number?: number): Fragment[] {
  const x = g.x(i, j);
  const y = g.y(i, j);
  return [
    f(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rad * 1.25)}" ry="${n(rad * 0.62)}" fill="${hsl(hue, 80, 50, 0.12)}" stroke="${hsl(hue, 80, 72)}" stroke-width=".2" opacity=".8"/>`),
    world(id, r2, x, y - rad * 0.75, rad, number),
  ];
}

/** A path over board spaces, from centre to centre, ending in an arrowhead. */
export function route(id: string, g: Iso, cells: [number, number][], colour: string, o: { w?: number; dash?: boolean; head?: boolean; lift?: number } = {}): Fragment {
  const lift = o.lift ?? 0;
  const d = cells.map(([i, j], k) => `${k ? 'L' : 'M'}${n(g.x(i, j))} ${n(g.y(i, j) - lift)}`).join('');
  return arrowPath(id, d, colour, { w: o.w ?? 0.5, dash: o.dash, head: o.head });
}

/** The scrapyard: a tray on the board, where ships wait off the map. */
export function scrapyard(cx: number, cy: number, w: number, d: number, hue: number): string {
  const g = iso(cx, cy, 1);
  const corner = (a: number, b: number) => `${n(g.x(a, b))},${n(g.y(a, b))}`;
  const outer = [corner(-w / 2, -d / 2), corner(w / 2, -d / 2), corner(w / 2, d / 2), corner(-w / 2, d / 2)].join(' ');
  const inner = [corner(-w / 2 + 0.8, -d / 2 + 0.8), corner(w / 2 - 0.8, -d / 2 + 0.8), corner(w / 2 - 0.8, d / 2 - 0.8), corner(-w / 2 + 0.8, d / 2 - 0.8)].join(' ');
  let stripes = '';
  for (let t = -w / 2 + 1.5; t < w / 2 - 0.5; t += 1.6) stripes += line(g.x(t, d / 2 - 0.4), g.y(t, d / 2 - 0.4), g.x(t + 0.8, d / 2 - 0.4), g.y(t + 0.8, d / 2 - 0.4), hsl(42, 95, 60), 0.35, ' opacity=".7"');
  return (
    `<polygon points="${outer}" fill="${hsl(hue, 40, 12, 0.85)}" stroke="${hsl(hue, 70, 65)}" stroke-width=".3"/>` +
    `<polygon points="${inner}" fill="none" stroke="${hsl(hue, 70, 65)}" stroke-width=".18" stroke-dasharray=".6 .5" opacity=".6"/>` +
    stripes
  );
}
