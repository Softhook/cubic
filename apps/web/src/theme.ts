/**
 * Colours the game draws from code. CSS colours live in styles.css :root. The manual (rulebook/)
 * reads both, so its pictures always match the screen.
 */

/** Default player colours, in seat order. */
export const PLAYER_COLORS = ['#4cc9f0', '#f72585', '#ffb703', '#80ed99', '#b388ff'];

/** Pips on a ship die. */
export const PIP = '#0a0f1e';

/** The two combat dice: black for the attacker, white for the defender (shared with the card art). */
export { COMBAT_DICE } from '@quantum/art';

/** A free cube space on a planet. */
export const CUBE_SLOT = { fill: 'rgba(0,0,0,.22)', stroke: 'rgba(255,255,255,.35)' } as const;
