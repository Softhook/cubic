/**
 * How the AI uses the Wisp's Barrier (Regolith): plays AI self-play games and, for every barrier fired,
 * records what it changed: enemy and own reach, enemy attacks on the AI's ships, perimeter spaces held,
 * enemy claims denied, and the evaluation's view of it.
 *   npx vite-node scripts/barrier-usage.ts -- [games=20] [levels=1,2,3,4] [players=2]
 */
import { evaluate } from '../packages/ai/src/evaluate';
import {
  actor,
  apply,
  cellOf,
  conquerCheck,
  createGame,
  distance,
  legalActions,
  orbitedPlanets,
  shipReach,
  shipsByIndex,
  shipsOnBoard,
  type Action,
  type GameState,
  type PlayerId,
} from '../packages/engine/src';
import { aiAction, players, seededRandom } from '../packages/engine/test/helpers';

const [games = '20', levelList = '1,2,3,4', seats = '2'] = process.argv.slice(2).filter((x) => x !== '--');

interface Fired {
  level: number;
  turn: number;
  enemyReach: number;
  ownReach: number;
  /** Enemy attacks on my ships (pairs), before minus after. */
  threatsCut: number;
  /** My attacks on enemy ships, before minus after. */
  attacksLost: number;
  perimeter: 'none' | 'mine' | 'enemy' | 'empty' | 'mixed';
  /** An enemy could claim that objective before (conquerCheck ok) and can't after. */
  claimDenied: boolean;
  /** An enemy's claim sum was within one ship of a planet whose perimeter it is on. */
  nearEnemyClaim: boolean;
  nearestEnemy: number;
  evalDelta: number;
}

function reachTotals(s: GameState, me: PlayerId) {
  const at = shipsByIndex(s);
  let enemy = 0;
  let own = 0;
  let threats = 0;
  let attacks = 0;
  for (const d of shipsOnBoard(s)) {
    const r = shipReach(s, d, at);
    if (d.owner === me) {
      own += r.count;
      attacks += r.attacks.length;
    } else {
      enemy += r.count;
      threats += r.attacks.filter((x) => x.owner === me).length;
    }
  }
  return { enemy, own, threats, attacks };
}

function classify(s: GameState, a: Extract<Action, { type: 'power' }>, level: number): Fired {
  const me = actor(s);
  const after = apply(s, a);
  const to = a.to!;
  const b = reachTotals(s, me);
  const x = reachTotals(after, me);
  const planets = orbitedPlanets(s.board, to);
  const kinds = new Set(planets.map((p) => (p.cubes.length === 0 ? 'empty' : p.cubes.includes(me) ? 'mine' : 'enemy')));
  const perimeter = planets.length === 0 ? 'none' : kinds.size > 1 ? 'mixed' : ([...kinds][0] as Fired['perimeter']);
  const enemies = s.players.filter((p) => p.id !== me).map((p) => p.id);
  let claimDenied = false;
  let nearEnemyClaim = false;
  for (const p of planets)
    for (const e of enemies) {
      const before = conquerCheck(s, e, p.id);
      if (before.ok && !conquerCheck(after, e, p.id).ok) claimDenied = true;
      if (before.ships.length && Math.abs(before.target - before.sum) <= 6) nearEnemyClaim = true;
    }
  const enemyCells = shipsOnBoard(s)
    .filter((d) => d.owner !== me)
    .map((d) => cellOf(d)!);
  return {
    level,
    turn: s.turn.number,
    enemyReach: b.enemy - x.enemy,
    ownReach: b.own - x.own,
    threatsCut: b.threats - x.threats,
    attacksLost: b.attacks - x.attacks,
    perimeter,
    claimDenied,
    nearEnemyClaim,
    nearestEnemy: Math.min(...enemyCells.map((c) => distance(c, to, s.board))),
    evalDelta: Math.round(evaluate(after, me) - evaluate(s, me)),
  };
}

