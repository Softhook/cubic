import { hash, rng, type Rng } from './rng';
import { planet } from './planet';
import { starfield, type Box } from './starfield';
import { PLANET_FAMILY } from './tokens';
import { document, hsl, join, n, type Fragment } from './svg';

/**
 * Advance cards, poker size (63.5 × 88.9 mm), for print and the Art Lab. See docs/GRAPHICS.md §2, Cards.
 *
 * Permanent cards (CE Skills, original Commands) have a light frame around the art; one-shot cards
 * (Tactics, Gambits, Expansion) are dark and full-bleed, so the two read apart across the table, as the
 * light and dark decks of the physical game do. The illustration shows what the card is about (a
 * motif per category, with per-card variation from the card's id); the accent colour is the category's.
 */

export const CARD = {
  w: 63.5,
  h: 88.9,
  bleed: 3,
  /** Die-cut corner radius. */
  corner: 3,
  /** Keep text this far inside the trim. */
  safe: 3.5,
  /** Where the illustration ends and the text panel starts. */
  artBottom: 43,
  /** Light frame width on permanent cards. */
  frame: 2.8,
} as const;

export type CardDeck = 'skill' | 'tactic' | 'expansion' | 'command' | 'gambit';

export type Motif = 'thrust' | 'duel' | 'conquest' | 'research' | 'reconfigure' | 'surge' | 'cards' | 'missile' | 'portal' | 'fleet' | 'transfer';

/** Everything printed on a card face. */
export interface CardFace {
  id: string;
  name: string;
  subtitle: string;
  text: string;
  deck: CardDeck;
  /** Movement, action, combat, …: sets the accent colour, icon and default motif. */
  category?: string;
  /** How many copies the deck has. */
  copies?: number;
  /** Position in its deck, for the "07/35" footer. */
  index?: number;
  deckSize?: number;
}

/** Measures text width in mm, for wrapping. The browser passes a canvas-based one; tests use the estimate. */
export type Measure = (text: string, sizeMm: number, font: 'title' | 'body' | 'bold') => number;

export interface CardOptions {
  bleed?: boolean;
  /** Round the corners (on screen). */
  rounded?: boolean;
  measure?: Measure;
  /** `@font-face` rules to embed, so exported images use the same fonts as the measurements. */
  fontCss?: string;
  idPrefix?: string;
}

export const CARD_FONTS = {
  title: "Orbitron, 'Arial Black', sans-serif",
  body: "Inter, 'Helvetica Neue', Arial, sans-serif",
} as const;

/** Title letter spacing, in em. */
const TITLE_TRACKING = 0.04;

/** Rough widths for Orbitron and Inter, when no real measurement is available. */
export const estimateWidth: Measure = (text, size, font) => size * text.length * (font === 'title' ? 0.8 : font === 'bold' ? 0.56 : 0.52);

/** Accent hue and label per category. Hues are far apart so cards sort by colour at a glance. */
export const CARD_CATEGORIES: Record<string, { hue: number; label: string }> = {
  movement: { hue: 192, label: 'Movement' },
  action: { hue: 42, label: 'Action' },
  combat: { hue: 352, label: 'Combat' },
  conquer: { hue: 138, label: 'Conquer' },
  research: { hue: 268, label: 'Research' },
  ship: { hue: 218, label: 'Ship' },
  card: { hue: 24, label: 'Cards' },
  expansion: { hue: 172, label: 'Expansion' },
};

const DEFAULT_MOTIF: Record<string, Motif> = {
  movement: 'thrust',
  action: 'surge',
  combat: 'duel',
  conquer: 'conquest',
  research: 'research',
  ship: 'reconfigure',
  card: 'cards',
  expansion: 'fleet',
};

/**
 * Tactics and Gambits have no category in the data: these give them one (for colour and icon), and
 * pick a more telling motif for some cards of every kind. Keyed by id without the original's `o-`.
 */
const THEMES: Record<string, { category?: string; motif?: Motif }> = {
  aggression: { category: 'combat', motif: 'duel' },
  'black-market': { category: 'combat', motif: 'missile' },
  'change-of-heart': { category: 'card', motif: 'cards' },
  momentum: { category: 'action', motif: 'thrust' },
  'plan-ahead': { category: 'combat', motif: 'missile' },
  sabotage: { category: 'action', motif: 'surge' },
  'show-of-force': { category: 'combat', motif: 'duel' },
  'unveil-the-fleet': { category: 'ship', motif: 'fleet' },
  'warp-gate': { category: 'movement', motif: 'portal' },
  expansion: { category: 'expansion', motif: 'fleet' },
  reorganization: { category: 'ship', motif: 'reconfigure' },
  relocation: { category: 'conquer', motif: 'transfer' },
  profiteering: { motif: 'missile' },
  nomadic: { motif: 'portal' },
  talented: { motif: 'cards' },
};

const themeOf = (f: CardFace) => THEMES[f.id.replace(/^o-/, '')] ?? {};

/** The category a card is shown under (its accent colour and icon). */
export function cardCategory(f: CardFace): string {
  return f.category ?? themeOf(f).category ?? (f.deck === 'expansion' ? 'expansion' : 'action');
}

export function cardMotif(f: CardFace): Motif {
  return themeOf(f).motif ?? DEFAULT_MOTIF[cardCategory(f)] ?? 'surge';
}

