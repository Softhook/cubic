/**
 * Early stopping for self-play matches: sequential probability ratio tests (SPRT), as engine test
 * frameworks such as Stockfish's fishtest use. Two run side by side, one per direction: "side A
 * wins `base` of its games, as an equal side would" against "A wins `base + margin`", and the same
 * against `base - margin`. A test ends once one of its two answers is far likelier than the other.
 *
 * The verdict is "better" (or "worse") when that direction's test finds the margin, and "even" once
 * both find no difference: both stop the match. A side that is in truth no better is called better
 * about 2.5–3% of the time (the same for worse); one that is `margin` better is missed about 5% of
 * the time given enough games: about 5 / margin² with the margin as a share, so 2000 for 5 points
 * and 400 for 10 (fewer leave many undecided). Sides less than the margin apart may come out either way, or even. A match that
 * ends before a test does is "undecided".
 *
 * `base` is A's share of wins between equal sides: 1/2, or 1/players with A in one seat of several.
 *
 * Games come in pairs on one map seed (with the seats swapped, between 2 players), and the two
 * games of a pair aren't independent: the seat may decide both (they split), or the map may suit
 * one side (it wins both). So, as fishtest does, the unit is the pair, scored by A's share of its
 * two games (0, 1/2 or 1), and the tests use the scores' measured spread (the normal approximation
 * of the SPRT, as fishtest's). Pairs that split make a match decide sooner, maps that decide pairs
 * later; counting games as independent would get the second wrong, deciding too soon.
 *
 * The measured spread is unsure over a few pairs, and a spread measured too small decides too
 * soon: it starts out as independent games' and moves to the measured one as pairs come in (as if
 * PRIOR pairs of independent games had been played first), and is never below a quarter of it. No
 * match is decided before MIN_PAIRS. Checked by simulation against the plain test of independent
 * games: as accurate with independent games and with maps that decide pairs, and with seats that
 * decide them as accurate in about 70% as many games.
 */

export type Verdict = 'better' | 'worse' | 'even' | 'undecided';

/** A's pairs so far: how many, the sum of their scores and of the scores' squares, and how many split 1–1. */
export interface Pairs {
  n: number;
  sum: number;
  squares: number;
  split: number;
}

export const noPairs = (): Pairs => ({ n: 0, sum: 0, squares: 0, split: 0 });

/**
 * The share of pairs that split, as a percentage, and the share expected of independent games
 * between equal sides (half, with 2 players). Many more say the seat decides games, many fewer that
 * the map does (see above).
 */
export function splitShare(p: Pairs, base = 0.5): { split: number; independent: number } {
  return { split: Math.round((100 * p.split) / Math.max(1, p.n)), independent: Math.round(200 * base * (1 - base)) };
}

/** Adds a pair in which A won `wins` of 2 finished games. Pairs with an unfinished game are left out. */
export function addPair(p: Pairs, wins: number, finished: number) {
  if (finished !== 2) return;
  const x = wins / 2;
  p.n++;
  p.sum += x;
  p.squares += x * x;
  if (wins === 1) p.split++;
}

/** Chance of a verdict of better (or worse) between equal sides. */
export const FALSE_ALARM = 0.025;
/** Chance of missing a difference of the margin. */
const MISS = 0.05;
const FOUND = Math.log((1 - MISS) / FALSE_ALARM);
const NONE = Math.log(MISS / (1 - FALSE_ALARM));
const MIN_PAIRS = 10;
const PRIOR = 20;

/** One direction's test, against A scoring `alt`: 1 = the difference is there, -1 = it isn't, 0 = play on. */
function test(p: Pairs, base: number, alt: number, spread: number): number {
  const mean = p.sum / p.n;
  const llr = (p.n * (alt - base) * (2 * mean - base - alt)) / (2 * spread);
  return llr >= FOUND ? 1 : llr <= NONE ? -1 : 0;
}

/**
 * The verdict after A's pairs `p`, or undecided to play on. A margin of 0 never stops. Each test is
 * judged on the whole tally, not only up to where it first ended: close to its bound, a test that
 * said "none" may say otherwise a few pairs later, while the other test plays on.
 */
export function sprt(p: Pairs, base: number, margin: number): Verdict {
  if (margin <= 0 || p.n < MIN_PAIRS) return 'undecided';
  if (margin >= base || base + margin >= 1) throw new Error(`A margin of ${margin} is too large for a base of ${base}`);
  const mean = p.sum / p.n;
  // A pair's spread if its games were independent, at A's expected share: the floor's measure.
  const independent = (base * (1 - base)) / 2;
  const measured = p.squares - p.n * mean * mean;
  const spread = Math.max((measured + PRIOR * independent) / (p.n + PRIOR), independent / 4);
  const up = test(p, base, base + margin, spread);
  const down = test(p, base, base - margin, spread);
  if (up === 1) return 'better';
  if (down === 1) return 'worse';
  return up === -1 && down === -1 ? 'even' : 'undecided';
}
