/**
 * AI self-play card benchmark: card usage, win rates, pick rates, and draft timing/context.
 *
 * Plays 2-player games through the card audit (packages/engine/test/audit.ts), so every step is
 * checked as in the audit, and stops on the first game with an anomaly. Unlike the audit's games,
 * no skills are dealt: every card is drafted by the AI.
 *
 * "Used" is the audit's "fired": each use of an activated skill or choice, each Tactic played, each
 * trigger of a triggered skill, each battle in which a combat skill changed a roll or total, and
 * each move, deploy or conquer a movement, deployment or conquer skill could have changed.
 * Win rates over a handful of games are noise: check "Taken" before reading anything into them.
 *
 *   npm run selfplay:cards -- [games=50] [mode=community|original] [level=1]
 */
import type { AiLevel } from '../packages/ai/src';
import type { CardDef, GameMode, GameState, PlayerId } from '../packages/engine/src';
import { auditGame, cardTaken, modeCards } from '../packages/engine/test/audit';

const [argGames = '50', argMode = 'community', argLevel = '1'] = process.argv.slice(2);
const numGames = Number(argGames);
const mode = argMode as GameMode;
const level = Number(argLevel) as AiLevel;

interface CardStats {
  card: CardDef;
  taken: number;
  played: number;
  turnsActive: number;
  gamesPresent: number;
  wins: number;
  losses: number;
  /** The drafting player's position at each pick. */
  picks: { turn: number; cubesLeft: number; dominance: number; research: number; standing: 'leading' | 'tied' | 'behind' }[];
}

const stats = new Map<string, CardStats>(
  modeCards(mode).map((card) => [card.id, { card, taken: 0, played: 0, turnsActive: 0, gamesPresent: 0, wins: 0, losses: 0, picks: [] }]),
);

/** Where `p` stands against the other player: fewer cubes left is ahead. */
function standing(s: GameState, p: PlayerId): CardStats['picks'][number]['standing'] {
  const mine = s.players[p].cubesLeft;
  const foe = s.players.find((o) => o.id !== p)!.cubesLeft;
  return mine < foe ? 'leading' : mine > foe ? 'behind' : 'tied';
}

console.log(`Starting self-play: ${numGames} ${mode} games with Level ${level} AI...`);

let completedGames = 0;
let totalTurns = 0;

for (let g = 0; g < numGames; g++) {
  /** Cards in play this game, and the cards each player held or took (credited with the result). */
  const inGame = new Set<string>();
  const credited = new Map<PlayerId, Set<string>>([[0, new Set()], [1, new Set()]]);
  let last: GameState | undefined;

  const result = auditGame(
    { mode, players: 2, levels: [level, level], seed: 6000 + g },
    {
      onStep: ({ before, action, after, fired }) => {
        last = after;
        const taken = cardTaken(before, action, after);
        const st = taken && stats.get(taken.id);
        if (taken && st) {
          st.taken++;
          inGame.add(taken.id);
          credited.get(taken.p)!.add(taken.id);
          const pl = before.players[taken.p];
          st.picks.push({ turn: Math.max(1, before.turn.number), cubesLeft: pl.cubesLeft, dominance: pl.dominance, research: pl.research, standing: standing(before, taken.p) });
        }
        for (const id of fired) {
          stats.get(id)!.played++;
          inGame.add(id);
        }
        for (const p of after.players) for (const sk of p.skills) credited.get(p.id)!.add(sk.id);
      },
    },
  );

  if (result.anomalies.length) {
    for (const a of result.anomalies) console.log(`\nGame ${g}, step ${a.step}${a.card ? ` [${a.card}]` : ''}: ${a.message}\n  ${a.context.join('\n  ')}`);
    process.exit(1);
  }
  for (const [id, c] of result.coverage) {
    stats.get(id)!.turnsActive += c.heldTurns;
    if (c.heldTurns) inGame.add(id);
  }

  if (result.finished && last) {
    completedGames++;
    totalTurns += last.turn.number;
    if (last.winner !== null) {
      for (const [p, ids] of credited) {
        for (const id of ids) {
          const st = stats.get(id);
          if (!st) continue;
          if (p === last.winner) st.wins++;
          else st.losses++;
        }
      }
    }
    for (const id of inGame) stats.get(id)!.gamesPresent++;
  }

  process.stdout.write(`\rPlayed game ${g + 1}/${numGames}...`);
}