const DECK_INFO: Record<CardDeck, { label: string; kind: string; light: boolean; edition: string }> = {
  skill: { label: 'Skill', kind: 'Permanent', light: true, edition: 'CE' },
  tactic: { label: 'Tactic', kind: 'One-shot', light: false, edition: 'CE' },
  expansion: { label: 'Expansion', kind: 'One-shot', light: false, edition: 'CE' },
  command: { label: 'Command', kind: 'Permanent', light: true, edition: '2013' },
  gambit: { label: 'Gambit', kind: 'One-shot', light: false, edition: '2013' },
};

export const deckInfo = (d: CardDeck) => DECK_INFO[d];

/** Category icons, drawn on a 24-unit grid with a 2-unit stroke (the same set the game UI uses). */
const ICONS: Record<string, string> = {
  movement: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  action: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  combat: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  conquer: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  research: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  ship: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
  card: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2"/>',
  expansion: '<path d="M12 5v14M5 12h14"/>',
};

const icon = (category: string, cx: number, cy: number, size: number, colour: string) =>
  `<g transform="translate(${n(cx - size / 2)} ${n(cy - size / 2)}) scale(${n(size / 24)})" fill="none" stroke="${colour}" color="${colour}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[category] ?? ICONS.action}</g>`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// Ships: isometric dice

/** Player colours (hues) for ships in the illustrations, as in the game. */
const SHIP_HUES = [196, 328, 42, 140];

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

/**
 * A die-ship as an isometric cube centred on (cx, cy), `s` mm along an edge. Each face is a unit
 * square mapped onto the cube by a transform, so its rounded corners and pips foreshorten correctly.
 */
function die(cx: number, cy: number, s: number, value: number, hue: number, o: { opacity?: number; rotate?: number; pips?: boolean } = {}): string {
  const k = 0.866 * s;
  const h = s / 2;
  const [left, right] = sideFaces(value);
  const face = (m: number[], light: number, v: number) =>
    `<g transform="matrix(${m.map(n).join(' ')})">` +
    `<rect x=".05" y=".05" width=".9" height=".9" rx=".16" fill="${hsl(hue, 62, light)}"/>` +
    (o.pips === false ? [] : PIPS[v]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".085" fill="${hsl(hue, 70, light < 40 ? 88 : 12)}" opacity=".9"/>`).join('') +
    `</g>`;
  const base = `M${n(cx)} ${n(cy - s)}L${n(cx + k)} ${n(cy - h)}L${n(cx + k)} ${n(cy + h)}L${n(cx)} ${n(cy + s)}L${n(cx - k)} ${n(cy + h)}L${n(cx - k)} ${n(cy - h)}Z`;
  const attrs = (o.opacity !== undefined ? ` opacity="${n(o.opacity)}"` : '') + (o.rotate ? ` transform="rotate(${n(o.rotate)} ${n(cx)} ${n(cy)})"` : '');
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
const glow = (id: string, cx: number, cy: number, rx: number, ry: number, hue: number, a = 0.6, light = 62): Fragment => ({
  defs: `<radialGradient id="${id}"><stop offset="0" stop-color="${hsl(hue, 90, light)}" stop-opacity="${n(a)}"/><stop offset="1" stop-color="${hsl(hue, 90, light)}" stop-opacity="0"/></radialGradient>`,
  body: `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"/>`,
});

/** A ship with its engine glow. */
const ship = (id: string, cx: number, cy: number, s: number, value: number, hue: number, o: { opacity?: number; rotate?: number } = {}): Fragment => {
  const g = glow(id, cx, cy + s * 0.9, s * 1.5, s * 0.55, hue, 0.55 * (o.opacity ?? 1));
  return { defs: g.defs, body: g.body + die(cx, cy, s, value, hue, o) };
};

const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(w)}" stroke-linecap="round"${extra}/>`;

/** A line fading from `colour` at its end to nothing at its start: trails and beams. */
function streak(id: string, x1: number, y1: number, x2: number, y2: number, colour: string, w: number, a = 1): Fragment {
  return {
    defs: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"><stop offset="0" stop-color="${colour}" stop-opacity="0"/><stop offset="1" stop-color="${colour}" stop-opacity="${n(a)}"/></linearGradient>`,
    body: line(x1, y1, x2, y2, `url(#${id})`, w),
  };
}

