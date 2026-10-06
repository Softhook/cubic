import { cellOf, delta, onBoard, type Board, type GameState } from '@quantum/engine';

/** Where each ship on the map is drawn, in cell units (an attacker sits part-way into its target). */
export function shipSpots(game: GameState): Map<string, { r: number; c: number }> {
  const head = game.pending[0];
  const combat = head?.kind === 'combat' ? head : null;
  const spots = new Map<string, { r: number; c: number }>();
  for (const d of game.dice) {
    const at = cellOf(d);
    if (!at) continue;
    let { r, c } = at;
    if (combat && combat.attacker.die === d.id) {
      const d = delta(combat.from, combat.at, game.board);
      r += d.r * 0.42;
      c += d.c * 0.42;
    }
    spots.set(d.id, { r, c });
  }
  return spots;
}

export interface WrapMark {
  r: number;
  c: number;
  /** The edge the mark sits on. */
  side: 'top' | 'bottom' | 'left' | 'right';
}

/** Board-edge spaces that join the opposite edge on a wrapping map, one mark per joined pair end. */
export function wrapMarks(board: Board): WrapMark[] {
  const marks: WrapMark[] = [];
  const { rows, cols, wrap } = board;
  if (wrap?.cols)
    for (let r = 0; r < rows; r++)
      if (onBoard(board, { r, c: 0 }) && onBoard(board, { r, c: cols - 1 }))
        marks.push({ r, c: 0, side: 'left' }, { r, c: cols - 1, side: 'right' });
  if (wrap?.rows)
    for (let c = 0; c < cols; c++)
      if (onBoard(board, { r: 0, c }) && onBoard(board, { r: rows - 1, c }))
        marks.push({ r: 0, c, side: 'top' }, { r: rows - 1, c, side: 'bottom' });
  return marks;
}
