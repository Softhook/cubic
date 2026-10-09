/**
 * Cubic, our own rule set: a prototype (docs/PROTOTYPING.md). Everything that is Cubic lives in this
 * folder: what the mode changes and its ship table here, how its powers work in powers.ts.
 *
 * The engine reaches this folder in one place, RULESETS.cubic (rules.ts), and runs the powers only
 * through ShipHooks (data.ts), so nothing here can change Basic, Original or Community. The isolation
 * test in test/cubic.test.ts keeps it that way.
 *
 * To try a change: a setting or a text, edit this file; how a power works, powers.ts; a power on
 * another ship, move its `hooks` in CUBIC_SHIPS.
 */
import { CLASSIC_SHIPS, type ShipTable } from '../data';
import type { RuleSet } from '../rules';
import { beacon, picket, shoot } from './powers';

/** The most a ship's die value counts for movement; skill bonuses add to it (ruling 2026-10-08). */
const MAX_MOVEMENT = 3;

/** The 1, 2 and 3 keep their official powers; the 4, 5 and 6 control space, strike at range and extend reach. */
export const CUBIC_SHIPS: ShipTable = {
  ...CLASSIC_SHIPS,
  4: {
    name: 'Frigate',
    hooks: picket,
    ability: { name: 'Picket', text: 'An enemy ship that moves into any of the 8 spaces around this ship must stop there. It may still attack from there.' },
  },
  5: {
    name: 'Interceptor',
    hooks: shoot,
    ability: {
      name: 'Shoot',
      text: 'Attack an enemy 1 or 2 spaces away in a straight line, diagonals included (at 2, over an empty space). It stays where it is. Shooting and moving cost one action together, in either order.',
      hint: 'Shoot: choose an enemy 1 or 2 spaces away in a straight line, diagonals included. Your Interceptor stays put, and can still move before or after.',
    },
  },
  6: {
    name: 'Scout',
    hooks: beacon,
    ability: { name: 'Beacon', text: 'You may deploy into any empty space around this ship.' },
  },
};

/** Cubic, built on `base` (Community Edition, see rules.ts): its cards, missiles and maps are kept. */
export function cubicMode(base: RuleSet): RuleSet {
  return {
    ...base,
    id: 'cubic',
    name: 'Cubic',
    title: 'Cubic',
    summary: 'Community Edition with moves capped at 3 and new Frigate, Interceptor and Scout powers.',
    ships: CUBIC_SHIPS,
    maxMovement: MAX_MOVEMENT,
    experimental: true,
  };
}
