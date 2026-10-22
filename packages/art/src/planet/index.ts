import type { Rng } from '../rng';
import { PLANET_FAMILY, SPACE_BASE_CSS, type PlanetType } from '../tokens';
import { gradientMask, hsl, n, type Fragment, type Hsl } from '../svg';
import type { Ctx, PlanetOptions, Surface } from './core';
import { gas } from './gas';
import { rocky } from './rocky';
import { ice } from './ice';
import { lava } from './lava';
import { ocean } from './ocean';

export type { PlanetOptions } from './core';

/**
 * A planet: its hue, its surface (one painter per kind of world: gas, rocky, ice, lava, ocean, each in its
 * own file, sharing core's context and craters), its air and edge light, and its rings.
 */

/**
 * Off-type colours some planets take instead of their family hue (absolute hues). Each number keeps
 * its lightness (the ice the palest, the lava the darkest), so numbers still tell apart.
 */
const EXOTIC_HUES: Record<'giant' | 'iceGiant' | Exclude<PlanetType, 'gas'>, number[]> = {
  giant: [352, 16, 70, 165, 280],
  iceGiant: [160, 176, 228, 262],
  ice: [160, 228, 268, 330],
  lava: [110, 190, 285, 328, 46],
  rocky: [20, 40, 200],
  ocean: [176, 196],
};

/** How often a planet takes an off-type colour. */
const EXOTIC_CHANCE = 0.3;

/** The planet's main hue: its family's, shifted a fair way, or now and then an off-type colour. */
function planetHue(o: Pick<PlanetOptions, 'number' | 'type'>, rng: Rng): number {
  const base = PLANET_FAMILY[o.number].hue;
  const kind = o.type === 'gas' ? (o.number === 9 ? 'iceGiant' : 'giant') : o.type;
  if (rng.chance(EXOTIC_CHANCE)) return rng.pick(EXOTIC_HUES[kind]) + rng.range(-10, 10);
  return base + rng.range(-16, 16);
}

/** Light comes from the top left on every planet, card and tile. */
const LIGHT = { x: 0.32, y: 0.28 };

const SURFACES: Record<PlanetType, (c: Ctx) => Surface> = { gas, rocky, ice, lava, ocean };

function surface(o: PlanetOptions, hue: number, rng: Rng): Surface {
  const s = o.r / 17;
  return SURFACES[o.type]({ o, hue, rng, s, f: (x) => n(x / s) });
}

/** A planet's air: its colour, how far past the disc it reaches (× radius), and how strong its parts are (0–1). */
interface Air {
  colour: Hsl;
  reach: number;
  /** The glow just past the lit edge. */
  haze: number;
  /** The bright line just inside the lit edge. */
  rim: number;
  /** The soft coloured glow all round the planet. */
  glow: number;
}

/**
 * Each kind of world has its own air: ocean worlds a blue sky whatever their colour; gas giants a thick,
 * soft one in their own colour; lava worlds a wide smoky glow; ice and rock thin or none, so a sharp edge.
 */
function air(o: PlanetOptions, hue: number, rng: Rng): Air {
  switch (o.type) {
    case 'ocean':
      return { colour: [rng.range(196, 214), 85, 74], reach: rng.range(1.12, 1.17), haze: rng.range(0.8, 0.95), rim: 1, glow: 0.35 };
    case 'gas':
      return { colour: [hue, 90, 78], reach: rng.range(1.12, 1.2), haze: rng.range(0.6, 0.78), rim: 0.8, glow: 0.4 };
    case 'lava':
      return { colour: [hue + 16, 92, 56], reach: rng.range(1.16, 1.24), haze: rng.range(0.55, 0.7), rim: 0.55, glow: 0.55 };
    case 'ice':
      // Most icy moons have next to no air; some keep a thin haze.
      return rng.chance(0.35)
        ? { colour: [hue, 55, 86], reach: rng.range(1.07, 1.09), haze: 0.6, rim: 0.75, glow: 0.2 }
        : { colour: [hue, 40, 90], reach: rng.range(1.035, 1.05), haze: 0.45, rim: 0.6, glow: 0.1 };
    case 'rocky':
      return { colour: [hue, 30, 80], reach: 1.03, haze: 0.3, rim: 0.45, glow: 0.08 };
  }
}

