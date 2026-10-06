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

export const CAPACITY: Record<number, number> = { 7: 1, 8: 2, 9: 3, 10: 4 };

export function buildBoard(map: MapDef): Board {
  const tileRows = map.layout.length;
  const tileCols = Math.max(...map.layout.map((r) => r.length));
  const rows = tileRows * 3;
  const cols = tileCols * 3;
  const cells: BoardCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ kind: 'off' as const, tile: -1 })),
  );
  const planets: Planet[] = [];

  map.layout.forEach((row, tr) => {
    row.forEach((token, tc) => {
      if (token === '.') return;
      const tile = tr * tileCols + tc;
      const start = token.endsWith('*');
      const number = Number(token.replace('*', ''));
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const cell: BoardCell = { kind: 'space', tile };
          if (number === 0) cell.void = true;
          cells[tr * 3 + dr][tc * 3 + dc] = cell;
        }
      }
      if (number > 0) {
        const r = tr * 3 + 1;
        const c = tc * 3 + 1;
        const id = planets.length;
        planets.push({ id, number, capacity: CAPACITY[number] ?? 1, cubes: [], start, r, c });
        cells[r][c] = { kind: 'planet', tile, planet: id };
      }
    });
  });

  const board: Board = { mapId: map.id, mapName: map.name, rows, cols, cells, planets };
  if (map.wrap) board.wrap = { rows: map.wrap !== 'horizontal', cols: map.wrap !== 'vertical' };
  return board;
}

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

/** Orthogonal (Manhattan) distance between two cells, across joined edges on a wrapping map. */
export function distance(a: Cell, b: Cell, board: Board): number {
  const d = delta(a, b, board);
  return Math.abs(d.r) + Math.abs(d.c);
}

export function onBoard(board: Board, p: Cell): boolean {
  const cell = cellAt(board, p);
  return !!cell && cell.kind !== 'off';
}

/** The cells one step from p in each direction, carried across the board's joined edges. */
export function offsets(board: Board, p: Cell, deltas: Cell[]): Cell[] {
  const join = (x: number, size: number, wraps = false) => (wraps ? (x + size) % size : x);
  return deltas.map((d) => ({ r: join(p.r + d.r, board.rows, board.wrap?.rows), c: join(p.c + d.c, board.cols, board.wrap?.cols) }));
}

/** The 4 orthogonal spaces next to p that are on the board. */
export function adjacent(board: Board, p: Cell): Cell[] {
  return offsets(board, p, ORTHO).filter((q) => onBoard(board, q));
}

/** The orthogonal neighbours of p plus its Warp Gate partner: the two gate spaces count as adjacent (RULE-SUGGESTIONS #30). */
export function linked(state: GameState, p: Cell): Cell[] {
  return [...adjacent(state.board, p), ...gatePartner(state, p)];
}

/** The 8 surrounding spaces of p that are on the board. */
export function surrounding(board: Board, p: Cell): Cell[] {
  return offsets(board, p, [...ORTHO, ...DIAG]).filter((q) => onBoard(board, q));
}

/** Movement neighbours, including diagonals for interceptors and Warp Gate links. */
export function stepNeighbours(state: GameState, p: Cell, diagonal: boolean): Cell[] {
  const result = offsets(state.board, p, diagonal ? [...ORTHO, ...DIAG] : ORTHO).filter((q) => onBoard(state.board, q));
  return [...result, ...gatePartner(state, p)];
}

/** The other Warp Gate space, when p is one of two placed gates. */
function gatePartner(state: GameState, p: Cell): Cell[] {
  if (state.gates.length !== 2) return [];
  const [a, b] = state.gates;
  return same(p, a) ? [b] : same(p, b) ? [a] : [];
}

export function isDiagonalStep(a: Cell, b: Cell, board: Board): boolean {
  const d = delta(a, b, board);
  return Math.abs(d.r) === 1 && Math.abs(d.c) === 1;
}

export function orbitals(board: Board, planet: Planet): Cell[] {
  return adjacent(board, planet);
}

export function diagonals(board: Board, planet: Planet): Cell[] {
  return offsets(board, planet, DIAG).filter((q) => onBoard(board, q));
}

export function planetFreeSlots(planet: Planet): number {
  return planet.capacity - planet.cubes.length;
}
