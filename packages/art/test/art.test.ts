import { describe, expect, it } from 'vitest';
import {
  PLANET_DIAMETER,
  SET_COUNTS,
  TILE_SET,
  TILE_SPOTS,
  TILE,
  assignTiles,
  editableTileSvg,
  numberCorner,
  numberPlacement,
  cubePadCentres,
  tileSpec,
  tileSvg,
} from '../src';
import { CUBE_PAD } from '../src/tokens';
import { boxGap } from '../src/tile/geometry';
import maps from '../../engine/src/data/maps.json';
import { parseToken } from '../../engine/src/board';
import cards from '../../engine/src/data/cards.json';
import { cardBackSvg, cardSvg, type CardDeck } from '../src/card';
import { ICONS } from '../src/icons';
import { CARD_CATEGORIES } from '../src/tokens';
import { ILLUSTRATIONS } from '../src/illustrations';
import { rng } from '../src/rng';
import { MIN_TEXT, playerAidSvg } from '../src/aid';
import { shipDie } from '../src/kit/starships';
import { PRESS_TEST, pressTestSvg } from '../src/proof';

const DIE = 19;

/** Checks that an SVG has no bad numbers, duplicate attributes, duplicate ids or broken `url(#…)` references. */
function checkSvg(svg: string, label = '') {
  expect(svg, label).not.toMatch(/NaN|undefined|Infinity/);
  expect(svg.startsWith('<svg'), label).toBe(true);
  for (const [tag] of svg.matchAll(/<[a-z][^>]*>/g)) {
    const names = [...tag.matchAll(/\s([\w:-]+)=/g)].map((m) => m[1]);
    expect(new Set(names).size, `${label}: ${tag.slice(0, 80)}`).toBe(names.length);
  }
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const idSet = new Set(ids);
  expect(idSet.size, `${label}: duplicate id`).toBe(ids.length);
  for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) {
    expect(idSet.has(ref), `${label}: missing #${ref}`).toBe(true);
  }
}

describe('tile art', () => {
  it('is the same every time for the same tile', () => {
    const spec = tileSpec('p9-02');
    expect(tileSvg(spec, { markings: true })).toBe(tileSvg(tileSpec('p9-02'), { markings: true }));
  });

  it('differs between tiles', () => {
    expect(tileSvg(tileSpec('p7-01'))).not.toBe(tileSvg(tileSpec('p7-02')));
  });

  it('renders every tile in the set without bad numbers or broken references', () => {
    for (const t of TILE_SET) {
      for (const svg of [tileSvg(t, { markings: true, bleed: true }), tileSvg(t, { rounded: true })]) {
        checkSvg(svg, t.id);
      }
    }
  });

  it("exports for Illustrator with nothing it can't read: art as one image, markings as plain vectors", () => {
    for (const t of TILE_SET) {
      const svg = editableTileSvg(t, 'data:image/png;base64,AAAA', { markings: true, bleed: true });
      expect(svg).not.toMatch(/<filter|<mask|clip-path|hsl\(|paint-order|dominant-baseline|NaN|undefined/);
      expect(svg).toContain('xlink:href="data:image/png');
      expect(svg).toContain('<g id="markings">');
    }
  });

  it('includes the bleed only when asked, without shifting any stars or artwork', () => {
    const trim = tileSvg(tileSpec('p8-01'));
    const bled = tileSvg(tileSpec('p8-01'), { bleed: true });
    expect(trim).toContain('viewBox="0 0 96 96"');
    expect(bled).toContain('viewBox="-3 -3 102 102"');
    expect(trim.slice(trim.indexOf('>') + 1)).toBe(bled.slice(bled.indexOf('>') + 1));
  });
});

describe('tile set', () => {
  it('has unique ids and the counts the set needs', () => {
    expect(new Set(TILE_SET.map((t) => t.id)).size).toBe(TILE_SET.length);
    expect(TILE_SET.length).toBe(Object.values(SET_COUNTS).reduce((a, b) => a + b, 0));
  });

  it('rejects unknown or malformed tile ids', () => {
    for (const bad of ['p6-01', 'p11-01', 'p7-00', 'void-0', 'void-abc', 'blank-01', 'foo']) {
      expect(() => tileSpec(bad), bad).toThrow(/Unknown tile id/);
    }
  });

  it('covers every map without running out of tiles', () => {
    for (const map of maps) {
      const ids = new Set(TILE_SET.map((t) => t.id));
      const tiles = map.layout
        .flat()
        .filter((x) => x !== '.')
        .map((x, index) => ({ index, number: parseToken(x).number }));
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
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        expect(boxGap(at.x, at.y, at.halfW, at.halfH, dx * TILE.cell, dy * TILE.cell, DIE / 2), `planet ${num} die`).toBeGreaterThan(0);
      }
    }
  });
});

