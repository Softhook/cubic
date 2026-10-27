import type { Board, BoardCell, Cell, GameState, Planet } from './types';
import type { MapDef } from './data';

const ORTHO: Cell[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];
const DIAG: Cell[] = [
  { r: -1, c: -1 },
  { r: -1, c: 1 },
  { r: 1, c: -1 },
  { r: 1, c: 1 },
];
/** What is next to what on a board, as steps from a space. */
export interface Geometry {
  /** The spaces next to one (adjacent: moving, attacking, orbiting): the 4 orthogonal ones. */
  sides: readonly Cell[];
  /** The Interceptor's diagonals, two spaces of distance in one step: the 4 corners. */
  diagonals: readonly Cell[];
  /** The spaces touching one (the Flagship's carry): the 8 with the corners. */
  touching: readonly Cell[];
  /** Steps along a delta: rows + columns. */
  steps: (d: Cell) => number;
}

const SQUARE: Geometry = {
  sides: ORTHO,
  diagonals: DIAG,
  touching: [...ORTHO, ...DIAG],
  steps: (d) => Math.abs(d.r) + Math.abs(d.c),
};

export const geometry = (_board: Board): Geometry => SQUARE;

export const CAPACITY: Record<number, number> = { 7: 1, 8: 2, 9: 3, 10: 4 };

/*
 * Where a tile's planet sits, as a step from the tile's middle space: a layout token's direction
 * (data/maps.yaml), none for the middle: any of the 8 spaces around the middle, corners too. North is up as the map is drawn.
 */
const named = (names: readonly string[], steps: readonly Cell[]): Record<string, Cell> =>
  Object.fromEntries(names.map((n, i) => [n, steps[i]]));
const SQUARE_OFFSETS = named(['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'], [...ORTHO, ...DIAG]);
const MIDDLE: Cell = { r: 0, c: 0 };

/** A layout token (data/maps.yaml), other than a gap: the planet's number (0 for a void), whether it's a start, and where on the tile it sits. */
export interface TileToken {
  number: number;
  start: boolean;
  /** The planet's compass direction from the tile's middle space; absent when it sits in the middle. */
  dir?: string;
}

/** Reads a layout token such as `8`, `9*`, `7ne` or `8s*`; throws on anything else. */
export function parseToken(token: string): TileToken {
  const m = /^(\d+)([nsew]{1,2})?(\*)?$/.exec(token);
  const number = Number(m?.[1]);
  if (!m || !(number === 0 || number in CAPACITY) || (m[2] && !(m[2] in SQUARE_OFFSETS))) throw new Error(`Bad tile token "${token}"`);
  if (number === 0 && (m[2] || m[3])) throw new Error(`A void tile has no planet to place or start on: "${token}"`);
  return m[2] ? { number, start: !!m[3], dir: m[2] } : { number, start: !!m[3] };
}

/** The step from a tile's middle space to its planet. */
const planetOffset = (t: TileToken): Cell => (t.dir ? SQUARE_OFFSETS[t.dir] : MIDDLE);

/** Ships each player places around their starting planet at setup (setup.ts). */
export const STARTING_SHIPS = 3;

/**
 * Checks what an off-centre planet could break: each starting planet needs room for the starting
 * ships, in orbital spaces no other start shares. Orbits that overlap are otherwise fine.
 */
function checkStarts(board: Board) {
  const starts = board.planets.filter((p) => p.start);
  for (const p of starts) {
    const others = starts.filter((q) => q !== p).flatMap((q) => orbitals(board, q));
    const own = orbitals(board, p).filter((x) => !others.some((y) => same(x, y)));
    if (own.length < STARTING_SHIPS)
      throw new Error(`${board.mapId}: starting planet ${p.number} has ${own.length} orbital spaces of its own, needs ${STARTING_SHIPS}`);
  }
}

/** A board's cells, all off it till tiles are laid. */
const offCells = (rows: number, cols: number): BoardCell[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ kind: 'off' as const, tile: -1 })));

