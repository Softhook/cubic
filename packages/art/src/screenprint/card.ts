import { rng } from '../rng';
import { dieCut, document, esc, n, type Box, type Fragment } from '../svg';
import type { CardDeck, CardFace, CardOptions, Measure } from '../card';
import { INKS, ON_NIGHT, ON_PAPER } from './inks';
import { SP_FONTS, land, label, mech, paperGround, screens, sky, stencil, type Stage } from './kit';
import { SCENES } from './scenes';

/**
 * The screenprint cards (docs/regolith/REGOLITH.md §5), after the CardStyles board's screenprint row: the scene
 * at the top in flat inks, a rule in the card's colour plate, the name stencilled in the paper's ink, a
 * reversed label bar, the rules in condensed type, and a footer. Permanent cards are on paper in key ink;
 * one-shot cards on night paper in bone. Same size, bleed and safe area as the holo cards (card.ts).
 */

const W = 63.5;
const H = 88.9;
const BLEED = 3;
/** Where the scene ends and the panel starts. */
const ART_BOTTOM = 42;
const SAFE = 4.5;

/** Each category's colour plate. */
const PLATE: Record<string, string> = {
  movement: INKS.ice,
  research: INKS.ice,
  expansion: INKS.ice,
  combat: INKS.oxide,
  ship: INKS.oxide,
  action: INKS.dust,
  conquer: INKS.dust,
  card: INKS.dust,
};

/** A category's name on the label bar, where Regolith's word differs from the category's. */
const CATEGORY_NAME: Record<string, string> = { ship: 'unit' };

/** The deck's name on its back, and whether it prints on night paper (one-shot and face-up decks). */
const DECK: Record<CardDeck, { name: string; dark: boolean }> = {
  skill: { name: 'Skill', dark: false },
  command: { name: 'Command', dark: false },
  tactic: { name: 'Tactic', dark: true },
  gambit: { name: 'Gambit', dark: true },
  expansion: { name: 'Expansion', dark: true },
};

/** Words set bold in the rules: the game's terms, in Regolith's words. */
const BOLD = new Set([
  'Research',
  'Power',
  'Atomic',
  'Atomics',
  'Combat',
  'Claim',
  'Claiming',
  'Attack',
  'Drop',
  'Refit',
  'Move',
  'Skill',
  'Skills',
  'Tactic',
  'Tactics',
  'Orbital',
  'strike',
  'strikes',
]);

/** Rough widths of the screenprint faces, when no real measurement is available. */
const estimateScreenprint: Measure = (text, size, font) =>
  size *
  text.length *
  (font === 'stencil'
    ? 0.7
    : font === 'display'
      ? 0.74
      : font === 'condensed'
        ? 0.42
        : font === 'condensedBold'
          ? 0.45
          : font === 'mono'
            ? 0.62
            : 0.52);

const rect = (b: Box, fill: string, extra = '') =>
  `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${fill}"${extra}/>`;

/** A card's stage: its paper and inks, its plate, and its scene's world. */
function stage(face: CardFace, id: string): Stage & { world: Stage['world'] } {
  const dark = DECK[face.deck].dark;
  const scene = SCENES[face.id];
  return {
    id,
    r: rng(`screenprint:${face.id}`),
    dark,
    world: scene?.world ?? 'phobos',
    w: W,
    h: ART_BOTTOM,
    paper: dark ? INKS.night : INKS.paper,
    key: dark ? INKS.bone : INKS.key,
    ink: dark ? ON_NIGHT : ON_PAPER,
    plate: PLATE[face.category] ?? INKS.dust,
    defs: [],
  };
}

/** The scene, clipped to the art window and its bleed. */
function art(face: CardFace, s: Stage): Fragment {
  const scene = SCENES[face.id];
  const body = scene ? scene.draw(s) : paperGround(s) + sky(s) + land(s, 33);
  const win: Box = { x: -BLEED, y: -BLEED, w: W + 2 * BLEED, h: ART_BOTTOM + BLEED };
  return {
    defs: screens(s) + s.defs.join('') + `<clipPath id="${s.id}-win">${rect(win, '#000')}</clipPath>`,
    body: `<g clip-path="url(#${s.id}-win)">${body}</g>`,
  };
}

interface Word {
  text: string;
  bold: boolean;
}

