/**
 * Cubic (docs/PROTOTYPING.md): Shoot, the Interceptor's power, as an action of its own. Its move and
 * its shot cost one action together, in either order; `turn.shoot` tracks which came first. In other
 * modes no ship has the power, so none of this ever applies. Picket and Beacon are in cubicRules.ts.
 */
import { offsets } from './board';
import { startCombat } from './combat';
import { fail, ownShip, requireActionPhase, spend, type Handlers } from './core';
import { cellOf, die, dieAt, isEmptySpace } from './lookups';
import { canMoveDie } from './queries';
import { hasPower } from './rules';
import type { Cell, Die, GameState } from './types';

/** The 8 directions a shot may go: orthogonal and diagonal. */
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

/**
 * Whether the ship may shoot now, and what it costs: `paid` before it moves (the move is then free),
 * `free` after a plain move. Not after an attack, nor twice.
 */
export function shotCost(state: GameState, d: Die): 'paid' | 'free' | null {
  if (d.loc.zone !== 'board' || !hasPower(state, d, 'shoot')) return null;
  const done = state.turn.shoot?.[d.id];
  if (done === 'moved') return 'free';
  return !done && canMoveDie(state, d) ? 'paid' : null;
}

/** Whether the ship shot first this turn, so its move is free and it may not attack. */
export function firedFirst(state: GameState, d: Die): boolean {
  return state.turn.shoot?.[d.id] === 'fired';
}

/**
 * Enemy ships it can shoot from where it stands: 1 or 2 spaces away in a straight line, orthogonal or
 * diagonal; at 2, over an empty space.
 */
export function shootTargets(state: GameState, dieId: string): Die[] {
  const d = die(state, dieId);
  const start = cellOf(d);
  if (!start || !shotCost(state, d)) return [];
  const out: Die[] = [];
  const add = (target: Die | undefined) => {
    if (target && target.owner !== d.owner && !out.includes(target)) out.push(target);
  };
  for (const dir of LINES) {
    const [near] = offsets(state.board, start, [dir]);
    add(dieAt(state, near));
    if (isEmptySpace(state, near)) add(dieAt(state, offsets(state.board, near, [dir])[0]));
  }
  return out;
}

/** After a ship's move is paid for (or not, if it fired first): records the move against its shot. */
export function noteMove(s: GameState, d: Die) {
  if (firedFirst(s, d)) s.turn.shoot![d.id] = 'done';
  else if (shotCost(s, d) === 'paid') (s.turn.shoot ??= {})[d.id] = 'moved';
}

export const cubicHandlers = {
  /** Cubic Interceptor — Shoot: attack a ship 1 or 2 spaces away in a straight line, before or after its move. */
  shoot(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    const cost = shotCost(s, d);
    if (!cost) fail('This ship can’t shoot now');
    if (!shootTargets(s, d.id).some((x) => x.id === a.target)) fail('Shoot at a ship 2 spaces away in a straight line, over an empty space');
    if (cost === 'paid') spend(s, 1);
    (s.turn.shoot ??= {})[d.id] = cost === 'paid' ? 'fired' : 'done';
    startCombat(s, d, die(s, a.target), cellOf(d)!, true);
  },
} satisfies Partial<Handlers>;
