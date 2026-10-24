/**
 * Shoot: attack an enemy in a straight line, without moving. Like a move or a normal attack it is the
 * ship's one action of the turn (and costs one action); the shooter never advances.
 */
import { canMoveDie, cellOf, die, dieAt, geometry, isEmptySpace, markMoved, offsets, onBoard, spend, startCombat } from '../../prototype';
import type { Die, GameState, PrototypePower } from '../../prototype';

/** Enemy ships in range from where it stands, whatever the cost. */
export function shootTargets(s: GameState, d: Die): Die[] {
  const start = cellOf(d);
  if (!start) return [];
  const out: Die[] = [];
  // Along each line out of a side of its space (4 on squares, 6 on hexes): a shot flies as far as the first
  // thing in its way (a ship, a planet, a barrier or the board's edge; it flies over the void).
  for (const dir of geometry(s.board).sides) {
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
    text: 'Instead of moving, attack the first mech in any straight line out of a side of its space (not diagonally), as far as it is clear (objectives, the edge of the board, barriers and mechs, friendly or enemy, block the line; the void does not). It stays where it is. Like a move or an attack, it is the mech’s one action of the turn.',
    hint: 'Shoot: choose an enemy in a clear straight line, not diagonally, at any distance. Your Sniper stays put. It uses the mech’s action for the turn.',
  },
  hooks: {
    threatens: shootTargets,
    action: {
      options(s, d) {
        // An attack also pays for any Curious free moves taken (payForAttack).
        if (!canMoveDie(s, d) || s.turn.actionsLeft < 1 + s.turn.freeMovesUsed) return [];
        return shootTargets(s, d).map((x) => ({ target: x.id }));
      },
      apply(s, d, { target }) {
        spend(s, 1);
        markMoved(s, d);
        startCombat(s, d, die(s, target!), cellOf(d)!, true);
      },
    },
  },
};
