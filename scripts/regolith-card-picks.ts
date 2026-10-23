/**
 * Builds the Regolith Card Picks page (docs/regolith/REGOLITH.md §3): every Community card in Regolith's deck
 * with the name and art candidates from docs/regolith/card-ideas.yaml, its rules text in Regolith's words,
 * and its Community face for reference. The page is published as an Artifact, where picks are saved.
 *   npm run regolith:picks -- [out=test-results/regolith-card-picks.html]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse } from 'yaml';
import { cardSvg, type CardDeck } from '../packages/art/src';
import { EXPANSION, SKILLS, TACTICS, reword, type CardDef } from '../packages/engine/src';
import { REGOLITH_WORDS } from '../packages/engine/src/regolith/words';

interface Ideas {
  names: { name: string; why: string }[];
  art: { title: string; brief: string }[];
}

const [out = 'test-results/regolith-card-picks.html'] = process.argv.slice(2);
const root = new URL('..', import.meta.url);
const ideas: Record<string, Record<string, Ideas>> = parse(readFileSync(new URL('docs/regolith/card-ideas.yaml', root), 'utf8'));
const KEYS = ['a', 'b', 'c'];

// Ingenious ("conquer from the corners") isn't dealt on hexes, so it isn't in Regolith's deck.
const DECKS: { deck: CardDeck; name: string; word: string; ideas: Record<string, Ideas>; cards: CardDef[] }[] = [
  { deck: 'skill', name: 'Skills', word: 'Skill', ideas: ideas.skills, cards: SKILLS.filter((c) => c.id !== 'ingenious') },
  { deck: 'tactic', name: 'Tactics', word: 'Tactic', ideas: ideas.tactics, cards: TACTICS },
  { deck: 'expansion', name: 'Expansion', word: 'Expansion', ideas: ideas.expansion, cards: [EXPANSION] },
];

const cards = DECKS.flatMap((d) =>
  d.cards.map((c, i) => {
    const idea = d.ideas[c.id];
    if (!idea || idea.names.length !== 3 || idea.art.length !== 3)
      throw new Error(`card-ideas.yaml: ${c.id} needs three names and three art briefs`);
    const face = {
      id: c.id,
      name: c.name,
      subtitle: c.subtitle,
      text: c.text,
      category: c.category,
      deck: d.deck,
      copies: c.count,
      index: i + 1,
      deckSize: d.cards.length,
    };
    return {
      id: c.id,
      deck: d.name,
      deckWord: d.word,
      category: c.category,
      index: i + 1,
      deckSize: d.cards.length,
      copies: c.count,
      was: c.name,
      text: reword(REGOLITH_WORDS, c.text),
      names: idea.names.map((n, k) => ({ key: KEYS[k], ...n })),
      art: idea.art.map((a, k) => ({ key: KEYS[k], ...a })),
      svg: cardSvg(face, { rounded: true }),
    };
  }),
);
const extra = Object.values(ideas)
  .flatMap((deck) => Object.keys(deck))
  .filter((id) => !cards.some((c) => c.id === id));
if (extra.length) throw new Error(`card-ideas.yaml: no such card in Regolith's deck: ${extra.join(', ')}`);

const template = readFileSync(new URL('scripts/regolith-card-picks.html', root), 'utf8');
const html = template.replace('/*DATA*/', () => JSON.stringify(cards).replace(/<\//g, '<\\/'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}: ${cards.length} cards, ${(html.length / 1e6).toFixed(1)} MB`);
