/** What the map's live layers mark, worked out from the board (MapTiles): space roles, number corners, labels. */
import { describe, expect, it } from 'vitest';
import { MAPS, buildBoard, tileCentres, type MapDef } from '@cubic/engine';
import { OFF_CENTRE, TILE_LAYERS } from '@cubic/art';
import { labelFits, mapStack, numberCorner, spaceRoles } from '../src/components/board/layers';
import { tileArt } from '../src/art/boardTiles';

const board = (id: string) => buildBoard(MAPS.find((m) => m.id === id)!);
const testMap = (layout: string[][]): MapDef => ({
  id: 't',
  name: 't',
  players: 2,
  group: 't',
  cubes: 4,
  stats: { slack: 0, shared: null, planets: 0 },
  layout,
});
/**
 * Planets off the middle of their tiles: the two middle 7s each lean toward a 7 on the next tile, sharing two
 * orbital spaces; the outer 7s sit against the map's edge; the 10s stay in the middle.
 */
const binaryReach = () =>
  buildBoard(
    testMap([
      ['8se*', '10', '7sw', '.'],
      ['7sw', '7s', '7n', '7ne'],
      ['.', '7ne', '10', '8nw*'],
    ]),
  );

describe('space roles', () => {
  it('on a square map with planets in the middle: the 4 beside each planet orbit it, the corners nothing', () => {
    const roles = spaceRoles(board('alpha-sector'));
    expect(roles.filter((s) => s.orbits === 1)).toHaveLength(9 * 4);
    expect(roles.filter((s) => s.orbits === 0)).toHaveLength(9 * 4);
    expect(roles.some((s) => s.orbits > 1)).toBe(false);
  });

  it('marks the spaces where off-centre planets share an orbit', () => {
    expect(spaceRoles(binaryReach()).filter((s) => s.orbits > 1)).toHaveLength(4);
  });

  it('marks an orbit reaching onto a Void, which keeps its flask', () => {
    // A 7 leaning onto the Void next to it: one of the Void's spaces orbits it.
    const b = buildBoard(testMap([['7e*', '0', '7*']]));
    expect(spaceRoles(b).filter((s) => s.void && s.orbits > 0)).toHaveLength(1);
  });
});

describe('planet numbers', () => {
  it('go in the printed bottom right on a planet in the middle of its tile', () => {
    const b = board('alpha-sector');
    for (const p of b.planets) expect(numberCorner(b, p)).toEqual({ x: 1, y: 1 });
  });

  it("go in the planet's corner nearest its tile's middle, as the printed tile has it", () => {
    const b = binaryReach();
    const at = (r: number, c: number) =>
      numberCorner(
        b,
        b.planets.find((p) => p.r === r && p.c === c)!,
      );
    expect(at(2, 2)).toEqual({ x: -1, y: -1 }); // 8se*: top left
    expect(at(3, 11)).toEqual({ x: -1, y: 1 }); // 7ne, on the map's right edge: bottom left
    expect(at(5, 4)).toEqual({ x: 1, y: -1 }); // 7s: top right
  });

  it('stay on their own tile where two planets lean together', () => {
    const b = buildBoard(testMap([['8e*', '8w*']]));
    expect(b.planets.map((p) => numberCorner(b, p).x)).toEqual([-1, 1]);
  });
});

describe('flavour labels', () => {
  it('fit beside every planet in the middle of a square tile', () => {
    const b = board('alpha-sector');
    expect(b.planets.every((p) => labelFits(b, p))).toBe(true);
  });

  it("fit beside an off-centre planet whose spaces up and left are its own tile's", () => {
    const b = binaryReach();
    // The middle 7 at the bottom of its tile, its number in the top right.
    expect(
      labelFits(
        b,
        b.planets.find((p) => p.r === 5 && p.c === 4)!,
      ),
    ).toBe(true);
  });

  it('give way to the number in the top left', () => {
    const b = binaryReach();
    // The start in the top left sits in its tile's bottom right corner, its number up and left.
    expect(
      labelFits(
        b,
        b.planets.find((p) => p.r === 2 && p.c === 2)!,
      ),
    ).toBe(false);
  });

  it("don't fit where the spaces up and left of the planet are off its tile", () => {
    const b = binaryReach();
    // The 7 on the left edge sits in its tile's bottom left: left of it is off the map.
    expect(
      labelFits(
        b,
        b.planets.find((p) => p.r === 5 && p.c === 0)!,
      ),
    ).toBe(false);
  });
});

describe('map design', () => {
  // An off-centre planet sits on its tile's edge space: only the planets that fit there (art OFF_CENTRE).
  it('puts only 7s and 8s off the middle of a tile', () => {
    const spill = MAPS.flatMap((m) => {
      const b = buildBoard(m);
      const middles = new Set([...tileCentres(b).values()].map((t) => `${t.r},${t.c}`));
      return b.planets
        .filter((p) => !middles.has(`${p.r},${p.c}`) && !OFF_CENTRE.includes(p.number))
        .map((p) => `${m.id}: ${p.number} at ${p.r},${p.c}`);
    });
    expect(spill).toEqual([]);
  });
});

describe('the map stacks a tile’s layers', () => {
  it('as printed, each run of images in one group per tile, under and over what it draws from the board', () => {
    expect(mapStack(TILE_LAYERS)).toEqual([['sky', 'body'], 'label', 'spaces', 'planet']);
  });
});

describe('tile art', () => {
  it('gives a Void a Void’s artwork, in the map’s order', () => {
    const b = buildBoard(testMap([['7*', '0', '7*']]));
    expect(tileArt(b).map((t) => t.id)).toEqual(['p7-01', 'void', 'p7-02']);
  });
});
