import { gradientMap, greyFromRed, hsl, n, ridges, stretch, tint, turbulence, type Hsl } from '../svg';
import { spot, type Ctx, type Surface } from './core';

export function lava(c: Ctx): Surface {
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
