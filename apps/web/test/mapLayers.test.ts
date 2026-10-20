/** What the map's live layers mark, worked out from the board (MapTiles): space roles, number corners, labels. */
import { describe, expect, it } from 'vitest';
import { MAPS, buildBoard } from '@quantum/engine';
import { labelFits, numberCorner, spaceRoles } from '../src/components/board/layers';

const board = (id: string) => buildBoard(MAPS.find((m) => m.id === id)!);

describe('space roles', () => {
  it('on a square map with planets in the middle: the 4 beside each planet orbit it, the corners nothing', () => {
    const roles = spaceRoles(board('alpha-sector'));
    expect(roles.filter((s) => s.orbits === 1)).toHaveLength(9 * 4);
    expect(roles.filter((s) => s.orbits === 0)).toHaveLength(9 * 4);
    expect(roles.some((s) => s.orbits > 1)).toBe(false);
  });

  it('on a hex map with planets in the middle: every hex orbits its planet', () => {
    expect(spaceRoles(board('alpha-hex')).every((s) => s.orbits === 1)).toBe(true);
  });

  it('marks the spaces where off-centre planets share an orbit, and orbits reaching onto a Void', () => {
    expect(spaceRoles(board('binary-reach')).filter((s) => s.orbits > 1)).toHaveLength(4);
    const drift = spaceRoles(board('twin-drift'));
    expect(drift.filter((s) => s.orbits > 1)).toHaveLength(6);
    expect(drift.filter((s) => s.void && s.orbits > 0)).toHaveLength(2);
  });
});

describe('planet numbers', () => {
  it('go in the printed bottom right where nothing is in the way', () => {
    const b = board('alpha-sector');
    for (const p of b.planets) expect(numberCorner(b, p)).toEqual({ x: 1, y: 1 });
  });

  it('move to another corner when a planet next door is in the way', () => {
    const b = board('binary-reach');
    // The lower 10 leans towards the 7 at its bottom right, which shares its orbit.
    const ten = b.planets.find((p) => p.number === 10 && p.r === 5)!;
    expect(numberCorner(b, ten)).not.toEqual({ x: 1, y: 1 });
  });
});

describe('flavour labels', () => {
  it('fit beside every planet in the middle of a square tile', () => {
    const b = board('alpha-sector');
    expect(b.planets.every((p) => labelFits(b, p))).toBe(true);
  });

  it("don't fit where the spaces up and left of the planet are another tile's, nor on hexes", () => {
    const b = board('binary-reach');
    // The start in the top left sits in its tile's bottom right corner: up and left are its own tile's.
    expect(
      labelFits(
        b,
        b.planets.find((p) => p.r === 2 && p.c === 2)!,
      ),
    ).toBe(true);
    // The 7 on the left edge sits in its tile's bottom left: left of it is off the map.
    expect(
      labelFits(
        b,
        b.planets.find((p) => p.r === 5 && p.c === 0)!,
      ),
    ).toBe(false);
    const h = board('alpha-hex');
    expect(h.planets.some((p) => labelFits(h, p))).toBe(false);
  });
});
