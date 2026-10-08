import { estimateWidth, type Measure } from './card';
import { icon } from './icons';
import { poly } from './kit/props';
import { shipDie } from './kit/starships';
import { dieCut, document, esc, hsl, n, type Fragment } from './svg';
import { ACTION_HUE, CUBE_PAD, DOMINANCE, FONTS, INK, RESEARCH, TILE } from './tokens';

/**
 * The player aid: an A6 board, landscape, the same for every player. Down the left edge, a rail of
 * seven cube pads holds the player's cubes, with the win condition beside it; then the two pads for
 * the dominance and research dice (19 mm), and between them the three actions; along the bottom,
 * the six ships on their die faces with what each can do.
 *
 * Kept deliberately quiet: one flat ground, one accent colour (actions take the cards' yellow), no boxes.
 * The ship dice are the largest thing on it, then the die pads, then the actions. No text is smaller than `MIN_TEXT`.
 */

export const AID = {
  /** A6 landscape. */
  w: 148,
  h: 105,
  bleed: 3,
  /** Outer margin: text and pads stay this far inside the trim. */
  safe: 6,
  corner: 3,
} as const;

/** The smallest text on the aid, mm (2 mm ≈ 5.7 pt), so it reads at arm's length on the table. */
export const MIN_TEXT = 2;

export type AidEdition = 'community' | 'classic';

export interface AidOptions {
  /** Community Edition or Classic (the 2013 rules) wording. */
  edition?: AidEdition;
  /** Add the bleed around the trim. */
  bleed?: boolean;
  /** Clip to die-cut corners (for previews). */
  rounded?: boolean;
  /** Text widths with the embedded fonts; estimated when absent. */
  measure?: Measure;
  /** `@font-face` rules to embed. */
  fontCss?: string;
  idPrefix?: string;
}

// ---------------------------------------------------------------------------
// What it says

const SHIPS: { value: number; ability: string; text: string }[] = [
  { value: 1, ability: 'Free Attack', text: 'Attack an adjacent enemy' },
  { value: 2, ability: 'Carry & Move', text: 'Move with a ship aboard' },
  { value: 3, ability: 'Swap', text: 'Trade places with any of your ships' },
  { value: 4, ability: 'Change to 3 or 5', text: 'Turn the die, no roll' },
  { value: 5, ability: 'Move Diagonally', text: 'Move and attack diagonally' },
  { value: 6, ability: 'Free Reconfigure', text: 'Re-roll without an action' },
];

const actions = (edition: AidEdition): { name: string; cost: number; text: string }[] => [
  { name: 'Conquer', cost: 2, text: 'Your orbiting ships sum to exactly the planet' },
  { name: 'Deploy', cost: 1, text: 'Scrapyard ship to an orbit of your cube' },
  { name: 'Move / Attack', cost: 1, text: 'Up to the ship’s value; attack ends it' },
  { name: 'Reconfigure', cost: 1, text: edition === 'community' ? 'Re-roll to a value not seen this turn' : 'Re-roll a ship to a new value' },
  { name: 'Research', cost: 1, text: '+1 research' },
];

const rules = (edition: AidEdition): [label: string, text: string][] => [
  ['Combat', 'Die + ship value: lower wins, ties to attacker'],
  edition === 'community' ? ['Missile', 'Any time: one combat roll becomes 1'] : ['Defeat', 'The ship is re-rolled into the scrapyard'],
  ['Ships', 'Each: one move and one ability a turn'],
  ['Cards', 'At turn end: 1 per conquest · 1 at research 6'],
];

// ---------------------------------------------------------------------------
// Type

type Font = 'title' | 'body' | 'bold';

interface TextStyle {
  font?: Font;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  /** Letter spacing, as a fraction of the size. */
  track?: number;
  upper?: boolean;
}

function text(x: number, y: number, s: string, size: number, o: TextStyle = {}): string {
  const font = o.font ?? 'body';
  return (
    `<text x="${n(x)}" y="${n(y)}" font-family="${font === 'title' ? FONTS.title : FONTS.body}" font-weight="${font === 'title' ? 900 : font === 'bold' ? 700 : 400}" font-size="${n(size)}" fill="${o.fill ?? '#fff'}"` +
    (o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '') +
    (o.track ? ` letter-spacing="${n(size * o.track)}"` : '') +
    `>${esc(o.upper ? s.toUpperCase() : s)}</text>`
  );
}

