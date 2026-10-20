/**
 * Hex maps (docs/HEX.md) on 7-hex tiles. The rules are the square game's; what changes is which spaces
 * are next to each other, how far apart they are, and what a diagonal is. The lobby offers them with the
 * Prototyping rules; the geometry is pinned down here with Basic's plain ones.
 */
import { describe, expect, it } from 'vitest';
import {
  MAPS,
  RULESETS,
  adjacent,
  apply,
  buildBoard,
  carryPassengers,
  cellAtPoint,
  conquerCheck,
  distance,
  drawing,
  geometry,
  grid,
  isDiagonalStep,
  mapStats,
  moveOptions,
  orbitals,
  spaces,
  surrounding,
  tileCentres,
  type Cell,
  type GameState,
} from '../src';
import { allowMapGroups, playAiGame, quickStart } from './helpers';

// The basic maps on hex tiles; the drift maps (offset.test.ts) put their planets off the middle.
const HEX_MAPS = MAPS.filter((m) => m.group === 'hex');
allowMapGroups('basic', 'hex');
const BASE = quickStart(2, 1, 'basic', 'alpha-hex');
/** Alpha Sector (hex)'s middle planet, the 8: every other tile is next to it but the two starts. */
const CENTRE = BASE.board.planets.find((p) => p.number === 8)!;

/** Player 0 to act with 3 fresh actions, only the listed ships on the map, at [cell, value]. */
function scenario(dice: Record<string, [Cell, number]>): GameState {
  const s = structuredClone(BASE);
  for (const d of s.dice) if (d.loc.zone === 'board') d.loc = { zone: 'scrapyard' };
  for (const [id, [cell, value]] of Object.entries(dice)) {
    const d = s.dice.find((x) => x.id === id)!;
    d.loc = { zone: 'board', ...cell };
    d.value = value;
  }
  s.turn = { ...s.turn, player: 0, phase: 'actions', actionsLeft: 3, moved: {}, abilityUsed: {}, seen: {}, conquests: 0, oncePerTurn: [] };
  for (const d of s.dice) s.turn.seen[d.id] = [d.value];
  return s;
}