/** Lays tile `tile` on the board: its `spaces` (a Void's all void), and its planet, if it has one, `t.dir` from `middle`. */
function layTile(cells: BoardCell[][], planets: Planet[], t: TileToken, tile: number, spaces: Cell[], middle: Cell) {
  for (const p of spaces) {
    const cell: BoardCell = { kind: 'space', tile };
    if (t.number === 0) cell.void = true;
    cells[p.r][p.c] = cell;
  }
  if (t.number === 0) return;
  const d = planetOffset(t);
  const [r, c] = [middle.r + d.r, middle.c + d.c];
  const id = planets.length;
  planets.push({ id, number: t.number, capacity: CAPACITY[t.number], cubes: [], start: t.start, r, c });
  cells[r][c] = { kind: 'planet', tile, planet: id };
}

export function buildBoard(map: MapDef): Board {
  const board = buildSquareBoard(map);
  checkStarts(board);
  return board;
}

function buildSquareBoard(map: MapDef): Board {
  const tileRows = map.layout.length;
  const tileCols = Math.max(...map.layout.map((r) => r.length));
  const rows = tileRows * 3;
  const cols = tileCols * 3;
  const cells = offCells(rows, cols);
  const planets: Planet[] = [];

  map.layout.forEach((row, tr) => {
    row.forEach((token, tc) => {
      if (token === '.') return;
      const spaces = [0, 1, 2].flatMap((dr) => [0, 1, 2].map((dc) => ({ r: tr * 3 + dr, c: tc * 3 + dc })));
      layTile(cells, planets, parseToken(token), tr * tileCols + tc, spaces, spaces[4]);
    });
  });

  const board: Board = { mapId: map.id, mapName: map.name, rows, cols, cells, planets };
  if (map.wrap) board.wrap = { rows: map.wrap !== 'horizontal', cols: map.wrap !== 'vertical' };
  return board;
}

/** Where a board is drawn: each space's place and the whole board's size, in spaces (cell units). */
export interface Drawing {
  rows: number;
  cols: number;
  /** A space's top-left corner, in spaces from the board's; its box is one space square. */
  at: (p: Cell) => Cell;
}

const DRAWINGS = new WeakMap<BoardCell[][], Drawing>();

/** How a board is drawn: as stored. Fractional positions (a ship part-way into its target) work too. */
export function drawing(board: Board): Drawing {
  let d = DRAWINGS.get(board.cells);
  if (!d) DRAWINGS.set(board.cells, (d = { rows: board.rows, cols: board.cols, at: (p) => p }));
  return d;
}

/** The space drawn at a point of the drawing (in spaces from its top left). */
export const cellAtPoint = (_board: Board, y: number, x: number): Cell => ({ r: Math.floor(y), c: Math.floor(x) });

export const key = (p: Cell) => `${p.r},${p.c}`;
export const same = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;

export function cellAt(board: Board, p: Cell): BoardCell | undefined {
  return board.cells[p.r]?.[p.c];
}

/** Every space (not a planet, void or off-board cell) on the board, row by row. */
export function spaces(board: Board): Cell[] {
  const out: Cell[] = [];
  board.cells.forEach((row, r) => row.forEach((cell, c) => cell.kind === 'space' && out.push({ r, c })));
  return out;
}

/** The shortest step from a to b along each axis, going across a joined edge when that is shorter. */
export function delta(a: Cell, b: Cell, board: Board): Cell {
  const short = (d: number, size: number, wraps = false) => (wraps && Math.abs(d) * 2 > size ? d - Math.sign(d) * size : d);
  return { r: short(b.r - a.r, board.rows, board.wrap?.rows), c: short(b.c - a.c, board.cols, board.wrap?.cols) };
}

/** Steps between two cells: orthogonal (Manhattan) distance, across joined edges on a wrapping map. */
export function distance(a: Cell, b: Cell, board: Board): number {
  return geometry(board).steps(delta(a, b, board));
}

export function onBoard(board: Board, p: Cell): boolean {
  const cell = cellAt(board, p);
  return !!cell && cell.kind !== 'off';
}

/** The cells one step from p in each direction, carried across the board's joined edges. */
export function offsets(board: Board, p: Cell, deltas: readonly Cell[]): Cell[] {
  const join = (x: number, size: number, wraps = false) => (wraps ? (x + size) % size : x);
  return deltas.map((d) => ({ r: join(p.r + d.r, board.rows, board.wrap?.rows), c: join(p.c + d.c, board.cols, board.wrap?.cols) }));
}

