import { estimateWidth, type Measure } from './card';
import { icon } from './icons';
import { chip } from './kit/hud';
import { shipDie } from './kit/starships';
import { document, esc, hsl, n, type Fragment } from './svg';
import { DOMINANCE, FONTS, RESEARCH, TILE } from './tokens';

/**
 * The player aid: an A6 board, landscape, the same for every player. Its two pads hold the dominance
 * and research dice (19 mm); between them, the three actions; along the bottom, the six ships on
 * their die faces with what each can do.
 *
 * Kept deliberately quiet: one flat ground, one accent colour, no boxes. The ship dice are the largest
 * thing on it, then the die pads, then the actions. No text is smaller than `MIN_TEXT`.
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
  { value: 1, ability: 'Free attack', text: 'Attack an adjacent enemy' },
  { value: 2, ability: 'Carry', text: 'Move with a ship aboard' },
  { value: 3, ability: 'Swap', text: 'Trade places with any of your ships' },
  { value: 4, ability: 'Change', text: 'Turn into a 3 or a 5' },
  { value: 5, ability: 'Diagonal', text: 'Move and attack diagonally' },
  { value: 6, ability: 'Free re-roll', text: 'Reconfigure for free' },
];

const actions = (edition: AidEdition): { name: string; cost: number; text: string }[] => [
  { name: 'Conquer', cost: 2, text: 'Orbiting ships add up to the planet' },
  { name: 'Deploy', cost: 1, text: 'Scrapyard ship to an orbit of your cube' },
  { name: 'Move / Attack', cost: 1, text: 'Up to the ship’s value; attack ends it' },
  { name: 'Reconfigure', cost: 1, text: edition === 'community' ? 'Re-roll to a value not seen this turn' : 'Re-roll a ship to a new value' },
  { name: 'Research', cost: 1, text: '+1 research' },
];

const rules = (edition: AidEdition): [label: string, text: string][] => [
  ['Combat', 'Die + ship value: lower wins, ties to attacker'],
  edition === 'community' ? ['Missile', 'Any time: one combat roll becomes 1'] : ['Defeat', 'The ship is re-rolled into the scrapyard'],
  ['Cards', '1 per planet conquered · 1 at research 6'],
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

/** Greedy word wrap to `width` mm. */
function wrap(s: string, size: number, width: number, measure: Measure): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of s.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next, size, 'body') > width) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  return cur ? [...lines, cur] : lines;
}

// ---------------------------------------------------------------------------
// The board

const GROUND = hsl(228, 40, 8);
const WHITE = hsl(220, 30, 96);
const MUTED = hsl(224, 18, 74);
const HAIR = hsl(224, 20, 30);
/** The one accent: the game's own cyan, the same for every player. */
const HUE = 194;

