import { describe, expect, it } from 'vitest';
import { PLANET_DIAMETER, SET_COUNTS, TILE_SET, TILE, assignTiles, editableTileSvg, numberPlacement, cubePadCentres, tileSpec, tileSvg } from '../src';
import { CUBE_PAD } from '../src/tokens';
import maps from '../../engine/src/data/maps.json';
import cards from '../../engine/src/data/cards.json';
import { cardBackSvg, cardSvg, type CardDeck } from '../src/card';
import { ICONS } from '../src/icons';
import { CARD_CATEGORIES } from '../src/tokens';
import { ILLUSTRATIONS } from '../src/illustrations';
import { rng } from '../src/rng';
import { MIN_TEXT, playerAidSvg } from '../src/aid';
import { shipDie } from '../src/kit/starships';

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
  type Def = { id: string; name: string; subtitle: string; text: string; category: string; count: number };
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
  it('renders both editions without bad numbers', () => {
    for (const edition of ['community', 'classic'] as const) {
      const svg = playerAidSvg({ edition, bleed: true });
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg).toContain(`viewBox="-3 -3 154 111"`);
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
