/**
 * Barrier: fire a barrier in a straight line, onto any clear space along it. Free, once a turn, besides
 * the ship's move. A barrier stays for good and blocks every move, deploy and shot (GameState.barriers);
 * on a planet's orbital space it holds that space, as a ship would, but never counts towards a conquest.
 */
import { canUseAbility, cellOf, isEmptySpace, logTo, markAbility, name, shipName } from '../../prototype';
import type { Cell, Die, GameState, PrototypePower } from '../../prototype';
import { lines } from './lines';

/** The spaces a barrier can land on from where the ship stands. */
export function barrierTargets(s: GameState, d: Die): Cell[] {
  const start = cellOf(d);
  if (!start) return [];
  const out: Cell[] = [];
  // Like a shot: every empty space up to the first thing in its way (a ship, a planet, a barrier or the
  // board's edge; it flies over the void).
  for (const line of lines(s, start)) {
    for (const at of line) {
      if (!isEmptySpace(s, at)) break;
      if (!out.some((p) => p.r === at.r && p.c === at.c)) out.push(at);
    }
  }
  return out;
}

export const barrier: PrototypePower = {
  ability: {
    name: 'Barrier',
    text: 'Once a turn, besides its move and for no action, fire a barrier onto any empty space in a straight line out of a side of its space (not diagonally), as far as the line is clear (objectives, the edge of the board, mechs and barriers block it; the void does not). A barrier stays for good: no mech moves, drops or shoots through its space. It may hold a perimeter space.',
    hint: 'Barrier: choose a space in a clear straight line, not diagonally, at any distance. It costs no action, and the mech can still move.',
  },
  hooks: {
    action: {
      options(s, d) {
        if (!canUseAbility(s, d)) return [];
        return barrierTargets(s, d).map((to) => ({ to }));
      },
      apply(s, d, { to }) {
        markAbility(s, d);
        (s.barriers ??= []).push({ r: to!.r, c: to!.c, owner: d.owner });
        logTo(s, d.owner, `${name(s, d.owner)}'s ${shipName(s, d)} fires a barrier`, to!);
      },
    },
  },
};
