import { hash, rng, type Rng } from './rng';
import { starfield, type Box } from './starfield';
import { document, esc, hsl, join, n, type Fragment } from './svg';
import { CARD_CATEGORIES, FONTS, INK, PLAYER_HUES } from './tokens';
import { icon } from './icons';
import { die, glow } from './kit';
import { ILLUSTRATIONS } from './illustrations';

/**
 * Advance cards, poker size (63.5 × 88.9 mm), for print and the Art Lab. See docs/GRAPHICS.md §2, Cards.
 *
 * Permanent cards (CE Skills, Classic Commands) are light; one-shot cards (Tactics, Gambits, Expansion)
 * are dark, so the two read apart across the table, as the light and dark decks of the physical game do.
 * The art runs to the top and side edges on every card. The illustration shows what the card does
 * (illustrations.ts); the accent colour and icon are its category's (data/cards.yaml, tokens.ts).
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
} as const;

export type CardDeck = 'skill' | 'tactic' | 'expansion' | 'command' | 'gambit';

/** Everything printed on a card face. */
export interface CardFace {
  id: string;
  name: string;
  subtitle: string;
  text: string;
  deck: CardDeck;
  /** Movement, action, combat, … (CARD_CATEGORIES): sets the accent colour and icon. */
  category: string;
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

/** Title letter spacing, in em. */
const TITLE_TRACKING = 0.04;

/** Rough widths for Orbitron and Inter, when no real measurement is available. */
export const estimateWidth: Measure = (text, size, font) => size * text.length * (font === 'title' ? 0.8 : font === 'bold' ? 0.56 : 0.52);

/** What an illustration shows, for art direction (the Art Lab prints it under the card). */
export function cardIllustration(f: CardFace): string {
  return ILLUSTRATIONS[f.id]?.caption ?? 'no illustration yet';
}

const DECK_INFO: Record<CardDeck, { label: string; kind: string; light: boolean; edition: string; backHue: number }> = {
  skill: { label: 'Skill', kind: 'Permanent', light: true, edition: 'CE', backHue: 222 },
  tactic: { label: 'Tactic', kind: 'One-shot', light: false, edition: 'CE', backHue: 222 },
  expansion: { label: 'Expansion', kind: 'One-shot', light: false, edition: 'CE', backHue: CARD_CATEGORIES.expansion.hue },
  command: { label: 'Command', kind: 'Permanent', light: true, edition: 'Classic', backHue: 38 },
  gambit: { label: 'Gambit', kind: 'One-shot', light: false, edition: 'Classic', backHue: 38 },
};

export const deckInfo = (d: CardDeck) => DECK_INFO[d];

/** A card's colours. Light for permanent cards, dark for one-shot ones; the game's cards use the same. */
export interface CardPalette {
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
}

export function cardPalette(light: boolean, hue: number): CardPalette {
  return light
    ? { paper: hsl(225, 30, 95), ink: hsl(228, 40, 12), muted: hsl(228, 15, 42), accent: hsl(hue, 80, 52), accentInk: hsl(hue, 85, 30) }
    : { paper: INK, ink: hsl(225, 60, 94), muted: hsl(226, 22, 64), accent: hsl(hue, 90, 62), accentInk: hsl(hue, 100, 80) };
}

/** A category's colours on a light or dark card; throws for a category the tokens don't know. */
function categoryOf(face: CardFace) {
  const cat = CARD_CATEGORIES[face.category];
  if (!cat) throw new Error(`card ${face.id}: unknown category "${face.category}"`);
  return { name: face.category, ...cat };
}

// ---------------------------------------------------------------------------
// Markup helpers

const rect = (b: Box, attrs = '') => `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}"${attrs ? ` ${attrs}` : ''}/>`;

const clipRect = (id: string, b: Box, r = 0) => `<clipPath id="${id}">${rect(b, r ? `rx="${n(r)}"` : '')}</clipPath>`;

/** The page area: trim size, plus the bleed when asked. */
const pageArea = (bleed?: boolean, b = bleed ? CARD.bleed : 0): Box => ({ x: -b, y: -b, w: CARD.w + 2 * b, h: CARD.h + 2 * b });

const fontStyle = (o: { fontCss?: string }) => (o.fontCss ? `<style>${o.fontCss}</style>` : '');

/** The card as a document, with die-cut corners when `rounded`. */
function finish(all: Fragment, area: Box, id: string, rounded?: boolean): string {
  if (rounded) {
    all = {
      defs: all.defs + clipRect(`${id}-corners`, { x: 0, y: 0, w: CARD.w, h: CARD.h }, CARD.corner),
      body: `<g clip-path="url(#${id}-corners)">${all.body}</g>`,
    };
  }
  return document(all, area);
}

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

/** The art window, clipped: it runs into the bleed at the top and sides. */
const ART_WIN: Box = { x: -CARD.bleed, y: -CARD.bleed, w: CARD.w + 2 * CARD.bleed, h: CARD.artBottom + CARD.bleed };
/** The part of the art that's visible on the trimmed card: illustrations compose to this. */
const ART_VIEW: Box = { x: 0, y: 0, w: CARD.w, h: CARD.artBottom };
/** Baseline and inset of the labels over the art. */
const HUD = { x: CARD.safe + 0.6, y: 5.6 };

/** The illustration over a starfield in the category's colours, shaded towards the text panel. */
function art(face: CardFace, id: string, hue: number, p: CardPalette, r: Rng): Fragment {
  const win = ART_WIN;
  const view = ART_VIEW;
  const players = [...PLAYER_HUES];
  const p1 = players.splice(r.int(0, players.length - 1), 1)[0];
  const p2 = players[r.int(0, players.length - 1)];
  const sky = starfield({
    rng: r.fork('sky'),
    id: `${id}-sky`,
    area: win,
    frame: view,
    hues: [hue + r.range(-15, 15), hue + r.range(30, 60)],
    nebula: r.range(0.45, 0.6),
  });
  const scene = join(...(ILLUSTRATIONS[face.id]?.draw({ id: `${id}-m`, r: r.fork('motif'), hue, box: view, p1, p2 }) ?? []));
  // Darken the art towards the panel so the emblem and title sit on calm ground.
  const shade = `<linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="${p.paper}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".85"/></linearGradient>`;
  return {
    defs: sky.defs + scene.defs + shade + clipRect(`${id}-win`, win),
    body: `<g clip-path="url(#${id}-win)">${sky.body}${scene.body}${rect(win, `fill="url(#${id}-shade)"`)}</g>`,
  };
}

/** Labels over the art: the category and the number of copies. */
function hud(face: CardFace, label: string): string {
  const { x, y } = HUD;
  const text = (tx: number, s: string, anchor: string) =>
    `<text x="${n(tx)}" y="${n(y)}" font-family="${FONTS.body}" font-size="1.9" font-weight="700" letter-spacing=".22" fill="#fff" text-anchor="${anchor}" opacity=".92">${esc(s.toUpperCase())}</text>`;
  return text(x, label, 'start') + (face.copies && face.copies > 1 ? text(CARD.w - x, `×${face.copies}`, 'end') : '');
}

/** The text panel: the category emblem, name, subtitle, rules text and footer. */
function textPanel(face: CardFace, category: string, area: Box, p: CardPalette, measure: Measure): string {
  const { w: W, h: H, artBottom: top, safe } = CARD;
  const info = DECK_INFO[face.deck];
  // The panel below the art, edged in the accent.
  let out = rect({ x: area.x, y: top, w: area.w, h: area.y + area.h - top }, `fill="${p.paper}"`) + rect({ x: area.x, y: top - 0.2, w: area.w, h: 0.4 }, `fill="${p.accent}"`);

  // Emblem straddling art and panel.
  out +=
    `<circle cx="${n(W / 2)}" cy="${n(top)}" r="5.4" fill="${p.paper}"/>` +
    `<circle cx="${n(W / 2)}" cy="${n(top)}" r="4.5" fill="none" stroke="${p.accent}" stroke-width=".5"/>` +
    icon(category, W / 2, top, 4.6, p.accent);

  const textW = W - 2 * safe - 2;
  const nameText = face.name.toUpperCase();
  const nameSize = Math.min(4.2, textW / (measure(nameText, 1, 'title') + nameText.length * TITLE_TRACKING));
  const nameY = top + 10.2;
  out += `<text x="${n(W / 2)}" y="${n(nameY)}" font-family="${FONTS.title}" font-weight="900" font-size="${n(nameSize)}" letter-spacing="${n(nameSize * TITLE_TRACKING)}" fill="${p.ink}" text-anchor="middle">${esc(nameText)}</text>`;
  const subY = nameY + 4;
  out += `<text x="${n(W / 2)}" y="${n(subY)}" font-family="${FONTS.body}" font-style="italic" font-size="2.3" fill="${p.accentInk}" text-anchor="middle">${esc(face.subtitle)}</text>`;

  // Rules text: the largest size that fits between the subtitle and the footer.
  const bodyTop = subY + 3.4;
  const bodyBottom = H - safe - 2.8;
  let size = 3.3;
  let lines = wrap(face.text, size, textW, measure);
  while (size > 2.1 && lines.length * size * 1.34 > bodyBottom - bodyTop) {
    size -= 0.1;
    lines = wrap(face.text, size, textW, measure);
  }
  const lead = size * 1.34;
  const firstY = bodyTop + Math.max(0, (bodyBottom - bodyTop - lines.length * lead) / 2.6) + size;
  out += lines
    .map((l, i) => `<text x="${n(W / 2)}" y="${n(firstY + i * lead)}" font-family="${FONTS.body}" font-size="${n(size)}" fill="${p.ink}" text-anchor="middle">${tspans(l, p.ink)}</text>`)
    .join('');

  // Footer, tucked into the bottom corners: position in the deck, and edition.
  const fx = 3.2;
  const fy = H - 2.4;
  const foot = (x: number, text: string, anchor: string) =>
    `<text x="${n(x)}" y="${n(fy)}" font-family="${FONTS.body}" font-size="1.35" font-weight="600" letter-spacing=".15" fill="${p.muted}" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;
  const num = face.index !== undefined && face.deckSize ? `${String(face.index).padStart(2, '0')}/${face.deckSize}` : '';
  return out + (num ? foot(fx, num, 'start') : '') + foot(W - fx, info.edition, 'end');
}

/** The front of a card as a standalone SVG document. */
export function cardSvg(face: CardFace, o: CardOptions = {}): string {
  const id = o.idPrefix ?? `card-${face.id}`;
  const cat = categoryOf(face);
  const p = cardPalette(DECK_INFO[face.deck].light, cat.hue);
  const area = pageArea(o.bleed);
  const base: Fragment = { defs: fontStyle(o), body: rect(area, `fill="${p.paper}"`) };
  const front: Fragment = { defs: '', body: hud(face, cat.label) + textPanel(face, cat.name, area, p, o.measure ?? estimateWidth) };
  return finish(join(base, art(face, id, cat.hue, p, rng(hash(`card:${face.id}`))), front), area, id, o.rounded);
}

/** The back of a deck's cards. */
export function cardBackSvg(deck: CardDeck, o: Omit<CardOptions, 'measure'> = {}): string {
  const id = o.idPrefix ?? `back-${deck}`;
  const info = DECK_INFO[deck];
  const { w: W, h: H } = CARD;
  const area = pageArea(o.bleed);
  const hue = info.backHue;
  const p = cardPalette(info.light, hue);
  const r = rng(hash(`back:${deck}`));
  const inset = 4;
  const win: Box = info.light ? { x: inset, y: inset, w: W - 2 * inset, h: H - 2 * inset } : pageArea(true);
  const sky = starfield({ rng: r.fork('sky'), id: `${id}-sky`, area: win, frame: info.light ? win : { x: 0, y: 0, w: W, h: H }, hues: [hue - 10, hue + 50], nebula: 0.7 });
  const cx = W / 2;
  const cy = H * 0.44;
  const halo = glow(`${id}-halo`, cx, cy + 2, 22, 22, hue, 0.5, 60);
  let orbits = '';
  for (let i = 0; i < 3; i++) orbits += `<ellipse cx="${n(cx)}" cy="${n(cy + 1)}" rx="${n(16 + i * 5)}" ry="${n(5 + i * 1.6)}" fill="none" stroke="${hsl(hue, 80, 75)}" stroke-width=".3" opacity="${n(0.6 - i * 0.15)}" transform="rotate(-18 ${n(cx)} ${n(cy)})"/>`;
  const title = `<text x="${n(cx)}" y="${n(H * 0.72)}" font-family="${FONTS.title}" font-weight="900" font-size="7" letter-spacing="1.4" fill="#fff" text-anchor="middle">CUBIC</text>`;
  const sub = `<text x="${n(cx)}" y="${n(H * 0.72 + 6)}" font-family="${FONTS.body}" font-weight="700" font-size="2.4" letter-spacing=".9" fill="${hsl(hue, 90, 78)}" text-anchor="middle">${esc(info.label.toUpperCase())}${info.edition === 'Classic' ? ' · CLASSIC' : ''}</text>`;
  const border = info.light
    ? rect(win, `rx="2.6" fill="none" stroke="${p.accent}" stroke-width=".4"`)
    : `<rect x="3" y="3" width="${n(W - 6)}" height="${n(H - 6)}" rx="1.6" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".3" opacity=".5"/>`;
  const all: Fragment = {
    defs: fontStyle(o) + sky.defs + halo.defs + clipRect(`${id}-win`, win, info.light ? 2.6 : 0),
    body: rect(area, `fill="${p.paper}"`) + `<g clip-path="url(#${id}-win)">${sky.body}${halo.body}${orbits}${die(cx, cy, 11, 6, hue)}${title}${sub}</g>` + border,
  };
  return finish(all, area, id, o.rounded);
}
