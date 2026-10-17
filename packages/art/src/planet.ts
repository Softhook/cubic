import type { Rng } from './rng';
import { PLANET_FAMILY, SPACE_BASE, type PlanetType } from './tokens';
import { gradientMap, gradientMask, greyFromRed, hsl, n, ridges, stretch, tint, turbulence, type Fragment, type Hsl } from './svg';

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
const SWAMP = { hue: 150, sat: 34, light: [16, 30] as [number, number], peaks: [120, 18, 44] as Hsl };
const STEPPE = { hue: 76, sat: 36, light: [36, 54] as [number, number], peaks: [60, 20, 80] as Hsl };
const LANDS = [TEMPERATE, TEMPERATE, TEMPERATE, JUNGLE, JUNGLE, JUNGLE, TUNDRA, SWAMP, STEPPE];

/** The sea on Earth-like worlds: always blue, whatever the family hue. */
const SEA_HUE = 208;

/** Light comes from the top left on every planet, card and tile. */
const LIGHT = { x: 0.32, y: 0.28 };

interface Surface {
  /** Filter primitives that produce the surface colour. */
  filter: string;
  /** Extra marks drawn on the surface, inside the clip. */
  extra: string;
  extraDefs: string;
}

/** Shared by every surface: scale, ids and the seeded noise. */
interface Ctx {
  o: PlanetOptions;
  hue: number;
  rng: Rng;
  /** mm per unit of the reference 17 mm planet. */
  s: number;
  /** A noise frequency for the reference planet, scaled to this one. */
  f: (x: number) => string;
}

/** Soft blur filter for marks drawn on the surface. */
const blur = (id: string, sd: number) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(sd)}"/></filter>`;

/** A point on the disc, `k` of the radius from the centre at most, spread evenly. */
function spot(c: Ctx, k: number): { x: number; y: number } {
  const a = c.rng.range(0, Math.PI * 2);
  const d = Math.sqrt(c.rng.next()) * c.o.r * k;
  return { x: c.o.cx + Math.cos(a) * d, y: c.o.cy + Math.sin(a) * d };
}

