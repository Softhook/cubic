import { gradientMap, greyFromRed, hsl, n, stretch, tint, turbulence, type Hsl } from '../svg';
import { blur, type Ctx, type Surface } from './core';

/**
 * Land on Earth-like worlds: hue, saturation, lightness from shore to highland, and the peaks. Listed
 * by how common each is; mostly green, so most 7s read as green and blue.
 */
const TEMPERATE = { hue: 100, sat: 42, light: [26, 44] as [number, number], peaks: [0, 0, 90] as Hsl };
const JUNGLE = { hue: 128, sat: 48, light: [18, 32] as [number, number], peaks: [100, 25, 50] as Hsl };
const TUNDRA = { hue: 80, sat: 22, light: [34, 52] as [number, number], peaks: [0, 0, 94] as Hsl };
const SWAMP = { hue: 150, sat: 34, light: [16, 30] as [number, number], peaks: [120, 18, 44] as Hsl };
const STEPPE = { hue: 76, sat: 36, light: [36, 54] as [number, number], peaks: [60, 20, 80] as Hsl };
const LANDS = [TEMPERATE, TEMPERATE, TEMPERATE, JUNGLE, JUNGLE, JUNGLE, TUNDRA, SWAMP, STEPPE];

/** Alien vegetation, on some Earth-like worlds: crimson, violet, amber or teal. */
const ALIEN_LANDS = [
  { hue: 350, sat: 42, light: [22, 38] as [number, number], peaks: [0, 0, 92] as Hsl },
  { hue: 282, sat: 32, light: [22, 40] as [number, number], peaks: [0, 0, 92] as Hsl },
  { hue: 36, sat: 48, light: [30, 48] as [number, number], peaks: [30, 20, 86] as Hsl },
  { hue: 168, sat: 40, light: [20, 36] as [number, number], peaks: [0, 0, 92] as Hsl },
];

/** The sea on Earth-like worlds: blue, from teal to deep blue, whatever the family hue. */
const SEA_HUE = 208;

export function ocean(c: Ctx): Surface {
  const { o, rng, s, f } = c;
  const { id, cx, cy, r } = o;
  // An Earth-like world: blue sea, then one kind of land, how much of each varying per planet.
  const land = rng.pick(rng.chance(0.25) ? ALIEN_LANDS : LANDS);
  // How land and sea are laid out: continents, scattered islands, one supercontinent, or land with lakes.
  const layout = rng.pick(['continents', 'continents', 'islands', 'pangaea', 'lakes'] as const);
  const [freq, seaStops] = {
    continents: [rng.range(0.04, 0.07), rng.int(3, 5)],
    islands: [rng.range(0.09, 0.13), rng.int(5, 6)],
    pangaea: [rng.range(0.025, 0.04), rng.int(3, 4)],
    lakes: [rng.range(0.06, 0.1), 2],
  }[layout];
  const landStops = 9 - seaStops;
  const sea = SEA_HUE + rng.range(-30, 18);
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
        tint([0, 0, 100], 4, -(sky === 'heavy' ? rng.range(1.6, 1.85) : rng.range(1.9, 2.8)), 'c', 'clouds') +
        `<feComposite in="clouds" in2="ground" operator="over"/>`;
  // Sun glint: a specular highlight towards the light, on the water only (under the clouds). The
  // sea/land edge is halfway between the last sea stop and the first land stop of the ramp.
  const shore = (seaStops - 0.5) / (stops.length - 1);
  const glint =
    tint([0, 0, 100], -14, 14 * shore, 'height', 'water') +
    `<feSpecularLighting in="water" surfaceScale="0" specularConstant="1.5" specularExponent="90" lighting-color="${hsl(45, 70, 94)}" result="spec">` +
    `<fePointLight x="${n(cx - 0.36 * r)}" y="${n(cy - 0.4 * r)}" z="${n(0.35 * r)}"/></feSpecularLighting>` +
    `<feComposite in="spec" in2="water" operator="in" result="glint"/>` +
    `<feComposite in="glint" in2="land" operator="over" result="ground"/>`;
  return {
    filter:
      turbulence(f(freq), 6, rng.noiseSeed(), 't') +
      greyFromRed('t') +
      stretch(rng.range(2, 2.8), '', 'height') +
      gradientMap(stops, 'height', 'land') +
      glint +
      clouds,
    extra,
    extraDefs,
  };
}