/** A many-pointed burst: impacts and flares. */
function burst(id: string, cx: number, cy: number, r: number, hue: number, points: number, r2: Rng): Fragment {
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

/** A planet from the tile artwork, with a seeded number and type. */
function world(id: string, r2: Rng, cx: number, cy: number, r: number, number?: number): Fragment {
  const num = number ?? r2.pick([7, 8, 9, 10]);
  return planet({ rng: r2.fork('planet'), id, cx, cy, r, number: num, type: r2.pick(PLANET_FAMILY[num].types) });
}

// ---------------------------------------------------------------------------
// Motifs: one illustration per kind of card. All work in the art box (trim coordinates).

interface Scene {
  id: string;
  r: Rng;
  hue: number;
  /** Art box: the visible window. */
  box: Box;
  /** Two player hues for ships, different for every card. */
  p1: number;
  p2: number;
}

const value = (r: Rng) => r.int(1, 6);

const MOTIFS: Record<Motif, (s: Scene) => Fragment[]> = {
  thrust: ({ id, r, hue, box, p1 }) => {
    const cx = box.x + box.w * 0.62;
    const cy = box.y + box.h * 0.5;
    const out: Fragment[] = [];
    // Board grid in perspective, under the ship.
    let grid = '';
    const vy = box.y - 10;
    for (let i = -6; i <= 6; i++) grid += line(cx + i * 3, vy, cx + i * 22, box.y + box.h + 6, hsl(hue, 80, 70), 0.15, ' opacity=".45"');
    for (let j = 0; j < 5; j++) {
      const y = cy + 6 + j * j * 2.2;
      grid += line(box.x, y, box.x + box.w, y, hsl(hue, 80, 70), 0.15, ` opacity="${n(0.15 + j * 0.08)}"`);
    }
    out.push({ defs: '', body: grid });
    if (r.chance(0.7)) out.push(world(`${id}-w`, r.fork('w'), box.x + r.range(8, 16), box.y + r.range(8, 13), r.range(4.5, 7)));
    for (let i = 0; i < 7; i++) {
      const y = cy + r.range(-5.5, 5.5);
      out.push(streak(`${id}-t${i}`, box.x - 2, y, cx - r.range(4, 9), y, hsl(hue, 90, 72), r.range(0.25, 0.9), r.range(0.5, 1)));
    }
    out.push(ship(`${id}-s`, cx, cy, 7, value(r), p1));
    return out;
  },

  duel: ({ id, r, hue, box, p1, p2 }) => {
    const ax = box.x + box.w * 0.24;
    const ay = box.y + box.h * 0.66;
    const bx = box.x + box.w * 0.74;
    const by = box.y + box.h * 0.38;
    const out: Fragment[] = [];
    if (r.chance(0.6)) out.push(world(`${id}-w`, r.fork('w'), box.x + box.w - r.range(7, 11), box.y + box.h - r.range(6, 9), r.range(4, 6)));
    out.push(ship(`${id}-a`, ax, ay, 6, value(r), p1));
    const hx = bx - 4.5;
    const hy = by + 2.2;
    out.push(streak(`${id}-beam`, ax + 3, ay - 3, hx, hy, hsl(hue, 100, 70), 1.6));
    out.push({ defs: '', body: line(ax + 3, ay - 3, hx, hy, '#fff', 0.35, ' opacity=".85"') });
    out.push(ship(`${id}-b`, bx, by, 6, value(r), p2));
    out.push(burst(`${id}-x`, hx, hy, 8, hue, 9, r));
    let debris = '';
    for (let i = 0; i < 9; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(4, 11);
      debris += `<circle cx="${n(hx + Math.cos(a) * d)}" cy="${n(hy + Math.sin(a) * d)}" r="${n(r.range(0.15, 0.45))}" fill="${hsl(hue, 100, 80)}"/>`;
    }
    out.push({ defs: '', body: debris });
    return out;
  },

  conquest: ({ id, r, box, p1, hue }) => {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h * 0.5;
    const num = r.pick([7, 8, 9, 10]);
    const pr = 8 + (num - 7) * 1.2;
    const out: Fragment[] = [];
    const d = pr + 7.5;
    out.push({ defs: '', body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(d)}" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2" opacity=".6"/>` });
    out.push(world(`${id}-w`, r.fork('w'), cx, cy, pr, num));
    // Ships in orbit whose numbers add up to the planet's: the Conquer action itself.
    const a = r.int(1, 6);
    const b = Math.min(6, Math.max(1, num - a - r.int(1, 4)));
    const c = num - a - b;
    const values = c >= 1 && c <= 6 ? [a, b, c] : [a, num - a].filter((v) => v >= 1 && v <= 6);
    // Not below the planet: the emblem covers that orbit.
    const spots = [[-d, 0], [0, -d], [d, 0]];
    const start = values.length === 3 ? 0 : r.int(0, 2);
    values.forEach((v, i) => {
      const [dx, dy] = spots[(start + i) % 3];
      out.push(ship(`${id}-s${i}`, cx + dx, cy + dy * 0.82, 4, v, p1));
    });
    out.push({ defs: '', body: die(cx + pr * 0.45, cy - pr * 0.55, 1.8, 1, p1, { pips: false }) });
    return out;
  },

  research: ({ id, r, hue, box }) => {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h * 0.5;
    const out: Fragment[] = [world(`${id}-w`, r.fork('w'), cx, cy, 7.5)];
    const tilts = [r.range(-30, -10), r.range(15, 35), r.range(70, 110)];
    let rings = '';
    tilts.forEach((t, i) => {
      const rx = 17 + i * 2.5;
      const ry = 5 + i;
      rings += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="none" stroke="${hsl(hue, 85, 72)}" stroke-width=".3" opacity=".7" transform="rotate(${n(t)} ${n(cx)} ${n(cy)})"/>`;
      const a = r.range(0, Math.PI * 2);
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      const rad = (t * Math.PI) / 180;
      rings += `<circle cx="${n(cx + x * Math.cos(rad) - y * Math.sin(rad))}" cy="${n(cy + x * Math.sin(rad) + y * Math.cos(rad))}" r="1" fill="#fff"/>`;
    });
    out.push({ defs: '', body: rings });
    // The research track: six steps, some lit.
    const lit = r.int(2, 5);
    let track = '';
    for (let i = 0; i < 6; i++) {
      const x = cx + (i - 2.5) * 5;
      const y = box.y + box.h - 5;
      track += `<rect x="${n(x - 1.6)}" y="${n(y - 1.6)}" width="3.2" height="3.2" rx=".7" fill="${i < lit ? hsl(hue, 90, 70) : 'none'}" stroke="${hsl(hue, 90, 70)}" stroke-width=".3" opacity="${i < lit ? 1 : 0.6}"/>`;
    }
    out.push({ defs: '', body: track });
    return out;
  },

  reconfigure: ({ id, r, hue, box, p1 }) => {
    const cy = box.y + box.h * 0.55;
    const xs = [0.2, 0.47, 0.76].map((f) => box.x + box.w * f);
    const out: Fragment[] = [];
    out.push({
      defs: `<marker id="${id}-arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L6 3L0 6z" fill="${hsl(hue, 80, 75)}"/></marker>`,
      body: `<path d="M${n(xs[0])} ${n(cy - 10)}Q${n(xs[1])} ${n(cy - 24)} ${n(xs[2] - 2)} ${n(cy - 12)}" fill="none" stroke="${hsl(hue, 80, 75)}" stroke-width=".4" stroke-dasharray="1.2 1" marker-end="url(#${id}-arrow)" opacity=".8"/>`,
    });
    const values = [value(r), value(r), value(r)];
    if (values[2] === values[1]) values[2] = (values[2] % 6) + 1;
    out.push(ship(`${id}-a`, xs[0], cy, 4.2, values[0], p1, { opacity: 0.3, rotate: r.range(-35, -15) }));
    out.push(ship(`${id}-b`, xs[1], cy - 3, 5, values[1], p1, { opacity: 0.55, rotate: r.range(10, 30) }));
    out.push(ship(`${id}-c`, xs[2], cy, 6.5, values[2], p1));
    let sparks = '';
    for (let i = 0; i < 6; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(8, 12);
      sparks += `<path d="M0 -1L.25 -.25L1 0L.25 .25L0 1L-.25 .25L-1 0L-.25 -.25Z" fill="#fff" transform="translate(${n(xs[2] + Math.cos(a) * d)} ${n(cy + Math.sin(a) * d)}) scale(${n(r.range(0.6, 1.3))})"/>`;
    }
    out.push({ defs: '', body: sparks });
    return out;
  },

  surge: ({ id, r, hue, box, p1 }) => {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h * 0.5;
    const out: Fragment[] = [];
    let rings = '';
    for (let i = 1; i <= 3; i++) rings += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(6 + i * 4.5)}" fill="none" stroke="${hsl(hue, 95, 65)}" stroke-width="${n(0.6 - i * 0.12)}" opacity="${n(0.9 - i * 0.22)}"/>`;
    out.push({ defs: '', body: rings });
    out.push(glow(`${id}-core`, cx, cy, 15, 15, hue, 0.45, 60));
    let bolts = '';
    const count = r.int(3, 5);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r.range(-0.3, 0.3);
      let d = `M${n(cx + Math.cos(a) * 9)} ${n(cy + Math.sin(a) * 9)}`;
      for (let step = 1; step <= 4; step++) {
        const rr = 9 + step * 4;
        const aa = a + r.range(-0.18, 0.18);
        d += `L${n(cx + Math.cos(aa) * rr)} ${n(cy + Math.sin(aa) * rr)}`;
      }
      bolts += `<path d="${d}" fill="none" stroke="${hsl(hue, 100, 80)}" stroke-width=".55" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    out.push({ defs: '', body: bolts });
    out.push(ship(`${id}-s`, cx, cy, 6.5, value(r), p1));
    return out;
  },

  cards: ({ id, r, hue, box }) => {
    const cx = box.x + box.w / 2;
    const by = box.y + box.h * 0.92;
    const out: Fragment[] = [];
    if (r.chance(0.6)) out.push(world(`${id}-w`, r.fork('w'), box.x + r.range(9, 14), box.y + r.range(9, 12), r.range(4, 6)));
    const count = r.int(3, 5);
    const spread = 14;
    let fan = `<linearGradient id="${id}-holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 80, 70)}" stop-opacity=".55"/><stop offset="1" stop-color="${hsl(hue + 40, 80, 40)}" stop-opacity=".25"/></linearGradient>`;
    let body = '';
    for (let i = 0; i < count; i++) {
      const a = (i - (count - 1) / 2) * spread;
      const top = i === Math.floor(count / 2);
      body +=
        `<g transform="rotate(${n(a)} ${n(cx)} ${n(by)})">` +
        `<rect x="${n(cx - 7.5)}" y="${n(by - 30)}" width="15" height="21" rx="1.6" fill="url(#${id}-holo)" stroke="${hsl(hue, 90, top ? 85 : 70)}" stroke-width="${top ? 0.5 : 0.3}"/>` +
        `<rect x="${n(cx - 5.5)}" y="${n(by - 28)}" width="11" height="8" rx=".8" fill="${hsl(hue, 80, 80)}" opacity="${top ? 0.5 : 0.2}"/>` +
        `<path d="M${n(cx - 5)} ${n(by - 17)}h10M${n(cx - 5)} ${n(by - 15)}h8M${n(cx - 5)} ${n(by - 13)}h9" stroke="${hsl(hue, 80, 85)}" stroke-width=".35" opacity=".7"/>` +
        `</g>`;
    }
    out.push(glow(`${id}-g`, cx, by - 20, 18, 14, hue, 0.4));
    out.push({ defs: fan, body });
    return out;
  },

  missile: ({ id, r, hue, box, p2 }) => {
    const sx = box.x + 2;
    const sy = box.y + box.h - 4;
    const tx = box.x + box.w * 0.72;
    const ty = box.y + box.h * 0.36;
    const qx = box.x + box.w * 0.3;
    const qy = box.y + box.h * 0.15;
    const out: Fragment[] = [];
    out.push(ship(`${id}-t`, tx + 6, ty + 2, 5.5, value(r), p2));
    // Crosshair on the target.
    out.push({
      defs: '',
      body:
        `<circle cx="${n(tx + 6)}" cy="${n(ty + 2)}" r="9" fill="none" stroke="${hsl(hue, 100, 70)}" stroke-width=".35" stroke-dasharray="3 1.5"/>` +
        line(tx + 6, ty - 9, tx + 6, ty - 5, hsl(hue, 100, 70), 0.35) +
        line(tx + 6, ty + 9, tx + 6, ty + 13, hsl(hue, 100, 70), 0.35),
    });
    // Trail along a curve: short segments, fading towards the launch point.
    const pt = (t: number) => [(1 - t) ** 2 * sx + 2 * (1 - t) * t * qx + t * t * tx, (1 - t) ** 2 * sy + 2 * (1 - t) * t * qy + t * t * ty];
    let trail = '';
    const end = 0.82;
    for (let i = 0; i < 24; i++) {
      const [x1, y1] = pt((i / 24) * end);
      const [x2, y2] = pt(((i + 1) / 24) * end);
      trail += line(x1, y1, x2, y2, hsl(28, 100, 70), 0.2 + (i / 24) * 1.4, ` opacity="${n((i / 24) ** 1.5)}"`);
    }
    let puffs = '';
    for (let i = 0; i < 10; i++) {
      const [x, y] = pt(r.range(0.05, 0.7));
      puffs += `<circle cx="${n(x + r.range(-1.5, 1.5))}" cy="${n(y + r.range(-1.5, 1.5))}" r="${n(r.range(0.6, 1.8))}" fill="${hsl(220, 20, 80)}" opacity="${n(r.range(0.08, 0.2))}"/>`;
    }
    const [mx, my] = pt(end);
    const [px, py] = pt(end - 0.02);
    const ang = (Math.atan2(my - py, mx - px) * 180) / Math.PI;
    const missile =
      `<g transform="translate(${n(mx)} ${n(my)}) rotate(${n(ang)})">` +
      `<path d="M3 0L1.2 -.9H-2.6L-3.6 -2V2L-2.6 .9H1.2Z" fill="${hsl(220, 15, 88)}" stroke="${hsl(220, 30, 20)}" stroke-width=".2"/>` +
      `<path d="M3 0L1.6 -.75V.75Z" fill="${hsl(hue, 100, 60)}"/></g>`;
    out.push({ defs: '', body: puffs + trail + missile });
    out.push(burst(`${id}-fl`, mx - Math.cos((ang * Math.PI) / 180) * 3.8, my - Math.sin((ang * Math.PI) / 180) * 3.8, 3, 30, 6, r));
    return out;
  },

  portal: ({ id, r, hue, box, p1 }) => {
    const y = box.y + box.h * 0.52;
    const ax = box.x + box.w * 0.2;
    const bx = box.x + box.w * 0.8;
    const out: Fragment[] = [];
    const gate = (x: number, s: number, k: string) => {
      let rings = '';
      for (let i = 0; i < 5; i++) {
        rings += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n((4.5 - i * 0.7) * s)}" ry="${n((10 - i * 1.6) * s)}" fill="none" stroke="${hsl(hue + i * 12, 95, 60 + i * 6)}" stroke-width="${n(0.5 - i * 0.06)}" stroke-dasharray="${n(3 + i)} ${n(1 + i * 0.5)}" transform="rotate(${n(r.range(-8, 8))} ${n(x)} ${n(y)})"/>`;
      }
      out.push(glow(`${id}-${k}`, x, y, 7 * s, 12 * s, hue, 0.55, 60));
      out.push({ defs: '', body: rings });
    };
    gate(ax, 0.85, 'ga');
    gate(bx, 1, 'gb');
    out.push({ defs: '', body: `<path d="M${n(ax)} ${n(y)}Q${n((ax + bx) / 2)} ${n(y - 16)} ${n(bx)} ${n(y)}" fill="none" stroke="${hsl(hue, 90, 80)}" stroke-width=".35" stroke-dasharray=".6 1.2"/>` });
    out.push(ship(`${id}-s`, bx - 1, y, 4.5, value(r), p1));
    return out;
  },

  fleet: ({ id, r, hue, box, p1 }) => {
    const out: Fragment[] = [];
    const count = r.int(3, 5);
    const lead = { x: box.x + box.w * 0.66, y: box.y + box.h * 0.42 };
    const places = [lead, { x: lead.x - 12, y: lead.y + 7 }, { x: lead.x - 4, y: lead.y + 14 }, { x: lead.x - 22, y: lead.y + 2 }, { x: lead.x - 14, y: lead.y + 18 }];
    places.slice(0, count).forEach((p, i) => {
      out.push(streak(`${id}-t${i}`, p.x - 26, p.y - 8, p.x - 4, p.y - 1, hsl(hue, 90, 75), 0.7));
    });
    places
      .slice(0, count)
      .reverse()
      .forEach((p, i) => out.push(ship(`${id}-s${i}`, p.x, p.y, i === count - 1 ? 5.5 : 4.2, value(r), p1)));
    // The newcomer: a flare where a new ship warps in.
    const nx = lead.x + 12;
    const ny = lead.y + 12;
    out.push(burst(`${id}-new`, nx, ny, 6, hue, 4, r));
    out.push({ defs: '', body: icon('expansion', nx, ny, 3.4, '#fff') });
    return out;
  },

  transfer: ({ id, r, hue, box, p1 }) => {
    const y = box.y + box.h * 0.52;
    const ax = box.x + box.w * 0.24;
    const bx = box.x + box.w * 0.76;
    const out: Fragment[] = [world(`${id}-a`, r.fork('a'), ax, y + 4, 7), world(`${id}-b`, r.fork('b'), bx, y - 2, 9)];
    out.push({
      defs: `<marker id="${id}-arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L6 3L0 6z" fill="${hsl(hue, 80, 75)}"/></marker>`,
      body: `<path d="M${n(ax + 2)} ${n(y - 5)}Q${n((ax + bx) / 2)} ${n(y - 22)} ${n(bx - 3)} ${n(y - 12)}" fill="none" stroke="${hsl(hue, 80, 75)}" stroke-width=".45" stroke-dasharray="1.4 1" marker-end="url(#${id}-arrow)"/>`,
    });
    out.push({ defs: '', body: die((ax + bx) / 2, y - 14, 2.4, 1, p1, { pips: false }) });
    return out;
  },
};