/** Shaded craters lit from the top left. */
function craters(c: Ctx, count: number, size: [number, number], strength = 1): Pick<Surface, 'extra' | 'extraDefs'> {
  const id = `${c.o.id}-crater`;
  let extra = '';
  for (let i = 0; i < count; i++) {
    const p = spot(c, 0.85);
    const cr = c.rng.range(...size) * c.s * (c.rng.chance(0.15) ? 1.8 : 1);
    extra += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(cr)}" fill="url(#${id})"/>`;
  }
  const o = (x: number) => n(x * strength);
  return {
    extra,
    extraDefs:
      `<radialGradient id="${id}" fx=".38" fy=".38">` +
      `<stop offset="0" stop-color="#000" stop-opacity="${o(0.38)}"/><stop offset=".72" stop-color="#000" stop-opacity="${o(0.22)}"/>` +
      `<stop offset=".86" stop-color="#fff" stop-opacity="${o(0.2)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
  };
}

/** Gas giant palettes (8): all gold to amber, from pale cream to deep rust, so every 8 reads golden. */
const GIANTS: Record<string, (h: number, light: number) => Hsl[]> = {
  jupiter: (h, light) => [
    [h - 12, 62, 30],
    [h, 78, 46],
    [h + 8, 85, light],
    [h + 10, 70, 86],
    [h - 6, 80, 52],
    [h - 16, 60, 36],
    [h + 4, 75, light + 6],
  ],
  saturn: (h) => [
    [h + 8, 45, 60],
    [h + 12, 60, 72],
    [h + 14, 70, 82],
    [h + 16, 55, 91],
    [h + 10, 55, 68],
    [h + 14, 45, 78],
    [h + 16, 65, 88],
  ],
  rust: (h) => [
    [h - 22, 55, 28],
    [h - 16, 65, 40],
    [h + 6, 60, 82],
    [h - 12, 70, 48],
    [h + 10, 55, 88],
    [h - 20, 60, 34],
    [h + 2, 70, 66],
  ],
  amber: (h, light) => [
    [h - 18, 70, 22],
    [h - 10, 82, 36],
    [h - 4, 90, 50],
    [h + 6, 80, light],
    [h - 14, 75, 30],
    [h, 85, 44],
    [h + 8, 70, 76],
  ],
  // Copper and peach belts.
  copper: (h) => [
    [h - 20, 60, 34],
    [h - 14, 72, 52],
    [h - 8, 80, 70],
    [h - 4, 60, 84],
    [h - 18, 66, 44],
    [h - 10, 75, 62],
    [h - 2, 55, 90],
  ],
  // Sharp chocolate and cream stripes.
  striped: (h) => [
    [h - 14, 55, 20],
    [h + 12, 50, 90],
    [h - 8, 70, 38],
    [h + 14, 60, 84],
    [h - 16, 50, 26],
    [h + 6, 75, 66],
    [h + 16, 45, 93],
  ],
  // Olive-gold, muted.
  khaki: (h) => [
    [h + 6, 35, 34],
    [h + 10, 45, 50],
    [h + 14, 50, 66],
    [h + 12, 40, 80],
    [h + 4, 40, 42],
    [h + 12, 50, 58],
    [h + 16, 35, 88],
  ],
};

/** Ice giant palettes (9): pale and tinted, turquoise to blue. */
function iceGiant(c: Ctx): Hsl[] {
  const h = c.hue + c.rng.pick([-22, -10, 0, 10, 18]);
  const sat = c.rng.range(38, 64);
  return [
    [h - 6, sat, 58],
    [h, sat, 68],
    [h + 8, sat * 0.8, 79],
    [h + 4, sat * 0.5, 90],
    [h - 4, sat, 62],
    [h + 10, sat * 0.7, 74],
    [h, sat * 0.55, 86],
  ];
}

function gas(c: Ctx): Surface {
  const { o, hue, rng, s, f } = c;
  const { id, cx, cy, r } = o;
  // An ice giant (pale, soft bands) on the light planets; otherwise a vivid banded giant.
  const pale = o.number === 9;
  const stops = pale ? iceGiant(c) : GIANTS[rng.pick(Object.keys(GIANTS))](hue, rng.range(62, 74));
  if (rng.chance(0.5)) stops.reverse();
  // How the bands flow: calm and smooth, the usual, many fine belts, or churning.
  const style = rng.pick(
    pale ? (['smooth', 'smooth', 'banded', 'banded', 'fine'] as const) : (['smooth', 'banded', 'banded', 'fine', 'turbulent'] as const),
  );
  const flow = {
    smooth: { band: [0.08, 0.16], warp: [1.5, 3], swirl: 0.06, contrast: 1.4 },
    banded: { band: [0.18, 0.4], warp: [2.5, 5.5], swirl: 0.09, contrast: pale ? 2 : 2.6 },
    fine: { band: [0.45, 0.7], warp: [1.5, 3.5], swirl: 0.11, contrast: 2.2 },
    turbulent: { band: [0.2, 0.34], warp: [7, 11], swirl: 0.13, contrast: 2.8 },
  }[style];
  let extra = '';
  let extraDefs = blur(`${id}-storm-blur`, 0.35 * s);
  const oval = (x: number, y: number, rx: number, ry: number, fill: string, op: number) =>
    `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" opacity="${op}" filter="url(#${id}-storm-blur)"/>`;
  if (rng.chance(pale ? 0.4 : 0.6)) {
    // A great storm: a soft oval in a band, sometimes large.
    const sx = cx + rng.range(-0.4, 0.35) * r;
    const sy = cy + rng.range(-0.1, 0.45) * r;
    const k = rng.chance(0.25) ? 1.5 : 1;
    extra +=
      oval(sx, sy, r * 0.2 * k, r * 0.09 * k, pale ? hsl(hue + 20, 65, 38) : hsl(hue - 22, 70, 32), 0.75) +
      oval(sx, sy, r * 0.13 * k, r * 0.05 * k, pale ? hsl(hue, 40, 94) : hsl(hue - 18, 75, 62), 0.7);
  }
  if (rng.chance(0.35)) {
    // A string of small white storms along one band.
    const y = cy + rng.range(-0.5, 0.5) * r;
    const count = rng.int(3, 6);
    const x0 = cx - rng.range(0.3, 0.6) * r;
    for (let i = 0; i < count; i++)
      extra += oval(x0 + i * r * rng.range(0.14, 0.2), y + rng.range(-0.03, 0.03) * r, r * 0.05, r * 0.03, '#fff', 0.7);
  }
  if (pale && rng.chance(0.45)) {
    // A bright polar hood.
    extraDefs += blur(`${id}-hood-blur`, 1.6 * s);
    extra += `<ellipse cx="${n(cx)}" cy="${n(cy - r)}" rx="${n(r * 0.9)}" ry="${n(r * rng.range(0.3, 0.45))}" fill="${hsl(hue, 40, 95)}" opacity=".55" filter="url(#${id}-hood-blur)"/>`;
  }
  if (pale && rng.chance(0.4)) {
    // Thin bright cloud streaks.
    for (let i = rng.int(2, 4); i > 0; i--) {
      const p = spot(c, 0.7);
      extra += oval(p.x, p.y, r * rng.range(0.12, 0.28), r * 0.02, '#fff', 0.65);
    }
  }
  return {
    filter:
      turbulence(`${f(0.012)} ${f(rng.range(flow.band[0], flow.band[1]))}`, 3, rng.noiseSeed(), 'bands') +
      turbulence(f(flow.swirl), 2, rng.noiseSeed(), 'swirl') +
      `<feDisplacementMap in="bands" in2="swirl" scale="${n(rng.range(flow.warp[0], flow.warp[1]) * s)}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      greyFromRed('d') +
      stretch(flow.contrast) +
      gradientMap(stops),
    extra,
    extraDefs,
  };
}

function rocky(c: Ctx): Surface {
  const { o, hue, rng, f } = c;
  // Rust-red desert (Mars-like) on the hot planets; grey stone elsewhere.
  const sat = o.number === 10 ? 55 : 18;
  const stops: Hsl[] = [
    [hue, sat * 0.8, 13],
    [hue + 5, sat * 0.9, 23],
    [hue + 10, sat, 33],
    [hue + 16, sat, 44],
    [hue + 24, sat * 0.9, 56],
  ];
  return {
    filter: turbulence(f(0.11), 5, rng.noiseSeed(), 't') + greyFromRed('t') + stretch(2.2) + gradientMap(stops),
    ...craters(c, rng.int(6, 14), [0.5, 2.6]),
  };
}

/** Ice palettes (9): base from dark to light, and the colour of the cracks. All pale but tinted. */
const ICES: Record<string, (h: number) => { stops: Hsl[]; cracks: Hsl }> = {
  glacier: (h) => ({
    stops: [
      [h, 45, 64],
      [h, 40, 77],
      [h - 10, 32, 88],
      [h, 20, 97],
    ],
    cracks: [h + 15, 75, 45],
  }),
  sea: (h) => ({
    stops: [
      [h + 18, 70, 30],
      [h + 12, 65, 46],
      [h, 45, 80],
      [h, 22, 95],
    ],
    cracks: [h + 20, 70, 38],
  }),
  turquoise: (h) => ({
    stops: [
      [h - 22, 60, 46],
      [h - 18, 58, 62],
      [h - 10, 45, 78],
      [h - 5, 30, 92],
    ],
    cracks: [h - 15, 90, 70],
  }),
  blue: (h) => ({
    stops: [
      [h + 12, 65, 50],
      [h + 8, 62, 64],
      [h, 50, 80],
      [h, 30, 94],
    ],
    cracks: [h + 25, 80, 40],
  }),
  // Near white, faintly cyan, with deep blue fractures.
  frost: (h) => ({
    stops: [
      [h - 4, 30, 78],
      [h, 26, 86],
      [h + 4, 20, 93],
      [h, 12, 98],
    ],
    cracks: [h + 20, 85, 42],
  }),
};

function ice(c: Ctx): Surface {
  const { hue, rng, s, f } = c;
  const { stops, cracks } = ICES[rng.pick(Object.keys(ICES))](hue);
  // How the ice is broken up: a cracked sheet, long criss-crossing lines (Europa), parallel stripes,
  // floes on a darker frozen sea, or an old cratered crust.
  const style = rng.pick(['cracked', 'cracked', 'lined', 'striped', 'floes', 'cratered'] as const);
  const base = (freq: number, contrast: number) =>
    turbulence(f(freq), 4, rng.noiseSeed(), 't') + greyFromRed('t') + stretch(contrast) + gradientMap(stops, '', 'base');
  const over = (layer: string) => `<feComposite in="${layer}" in2="base" operator="over"/>`;
  switch (style) {
    case 'cracked':
      return {
        filter:
          base(rng.range(0.05, 0.09), rng.range(1.8, 2.6)) +
          turbulence(f(rng.range(0.06, 0.12)), 3, rng.noiseSeed(), 'r', 'turbulence') +
          ridges(cracks, rng.range(7, 12), 'r', 'cracks') +
          over('cracks'),
        extra: '',
        extraDefs: '',
      };
    case 'lined': {
      // Two sets of long thin lines in different directions, one fainter, over a smooth crust.
      const second: Hsl = [cracks[0] - 10, cracks[1] * 0.6, Math.min(cracks[2] + 22, 70)];
      return {
        filter:
          base(rng.range(0.03, 0.05), rng.range(1.2, 1.6)) +
          turbulence(`${f(rng.range(0.02, 0.035))} ${f(rng.range(0.07, 0.11))}`, 1, rng.noiseSeed(), 'r1', 'turbulence') +
          ridges(cracks, rng.range(6, 8), 'r1', 'l1') +
          turbulence(`${f(rng.range(0.07, 0.11))} ${f(rng.range(0.02, 0.035))}`, 1, rng.noiseSeed(), 'r2', 'turbulence') +
          ridges(second, rng.range(5.5, 7), 'r2', 'l2') +
          `<feMerge><feMergeNode in="base"/><feMergeNode in="l2"/><feMergeNode in="l1"/></feMerge>`,
        extra: '',
        extraDefs: '',
      };
    }
    case 'striped':
      // A few broad parallel stripes, like Enceladus' tiger stripes, at a seeded angle.
      return {
        filter:
          base(rng.range(0.05, 0.08), rng.range(1.6, 2.2)) +
          turbulence(`${f(rng.range(0.015, 0.03))} ${f(rng.range(0.07, 0.1))}`, 2, rng.noiseSeed(), 'r', 'turbulence') +
          ridges(cracks, rng.range(4, 6), 'r', 'stripes') +
          `<feGaussianBlur in="stripes" stdDeviation="${n(0.25 * s)}" result="soft"/>` +
          over('soft'),
        extra: '',
        extraDefs: '',
      };
    case 'floes': {
      // White floes on a mid-blue frozen sea (kept light so the 9 stays the palest planet).
      const sea: Hsl = [hue + rng.range(0, 14), rng.range(45, 60), rng.range(50, 58)];
      const thr = rng.range(0.44, 0.5);
      return {
        filter:
          base(rng.range(0.05, 0.08), 1.6) +
          turbulence(f(rng.range(0.16, 0.24)), 2, rng.noiseSeed(), 'w') +
          tint(sea, -12, 12 * thr, 'w', 'water') +
          `<feGaussianBlur in="water" stdDeviation="${n(0.15 * s)}" result="leads"/>` +
          over('leads'),
        extra: '',
        extraDefs: '',
      };
    }
    case 'cratered':
      return {
        filter:
          base(rng.range(0.08, 0.12), rng.range(1.4, 2)) +
          turbulence(f(rng.range(0.05, 0.08)), 3, rng.noiseSeed(), 'r', 'turbulence') +
          ridges(cracks, rng.range(10, 14), 'r', 'cracks') +
          over('cracks'),
        ...craters(c, rng.int(8, 16), [0.6, 2.4], 0.7),
      };
  }
}

function lava(c: Ctx): Surface {
  const { o, hue, rng, s, f } = c;
  const { id } = o;
  // Crust: black basalt, dark red, or grey-brown ash; always very dark, the darkest planets.
  const crust = rng.pick(['basalt', 'ember', 'ember', 'ash'] as const);
  const [ch, cs, cl] = {
    basalt: [hue + 220, 12, 0.8],
    ember: [hue, rng.range(30, 50), 1],
    ash: [hue + 18, 12, 1.25],
  }[crust];
  const stops: Hsl[] = [
    [ch, cs, 6 * cl],
    [ch, cs, 11 * cl],
    [ch + 4, cs, 17 * cl],
    [ch, cs, rng.range(20, 28) * cl],
  ];
  // Magma: deep red, orange or yellow-orange.
  const magma: Hsl = [hue + rng.pick([rng.range(0, 8), rng.range(12, 22), rng.range(26, 36)]), 100, rng.range(50, 60)];
  const hot: Hsl = [magma[0] + 14, 100, 72];
  // Where the magma shows: thin cracks, wide rivers, fine veins, or open lakes with a few cracks.
  const style = rng.pick(['cracks', 'rivers', 'veins', 'lakes'] as const);
  const ground =
    turbulence(f(rng.range(0.07, 0.13)), 4, rng.noiseSeed(), 't') + greyFromRed('t') + stretch(2) + gradientMap(stops, '', 'crust');
  const glowOf = (layer: string, sd: number) => `<feGaussianBlur in="${layer}" stdDeviation="${n(sd * s)}" result="${layer}-glow"/>`;
  let filter = ground;
  let layers: string[];
  switch (style) {
    case 'cracks':
    case 'rivers':
      filter +=
        turbulence(f(rng.range(0.04, 0.1)), 3, rng.noiseSeed(), 'r', 'turbulence') +
        ridges(magma, style === 'cracks' ? rng.range(5, 8) : rng.range(3.4, 4.4), 'r', 'magma') +
        glowOf('magma', rng.range(0.5, 1.2));
      layers = ['magma-glow', 'magma'];
      break;
    case 'veins':
      filter +=
        turbulence(f(rng.range(0.14, 0.2)), 3, rng.noiseSeed(), 'r', 'turbulence') +
        ridges(magma, rng.range(6, 9), 'r', 'magma') +
        glowOf('magma', 0.6) +
        turbulence(f(rng.range(0.04, 0.07)), 2, rng.noiseSeed(), 'r2', 'turbulence') +
        ridges(hot, rng.range(7, 10), 'r2', 'main');
      layers = ['magma-glow', 'magma', 'main'];
      break;
    case 'lakes': {
      const thr = rng.range(0.6, 0.65);
      filter +=
        turbulence(f(rng.range(0.05, 0.09)), 4, rng.noiseSeed(), 'p') +
        tint(magma, 18, -18 * thr, 'p', 'pools') +
        tint(hot, 18, -18 * (thr + 0.05), 'p', 'cores') +
        glowOf('pools', 0.7) +
        turbulence(f(rng.range(0.06, 0.1)), 3, rng.noiseSeed(), 'r', 'turbulence') +
        ridges(magma, rng.range(7, 10), 'r', 'magma');
      layers = ['pools-glow', 'magma', 'pools', 'cores'];
      break;
    }
  }
  let extra = '';
  let extraDefs = '';
  if (rng.chance(0.45)) {
    // A few glowing volcanic vents.
    extraDefs = `<radialGradient id="${id}-vent"><stop offset="0" stop-color="${hsl(...hot)}"/><stop offset=".3" stop-color="${hsl(...magma)}" stop-opacity=".8"/><stop offset="1" stop-color="${hsl(...magma)}" stop-opacity="0"/></radialGradient>`;
    for (let i = rng.int(2, 5); i > 0; i--) {
      const p = spot(c, 0.8);
      extra += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(rng.range(0.8, 1.8) * s)}" fill="url(#${id}-vent)"/>`;
    }
  }
  return {
    filter: filter + `<feMerge><feMergeNode in="crust"/>${layers.map((l) => `<feMergeNode in="${l}"/>`).join('')}</feMerge>`,
    extra,
    extraDefs,
  };
}

function ocean(c: Ctx): Surface {
  const { o, rng, s, f } = c;
  const { id, cx, cy, r } = o;
  // An Earth-like world: blue sea, then one kind of land, how much of each varying per planet.
  const land = rng.pick(LANDS);
  // How land and sea are laid out: continents, scattered islands, one supercontinent, or land with lakes.
  const layout = rng.pick(['continents', 'continents', 'islands', 'pangaea', 'lakes'] as const);
  const [freq, seaStops] = {
    continents: [rng.range(0.04, 0.07), rng.int(3, 5)],
    islands: [rng.range(0.09, 0.13), rng.int(5, 6)],
    pangaea: [rng.range(0.025, 0.04), rng.int(3, 4)],
    lakes: [rng.range(0.06, 0.1), 2],
  }[layout];
  const landStops = 9 - seaStops;
  const sea = SEA_HUE + rng.range(-14, 12);
  const stops: Hsl[] = [];
  for (let i = 0; i < seaStops; i++) {
    const t = i / (seaStops - 1);
    stops.push([sea - t * 14, 72 - t * 14, 16 + t * 32]);
  }
  // Some have bright turquoise shallows along the coast.
  if (rng.chance(0.45)) stops[seaStops - 1] = [sea - 26, 65, 52];
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
    extraDefs = blur(`${id}-cap-blur`, 0.5 * s);
    for (const dir of [-1, 1]) {
      extra += `<ellipse cx="${n(cx)}" cy="${n(cy + dir * r)}" rx="${n(cap * 1.9)}" ry="${n(cap)}" fill="#f4f8ff" opacity=".9" filter="url(#${id}-cap-blur)"/>`;
    }
  }
  // Clouds: clear skies, scattered, long streaks along the latitudes, or heavy cover.
  const sky = rng.pick(['clear', 'scattered', 'scattered', 'streaks', 'heavy'] as const);
  const clouds =
    sky === 'clear'
      ? ''
      : turbulence(sky === 'streaks' ? `${f(0.03)} ${f(0.2)}` : `${f(0.05)} ${f(0.12)}`, 4, rng.noiseSeed(), 'c') +
        `<feColorMatrix in="c" result="clouds" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 4 0 0 0 ${n(-(sky === 'heavy' ? rng.range(1.6, 1.85) : rng.range(1.9, 2.8)))}"/>` +
        `<feComposite in="clouds" in2="ground" operator="over"/>`;
  return {
    filter:
      turbulence(f(freq), 6, rng.noiseSeed(), 't') +
      greyFromRed('t') +
      stretch(rng.range(2, 2.8)) +
      gradientMap(stops, '', 'ground') +
      clouds,
    extra,
    extraDefs,
  };
}

