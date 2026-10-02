/**
 * Ship abilities (rulebook p.8): once per die per turn, on your own turn, ships on the map only.
 * They cost no action, except that Transport (2) and Manoeuvre (5) happen during a move.
 * Manoeuvre is part of the move handler (actions.ts); the other five are here.
 */
import { key, same } from './board';
import { startCombat } from './combat';
import { fail, markAbility, markMoved, ownShip, requireActionPhase, rerollNew, spend, type Handlers } from './core';
import { SHIP_NAMES } from './data';
import { canMoveDie, carryOptions, carryPassengers, cellOf, die, freeAttackTargets } from './queries';
import type { Die, GameState } from './types';

function useAbility(s: GameState, d: Die, value: number) {
  if (d.loc.zone !== 'board') fail('Only ships on the map can use abilities');
  if (d.value !== value) fail(`Only a ${SHIP_NAMES[value]} can do that`);
  markAbility(s, d);
}

export const abilityHandlers = {
  /** 1 Battlestation — Strike: a free 1-space move/attack that must attack; doesn't use its move. */
  freeAttack(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    if (!freeAttackTargets(s, d.id).some((x) => x.id === a.target)) fail('Target must be adjacent');
    useAbility(s, d, 1);
    startCombat(s, d, die(s, a.target), cellOf(d)!);
  },
  /** 2 Flagship — Transport: pick up a ship from a surrounding space, move, drop it in a surrounding space. */
  carry(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    if (!canMoveDie(s, d)) fail('This ship already moved this turn');
    if (!carryPassengers(s, d.id).some((x) => x.id === a.passenger)) fail('Passenger must be next to the flagship');
    const dest = carryOptions(s, d.id, a.passenger).get(key(a.to));
    if (!dest || !dest.drops.some((p) => same(p, a.drop))) fail('Invalid carry');
    if (same(a.to, a.drop)) fail('Drop the passenger next to the flagship');
    spend(s, 1);
    useAbility(s, d, 2);
    d.loc = { zone: 'board', ...a.to };
    die(s, a.passenger).loc = { zone: 'board', ...a.drop };
    markMoved(s, d);
  },
  /** 3 Destroyer — Warp: swap places with another of your ships on the map; not its move. */
  swap(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    const o = ownShip(s, a.other, 'board');
    if (o.id === d.id) fail('Choose another ship');
    useAbility(s, d, 3);
    [d.loc, o.loc] = [o.loc, d.loc];
  },
  /** 4 Frigate — Modify: become a 3 or a 5 (and so can't use the new ship's ability this turn). */
  change(s, a) {
    const t = requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    if (a.value !== 3 && a.value !== 5) fail('A frigate becomes a 3 or a 5');
    useAbility(s, d, 4);
    d.value = a.value;
    (t.seen[d.id] ??= []).push(a.value);
  },
  /** 6 Scout — Free Reconfigure. */
  freeReconfigure(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    useAbility(s, d, 6);
    rerollNew(s, d);
  },
} satisfies Partial<Handlers>;
