import type { Rng } from './rng';
import { planet } from './planet';
import type { Box } from './starfield';
import { PLANET_FAMILY } from './tokens';
import { hsl, n, type Fragment } from './svg';

/**
 * The drawing kit card illustrations are made from, so every card shares one look: isometric
 * die-ships and cubes standing on a holographic board, tile planets, and flat HUD readouts (tracks,
 * action chips, combat dice, cards) floating over the scene. All sizes are in mm.
 */

/** A scene's frame and colours. Every card illustration is a function of one of these. */
export interface Scene {
  id: string;
  r: Rng;
  /** The card's category hue: holo lines, highlights. */
  hue: number;
  /** Art box: the visible window. */
  box: Box;
  /** Two player hues for ships, different for every card: p1 is "you", p2 an opponent. */
  p1: number;
  p2: number;
}

export type Draw = (s: Scene) => Fragment[];

/** Hues of the two tracks every player has, as in the game UI (dominance red-orange) and on the cards (research violet). */
export const RESEARCH = 268;
export const DOMINANCE = 12;

/** Player colours (hues) for ships in the illustrations, as in the game. */
export const SHIP_HUES = [196, 328, 42, 140];

const INK = hsl(228, 45, 8);

/** A point at a fraction of the art box. */
export const at = (box: Box, fx: number, fy: number): [number, number] => [box.x + box.w * fx, box.y + box.h * fy];

export const f = (body: string, defs = ''): Fragment => ({ defs, body });

export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(w)}" stroke-linecap="round"${extra}/>`;

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// Icons

/** Category icons, drawn on a 24-unit grid with a 2-unit stroke (the same set the game UI uses). */
export const ICONS: Record<string, string> = {
  movement: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  action: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  combat: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  conquer: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  research: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  ship: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
  card: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2"/>',
  expansion: '<path d="M12 5v14M5 12h14"/>',
  missile: '<path d="M5 19l3-3M14 4l6 0 0 6-9 9-6-6z"/><path d="M8 13l3 3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  dominance: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
};

export const icon = (name: string, cx: number, cy: number, size: number, colour: string, width = 2.2) =>
  `<g transform="translate(${n(cx - size / 2)} ${n(cy - size / 2)}) scale(${n(size / 24)})" fill="none" stroke="${colour}" color="${colour}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.action}</g>`;

/** Big numerals and signs over the art ("+1", "×2", "3"): numbers only, so the art needs no translation. */
export const glyph = (x: number, y: number, text: string, size: number, fill: string, anchor = 'middle') =>
  `<text x="${n(x)}" y="${n(y)}" font-family="Orbitron, 'Arial Black', sans-serif" font-weight="900" font-size="${n(size)}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="central" stroke="${INK}" stroke-width="${n(size * 0.16)}" stroke-linejoin="round" paint-order="stroke">${esc(text)}</text>`;

// ---------------------------------------------------------------------------
// Ships: isometric dice

/** Pip positions on a unit face. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.23], [0.73, 0.23], [0.27, 0.5], [0.73, 0.5], [0.27, 0.77], [0.73, 0.77]],
};

/** Two faces that can sit beside `top` on a real die (opposite faces add up to 7). */
function sideFaces(top: number): [number, number] {
  const free = [1, 2, 3, 4, 5, 6].filter((v) => v !== top && v !== 7 - top);
  const left = free[0];
  return [left, free.find((v) => v !== left && v !== 7 - left)!];
}

export interface DieOptions {
  opacity?: number;
  rotate?: number;
  pips?: boolean;
  /** Draw as a dashed outline only: a ship that was here, or is about to be. */
  ghost?: boolean;
}

/**
 * A die-ship as an isometric cube centred on (cx, cy), `s` mm along an edge. Each face is a unit
 * square mapped onto the cube by a transform, so its rounded corners and pips foreshorten correctly.
 */
