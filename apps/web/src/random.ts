// Chance for what's only for show (sounds, fireworks, the lobby's backdrop): not the game's, which is seeded in
// its state.

/** A number between `lo` and `hi`. */
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** One of `xs`. */
export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
