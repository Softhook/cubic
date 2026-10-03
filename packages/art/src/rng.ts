/** Seeded randomness for artwork. Separate from the engine's game RNG: art never affects play. */

/** 32-bit FNV-1a hash of a string, for turning stable keys ("tile:p7-03") into seeds. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  /** A seed for an SVG `feTurbulence` (a positive integer). */
  noiseSeed(): number;
  /** A new, independent stream, so adding draws to one layer doesn't change another. */
  fork(label: string): Rng;
}

export function rng(seed: number | string): Rng {
  const base = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  let a = base;
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor((max - min + 1) * next()),
    pick: (items) => items[Math.floor(items.length * next())],
    chance: (p) => next() < p,
    noiseSeed: () => 1 + Math.floor(next() * 9999),
    fork: (label) => rng(hash(`${base}:${label}`)),
  };
  return r;
}
