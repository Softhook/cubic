/**
 * Planets off the middle of their tiles (data/maps.yaml): a tile token's direction moves the planet to
 * one of the spaces around the middle, corners too on squares. Its orbit is still the spaces next to it,
 * so it reaches onto neighbouring tiles, loses spaces off the map's edge, and may overlap another's.
 */
import { describe, expect, it } from 'vitest';
import {
  MAPS,
  RULESETS,
  adjacent,
  apply,
  buildBoard,
  cellAt,
  conquerCheck,
  diagonals,
  drawing,
  mapStats,
  nomadicTargets,
  orbitals,
  orbitedPlanets,
  parseToken,
  spaces,
  tileCentres,
  tilesTouch,
  type Board,
  type Cell,
  type GameState,
  type MapDef,
} from '../src';
import { playAiGame, quickStart } from './helpers';
import { OFFSET_HEX, OFFSET_SQUARE, registerOffsetMaps } from './offsetMaps';

registerOffsetMaps();
const ALPHA_HEX = MAPS.find((m) => m.id === 'alpha-hex')!;

const map = (layout: string[][], grid?: 'hex'): MapDef => ({
  id: 'test',
  name: 'Test',
  players: 2,
  group: 'test',
  cubes: 5,
  stats: { slack: 0, shared: null, planets: 0 },
  layout,
  ...(grid ? { grid } : {}),
});
const at = (b: Board, number: number, nth = 0) => b.planets.filter((p) => p.number === number)[nth];
const tilesOf = (b: Board, cells: readonly Cell[]) => cells.map((p) => cellAt(b, p)!.tile);
const sorted = (cells: readonly Cell[]) => cells.map((p) => `${p.r},${p.c}`).sort();

