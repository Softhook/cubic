/**
 * Prototyping, our own experimental rule set (docs/PROTOTYPING.md §9). Everything specific to the mode
 * lives in this folder: what the mode changes and which ship has which power here, each power in its own file in
 * powers/ (its rules text and its hooks).
 *
 * The engine reaches this folder in one place, RULESETS.prototyping (rulesets.ts), and runs the powers only
 * through ShipHooks, so nothing here can change Basic, Original or Community. This folder in turn uses
 * the engine only through the prototype kit (../prototype.ts). test/prototyping.test.ts checks both.
 *
 * To try a change: a setting, edit this file; how a power works or its text, its file in powers/; a
 * power on another ship, move it in PROTOTYPING_SHIPS; a new power, copy a file in powers/.
 */
import { CLASSIC_SHIPS, type RuleSet, type ShipTable } from '../prototype';
import { picket } from './powers/picket';
import { shoot } from './powers/shoot';

/**
 * Whether Prototyping plays with Community's cards (Skills, Tactics, research). Flip it to try the mode
 * without them, and refresh the golden games after (`npx vitest run golden -u`). On hexes, Ingenious and
 * Hostile ("conquer from the corners") still need a ruling (docs/HEX.md).
 */
export const PROTOTYPING_CARDS = true;

/** The most a ship's die value counts for movement; skill bonuses add to it (ruling 2026-10-08). */
const MAX_MOVEMENT = 3;

/** Only the 5 has a new power (strikes at range); the other ships keep their official powers. */
const SHIPS: ShipTable = {
  ...CLASSIC_SHIPS,
  5: { name: 'Interceptor', ...shoot },
};

/**
 * Zone of control, a mode rule rather than a power: every ship pickets the spaces next to it (4 on
 * squares, 6 on hexes; not diagonally), so an enemy ship moving in must stop there. Its rules text stays its own power's.
 */
const PROTOTYPING_SHIPS: ShipTable = Object.fromEntries(
  Object.entries(SHIPS).map(([v, ship]) => [v, { ...ship, hooks: { ...ship.hooks, ...picket.hooks } }]),
);

/**
 * Prototyping is built on `base` (Community Edition, see rulesets.ts): its missiles and maps are kept, with the hex
 * and off-centre (drift) maps added, and its cards as PROTOTYPING_CARDS says.
 */
export function prototypingMode(base: RuleSet): RuleSet {
  return {
    ...base,
    id: 'prototyping',
    name: 'Prototyping',
    title: 'Prototyping',
    summary: `Community Edition${PROTOTYPING_CARDS ? '' : ' without cards,'} with moves capped at 3, zones of control (a ship moving next to an enemy ship, not diagonally, stops there), a ranged Interceptor and over-conquest, displacing an opponent cube.`,
    cards: PROTOTYPING_CARDS ? base.cards : null,
    mapGroups: [...base.mapGroups, 'hex', 'drift'],
    ships: PROTOTYPING_SHIPS,
    maxMovement: MAX_MOVEMENT,
    overConquest: true,
    experimental: true,
  };
}
