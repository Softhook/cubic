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

/**
 * Land on Earth-like worlds: hue, saturation, lightness from shore to highland, and the peaks. Listed
 * by how common each is; all green, so every 7 reads as green and blue (no orange that could pass for a 9).
 */
const TEMPERATE = { hue: 100, sat: 42, light: [26, 44] as [number, number], peaks: [0, 0, 90] as Hsl };
const JUNGLE = { hue: 128, sat: 48, light: [18, 32] as [number, number], peaks: [100, 25, 50] as Hsl };
const TUNDRA = { hue: 80, sat: 22, light: [34, 52] as [number, number], peaks: [0, 0, 94] as Hsl };
const LANDS = [TEMPERATE, TEMPERATE, TEMPERATE, JUNGLE, JUNGLE, JUNGLE, TUNDRA];

/** The sea on Earth-like worlds: always blue, whatever the family hue. */
const SEA_HUE = 208;

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

function surface(o: PlanetOptions, hue: number, rng: Rng): Surface {
  const s = o.r / 17;
  const f = (x: number) => n(x / s);
  const { id, cx, cy, r } = o;
  const seed = rng.noiseSeed();
  switch (o.type) {
    case 'gas': {
      // An ice giant (pale, soft bands) on the light planets; otherwise a vivid banded giant.
      const pale = o.number === 8;
      const light = rng.range(62, 74);
      let stops: Hsl[];
      let bandFreq: number;
      if (pale) {
        // Turquoise, cyan or blue; always pale, but clearly tinted.
        const h = hue + rng.pick([-18, 0, 16]);
        const sat = rng.range(42, 60);
        stops = [
          [h - 6, sat, 58],
          [h, sat, 68],
          [h + 8, sat * 0.8, 79],
          [h + 4, sat * 0.5, 90],
          [h - 4, sat, 62],
          [h + 10, sat * 0.7, 74],
          [h, sat * 0.55, 86],
        ];
        bandFreq = rng.range(0.12, 0.22);
      } else {
        // Jupiter-like gold and brown, Saturn-like cream, deep amber, or rust with cream belts.
        switch (rng.pick(['jupiter', 'saturn', 'amber', 'rust'] as const)) {
          case 'jupiter':
            stops = [
              [hue - 12, 62, 30],
              [hue, 78, 46],
              [hue + 8, 85, light],
              [hue + 10, 70, 86],
              [hue - 6, 80, 52],
              [hue - 16, 60, 36],
              [hue + 4, 75, light + 6],
            ];
            bandFreq = rng.range(0.22, 0.4);
            break;
          case 'saturn':
            stops = [
              [hue + 8, 45, 60],
              [hue + 12, 60, 72],
              [hue + 14, 70, 82],
              [hue + 16, 55, 91],
              [hue + 10, 55, 68],
              [hue + 14, 45, 78],
              [hue + 16, 65, 88],
            ];
            bandFreq = rng.range(0.35, 0.55);
            break;
          case 'rust':
            stops = [
              [hue - 22, 55, 28],
              [hue - 16, 65, 40],
              [hue + 6, 60, 82],
              [hue - 12, 70, 48],
              [hue + 10, 55, 88],
              [hue - 20, 60, 34],
              [hue + 2, 70, 66],
            ];
            bandFreq = rng.range(0.2, 0.35);
            break;
          case 'amber':
            stops = [
              [hue - 18, 70, 22],
              [hue - 10, 82, 36],
              [hue - 4, 90, 50],
              [hue + 6, 80, light],
              [hue - 14, 75, 30],
              [hue, 85, 44],
              [hue + 8, 70, 76],
            ];
            bandFreq = rng.range(0.18, 0.32);
            break;
        }
      }
      if (rng.chance(0.5)) stops.reverse();
      let extra = '';
      let extraDefs = '';
      if (rng.chance(pale ? 0.4 : 0.6)) {
        // A storm: a soft oval in a band.
        const sx = cx + rng.range(-0.4, 0.35) * r;
        const sy = cy + rng.range(-0.1, 0.45) * r;
        extraDefs += `<filter id="${id}-storm-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(0.35 * s)}"/></filter>`;
        extra +=
          `<ellipse cx="${n(sx)}" cy="${n(sy)}" rx="${n(r * 0.2)}" ry="${n(r * 0.09)}" fill="${pale ? hsl(hue + 20, 65, 38) : hsl(hue - 22, 70, 32)}" opacity=".75" filter="url(#${id}-storm-blur)"/>` +
          `<ellipse cx="${n(sx)}" cy="${n(sy)}" rx="${n(r * 0.13)}" ry="${n(r * 0.05)}" fill="${pale ? hsl(hue, 40, 94) : hsl(hue - 18, 75, 62)}" opacity=".7" filter="url(#${id}-storm-blur)"/>`;
      }
      return {
        filter:
          turbulence(`${f(0.012)} ${f(bandFreq)}`, 3, seed, 'bands') +
          turbulence(f(0.09), 2, rng.noiseSeed(), 'swirl') +
          `<feDisplacementMap in="bands" in2="swirl" scale="${n(rng.range(pale ? 2 : 3, pale ? 4 : 6) * s)}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
          greyFromRed('d') +
          stretch(pale ? 2 : 2.6) +
          gradientMap(stops),
        extra,
        extraDefs,
      };
    }
    case 'rocky': {
      // Rust-red desert (Mars-like) on the hot planets; grey stone elsewhere.
      const sat = o.number === 10 ? 55 : 18;
      const stops: Hsl[] = [
        [hue, sat * 0.8, 13],
        [hue + 5, sat * 0.9, 23],
        [hue + 10, sat, 33],
        [hue + 16, sat, 44],
        [hue + 24, sat * 0.9, 56],
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
          turbulence(f(0.11), 5, seed, 't') +
          greyFromRed('t') +
          stretch(2.2) +
          gradientMap(stops),
        extra,
        extraDefs:
          `<radialGradient id="${id}-crater" fx=".38" fy=".38">` +
          `<stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".72" stop-color="#000" stop-opacity=".22"/>` +
          `<stop offset=".86" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
      };
    }
    case 'ice': {
      // Glacier (white with blue cracks) or frozen sea (cyan floes): both pale, the lightest planets.
      // Four kinds, all pale but tinted: white glacier, frozen sea, turquoise ice, blue ice.
      let stops: Hsl[];
      let cracks: Hsl;
      switch (rng.pick(['glacier', 'sea', 'turquoise', 'blue'] as const)) {
        case 'glacier':
          stops = [[hue, 45, 64], [hue, 40, 77], [hue - 10, 32, 88], [hue, 20, 97]];
          cracks = [hue + 15, 75, 45];
          break;
        case 'sea':
          stops = [[hue + 18, 70, 30], [hue + 12, 65, 46], [hue, 45, 80], [hue, 22, 95]];
          cracks = [hue + 20, 70, 38];
          break;
        case 'turquoise':
          stops = [[hue - 22, 60, 46], [hue - 18, 58, 62], [hue - 10, 45, 78], [hue - 5, 30, 92]];
          cracks = [hue - 15, 90, 70];
          break;
        case 'blue':
          stops = [[hue + 12, 65, 50], [hue + 8, 62, 64], [hue, 50, 80], [hue, 30, 94]];
          cracks = [hue + 25, 80, 40];
          break;
      }
      return {
        filter:
          turbulence(f(rng.range(0.05, 0.09)), 4, seed, 't') +
          greyFromRed('t') +
          stretch(rng.range(1.8, 2.6)) +
          gradientMap(stops, '', 'base') +
          turbulence(f(rng.range(0.06, 0.12)), 3, rng.noiseSeed(), 'r', 'turbulence') +
          ridges(cracks, rng.range(7, 12), 'r', 'cracks') +
          `<feComposite in="cracks" in2="base" operator="over"/>`,
        extra: '',
        extraDefs: '',
      };
    }
    case 'lava': {
      // Dark red crust split by glowing magma: from a few thin red cracks to wide orange rivers.
      const crust = rng.range(30, 50);
      const stops: Hsl[] = [
        [hue, crust, 6],
        [hue, crust, 11],
        [hue + 4, crust, 17],
        [hue, crust, rng.range(20, 28)],
      ];
      const magma: Hsl = [hue + rng.range(2, 26), 100, rng.range(50, 60)];
      return {
        filter:
          turbulence(f(rng.range(0.07, 0.13)), 4, seed, 't') +
          greyFromRed('t') +
          stretch(2) +
          gradientMap(stops, '', 'crust') +
          turbulence(f(rng.range(0.04, 0.1)), 3, rng.noiseSeed(), 'r', 'turbulence') +
          ridges(magma, rng.range(2.8, 8), 'r', 'magma') +
          `<feGaussianBlur in="magma" stdDeviation="${n(rng.range(0.5, 1.2) * s)}" result="glow"/>` +
          `<feMerge><feMergeNode in="crust"/><feMergeNode in="glow"/><feMergeNode in="magma"/></feMerge>`,
        extra: '',
        extraDefs: '',
      };
    }
    case 'ocean': {
      // An Earth-like world: blue sea, then one kind of land, how much of each varying per planet.
      const land = rng.pick(LANDS);
      // Sea and green land in about equal parts, so these worlds read as green and blue.
      const seaStops = rng.int(3, 6);
      const landStops = 9 - seaStops;
      const sea = SEA_HUE + rng.range(-14, 12);
      const stops: Hsl[] = [];
      for (let i = 0; i < seaStops; i++) {
        const t = i / (seaStops - 1);
        stops.push([sea - t * 14, 72 - t * 14, 16 + t * 32]);
      }
      for (let i = 0; i < landStops; i++) {
        const t = landStops > 1 ? i / (landStops - 1) : 0;
        stops.push([land.hue + t * 15, land.sat - t * 10, land.light[0] + t * (land.light[1] - land.light[0])]);
      }
      stops.push(land.peaks);
      // Some have white polar caps.
      let extra = '';
      let extraDefs = '';
      if (rng.chance(0.45)) {
        const cap = rng.range(0.18, 0.3) * r;
        extraDefs = `<filter id="${id}-cap-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(0.5 * s)}"/></filter>`;
        for (const dir of [-1, 1]) {
          extra += `<ellipse cx="${n(cx)}" cy="${n(cy + dir * r)}" rx="${n(cap * 1.9)}" ry="${n(cap)}" fill="#f4f8ff" opacity=".9" filter="url(#${id}-cap-blur)"/>`;
        }
      }
      return {
        filter:
          turbulence(f(rng.range(0.04, 0.08)), 6, seed, 't') +
          greyFromRed('t') +
          stretch(rng.range(2, 2.8)) +
          gradientMap(stops, '', 'ground') +
          turbulence(`${f(0.05)} ${f(0.12)}`, 4, rng.noiseSeed(), 'c') +
          `<feColorMatrix in="c" result="clouds" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 4 0 0 0 ${n(-rng.range(1.9, 2.8))}"/>` +
          `<feComposite in="clouds" in2="ground" operator="over"/>`,
        extra,
        extraDefs,
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
  const hue = PLANET_FAMILY[o.number].hue + look.range(-8, 8);
  const region = `filterUnits="userSpaceOnUse" x="${n(cx - r)}" y="${n(cy - r)}" width="${n(2 * r)}" height="${n(2 * r)}"`;
  const surf = surface(o, hue, rng.fork('surface'));
  const tilt = look.range(-28, 28);
  const rings = o.rings ?? look.chance(o.type === 'gas' ? 0.45 : 0.12);
  const [bh, bs, bl] = SPACE_BASE;
  // The night side is a deep shade of the planet's own colour, not black, so pale worlds don't turn grey.
  const night = hsl(hue, 70, 5);

  let defs =
    `<clipPath id="${id}-disc"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath>` +
    `<filter id="${id}-surface" ${region} color-interpolation-filters="sRGB">${surf.filter}</filter>` +
    surf.extraDefs +
    `<radialGradient id="${id}-halo"><stop offset=".55" stop-color="${hsl(bh, bs, bl)}" stop-opacity=".8"/><stop offset="1" stop-color="${hsl(bh, bs, bl)}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-glow"><stop offset=".78" stop-color="${hsl(hue, 80, 65)}" stop-opacity=".4"/><stop offset="1" stop-color="${hsl(hue, 80, 65)}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-hi" cx="${LIGHT.x}" cy="${LIGHT.y}" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-rim"><stop offset=".8" stop-color="${hsl(hue, 80, 72)}" stop-opacity="0"/><stop offset="1" stop-color="${hsl(hue, 80, 72)}" stop-opacity=".4"/></radialGradient>` +
    `<radialGradient id="${id}-night" cx="${LIGHT.x + 0.04}" cy="${LIGHT.y + 0.04}" r=".92"><stop offset=".22" stop-color="${night}" stop-opacity="0"/><stop offset=".5" stop-color="${night}" stop-opacity=".5"/><stop offset=".72" stop-color="${night}" stop-opacity=".88"/><stop offset="1" stop-color="${night}" stop-opacity=".97"/></radialGradient>`;

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
