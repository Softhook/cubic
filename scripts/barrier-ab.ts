/**
 * A/B for the Wisp's Barrier (Regolith): the same AI level on both sides, one of them never firing
 * barriers. Seats alternate, and each pair of games shares a seed.
 *   npx vite-node scripts/barrier-ab.ts -- [games=40] [level=3]
 */
import { chooseAction, chooseCombatResponse, type AiLevel } from '../packages/ai/src';
import { actor, apply, createGame, type Action, type GameState } from '../packages/engine/src';
import { players, seededRandom } from '../packages/engine/test/helpers';

const [games = '40', lvl = '3'] = process.argv.slice(2).filter((x) => x !== '--');
const level = Number(lvl) as AiLevel;

/** The state as the barrier-less side sees it: its Wisps' power already spent this turn. */
function noBarriers(s: GameState): GameState {
  if (s.phase !== 'play' || s.turn.player !== actor(s)) return s;
  const abilityUsed = { ...s.turn.abilityUsed };
  for (const d of s.dice) if (d.owner === s.turn.player && d.value === 6) abilityUsed[d.id] = true;
  // Cunning's second use too (it then counts as spent for that side's other ships as well, a small bias).
  const oncePerTurn = s.turn.oncePerTurn.includes('cunning') ? s.turn.oncePerTurn : [...s.turn.oncePerTurn, 'cunning' as const];
  return { ...s, turn: { ...s.turn, abilityUsed, oncePerTurn } };
}

let withWins = 0;
let finished = 0;
let turns = 0;
for (let g = 0; g < Number(games); g++) {
  // Seat 0 fires barriers in even games, seat 1 in odd ones.
  const firing = g % 2;
  let s = createGame({ players: players(2), seed: 700 + Math.floor(g / 2), mode: 'regolith' });
  const random = seededRandom(g * 7919 + 13);
  for (let step = 0; s.phase !== 'over' && step < 4000; step++) {
    let a: Action | null = null;
    if (s.pending[0]?.kind === 'combat') for (const p of s.players) a ??= chooseCombatResponse(s, p.id, { level, random });
    if (!a) {
      const who = actor(s);
      const chosen = chooseAction(who === firing ? s : noBarriers(s), { level, random });
      if (chosen?.type === 'power' && who !== firing && s.dice.find((d) => d.id === chosen.die)!.value === 6) throw new Error('fired');
      a = chosen;
    }
    if (!a) break;
    s = apply(s, a);
  }
  if (s.phase === 'over') {
    finished++;
    turns += s.turn.number;
    if (s.winner === firing) withWins++;
  }
  process.stdout.write(`\rgame ${g + 1}/${games}: with barriers ${withWins} – ${finished - withWins} without`);
}
const p = withWins / Math.max(1, finished);
const z = (p - 0.5) / Math.sqrt(0.25 / Math.max(1, finished));
console.log(
  `\nlevel ${level}: with barriers won ${(100 * p).toFixed(1)}% of ${finished} (z = ${z.toFixed(2)}), ${(turns / Math.max(1, finished)).toFixed(1)} turns`,
);
