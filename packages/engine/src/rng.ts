import type { GameState } from './types';

/** One mulberry32 step: the number in [0, 1) for the advanced state `t`. */
function mix(t: number): number {
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** mulberry32: small, fast, seedable. State lives in GameState so games replay exactly. */
export function next(state: GameState): number {
  return mix((state.rng = (state.rng + 0x6d2b79f5) >>> 0));
}

/**
 * A mulberry32 stream in [0, 1) from a seed, outside any game: for the AI's own repeatable
 * randomness. Integer maths (Math.imul): a float LCG loses bits above 2^53, and different seeds
 * fall into the same sequence.
 */
export function mulberry32(seed: number): () => number {
  let x = seed >>> 0;
  return () => mix((x = (x + 0x6d2b79f5) >>> 0));
}

export function d6(state: GameState): number {
  return 1 + Math.floor(next(state) * 6);
}

export function shuffle<T>(state: GameState, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