describe('planets off the middle', () => {
  const seven = TILE_SET.find((t) => t.number === 7)!;

  it('name the same planet spots as the engine reads from a layout token', () => {
    expect(Object.keys(TILE_SPOTS).sort()).toEqual(['', 'e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
  });

  it('put the number in the corner nearest the middle, and the label only where it has room', () => {
    expect(numberCorner({ x: 0, y: 0 })).toEqual({ x: 1, y: 1 });
    expect(numberCorner(TILE_SPOTS.n)).toEqual({ x: 1, y: 1 });
    expect(numberCorner(TILE_SPOTS.e)).toEqual({ x: -1, y: 1 });
    expect(numberCorner(TILE_SPOTS.se)).toEqual({ x: -1, y: -1 });
    const named = (o: Parameters<typeof tileSvg>[1]) => tileSvg(seven, { markings: true, ...o }).includes('font-weight="700"');
    expect(named({})).toBe(true);
    expect(named({ planetAt: 's' })).toBe(true);
    expect(named({ planetAt: 'w' })).toBe(false);
  });
});

describe('card art', () => {
  type Def = { id: string; name: string; subtitle: string; text: string; category: string; count: number };
  const decks: [CardDeck, Def[]][] = [
    ['skill', cards.skills],
    ['tactic', cards.tactics],
    ['expansion', cards.expansion],
    ['command', cards.original_command],
    ['gambit', cards.original_gambit],
  ];
  const faces = decks.flatMap(([deck, list]) => list.map((c, i) => ({ ...c, deck, copies: c.count, index: i + 1, deckSize: list.length })));

  it('renders every card and back without bad numbers or broken references', () => {
    for (const f of faces) {
      for (const svg of [cardSvg(f, { bleed: true }), cardSvg(f, { rounded: true })]) {
        checkSvg(svg, f.id);
      }
    }
    for (const [deck] of decks) checkSvg(cardBackSvg(deck, { bleed: true }), `back-${deck}`);
  });

  it('is the same every time for the same card, and differs between cards', () => {
    const [a, b] = faces;
    expect(cardSvg(a)).toBe(cardSvg({ ...a }));
    expect(cardSvg(a)).not.toBe(cardSvg(b));
  });

  it('gives every card its own illustration, and no two cards the same picture unless they are the same card', () => {
    for (const f of faces) expect(ILLUSTRATIONS[f.id], f.id).toBeDefined();
    expect(Object.keys(ILLUSTRATIONS).sort()).toEqual(faces.map((f) => f.id).sort());
    // Each scene drawn with the same seed, box and colours: two cards sharing a drawing would match.
    const box = { x: 0, y: 0, w: 63.5, h: 43 };
    const seen = new Map<string, string>();
    // An original card may reuse the picture of the same card in the Community Edition (o-x → x).
    const shared = (id: string) => id.startsWith('o-') && ILLUSTRATIONS[id] === ILLUSTRATIONS[id.slice(2)];
    for (const f of faces) {
      const out = ILLUSTRATIONS[f.id].draw({ id: 'x', r: rng(1), hue: 200, box, p1: 196, p2: 328 });
      const svg = out.map((p) => p.defs + p.body).join('');
      expect(svg, f.id).not.toMatch(/NaN|undefined|Infinity/);
      if (shared(f.id)) continue;
      expect(seen.get(svg), `${f.id} draws the same as ${seen.get(svg)}`).toBeUndefined();
      seen.set(svg, f.id);
    }
  });

  it('gives every card a known category, so it has a colour and an icon', () => {
    for (const f of faces) expect(CARD_CATEGORIES[f.category], f.id).toBeDefined();
    for (const c of Object.keys(CARD_CATEGORIES)) expect(ICONS[c], c).toBeDefined();
  });

  it('is poker size, with bleed when asked', () => {
    expect(cardSvg(faces[0])).toContain('width="63.5mm" height="88.9mm"');
    expect(cardSvg(faces[0], { bleed: true })).toContain('width="69.5mm" height="94.9mm"');
  });
});

describe('player aid', () => {
  it('renders both editions without bad numbers or broken references', () => {
    for (const edition of ['community', 'classic'] as const) {
      const trim = playerAidSvg({ edition });
      const svg = playerAidSvg({ edition, bleed: true });
      checkSvg(svg, edition);
      expect(svg).toContain(`viewBox="-3 -3 154 111"`);
      expect(trim.slice(trim.indexOf('>') + 1)).toBe(svg.slice(svg.indexOf('>') + 1));
    }
  });

  it('keeps every line of text readable', () => {
    for (const edition of ['community', 'classic'] as const) {
      const sizes = [...playerAidSvg({ edition }).matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
      expect(sizes.length).toBeGreaterThan(20);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_TEXT);
    }
  });

  it('has a pad that fits a 19 mm die for dominance and for research', () => {
    expect(TILE.pad).toBeGreaterThanOrEqual(DIE + 4);
    const svg = playerAidSvg();
    expect(svg).toContain('DOMINANCE');
    expect(svg).toContain('RESEARCH');
    expect(svg.match(/width="24" height="24"/g)).toHaveLength(2);
  });

  it('only mentions missiles in the Community Edition', () => {
    expect(playerAidSvg({ edition: 'community' })).toContain('MISSILE');
    expect(playerAidSvg({ edition: 'classic' })).not.toContain('MISSILE');
  });

  it('has a pad for each of up to 7 cubes, with the win condition beside them', () => {
    for (const edition of ['community', 'classic'] as const) {
      const svg = playerAidSvg({ edition });
      expect(svg.match(new RegExp(`width="${CUBE_PAD.size}" height="${CUBE_PAD.size}"`, 'g'))).toHaveLength(7);
      expect(svg).toContain('PLACE YOUR LAST CUBE TO WIN');
    }
  });

  it('draws six different ships on their dice', () => {
    const ships = [1, 2, 3, 4, 5, 6].map((v) => shipDie('s', v, 0, 0, 19, 200).body);
    expect(new Set(ships).size).toBe(6);
    for (const s of ships) expect(s).not.toMatch(/NaN|undefined/);
  });
});

describe('press test', () => {
  it('renders an A4 page with every category, the ramps and the pieces it is given', () => {
    const svg = pressTestSvg({ tile: 'data:image/svg+xml,a', card: 'data:image/svg+xml,b' });
    checkSvg(svg, 'press-test');
    expect(svg).toContain(`viewBox="0 0 ${PRESS_TEST.w} ${PRESS_TEST.h}"`);
    for (const c of Object.values(CARD_CATEGORIES)) expect(svg).toContain(`>${c.label}<`);
    expect(svg.match(/<image /g)).toHaveLength(2);
  });
});