/** Player 0 to act with 3 fresh actions, only the listed ships on the map, at [cell, value]. */
function scenario(base: GameState, dice: Record<string, [Cell, number]>): GameState {
  const s = structuredClone(base);
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

describe('tile tokens', () => {
  it('read a number, a direction and a start, in that order', () => {
    expect(parseToken('8')).toEqual({ number: 8, start: false });
    expect(parseToken('9*')).toEqual({ number: 9, start: true });
    expect(parseToken('7ne')).toEqual({ number: 7, start: false, dir: 'ne' });
    expect(parseToken('10s*')).toEqual({ number: 10, start: true, dir: 's' });
    expect(parseToken('0')).toEqual({ number: 0, start: false });
  });

  it('refuse anything else', () => {
    for (const t of ['x', '6', '8*n', '8en', '8nn', '0n', '0*', '']) expect(() => parseToken(t), t).toThrow();
  });

  it('put the planet that way from the middle as the map is drawn, north up', () => {
    // Degrees anticlockwise from east; the drawing's y runs down.
    const square = { e: 0, ne: 45, n: 90, nw: 135, w: 180, sw: -135, s: -90, se: -45 };
    const hex = { ne: 30, n: 90, nw: 150, sw: -150, s: -90, se: -30 };
    for (const [grid, angles] of [
      [undefined, square],
      ['hex', hex],
    ] as const)
      for (const [dir, angle] of Object.entries(angles)) {
        const b = buildBoard(map([[`7${dir}`]], grid));
        const { at } = drawing(b);
        const [p, m] = [at(b.planets[0]), at(tileCentres(b).get(0)!)];
        const drawn = (Math.atan2(m.r - p.r, p.c - m.c) * 180) / Math.PI;
        expect(drawn, `${grid ?? 'square'} ${dir}`).toBeCloseTo(angle, 6);
      }
  });

  it('refuse east and west on hexes, which have no side that way', () => {
    expect(() => buildBoard(map([['7e']], 'hex'))).toThrow(/hex tile/);
    expect(() => buildBoard(map([['7w']], 'hex'))).toThrow(/hex tile/);
  });

  it("don't change a map's stats", () => {
    const plain = (m: MapDef) => ({ ...m, layout: m.layout.map((row) => row.map((t) => (t === '.' ? t : t.replace(/[nsew]/g, '')))) });
    for (const m of [OFFSET_SQUARE, OFFSET_HEX]) expect(mapStats(m)).toEqual(mapStats(plain(m)));
  });
});

describe('an off-centre planet on squares', () => {
  it('sits next to the middle, which becomes a space; the middle is still the tile centre', () => {
    const b = buildBoard(map([['7'], ['8n']]));
    expect(at(b, 8)).toMatchObject({ r: 3, c: 1 });
    expect(cellAt(b, { r: 4, c: 1 })).toMatchObject({ kind: 'space', tile: 1 });
    expect(tileCentres(b).get(1)).toEqual({ r: 4, c: 1 });
  });

  it('orbits three spaces of its own tile and one of the tile it faces', () => {
    const b = buildBoard(map([['7'], ['8n']]));
    const orbit = orbitals(b, at(b, 8));
    expect(sorted(orbit)).toEqual(
      sorted([
        { r: 4, c: 1 },
        { r: 3, c: 0 },
        { r: 3, c: 2 },
        { r: 2, c: 1 },
      ]),
    );
    expect(tilesOf(b, orbit).sort()).toEqual([0, 1, 1, 1]);
  });

  it('shares an orbital space with the planet it faces', () => {
    const b = buildBoard(map([['7'], ['8n']]));
    expect(orbitedPlanets(b, { r: 2, c: 1 }).map((p) => p.number)).toEqual([7, 8]);
    expect(orbitedPlanets(b, { r: 0, c: 1 }).map((p) => p.number)).toEqual([7]);
    expect(orbitedPlanets(b, { r: 5, c: 1 })).toEqual([]);
  });

  it('in a corner, orbits two spaces of its own tile and one each of two others', () => {
    const b = buildBoard(
      map([
        ['7', '7'],
        ['7', '8nw'],
      ]),
    );
    const orbit = orbitals(b, at(b, 8));
    expect(at(b, 8)).toMatchObject({ r: 3, c: 3 });
    expect(tilesOf(b, orbit).sort()).toEqual([1, 2, 3, 3]);
    // Its diagonal on the tile across the corner is that tile's corner space.
    expect(diagonals(b, at(b, 8))).toContainEqual({ r: 2, c: 2 });
  });

  it("facing the map's edge, orbits only three spaces; in a corner of the map, two", () => {
    const edge = buildBoard(map([['7n']]));
    expect(orbitals(edge, edge.planets[0])).toHaveLength(3);
    const corner = buildBoard(map([['7nw']]));
    expect(orbitals(corner, corner.planets[0])).toHaveLength(2);
  });

  it("doesn't orbit a planet next to it", () => {
    const b = buildBoard(map([['7e', '7w']]));
    for (const p of b.planets) {
      expect(orbitals(b, p)).toHaveLength(3);
      expect(orbitals(b, p).every((q) => cellAt(b, q)!.kind === 'space')).toBe(true);
    }
  });
});

describe('an off-centre planet on hexes', () => {
  it('sits on any of the six outer hexes, orbiting three of its own tile and three of two others', () => {
    for (const dir of ['n', 'ne', 'se', 's', 'sw', 'nw']) {
      const layout = ALPHA_HEX.layout.map((row) => row.map((t) => (t === '8' ? `8${dir}` : t)));
      const b = buildBoard(map(layout, 'hex'));
      const eight = at(b, 8);
      const own = cellAt(b, eight)!.tile;
      const centre = tileCentres(b).get(own)!;
      expect(cellAt(b, centre)!.kind, dir).toBe('space');
      const tiles = tilesOf(b, orbitals(b, eight));
      expect(tiles, dir).toHaveLength(6);
      const counts = [...new Set(tiles)].map((t) => tiles.filter((x) => x === t).length);
      expect(counts.sort(), dir).toEqual([1, 2, 3]);
      expect(
        tiles.filter((t) => t === own),
        dir,
      ).toHaveLength(3);
    }
  });

  it('loses an orbital hex to a planet leaning towards it', () => {
    const b = buildBoard(OFFSET_HEX);
    const eight = at(b, 8);
    const next = adjacent(b, eight).flatMap((q) => cellAt(b, q)!.planet ?? []);
    expect(next.map((id) => b.planets[id].number)).toEqual([7]);
    expect(orbitals(b, eight)).toHaveLength(5);
  });

  it('leaves three hexes of its tile in no orbit (all hexes orbit a planet on centred hex maps)', () => {
    const b = buildBoard(map([['7n']], 'hex'));
    const flower = [...tileCentres(b).values()];
    expect(flower).toHaveLength(1);
    const free = b.cells.flat().filter((x) => x.kind === 'space').length - orbitals(b, b.planets[0]).length;
    expect(free).toBe(3);
  });
});

describe('starting planets', () => {
  it('need room for the 3 starting ships in orbital spaces no other start shares', () => {
    expect(() => buildBoard(map([['7nw*']]))).toThrow(/starting planet 7 has 2/);
    expect(() => buildBoard(map([['7n*', '7nw*']]))).toThrow(/has 2 orbital spaces of its own/);
    expect(() => buildBoard(map([['7n*', '7nw']]))).not.toThrow();
  });
});

describe('playing with off-centre planets', () => {
  const base = quickStart(2, 1, 'basic', 'offset-square');
  const b = base.board;
  const eight = at(b, 8);
  const above = b.planets.find((p) => p.number === 7 && p.r === 2 && p.c === 4)!;

  it("the test map's 8 has its whole orbit shared with the 7s leaning in", () => {
    for (const q of orbitals(b, eight)) expect(orbitedPlanets(b, q)).toHaveLength(2);
  });

  it('a ship in a shared orbital space counts towards both planets', () => {
    const shared = { r: 3, c: 4 };
    expect(orbitedPlanets(b, shared)).toEqual([above, eight]);
    const s = scenario(base, {
      p0d0: [shared, 3],
      p0d1: [{ r: 1, c: 4 }, 4],
      p0d2: [{ r: 5, c: 4 }, 5],
    });
    expect(conquerCheck(s, 0, above.id)).toMatchObject({ ok: true, sum: 7 });
    expect(conquerCheck(s, 0, eight.id)).toMatchObject({ ok: true, sum: 8 });
    expect(apply(s, { type: 'conquer', planet: above.id }).board.planets[above.id].cubes).toContain(0);
    expect(apply(s, { type: 'conquer', planet: eight.id }).board.planets[eight.id].cubes).toContain(0);
  });

  it('a move into a shared space names both planets', () => {
    const s = scenario(base, { p0d0: [{ r: 3, c: 3 }, 1] });
    const after = apply(s, { type: 'move', die: 'p0d0', to: { r: 3, c: 4 } });
    const entry = after.log.at(-1)!;
    expect(entry.text).toMatch(/next to planet 7 and planet 8/);
    expect(entry.planets).toEqual([above.id, eight.id]);
  });

  it("Nomadic reaches the planets of the tiles next to the ship's planets' tiles, however far the planets are", () => {
    const s = scenario(quickStart(2, 1, 'original', 'offset-square'), { p0d0: [{ r: 1, c: 4 }, 3] });
    // The 7 leaning south on the top middle tile: its tile touches the starts' and the 8's tiles, not the
    // far corners'. The 7 on the top right tile faces the map's edge, 4 steps from it, yet it's a neighbour.
    const homeTile = cellAt(s.board, above)!.tile;
    const near = s.board.planets.filter((p) => tilesTouch(s.board, homeTile, cellAt(s.board, p)!.tile));
    expect(near.map((p) => `${p.number}@${p.r},${p.c}`).sort()).toEqual(['7@0,7', '7@2,2', '8@4,4']);
    const targets = nomadicTargets(s, 'p0d0');
    const want = near.flatMap((p) => orbitals(s.board, p));
    expect(sorted(targets)).toEqual([...new Set(sorted(want))]);
  });

  it("Nomadic doesn't move a ship around the planets it already orbits, even on touching tiles", () => {
    // (3,4) orbits the 7 above the 8 and the 8, whose tiles touch: neither is the other's neighbour here.
    const s = scenario(quickStart(2, 1, 'original', 'offset-square'), { p0d0: [{ r: 3, c: 4 }, 3] });
    const homes = orbitedPlanets(s.board, { r: 3, c: 4 });
    expect(homes).toEqual([above, eight]);
    const tileOf = (p: { r: number; c: number }) => cellAt(s.board, p)!.tile;
    const near = s.board.planets.filter((p) => !homes.includes(p) && homes.some((h) => tilesTouch(s.board, tileOf(h), tileOf(p))));
    expect(near).toHaveLength(5);
    const targets = nomadicTargets(s, 'p0d0');
    expect(sorted(targets)).toEqual([...new Set(sorted(near.flatMap((p) => orbitals(s.board, p))))]);
    // Only the 7's own orbit: not a target. Shared with a neighbour (the 8 and the 7 to its left): a target.
    expect(targets).not.toContainEqual({ r: 1, c: 4 });
    expect(targets).toContainEqual({ r: 4, c: 3 });
  });

  it('a move to a space in no orbit names every planet it is diagonal to', () => {
    const s = scenario(base, { p0d0: [{ r: 2, c: 3 }, 1] });
    const after = apply(s, { type: 'move', die: 'p0d0', to: { r: 3, c: 3 } });
    const entry = after.log.at(-1)!;
    expect(orbitedPlanets(b, { r: 3, c: 3 })).toEqual([]);
    expect(entry.planets).toHaveLength(4);
    expect(entry.text).toMatch(/next to planet 7 and planet 7 and planet 7 and planet 8/);
  });

  it('diagonal tiles on squares do not touch', () => {
    expect(tilesTouch(b, 0, 4)).toBe(false);
    expect(tilesTouch(b, 0, 1)).toBe(true);
    expect(tilesTouch(b, 1, 4)).toBe(true);
  });

  for (const mapId of ['offset-square', 'offset-hex'])
    for (const mode of ['basic', 'original'] as const)
      it(`AI plays a ${mode} game on ${mapId} to the end`, () => {
        const { state } = playAiGame({ mode, players: 2, seed: 5, aiSeed: 7, mapId });
        expect(state.winner).not.toBeNull();
      }, 60_000);
});

describe('the drift maps', () => {
  const drift = MAPS.filter((m) => m.group === 'drift');

  it('are a square and a hex map, in Basic mode', () => {
    expect(drift.map((m) => [m.id, m.grid ?? 'square'])).toEqual([
      ['binary-reach', 'square'],
      ['twin-drift', 'hex'],
    ]);
    expect(RULESETS.basic.mapGroups).toContain('drift');
  });

  for (const m of drift) {
    const b = buildBoard(m);

    it(`${m.name} is the same turned half a turn: each planet matches one across the middle`, () => {
      const { at, rows, cols } = drawing(b);
      for (const p of b.planets) {
        const q = at(p);
        const twin = b.planets.find((x) => {
          const y = at(x);
          return Math.abs(q.r + y.r - (rows - 1)) < 1e-9 && Math.abs(q.c + y.c - (cols - 1)) < 1e-9;
        });
        expect(twin, `planet ${p.number} at ${p.r},${p.c}`).toBeDefined();
        expect([twin!.number, twin!.start, orbitals(b, twin!).length]).toEqual([p.number, p.start, orbitals(b, p).length]);
      }
    });

    it(`${m.name} has orbits that overlap`, () => {
      expect(spaces(b).filter((q) => orbitedPlanets(b, q).length > 1).length).toBeGreaterThanOrEqual(4);
    });

    it(`AI plays a basic game on ${m.name} to the end`, () => {
      const { state } = playAiGame({ mode: 'basic', players: 2, seed: 5, aiSeed: 7, mapId: m.id, levels: [2, 2] });
      expect(state.winner).not.toBeNull();
    }, 60_000);
  }
});
