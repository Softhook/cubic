import { numberCorner as tileNumberCorner, tileLabelFits, type Corner, type Spot } from '@quantum/art';
import { cellAt, drawing, orbitedPlanets, spaces, tileCentres, type Board, type Cell, type Planet } from '@quantum/engine';

/*
 * What the map's live layers show (MapTiles), worked out from the board rather than from the tiles: a planet
 * may sit anywhere on its tile, its orbit reach onto other tiles and overlap another planet's.
 */

/** A space as the map marks it: how many planets it orbits (0, 1, or more where orbits overlap) and whether it's on a Void. */
export interface SpaceRole {
  p: Cell;
  orbits: number;
  void: boolean;
}

export function spaceRoles(board: Board): SpaceRole[] {
  return spaces(board).map((p) => ({ p, orbits: orbitedPlanets(board, p).length, void: !!cellAt(board, p)?.void }));
}

/** Where a planet sits on its tile, in spaces from the tile's middle as drawn. */
function spotOnTile(board: Board, planet: Planet): Spot {
  const { at } = drawing(board);
  const [p, m] = [at(planet), at(tileCentres(board).get(cellAt(board, planet)!.tile)!)];
  return { x: p.c - m.c, y: p.r - m.r };
}

/**
 * Which corner of a planet its number goes in, as on its printed tile (art `numberCorner`): the one
 * nearest its tile's middle, so on its own tile, clear of the map's edge and of the next tile's planet.
 */
export function numberCorner(board: Board, planet: Planet): Corner {
  return tileNumberCorner(spotOnTile(board, planet), board.hex ? 'hex' : 'square');
}

/**
 * Whether a planet's flavour label fits beside it, as on its printed tile (art `tileLabelFits`): on a square
 * map, where the spaces up and to the left of it meet, so both those spaces must be on its own tile, and
 * its number not there. The label then stays on its tile, which no other planet reaches.
 */
export function labelFits(board: Board, planet: Planet): boolean {
  return !board.hex && tileLabelFits('square', spotOnTile(board, planet));
}
