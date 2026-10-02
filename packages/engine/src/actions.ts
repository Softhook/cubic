/** The five phase-1 actions (Move/Attack, Deploy, Reconfigure, Research, Conquer) and ending the turn. */
import { key, same } from './board';
import { startCombat } from './combat';
import {
  fail,
  gainResearch,
  log,
  markAbility,
  markMoved,
  name,
  ownShip,
  placeCube,
  requireActionPhase,
  rerollNew,
  spend,
  spendMove,
  type Handlers,
} from './core';
import { canMoveDie, canReconfigure, conquerCheck, deployTargets, die, hasSkill, moveOptions } from './queries';
import { rulesOf } from './rules';
import { endTurn } from './turn';

export const actionHandlers = {
  move(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    if (!canMoveDie(s, d)) fail('This ship already moved this turn');
    const opt = moveOptions(s, d.id).moves.get(key(a.to));
    if (!opt) fail('Out of range');
    spendMove(s);
    if (opt.diagonal) markAbility(s, d); // Interceptor manoeuvre
    d.loc = { zone: 'board', ...a.to };
    markMoved(s, d);
  },
  attack(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die, 'board');
    if (!canMoveDie(s, d)) fail('This ship already moved this turn');
    const opt = moveOptions(s, d.id).attacks.get(a.target);
    if (!opt) fail('Target out of range');
    spend(s, 1);
    if (opt.diagonal) markAbility(s, d);
    markMoved(s, d);
    startCombat(s, d, die(s, a.target), opt.from);
  },
  deploy(s, a) {
    const t = requireActionPhase(s);
    const d = ownShip(s, a.die, 'scrapyard');
    if (!deployTargets(s, t.player).some((p) => same(p, a.to))) fail('Deploy into orbit of a planet with your cube');
    if (hasSkill(s, t.player, 'eager')) {
      /* Eager: deploying is free */
    } else if (t.freeDeploys > 0) t.freeDeploys--;
    else spend(s, 1);
    d.loc = { zone: 'board', ...a.to };
  },
  reconfigure(s, a) {
    requireActionPhase(s);
    const d = ownShip(s, a.die);
    if (!canReconfigure(s, d)) fail('This ship cannot be reconfigured');
    spend(s, 1);
    rerollNew(s, d);
  },
  research(s) {
    const t = requireActionPhase(s);
    if (!rulesOf(s).cards) fail('This mode has no research');
    if (s.players[t.player].research >= 6) fail('Research is already at 6');
    if (hasSkill(s, t.player, 'righteous')) fail('Righteous: you cannot gain research');
    spend(s, 1);
    gainResearch(s, t.player, 1);
  },
  conquer(s, a) {
    const t = requireActionPhase(s);
    const check = conquerCheck(s, t.player, a.planet);
    if (!check.ok) fail(check.reason ?? 'Cannot conquer');
    spend(s, 2);
    log(s, `${name(s, t.player)} conquers planet ${s.board.planets[a.planet].number}.`, t.player);
    placeCube(s, t.player, a.planet);
  },
  endTurn(s) {
    requireActionPhase(s);
    endTurn(s);
  },
} satisfies Partial<Handlers>;