export function die(cx: number, cy: number, s: number, value: number, hue: number, o: DieOptions = {}): string {
  const k = 0.866 * s;
  const h = s / 2;
  const base = `M${n(cx)} ${n(cy - s)}L${n(cx + k)} ${n(cy - h)}L${n(cx + k)} ${n(cy + h)}L${n(cx)} ${n(cy + s)}L${n(cx - k)} ${n(cy + h)}L${n(cx - k)} ${n(cy - h)}Z`;
  const attrs = (o.opacity !== undefined ? ` opacity="${n(o.opacity)}"` : '') + (o.rotate ? ` transform="rotate(${n(o.rotate)} ${n(cx)} ${n(cy)})"` : '');
  if (o.ghost) {
    const edges = `M${n(cx)} ${n(cy)}L${n(cx)} ${n(cy + s)}M${n(cx)} ${n(cy)}L${n(cx - k)} ${n(cy - h)}M${n(cx)} ${n(cy)}L${n(cx + k)} ${n(cy - h)}`;
    return (
      `<g${attrs} fill="none" stroke="${hsl(hue, 80, 72)}" stroke-width="${n(Math.max(0.2, s * 0.05))}" stroke-dasharray="${n(s * 0.16)} ${n(s * 0.12)}" stroke-linejoin="round">` +
      `<path d="${base}" fill="${hsl(hue, 80, 60, 0.08)}"/><path d="${edges}" opacity=".7"/></g>`
    );
  }
  const [left, right] = sideFaces(value);
  const face = (m: number[], light: number, v: number) =>
    `<g transform="matrix(${m.map(n).join(' ')})">` +
    `<rect x=".05" y=".05" width=".9" height=".9" rx=".16" fill="${hsl(hue, 62, light)}"/>` +
    (o.pips === false ? [] : PIPS[v]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".085" fill="${hsl(hue, 70, light < 40 ? 88 : 12)}" opacity=".9"/>`).join('') +
    `</g>`;
  return (
    `<g${attrs}>` +
    `<path d="${base}" fill="${hsl(hue, 60, 10)}" stroke="${hsl(hue, 60, 10)}" stroke-width="${n(s * 0.08)}" stroke-linejoin="round"/>` +
    face([k, h, -k, h, cx, cy - s], 64, value) +
    face([k, h, 0, s, cx - k, cy - h], 46, left) +
    face([k, -h, 0, s, cx, cy], 30, right) +
    `</g>`
  );
}

/** A soft glow, e.g. under a ship or at an impact. */
export const glow = (id: string, cx: number, cy: number, rx: number, ry: number, hue: number, a = 0.6, light = 62): Fragment => ({
  defs: `<radialGradient id="${id}"><stop offset="0" stop-color="${hsl(hue, 90, light)}" stop-opacity="${n(a)}"/><stop offset="1" stop-color="${hsl(hue, 90, light)}" stop-opacity="0"/></radialGradient>`,
  body: `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"/>`,
});

/** A ship with its engine glow. */
export const ship = (id: string, cx: number, cy: number, s: number, value: number, hue: number, o: DieOptions = {}): Fragment => {
  if (o.ghost) return f(die(cx, cy, s, value, hue, o));
  const g = glow(id, cx, cy + s * 0.9, s * 1.5, s * 0.55, hue, 0.55 * (o.opacity ?? 1));
  return { defs: g.defs, body: g.body + die(cx, cy, s, value, hue, o) };
};

/** A player's cube (dominance marker on a planet): a small plain die. */
export const cube = (cx: number, cy: number, s: number, hue: number, o: DieOptions = {}) => die(cx, cy, s, 1, hue, { ...o, pips: false });

/** A line fading from `colour` at its end to nothing at its start: trails and beams. */
export function streak(id: string, x1: number, y1: number, x2: number, y2: number, colour: string, w: number, a = 1): Fragment {
  return {
    defs: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"><stop offset="0" stop-color="${colour}" stop-opacity="0"/><stop offset="1" stop-color="${colour}" stop-opacity="${n(a)}"/></linearGradient>`,
    body: line(x1, y1, x2, y2, `url(#${id})`, w),
  };
}

/** A weapon beam: a coloured streak with a white core. */
export const beam = (id: string, x1: number, y1: number, x2: number, y2: number, hue: number, w = 1.6): Fragment[] => [
  streak(id, x1, y1, x2, y2, hsl(hue, 100, 70), w),
  f(line(x1, y1, x2, y2, '#fff', w * 0.22, ' opacity=".85"')),
];