// ---------------------------------------------------------------------------
// Text

const BOLD_TERMS = new Set(['Research', 'Dominance', 'Missile', 'Missiles', 'Combat', 'Conquer', 'Conquering', 'Construct', 'Attack', 'Deploy', 'Reconfigure', 'Skill', 'Skills', 'Tactic', 'Tactics', 'Move', 'Command']);

interface Word {
  text: string;
  bold: boolean;
}

/** Breaks text into lines no wider than `width`, keeping game terms bold. */
function wrap(text: string, size: number, width: number, measure: Measure): Word[][] {
  const words = text.split(/\s+/).map((w) => ({ text: w, bold: BOLD_TERMS.has(w.replace(/[^A-Za-z]/g, '')) }));
  const space = measure(' ', size, 'body');
  const lines: Word[][] = [[]];
  let used = 0;
  for (const w of words) {
    const wd = measure(w.text, size, w.bold ? 'bold' : 'body');
    const cur = lines[lines.length - 1];
    if (cur.length && used + space + wd > width) {
      lines.push([w]);
      used = wd;
    } else {
      used += (cur.length ? space : 0) + wd;
      cur.push(w);
    }
  }
  return lines;
}

const tspans = (line: Word[], boldColour: string) =>
  line.map((w, i) => `<tspan${w.bold ? ` font-weight="700" fill="${boldColour}"` : ''}>${esc(w.text)}${i < line.length - 1 ? ' ' : ''}</tspan>`).join('');