/**
 * Film-style edge light: the atmosphere glows along the lit edge (inside the disc and just past it),
 * and a back light in a contrasting colour catches the opposite edge, lifting the planet off the sky.
 * The back light comes from the planet's family (tokens.ts), the air from its kind.
 */
function lightDefs(o: PlanetOptions, a: Air): string {
  const { id, cx, cy, r } = o;
  const rim = hsl(...a.colour);
  const back = hsl(...PLANET_FAMILY[o.number].backLight);
  const at = `gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}"`;
  const box = { x: cx - r * 1.2, y: cy - r * 1.2, w: r * 2.4, h: r * 2.4 };
  // A square around the planet, shaded along the light's diagonal: white towards the light (`lit`) or away from it (`dark`).
  const diagonal = (name: string, stops: string) =>
    `<linearGradient id="${id}-${name}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>` +
    gradientMask(`${id}-${name}`, box, `${id}-${name}g`);
  return (
    `<radialGradient id="${id}-litrim" ${at} r="${n(r)}"><stop offset=".72" stop-color="${rim}" stop-opacity="0"/><stop offset=".95" stop-color="${rim}" stop-opacity="${n(a.rim)}"/><stop offset="1" stop-color="#fff" stop-opacity="${n(a.rim)}"/></radialGradient>` +
    `<radialGradient id="${id}-atmos" ${at} r="${n(r * a.reach)}"><stop offset="${n(1 / a.reach)}" stop-color="${rim}" stop-opacity="${n(a.haze)}"/><stop offset="1" stop-color="${rim}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-back" ${at} r="${n(r * 1.05)}"><stop offset=".86" stop-color="${back}" stop-opacity="0"/><stop offset=".96" stop-color="${back}" stop-opacity=".6"/><stop offset="1" stop-color="${back}" stop-opacity="0"/></radialGradient>` +
    diagonal('lit', `<stop offset=".1" stop-color="#fff"/><stop offset=".5" stop-color="#000"/>`) +
    diagonal('dark', `<stop offset=".62" stop-color="#000"/><stop offset=".95" stop-color="#fff"/>`)
  );
}

function planetLook(o: Pick<PlanetOptions, 'rng' | 'number' | 'type' | 'rings'>) {
  const look = o.rng.fork('look');
  const hue = planetHue(o, look);
  // Gas giants are sometimes tipped steeply, so their belts run every way, not only across.
  const tilt = look.range(-28, 28) + (o.type === 'gas' && look.chance(0.35) ? look.pick([-1, 1]) * look.range(30, 55) : 0);
  const rings = o.rings ?? look.chance(o.type === 'gas' ? 0.45 : 0.12);
  return { look, hue, tilt, rings };
}

/** Whether a planet has rings (without building its SVG). */
export const planetRings = (o: Pick<PlanetOptions, 'rng' | 'number' | 'type' | 'rings'>): boolean => planetLook(o).rings;

/**
 * A planet centred on (cx, cy): a noise surface shaded as a sphere lit from the top left with a hard
 * terminator, an edge-lit atmosphere and a back light, a dark halo so it stands out from any
 * background, and sometimes rings.
 */
