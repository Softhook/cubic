import { PLANET_DIAMETER, TILE, numberPlacement } from '@quantum/art';
import { cellAt, drawing, orbitedPlanets, spaces, type Board, type Cell, type Planet } from '@quantum/engine';

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

/** A planet's radius in spaces, with its atmosphere's glow. */
const reach = (p: Planet) => (PLANET_DIAMETER[p.number] / 2 / TILE.cell) * 1.08;

/** Distance from a point to a box (centre, half sizes), 0 inside it. */
const boxDistance = (x: number, y: number, cx: number, cy: number, hw: number, hh: number) =>
  Math.hypot(Math.max(0, Math.abs(x - cx) - hw), Math.max(0, Math.abs(y - cy) - hh));

/** The corners a planet's number may go in, in order: bottom right as printed, then bottom left, top right, top left. */
const CORNERS = [
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
] as const;

/**
 * Which corner of a planet its number goes in: the printed bottom right, unless another planet or the
 * map's edge is in the way there, then the first corner that is clear (the bottom right if none is).
 */
export function numberCorner(board: Board, planet: Planet): { x: 1 | -1; y: 1 | -1 } {
  const { at, rows, cols } = drawing(board);
  const q = at(planet);
  const n = numberPlacement(planet.number);
  // In spaces from the top left of the drawing; a space's middle is half a space in.
  const [hw, hh] = [n.halfW / TILE.cell, n.halfH / TILE.cell];
  const others = board.planets.filter((o) => o !== planet).map((o) => ({ o, m: at(o) }));
  const clear = (k: (typeof CORNERS)[number]) => {
    const cx = q.c + 0.5 + (k.x * n.x) / TILE.cell;
    const cy = q.r + 0.5 + (k.y * n.y) / TILE.cell;
    if (cx - hw < 0 || cy - hh < 0 || cx + hw > cols || cy + hh > rows) return false;
    return others.every(({ o, m }) => boxDistance(m.c + 0.5, m.r + 0.5, cx, cy, hw, hh) > reach(o));
  };
  return CORNERS.find(clear) ?? CORNERS[0];
}

/**
 * Whether a planet's flavour label fits beside it, as printed: on a square map, where the spaces up and
 * to the left of it meet, so both those spaces must be on its own tile, with no other planet near and
 * the planet's number not moved there (`numberCorner`).
 */
export function labelFits(board: Board, planet: Planet): boolean {
  if (board.hex) return false;
  const corner = numberCorner(board, planet);
  if (corner.x === -1 && corner.y === -1) return false;
  const tile = cellAt(board, planet)!.tile;
  const beside = [
    { r: planet.r - 1, c: planet.c - 1 },
    { r: planet.r, c: planet.c - 1 },
  ];
  if (!beside.every((p) => cellAt(board, p)?.kind === 'space' && cellAt(board, p)?.tile === tile)) return false;
  // The label (tile.ts `label`): about 1.4 spaces to 0.5 left of the planet's middle, and 0.65 to 0.35 above it.
  const [cx, cy] = [planet.c + 0.5 - 0.95, planet.r + 0.5 - 0.5];
  return board.planets.filter((o) => o !== planet).every((o) => boxDistance(o.c + 0.5, o.r + 0.5, cx, cy, 0.45, 0.15) > reach(o));
}
