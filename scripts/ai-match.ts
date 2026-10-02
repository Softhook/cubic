/**
 * AI benchmark: plays two AI levels against each other and reports wins and thinking time.
 *
 *   npm run ai:match -- <levelA> <levelB> [games=20] [mode=basic] [players=2]
 *
 * Seats alternate between games and each pair of games shares a map seed, so neither level
 * gets the better start. With more than 2 players, level A plays seat 0 and level B the rest.
 */
import { chooseAction, chooseMissile, type AiLevel } from '../packages/ai/src';
import { actor, apply, createGame, type Action, type GameMode, type GameState } from '../packages/engine/src';

const [a = '1', b = '3', games = '20', mode = 'basic', players = '2'] = process.argv.slice(2);
const levels = [Number(a), Number(b)] as AiLevel[];
const n = Number(games);
const seats = Number(players);

function seededRandom(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const wins = [0, 0];
let unfinished = 0;
let turns = 0;
const time = [0, 0];
const decisions = [0, 0];
const slowest = [0, 0];

for (let g = 0; g < n; g++) {
  const swap = seats === 2 && g % 2 === 1;
  // Which side (0 = level A, 1 = level B) plays seat p.
  const side = (p: number) => (seats === 2 ? (swap ? 1 - p : p) : p === 0 ? 0 : 1);
  let s: GameState = createGame({
    players: Array.from({ length: seats }, (_, i) => ({ name: `P${i}`, color: '#fff', ai: true })),
    seed: 5000 + Math.floor(g / 2),
    mode: mode as GameMode,
  });
  const random = seededRandom(g * 31 + 7);
  for (let step = 0; s.phase !== 'over' && step < 3000; step++) {
    let action: Action | null = null;
    if (s.pending[0]?.kind === 'combat') {
      for (const p of s.players) action ??= chooseMissile(s, p.id, { level: levels[side(p.id)], random });
    }
    const who = side(actor(s));
    const t = performance.now();
    action ??= chooseAction(s, { level: levels[who], random });
    const dt = performance.now() - t;
    time[who] += dt;
    decisions[who]++;
    slowest[who] = Math.max(slowest[who], dt);
    if (!action) throw new Error(`game ${g}: no action at step ${step}`);
    s = apply(s, action);
  }
  if (s.phase === 'over') {
    wins[side(s.winner!)]++;
    turns += s.turn.number;
  } else unfinished++;
  process.stdout.write(`\rgame ${g + 1}/${n}: L${levels[0]} ${wins[0]} – ${wins[1]} L${levels[1]}`);
}

console.log(`\n\n${mode}, ${seats} players, ${n} games${unfinished ? ` (${unfinished} unfinished)` : ''}, ${(turns / Math.max(1, n - unfinished)).toFixed(1)} turns on average`);
for (const i of [0, 1]) {
  const avg = time[i] / Math.max(1, decisions[i]);
  console.log(`  level ${levels[i]}: ${wins[i]} wins, ${avg.toFixed(0)} ms per decision, slowest ${slowest[i].toFixed(0)} ms`);
}
