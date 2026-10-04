import { cellOf, type Board, type GameState } from '@quantum/engine';
import { assignTiles } from '@quantum/art';

export interface TileArt {
  r: number;
  c: number;
  void: boolean;
  /** The physical tile whose artwork (starfield and planet) goes here. */
  id: string;
}

/** Each 3×3 tile of the map, with the physical tile it uses (packages/art). */
export function tileArt(board: Board): TileArt[] {
  const tiles = new Map<number, { r: number; c: number; void: boolean; number: number }>();
  board.cells.forEach((row, r) =>
    row.forEach((x, c) => {
      if (x.kind === 'off' || tiles.has(x.tile)) return;
      tiles.set(x.tile, { r, c, void: !!x.void, number: 0 });
    }),
  );
  for (const p of board.planets) tiles.get(board.cells[p.r][p.c].tile)!.number = p.number;
  const ids = assignTiles([...tiles].map(([index, t]) => ({ index, number: t.number })));
  return [...tiles].map(([index, t]) => ({ ...t, id: ids.get(index)! }));
}

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
      r += (combat.at.r - combat.from.r) * 0.42;
      c += (combat.at.c - combat.from.c) * 0.42;
    }
    spots.set(d.id, { r, c });
  }
  return spots;
}
