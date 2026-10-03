import type { Rng } from './rng';
import { PLANET_FAMILY, SPACE_BASE, type PlanetType } from './tokens';
import { gradientMap, greyFromRed, hsl, hslToRgb, n, stretch, type Fragment, type Hsl } from './svg';

export interface PlanetOptions {
  rng: Rng;
  /** Unique prefix for ids. */
  id: string;
  cx: number;
  cy: number;
  /** Radius in mm. */
  r: number;
  /** Planet number 7–10: sets the colour family. */
  number: number;
  type: PlanetType;
  /** Draw rings; picked from the seed when omitted. */
  rings?: boolean;
}

/** Light comes from the top left on every planet, card and tile. */
const LIGHT = { x: 0.32, y: 0.28 };

const turbulence = (freq: string | number, octaves: number, seed: number, result: string, kind = 'fractalNoise') =>
  `<feTurbulence type="${kind}" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="${result}"/>`;

/** Turns ridge noise (`type="turbulence"`, near 0 along thin lines) into opaque lines of one colour. */
const ridges = (colour: Hsl, sharpness: number, input: string, result: string) => {
  const [r, g, b] = hslToRgb(...colour);
  return `<feColorMatrix in="${input}" result="${result}" type="matrix" values="0 0 0 0 ${n(r)} 0 0 0 0 ${n(g)} 0 0 0 0 ${n(b)} ${n(-sharpness)} 0 0 0 1"/>`;
};

interface Surface {
  /** Filter primitives that produce the surface colour. */
  filter: string;
  /** Extra marks drawn on the surface, inside the clip. */
  extra: string;
  extraDefs: string;
}

function surface(o: PlanetOptions, hue: number, rng: Rng, region: string): Surface {
  const s = o.r / 17;
  const f = (x: number) => n(x / s);
  const { id, cx, cy, r } = o;
  const seed = rng.noiseSeed();
  switch (o.type) {
    case 'gas': {
      const light = rng.range(58, 74);
      const stops: Hsl[] = [
        [hue - 8, 45, 20],
        [hue, 55, 36],
        [hue + 14, 50, light],
        [hue + 6, 30, 84],
        [hue - 6, 55, 46],
        [hue + 22, 45, 30],
        [hue + 4, 40, light + 4],
      ];
      if (rng.chance(0.5)) stops.reverse();
      let extra = '';
      let extraDefs = '';
      if (rng.chance(0.5)) {
        // A storm: a soft oval in a band.
        const sx = cx + rng.range(-0.4, 0.35) * r;
        const sy = cy + rng.range(-0.1, 0.45) * r;
        extraDefs += `<filter id="${id}-storm-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(0.35 * s)}"/></filter>`;
        extra +=
          `<ellipse cx="${n(sx)}" cy="${n(sy)}" rx="${n(r * 0.2)}" ry="${n(r * 0.09)}" fill="${hsl(hue + 30, 60, 30)}" opacity=".75" filter="url(#${id}-storm-blur)"/>` +
          `<ellipse cx="${n(sx)}" cy="${n(sy)}" rx="${n(r * 0.13)}" ry="${n(r * 0.05)}" fill="${hsl(hue + 34, 70, 72)}" opacity=".7" filter="url(#${id}-storm-blur)"/>`;
      }
      return {
        filter:
          `<filter id="${id}-surface" ${region} color-interpolation-filters="sRGB">` +
          turbulence(`${f(0.012)} ${f(rng.range(0.22, 0.4))}`, 3, seed, 'bands') +
          turbulence(f(0.09), 2, rng.noiseSeed(), 'swirl') +
          `<feDisplacementMap in="bands" in2="swirl" scale="${n(rng.range(3, 6) * s)}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
          greyFromRed('d') +
          stretch(2.6) +
          gradientMap(stops) +
          `</filter>`,
        extra,
        extraDefs,
      };
    }
    case 'rocky': {
      const stops: Hsl[] = [
        [hue, 14, 12],
        [hue + 10, 18, 24],
        [hue, 16, 34],
        [hue + 20, 22, 46],
        [hue + 30, 24, 58],
      ];
      let extra = '';
      const craters = rng.int(6, 14);
      for (let i = 0; i < craters; i++) {
        const a = rng.range(0, Math.PI * 2);
        const d = Math.sqrt(rng.next()) * r * 0.85;
        const cr = rng.range(0.5, 2.6) * s * (rng.chance(0.15) ? 1.8 : 1);
        extra += `<circle cx="${n(cx + Math.cos(a) * d)}" cy="${n(cy + Math.sin(a) * d)}" r="${n(cr)}" fill="url(#${id}-crater)"/>`;
      }
      return {
        filter:
          `<filter id="${id}-surface" ${region} color-interpolation-filters="sRGB">` +
          turbulence(f(0.11), 5, seed, 't') +
          greyFromRed('t') +
          stretch(2.2) +
          gradientMap(stops) +
          `</filter>`,
        extra,
        extraDefs:
          `<radialGradient id="${id}-crater" fx=".38" fy=".38">` +
          `<stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".72" stop-color="#000" stop-opacity=".22"/>` +
          `<stop offset=".86" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
      };
    }
    case 'ice': {
      const stops: Hsl[] = [
        [hue, 40, 34],
        [hue, 38, 50],
        [hue - 10, 32, 66],
        [hue, 25, 82],
      ];
      return {
        filter:
          `<filter id="${id}-surface" ${region} color-interpolation-filters="sRGB">` +
          turbulence(f(0.07), 4, seed, 't') +
          greyFromRed('t') +
          stretch(2) +
          gradientMap(stops, '', 'base') +
          turbulence(f(rng.range(0.07, 0.11)), 3, rng.noiseSeed(), 'r', 'turbulence') +
          ridges([hue + 10, 55, 34], 10, 'r', 'cracks') +
          `<feComposite in="cracks" in2="base" operator="over"/>` +
          `</filter>`,
        extra: '',
        extraDefs: '',
      };
    }
    case 'lava': {
      const stops: Hsl[] = [
        [hue, 18, 4],
        [hue, 20, 8],
        [hue + 5, 22, 13],
        [hue, 16, 19],
      ];
      return {
        filter:
          `<filter id="${id}-surface" ${region} color-interpolation-filters="sRGB">` +
          turbulence(f(0.1), 4, seed, 't') +
          greyFromRed('t') +
          stretch(2) +
          gradientMap(stops, '', 'crust') +
          turbulence(f(rng.range(0.05, 0.08)), 3, rng.noiseSeed(), 'r', 'turbulence') +
          ridges([hue + 22, 100, 58], 7, 'r', 'magma') +
          `<feGaussianBlur in="magma" stdDeviation="${n(0.7 * s)}" result="glow"/>` +
          `<feMerge><feMergeNode in="crust"/><feMergeNode in="glow"/><feMergeNode in="magma"/></feMerge>` +
          `</filter>`,
        extra: '',
        extraDefs: '',
      };
    }
    case 'ocean': {
      const land = hue + rng.range(-130, -90);
      const stops: Hsl[] = [
        [hue, 70, 12],
        [hue, 66, 18],
        [hue, 60, 25],
        [hue - 6, 58, 33],
        [hue - 10, 55, 42],
        [land, 38, 28],
        [land, 34, 34],
        [land + 15, 28, 42],
        [land + 30, 20, 54],
        [0, 0, 86],
      ];
      return {
        filter:
          `<filter id="${id}-surface" ${region} color-interpolation-filters="sRGB">` +
          turbulence(f(0.055), 6, seed, 't') +
          greyFromRed('t') +
          stretch(2.4) +
          gradientMap(stops, '', 'ground') +
          turbulence(`${f(0.05)} ${f(0.12)}`, 4, rng.noiseSeed(), 'c') +
          `<feColorMatrix in="c" result="clouds" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 4 0 0 0 -2.2"/>` +
          `<feComposite in="clouds" in2="ground" operator="over"/>` +
          `</filter>`,
        extra: '',
        extraDefs: '',
      };
    }
  }
}

