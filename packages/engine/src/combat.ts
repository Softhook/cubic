/** Combat: starting an attack, missiles, resolution, advancing, and Infamy. */
import {
  destroyedEnemyShip,
  destroyShip,
  fail,
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
import { card } from './data';
import { cellOf, die, dieAt } from './lookups';
import { combatDice, combatOutcome, combatReroll, combatTotal, infamyTargets } from './queries';
import { d6 } from './rng';
import { rulesOf } from './rules';
import { anySkill, skillRules } from './skillRules';
import type { Cell, Die, GameState, PlayerId } from './types';

/**
 * The attacker has moved `from` next to the defender. A defender with Dangerous may first destroy
 * both ships; otherwise both combat dice are rolled now.
 */
export function startCombat(s: GameState, attacker: Die, defender: Die, from: Cell) {
  if (attacker.owner === s.turn.player) payForAttack(s);
  attacker.loc = { zone: 'board', r: from.r, c: from.c };
  s.turn.attacked = true;
  log(s, `${name(s, attacker.owner)}'s ${shipName(attacker)} attacks ${name(s, defender.owner)}'s ${shipName(defender)}.`, attacker.owner);
  if (anySkill(s, defender.owner, (r) => r.combat?.destroyBoth)) {
    s.pending.unshift({ kind: 'dangerous', player: defender.owner, attacker: attacker.id, defender: defender.id, from });
  } else rollCombat(s, attacker, defender, from);
}

function rollCombat(s: GameState, attacker: Die, defender: Die, from: Cell) {
  const rollFor = (p: PlayerId) => Array.from({ length: combatDice(s, p) }, () => d6(s));
  s.pending.unshift({
    kind: 'combat',
    id: ++s.combatCounter,
    attacker: { player: attacker.owner, die: attacker.id, ship: attacker.value, dice: rollFor(attacker.owner), missile: false },
    defender: { player: defender.owner, die: defender.id, ship: defender.value, dice: rollFor(defender.owner), missile: false },
    from,
    at: cellOf(defender)!,
    rerolls: [],
  });
}

/** Dominance a player gains or loses when a ship is destroyed in combat. */
function dominanceStakes(s: GameState, p: PlayerId): number {
  return Math.max(1, ...skillRules(s, p).map((r) => r.dominanceStakes ?? 1));
}

/** Effects of `winner` destroying one of `loser`'s ships in combat. */
function onDestroy(s: GameState, winner: PlayerId, loser: PlayerId) {
  loseDominance(s, loser, dominanceStakes(s, loser), true);
  destroyedEnemyShip(s, winner, dominanceStakes(s, winner));
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
  reroll(s, a) {
    const head = headOf(s, 'combat', 'No combat to re-roll');
    const skill = combatReroll(s, head, a.by, a.side);
    if (!skill) fail('No re-roll available');
    head.rerolls.push(skill.effect);
    const side = head[a.side];
    side.dice = side.dice.map(() => d6(s));
    const via = card(skill.card).name;
    const whose = a.by === side.player ? `re-rolls` : `makes ${name(s, side.player)} re-roll`;
    log(s, `${name(s, a.by)} ${whose} (${via}): ${side.dice.join(' & ')}.`, a.by);
  },
  /** Dangerous: destroy both ships (no dominance change, no "when you destroy" effects), or fight. */
  dangerous(s, a) {
    const head = headOf(s, 'dangerous', 'No Dangerous decision');
    s.pending.shift();
    const att = die(s, head.attacker);
    const def = die(s, head.defender);
    if (!a.destroy) return rollCombat(s, att, def, head.from);
    log(s, `${name(s, head.player)} is Dangerous: both ships are destroyed.`, head.player, 'shipDestroyed');
    destroyShip(s, def);
    destroyShip(s, att);
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
    s.players[head.player].dominance = 1;
    log(s, `${name(s, head.player)} seizes planet ${s.board.planets[a.planet].number} through Infamy.`, head.player, 'seize');
    placeCube(s, head.player, a.planet);
    if (s.phase !== 'play' || !rulesOf(s).cards) return;
    const ownTurn = head.player === s.turn.player;
    if (s.turn.phase === 'cards') {
      // Infamy during the card phase still earns a card for the cube: at once on the player's own
      // turn, otherwise after the active player's picks (designer, BGG thread 1087563).
      const pick: PendingOf<'takeCard'> = { kind: 'takeCard', player: head.player, count: 1 };
      if (ownTurn) s.pending.unshift(pick);
      else s.pending.push(pick);
    } else if (!ownTurn) {
      // In the action phase the active player's cube counts in turn.conquests; another player's
      // is remembered for this turn's card phase (see endTurn).
      (s.turn.offTurnCubes ??= []).push(head.player);
    }
  },
} satisfies Partial<Handlers>;