export function planet(o: PlanetOptions): Fragment & { rings: boolean } {
  const { id, cx, cy, r, rng } = o;
  const { look, hue, tilt, rings } = planetLook(o);
  // Gas giants displace their noise up to 8·s mm, so pad the filter box to keep it from sampling past the edge.
  const sr = o.type === 'gas' ? r * 1.5 : r;
  const region = `filterUnits="userSpaceOnUse" x="${n(cx - sr)}" y="${n(cy - sr)}" width="${n(2 * sr)}" height="${n(2 * sr)}"`;
  const surf = surface(o, hue, rng.fork('surface'));
  // The night side is a deep shade of the planet's own colour, not black, so pale worlds don't turn grey.
  const night = hsl(hue, 70, 5);
  // Own stream, so the air doesn't move the tilt, rings or surface.
  const a = air(o, hue, rng.fork('air'));
  const glowHue = o.type === 'ocean' ? a.colour[0] : hue;

  let defs =
    `<clipPath id="${id}-disc"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath>` +
    `<filter id="${id}-surface" ${region} color-interpolation-filters="sRGB">${surf.filter}</filter>` +
    surf.extraDefs +
    `<radialGradient id="${id}-halo"><stop offset=".55" stop-color="${SPACE_BASE_CSS}" stop-opacity=".8"/><stop offset="1" stop-color="${SPACE_BASE_CSS}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-glow"><stop offset=".78" stop-color="${hsl(glowHue, 80, 65)}" stop-opacity="${n(a.glow)}"/><stop offset="1" stop-color="${hsl(glowHue, 80, 65)}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-hi" cx="${LIGHT.x}" cy="${LIGHT.y}" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-rim"><stop offset=".8" stop-color="${hsl(hue, 80, 72)}" stop-opacity="0"/><stop offset="1" stop-color="${hsl(hue, 80, 72)}" stop-opacity=".4"/></radialGradient>` +
    // A hard terminator: the lit side stays bright, then falls quickly into the night side.
    `<radialGradient id="${id}-night" cx="${LIGHT.x}" cy="${LIGHT.y}" r="1"><stop offset=".22" stop-color="${night}" stop-opacity="0"/><stop offset=".36" stop-color="${night}" stop-opacity=".15"/><stop offset=".5" stop-color="${night}" stop-opacity=".87"/><stop offset=".62" stop-color="${night}" stop-opacity=".98"/></radialGradient>` +
    lightDefs(o, a);

  let back = '';
  let front = '';
  if (rings) {
    const rx = r * look.range(1.45, 1.7);
    const ry = rx * look.range(0.16, 0.28);
    let ellipses = '';
    const bands = look.int(2, 4);
    for (let i = 0; i < bands; i++) {
      const k = 1 - i * look.range(0.07, 0.12);
      ellipses += `<ellipse rx="${n(rx * k)}" ry="${n(ry * k)}" fill="none" stroke="${hsl(hue + look.range(-20, 30), 30, look.range(60, 82))}" stroke-width="${n(look.range(0.4, 1.4) * (r / 17))}" stroke-opacity="${n(look.range(0.3, 0.65))}"/>`;
    }
    const rw = n(2 * rx + 4);
    const rh = n(ry + 2);
    defs +=
      `<clipPath id="${id}-back-ring"><rect x="${n(-rx - 2)}" y="${n(-(ry + 2))}" width="${rw}" height="${rh}"/></clipPath>` +
      `<clipPath id="${id}-front-ring"><rect x="${n(-rx - 2)}" y="0" width="${rw}" height="${rh}"/></clipPath>`;
    const at = `translate(${n(cx)} ${n(cy)}) rotate(${n(tilt)})`;
    back = `<g transform="${at}"><g clip-path="url(#${id}-back-ring)">${ellipses}</g></g>`;
    front = `<g transform="${at}"><g clip-path="url(#${id}-front-ring)">${ellipses}</g></g>`;
  }

  /** A circle on the planet, `k` times its radius. */
  const disc = (fill: string, k = 1, extra = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * k)}" fill="${fill}"${extra}/>`;
  const body =
    disc(`url(#${id}-halo)`, 1.6) +
    disc(`url(#${id}-glow)`, 1.2) +
    back +
    `<g clip-path="url(#${id}-disc)">` +
    // A gas giant's belts, storms and polar hood turn with its tilt.
    `<g${o.type === 'gas' ? ` transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})"` : ''}>` +
    `<rect x="${n(cx - sr)}" y="${n(cy - sr)}" width="${n(2 * sr)}" height="${n(2 * sr)}"${surf.fill ? ` fill="${surf.fill}"` : ''} filter="url(#${id}-surface)"/>` +
    surf.extra +
    `</g>` +
    disc(`url(#${id}-rim)`) +
    disc(`url(#${id}-hi)`) +
    disc(`url(#${id}-night)`) +
    disc(`url(#${id}-litrim)`, 1, ` mask="url(#${id}-lit)"`) +
    `</g>` +
    disc(`url(#${id}-atmos)`, a.reach, ` mask="url(#${id}-lit)"`) +
    disc(`url(#${id}-back)`, 1.05, ` mask="url(#${id}-dark)"`) +
    front;
  return { defs, body, rings };
}