/** A many-pointed burst: impacts and flares. */
export function burst(id: string, cx: number, cy: number, r: number, hue: number, points: number, r2: Rng): Fragment {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * r2.range(0.18, 0.32) : r * r2.range(0.6, 1);
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`;
  }
  return {
    defs:
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}">` +
      `<stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${hsl(hue, 100, 75)}"/><stop offset="1" stop-color="${hsl(hue, 100, 55)}" stop-opacity="0"/></radialGradient>`,
    body: `<path d="${d}Z" fill="url(#${id})"/>`,
  };
}

/** A ship blown apart: a burst, and shards of its hull flying out. */
export function wreck(id: string, cx: number, cy: number, r: number, shipHue: number, fireHue: number, r2: Rng): Fragment[] {
  let shards = '';
  for (let i = 0; i < 9; i++) {
    const a = r2.range(0, Math.PI * 2);
    const d = r2.range(r * 0.45, r * 1.15);
    const sz = r2.range(r * 0.08, r * 0.2);
    shards += `<path d="M0 ${n(-sz)}L${n(sz * 0.9)} ${n(sz * 0.4)}L${n(-sz * 0.7)} ${n(sz * 0.6)}Z" fill="${hsl(shipHue, 62, r2.pick([30, 46, 64]))}" transform="translate(${n(cx + Math.cos(a) * d)} ${n(cy + Math.sin(a) * d)}) rotate(${n(r2.range(0, 360))})"/>`;
  }
  let sparks = '';
  for (let i = 0; i < 8; i++) {
    const a = r2.range(0, Math.PI * 2);
    const d = r2.range(r * 0.5, r * 1.3);
    sparks += `<circle cx="${n(cx + Math.cos(a) * d)}" cy="${n(cy + Math.sin(a) * d)}" r="${n(r2.range(0.12, 0.35))}" fill="${hsl(fireHue, 100, 80)}"/>`;
  }
  return [burst(id, cx, cy, r, fireHue, 9, r2), f(shards + sparks)];
}

/** A planet from the tile artwork, with a seeded number and type. */
export function world(id: string, r2: Rng, cx: number, cy: number, r: number, number?: number): Fragment {
  const num = number ?? r2.pick([7, 8, 9, 10]);
  return planet({ rng: r2.fork('planet'), id, cx, cy, r, number: num, type: r2.pick(PLANET_FAMILY[num].types) });
}

// ---------------------------------------------------------------------------
// The board: an isometric holo-table

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

/** A stroked path with an optional arrowhead marker. */
export function arrowPath(id: string, d: string, colour: string, o: { w?: number; dash?: boolean | string; head?: boolean; opacity?: number } = {}): Fragment {
  const head = o.head !== false;
  const dash = o.dash === true ? '1.2 .9' : o.dash || '';
  return {
    defs: head ? `<marker id="${id}-head" viewBox="0 0 6 6" refX="2.4" refY="3" markerWidth="3.6" markerHeight="3.6" orient="auto"><path d="M0 0L6 3L0 6z" fill="${colour}"/></marker>` : '',
    body: `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${n(o.w ?? 0.45)}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${head ? ` marker-end="url(#${id}-head)"` : ''}${o.opacity !== undefined ? ` opacity="${n(o.opacity)}"` : ''}/>`,
  };
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

// ---------------------------------------------------------------------------
// HUD readouts: flat, floating over the scene

/** A HUD panel: the dark glass every readout sits on. */
export const panel = (x: number, y: number, w: number, h: number, hue: number, a = 0.72) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(Math.min(w, h) * 0.22)}" fill="${hsl(228, 50, 7, a)}" stroke="${hsl(hue, 80, 68)}" stroke-width=".25"/>`;

export interface TrackOptions {
  /** Slot size. */
  cell?: number;
  /** Slots lit before this card acts. */
  from?: number;
  /** Slots marked as special (e.g. where the track resets). */
  hot?: number[];
  /** Draw on a HUD panel. */
  panel?: boolean;
  /** Show the slot numbers. */
  numbers?: boolean;
  /** Dim the whole track (it can't change). */
  dim?: boolean;
}

