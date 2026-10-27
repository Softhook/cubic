import { CUBE_PAD, NUMBER_TEXT, TILE } from '../tokens';
import type { Box } from '../svg';

/**
 * Where things are on a tile, in trim millimetres: its 3 × 3 spaces, where a planet may sit and where its
 * number and cube pads go round it (index.ts puts a tile together).
 */

/**
 * The planets a map may put off the middle of a tile: an off-centre planet sits on an edge space, half a
 * space from the tile's edge. A 9 or 10 is wider than that (0.6 and 0.72 spaces to its rim).
 */
export const OFF_CENTRE: readonly number[] = [7, 8];

/** A point on a tile in spaces from its middle, x right and y down. */
export interface Spot {
  x: number;
  y: number;
}

/**
 * A tile's spaces by the compass direction a map's layout token gives them (engine `parseToken`), `''`
 * for the middle, in spaces as drawn: north is up.
 */
export const TILE_SPOTS: Readonly<Record<string, Spot>> = Object.fromEntries(
  [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => [`${['n', '', 's'][y + 1]}${['w', '', 'e'][x + 1]}`, { x, y }])),
);

/** A corner of a planet: right or left of it, below or above it. */
export interface Corner {
  x: 1 | -1;
  y: 1 | -1;
}

/** The corners a number may go in, the printed bottom right first. */
const CORNERS: readonly Corner[] = [
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

/**
 * Where the spaces meet at a planet's bottom right, in spaces from its middle: the corner four squares
 * share. Clear of dice, so the number goes there, and the label at the top left.
 */
export const MEET: Spot = { x: 0.5, y: 0.5 };

/**
 * Which corner of a planet its number goes in, from where the planet sits on its tile: the one nearest
 * the tile's middle, so the number is always on the planet's own tile, clear of the tile's edge and of
 * anything on the next tile. A planet in the middle (and wherever two corners are as near, as on a
 * square tile's n) keeps the printed bottom right.
 */
export function numberCorner(at: Spot): Corner {
  const far = (k: Corner) => Math.hypot(at.x + k.x * MEET.x, at.y + k.y * MEET.y);
  return CORNERS.reduce((best, k) => (far(k) < far(best) - 1e-9 ? k : best));
}

/** Where a tile's planet sits (`TileOptions.planetAt`), in spaces from its middle. */
export function planetSpot(at = ''): Spot {
  const spot = TILE_SPOTS[at];
  if (!spot) throw new Error(`A tile's planet can't sit "${at}"`);
  return spot;
}

const CELL_CENTRES = [0, 1, 2].map((i) => (i + 0.5) * TILE.cell);
export const MID = TILE.size / 2;

/**
 * Where the four spaces meet at the planet's top left and bottom right: clear of dice, so the label
 * and the number go there.
 */
export const CORNER = TILE.cell / 2;

/** Whether a point is in the gutters between a tile's spaces, clear of every pad. */
export function betweenSpaces(x: number, y: number): boolean {
  const near = Math.min(...CELL_CENTRES.flatMap((cx) => CELL_CENTRES.map((cy) => Math.max(Math.abs(x - cx), Math.abs(y - cy)))));
  return near > TILE.pad / 2 - 2;
}

/** Where the cube pads go on a planet: a cluster centred on it. Coordinates are pad centres. */
export function cubePadCentres(capacity: number, cx: number, cy: number): { x: number; y: number }[] {
  const h = (CUBE_PAD.size + CUBE_PAD.gap) / 2;
  switch (capacity) {
    case 1:
      return [{ x: cx, y: cy }];
    case 2:
      return [
        { x: cx - h, y: cy },
        { x: cx + h, y: cy },
      ];
    case 3:
      return [
        { x: cx - h, y: cy - h },
        { x: cx + h, y: cy - h },
        { x: cx, y: cy + h },
      ];
    default:
      return [
        { x: cx - h, y: cy - h },
        { x: cx + h, y: cy - h },
        { x: cx - h, y: cy + h },
        { x: cx + h, y: cy + h },
      ];
  }
}

/** Gap between a box (centre, half-width, half-height) and a square (centre, half-size); 0 if they overlap. */
export function boxGap(cx: number, cy: number, hw: number, hh: number, x: number, y: number, h: number): number {
  return Math.hypot(Math.max(0, Math.abs(cx - x) - hw - h), Math.max(0, Math.abs(cy - y) - hh - h));
}

/** Where the planet number goes and how big it is. Offsets are from the planet's centre (mm). */
export interface NumberPlacement {
  x: number;
  y: number;
  size: number;
  /** Half the numeral's width and height: the box checked against the cube pads and dice. */
  halfW: number;
  halfH: number;
}

/**
 * The number is centred where the spaces meet at the planet's bottom right (`MEET`), clear of the dice and away from the planet. If it would touch a cube pad (the
 * 10's four fill the middle), it moves further out the same way until it is clear.
 */
export function numberPlacement(number: number): NumberPlacement {
  const digits = String(number).length;
  const size = digits > 1 ? NUMBER_TEXT.sizeTwoDigits : NUMBER_TEXT.size;
  const halfW = 0.32 * size * digits;
  const halfH = 0.37 * size;
  const pads = cubePadCentres(number - 6, 0, 0);
  let [x, y] = [MEET.x * TILE.cell, MEET.y * TILE.cell];
  while (pads.some((p) => boxGap(x, y, halfW, halfH, p.x, p.y, CUBE_PAD.size / 2) < 0.8)) {
    x += 0.05;
    y += 0.05;
  }
  return { x, y, size, halfW, halfH };
}

/** The trim of a tile (mm). */
export const TRIM: Box = { x: 0, y: 0, w: TILE.size, h: TILE.size };

/** The trim of a tile with its bleed (mm): how far a tile's art is drawn, whether the bleed is shown or not. */
export const BLED: Box = { x: -TILE.bleed, y: -TILE.bleed, w: TILE.size + 2 * TILE.bleed, h: TILE.size + 2 * TILE.bleed };
