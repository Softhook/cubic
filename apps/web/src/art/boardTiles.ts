import { adjacent, type Board } from '@quantum/engine';
import { assignTiles, tileFlavour, tileSpec } from '@quantum/art';

export interface TileArt {
  /** The tile's top-left space; on a hex map, its middle hex (the planet's). */
  r: number;
  c: number;
  /** The physical tile whose artwork (starfield and planet) goes here. */
  id: string;
}

/** Each 3×3 tile of the map, with the physical tile it uses (packages/art). */
export function tileArt(board: Board): TileArt[] {
  const { tiles, ids } = tileIds(board);
  return [...tiles].map(([index, t]) => ({ ...t, id: ids.get(index)! }));
}

/** The map's tiles by index (`BoardCell.tile`), and the physical tile id each one uses. */
function tileIds(board: Board) {
  const tiles = new Map<number, { r: number; c: number; number: number }>();
  board.cells.forEach((row, r) =>
    row.forEach((x, c) => {
      if (x.kind === 'off' || tiles.has(x.tile)) return;
      tiles.set(x.tile, { r, c, number: 0 });
    }),
  );
  // A hex tile's middle: the hex whose six neighbours are all on its tile.
  if (board.hex)
    board.cells.forEach((row, r) =>
      row.forEach((x, c) => {
        const around = adjacent(board, { r, c });
        if (x.kind !== 'off' && around.length === 6 && around.every((q) => board.cells[q.r][q.c].tile === x.tile))
          Object.assign(tiles.get(x.tile)!, { r, c });
      }),
    );
  for (const p of board.planets) tiles.get(board.cells[p.r][p.c].tile)!.number = p.number;
  const ids = assignTiles([...tiles].map(([index, t]) => ({ index, number: t.number })));
  return { tiles, ids };
}

const names = new Map<string, Map<number, string>>();

/** Each planet's made-up name, from the tile artwork it sits on (the name printed on that tile). */
export function planetNames(board: Board): Map<number, string> {
  let out = names.get(board.mapId);
  if (!out) {
    const { ids } = tileIds(board);
    out = new Map();
    for (const p of board.planets) out.set(p.id, tileFlavour(tileSpec(ids.get(board.cells[p.r][p.c].tile)!)).name);
    names.set(board.mapId, out);
  }
  return out;
}