/**
 * A player's research or dominance track, 1–6. Slots up to `value` are lit; slots between `from` and
 * `value` glow white as just gained; slots above `value` but at or above `from` are shown as lost.
 */
export function track(x: number, y: number, kind: 'research' | 'dominance', value: number, o: TrackOptions = {}): string {
  const c = o.cell ?? 3.2;
  const gap = c * 0.3;
  const hue = kind === 'research' ? RESEARCH : DOMINANCE;
  const from = o.from ?? value;
  const w = c * 1.5 + 6 * (c + gap);
  let out = o.panel === false ? '' : panel(x - c * 0.45, y - c * 0.95, w + c * 0.5, c * 1.9, hue);
  out += icon(kind === 'research' ? 'research' : 'dominance', x + c * 0.5, y, c * 1.05, hsl(hue, 90, 75), 2.4);
  for (let i = 1; i <= 6; i++) {
    const sx = x + c * 1.4 + (i - 1) * (c + gap);
    const gained = i > from && i <= value;
    const lost = i <= from && i > value;
    const lit = i <= value;
    const fill = gained ? hsl(hue, 100, 88) : lit ? hsl(hue, 85, 60) : lost ? hsl(hue, 60, 40, 0.35) : 'none';
    out += `<rect x="${n(sx)}" y="${n(y - c / 2)}" width="${n(c)}" height="${n(c)}" rx="${n(c * 0.22)}" fill="${fill}" stroke="${hsl(hue, 85, gained ? 92 : 70)}" stroke-width="${gained ? 0.35 : 0.22}"${lost ? ' stroke-dasharray=".5 .4"' : ''}/>`;
    if (gained) out += `<rect x="${n(sx - 0.5)}" y="${n(y - c / 2 - 0.5)}" width="${n(c + 1)}" height="${n(c + 1)}" rx="${n(c * 0.3)}" fill="none" stroke="${hsl(hue, 100, 80)}" stroke-width=".18" opacity=".7"/>`;
    if (o.hot?.includes(i)) out += `<rect x="${n(sx - 0.55)}" y="${n(y - c / 2 - 0.55)}" width="${n(c + 1.1)}" height="${n(c + 1.1)}" rx="${n(c * 0.32)}" fill="none" stroke="#fff" stroke-width=".3" stroke-dasharray=".7 .45"/>`;
    if (o.numbers) out += `<text x="${n(sx + c / 2)}" y="${n(y + c * 0.08)}" font-family="Orbitron, 'Arial Black', sans-serif" font-weight="900" font-size="${n(c * 0.52)}" fill="${lit ? INK : hsl(hue, 70, 75)}" text-anchor="middle" dominant-baseline="central">${i}</text>`;
  }
  return o.dim ? `<g opacity=".45">${out}</g>` : out;
}

/** Where slot `i` (1–6) of a track drawn at (x, y) sits. */
export const trackSlot = (x: number, i: number, cell = 3.2) => x + cell * 1.4 + (i - 1) * (cell * 1.3) + cell / 2;

