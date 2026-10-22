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
import { CLASSIC_SHIPS, reword, type RuleSet, type ShipTable } from '../prototype';
import { picket } from './powers/picket';
import { shoot } from './powers/shoot';
import { REGOLITH_WORDS } from './words';

/**
 * Whether Prototyping plays with Community's cards (Skills, Tactics, research). Flip it to try the mode
 * without them, and refresh the golden games after (`npx vitest run golden -u`). On hexes, Ingenious ("conquer
 * from the corners") is left out of the deck (effects.ts `dealt`).
 */
export const PROTOTYPING_CARDS = true;

/**
 * Over-conquest (PROTOTYPING.md §6.10): an orbit of exactly 12 displaces an opponent's cube. Off since
 * 2026-10-21, when contested orbit came in; flip it to try both together.
 */
export const PROTOTYPING_OVER_CONQUEST = false;

/**
 * Contested deploy (PROTOTYPING.md §6.8): no deploying into a planet's orbit while an opponent's ship is in
 * it, so a defender can't re-block a planet as fast as its blockers are destroyed. Since 2026-10-21.
 */
export const PROTOTYPING_CONTESTED_DEPLOY = true;

/** Home shipyard (PROTOTYPING.md §6.8): with contested deploy, a player may always deploy to their own home planet, so nobody is shut out. */
export const PROTOTYPING_HOME_SHIPYARD = true;

/** The most a ship's die value counts for movement; skill bonuses add to it (ruling 2026-10-08). */
const MAX_MOVEMENT = 3;

/**
 * Regolith's mechs (docs/REGOLITH-WORLD.md, *The six mechs*): the official powers under the mechs' names, except
 * the 5's, which strikes at range.
 */
const SHIPS: ShipTable = {
  1: {
    ...CLASSIC_SHIPS[1],
    name: 'Breacher',
    ability: { name: 'Free Attack', text: 'Attack an adjacent enemy without using this mech’s move.' },
  },
  2: {
    ...CLASSIC_SHIPS[2],
    name: 'Behemoth',
    ability: { name: 'Carry & Move', text: 'Carry one of your nearby mechs as part of a move, then drop it next to you.' },
  },
  3: { ...CLASSIC_SHIPS[3], name: 'Tactician', ability: { name: 'Swap', text: 'Swap places with any of your other mechs.' } },
  4: { ...CLASSIC_SHIPS[4], name: 'Chameleon', ability: { name: 'Change to 3 or 5', text: 'Refit as a Tactician or a Sniper.' } },
  5: { name: 'Sniper', ...shoot },
  6: { ...CLASSIC_SHIPS[6], name: 'Wisp', ability: { name: 'Free Refit', text: 'Re-roll this mech for free.' } },
};

/**
 * Zone of control, a mode rule rather than a power: every ship pickets the spaces next to it (4 on
 * squares, 6 on hexes; not diagonally), so an enemy ship moving in must stop there. Its rules text stays its own power's.
 */
const PROTOTYPING_SHIPS: ShipTable = Object.fromEntries(
  Object.entries(SHIPS).map(([v, ship]) => [v, { ...ship, hooks: { ...ship.hooks, ...picket.hooks } }]),
);

/**
 * Prototyping, shown as Regolith (docs/REGOLITH.md), is built on `base` (Community Edition, see rulesets.ts): its
 * missiles are kept and its cards as PROTOTYPING_CARDS says. It plays the hex maps only, the hex and off-centre
 * (drift) ones, on the moon's and Mars's ground.
 */
export function prototypingMode(base: RuleSet): RuleSet {
  return {
    ...base,
    id: 'prototyping',
    name: 'Regolith',
    title: 'Regolith',
    summary: reword(
      REGOLITH_WORDS,
      `Mechs fight over the ice of Mars and the moon, on hex maps. Community Edition${PROTOTYPING_CARDS ? '' : ' without cards,'} with moves capped at 3, zones of control (a mech moving next to an enemy mech, not diagonally, stops there), a ranged Sniper and contested orbits (no conquering${PROTOTYPING_CONTESTED_DEPLOY ? ` or deploying${PROTOTYPING_HOME_SHIPYARD ? ', except to your home planet,' : ''}` : ''} while an enemy mech is in orbit)${PROTOTYPING_OVER_CONQUEST ? ' and over-conquest, displacing an opponent cube' : ''}.`,
    ),
    cards: PROTOTYPING_CARDS ? base.cards : null,
    mapGroups: ['hex', 'drift'],
    ships: PROTOTYPING_SHIPS,
    maxMovement: MAX_MOVEMENT,
    overConquest: PROTOTYPING_OVER_CONQUEST,
    contestedOrbit: true,
    contestedDeploy: PROTOTYPING_CONTESTED_DEPLOY,
    homeShipyard: PROTOTYPING_HOME_SHIPYARD,
    experimental: true,
    words: REGOLITH_WORDS,
  };
}
