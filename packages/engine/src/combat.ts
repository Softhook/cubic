/** Combat: starting an attack, missiles, resolution, advancing, and Infamy. */
import {
  destroyShip,
  fail,
  gainDominance,
  gainResearch,
  headOf,
  log,
  loseDominance,
  name,
  payForAttack,
  placeCube,
  shipName,
  type Handlers,
  type PendingOf,
} from './core';
import { cellOf, die, dieAt } from './lookups';
import { combatDice, combatOutcome, combatTotal, infamyTargets } from './queries';
import { d6 } from './rng';
import { skillRules } from './skillRules';
import type { Cell, Die, GameState, PlayerId } from './types';

/** The attacker has moved `from` next to the defender; both combat dice are rolled now. */
export function startCombat(s: GameState, attacker: Die, defender: Die, from: Cell) {
  if (attacker.owner === s.turn.player) payForAttack(s);
  const rollFor = (p: PlayerId) => Array.from({ length: combatDice(s, p) }, () => d6(s));
  const at = cellOf(defender)!;
  attacker.loc = { zone: 'board', r: from.r, c: from.c };
  s.turn.attacked = true;
  s.pending.unshift({
    kind: 'combat',
    id: ++s.combatCounter,
    attacker: { player: attacker.owner, die: attacker.id, ship: attacker.value, dice: rollFor(attacker.owner), missile: false },
    defender: { player: defender.owner, die: defender.id, ship: defender.value, dice: rollFor(defender.owner), missile: false },
    from,
    at,
  });
  log(s, `${name(s, attacker.owner)}'s ${shipName(attacker)} attacks ${name(s, defender.owner)}'s ${shipName(defender)}.`, attacker.owner);
}

/** Dominance a player gains or loses when a ship is destroyed in combat. */
function dominanceStakes(s: GameState, p: PlayerId): number {
  return Math.max(1, ...skillRules(s, p).map((r) => r.dominanceStakes ?? 1));
}

/** Effects of `winner` destroying one of `loser`'s ships in combat. */
function onDestroy(s: GameState, winner: PlayerId, loser: PlayerId) {
  const first = !s.turn.destroyedBy.includes(winner);
  if (first) s.turn.destroyedBy.push(winner);
  loseDominance(s, loser, dominanceStakes(s, loser), true);
  const ownTurn = winner === s.turn.player;
  const ctx = { first, ownTurn, ownActionPhase: ownTurn && s.turn.phase === 'actions' };
  let research = 0;
  let actions = 0;
  let dominance = dominanceStakes(s, winner);
  for (const r of skillRules(s, winner)) {
    const b = r.onDestroy?.(ctx) ?? {};
    research += b.research ?? 0;
    actions += b.actions ?? 0;
    dominance += b.dominance ?? 0;
  }
  if (research) gainResearch(s, winner, research);
  s.turn.actionsLeft += actions;
  gainDominance(s, winner, dominance);
}

function resolveCombat(s: GameState, combat: PendingOf<'combat'>) {
  const out = combatOutcome(s, combat);
  s.pending.shift();
  const att = die(s, combat.attacker.die);
  const def = die(s, combat.defender.die);
  const A = combat.attacker.player;
  const D = combat.defender.player;
  if (out.attackerWins) {
    log(s, `${name(s, A)} wins the battle (${out.attacker.total} vs ${out.defender.total}).`, A, 'battleWon');
    destroyShip(s, def);
    s.pending.unshift({ kind: 'advance', player: A, die: att.id, to: combat.at });
    onDestroy(s, A, D);
  } else if (out.stubborn) {
    log(s, `${name(s, D)} holds firm and destroys the attacker (${out.defender.total} vs ${out.attacker.total}).`, D, 'battleWon');
    destroyShip(s, att);
    onDestroy(s, D, A);
  } else {
    // Repelled: the attacker is already back on the space it attacked from.
    log(s, `${name(s, D)} repels the attack (${out.defender.total} vs ${out.attacker.total}).`, D, 'repelled');
  }
}

export const combatHandlers = {
  missile(s, a) {
    const head = headOf(s, 'combat', 'No combat to target');
    const pl = s.players[a.by];
    if (!pl || pl.missiles <= 0) fail('No missiles left');
    const side = head[a.side];
    if (side.missile || combatTotal(s, head, a.side).roll === 1) fail('That combat roll is already 1');
    pl.missiles--;
    side.missile = true;
    log(s, `${pl.name} fires a missile: ${name(s, side.player)}'s combat roll becomes 1.`, a.by, 'missile');
  },
  resolveCombat(s) {
    resolveCombat(s, headOf(s, 'combat', 'No combat to resolve'));
  },
  advance(s, a) {
    const head = headOf(s, 'advance', 'Nothing to advance');
    s.pending.shift();
    const d = die(s, head.die);
    if (a.move && !dieAt(s, head.to)) d.loc = { zone: 'board', ...head.to };
  },
  infamy(s, a) {
    const head = headOf(s, 'infamy', 'No Infamy to resolve');
    if (!infamyTargets(s, head.player).some((p) => p.id === a.planet)) fail('Choose a planet without your cube');
    s.pending.shift();
    log(s, `${name(s, head.player)} seizes planet ${s.board.planets[a.planet].number} through Infamy.`, head.player, 'seize');
    placeCube(s, head.player, a.planet);
    // Infamy during the card phase still earns a card for the cube.
    if (s.phase === 'play' && s.turn.phase === 'cards' && head.player === s.turn.player) {
      s.pending.unshift({ kind: 'takeCard', player: head.player, count: 1 });
    }
  },
} satisfies Partial<Handlers>;
