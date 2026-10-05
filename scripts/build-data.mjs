// Converts the canonical YAML data in /data into JSON the engine can import.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url);
const out = new URL('packages/engine/src/data/', root);
mkdirSync(out, { recursive: true });

const cards = parse(readFileSync(new URL('data/cards.yaml', root), 'utf8'));
for (const [deck, list] of Object.entries(cards)) {
  for (const c of list) if (!c.category) throw new Error(`data/cards.yaml: ${deck} card ${c.id} has no category`);
}
writeFileSync(new URL('cards.json', out), JSON.stringify(cards, null, 2) + '\n');

const { maps } = parse(readFileSync(new URL('data/maps.yaml', root), 'utf8'));
for (const m of maps)
  if (m.wrap !== undefined && !['horizontal', 'vertical', 'both'].includes(m.wrap)) throw new Error(`data/maps.yaml: ${m.id} has wrap ${m.wrap}`);
const parsed = maps.map((m) => ({
  id: m.id,
  name: m.name,
  players: m.players,
  group: m.group,
  cubes: m.cubes,
  stats: m.stats,
  ...(m.wrap && { wrap: m.wrap }),
  layout: m.layout.map((row) => row.trim().split(/\s+/)),
}));
writeFileSync(new URL('maps.json', out), JSON.stringify(parsed, null, 2) + '\n');

console.log(
  `data: ${cards.skills.length} skills, ${cards.tactics.length} tactics, ` +
    `${cards.original_command.length} command, ${cards.original_gambit.length} gambit, ${parsed.length} maps`,
);
