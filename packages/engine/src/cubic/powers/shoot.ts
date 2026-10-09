/**
 * Cubic's ship powers, as ShipHooks (data.ts): the engine asks each ship's hooks and never names a
 * power, so a power can be reworked here alone. Which ship has which power is in index.ts.
 */
import { grid, offsets, surrounding } from '../board';
import { startCombat } from '../combat';
import { spend } from '../core';
import type { ShipHooks } from '../data';
import { cellOf, die, dieAt, isEmptySpace } from '../lookups';
import { canMoveDie } from '../queries';
import { hooksOf } from '../rules';
import type { Cell, Die, GameState } from '../types';

// ---------------------------------------------------------------------------
// Picket: an enemy ship that moves into a space around this one must stop there.

/** Adjacency is all 8 surrounding spaces; Warp Gates don't count. */
export const picket: ShipHooks = {
  stopsEnemies: (state, _ship, index) => grid(state.board).around[index],
};

// ---------------------------------------------------------------------------
// Beacon: its owner may deploy around it, as if it were a planet with their cube.

export const beacon: ShipHooks = {
  deployTargets: (state, ship) => surrounding(state.board, cellOf(ship)!),
};

// ---------------------------------------------------------------------------
// Shoot: attack an enemy in a straight line, without moving. The ship's move and its shot cost one
// action together, in either order; the shooter never advances.

/** How far a shot reaches. Spaces short of the target must be empty (a ship, planet or void blocks). */
const SHOOT_RANGE = 2;

/** The directions a shot may go: orthogonal and diagonal. */
const LINES: Cell[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
  { r: -1, c: -1 },
  { r: -1, c: 1 },
  { r: 1, c: -1 },
  { r: 1, c: 1 },
];

/** This turn so far: `fired` first, so its move is free; `moved` first, so its shot is free; `done`: both. */
type Shot = 'fired' | 'moved' | 'done';

const shotOf = (s: GameState, d: Die) => s.turn.powers?.[d.id] as Shot | undefined;
const note = (s: GameState, d: Die, shot: Shot) => ((s.turn.powers ??= {})[d.id] = shot);

/** Whether it may shoot now, and what it costs: `paid` before it moves, `free` after a plain move. Not after an attack, nor twice. */
function shotCost(s: GameState, d: Die): 'paid' | 'free' | null {
  const shot = shotOf(s, d);
  if (shot === 'moved') return 'free';
  return !shot && canMoveDie(s, d) ? 'paid' : null;
}

/** Enemy ships in range from where it stands, whatever the cost. */
export function shootTargets(s: GameState, d: Die): Die[] {
  const start = cellOf(d);
  if (!start) return [];
  const out: Die[] = [];
  for (const dir of LINES) {
    let at = start;
    for (let k = 0; k < SHOOT_RANGE; k++) {
      [at] = offsets(s.board, at, [dir]);
      const target = dieAt(s, at);
      if (target) {
        if (target.owner !== d.owner && !out.includes(target)) out.push(target);
        break;
      }
      if (!isEmptySpace(s, at)) break;
    }
  }
  return out;
}

export const shoot: ShipHooks = {
  freeMove: (s, d) => shotOf(s, d) === 'fired',
  noAttack: (s, d) => shotOf(s, d) === 'fired',
  // Asked about every ship (data.ts): a ship that fired keeps its free move and its no-attack after
  // changing number, but only an Interceptor's move makes its shot free.
  onMove(s, d) {
    const shot = shotOf(s, d);
    if (shot === 'fired') note(s, d, 'done');
    else if (!shot && hooksOf(s, d) === shoot) note(s, d, 'moved');
  },
  action: {
    options(s, d) {
      const cost = shotCost(s, d);
      // An attack also pays for any Curious free moves taken (payForAttack).
      if (!cost || s.turn.actionsLeft < (cost === 'paid' ? 1 : 0) + s.turn.freeMovesUsed) return [];
      return shootTargets(s, d).map((x) => ({ target: x.id }));
    },
    apply(s, d, { target }) {
      const cost = shotCost(s, d);
      if (cost === 'paid') spend(s, 1);
      note(s, d, cost === 'paid' ? 'fired' : 'done');
      startCombat(s, d, die(s, target!), cellOf(d)!, true);
    },
  },
};