/** One line that shrinks to fit `width`, but never below `MIN_TEXT`. */
function line(x: number, y: number, s: string, size: number, width: number, measure: Measure, o: TextStyle = {}) {
  const shown = o.upper ? s.toUpperCase() : s;
  const w = measure(shown, 1, o.font ?? 'body') + shown.length * (o.track ?? 0);
  return text(x, y, s, Math.max(MIN_TEXT, Math.min(size, width / w)), o);
}

/** One line if it fits in `width` mm, else two lines of about equal length (no lone "a 5" or "free"). */
function wrap(s: string, size: number, width: number, measure: Measure): string[] {
  if (measure(s, size, 'body') <= width) return [s];
  const words = s.split(' ');
  const splits = words.slice(1).map((_, i) => [words.slice(0, i + 1).join(' '), words.slice(i + 1).join(' ')]);
  const longer = (l: string[]) => Math.max(...l.map((t) => measure(t, size, 'body')));
  return splits.reduce((best, l) => (longer(l) < longer(best) ? l : best));
}

// ---------------------------------------------------------------------------
// The board

const GROUND = hsl(228, 40, 8);
const WHITE = hsl(220, 30, 96);
const MUTED = hsl(224, 18, 74);
const HAIR = hsl(224, 20, 30);
/** The quiet fill of every pad on the aid: cubes and dice. */
const PAD = hsl(228, 32, 12);
/** The one accent: the game's own cyan, the same for every player. */
const HUE = 194;

/** One action: a yellow hexagon with the action bolt, as on the cards (`glow` is its soft halo's gradient id). */
function hex(cx: number, cy: number, r: number, glow: string): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 1.8)}" fill="url(#${glow})"/><path d="${poly(cx, cy, r)}" fill="${hsl(ACTION_HUE, 95, 58)}"/>` + icon('action', cx, cy, r * 1.2, INK, 2.8);
}

/** A die pad: where the dominance or research die sits, the 24 mm of a tile's space (a 19 mm die with room round it). */
function diePad(cx: number, cy: number, hue: number, kind: 'dominance' | 'research'): string {
  const s = TILE.pad;
  return (
    `<rect x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${s}" height="${s}" rx="3.6" fill="${PAD}" stroke="${hsl(hue, 80, 62)}" stroke-width=".4"/>` +
    icon(kind, cx, cy, 7, hsl(hue, 60, 40), 1.5)
  );
}

/** The most cubes any map gives a player. */
const MAX_CUBES = 7;

