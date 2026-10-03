/** Skills / Command cards used as an action of their own. What every skill does is in skillRules.ts. */
import { transport } from './abilities';
import { same } from './board';
import { startCombat } from './combat';
import {
  destroyShip,
  fail,
  gainDominance,
  gainResearch,
  headOf,
  log,
  loseDominance,
  markAbility,
  markMoved,
  name,
  oncePerTurn,
  ownShip,
  requireActionPhase,
  requireSkill,
  rollAvoiding,
  spend,
  type Handlers,
} from './core';
import { cellOf, die } from './lookups';
import { canMoveDie, canScrappy, nomadicTargets, tacticalOptions } from './queries';
import { hasSkill } from './skillRules';

export const skillHandlers = {
  composed(s) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'composed');
    if (s.players[t.player].dominance <= 1) fail('No dominance to lose');
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
      const fly = transport(s, d, a.passenger, a.to, a.drop, 1);
      use();
      markAbility(s, d);
      fly();
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
  nomadic(s, a) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'nomadic');
    const d = ownShip(s, a.die, 'board');
    if (!nomadicTargets(s, d.id).some((p) => same(p, a.to))) fail('Relocate to an empty orbital position of a neighbouring planet');
    oncePerTurn(s, 'nomadic');
    spend(s, 1);
    // A relocation, not a move: the ship may still move this turn (forum consensus, BGG thread 1636855).
    d.loc = { zone: 'board', ...a.to };
  },
  scrappy(s) {
    if (!canScrappy(s)) fail('Nothing to re-roll');
    const { die: id, avoid } = s.turn.scrappy!;
    delete s.turn.scrappy;
    const d = die(s, id);
    rollAvoiding(s, d, avoid);
    (s.turn.seen[d.id] ??= []).push(d.value);
    log(s, `${name(s, d.owner)} re-rolls their ship (Scrappy): ${d.value}.`, d.owner);
  },
  clever(s, a) {
    const head = headOf(s, 'clever', 'No ship number to choose');
    if (!Number.isInteger(a.value) || a.value < 1 || a.value > 6) fail('Ship numbers range from 1 to 6');
    if (a.value === head.avoid) fail('A reconfigured ship must change its number');
    s.pending.shift();
    const d = die(s, head.die);
    d.value = a.value;
    (s.turn.seen[d.id] ??= []).push(a.value);
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
