/**
 * How much each ship power is used in each mode (AI self-play). Prints a table per mode; the
 * assertions only guard the measurement itself, so a prototype power can be judged by eye:
 * a power that is offered often but never used is dead weight, one used every time may be too strong.
 * More games or another AI level: POWER_USAGE_GAMES=40 POWER_USAGE_LEVEL=3 npx vitest run powerUsage  (or `npm run power:usage`).
 */
import { describe, expect, it } from 'vitest';
import type { GameMode } from '../src';
import { formatUsage, measurePowerUsage } from './powerUsage';

const GAMES = Number(process.env.POWER_USAGE_GAMES ?? 4);
const LEVEL = Number(process.env.POWER_USAGE_LEVEL ?? 4) as 1 | 2 | 3 | 4 | 5; // level 4 is the lowest that uses Flagship transports
const MODES: GameMode[] = ['basic', 'original', 'community', 'prototyping'];

describe('power usage by mode', () => {
  for (const mode of MODES) {
    it(`${mode}`, () => {
      const u = measurePowerUsage(mode, { games: GAMES, level: LEVEL });
      console.log(`\n${formatUsage(u)}`);
      expect(u.finished).toBe(GAMES);
      for (const r of u.rows) {
        expect(r.usedTurns).toBeLessThanOrEqual(r.offeredTurns);
        expect(r.used).toBeGreaterThanOrEqual(r.usedTurns);
        if (!r.hasAction) expect(r.used).toBe(0);
      }
      // Some power gets used in every mode.
      expect(u.rows.reduce((a, r) => a + r.used, 0)).toBeGreaterThan(0);
    }, 120_000);
  }
});