/**
 * A planet centred on (cx, cy): a noise surface shaded as a sphere lit from the top left, a thin
 * atmosphere, a dark halo so it stands out from any background, and sometimes rings.
 */
export function planet(o: PlanetOptions): Fragment {
  const { id, cx, cy, r, rng } = o;
  const look = rng.fork('look');
  const hue = PLANET_FAMILY[o.number].hue + look.range(-12, 12);
  const region = `filterUnits="userSpaceOnUse" x="${n(cx - r)}" y="${n(cy - r)}" width="${n(2 * r)}" height="${n(2 * r)}"`;
  const surf = surface(o, hue, rng.fork('surface'), region);
  const tilt = look.range(-28, 28);
  const rings = o.rings ?? look.chance(o.type === 'gas' ? 0.45 : 0.12);
  const [bh, bs, bl] = SPACE_BASE;

  let defs =
    `<clipPath id="${id}-disc"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath>` +
    surf.filter +
    surf.extraDefs +
    `<radialGradient id="${id}-halo"><stop offset=".55" stop-color="${hsl(bh, bs, bl)}" stop-opacity=".8"/><stop offset="1" stop-color="${hsl(bh, bs, bl)}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-glow"><stop offset=".78" stop-color="${hsl(hue, 80, 65)}" stop-opacity=".4"/><stop offset="1" stop-color="${hsl(hue, 80, 65)}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-hi" cx="${LIGHT.x}" cy="${LIGHT.y}" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-rim"><stop offset=".8" stop-color="${hsl(hue, 80, 72)}" stop-opacity="0"/><stop offset="1" stop-color="${hsl(hue, 80, 72)}" stop-opacity=".4"/></radialGradient>` +
    `<radialGradient id="${id}-night" cx="${LIGHT.x + 0.04}" cy="${LIGHT.y + 0.04}" r=".92"><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity=".5"/><stop offset=".72" stop-color="#000" stop-opacity=".88"/><stop offset="1" stop-color="#000" stop-opacity=".97"/></radialGradient>`;

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
    defs += `<clipPath id="${id}-front"><rect x="${n(-rx - 2)}" y="0" width="${n(2 * rx + 4)}" height="${n(ry + 2)}"/></clipPath>`;
    const at = `translate(${n(cx)} ${n(cy)}) rotate(${n(tilt)})`;
    back = `<g transform="${at}">${ellipses}</g>`;
    front = `<g transform="${at}"><g clip-path="url(#${id}-front)">${ellipses}</g></g>`;
  }

  const disc = (fill: string) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"/>`;
  const body =
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 1.6)}" fill="url(#${id}-halo)"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 1.2)}" fill="url(#${id}-glow)"/>` +
    back +
    `<g clip-path="url(#${id}-disc)">` +
    `<rect x="${n(cx - r)}" y="${n(cy - r)}" width="${n(2 * r)}" height="${n(2 * r)}" filter="url(#${id}-surface)"${o.type === 'gas' ? ` transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})"` : ''}/>` +
    surf.extra +
    disc(`url(#${id}-rim)`) +
    disc(`url(#${id}-hi)`) +
    disc(`url(#${id}-night)`) +
    `</g>` +
    front;
  return { defs, body };
}
