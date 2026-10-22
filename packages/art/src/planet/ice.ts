import { gradientMap, greyFromRed, n, ridges, stretch, tint, turbulence, type Hsl } from '../svg';
import { craters, type Ctx, type Surface } from './core';

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

export function ice(c: Ctx): Surface {
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
