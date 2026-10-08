import { FONTS, type CardDeck, type CardFace, type Measure } from '@quantum/art';
import { EXPANSION, ORIGINAL_COMMAND, ORIGINAL_GAMBIT, SKILLS, TACTICS, card, effectOf, isOriginalCard, type CardDef } from '@quantum/engine';
import { blobToDataUrl } from '../files';

/** Every printed card, by deck, from the game's card data. */

export interface Deck {
  id: CardDeck;
  name: string;
  edition: 'community' | 'original';
  cards: CardFace[];
}

const faces = (deck: CardDeck, defs: CardDef[]): CardFace[] =>
  defs.map((c, i) => ({ id: c.id, name: c.name, subtitle: c.subtitle, text: c.text, category: c.category, deck, copies: c.count, index: i + 1, deckSize: defs.length }));

export const DECKS: Deck[] = [
  { id: 'skill', name: 'Skills', edition: 'community', cards: faces('skill', SKILLS) },
  { id: 'tactic', name: 'Tactics', edition: 'community', cards: faces('tactic', TACTICS) },
  { id: 'expansion', name: 'Expansion', edition: 'community', cards: faces('expansion', [EXPANSION]) },
  { id: 'command', name: 'Command', edition: 'original', cards: faces('command', ORIGINAL_COMMAND) },
  { id: 'gambit', name: 'Gambit', edition: 'original', cards: faces('gambit', ORIGINAL_GAMBIT) },
];

const byId = new Map(DECKS.flatMap((d) => d.cards.map((c) => [c.id, c])));

/** A card's printed face, by card id. */
export function faceOf(id: string): CardFace {
  const face = byId.get(id);
  if (!face) throw new Error(`Unknown card ${id}`);
  return face;
}

/** A Community card that redesigns a 2013 card (its `classic` in data/cards.yaml). */
export interface Redesign {
  classic: CardFace;
  community: CardFace;
  /** Plays by the same rules in this game (shared effect): only the wording changed. */
  sameRules: boolean;
  /** A new name for the same idea: Cerebral → Composed, Eager → Industrious. */
  renamed: boolean;
}

const cardsOf = (edition: Deck['edition']) => DECKS.filter((d) => d.edition === edition).flatMap((d) => d.cards);

/** The cards by lineage: Community redesigns of 2013 cards, and each edition's own designs. */
export const LINEAGE = (() => {
  const redesigns: Redesign[] = [];
  const communityOnly: CardFace[] = [];
  for (const c of cardsOf('community')) {
    const from = card(c.id).classic;
    if (!from) {
      communityOnly.push(c);
      continue;
    }
    const classic = faceOf(from);
    redesigns.push({ classic, community: c, sameRules: effectOf(from) === effectOf(c.id), renamed: classic.name !== c.name });
  }
  const redesigned = new Set(redesigns.map((r) => r.classic.id));
  return {
    redesigns,
    reworded: redesigns.filter((r) => !r.renamed && r.sameRules),
    reworked: redesigns.filter((r) => !r.renamed && !r.sameRules),
    renamed: redesigns.filter((r) => r.renamed),
    communityOnly,
    classicOnly: cardsOf('original').filter((c) => !redesigned.has(c.id)),
  };
})();

/** Where a card stands between the editions: what it redesigns, or what redesigned it (a classic card can have two heirs). */
export function lineageNote(face: CardFace): string {
  const how = (r: Redesign) => `${r.renamed ? 'renamed, ' : ''}${r.sameRules ? 'same rules' : 'rules changed'}`;
  const from = LINEAGE.redesigns.find((r) => r.community.id === face.id);
  if (from) return `Redesign of classic ${from.classic.name} (${how(from)})`;
  const heirs = LINEAGE.redesigns.filter((r) => r.classic.id === face.id);
  if (heirs.length) return `Redesigned as ${heirs.map((r) => `${r.community.name} (${how(r)})`).join(' and ')}`;
  return isOriginalCard(face.id) ? 'Classic only: not in the Community Edition' : 'Community original: new in the Community Edition';
}

/** The fonts cards are set in, as the page loads them (index.html). */
const FAMILIES = { title: ['900', 'Orbitron'], body: ['400', 'Inter'], bold: ['700', 'Inter'] } as const;

let ctx: CanvasRenderingContext2D | null = null;

/** Text width in mm, measured with the page's web fonts: the same ones embedded in the card images. */
export const measure: Measure = (text, size, font) => {
  ctx ??= document.createElement('canvas').getContext('2d')!;
  const [weight, family] = FAMILIES[font];
  ctx.font = `${weight} 100px ${family}, ${font === 'title' ? FONTS.title : FONTS.body}`;
  return (ctx.measureText(text).width / 100) * size;
};

let fontsReady: Promise<void> | null = null;

/** Resolves once the page has the card fonts, so `measure` measures with them (never rejects). */
export function cardFontsReady(): Promise<void> {
  fontsReady ??= Promise.all(Object.values(FAMILIES).map(([w, f]) => document.fonts.load(`${w} 10px ${f}`))).then(
    () => {},
    () => {},
  );
  return fontsReady;
}

let fontCss: Promise<string> | null = null;

/**
 * The card fonts as `@font-face` rules with the font files inlined. An SVG drawn as an image can't
 * reach the page's fonts, so exports carry their own. Empty when offline: cards then fall back to
 * system fonts.
 */
export function cardFontCss(): Promise<string> {
  fontCss ??= (async () => {
    try {
      await cardFontsReady();
      const css = await (await fetch('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;1,400&family=Orbitron:wght@900&display=block')).text();
      // Latin only: the card text needs nothing else, and each subset is another file.
      const blocks = [...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]*\})/g)].map((m) => m[1]);
      const files = new Map<string, Promise<string>>();
      const inline = (url: string) => {
        if (!files.has(url)) files.set(url, fetch(url).then((r) => r.blob()).then(blobToDataUrl));
        return files.get(url)!;
      };
      const out = await Promise.all(
        blocks.map(async (b) => {
          const url = /url\(([^)]+)\)/.exec(b)?.[1];
          return url ? b.replace(url, await inline(url)) : b;
        }),
      );
      return out.join('');
    } catch {
      return '';
    }
  })();
  return fontCss;
}