const n = Number(games);
const count = Number(seats);
for (const level of levelList.split(',').map(Number)) {
  const fired: Fired[] = [];
  let offeredTurns = 0;
  let usedTurns = 0;
  let turnsTotal = 0;
  let finished = 0;
  const endBarriers: number[] = [];
  const winnerBarriers = [0, 0];
  for (let g = 0; g < n; g++) {
    let s = createGame({ players: players(count), seed: 300 + g, mode: 'regolith' });
    const random = seededRandom(g * 7919 + 13);
    const levels = Array.from({ length: count }, () => level) as never;
    let offeredKey = '';
    const usedKeys = new Set<string>();
    for (let step = 0; s.phase !== 'over' && step < 4000; step++) {
      const key = `${s.turn.number}`;
      if (s.phase === 'play' && !s.pending.length && s.turn.phase === 'actions' && offeredKey !== key) {
        if (legalActions(s).some((a) => a.type === 'power' && s.dice.find((d) => d.id === a.die)!.value === 6)) {
          offeredKey = key;
          offeredTurns++;
        }
      }
      const a = aiAction(s, levels, random, 1);
      if (!a) break;
      if (a.type === 'power' && s.dice.find((d) => d.id === a.die)!.value === 6) {
        fired.push(classify(s, a, level));
        if (!usedKeys.has(key)) {
          usedKeys.add(key);
          usedTurns++;
        }
      }
      s = apply(s, a);
    }
    turnsTotal += s.turn.number;
    if (s.phase === 'over') {
      finished++;
      const byWinner = (s.barriers ?? []).filter((b) => b.owner === s.winner).length;
      winnerBarriers[0] += byWinner;
      winnerBarriers[1] += (s.barriers ?? []).length - byWinner;
    }
    endBarriers.push((s.barriers ?? []).length);
  }
  const pct = (k: number) => `${Math.round((100 * k) / Math.max(1, fired.length))}%`;
  const avg = (f: (x: Fired) => number) => (fired.reduce((t, x) => t + f(x), 0) / Math.max(1, fired.length)).toFixed(2);
  const perims = ['none', 'empty', 'mine', 'enemy', 'mixed'].map((k) => `${k} ${pct(fired.filter((x) => x.perimeter === k).length)}`);
  const useless = fired.filter((x) => x.enemyReach <= 0 && x.threatsCut <= 0 && !x.claimDenied && x.perimeter === 'none');
  console.log(`\nLevel ${level}: ${n} games (${finished} finished), ${(turnsTotal / n).toFixed(1)} turns on average`);
  console.log(
    `  barriers fired: ${fired.length} (${(fired.length / n).toFixed(1)} a game); on the map at the end: ${(endBarriers.reduce((a, b) => a + b, 0) / n).toFixed(1)}`,
  );
  console.log(
    `  turns with a Wisp able to fire: ${offeredTurns}, fired in ${usedTurns} (${Math.round((100 * usedTurns) / Math.max(1, offeredTurns))}%)`,
  );
  console.log(`  at the end, the winner's barriers: ${winnerBarriers[0]}, the losers': ${winnerBarriers[1]}`);
  console.log(
    `  avg per barrier: enemy reach −${avg((x) => x.enemyReach)} spaces, own reach −${avg((x) => x.ownReach)}, enemy attacks on me −${avg((x) => x.threatsCut)}, my attacks −${avg((x) => x.attacksLost)}`,
  );
  console.log(
    `  cut an enemy threat: ${pct(fired.filter((x) => x.threatsCut > 0).length)}; cut enemy reach: ${pct(fired.filter((x) => x.enemyReach > 0).length)}; denied a ready enemy claim: ${fired.filter((x) => x.claimDenied).length}`,
  );
  console.log(
    `  perimeter space: ${perims.join(', ')}; next to an enemy's partial claim: ${pct(fired.filter((x) => x.nearEnemyClaim).length)}`,
  );
  console.log(
    `  nearest enemy mech: ${avg((x) => x.nearestEnemy)} hexes; eval delta avg ${avg((x) => x.evalDelta)} (≤0: ${pct(fired.filter((x) => x.evalDelta <= 0).length)})`,
  );
  console.log(
    `  no visible purpose (no enemy reach/threat cut, no perimeter): ${pct(useless.length)}; hurt own reach more than enemy's: ${pct(fired.filter((x) => x.ownReach > x.enemyReach).length)}`,
  );
}
