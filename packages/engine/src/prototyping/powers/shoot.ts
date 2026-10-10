/**
 * Shoot: attack an enemy in a straight line, without moving. The ship's move and its shot cost one
 * action together, in either order; the shooter never advances.
 */
import { AROUND, canMoveDie, cellOf, die, dieAt, hooksOf, isEmptySpace, offsets, onBoard, setTurnNote, spend, startCombat, turnNote } from '../../prototype';
import type { Die, GameState, PrototypePower } from '../../prototype';

/** The four orthogonal directions: a shot flies as far as the first thing in its way (a ship, planet, void or the board's edge). */
const LINES = AROUND.slice(0, 4);

/** This turn so far: `fired` first, so its move is free; `moved` first, so its shot is free; `done`: both. */
type Shot = 'fired' | 'moved' | 'done';

const shotOf = (s: GameState, d: Die) => turnNote<Shot>(s, 'shoot', d);

/** Whether it may shoot now, and what it costs: `paid` before it moves, `free` after a plain move. Not after an attack, nor twice. */
function shotCost(s: GameState, d: Die): 'paid' | 'free' | null {
  const shot = shotOf(s, d);
  if (shot === 'moved') return 'free';
  return !shot && canMoveDie(s, d) ? 'paid' : null;
}

/** Enemy ships in range from where it stands, whatever the cost. */
export function shootTargets(s: GameState, d: Die): Die[] {
  const start = cellOf(d);
  if (!start) return [];
  const out: Die[] = [];
  for (const dir of LINES) {
    let at = start;
    // The step count only matters on a board that wraps, where a line comes back round to the shooter.
    for (let k = 0; k < s.board.rows + s.board.cols; k++) {
      [at] = offsets(s.board, at, [dir]);
      if (!onBoard(s.board, at)) break;
      const target = dieAt(s, at);
      if (target) {
        if (target.owner !== d.owner && !out.includes(target)) out.push(target);
        break;
      }
      if (!isEmptySpace(s, at)) break;
    }
  }
  return out;
}

export const shoot: PrototypePower = {
  ability: {
    name: 'Shoot',
    text: 'Attack the first ship in any straight line up or down, left or right, as far as it is clear (planets, other ships and the edge of the board block the line). It stays where it is. Shooting and moving cost one action together, in either order.',
    hint: 'Shoot: choose an enemy in a clear straight line, up, down, left or right, at any distance. Your Interceptor stays put, and can still move before or after.',
  },
  hooks: {
    freeMove: (s, d) => shotOf(s, d) === 'fired',
    noAttack: (s, d) => shotOf(s, d) === 'fired',
    // Asked about every ship (prototype.ts): a ship that fired keeps its free move and its no-attack
    // after changing number, but only an Interceptor's move makes its shot free.
    onMove(s, d) {
      const shot = shotOf(s, d);
      if (shot === 'fired') setTurnNote(s, 'shoot', d, 'done');
      else if (!shot && hooksOf(s, d) === shoot.hooks) setTurnNote(s, 'shoot', d, 'moved');
    },
    action: {
      options(s, d) {
        const cost = shotCost(s, d);
        // An attack also pays for any Curious free moves taken (payForAttack).
        if (!cost || s.turn.actionsLeft < (cost === 'paid' ? 1 : 0) + s.turn.freeMovesUsed) return [];
        return shootTargets(s, d).map((x) => ({ target: x.id }));
      },
      apply(s, d, { target }) {
        const cost = shotCost(s, d);
        if (cost === 'paid') spend(s, 1);
        setTurnNote(s, 'shoot', d, cost === 'paid' ? 'fired' : 'done');
        startCombat(s, d, die(s, target!), cellOf(d)!, true);
      },
    },
  },
};