// ---------------------------------------------------------------------------
// Faces

interface Palette {
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
}

function palette(light: boolean, hue: number): Palette {
  return light
    ? { paper: hsl(225, 30, 95), ink: hsl(228, 40, 12), muted: hsl(228, 15, 42), accent: hsl(hue, 80, 52), accentInk: hsl(hue, 85, 30) }
    : { paper: hsl(228, 45, 8), ink: hsl(225, 60, 94), muted: hsl(226, 22, 64), accent: hsl(hue, 90, 62), accentInk: hsl(hue, 100, 80) };
}

const roundedClip = (id: string, area: Box, r: number) => `<clipPath id="${id}"><rect x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" rx="${n(r)}"/></clipPath>`;

/** The front of a card as a standalone SVG document. */
export function cardSvg(face: CardFace, o: CardOptions = {}): string {
  const id = o.idPrefix ?? `card-${face.id}`;
  const measure = o.measure ?? estimateWidth;
  const { w: W, h: H, artBottom: AB, frame: F } = CARD;
  const b = o.bleed ? CARD.bleed : 0;
  const area: Box = { x: -b, y: -b, w: W + 2 * b, h: H + 2 * b };
  const info = DECK_INFO[face.deck];
  const category = cardCategory(face);
  const cat = CARD_CATEGORIES[category] ?? CARD_CATEGORIES.action;
  const p = palette(info.light, cat.hue);
  const r = rng(hash(`card:${face.id}`));

  // The illustration: full-bleed on dark cards, a window inside the frame on light ones.
  const win: Box = info.light ? { x: F, y: F, w: W - 2 * F, h: AB - F } : { x: -CARD.bleed, y: -CARD.bleed, w: W + 2 * CARD.bleed, h: AB + CARD.bleed };
  const view: Box = info.light ? win : { x: 0, y: 0, w: W, h: AB };
  const players = SHIP_HUES.slice();
  const p1 = players.splice(r.int(0, players.length - 1), 1)[0];
  const p2 = players[r.int(0, players.length - 1)];
  const sky = starfield({
    rng: r.fork('sky'),
    id: `${id}-sky`,
    area: win,
    frame: view,
    hues: [cat.hue + r.range(-15, 15), cat.hue + r.range(30, 60)],
    nebula: r.range(0.45, 0.6),
  });
  const scene = join(...MOTIFS[cardMotif(face)]({ id: `${id}-m`, r: r.fork('motif'), hue: cat.hue, box: view, p1, p2 }));
  // Darken the art towards the panel so the emblem and title sit on calm ground.
  const shade =
    `<linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="${p.paper}" stop-opacity="0"/><stop offset="1" stop-color="${info.light ? hsl(228, 45, 8) : p.paper}" stop-opacity=".85"/></linearGradient>`;
  const artClip = info.light ? roundedClip(`${id}-win`, win, 2.2) : `<clipPath id="${id}-win"><rect x="${n(win.x)}" y="${n(win.y)}" width="${n(win.w)}" height="${n(win.h)}"/></clipPath>`;
  const art: Fragment = {
    defs: sky.defs + scene.defs + shade + artClip,
    body:
      `<g clip-path="url(#${id}-win)">${sky.body}${scene.body}` +
      `<rect x="${n(win.x)}" y="${n(win.y)}" width="${n(win.w)}" height="${n(win.h)}" fill="url(#${id}-shade)"/></g>` +
      (info.light ? `<rect x="${n(win.x)}" y="${n(win.y)}" width="${n(win.w)}" height="${n(win.h)}" rx="2.2" fill="none" stroke="${p.accent}" stroke-width=".35"/>` : ''),
  };

  // HUD labels over the art.
  const hudY = info.light ? F + 4.6 : 5.6;
  const hudX = info.light ? F + 2.6 : CARD.safe + 0.6;
  const label = (x: number, text: string, anchor: string) =>
    `<text x="${n(x)}" y="${n(hudY)}" font-family="${CARD_FONTS.body}" font-size="1.9" font-weight="700" letter-spacing=".22" fill="#fff" text-anchor="${anchor}" opacity=".92">${esc(text.toUpperCase())}</text>`;
  const hud =
    label(hudX, cat.label, 'start') +
    (face.copies && face.copies > 1 ? label(W - hudX, `×${face.copies}`, 'end') : '') +
    // Corner ticks: a targeting display.
    [
      [hudX - 1.2, hudY - 3.4, 1, 1],
      [W - hudX + 1.2, hudY - 3.4, -1, 1],
    ]
      .map(([x, y, sx]) => `<path d="M${n(x)} ${n(y + 2.4)}V${n(y)}H${n(x + sx * 2.4)}" fill="none" stroke="#fff" stroke-width=".25" opacity=".55"/>`)
      .join('');

  // Text panel.
  const panelTop = AB;
  let panel = info.light
    ? ''
    : `<rect x="${n(area.x)}" y="${n(panelTop)}" width="${n(area.w)}" height="${n(H + b - panelTop)}" fill="${p.paper}"/>` +
      `<rect x="${n(area.x)}" y="${n(panelTop - 0.2)}" width="${n(area.w)}" height=".4" fill="${p.accent}"/>`;
  // Emblem straddling art and panel.
  const ey = panelTop;
  panel +=
    `<circle cx="${n(W / 2)}" cy="${n(ey)}" r="5.4" fill="${p.paper}"/>` +
    `<circle cx="${n(W / 2)}" cy="${n(ey)}" r="4.5" fill="none" stroke="${p.accent}" stroke-width=".5"/>` +
    icon(category, W / 2, ey, 4.6, p.accent);

  const textW = W - 2 * CARD.safe - 2;
  const nameText = face.name.toUpperCase();
  const tracking = (s: string, size: number) => s.length * size * TITLE_TRACKING;
  const nameSize = Math.min(4.2, (textW / (measure(nameText, 1, 'title') + tracking(nameText, 1))) * 1);
  const nameY = ey + 10.2;
  panel += `<text x="${n(W / 2)}" y="${n(nameY)}" font-family="${CARD_FONTS.title}" font-weight="900" font-size="${n(nameSize)}" letter-spacing="${n(nameSize * TITLE_TRACKING)}" fill="${p.ink}" text-anchor="middle">${esc(nameText)}</text>`;
  const subY = nameY + 4;
  panel += `<text x="${n(W / 2)}" y="${n(subY)}" font-family="${CARD_FONTS.body}" font-style="italic" font-size="2.3" fill="${p.accentInk}" text-anchor="middle">${esc(face.subtitle)}</text>`;
  panel += `<path d="M${n(W / 2 - 9)} ${n(subY + 2)}H${n(W / 2 + 9)}" stroke="${p.accent}" stroke-width=".25" opacity=".8"/><circle cx="${n(W / 2)}" cy="${n(subY + 2)}" r=".55" fill="${p.accent}"/>`;

  // Rules text: the largest size that fits between the divider and the footer.
  const bodyTop = subY + 4.2;
  const bodyBottom = H - CARD.safe - 4.2;
  let size = 3.3;
  let lines = wrap(face.text, size, textW, measure);
  while (size > 2.1 && lines.length * size * 1.34 > bodyBottom - bodyTop) {
    size -= 0.1;
    lines = wrap(face.text, size, textW, measure);
  }
  const lead = size * 1.34;
  const blockH = lines.length * lead;
  const firstY = bodyTop + Math.max(0, (bodyBottom - bodyTop - blockH) / 2.6) + size;
  panel += lines
    .map((l, i) => `<text x="${n(W / 2)}" y="${n(firstY + i * lead)}" font-family="${CARD_FONTS.body}" font-size="${n(size)}" fill="${p.ink}" text-anchor="middle">${tspans(l, p.ink)}</text>`)
    .join('');

  // Footer.
  const fy = H - CARD.safe - 0.2;
  const foot = (x: number, text: string, anchor: string) =>
    `<text x="${n(x)}" y="${n(fy)}" font-family="${CARD_FONTS.body}" font-size="1.7" font-weight="600" letter-spacing=".18" fill="${p.muted}" text-anchor="${anchor}">${esc(text)}</text>`;
  const num = face.index !== undefined && face.deckSize ? ` ${String(face.index).padStart(2, '0')}/${face.deckSize}` : '';
  panel += foot(CARD.safe + 0.6, `${info.label} · ${info.kind}`.toUpperCase(), 'start') + foot(W - CARD.safe - 0.6, `CUBIC ${info.edition}${num}`, 'end');

  const base: Fragment = {
    defs: o.fontCss ? `<style>${o.fontCss}</style>` : '',
    body: `<rect x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" fill="${p.paper}"/>`,
  };
  return finish(join(base, art, { defs: '', body: hud + panel }), area, id, o.rounded);
}