/** One action: a hexagonal chip with the action bolt. */
export function chip(cx: number, cy: number, r: number, hue: number, state: 'lit' | 'dim' | 'new' | 'broken' | 'spent' = 'lit'): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
  }
  d += 'Z';
  if (state === 'dim' || state === 'spent')
    return `<path d="${d}" fill="${hsl(228, 50, 8, 0.6)}" stroke="${hsl(hue, 60, 60)}" stroke-width=".25" stroke-dasharray="${state === 'spent' ? '.7 .5' : 'none'}" opacity=".7"/>` + icon('action', cx, cy, r * 1.1, hsl(hue, 50, 60), 2);
  if (state === 'broken') {
    const crack = `M${n(cx - r * 0.2)} ${n(cy - r)}L${n(cx + r * 0.15)} ${n(cy - r * 0.3)}L${n(cx - r * 0.25)} ${n(cy + r * 0.1)}L${n(cx + r * 0.2)} ${n(cy + r)}`;
    return (
      `<g opacity=".85"><path d="${d}" fill="${hsl(228, 50, 8, 0.7)}" stroke="${hsl(0, 85, 60)}" stroke-width=".3"/>` +
      icon('action', cx, cy, r * 1.1, hsl(0, 40, 45), 2) +
      `<path d="${crack}" fill="none" stroke="${hsl(0, 100, 70)}" stroke-width=".35" stroke-linejoin="round"/></g>`
    );
  }
  const halo = state === 'new' ? `<path d="${d}" fill="none" stroke="#fff" stroke-width=".25" opacity=".6" transform="translate(${n(cx)} ${n(cy)}) scale(1.25) translate(${n(-cx)} ${n(-cy)})"/>` : '';
  return (
    halo +
    `<path d="${d}" fill="${hsl(hue, 90, state === 'new' ? 62 : 52)}" stroke="${hsl(hue, 100, 85)}" stroke-width=".3"/>` +
    `<path d="M${n(cx - r * 0.6)} ${n(cy - r * 0.62)}L${n(cx + r * 0.2)} ${n(cy - r * 0.92)}" stroke="#fff" stroke-width=".25" opacity=".5" stroke-linecap="round"/>` +
    icon('action', cx, cy, r * 1.15, INK, 2.4)
  );
}

/** A row of action chips centred on (cx, cy). */
export function chips(cx: number, cy: number, r: number, hue: number, states: Parameters<typeof chip>[4][]): string {
  const step = r * 2.2;
  return states.map((st, i) => chip(cx + (i - (states.length - 1) / 2) * step, cy, r, hue, st)).join('');
}

/** A combat die: flat and white, to tell it from the ships. */
export function combatDie(cx: number, cy: number, s: number, value: number, hue: number, o: { rot?: number; ghost?: boolean; struck?: boolean; glow?: boolean } = {}): string {
  const h = s / 2;
  const tr = o.rot ? ` transform="rotate(${n(o.rot)} ${n(cx)} ${n(cy)})"` : '';
  if (o.ghost) return `<g${tr} opacity=".5"><rect x="${n(cx - h)}" y="${n(cy - h)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.2)}" fill="none" stroke="${hsl(hue, 70, 80)}" stroke-width=".25" stroke-dasharray=".8 .6"/>${PIPS[value].map(([x, y]) => `<circle cx="${n(cx - h + x * s)}" cy="${n(cy - h + y * s)}" r="${n(s * 0.075)}" fill="${hsl(hue, 70, 80)}"/>`).join('')}</g>`;
  const halo = o.glow ? `<rect x="${n(cx - h - 0.7)}" y="${n(cy - h - 0.7)}" width="${n(s + 1.4)}" height="${n(s + 1.4)}" rx="${n(s * 0.26)}" fill="none" stroke="${hsl(hue, 100, 70)}" stroke-width=".4"/>` : '';
  return (
    `<g${tr}>${halo}` +
    `<rect x="${n(cx - h)}" y="${n(cy - h + s * 0.08)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.2)}" fill="${hsl(228, 40, 30)}"/>` +
    `<rect x="${n(cx - h)}" y="${n(cy - h)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.2)}" fill="${hsl(220, 25, 96)}" stroke="${hsl(hue, 80, 55)}" stroke-width=".25"/>` +
    PIPS[value].map(([x, y]) => `<circle cx="${n(cx - h + x * s)}" cy="${n(cy - h + y * s)}" r="${n(s * 0.08)}" fill="${hsl(hue, 70, 30)}"/>`).join('') +
    (o.struck ? line(cx - h * 1.1, cy + h * 1.1, cx + h * 1.1, cy - h * 1.1, hsl(0, 95, 62), 0.45) : '') +
    `</g>` +
    (o.struck ? `` : '')
  );
}