/** The player aid as a standalone SVG document. */
export function playerAidSvg(o: AidOptions = {}): string {
  const edition = o.edition ?? 'community';
  const measure = o.measure ?? estimateWidth;
  const id = o.idPrefix ?? `aid-${edition}`;
  const { w: W, h: H, safe: M } = AID;
  const b = o.bleed ? AID.bleed : 0;
  const defs: string[] = [];
  const out: string[] = [];
  const accent = hsl(HUE, 90, 66);

  out.push(`<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="${GROUND}"/>`);
  defs.push(`<radialGradient id="${id}-glow"><stop offset="0" stop-color="${hsl(ACTION_HUE, 100, 60)}" stop-opacity=".5"/><stop offset="1" stop-color="${hsl(ACTION_HUE, 100, 60)}" stop-opacity="0"/></radialGradient>`);

  // --- The cube rail: a pad per cube, spread over the full height, with the win condition alongside.
  // The pads are the planets' cube pads in the die pads' quiet fill; the text runs up the rail, like a spine.
  const pad = CUBE_PAD.size;
  const step = (H - 2 * M - pad) / (MAX_CUBES - 1);
  for (let i = 0; i < MAX_CUBES; i++) {
    out.push(`<rect x="${M}" y="${n(M + i * step)}" width="${pad}" height="${pad}" rx="1.6" fill="${PAD}" stroke="${hsl(224, 20, 52)}" stroke-width=".3"/>`);
  }
  const spine = M + pad + 3.6;
  out.push(`<g transform="rotate(-90 ${n(spine)} ${n(H / 2)})">${text(spine, H / 2, 'Place your last cube to win', 2.4, { font: 'bold', fill: WHITE, anchor: 'middle', track: 0.16, upper: true })}</g>`);
  const left = spine + 4;

  // --- Dominance and research: label, pad, what moves the die, what 6 does.
  const colW = 26;
  const side = (x: number, kind: 'dominance' | 'research') => {
    const h = kind === 'dominance' ? DOMINANCE : RESEARCH;
    const tone = hsl(h, 85, 70);
    const cx = x + colW / 2;
    out.push(text(cx, M + 3, kind, 2.4, { font: 'bold', fill: tone, anchor: 'middle', track: 0.16, upper: true }));
    out.push(diePad(cx, M + 17.5, h, kind));
    const lines =
      kind === 'dominance'
        ? { gain: ['+1 per enemy destroyed', '−1 per ship lost'], six: 'At 6 · Infamy', then: ['Place a cube on any', 'planet, reset to 1'] }
        : { gain: ['+1 per Research action'], six: 'At 6 · Breakthrough', then: ['Take a card at the', 'end of turn, reset to 1'] };
    let y = M + 34.6;
    for (const t of lines.gain) {
      out.push(line(cx, y, t, 2.3, colW, measure, { fill: WHITE, anchor: 'middle' }));
      y += 3.1;
    }
    y = M + 43.2;
    out.push(line(cx, y, lines.six, 2.4, colW, measure, { font: 'bold', fill: tone, anchor: 'middle' }));
    lines.then.forEach((t, i) => out.push(line(cx, y + 3.3 + i * 3, t, 2.2, colW, measure, { fill: MUTED, anchor: 'middle' })));
  };
  side(left, 'dominance');
  side(W - M - colW, 'research');

  // --- The turn, in the middle column.
  const x0 = left + colW + 4;
  const cw = W - M - colW - 4 - x0;
  const rule = (y: number) => `<path d="M${n(x0)} ${n(y)}H${n(x0 + cw)}" stroke="${HAIR}" stroke-width=".25"/>`;
  out.push(text(x0, M + 4.6, '3 actions', 3.2, { font: 'bold', fill: WHITE, upper: true, track: 0.06 }));
  for (let i = 0; i < 3; i++) out.push(hex(x0 + cw - 2.2 - i * 5, M + 3.5, 2.25, `${id}-glow`));
  out.push(rule(M + 7.6));
  const textX = x0 + 7.8;
  actions(edition).forEach((a, i) => {
    const y = M + 12.2 + i * 6.2;
    for (let k = 0; k < a.cost; k++) out.push(hex(x0 + 1.6 + k * 3.6, y - 0.8, 1.6, `${id}-glow`));
    out.push(text(textX, y, a.name, 2.6, { font: 'bold', fill: WHITE }));
    out.push(line(textX, y + 2.9, a.text, 2.2, x0 + cw - textX, measure, { fill: MUTED }));
  });
  out.push(rule(M + 42.6));
  const ruleX = x0 + 13;
  rules(edition).forEach(([label, s], i) => {
    const y = M + 46.4 + i * 3.1;
    out.push(text(x0, y, label, 2.1, { font: 'bold', fill: WHITE, track: 0.08, upper: true }));
    out.push(line(ruleX, y, s, 2.2, x0 + cw - ruleX, measure, { fill: MUTED }));
  });

  // --- The fleet: six die faces, strongest to fastest, and what each can do.
  const fleetY = 67.6;
  const size = 17;
  const gap = (W - M - left - 6 * size) / 5;
  for (const [i, s] of SHIPS.entries()) {
    const cx = left + size / 2 + i * (size + gap);
    const d = shipDie(`${id}-d${s.value}`, s.value, cx, fleetY + size / 2, size, HUE);
    defs.push(d.defs);
    out.push(d.body);
    const ty = fleetY + size + 4.2;
    out.push(line(cx, ty, s.ability, 2.6, size + gap - 0.8, measure, { font: 'bold', fill: accent, anchor: 'middle' }));
    wrap(s.text, 2.1, size + gap - 0.8, measure).forEach((t, k) => out.push(text(cx, ty + 3.2 + k * 2.75, t, 2.1, { fill: MUTED, anchor: 'middle' })));
  }

  const all: Fragment = { defs: (o.fontCss ? `<style>${o.fontCss}</style>` : '') + defs.join(''), body: out.join('') };
  return document(o.rounded ? dieCut(all, id, W, H, AID.corner) : all, { x: -b, y: -b, w: W + 2 * b, h: H + 2 * b });
}