/** Straight lines out of a space in each of the 4 directions, nearest first, as far as the board's edge. */
export function straightLines(board: Board, start: Cell): Cell[][] {
  return geometry(board).sides.map((dir) => {
    const line: Cell[] = [];
    let at = start;
    for (let k = 0; k < board.rows + board.cols; k++) {
      [at] = offsets(board, at, [dir]);
      if (!onBoard(board, at)) break;
      if (same(at, start) || line.some((p) => same(p, at))) break;
      line.push(at);
    }
    return line;
  });
}

/**
 * A board's cells by index (r * cols + c), with each cell's neighbours: they never change, and the
 * AI asks for them for every ship in every position it scores. Cached by `cells`, which states share
 * (see engine.ts copyState). The lists are frozen, as every caller gets the same one.
 */
export interface Grid {
  cols: number;
  size: number;
  cells: readonly Cell[];
  /** Whether a ship may stand on the cell. */
  space: readonly boolean[];
  /**
   * Neighbour indexes on the board (see Geometry): `ortho` the 4 orthogonal spaces next to it, `around` those
   * and the diagonals, an Interceptor's steps (8 around).
   */
  ortho: readonly (readonly number[])[];
  around: readonly (readonly number[])[];
  orthoCells: readonly (readonly Cell[])[];
  aroundCells: readonly (readonly Cell[])[];
  /** The spaces touching each one: the same as `aroundCells`. */
  touchingCells: readonly (readonly Cell[])[];
}

const GRIDS = new WeakMap<BoardCell[][], Grid>();

export function grid(board: Board): Grid {
  let g = GRIDS.get(board.cells);
  if (g) return g;
  const { rows, cols } = board;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(Object.freeze({ r, c }));
  const near = (deltas: readonly Cell[]) =>
    cells.map((p) =>
      Object.freeze(
        offsets(board, p, deltas)
          .filter((q) => onBoard(board, q))
          .map((q) => cells[q.r * cols + q.c]),
      ),
    );
  const { sides, diagonals, touching } = geometry(board);
  const orthoCells = near(sides);
  const aroundCells = near([...sides, ...diagonals]);
  const index = (list: readonly Cell[]) => Object.freeze(list.map((q) => q.r * cols + q.c));
  g = {
    cols,
    size: rows * cols,
    cells,
    space: cells.map((p) => cellAt(board, p)?.kind === 'space'),
    ortho: orthoCells.map(index),
    around: aroundCells.map(index),
    orthoCells,
    aroundCells,
    touchingCells: touching === sides ? orthoCells : near(touching),
  };
  GRIDS.set(board.cells, g);
  return g;
}

/** A cell's index in grid(board), or -1 if it is not a cell of the board (as in a malformed action). */
export function cellIndex(board: Board, p: Cell | undefined): number {
  const { r, c } = p ?? {};
  const inside = Number.isInteger(r) && Number.isInteger(c) && r! >= 0 && c! >= 0 && r! < board.rows && c! < board.cols;
  return inside ? r! * board.cols + c! : -1;
}

/** The neighbours of p on the board: next to it, also diagonal (an Interceptor's steps), or touching it. */
function neighbours(board: Board, p: Cell, kind: 'sides' | 'diagonal' | 'touching'): readonly Cell[] {
  if (p.r < 0 || p.c < 0 || p.r >= board.rows || p.c >= board.cols) {
    const { sides, diagonals, touching } = geometry(board);
    const deltas = kind === 'sides' ? sides : kind === 'diagonal' ? [...sides, ...diagonals] : touching;
    return offsets(board, p, deltas).filter((q) => onBoard(board, q));
  }
  const g = grid(board);
  return (kind === 'sides' ? g.orthoCells : kind === 'diagonal' ? g.aroundCells : g.touchingCells)[p.r * board.cols + p.c];
}

/** The spaces next to p that are on the board: the 4 orthogonal ones. */
export function adjacent(board: Board, p: Cell): readonly Cell[] {
  return neighbours(board, p, 'sides');
}

