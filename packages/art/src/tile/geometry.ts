import { CUBE_PAD, NUMBER_TEXT, TILE } from '../tokens';
import { n, type Box } from '../svg';

/**
 * Where things are on a tile, in trim millimetres: its spaces (3 × 3 squares or a 7-hex flower), where a
 * planet may sit and where its number and cube pads go round it, and a hex tile's shape and die-cut line.
 * Shared by every look of tile, in space and on a world's ground (index.ts puts a tile together).
 */

/** The shape of a map's spaces: a tile of 3 × 3 squares, or a 7-hex flower. */
export type TileShape = 'square' | 'hex';

/** The middle of a hex space kept clear of gutter art (betweenSpaces), as a part of its hex (a square's pad is 24 of its 32 mm). */
const HEX_WELL = 0.8;

/**
 * The planets a map may put off the middle of a tile, by the tile's shape: an off-centre planet sits on
 * an edge space, half a space from the tile's edge. A 9 or 10 is wider than that (0.6 and 0.72 spaces to
 * its rim) and an 8 fills an outer hex to its sides, so a hex tile takes only 7s there.
 */
export const OFF_CENTRE: Record<TileShape, readonly number[]> = { square: [7, 8], hex: [7] };

/** A point on a tile in spaces from its middle, x right and y down. */
export interface Spot {
  x: number;
  y: number;
}

/**
 * A tile's spaces by the compass direction a map's layout token gives them (engine `parseToken`), `''`
 * for the middle, in spaces as drawn: north is up, and a hex tile's outer hexes are flat-topped
 * hexes one space tall around the middle one.
 */
export const TILE_SPOTS: Record<TileShape, Readonly<Record<string, Spot>>> = {
  square: Object.fromEntries(
    [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => [`${['n', '', 's'][y + 1]}${['w', '', 'e'][x + 1]}`, { x, y }])),
  ),
  hex: {
    '': { x: 0, y: 0 },
    n: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    ...Object.fromEntries(
      [-1, 1].flatMap((sx) => [-0.5, 0.5].map((y) => [`${y < 0 ? 'n' : 's'}${sx < 0 ? 'w' : 'e'}`, { x: (sx * Math.sqrt(3)) / 2, y }])),
    ),
  },
};

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
 * share, or the vertex three hexes share (its own, the one below and the one below right). Clear of
 * dice, so the number goes there, and the label at the top left.
 */
export const MEET: Record<TileShape, Spot> = { square: { x: 0.5, y: 0.5 }, hex: { x: 0.5 / Math.sqrt(3), y: 0.5 } };

/**
 * Which corner of a planet its number goes in, from where the planet sits on its tile: the one nearest
 * the tile's middle, so the number is always on the planet's own tile, clear of the tile's edge and of
 * anything on the next tile. A planet in the middle (and wherever two corners are as near, as on a
 * square tile's n) keeps the printed bottom right.
 */
export function numberCorner(at: Spot, shape: TileShape = 'square'): Corner {
  const m = MEET[shape];
  const far = (k: Corner) => Math.hypot(at.x + k.x * m.x, at.y + k.y * m.y);
  return CORNERS.reduce((best, k) => (far(k) < far(best) - 1e-9 ? k : best));
}

/** Where a tile's planet sits (`TileOptions.planetAt`), in spaces from its middle. */
export function planetSpot(shape: TileShape, at = ''): Spot {
  const spot = TILE_SPOTS[shape][at];
  if (!spot) throw new Error(`A ${shape} tile's planet can't sit "${at}"`);
  return spot;
}

/** The corners of a flat-topped hex `size` tall centred on (cx, cy) (mm), from the right going clockwise. */
export const hexCorners = (cx: number, cy: number, size: number) =>
  Array.from({ length: 6 }, (_, i) => ({
    x: cx + (size / Math.sqrt(3)) * Math.cos((Math.PI / 3) * i),
    y: cy + (size / Math.sqrt(3)) * Math.sin((Math.PI / 3) * i),
  }));

const CELL_CENTRES = [0, 1, 2].map((i) => (i + 0.5) * TILE.cell);
export const MID = TILE.size / 2;

/**
 * Where the four spaces meet at the planet's top left and bottom right: clear of dice, so the label
 * and the number go there.
 */
export const CORNER = TILE.cell / 2;

