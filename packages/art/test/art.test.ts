import { describe, expect, it } from 'vitest';
import { PLANET_DIAMETER, SET_COUNTS, TILE_SET, assignTiles, cubePadCentres, tileSpec, tileSvg } from '../src';
import { CUBE_PAD } from '../src/tokens';
import maps from '../../engine/src/data/maps.json';

describe('tile art', () => {
  it('is the same every time for the same tile', () => {
    const spec = tileSpec('p9-02');
    expect(tileSvg(spec, { markings: true })).toBe(tileSvg(tileSpec('p9-02'), { markings: true }));
  });

  it('differs between tiles', () => {
    expect(tileSvg(tileSpec('p7-01'))).not.toBe(tileSvg(tileSpec('p7-02')));
  });

  it('renders every tile in the set without bad numbers', () => {
    for (const t of TILE_SET) {
      for (const svg of [tileSvg(t, { markings: true, bleed: true }), tileSvg(t, { rounded: true })]) {
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
        expect(svg.startsWith('<svg')).toBe(true);
      }
    }
  });

  it('includes the bleed only when asked', () => {
    expect(tileSvg(tileSpec('p8-01'))).toContain('viewBox="0 0 96 96"');
    expect(tileSvg(tileSpec('p8-01'), { bleed: true })).toContain('viewBox="-3 -3 102 102"');
  });
});

describe('tile set', () => {
  it('has unique ids and the counts the set needs', () => {
    expect(new Set(TILE_SET.map((t) => t.id)).size).toBe(TILE_SET.length);
    expect(TILE_SET.length).toBe(Object.values(SET_COUNTS).reduce((a, b) => a + b, 0));
  });

  it('covers every map without running out of tiles', () => {
    const ids = new Set(TILE_SET.map((t) => t.id));
    for (const map of maps) {
      const tiles = map.layout.flat().filter((x) => x !== '.').map((x, index) => ({ index, number: Number(x.replace('*', '')) }));
      for (const id of assignTiles(tiles).values()) expect(ids, `${map.id}: ${id}`).toContain(id);
    }
  });
});

describe('cube pads', () => {
  it('fit inside the printed planet', () => {
    for (const num of [7, 8, 9, 10]) {
      const R = PLANET_DIAMETER[num] / 2;
      const h = CUBE_PAD.size / 2;
      for (const p of cubePadCentres(num - 6, 0, 0)) {
        const far = Math.hypot(Math.abs(p.x) + h, Math.abs(p.y) + h);
        expect(far, `planet ${num}`).toBeLessThan(R);
      }
    }
  });
});
