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
const classicIds = new Set([...cards.original_command, ...cards.original_gambit].map((c) => c.id));
for (const c of [...cards.skills, ...cards.tactics, ...cards.expansion])
  if (c.classic !== undefined && !classicIds.has(c.classic))
    throw new Error(`data/cards.yaml: ${c.id} has classic ${c.classic}, not a 2013 card`);
writeFileSync(new URL('cards.json', out), JSON.stringify(cards, null, 2) + '\n');

// Regolith's decks: each card names the Community card it started as (`from`), and `status` agrees with
// how far it has moved. Built into the mode's own folder, which uses nothing else of the engine's data.
const regolith = parse(readFileSync(new URL('data/regolith.yaml', root), 'utf8'));
const community = new Map([...cards.skills, ...cards.tactics, ...cards.expansion].map((c) => [c.id, c]));
const regolithIds = new Set();
for (const [deck, list] of Object.entries(regolith)) {
  for (const c of list) {
    const where = `data/regolith.yaml: ${deck} card ${c.id}`;
    if (!c.id.startsWith('r-')) throw new Error(`${where}: ids start with r-`);
    if (regolithIds.has(c.id)) throw new Error(`${where} is listed twice`);
    regolithIds.add(c.id);
    for (const field of ['name', 'subtitle', 'text', 'category', 'count', 'status', 'effect'])
      if (c[field] === undefined) throw new Error(`${where} has no ${field}`);
    const from = c.from === undefined ? undefined : community.get(c.from);
    if (c.from !== undefined && !from) throw new Error(`${where} is from ${c.from}, not a Community card`);
    const fromEffect = from && (from.effect ?? from.id);
    const status = !from ? 'new' : c.effect !== fromEffect ? 'reworked' : c.name !== from.name ? 'renamed' : 'community';
    if (c.status !== status) throw new Error(`${where} has status ${c.status}, but its name and effect make it ${status}`);
    if (status !== 'new' && status !== 'reworked' && c.category !== from.category)
      throw new Error(`${where}: same action as ${from.id}, so the same category (${from.category})`);
  }
}
writeFileSync(new URL('packages/engine/src/regolith/cards.json', root), JSON.stringify(regolith, null, 2) + '\n');

const { maps } = parse(readFileSync(new URL('data/maps.yaml', root), 'utf8'));
for (const m of maps)
  if (m.wrap !== undefined && !['horizontal', 'vertical', 'both'].includes(m.wrap))
    throw new Error(`data/maps.yaml: ${m.id} has wrap ${m.wrap}`);
for (const m of maps) {
  if (m.grid !== undefined && m.grid !== 'hex') throw new Error(`data/maps.yaml: ${m.id} has grid ${m.grid}`);
  if (m.grid && m.wrap) throw new Error(`data/maps.yaml: ${m.id}: hex maps don't wrap`);
  if ((m.grid || m.world !== undefined) && !(m.grid && ['phobos', 'deimos', 'mars'].includes(m.world)))
    throw new Error(`data/maps.yaml: ${m.id} has world ${m.world}: every hex map has one, Phobos, Deimos or Mars, and only they do`);
}
const parsed = maps.map((m) => ({
  id: m.id,
  name: m.name,
  players: m.players,
  group: m.group,
  cubes: m.cubes,
  stats: m.stats,
  ...(m.wrap && { wrap: m.wrap }),
  ...(m.grid && { grid: m.grid }),
  ...(m.world && { world: m.world }),
  layout: m.layout.map((row) => row.trim().split(/\s+/)),
}));
writeFileSync(new URL('maps.json', out), JSON.stringify(parsed, null, 2) + '\n');

console.log(
  `data: ${cards.skills.length} skills, ${cards.tactics.length} tactics, ` +
    `${cards.original_command.length} command, ${cards.original_gambit.length} gambit, ${regolithIds.size} regolith, ${parsed.length} maps`,
);
