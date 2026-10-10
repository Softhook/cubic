/**
 * Shoot: attack an enemy in a straight line, without moving. The ship's move and its shot cost one
 * action together, in either order; the shooter never advances.
 */
import { AROUND, canMoveDie, cellOf, die, dieAt, hooksOf, isEmptySpace, offsets, setTurnNote, spend, startCombat, turnNote } from '../../prototype';
import type { Die, GameState, PrototypePower } from '../../prototype';

/** How far a shot reaches. Spaces short of the target must be empty (a ship, planet or void blocks). */
const SHOOT_RANGE = 2;

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
  // Orthogonal and diagonal lines.
  for (const dir of AROUND) {
    let at = start;
    for (let k = 0; k < SHOOT_RANGE; k++) {
      [at] = offsets(s.board, at, [dir]);
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
    text: 'Attack an enemy 1 or 2 spaces away in a straight line, diagonals included (at 2, over an empty space). It stays where it is. Shooting and moving cost one action together, in either order.',
    hint: 'Shoot: choose an enemy 1 or 2 spaces away in a straight line, diagonals included. Your Interceptor stays put, and can still move before or after.',
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
