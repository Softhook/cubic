import { hash, rng } from './rng';
import { starfield, type Box } from './starfield';
import { document, hsl, join, n, type Fragment } from './svg';
import { die, esc, glow, icon, SHIP_HUES } from './cardkit';
import { ILLUSTRATIONS } from './illustrations';

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

/** Tactics and Gambits have no category in the data: this gives them one, for colour and icon. Keyed by id without the original's `o-`. */
const THEMES: Record<string, string> = {
  aggression: 'combat',
  'black-market': 'combat',
  'change-of-heart': 'card',
  momentum: 'action',
  'plan-ahead': 'combat',
  sabotage: 'action',
  'show-of-force': 'combat',
  'unveil-the-fleet': 'ship',
  'warp-gate': 'movement',
  expansion: 'expansion',
  reorganization: 'ship',
  relocation: 'conquer',
};

/** The category a card is shown under (its accent colour and icon). */
export function cardCategory(f: CardFace): string {
  return f.category ?? THEMES[f.id.replace(/^o-/, '')] ?? (f.deck === 'expansion' ? 'expansion' : 'action');
}

/** What a card's illustration shows, for art direction (the Art Lab prints it under the card). */
export function cardIllustration(f: CardFace): string {
  return ILLUSTRATIONS[f.id]?.caption ?? 'no illustration yet';
}

const DECK_INFO: Record<CardDeck, { label: string; kind: string; light: boolean; edition: string }> = {
  skill: { label: 'Skill', kind: 'Permanent', light: true, edition: 'CE' },
  tactic: { label: 'Tactic', kind: 'One-shot', light: false, edition: 'CE' },
  expansion: { label: 'Expansion', kind: 'One-shot', light: false, edition: 'CE' },
  command: { label: 'Command', kind: 'Permanent', light: true, edition: '2013' },
  gambit: { label: 'Gambit', kind: 'One-shot', light: false, edition: '2013' },
};

export const deckInfo = (d: CardDeck) => DECK_INFO[d];

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
  const scene = join(...(ILLUSTRATIONS[face.id]?.draw({ id: `${id}-m`, r: r.fork('motif'), hue: cat.hue, box: view, p1, p2 }) ?? []));
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
