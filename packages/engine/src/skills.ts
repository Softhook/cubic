/** Skills / Command cards a player activates as an action of their own. Passive skills apply where their rule does. */
import { same } from './board';
import { startCombat } from './combat';
import {
  destroyShip,
  fail,
  gainDominance,
  gainResearch,
  log,
  loseDominance,
  markMoved,
  oncePerTurn,
  ownShip,
  requireActionPhase,
  requireSkill,
  type Handlers,
} from './core';
import { canMoveDie, cellOf, hasSkill, tacticalOptions } from './queries';

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
    const opts = tacticalOptions(s, d.id);
    if (a.target) {
      const target = opts.attacks.find((x) => x.id === a.target);
      if (!target) fail('Target must be adjacent');
      oncePerTurn(s, 'tactical');
      if (original) markMoved(s, d);
      startCombat(s, d, target, cellOf(d)!);
      return;
    }
    if (!a.to || !opts.moves.some((p) => same(p, a.to!))) fail('Move one space to an empty space');
    oncePerTurn(s, 'tactical');
    if (original) markMoved(s, d);
    d.loc = { zone: 'board', ...a.to };
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
