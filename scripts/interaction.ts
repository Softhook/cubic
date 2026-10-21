/**
 * Player interaction and card impact over 2-player AI self-play (docs/HEX.md, *Interaction*).
 *
 *   npm run interaction -- [games=200] [levels=4,4] [setups=...] [jobs=1]
 *
 * A setup is mode@map, the mode with `-nocards` for its rules without cards: the default compares
 * basic, original, community and prototyping on Alpha Sector, prototyping on Alpha Sector (hex), and
 * prototyping with no cards on both. Seats alternate between games and each pair of games shares a map
 * seed. Prints one markdown table of averages, a column per setup.
 *
 * Each player's value is the AI's evaluation of their own position (valueOf in evaluate.ts, in cube
 * points), scored after every action and credited to the player who acted and to what they did. The
 * interaction ratio is how much a player's value moves in the opponent's actions over how much it
 * moves in their own: near 0, each player plays their own game.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chooseAction, chooseCombatResponse, type AiLevel } from '../packages/ai/src';
import { valueOf } from '../packages/ai/src/evaluate';
import {
  actor,
  adjacent,
  apply,
  cellOf,
  createGame,
  distance,
  mulberry32,
  orbitals,
  RULESETS,
  shipsOnBoard,
  type Action,
  type GameMode,
  type GameState,
} from '../packages/engine/src';

const SETUPS = [
  'basic@alpha-sector',
  'original@alpha-sector',
  'community@alpha-sector',
  'prototyping-nocards@alpha-sector',
  'prototyping@alpha-sector',
  'prototyping-nocards@alpha-hex',
  'prototyping@alpha-hex',
];
const [games = '200', levelList = '4,4', setupList = SETUPS.join(','), jobs = '1'] = process.argv.slice(2);
const levels = levelList.split(',').map(Number) as AiLevel[];
const setups = setupList.split(',');
/** Set for a worker process: "setup from to". */
const shard = process.env.INTERACTION_SHARD;

const CATS = ['attack', 'move', 'conquer', 'fleet', 'card', 'missile', 'other'] as const;
type Cat = (typeof CATS)[number];
const BY_TYPE: Partial<Record<Action['type'], Cat>> = {
  move: 'move',
  carry: 'move',
  swap: 'move',
  attack: 'attack',
  freeAttack: 'attack',
  power: 'attack',
  deploy: 'fleet',
  reconfigure: 'fleet',
  change: 'fleet',
  freeReconfigure: 'fleet',
  conquer: 'conquer',
  missile: 'missile',
  endTurn: 'other',
  setupKeep: 'other',
  setupReroll: 'other',
  placeStart: 'other',
  placeShip: 'other',
};
/** Follow-ups of a battle, credited to whatever started it. */
const FOLLOW = new Set<Action['type']>(['resolveCombat', 'advance', 'infamy']);
/** Every other action is research, a card pick, a skill or a tactic. */
const category = (x: Action): Cat => BY_TYPE[x.type] ?? 'card';

type Tally = Record<Cat, number>;
const tally = (): Tally => Object.fromEntries(CATS.map((c) => [c, 0])) as Tally;

interface Game {
  winnerSide: number | null;
  playerTurns: number;
  battles: number;
  /** |Δ| of each player's value in their own actions, and in the opponent's; losses in the opponent's. */
  bySelf: Tally;
  byFoe: Tally;
  harm: Tally;
  gain: Tally;
  /** Player-turns starting with the fleets at most 2 spaces apart, and the closest distance summed. */
  contact: number;
  closest: number;
  /** Player-turns starting with both players' ships in one orbit, and with the mover's orbit adding up but an enemy in it. */
  sharedOrbit: number;
  blocked: number;
  moves: number;
  contactMoves: number;
  conquers: number;
  /** Conquests of a planet the opponent had a ship orbiting in the last 2 player-turns. */
  contestedConquers: number;
  cardActions: number;
}