/**
 * The middles of a hex tile's seven spaces (mm): flat-topped hexes one space tall, the middle one at the
 * tile's middle, as the game draws them (engine `drawing`).
 */
const HEX_CENTRES = Object.values(TILE_SPOTS.hex).map((p) => ({ x: MID + p.x * TILE.cell, y: MID + p.y * TILE.cell }));

/** Whether a point is in the gutters between a tile's spaces, clear of every square pad or hex well. */
export function betweenSpaces(shape: TileShape, x: number, y: number): boolean {
  if (shape === 'hex') return HEX_CENTRES.every((c) => Math.hypot(x - c.x, y - c.y) > (HEX_WELL * TILE.cell) / 2 + 1);
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
 * The number is centred where the spaces meet at the planet's bottom right (`MEET`: four squares' corner
 * or three hexes' vertex), clear of the dice and away from the planet. If it would touch a cube pad (the
 * 10's four fill the middle), it moves further out the same way until it is clear.
 */
export function numberPlacement(number: number, shape: TileShape = 'square'): NumberPlacement {
  const digits = String(number).length;
  const size = digits > 1 ? NUMBER_TEXT.sizeTwoDigits : NUMBER_TEXT.size;
  const halfW = 0.32 * size * digits;
  const halfH = 0.37 * size;
  const pads = cubePadCentres(number - 6, 0, 0);
  const m = MEET[shape];
  let [x, y] = [m.x * TILE.cell, m.y * TILE.cell];
  while (pads.some((p) => boxGap(x, y, halfW, halfH, p.x, p.y, CUBE_PAD.size / 2) < 0.8)) {
    x += (0.05 * m.x) / m.y;
    y += 0.05;
  }
  return { x, y, size, halfW, halfH };
}

/**
 * A hex tile's shape in trim millimetres: its 7 hexes, each grown by `grow` mm (its bleed past the cut),
 * which together make the flower, as polygons going the same way round (so filled or clipped they join).
 */
export const hexTileShape = (grow = 0): Spot[][] => HEX_CENTRES.map((c) => hexCorners(c.x, c.y, TILE.cell + 2 * grow));

/** A straight piece of a line, [x1, y1, x2, y2] in millimetres. */
export type Segment = readonly [number, number, number, number];

/** The outline of polygons that join into one shape: the sides no two of them share. */
function outlineOf(polygons: Spot[][]): Segment[] {
  const sides = polygons.flatMap((poly) =>
    poly.map((a, i): Segment => [a.x, a.y, poly[(i + 1) % poly.length].x, poly[(i + 1) % poly.length].y]),
  );
  const middle = ([x1, y1, x2, y2]: Segment) => `${((x1 + x2) / 2).toFixed(3)},${((y1 + y2) / 2).toFixed(3)}`;
  const count = new Map<string, number>();
  for (const side of sides) count.set(middle(side), (count.get(middle(side)) ?? 0) + 1);
  return sides.filter((side) => count.get(middle(side)) === 1);
}

/** A hex tile's die-cut line, in trim millimetres: the flower's outline, 18 sides. */
export const HEX_TILE_CUT: readonly Segment[] = outlineOf(hexTileShape());

/**
 * A die-cut line as an SVG path, moved by (dx, dy) mm: for a print service's cut layer, named for the
 * `CutContour` spot colour it cuts along and drawn in the magenta that colour previews as.
 */
export const dieLine = (line: readonly Segment[], dx = 0, dy = 0) =>
  `<path id="CutContour" d="${line.map(([x1, y1, x2, y2]) => `M${n(x1 + dx)} ${n(y1 + dy)}L${n(x2 + dx)} ${n(y2 + dy)}`).join('')}" fill="none" stroke="#ec008c" stroke-width=".25"/>`;

/** A hex tile's shape (`hexTileShape`) as one SVG path. */
export const flowerPath = (grow: number) =>
  hexTileShape(grow)
    .map((hex) => `M${hex.map((p) => `${n(p.x)} ${n(p.y)}`).join(' L')}Z`)
    .join('');

/** The trim of a tile (mm). */
export const TRIM: Box = { x: 0, y: 0, w: TILE.size, h: TILE.size };

/** The trim of a tile with its bleed (mm): how far a tile's art is drawn, whether the bleed is shown or not. */
export const BLED: Box = { x: -TILE.bleed, y: -TILE.bleed, w: TILE.size + 2 * TILE.bleed, h: TILE.size + 2 * TILE.bleed };
