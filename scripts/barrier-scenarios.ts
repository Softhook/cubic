/**
 * Does the AI see when a barrier is the right move? Builds positions on Alpha Sector (hex) where an
 * enemy mech can claim an objective next turn by flying a second mech into its one open perimeter space, with the AI's Wisp
 * in line with that space and nothing else able to stop it, and checks whether each level seals it.
 *   npx vite-node scripts/barrier-scenarios.ts -- [levels=1,2,3,4] [setups=12]
 */
import { chooseAction, chooseCombatResponse, type AiLevel } from '../packages/ai/src';
import { barrierTargets } from '../packages/engine/src/regolith/powers/barrier';
import {
  actor,
  apply,
  legalActions,
  conquerCheck,
  distance,
  moveOptions,
  orbitals,
  spaces,
  type Action,
  type Cell,
  type GameState,
} from '../packages/engine/src';
import { evaluate, valueOf } from '../packages/ai/src/evaluate';
import { Search } from '../packages/ai/src/search';
import { arrange, quickStart, seededRandom } from '../packages/engine/test/helpers';

const [levelList = '1,2,3,4', count = '12'] = process.argv.slice(2).filter((x) => x !== '--');
const base = quickStart(2, 1, 'regolith', 'alpha-hex');
const same = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;

/** Positions: [state, the open perimeter space]. */
const why = { noCells: 0, noLine: 0, noReach: 0, noClaim: 0 };
function setups(): [GameState, Cell][] {
  const out: [GameState, Cell][] = [];
  const all = spaces(base.board);
  for (const planet of base.board.planets) {
    if (planet.cubes.length || planet.number < 5 || planet.number > 9) continue;
    const slots = orbitals(base.board, planet);
    for (const x of slots) {
      // Off this objective's perimeter (on a hex map nearly every space is on some perimeter).
      const perimeter = (c: Cell) => slots.some((q) => same(q, c));
      const enemyAt = all.find((c) => distance(c, x, base.board) === 2 && !perimeter(c));
      const wispAt = all.find((c) => distance(c, x, base.board) === 2 && !perimeter(c) && distance(c, enemyAt ?? c, base.board) > 2);
      const held = slots.find((q) => !same(q, x) && distance(q, wispAt ?? q, base.board) > 1);
      if (!enemyAt || !wispAt || !held) {
        why.noCells++;
        continue;
      }
      const s = arrange(base, {
        p0d0: [wispAt.r, wispAt.c, 6],
        p1d0: [enemyAt.r, enemyAt.c, 4],
        // Already on the perimeter: with the 4 flying in, the sum is the objective's number.
        p1d1: [held.r, held.c, planet.number - 4],
      });
      // No skills: the claim is an exact sum, as the evaluation reads it.
      for (const p of s.players) p.skills = [];
      s.barriers = slots.filter((q) => !same(q, x) && !same(q, held)).map((q) => ({ r: q.r, c: q.c, owner: 1 }));
      s.turn = { ...s.turn, player: 0, phase: 'actions', actionsLeft: 3, moved: {}, abilityUsed: {}, conquests: 0, oncePerTurn: [] };
      s.pending = [];
      const wisp = s.dice.find((d) => d.id === 'p0d0')!;
      if (!barrierTargets(s, wisp).some((c) => same(c, x))) {
        why.noLine++;
        continue;
      }
      // The enemy, on its turn, can fly in and claim.
      const theirs = { ...s, turn: { ...s.turn, player: 1 } };
      if (!moveOptions(theirs, 'p1d0').moves.has(`${x.r},${x.c}`)) {
        why.noReach++;
        continue;
      }
      const moved = apply(theirs, { type: 'move', die: 'p1d0', to: x });
      if (!conquerCheck(moved, 1, planet.id).ok) {
        why.noClaim++;
        continue;
      }
      out.push([s, x]);
      break;
    }
  }
  return out;
}

const list = setups().slice(0, Number(count));
console.log(`${list.length} positions`, why);
if (process.env.DEBUG) {
  for (const [s, x] of list) {
    const sealed = apply(s, { type: 'power', die: 'p0d0', to: x });
    const end = (t: GameState) => apply(t, { type: 'endTurn' });
    const planet = s.board.planets.find((p) => orbitals(s.board, p).some((q) => same(q, x)))!;
    console.log(
      `objective ${planet.number}: eval(end now) ${Math.round(evaluate(s, 0))}, after seal ${Math.round(evaluate(sealed, 0))};`,
      `p1 value ${Math.round(valueOf(s, 1))} → ${Math.round(valueOf(sealed, 1))}; after endTurn ${Math.round(evaluate(end(s), 0))} vs ${Math.round(evaluate(end(sealed), 0))}`,
      'AI picks',
      JSON.stringify(chooseAction(s, { level: 3, random: seededRandom(1) })),
    );
    // The search's one-step scores (a private method).
    const search = new Search(
      0,
      { depth: 3, width: 4, innerWidth: 2, samples: 4, carry: false, replies: 0, budget: 2500 },
      seededRandom(1),
    ) as unknown as { scoreAll(s: GameState, actions: Action[]): { a: Action; line: { value: number } }[] };
    const scored = search.scoreAll(s, legalActions(s));
    const isSeal = (a: Action) => a.type === 'power' && !!a.to && same(a.to, x);
    console.log(
      '  root top 6:',
      scored
        .slice(0, 6)
        .map(
          (y: { a: Action; line: { value: number } }) =>
            `${isSeal(y.a) ? 'SEAL' : y.a.type}${y.a.type === 'power' ? '@' + y.a.to!.r + ',' + y.a.to!.c : ''} ${Math.round(y.line.value)}`,
        )
        .join(' | '),
      ' seal rank',
      scored.findIndex((y: { a: Action }) => isSeal(y.a)),
    );
  }
}
for (const level of levelList.split(',').map(Number) as AiLevel[]) {
  let sealed = 0;
  let stopped = 0;
  let fired = 0;
  for (const [i, [start, x]] of list.entries()) {
    let s = start;
    const random = seededRandom(i * 31 + 7);
    // Play the AI's turn out.
    for (let step = 0; step < 40 && s.phase === 'play' && s.turn.player === 0; step++) {
      let a: Action | null = null;
      if (s.pending[0]?.kind === 'combat') for (const p of s.players) a ??= chooseCombatResponse(s, p.id, { level, random });
      a ??= chooseAction(s, { level, random });
      if (!a) break;
      if (a.type === 'power' && actor(s) === 0) fired++;
      s = apply(s, a);
    }
    if (s.barriers?.some((b) => same(b, x))) sealed++;
    // Stopped by any means: the enemy's best reply (every move of its mechs, then a claim) can't claim.
    const planet = s.board.planets.find((p) => orbitals(s.board, p).some((q) => same(q, x)))!;
    const them: GameState = s.turn.player === 1 ? s : { ...s, turn: { ...s.turn, player: 1, actionsLeft: 3 } };
    const claims = legalActions(them).some((a) => {
      if (a.type !== 'move') return false;
      const t = apply(them, a);
      return conquerCheck(t, 1, planet.id).ok;
    });
    if (!claims && !conquerCheck(them, 1, planet.id).ok) stopped++;
  }
  console.log(
    `level ${level}: sealed with a barrier ${sealed} of ${list.length}, claim stopped by any means ${stopped} (fired ${fired} barriers)`,
  );
}
