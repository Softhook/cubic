/**
 * Online, actions come from other browsers, so apply() must refuse a malformed one with a RuleError,
 * never crash on it. Fuzzed over the states of AI games, for every action type:
 *
 * - random actions: each field drawn from the game's own ids, cells, planets and players, mixed with
 *   values of the wrong type. Many pass the shape check (actionShape.ts) and reach a handler with
 *   well-formed nonsense, which the handler must refuse too;
 * - corrupted legal actions: one legal action of each type offered, each field in turn replaced by a
 *   value of the wrong type or out of range;
 * - action types that don't exist, and values that aren't actions at all.
 */
import { describe, expect, it } from 'vitest';
import { SHAPES } from '../src/actionShape';
import { legalActions, RuleError, spaces, tryApply, type Action, type GameMode, type GameState } from '../src';
import { CARD_IDS } from './decisions';
import { playAiGame, seededRandom } from './helpers';

const GARBAGE: unknown[] = [undefined, null, -1, 999, 1.5, NaN, '', 'x', true, {}, [], { r: -1, c: 0 }, { r: 1e9, c: 1e9 }, { r: '1', c: 1 }, '__proto__', 'constructor'];
const BAD_TYPES = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'nope', ''];
const TYPES = Object.keys(SHAPES) as Action['type'][];
const FIELDS = Object.fromEntries(TYPES.map((t) => [t, Object.keys(SHAPES[t])])) as Record<Action['type'], string[]>;
/** Random actions tried per type in each sampled state. */
const RANDOM_PER_TYPE = 12;

/** Values a field may get in `s`: the game's own (so many random actions are well formed), and garbage. */
function pool(s: GameState, random: () => number): unknown[] {
  const pick = <T,>(xs: T[], n: number) => Array.from({ length: Math.min(n, xs.length) }, () => xs[Math.floor(random() * xs.length)]);
  const { rows, cols } = s.board;
  return [
    ...pick(s.dice.map((d) => d.id), 6),
    ...s.players.flatMap((p) => p.skills.map((k) => k.id)),
    ...s.market.skillRow,
    ...s.market.tacticRow,
    ...pick(CARD_IDS, 4),
    ...pick(spaces(s.board), 4),
    { r: 0, c: 0 },
    { r: rows - 1, c: cols - 1 },
    ...s.players.map((p) => p.id),
    0, 1, 2, 3, 5, 6, 7, s.board.planets.length - 1,
    true, false,
    'attacker', 'defender', 'skill', 'tactic', 'expansion',
    ...GARBAGE,
  ];
}

/** Tries `a`, failing the test (softly, to report every crash) if apply() throws anything but a RuleError. */
function attempt(s: GameState, a: unknown) {
  try {
    tryApply(s, a as Action);
  } catch (e) {
    expect.soft(e instanceof RuleError, `crashed on ${JSON.stringify(a)}: ${(e as Error).stack}`).toBe(true);
  }
}

function fuzz(mode: GameMode, seed: number) {
  const random = seededRandom(seed);
  playAiGame({
    mode,
    players: 3,
    seed,
    aiSeed: seed * 7,
    before: (s, step) => {
      if (step % 8 !== 0) return;
      for (const type of BAD_TYPES) attempt(s, { type });
      for (const junk of [null, undefined, 42, 'move', []]) attempt(s, junk);
      const values = pool(s, random);
      for (const type of TYPES) {
        for (let i = 0; i < RANDOM_PER_TYPE; i++) {
          attempt(s, Object.fromEntries([['type', type], ...FIELDS[type].map((f) => [f, values[Math.floor(random() * values.length)]])]));
        }
      }
      const oneOfEach = new Map(legalActions(s).map((a) => [a.type, a]));
      for (const a of oneOfEach.values()) {
        for (const field of FIELDS[a.type]) for (const junk of GARBAGE) attempt(s, { ...a, [field]: junk });
      }
    },
  });
}

describe('malformed actions are refused, never crash the engine', () => {
  for (const mode of ['basic', 'original', 'community', 'prototyping'] as const) {
    it(mode, () => fuzz(mode, 41), 120_000);
  }
});