function wrap(text: string, size: number, width: number, measure: Measure): Word[][] {
  const words = text.split(/\s+/).map((w) => ({ text: w, bold: BOLD.has(w.replace(/[^A-Za-z]/g, '')) }));
  const space = measure(' ', size, 'condensed');
  const lines: Word[][] = [[]];
  let used = 0;
  for (const w of words) {
    const wd = measure(w.text, size, w.bold ? 'condensedBold' : 'condensed');
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

/** The panel under the scene: the rule, name, label bar, rules text and footer. */
function panel(face: CardFace, s: Stage, area: Box, measure: Measure): string {
  const ink = s.key;
  let out = rect({ x: area.x, y: ART_BOTTOM, w: area.w, h: area.y + area.h - ART_BOTTOM }, s.paper);
  out += rect({ x: area.x, y: ART_BOTTOM, w: area.w, h: area.y + area.h - ART_BOTTOM }, `url(#${s.id}-soft)`, ' opacity="0.5"');
  out += rect({ x: area.x, y: ART_BOTTOM - 0.1, w: area.w, h: 1 }, s.plate);

  // The name, as large as fits.
  const textW = W - 2 * SAFE;
  const name = face.name.toUpperCase();
  const size = Math.min(5.8, textW / (measure(name, 1, 'display') * 1.04));
  const nameY = ART_BOTTOM + 3.2 + size * 0.95;
  out += `<text x="${n(SAFE)}" y="${n(nameY)}" font-family="${SP_FONTS.display}" font-weight="900" font-size="${n(size)}" fill="${ink}">${esc(name)}</text>`;

  // The label bar: category and copies, reversed out of the key ink. The paper tells the deck and its kind.
  const tag = [
    ...(face.category === face.deck ? [] : [(CATEGORY_NAME[face.category] ?? face.category).toUpperCase()]),
    ...(face.copies && face.copies > 1 ? [`×${face.copies}`] : []),
  ].join(' · ');
  const tagSize = 1.6;
  const barY = nameY + 1.6;
  // Its letter spacing on top of the measured width.
  const barW = measure(tag, tagSize, 'mono') + tag.length * tagSize * 0.12 + 2.4;
  out += rect({ x: SAFE, y: barY, w: barW, h: 2.8 }, ink);
  out += `<text x="${n(SAFE + 1.2)}" y="${n(barY + 2)}" font-family="${SP_FONTS.mono}" font-weight="600" font-size="${tagSize}" letter-spacing="${n(tagSize * 0.12)}" fill="${s.paper}">${esc(tag)}</text>`;

  // The rules: the largest size that fits between the bar and the footer.
  const top = barY + 5.2;
  const bottom = H - SAFE - 3;
  let tsize = 3.9;
  let lines = wrap(face.text, tsize, textW, measure);
  while (tsize > 2.4 && lines.length * tsize * 1.22 > bottom - top) {
    tsize -= 0.1;
    lines = wrap(face.text, tsize, textW, measure);
  }
  const lead = tsize * 1.22;
  out += lines
    .map(
      (l, i) =>
        `<text x="${n(SAFE)}" y="${n(top + tsize * 0.8 + i * lead)}" font-family="${SP_FONTS.condensed}" font-weight="500" font-size="${n(tsize)}" fill="${ink}">` +
        l.map((w, j) => `<tspan${w.bold ? ' font-weight="700"' : ''}>${esc(w.text)}${j < l.length - 1 ? ' ' : ''}</tspan>`).join('') +
        `</text>`,
    )
    .join('');

  // The footer: the card's place in its deck.
  const muted = s.dark ? '#8F877B' : '#8a7f6c';
  if (face.index !== undefined && face.deckSize)
    out += label(
      `${String(face.index).padStart(2, '0')}/${String(face.deckSize).padStart(2, '0')}`,
      W - SAFE,
      H - SAFE + 0.3,
      1.3,
      muted,
      'end',
    );
  return out;
}

const pageArea = (bleed?: boolean): Box =>
  bleed ? { x: -BLEED, y: -BLEED, w: W + 2 * BLEED, h: H + 2 * BLEED } : { x: 0, y: 0, w: W, h: H };

const finish = (f: Fragment, area: Box, id: string, o: CardOptions) =>
  document(o.rounded ? dieCut(f, id, W, H, 3) : f, area, true, o.fontCss);

/** A screenprint card's front, as a standalone SVG document. */
export function screenprintCardSvg(face: CardFace, o: CardOptions = {}): string {
  const id = o.idPrefix ?? `sp-${face.id}`;
  const s = stage(face, id);
  const area = pageArea(o.bleed);
  const a = art(face, s);
  const f: Fragment = { defs: a.defs, body: rect(area, s.paper) + a.body + panel(face, s, area, o.measure ?? estimateScreenprint) };
  return finish(f, area, id, o);
}

/** A screenprint deck's back: the game's name over Mars and a Chameleon on its ground, on the deck's paper. */
export function screenprintBackSvg(deck: CardDeck, o: Omit<CardOptions, 'measure'> & { plain?: boolean } = {}): string {
  const id = o.idPrefix ?? `sp-back-${deck}`;
  const dark = DECK[deck].dark;
  const s: Stage = {
    id,
    r: rng(`screenprint-back:${deck}`),
    dark,
    world: deck === 'expansion' ? 'mars' : 'phobos',
    w: W,
    h: H,
    paper: dark ? INKS.night : INKS.paper,
    key: dark ? INKS.bone : INKS.key,
    ink: dark ? ON_NIGHT : ON_PAPER,
    plate: deck === 'expansion' ? INKS.ice : INKS.oxide,
    defs: [],
  };
  const area = pageArea(o.bleed);
  const body =
    paperGround(s) +
    sky(s, { planet: { x: W * 0.62, y: H * 0.3, r: 22 } }) +
    land(s, H * 0.7) +
    mech(s, 'chameleon', W * 0.36, H * 0.72, 0.17, { yaw: 30 }) +
    (o.plain
      ? ''
      : stencil('REGOLITH', W / 2, H * 0.88, 9, s.key) + label(DECK[deck].name.toUpperCase(), W / 2, H * 0.88 + 4.4, 2, s.key)) +
    `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" fill="none" stroke="${s.key}" stroke-width="0.5"/>`;
  return finish({ defs: screens(s) + s.defs.join(''), body: rect(area, s.paper) + body }, area, id, o);
}