function play(setup: string, g: number): Game {
  const [modeName, map] = setup.split('@');
  const mode = modeName.replace(/-nocards$/, '') as GameMode;
  const swap = g % 2 === 1;
  const side = (p: number) => (swap ? 1 - p : p);
  let s: GameState = createGame({
    players: [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', ai: true })),
    seed: 5000 + Math.floor(g / 2),
    mode,
    mapId: map,
  });
  const random = mulberry32(g * 7919 + 13);
  const r: Game = {
    winnerSide: null,
    playerTurns: 0,
    battles: 0,
    bySelf: tally(),
    byFoe: tally(),
    harm: tally(),
    gain: tally(),
    contact: 0,
    closest: 0,
    sharedOrbit: 0,
    blocked: 0,
    moves: 0,
    contactMoves: 0,
    conquers: 0,
    contestedConquers: 0,
    cardActions: 0,
  };
  const at = (d: { r: number; c: number }) => shipsOnBoard(s).find((x) => cellOf(x)!.r === d.r && cellOf(x)!.c === d.c);
  // Player-turn at which each player last had a ship in each planet's orbit.
  const inOrbit = s.board.planets.map(() => [-9, -9]);
  let turnKey = '';
  let chain: Cat = 'other';
  let values: number[] | null = null; // from the first player-turn on
  for (let step = 0; s.phase !== 'over' && step < 4000; step++) {
    const key = `${s.turn.number}:${s.turn.player}`;
    if (key !== turnKey && !s.pending.length && s.turn.phase === 'actions') {
      turnKey = key;
      r.playerTurns++;
      values ??= [0, 1].map((p) => valueOf(s, p));
      const p = s.turn.player;
      const ships = shipsOnBoard(s);
      let closest = 12;
      for (const x of ships)
        for (const y of ships) if (x.owner === p && y.owner !== p) closest = Math.min(closest, distance(cellOf(x)!, cellOf(y)!, s.board));
      r.closest += closest;
      if (closest <= 2) r.contact++;
      let shared = false;
      for (const pl of s.board.planets) {
        const here = orbitals(s.board, pl)
          .map(at)
          .filter((d) => !!d);
        for (const q of [0, 1]) if (here.some((d) => d.owner === q)) inOrbit[pl.id][q] = r.playerTurns;
        const foe = here.some((d) => d.owner !== p);
        if (foe && here.some((d) => d.owner === p)) shared = true;
        const sum = here.filter((d) => d.owner === p).reduce((n, d) => n + d.value, 0);
        if (foe && sum === pl.number && pl.cubes.length < pl.capacity) r.blocked++;
      }
      if (shared) r.sharedOrbit++;
    }
    let action: Action | null = null;
    if (s.pending[0]?.kind === 'combat') {
      for (const p of s.players) action ??= chooseCombatResponse(s, p.id, { level: levels[side(p.id)], random });
    }
    action ??= chooseAction(s, { level: levels[side(actor(s))], random });
    if (!action) throw new Error(`${setup} game ${g}: no action at step ${step}`);
    const who = actor(s);
    const cat: Cat = FOLLOW.has(action.type) ? chain : category(action);
    if (!FOLLOW.has(action.type) && who === s.turn.player) chain = cat;
    if (values && cat === 'card') r.cardActions++;
    if (action.type === 'move' || action.type === 'carry') {
      r.moves++;
      if (adjacent(s.board, action.to).some((c) => at(c) && at(c)!.owner !== who)) r.contactMoves++;
    }
    if (action.type === 'conquer') {
      r.conquers++;
      if (r.playerTurns - inOrbit[action.planet][1 - who] <= 2) r.contestedConquers++;
    }
    s = apply(s, action);
    if (!values || s.phase === 'over') continue;
    const next = [0, 1].map((p) => valueOf(s, p));
    for (const p of [0, 1]) {
      const d = next[p] - values[p];
      if (who === p) {
        r.bySelf[cat] += Math.abs(d);
        if (d > 0) r.gain[cat] += d;
      } else {
        r.byFoe[cat] += Math.abs(d);
        if (d < 0) r.harm[cat] -= d;
      }
    }
    values = next;
  }
  if (s.phase === 'over') r.winnerSide = side(s.winner!);
  r.battles = s.players.reduce((n, p) => n + p.stats!.battlesWon + p.stats!.battlesLost, 0) / 2;
  return r;
}

/** Plays games from-to of one setup, with that setup's cards switched off if it says so. */
function playRange(setup: string, from: number, to: number): Game[] {
  const mode = RULESETS[setup.split('@')[0].replace(/-nocards$/, '') as GameMode];
  const cards = mode.cards;
  if (setup.includes('-nocards@')) mode.cards = null;
  try {
    return Array.from({ length: to - from }, (_, i) => play(setup, from + i));
  } finally {
    mode.cards = cards;
  }
}

/** Plays every setup's games in `count` worker processes (this script again, each with a shard). */
async function playInParallel(count: number): Promise<Map<string, Game[]>> {
  const n = Number(games);
  const size = Math.max(2, Math.ceil(n / count / 2) * 2);
  const queue = setups.flatMap((setup) =>
    Array.from({ length: Math.ceil(n / size) }, (_, k) => [setup, k * size, Math.min(n, (k + 1) * size)] as const),
  );
  const total = queue.length;
  const out = new Map(setups.map((x) => [x, [] as Game[]]));
  let done = 0;
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [setup, from, to] = job;
      const result = await new Promise<Game[]>((resolve, reject) => {
        // Under vite-node, argv[1] is vite-node itself and the script's path is left out.
        const child = spawn(process.execPath, [process.argv[1], fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
          env: { ...process.env, INTERACTION_SHARD: `${setup} ${from} ${to}` },
          stdio: ['ignore', 'pipe', 'inherit'],
        });
        let text = '';
        child.stdout.on('data', (d) => (text += d));
        child.on('error', reject);
        child.on('exit', (code) =>
          code
            ? reject(new Error(`${setup} games ${from}-${to} failed (exit ${code})`))
            : resolve(JSON.parse(text.trim().split('\n').pop()!)),
        );
      });
      out.get(setup)!.push(...result);
      process.stderr.write(`\r${++done}/${total} shards`);
    }
  };
  await Promise.all(Array.from({ length: count }, worker));
  process.stderr.write('\n');
  return out;
}

