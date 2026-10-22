import { gradientMap, greyFromRed, stretch, turbulence, type Hsl } from '../svg';
import { craters, type Ctx, type Surface } from './core';

export function rocky(c: Ctx): Surface {
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