/** A small card, flat: Skills, Tactics, Commands in the illustrations. `w` is its width; it's 1.4 × as tall. */
export function miniCard(id: string, cx: number, cy: number, w: number, hue: number, o: { rot?: number; icon?: string; dark?: boolean; state?: 'normal' | 'glow' | 'ghost' | 'back' } = {}): Fragment {
  const h = w * 1.4;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const tr = o.rot ? ` transform="rotate(${n(o.rot)} ${n(cx)} ${n(cy)})"` : '';
  const state = o.state ?? 'normal';
  if (state === 'ghost') return f(`<g${tr}><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.1)}" fill="${hsl(hue, 80, 60, 0.06)}" stroke="${hsl(hue, 80, 72)}" stroke-width=".25" stroke-dasharray=".9 .6"/></g>`);
  const paper = o.dark ? hsl(228, 45, 10) : hsl(225, 30, 93);
  const inner = o.dark ? hsl(hue, 70, 70) : hsl(hue, 70, 35);
  if (state === 'back') {
    return {
      defs: `<radialGradient id="${id}-b"><stop offset="0" stop-color="${hsl(hue, 80, 45)}"/><stop offset="1" stop-color="${hsl(228, 50, 10)}"/></radialGradient>`,
      body:
        `<g${tr}><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.1)}" fill="url(#${id}-b)" stroke="${hsl(hue, 80, 70)}" stroke-width=".25"/>` +
        `<rect x="${n(x + w * 0.1)}" y="${n(y + w * 0.1)}" width="${n(w * 0.8)}" height="${n(h - w * 0.2)}" rx="${n(w * 0.06)}" fill="none" stroke="${hsl(hue, 80, 75)}" stroke-width=".15" opacity=".6"/>` +
        die(cx, cy, w * 0.2, 6, hue, { pips: false }) +
        `</g>`,
    };
  }
  const halo = state === 'glow' ? `<rect x="${n(x - 0.8)}" y="${n(y - 0.8)}" width="${n(w + 1.6)}" height="${n(h + 1.6)}" rx="${n(w * 0.14)}" fill="none" stroke="${hsl(hue, 100, 80)}" stroke-width=".35"/>` : '';
  const g = glow(`${id}-g`, cx, cy, w * 1.1, h * 0.85, hue, state === 'glow' ? 0.5 : 0, 60);
  return {
    defs: g.defs + `<linearGradient id="${id}-art" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 70, 30)}"/><stop offset="1" stop-color="${hsl(hue + 40, 60, 14)}"/></linearGradient>`,
    body:
      (state === 'glow' ? g.body : '') +
      `<g${tr}>${halo}` +
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.1)}" fill="${paper}" stroke="${hsl(hue, 80, 60)}" stroke-width=".25"/>` +
      `<rect x="${n(x + w * 0.08)}" y="${n(y + w * 0.08)}" width="${n(w * 0.84)}" height="${n(h * 0.45)}" rx="${n(w * 0.06)}" fill="url(#${id}-art)"/>` +
      `<circle cx="${n(cx)}" cy="${n(y + h * 0.53)}" r="${n(w * 0.13)}" fill="${paper}" stroke="${hsl(hue, 80, 55)}" stroke-width=".18"/>` +
      icon(o.icon ?? 'action', cx, y + h * 0.53, w * 0.16, hsl(hue, 80, 50), 2.6) +
      [0.7, 0.78, 0.86].map((t, i) => line(x + w * 0.2, y + h * t, x + w * (i === 1 ? 0.7 : 0.8), y + h * t, inner, w * 0.035, ' opacity=".55"')).join('') +
      `</g>`,
  };
}

/** A circular arrow: reroll, another turn, a second use. */
export function loop(id: string, cx: number, cy: number, r: number, colour: string, w = 0.45, start = -60, sweep = 290): Fragment {
  const a0 = (start * Math.PI) / 180;
  const a1 = ((start + sweep) * Math.PI) / 180;
  const d = `M${n(cx + Math.cos(a0) * r)} ${n(cy + Math.sin(a0) * r)}A${n(r)} ${n(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${n(cx + Math.cos(a1) * r)} ${n(cy + Math.sin(a1) * r)}`;
  return arrowPath(id, d, colour, { w });
}

