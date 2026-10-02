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

  return { mapId: map.id, mapName: map.name, rows, cols, cells, planets };
}

export const key = (p: Cell) => `${p.r},${p.c}`;
export const same = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;

export function cellAt(board: Board, p: Cell): BoardCell | undefined {
  return board.cells[p.r]?.[p.c];
}

export function onBoard(board: Board, p: Cell): boolean {
  const cell = cellAt(board, p);
  return !!cell && cell.kind !== 'off';
}

export function offsets(p: Cell, deltas: Cell[]): Cell[] {
  return deltas.map((d) => ({ r: p.r + d.r, c: p.c + d.c }));
}

/** The 4 orthogonal spaces next to p that are on the board. */
export function adjacent(board: Board, p: Cell): Cell[] {
  return offsets(p, ORTHO).filter((q) => onBoard(board, q));
}

/** The 8 surrounding spaces of p that are on the board. */
export function surrounding(board: Board, p: Cell): Cell[] {
  return offsets(p, [...ORTHO, ...DIAG]).filter((q) => onBoard(board, q));
}

/** Movement neighbours, including diagonals for interceptors and Warp Gate links. */
export function stepNeighbours(state: GameState, p: Cell, diagonal: boolean): Cell[] {
  const result = offsets(p, diagonal ? [...ORTHO, ...DIAG] : ORTHO).filter((q) =>
    onBoard(state.board, q),
  );
  if (state.gates.length === 2) {
    const [a, b] = state.gates;
    if (same(p, a)) result.push(b);
    else if (same(p, b)) result.push(a);
  }
  return result;
}

export function isDiagonalStep(a: Cell, b: Cell): boolean {
  return Math.abs(a.r - b.r) === 1 && Math.abs(a.c - b.c) === 1;
}

export function orbitals(board: Board, planet: Planet): Cell[] {
  return adjacent(board, planet);
}

export function diagonals(board: Board, planet: Planet): Cell[] {
  return offsets(planet, DIAG).filter((q) => onBoard(board, q));
}

export function planetFreeSlots(planet: Planet): number {
  return planet.capacity - planet.cubes.length;
}