/** The orthogonal neighbours of p plus its Warp Gate partner: the two gate spaces count as adjacent (RULE-SUGGESTIONS #30). */
export function linked(state: GameState, p: Cell): Cell[] {
  return [...adjacent(state.board, p), ...gatePartner(state, p)];
}

/** The spaces touching p that are on the board: the 8 around it. */
export function surrounding(board: Board, p: Cell): readonly Cell[] {
  return neighbours(board, p, 'touching');
}

/** Movement neighbours, including diagonals for interceptors and Warp Gate links. */
export function stepNeighbours(state: GameState, p: Cell, diagonal: boolean): readonly Cell[] {
  const result = neighbours(state.board, p, diagonal ? 'diagonal' : 'sides');
  return state.gates.length === 2 ? [...result, ...gatePartner(state, p)] : result;
}

/** The other Warp Gate space, when p is one of two placed gates. */
function gatePartner(state: GameState, p: Cell): Cell[] {
  if (state.gates.length !== 2) return [];
  const [a, b] = state.gates;
  return same(p, a) ? [b] : same(p, b) ? [a] : [];
}

/** The other Warp Gate / Ice Tunnel space, when p is one of two placed gates. */
export function otherGate(state: GameState, p: Cell): Cell | undefined {
  if (state.gates.length !== 2) return undefined;
  const [a, b] = state.gates;
  return same(p, a) ? b : same(p, b) ? a : undefined;
}

export function isDiagonalStep(a: Cell, b: Cell, board: Board): boolean {
  const d = delta(a, b, board);
  return geometry(board).diagonals.some((x) => same(x, d));
}

const isSpace = (board: Board, p: Cell) => cellAt(board, p)?.kind === 'space';

const ORBITS = new WeakMap<BoardCell[][], (readonly Cell[])[]>();

/**
 * A planet's orbital positions: the spaces next to it. An off-centre planet's orbit reaches onto
 * neighbouring tiles, or loses the spaces off the map's edge; orbits may overlap, so a space can orbit
 * several planets, and a planet next to another doesn't orbit it. Cached by `cells`, like grid().
 */
export function orbitals(board: Board, planet: Planet): readonly Cell[] {
  let orbits = ORBITS.get(board.cells);
  if (!orbits) ORBITS.set(board.cells, (orbits = []));
  return (orbits[planet.id] ??= Object.freeze(adjacent(board, planet).filter((q) => isSpace(board, q))));
}

/** The planets a space orbits: none, one, or several where orbits overlap. */
export function orbitedPlanets(board: Board, p: Cell): Planet[] {
  return board.planets.filter((planet) => orbitals(board, planet).some((q) => same(q, p)));
}

export function diagonals(board: Board, planet: Planet): Cell[] {
  return offsets(board, planet, geometry(board).diagonals).filter((q) => isSpace(board, q));
}

const CENTRES = new WeakMap<BoardCell[][], ReadonlyMap<number, Cell>>();

/**
 * Each tile's middle space, by tile index (`BoardCell.tile`): the one space whose neighbours all lie on
 * its own tile. The planet's, unless it sits off-centre. Cached by `cells`, like grid().
 */
export function tileCentres(board: Board): ReadonlyMap<number, Cell> {
  let out = CENTRES.get(board.cells);
  if (out) return out;
  const centres = new Map<number, Cell>();
  const { sides } = geometry(board);
  board.cells.forEach((row, r) =>
    row.forEach((x, c) => {
      if (x.kind !== 'off' && sides.every((d) => cellAt(board, { r: r + d.r, c: c + d.c })?.tile === x.tile)) centres.set(x.tile, { r, c });
    }),
  );
  CENTRES.set(board.cells, (out = centres));
  return out;
}

/**
 * Whether two tiles touch along a side: the 4 orthogonal neighbours of a tile (not the diagonal ones).
 * Their middle spaces are then 3 apart.
 */
export function tilesTouch(board: Board, a: number, b: number): boolean {
  const centres = tileCentres(board);
  const [p, q] = [centres.get(a), centres.get(b)];
  return !!p && !!q && distance(p, q, board) === 3;
}

export function planetFreeSlots(planet: Planet): number {
  return planet.capacity - planet.cubes.length;
}