const SURFACES: Record<PlanetType, (c: Ctx) => Surface> = { gas, rocky, ice, lava, ocean };

function surface(o: PlanetOptions, hue: number, rng: Rng): Surface {
  const s = o.r / 17;
  return SURFACES[o.type]({ o, hue, rng, s, f: (x) => n(x / s) });
}

/**
 * Film-style edge light: the atmosphere glows along the lit edge (inside the disc and just past it),
 * and a back light in a contrasting colour catches the opposite edge, lifting the planet off the sky.
 * Both colours come from the planet's family (tokens.ts).
 */
function lightDefs(o: PlanetOptions, hue: number): string {
  const { id, cx, cy, r } = o;
  const family = PLANET_FAMILY[o.number];
  const rim = hsl(hue, 90, family.rimLight);
  const back = hsl(...family.backLight);
  const at = `gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}"`;
  const box = { x: cx - r * 1.2, y: cy - r * 1.2, w: r * 2.4, h: r * 2.4 };
  // A square around the planet, shaded along the light's diagonal: white towards the light (`lit`) or away from it (`dark`).
  const diagonal = (name: string, stops: string) =>
    `<linearGradient id="${id}-${name}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>` +
    gradientMask(`${id}-${name}`, box, `${id}-${name}g`);
  return (
    `<radialGradient id="${id}-litrim" ${at} r="${n(r)}"><stop offset=".72" stop-color="${rim}" stop-opacity="0"/><stop offset=".95" stop-color="${rim}"/><stop offset="1" stop-color="#fff"/></radialGradient>` +
    `<radialGradient id="${id}-atmos" ${at} r="${n(r * 1.14)}"><stop offset="${n(1 / 1.14)}" stop-color="${rim}" stop-opacity=".85"/><stop offset="1" stop-color="${rim}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-back" ${at} r="${n(r * 1.05)}"><stop offset=".86" stop-color="${back}" stop-opacity="0"/><stop offset=".96" stop-color="${back}" stop-opacity=".6"/><stop offset="1" stop-color="${back}" stop-opacity="0"/></radialGradient>` +
    diagonal('lit', `<stop offset=".1" stop-color="#fff"/><stop offset=".5" stop-color="#000"/>`) +
    diagonal('dark', `<stop offset=".62" stop-color="#000"/><stop offset=".95" stop-color="#fff"/>`)
  );
}

