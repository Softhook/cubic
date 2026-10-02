/** Skills / Command cards a player activates as an action of their own. Passive skills apply where their rule does. */
import { key, same } from './board';
import { startCombat } from './combat';
import {
  destroyShip,
  fail,
  gainDominance,
  gainResearch,
  log,
  loseDominance,
  markAbility,
  markMoved,
  oncePerTurn,
  ownShip,
  requireActionPhase,
  requireSkill,
  type Handlers,
} from './core';
import { canMoveDie, carryOptions, carryPassengers, cellOf, die, hasSkill, tacticalOptions } from './queries';

export const skillHandlers = {
  composed(s) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'composed');
    oncePerTurn(s, 'composed');
    loseDominance(s, t.player, 1);
    gainResearch(s, t.player, 3);
  },
  ambitious(s) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'ambitious');
    oncePerTurn(s, 'ambitious');
    const pl = s.players[t.player];
    t.actionsLeft++;
    pl.ambitionTokens++;
    if (pl.ambitionTokens >= 3) {
      pl.skills = pl.skills.filter((x) => x.id !== 'ambitious');
      pl.ambitionTokens = 0;
      s.market.skillDiscard.push('ambitious');
      log(s, `${pl.name}'s Ambitious skill is exhausted.`, t.player);
    }
  },
  flexible(s, a) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'flexible');
    const d = ownShip(s, a.die, 'board');
    const v = d.value + a.delta;
    if (v < 1 || v > 6) fail('Ship numbers range from 1 to 6');
    oncePerTurn(s, 'flexible');
    d.value = v;
    (t.seen[d.id] ??= []).push(v);
  },
  tyrannical(s) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'tyrannical-original');
    const pl = s.players[t.player];
    if (pl.research <= 1) fail('No research to convert');
    oncePerTurn(s, 'tyrannical');
    pl.research--;
    gainDominance(s, t.player, 1);
  },
  tactical(s, a) {
    const t = requireActionPhase(s);
    const original = hasSkill(s, t.player, 'tactical-original');
    if (!original) requireSkill(s, t.player, 'tactical');
    const d = ownShip(s, a.die, 'board');
    if (original && !canMoveDie(s, d)) fail('This ship already moved this turn');
    // Tactical moves the ship; the Original card counts it as the ship's one move for the turn.
    const use = () => {
      oncePerTurn(s, 'tactical');
      if (original) markMoved(s, d);
    };
    if (a.passenger) {
      // Flagship Transport over the 1 space (forum consensus, BGG thread 1093051).
      if (d.value !== 2) fail('Only a Flagship can transport');
      if (!a.to || !a.drop) fail('Invalid carry');
      if (!carryPassengers(s, d.id).some((x) => x.id === a.passenger)) fail('Passenger must be next to the flagship');
      const dest = carryOptions(s, d.id, a.passenger, 1).get(key(a.to));
      if (!dest || !dest.drops.some((p) => same(p, a.drop!))) fail('Invalid carry');
      if (same(a.to, a.drop)) fail('Drop the passenger next to the flagship');
      use();
      markAbility(s, d);
      d.loc = { zone: 'board', ...a.to };
      die(s, a.passenger).loc = { zone: 'board', ...a.drop };
      return;
    }
    const opts = tacticalOptions(s, d.id);
    if (a.target) {
      const opt = opts.attacks.find((x) => x.die.id === a.target);
      if (!opt) fail('Target must be adjacent');
      use();
      if (opt.diagonal) markAbility(s, d); // Interceptor manoeuvre
      startCombat(s, d, opt.die, cellOf(d)!);
      return;
    }
    const opt = a.to && opts.moves.find((x) => same(x.cell, a.to!));
    if (!opt) fail('Move one space to an empty space');
    use();
    if (opt.diagonal) markAbility(s, d);
    d.loc = { zone: 'board', ...opt.cell };
  },
  resourceful(s, a) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'resourceful');
    const d = ownShip(s, a.die, 'board');
    oncePerTurn(s, 'resourceful');
    destroyShip(s, d);
    t.actionsLeft++;
  },
} satisfies Partial<Handlers>;