/** A targeting reticle. */
export const reticle = (cx: number, cy: number, r: number, colour: string) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${colour}" stroke-width=".3" stroke-dasharray="${n(r * 0.6)} ${n(r * 0.2)}"/>` +
  [0, 90, 180, 270].map((a) => {
    const t = (a * Math.PI) / 180;
    return line(cx + Math.cos(t) * r * 0.75, cy + Math.sin(t) * r * 0.75, cx + Math.cos(t) * r * 1.3, cy + Math.sin(t) * r * 1.3, colour, 0.3);
  }).join('');

/** An energy shield: a dome of light around (cx, cy). */
export function shield(id: string, cx: number, cy: number, rx: number, ry: number, hue: number): Fragment {
  return {
    defs: `<radialGradient id="${id}" cx=".5" cy=".55" r=".5"><stop offset=".6" stop-color="${hsl(hue, 90, 70)}" stop-opacity="0"/><stop offset=".93" stop-color="${hsl(hue, 90, 70)}" stop-opacity=".35"/><stop offset="1" stop-color="${hsl(hue, 100, 85)}" stop-opacity=".8"/></radialGradient>`,
    body:
      `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"/>` +
      `<path d="M${n(cx - rx * 0.55)} ${n(cy - ry * 0.7)}A${n(rx)} ${n(ry)} 0 0 1 ${n(cx + rx * 0.2)} ${n(cy - ry * 0.95)}" fill="none" stroke="#fff" stroke-width=".3" opacity=".6" stroke-linecap="round"/>`,
  };
}

/** A missile, pointing along `angle` (degrees) from its nose at (x, y). */
export const missile = (x: number, y: number, angle: number, hue: number, scale = 1) =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${n(scale)})">` +
  `<path d="M-3.4 -.6L-4.6 -1.7H-3.6L-2.2 -.6ZM-3.4 .6L-4.6 1.7H-3.6L-2.2 .6Z" fill="${hsl(hue, 80, 50)}" stroke="${hsl(220, 30, 20)}" stroke-width=".15"/>` +
  `<path d="M3.6 0C3 -.5 2.2 -.6 1.6 -.6H-3.6V.6H1.6C2.2 .6 3 .5 3.6 0Z" fill="${hsl(220, 15, 88)}" stroke="${hsl(220, 30, 20)}" stroke-width=".18"/>` +
  `<path d="M3.6 0C3 -.5 2.6 -.58 2.2 -.6V.6C2.6 .58 3 .5 3.6 0Z" fill="${hsl(hue, 100, 60)}"/>` +
  `<path d="M-3.6 -.45L-5 0L-3.6 .45Z" fill="${hsl(35, 100, 70)}"/></g>`;

/** A slash through something: disabled, forbidden. */
export const slash = (cx: number, cy: number, r: number, colour = hsl(0, 95, 62)) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${colour}" stroke-width=".45"/>` + line(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.7, colour, 0.45);

/** Little four-point sparkles around a point. */
export function sparkles(r2: Rng, cx: number, cy: number, d0: number, d1: number, count: number, colour = '#fff'): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = r2.range(0, Math.PI * 2);
    const d = r2.range(d0, d1);
    s += `<path d="M0 -1L.25 -.25L1 0L.25 .25L0 1L-.25 .25L-1 0L-.25 -.25Z" fill="${colour}" transform="translate(${n(cx + Math.cos(a) * d)} ${n(cy + Math.sin(a) * d)}) scale(${n(r2.range(0.5, 1.2))})"/>`;
  }
  return s;
}

/** Fast-motion lines behind a ship moving along (dx, dy). */
export function trails(id: string, r2: Rng, x: number, y: number, dx: number, dy: number, len: number, spread: number, colour: string, count = 6): Fragment[] {
  const m = Math.hypot(dx, dy);
  const ux = dx / m;
  const uy = dy / m;
  const out: Fragment[] = [];
  for (let i = 0; i < count; i++) {
    const o = r2.range(-spread, spread);
    const sx = x - uy * o;
    const sy = y + ux * o;
    const l = len * r2.range(0.6, 1);
    out.push(streak(`${id}-${i}`, sx - ux * l, sy - uy * l, sx - ux * r2.range(2, 4), sy - uy * r2.range(2, 4), colour, r2.range(0.25, 0.8), r2.range(0.5, 1)));
  }
  return out;
}
