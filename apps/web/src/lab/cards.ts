import { FONTS, type CardDeck, type CardFace, type Measure } from '@quantum/art';
import { EXPANSION, ORIGINAL_COMMAND, ORIGINAL_GAMBIT, SKILLS, TACTICS, type CardDef } from '@quantum/engine';
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

let fontCss: Promise<string> | null = null;

/**
 * The card fonts as `@font-face` rules with the font files inlined. An SVG drawn as an image can't
 * reach the page's fonts, so exports carry their own. Empty when offline: cards then fall back to
 * system fonts.
 */
export function cardFontCss(): Promise<string> {
  fontCss ??= (async () => {
    try {
      await Promise.all(Object.values(FAMILIES).map(([w, f]) => document.fonts.load(`${w} 10px ${f}`)));
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
