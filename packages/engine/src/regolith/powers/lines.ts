/** Straight lines out of a space, as the Sniper shoots and the Wisp fires barriers along them. */
import { straightLines } from '../../prototype';
import type { Cell, GameState } from '../../prototype';

/**
 * The spaces along each straight line out of a side of `start` (4 on squares, 6 on hexes), nearest first, as far
 * as the board's edge. On a board that wraps, a line stops once it could have come back round to `start`.
 */
export function lines(s: GameState, start: Cell): Cell[][] {
  return straightLines(s.board, start);
}