console.log(`\n\nCompleted ${completedGames}/${numGames} games, avg ${(totalTurns / Math.max(1, completedGames)).toFixed(1)} turns/game.\n`);

const average = (xs: number[]) => xs.reduce((sum, v) => sum + v, 0) / Math.max(1, xs.length);
const percent = (n: number, of: number) => `${((n / Math.max(1, of)) * 100).toFixed(1)}%`;

// ---------------------------------------------------------------------------
// Report 1: Performance & Win Rate

console.log('=== CARD PERFORMANCE & WIN RATE REPORT ===');
console.log(
  'Name'.padEnd(20) +
    'Type'.padEnd(10) +
    'Taken'.padStart(7) +
    'Used'.padStart(8) +
    'Wins'.padStart(6) +
    'Losses'.padStart(8) +
    'Win Rate'.padStart(10) +
    'Pick Rate'.padStart(11) +
    'Active Turns'.padStart(14),
);
console.log('-'.repeat(94));

// By win rate among cards drafted at least once, then by wins; undecided cards last, by times taken.
const winRate = (st: CardStats) => (st.wins + st.losses ? st.wins / (st.wins + st.losses) : -1);
const byWinRate = [...stats.values()].sort((a, b) => {
  if (winRate(a) < 0 && winRate(b) < 0) return b.taken - a.taken;
  if (Math.abs(winRate(b) - winRate(a)) > 0.001) return winRate(b) - winRate(a);
  return b.wins - a.wins;
});

let usedCount = 0;
for (const st of byWinRate) {
  if (st.taken || st.turnsActive || st.played) usedCount++;
  const decided = st.wins + st.losses;
  console.log(
    st.card.name.padEnd(20) +
      (st.card.category ?? 'card').padEnd(10) +
      String(st.taken).padStart(7) +
      String(st.played).padStart(8) +
      String(st.wins).padStart(6) +
      String(st.losses).padStart(8) +
      (decided ? percent(st.wins, decided) : '-').padStart(10) +
      percent(st.gamesPresent, completedGames).padStart(11) +
      String(st.turnsActive).padStart(14),
  );
}
console.log('-'.repeat(94));
console.log(`Cards drafted/used: ${usedCount}/${stats.size} (${percent(usedCount, stats.size)})\n`);

// ---------------------------------------------------------------------------
// Report 2: When Cards Are Chosen (Timing & Draft Context)

console.log('=== WHEN CARDS ARE CHOSEN (TIMING & BOARD STATE CONTEXT) ===');
console.log(
  'Name'.padEnd(20) +
    'Type'.padEnd(10) +
    'Taken'.padStart(6) +
    'Avg Turn'.padStart(10) +
    'Phase'.padStart(11) +
    'Avg Cubes'.padStart(11) +
    'Avg Dom'.padStart(9) +
    'Avg Res'.padStart(9) +
    'Leading %'.padStart(11) +
    'Behind %'.padStart(10),
);
console.log('-'.repeat(107));

const avgTurn = (st: CardStats) => average(st.picks.map((x) => x.turn));
for (const st of [...stats.values()].filter((x) => x.taken).sort((a, b) => avgTurn(a) - avgTurn(b))) {
  const turn = avgTurn(st);
  const phase = turn >= 9 ? 'Endgame' : turn >= 4 ? 'Mid-game' : 'Opening';
  const share = (standing: string) => `${((st.picks.filter((x) => x.standing === standing).length / st.picks.length) * 100).toFixed(0)}%`;
  console.log(
    st.card.name.padEnd(20) +
      (st.card.category ?? 'card').padEnd(10) +
      String(st.taken).padStart(6) +
      `Turn ${turn.toFixed(1)}`.padStart(10) +
      phase.padStart(11) +
      `${average(st.picks.map((x) => x.cubesLeft)).toFixed(1)} left`.padStart(11) +
      average(st.picks.map((x) => x.dominance)).toFixed(1).padStart(9) +
      average(st.picks.map((x) => x.research)).toFixed(1).padStart(9) +
      share('leading').padStart(11) +
      share('behind').padStart(10),
  );
}
console.log('-'.repeat(107));
