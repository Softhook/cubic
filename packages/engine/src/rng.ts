import type { GameState } from './types';

/** mulberry32: small, fast, seedable. State lives in GameState so games replay exactly. */
export function next(state: GameState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