function finish(all: Fragment, area: Box, id: string, rounded?: boolean): string {
  if (rounded) {
    all = {
      defs: all.defs + roundedClip(`${id}-corners`, { x: 0, y: 0, w: CARD.w, h: CARD.h }, CARD.corner),
      body: `<g clip-path="url(#${id}-corners)">${all.body}</g>`,
    };
  }
  return document(all, area);
}

/** The back of a deck's cards. */
export function cardBackSvg(deck: CardDeck, o: Omit<CardOptions, 'measure'> = {}): string {
  const id = o.idPrefix ?? `back-${deck}`;
  const info = DECK_INFO[deck];
  const { w: W, h: H } = CARD;
  const b = o.bleed ? CARD.bleed : 0;
  const area: Box = { x: -b, y: -b, w: W + 2 * b, h: H + 2 * b };
  const hue = deck === 'expansion' ? CARD_CATEGORIES.expansion.hue : deck === 'command' || deck === 'gambit' ? 38 : 222;
  const p = palette(info.light, hue);
  const r = rng(hash(`back:${deck}`));
  const inset = info.light ? 4 : 0;
  const full: Box = { x: -CARD.bleed, y: -CARD.bleed, w: W + 2 * CARD.bleed, h: H + 2 * CARD.bleed };
  const win: Box = info.light ? { x: inset, y: inset, w: W - 2 * inset, h: H - 2 * inset } : full;
  const sky = starfield({ rng: r.fork('sky'), id: `${id}-sky`, area: win, frame: info.light ? win : { x: 0, y: 0, w: W, h: H }, hues: [hue - 10, hue + 50], nebula: 0.7 });
  const cx = W / 2;
  const cy = H * 0.44;
  const halo = glow(`${id}-halo`, cx, cy + 2, 22, 22, hue, 0.5, 60);
  let orbits = '';
  for (let i = 0; i < 3; i++) orbits += `<ellipse cx="${n(cx)}" cy="${n(cy + 1)}" rx="${n(16 + i * 5)}" ry="${n(5 + i * 1.6)}" fill="none" stroke="${hsl(hue, 80, 75)}" stroke-width=".3" opacity="${n(0.6 - i * 0.15)}" transform="rotate(-18 ${n(cx)} ${n(cy)})"/>`;
  const clip = info.light ? roundedClip(`${id}-win`, win, 2.6) : `<clipPath id="${id}-win"><rect x="${n(win.x)}" y="${n(win.y)}" width="${n(win.w)}" height="${n(win.h)}"/></clipPath>`;
  const title = `<text x="${n(cx)}" y="${n(H * 0.72)}" font-family="${CARD_FONTS.title}" font-weight="900" font-size="7" letter-spacing="1.4" fill="#fff" text-anchor="middle">CUBIC</text>`;
  const sub = `<text x="${n(cx)}" y="${n(H * 0.72 + 6)}" font-family="${CARD_FONTS.body}" font-weight="700" font-size="2.4" letter-spacing=".9" fill="${hsl(hue, 90, 78)}" text-anchor="middle">${esc(info.label.toUpperCase())}${info.edition === '2013' ? ' · ORIGINAL' : ''}</text>`;
  const border = info.light ? `<rect x="${n(win.x)}" y="${n(win.y)}" width="${n(win.w)}" height="${n(win.h)}" rx="2.6" fill="none" stroke="${p.accent}" stroke-width=".4"/>` : `<rect x="3" y="3" width="${n(W - 6)}" height="${n(H - 6)}" rx="1.6" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".3" opacity=".5"/>`;
  const all: Fragment = {
    defs: (o.fontCss ? `<style>${o.fontCss}</style>` : '') + sky.defs + halo.defs + clip,
    body:
      `<rect x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" fill="${p.paper}"/>` +
      `<g clip-path="url(#${id}-win)">${sky.body}${halo.body}${orbits}${die(cx, cy, 11, 6, hue)}${title}${sub}</g>` +
      border,
  };
  return finish(all, area, id, o.rounded);
}
