/**
 * Prototyping, our own experimental rule set (docs/PROTOTYPING.md §9). Everything specific to the mode
 * lives in this folder: what the mode changes and which ship has which power here, each power in its own file in
 * powers/ (its rules text and its hooks).
 *
 * The engine reaches this folder in one place, RULESETS.prototyping (rules.ts), and runs the powers only
 * through ShipHooks, so nothing here can change Basic, Original or Community. This folder in turn uses
 * the engine only through the prototype kit (../prototype.ts). test/prototyping.test.ts checks both.
 *
 * To try a change: a setting, edit this file; how a power works or its text, its file in powers/; a
 * power on another ship, move it in PROTOTYPING_SHIPS; a new power, copy a file in powers/.
 */
import { CLASSIC_SHIPS, type RuleSet, type ShipTable } from '../prototype';
import { beacon } from './powers/beacon';
import { picket } from './powers/picket';
import { shoot } from './powers/shoot';

/** The most a ship's die value counts for movement; skill bonuses add to it (ruling 2026-10-08). */
const MAX_MOVEMENT = 3;

/** The 1, 2 and 3 keep their official powers; the 4, 5 and 6 control space, strike at range and extend reach. */
export const PROTOTYPING_SHIPS: ShipTable = {
  ...CLASSIC_SHIPS,
  4: { name: 'Frigate', ...picket },
  5: { name: 'Interceptor', ...shoot },
  6: { name: 'Scout', ...beacon },
};

/** Prototyping is built on `base` (Community Edition, see rules.ts): its cards, missiles and maps are kept. */
export function prototypingMode(base: RuleSet): RuleSet {
  return {
    ...base,
    id: 'prototyping',
    name: 'Prototyping',
    title: 'Prototyping',
    summary: 'Community Edition with moves capped at 3 and new Frigate, Interceptor and Scout powers.',
    ships: PROTOTYPING_SHIPS,
    maxMovement: MAX_MOVEMENT,
    experimental: true,
  };
}