/**
 * A planet centred on (cx, cy): a noise surface shaded as a sphere lit from the top left with a hard
 * terminator, an edge-lit atmosphere and a back light, a dark halo so it stands out from any
 * background, and sometimes rings.
 */
export function planet(o: PlanetOptions): Fragment & { rings: boolean } {
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
    `<radialGradient id="${id}-hi" cx="${LIGHT.x}" cy="${LIGHT.y}" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-rim"><stop offset=".8" stop-color="${hsl(hue, 80, 72)}" stop-opacity="0"/><stop offset="1" stop-color="${hsl(hue, 80, 72)}" stop-opacity=".4"/></radialGradient>` +
    // A hard terminator: the lit side stays bright, then falls quickly into the night side.
    `<radialGradient id="${id}-night" cx="${LIGHT.x}" cy="${LIGHT.y}" r="1"><stop offset=".22" stop-color="${night}" stop-opacity="0"/><stop offset=".36" stop-color="${night}" stop-opacity=".15"/><stop offset=".5" stop-color="${night}" stop-opacity=".87"/><stop offset=".62" stop-color="${night}" stop-opacity=".98"/></radialGradient>` +
    lightDefs(o, hue);

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

  /** A circle on the planet, `k` times its radius. */
  const disc = (fill: string, k = 1, extra = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * k)}" fill="${fill}"${extra}/>`;
  const body =
    disc(`url(#${id}-halo)`, 1.6) +
    disc(`url(#${id}-glow)`, 1.2) +
    back +
    `<g clip-path="url(#${id}-disc)">` +
    `<rect x="${n(cx - r)}" y="${n(cy - r)}" width="${n(2 * r)}" height="${n(2 * r)}" filter="url(#${id}-surface)"${o.type === 'gas' ? ` transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})"` : ''}/>` +
    surf.extra +
    disc(`url(#${id}-rim)`) +
    disc(`url(#${id}-hi)`) +
    disc(`url(#${id}-night)`) +
    disc(`url(#${id}-litrim)`, 1, ` mask="url(#${id}-lit)"`) +
    `</g>` +
    disc(`url(#${id}-atmos)`, 1.14, ` mask="url(#${id}-lit)"`) +
    disc(`url(#${id}-back)`, 1.05, ` mask="url(#${id}-dark)"`) +
    front;
  return { defs, body, rings };
}