const sum = (gs: Game[], f: (g: Game) => number) => gs.reduce((n, g) => n + f(g), 0);
const total = (t: Tally) => CATS.reduce((n, c) => n + t[c], 0);
const pct = (x: number) => `${Math.round(100 * x)}%`;

function report(results: Map<string, Game[]>) {
  const rows: [string, (gs: Game[]) => string][] = [
    ['Games finished', (gs) => `${gs.length}`],
    ['Player-turns', (gs) => (sum(gs, (g) => g.playerTurns) / gs.length).toFixed(1)],
    ['Battles', (gs) => (sum(gs, (g) => g.battles) / gs.length).toFixed(1)],
    [
      'Interaction ratio',
      (gs) => {
        const xs = gs.map((g) => total(g.byFoe) / Math.max(1, total(g.bySelf)));
        const m = xs.reduce((a, b) => a + b, 0) / xs.length;
        const se = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1) / xs.length);
        return `${m.toFixed(2)} ±${(1.96 * se).toFixed(2)}`;
      },
    ],
    ['Harm per player-turn (cubes)', (gs) => (sum(gs, (g) => total(g.harm)) / sum(gs, (g) => g.playerTurns) / 1000).toFixed(2)],
    ...(['attack', 'move', 'card', 'missile'] as const).map(
      (c) =>
        [
          `Harm from ${c === 'card' ? 'cards' : `${c}s`}`,
          (gs: Game[]) => pct(sum(gs, (g) => g.harm[c]) / sum(gs, (g) => total(g.harm))),
        ] as [string, (gs: Game[]) => string],
    ),
    ['Own gains from cards', (gs) => pct(sum(gs, (g) => g.gain.card) / sum(gs, (g) => total(g.gain)))],
    ['Card actions', (gs) => (sum(gs, (g) => g.cardActions) / gs.length).toFixed(1)],
    ['Turns with fleets ≤ 2 apart', (gs) => pct(sum(gs, (g) => g.contact) / sum(gs, (g) => g.playerTurns))],
    ['Closest enemy ship', (gs) => (sum(gs, (g) => g.closest) / sum(gs, (g) => g.playerTurns)).toFixed(1)],
    ['Moves ending next to an enemy', (gs) => pct(sum(gs, (g) => g.contactMoves) / sum(gs, (g) => g.moves))],
    ['Turns with a shared orbit', (gs) => pct(sum(gs, (g) => g.sharedOrbit) / sum(gs, (g) => g.playerTurns))],
    ['Conquests blocked per game', (gs) => (sum(gs, (g) => g.blocked) / gs.length).toFixed(2)],
    ['Conquests the opponent contested', (gs) => pct(sum(gs, (g) => g.contestedConquers) / sum(gs, (g) => g.conquers))],
  ];
  if (levels[0] !== levels[1])
    rows.push([
      `Level ${levels[1]} wins`,
      (gs) => {
        const p = sum(gs, (g) => g.winnerSide!) / gs.length;
        return `${pct(p)} ±${Math.round(196 * Math.sqrt((p * (1 - p)) / gs.length))}`;
      },
    ]);
  const finished = setups.map((x) => results.get(x)!.filter((g) => g.winnerSide !== null));
  console.log(`\nLevels ${levels.join(' vs ')}, ${games} games per setup\n`);
  console.log(`| | ${setups.join(' | ')} |`);
  console.log(`|---|${setups.map(() => '--:').join('|')}|`);
  for (const [name, f] of rows) console.log(`| ${name} | ${finished.map(f).join(' | ')} |`);
}

if (shard) {
  const [setup, from, to] = shard.split(' ');
  console.log(JSON.stringify(playRange(setup, Number(from), Number(to))));
} else if (Number(jobs) > 1) {
  report(await playInParallel(Number(jobs)));
} else {
  report(new Map(setups.map((x) => [x, playRange(x, 0, Number(games))])));
}
