import { describe, expect, it } from 'vitest';
import { PLANET_DIAMETER, SET_COUNTS, TILE_SET, TILE, assignTiles, editableTileSvg, numberPlacement, cubePadCentres, tileSpec, tileSvg } from '../src';
import { CUBE_PAD } from '../src/tokens';
import maps from '../../engine/src/data/maps.json';
import cards from '../../engine/src/data/cards.json';
import { cardBackSvg, cardCategory, cardSvg, CARD_CATEGORIES, type CardDeck } from '../src/card';

/** Gap between a box (centre, half-width, half-height) and a square (centre, half-size). */
const boxGap = (cx: number, cy: number, hw: number, hh: number, x: number, y: number, h: number) =>
  Math.hypot(Math.max(0, Math.abs(cx - x) - hw - h), Math.max(0, Math.abs(cy - y) - hh - h));
const DIE = 19;

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

  it('exports for Illustrator with nothing it can\'t read: art as one image, markings as plain vectors', () => {
    for (const t of TILE_SET) {
      const svg = editableTileSvg(t, 'data:image/png;base64,AAAA', { markings: true, bleed: true });
      expect(svg).not.toMatch(/<filter|<mask|clip-path|hsl\(|paint-order|dominant-baseline|NaN|undefined/);
      expect(svg).toContain('xlink:href="data:image/png');
      expect(svg).toContain('<g id="markings">');
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

describe('planet number', () => {
  it('sits on the bottom-right diagonal, at the corner where the spaces meet unless its pads push it out', () => {
    for (const num of [7, 8, 9, 10]) {
      const at = numberPlacement(num);
      expect(at.x, `planet ${num}`).toBe(at.y);
      expect(at.x, `planet ${num}`).toBeGreaterThanOrEqual(TILE.cell / 2);
      expect(at.x, `planet ${num}`).toBeLessThan(TILE.cell / 2 + 1.5);
    }
  });

  it('stays clear of the cube pads and of 19 mm dice in the spaces around the planet', () => {
    for (const num of [7, 8, 9, 10]) {
      const at = numberPlacement(num);
      for (const p of cubePadCentres(num - 6, 0, 0)) {
        expect(boxGap(at.x, at.y, at.halfW, at.halfH, p.x, p.y, CUBE_PAD.size / 2), `planet ${num} pad`).toBeGreaterThan(0.5);
      }
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
        expect(boxGap(at.x, at.y, at.halfW, at.halfH, dx * TILE.cell, dy * TILE.cell, DIE / 2), `planet ${num} die`).toBeGreaterThan(0);
      }
    }
  });
});

describe('card art', () => {
  type Def = { id: string; name: string; subtitle: string; text: string; category?: string; count: number };
  const decks: [CardDeck, Def[]][] = [
    ['skill', cards.skills],
    ['tactic', cards.tactics],
    ['expansion', cards.expansion],
    ['command', cards.original_command],
    ['gambit', cards.original_gambit],
  ];
  const faces = decks.flatMap(([deck, list]) => list.map((c, i) => ({ ...c, deck, copies: c.count, index: i + 1, deckSize: list.length })));

  it('renders every card and back without bad numbers', () => {
    for (const f of faces) {
      for (const svg of [cardSvg(f, { bleed: true }), cardSvg(f, { rounded: true })]) {
        expect(svg, f.id).not.toMatch(/NaN|undefined|Infinity/);
        expect(svg.startsWith('<svg')).toBe(true);
      }
    }
    for (const [deck] of decks) expect(cardBackSvg(deck, { bleed: true })).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('is the same every time for the same card, and differs between cards', () => {
    const [a, b] = faces;
    expect(cardSvg(a)).toBe(cardSvg({ ...a }));
    expect(cardSvg(a)).not.toBe(cardSvg(b));
  });

  it('gives every card a known category, so it has a colour and an icon', () => {
    for (const f of faces) expect(CARD_CATEGORIES[cardCategory(f)], f.id).toBeDefined();
  });

  it('is poker size, with bleed when asked', () => {
    expect(cardSvg(faces[0])).toContain('width="63.5mm" height="88.9mm"');
    expect(cardSvg(faces[0], { bleed: true })).toContain('width="69.5mm" height="94.9mm"');
  });
});
