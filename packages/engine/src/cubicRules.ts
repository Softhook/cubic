/**
 * Cubic (docs/PROTOTYPING.md): the ship powers that change where ships may go, as hooks queries.ts
 * reads. Each returns nothing when no ship in the mode has the power, so other modes never pay for them.
 * Shoot, which is an action of its own, is in cubic.ts.
 */
import { grid, key, surrounding } from './board';
import { isEmptySpace } from './lookups';
import { hasPower, modeHasPower } from './rules';
import type { Cell, Die, GameState, PlayerId } from './types';

/**
 * Picket (Cubic Frigate): 1 on each space around an enemy Frigate of `mover`, by board cell index
 * (`at` is shipsByIndex). A ship that moves into one must stop there, though it may still attack
 * from it; a ship that starts its move on one may leave. Undefined when nothing pickets, so plain
 * searches stay plain.
 */
export function picketZone(state: GameState, mover: PlayerId, at: (Die | undefined)[]): Uint8Array | undefined {
  if (!modeHasPower(state, 'picket')) return undefined;
  const g = grid(state.board);
  let zone: Uint8Array | undefined;
  for (let i = 0; i < at.length; i++) {
    const d = at[i];
    if (!d || d.owner === mover || !hasPower(state, d, 'picket')) continue;
    zone ??= new Uint8Array(g.size);
    for (const nb of g.around[i]) zone[nb] = 1;
  }
  return zone;
}

/** Beacon (Cubic Scout): adds the empty spaces around each of the player's Scouts to `targets`. */
export function addBeaconTargets(state: GameState, player: PlayerId, targets: Map<string, Cell>) {
  if (!modeHasPower(state, 'beacon')) return;
  for (const d of state.dice) {
    if (d.owner !== player || d.loc.zone !== 'board' || !hasPower(state, d, 'beacon')) continue;
    for (const p of surrounding(state.board, d.loc)) if (isEmptySpace(state, p)) targets.set(key(p), p);
  }
}