/** A die pad: where the dominance or research die sits, the 24 mm of a tile's space (a 19 mm die with room round it). */
function diePad(cx: number, cy: number, hue: number, kind: 'dominance' | 'research'): string {
  const s = TILE.pad;
  return (
    `<rect x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${s}" height="${s}" rx="3.6" fill="${hsl(228, 32, 12)}" stroke="${hsl(hue, 80, 62)}" stroke-width=".4"/>` +
    icon(kind, cx, cy, 7, hsl(hue, 60, 40), 1.5)
  );
}

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

  // --- Dominance and research: label, pad, what moves the die, what 6 does.
  const colW = 30;
  const side = (x: number, kind: 'dominance' | 'research') => {
    const h = kind === 'dominance' ? DOMINANCE : RESEARCH;
    const tone = hsl(h, 85, 70);
    const cx = x + colW / 2;
    out.push(text(cx, M + 3, kind, 2.4, { font: 'bold', fill: tone, anchor: 'middle', track: 0.16, upper: true }));
    out.push(diePad(cx, M + 17.5, h, kind));
    const lines =
      kind === 'dominance'
        ? { gain: ['+1 per enemy destroyed', '−1 per ship lost'], six: 'At 6 · Infamy', then: ['Place a cube on any', 'planet, reset to 1'] }
        : { gain: ['+1 per Research action'], six: 'At 6 · Breakthrough', then: ['Take a card in your', 'card phase, reset to 1'] };
    let y = M + 34.6;
    for (const t of lines.gain) {
      out.push(line(cx, y, t, 2.3, colW, measure, { fill: WHITE, anchor: 'middle' }));
      y += 3.1;
    }
    y = M + 43.2;
    out.push(line(cx, y, lines.six, 2.4, colW, measure, { font: 'bold', fill: tone, anchor: 'middle' }));
    lines.then.forEach((t, i) => out.push(line(cx, y + 3.3 + i * 3, t, 2.2, colW, measure, { fill: MUTED, anchor: 'middle' })));
  };
  side(M, 'dominance');
  side(W - M - colW, 'research');

  // --- The turn, in the middle column.
  const x0 = M + colW + 5;
  const cw = W - 2 * x0;
  out.push(text(x0, M + 4.6, '3 actions', 3.2, { font: 'bold', fill: WHITE, upper: true, track: 0.06 }));
  for (let i = 0; i < 3; i++) out.push(chip(x0 + cw - 2 - i * 4.6, M + 3.5, 1.95, HUE));
  out.push(`<path d="M${n(x0)} ${n(M + 7.6)}H${n(x0 + cw)}" stroke="${HAIR}" stroke-width=".25"/>`);
  const textX = x0 + 7.4;
  actions(edition).forEach((a, i) => {
    const y = M + 12.4 + i * 6.55;
    for (let k = 0; k < a.cost; k++) out.push(chip(x0 + 1.4 + k * 2.9, y - 0.8, 1.3, HUE));
    out.push(text(textX, y, a.name, 2.6, { font: 'bold', fill: WHITE }));
    out.push(line(textX, y + 2.9, a.text, 2.2, x0 + cw - textX, measure, { fill: MUTED }));
  });
  out.push(`<path d="M${n(x0)} ${n(M + 44.4)}H${n(x0 + cw)}" stroke="${HAIR}" stroke-width=".25"/>`);
  const ruleX = x0 + 15;
  rules(edition).forEach(([label, s], i) => {
    const y = M + 48.3 + i * 3.3;
    out.push(text(x0, y, label, 2.1, { font: 'bold', fill: WHITE, track: 0.08, upper: true }));
    out.push(line(ruleX, y, s, 2.2, x0 + cw - ruleX, measure, { fill: MUTED }));
  });

  // --- The fleet: six die faces, strongest to fastest, and what each can do.
  const fleetY = 67.4;
  const size = 19;
  const gap = (W - 2 * M - 6 * size) / 5;
  out.push(`<path d="M${M} ${n(fleetY - 3.4)}H${W - M}" stroke="${HAIR}" stroke-width=".25"/>`);
  for (const [i, s] of SHIPS.entries()) {
    const cx = M + size / 2 + i * (size + gap);
    const d = shipDie(`${id}-d${s.value}`, s.value, cx, fleetY + size / 2, size, HUE);
    defs.push(d.defs);
    out.push(d.body);
    const ty = fleetY + size + 4.2;
    out.push(line(cx, ty, s.ability, 2.6, size + gap - 0.8, measure, { font: 'bold', fill: accent, anchor: 'middle' }));
    wrap(s.text, 2.1, size + gap - 0.8, measure).forEach((t, k) => out.push(text(cx, ty + 3.2 + k * 2.75, t, 2.1, { fill: MUTED, anchor: 'middle' })));
  }

  let all: Fragment = { defs: (o.fontCss ? `<style>${o.fontCss}</style>` : '') + defs.join(''), body: out.join('') };
  if (o.rounded) {
    all = {
      defs: all.defs + `<clipPath id="${id}-corners"><rect width="${W}" height="${H}" rx="${AID.corner}"/></clipPath>`,
      body: `<g clip-path="url(#${id}-corners)">${all.body}</g>`,
    };
  }
  return document(all, { x: -b, y: -b, w: W + 2 * b, h: H + 2 * b });
}