describe('hex maps', () => {
  it('are the basic maps for 2, 3 and 4 players, in Prototyping', () => {
    expect(HEX_MAPS.map((m) => m.players)).toEqual([2, 3, 4]);
    expect(RULESETS.prototyping.mapGroups).toContain('hex');
    for (const m of HEX_MAPS) expect(mapStats(m)).toEqual(m.stats);
  });

  it('are built of 7-hex tiles: each planet with its 6 orbital spaces, the planets of touching tiles 3 apart', () => {
    for (const m of HEX_MAPS) {
      const b = buildBoard(m);
      expect(b.hex).toBe(true);
      for (const p of b.planets) {
        expect(orbitals(b, p)).toHaveLength(6);
        // Each orbital space is next to its own planet only.
        for (const q of orbitals(b, p)) expect(b.planets.filter((x) => distance(x, q, b) === 1)).toEqual([p]);
      }
      expect(spaces(b)).toHaveLength(b.planets.length * 6);
    }
    const b = BASE.board;
    expect(b.planets.filter((p) => distance(p, CENTRE, b) === 3)).toHaveLength(6);
  });

  it('finds each tile’s middle: its planet', () => {
    for (const m of [...HEX_MAPS, MAPS.find((x) => x.id === 'alpha-sector')!]) {
      const b = buildBoard(m);
      const centres = tileCentres(b);
      expect(centres.size).toBe(new Set(b.cells.flat().flatMap((x) => (x.kind === 'off' ? [] : [x.tile]))).size);
      for (const p of b.planets) expect(centres.get(b.cells[p.r][p.c].tile)).toEqual({ r: p.r, c: p.c });
    }
  });

  it('touches the 8 spaces around a square but only a hex’s 6 sides', () => {
    const square = buildBoard(MAPS.find((x) => x.id === 'alpha-sector')!);
    expect(surrounding(square, { r: 4, c: 4 })).toHaveLength(8);
    expect(geometry(square).touching).toHaveLength(8);
    const p = orbitals(BASE.board, CENTRE)[0];
    expect(surrounding(BASE.board, p)).toEqual(adjacent(BASE.board, p));
  });

  it('measures distance in hexes', () => {
    const b = BASE.board;
    const p = orbitals(b, CENTRE)[0];
    for (const q of adjacent(b, p)) expect(distance(p, q, b)).toBe(1);
    expect(adjacent(b, CENTRE)).toHaveLength(6);
    // Two steps straight on, or a diagonal: both 2 away.
    expect(distance({ r: 0, c: 0 }, { r: 2, c: 0 }, b)).toBe(2);
    expect(distance({ r: 0, c: 0 }, { r: 1, c: 1 }, b)).toBe(2);
    expect(distance({ r: 0, c: 0 }, { r: 3, c: -3 }, b)).toBe(3);
  });

  it('draws flat-topped hexes: neighbours one space apart, diagonals √3', () => {
    const b = BASE.board;
    const { at } = drawing(b);
    const g = grid(b);
    for (const p of spaces(b)) {
      const i = p.r * b.cols + p.c;
      for (const q of g.orthoCells[i]) expect(Math.hypot(at(p).r - at(q).r, at(p).c - at(q).c)).toBeCloseTo(1);
      for (const q of g.aroundCells[i].filter((x) => isDiagonalStep(p, x, b)))
        expect(Math.hypot(at(p).r - at(q).r, at(p).c - at(q).c)).toBeCloseTo(Math.sqrt(3));
      // A tap on a space's middle finds it.
      expect(cellAtPoint(b, at(p).r + 0.5, at(p).c + 0.5)).toEqual(p);
    }
  });

  it('moves a ship across hexes, up to its number', () => {
    const from = orbitals(BASE.board, CENTRE)[0];
    const s = scenario({ p0d0: [from, 1] });
    const moves = [...moveOptions(s, 'p0d0').moves.values()].map((m) => m.cell);
    // Next to the planet, a Battlestation (moves 1) has the 5 spaces around it that aren't the planet.
    expect(moves).toHaveLength(5);
    for (const q of moves) expect(distance(from, q, s.board)).toBe(1);
    const s3 = scenario({ p0d0: [from, 3] });
    for (const m of moveOptions(s3, 'p0d0').moves.values()) expect(distance(from, m.cell, s3.board)).toBeLessThanOrEqual(3);
  });

  it('lets the Interceptor slip out diagonally, between two hexes, when every neighbour is taken', () => {
    const b = BASE.board;
    const from = orbitals(b, CENTRE)[0];
    const walls = adjacent(b, from).filter((q) => b.cells[q.r][q.c].kind === 'space');
    expect(walls).toHaveLength(5);
    const ids = ['p0d1', 'p0d2', 'p0d3', 'p0d4', 'p1d0'];
    const boxed = (value: number) =>
      scenario({ p0d0: [from, value], ...Object.fromEntries(walls.map((q, i) => [ids[i], [q, 6] as [Cell, number]])) });
    expect(moveOptions(boxed(4), 'p0d0').moves.size).toBe(0);
    const out = [...moveOptions(boxed(5), 'p0d0').moves.values()];
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((m) => m.diagonal)).toBe(true);
  });

  it('counts ships on any of a planet’s six orbital hexes towards a conquest', () => {
    const [, , a, b, c, d] = orbitals(BASE.board, CENTRE);
    const s = scenario({ p0d0: [a, 1], p0d1: [b, 1], p0d2: [c, 2], p0d3: [d, 4] });
    expect(conquerCheck(s, 0, CENTRE.id)).toMatchObject({ ok: true, sum: 8 });
    const after = apply(s, { type: 'conquer', planet: CENTRE.id });
    expect(after.board.planets[CENTRE.id].cubes).toContain(0);
  });

  it('carries only ships on the six touching hexes, not diagonal ones', () => {
    const b = BASE.board;
    const from = orbitals(b, CENTRE)[0];
    const side = adjacent(b, from).find((q) => b.cells[q.r][q.c].kind === 'space')!;
    const diagonal = grid(b).aroundCells[from.r * b.cols + from.c].find(
      (q) => isDiagonalStep(from, q, b) && b.cells[q.r][q.c].kind === 'space',
    )!;
    expect(carryPassengers(scenario({ p0d0: [from, 2], p0d1: [side, 3] }), 'p0d0').map((d) => d.id)).toEqual(['p0d1']);
    expect(carryPassengers(scenario({ p0d0: [from, 2], p0d1: [diagonal, 3] }), 'p0d0')).toEqual([]);
  });

  for (const m of HEX_MAPS)
    it(`plays out with AI players on ${m.name}`, () => {
      const { state } = playAiGame({
        mode: 'prototyping',
        players: m.players,
        seed: 3,
        aiSeed: 7,
        mapId: m.id,
        levels: Array(m.players).fill(2),
      });
      expect(state.winner).not.toBeNull();
    }, 60_000);
});
