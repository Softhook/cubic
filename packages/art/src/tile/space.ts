import { rng } from '../rng';
import { planet, planetRings } from '../planet';
import { starfield } from '../starfield';
import { PLANET_DIAMETER, PLANET_FAMILY, TILE, VOID_NEBULA_HUES, type PlanetType } from '../tokens';
import { document, hsl, join, n, type Box, type Fragment } from '../svg';
import { CORNER, MEET, MID, TRIM, betweenSpaces, type Corner, type Spot, type TileShape } from './geometry';
import { planetType, type TileSpec } from './set';
import { VOID_HEARTS } from './voids';

/**
 * A tile's art in space: its sky (stars and nebula) and its body (the planet and its moons, or a Void's
 * heart), drawn together for print or as separate layers for the game, which puts the body wherever the planet sits.
 */

/**
 * On a printed tile, bright stars go in the gutters between spaces, away from the planet (at `p`, mm),
 * its number (in corner `k`) and its label, if it has one.
 */
export function inGutter(shape: TileShape, p: Spot, k: Corner, labelled: boolean, x: number, y: number): boolean {
  if (Math.hypot(x - p.x, y - p.y) < 24) return false;
  const m = MEET[shape];
  if (Math.abs(x - (p.x + k.x * m.x * TILE.cell)) < 11 && Math.abs(y - (p.y + k.y * m.y * TILE.cell)) < 9) return false;
  if (labelled && x < p.x - CORNER + 3 && Math.abs(y - (p.y - CORNER)) < 6) return false;
  return betweenSpaces(shape, x, y);
}

/**
 * One or two small moons beside the planet, lit from the top left like it, at varied angles and
 * distances. They stay out of the top-left (the label) and bottom-right (the number) quadrants.
 */
function moons(r: number, id: string, number: number, type: PlanetType, rand: ReturnType<typeof rng>): Fragment {
  const hue = PLANET_FAMILY[number].hue;
  // Moons borrow their planet's colouring: mossy and teal by the oceans, white by the ice, tan by the
  // gas giants, and charred with a glowing vent by the lava worlds.
  const pal =
    type === 'lava'
      ? { h: 8, s: 40, l: 38 }
      : type === 'ice' || number === 9
        ? { h: 200, s: 30, l: 84 }
        : type === 'gas'
          ? { h: 36, s: 42, l: 66 }
          : { h: 140, s: 26, l: 58 };
  const count = rand.int(0, 2);
  // One free arc each: up and to the right, or down and to the left (degrees, y down).
  const arcs: [number, number][] = rand.chance(0.5)
    ? [
        [-85, -5],
        [95, 175],
      ]
    : [
        [95, 175],
        [-85, -5],
      ];
  let defs = '';
  let body = '';
  for (let i = 0; i < count; i++) {
    const mr = r * rand.range(0.07, 0.13);
    const a = (rand.range(...arcs[i]) * Math.PI) / 180;
    const d = r * 1.12 + mr + rand.range(1, 7);
    const x = MID + Math.cos(a) * d;
    const y = MID + Math.sin(a) * d;
    const h = pal.h + rand.range(-8, 8);
    const l = pal.l + rand.range(-6, 6);
    defs += `<radialGradient id="${id}-moon${i}" cx=".32" cy=".28" r=".85"><stop offset="0" stop-color="${hsl(h, pal.s, l)}"/><stop offset=".55" stop-color="${hsl(h, pal.s, l * 0.5)}"/><stop offset="1" stop-color="${hsl(hue, 40, 5)}"/></radialGradient>`;
    body += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(mr * 1.8)}" fill="${hsl(hue, 70, 60)}" fill-opacity=".12"/>`;
    body += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(mr)}" fill="url(#${id}-moon${i})"/>`;
    if (type === 'lava')
      body += `<circle cx="${n(x + mr * 0.25)}" cy="${n(y + mr * 0.2)}" r="${n(mr * 0.3)}" fill="${hsl(28, 95, 55)}" fill-opacity=".55"/>`;
  }
  return { defs, body };
}

/** A tile's starfield and nebula over `area`, faded to the shared base colour at the trim's edge. */
export function skyArt(
  spec: TileSpec,
  id: string,
  area: Box,
  brightAllowed: (x: number, y: number) => boolean,
  faintAllowed?: (x: number, y: number) => boolean,
): Fragment {
  return starfield({
    rng: rng(spec.seed).fork('sky'),
    id: `${id}-sky`,
    area,
    frame: TRIM,
    brightAllowed,
    ...(faintAllowed ? { faintAllowed } : {}),
    ...(spec.number === 0 ? { hues: VOID_NEBULA_HUES, nebula: 1 } : {}),
  });
}

/** A tile's body, centred on it: its planet and moons, or a Void tile's heart. */
export function bodyArt(spec: TileSpec, id: string): Fragment {
  if (spec.number === 0) return VOID_HEARTS[spec.heart ?? 'blackHole'](id);
  const art = rng(spec.seed);
  const r = PLANET_DIAMETER[spec.number] / 2;
  const type = planetType(spec);
  return join(
    planet({ rng: art.fork('planet'), id: `${id}-planet`, cx: MID, cy: MID, r, number: spec.number, type, rings: spec.rings }),
    moons(r, `${id}-planet`, spec.number, type, art.fork('moons')),
  );
}

/**
 * A map's layers (the game draws a map in layers, so a planet can sit anywhere): a tile's sky alone, trim
 * 96 × 96 mm, with no planet or markings. Bright stars keep to the gutters between the spaces of a
 * `shape` tile.
 */
export function skySvg(spec: TileSpec, shape: TileShape): string {
  return document(
    skyArt(spec, spec.id, TRIM, (x, y) => betweenSpaces(shape, x, y)),
    TRIM,
    true,
  );
}

/**
 * A tile's body alone, its planet and moons or a Void tile's heart, centred on a clear ground the size of
 * a tile (96 × 96 mm): the game places it where the planet sits, cut off at its tile's edge.
 */
export function bodySvg(spec: TileSpec): string {
  return document(bodyArt(spec, spec.id), TRIM, true);
}

/** Whether a tile's planet has rings (picked from its seed, when its spec doesn't say). */
export function tileHasRings(spec: TileSpec): boolean {
  if (spec.rings !== undefined || spec.number === 0) return !!spec.rings;
  return planetRings({
    rng: rng(spec.seed).fork('planet'),
    number: spec.number,
    type: planetType(spec),
  });
}
