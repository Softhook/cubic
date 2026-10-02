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
import { cellOf, combatOutcome, combatTotal, die, dieAt, hasSkill, infamyTargets } from './queries';
import { d6 } from './rng';
import type { Cell, Die, GameState, PlayerId } from './types';

/** The attacker has moved `from` next to the defender; both combat dice are rolled now. */
export function startCombat(s: GameState, attacker: Die, defender: Die, from: Cell) {
  if (attacker.owner === s.turn.player) payForAttack(s);
  const rollFor = (p: PlayerId) => (hasSkill(s, p, 'brutal') ? [d6(s), d6(s)] : [d6(s)]);
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

/** Effects of `winner` destroying one of `loser`'s ships in combat. */
function onDestroy(s: GameState, winner: PlayerId, loser: PlayerId) {
  const first = !s.turn.destroyedBy.includes(winner);
  if (first) s.turn.destroyedBy.push(winner);
  loseDominance(s, loser, hasSkill(s, loser, 'ravenous-original') ? 2 : 1, true);
  const myTurn = winner === s.turn.player;
  if (first && hasSkill(s, winner, 'plundering')) gainResearch(s, winner, 3);
  if (first && myTurn && hasSkill(s, winner, 'plundering-original')) gainResearch(s, winner, 3);
  if (first && hasSkill(s, winner, 'hostile') && winner === s.turn.player && s.turn.phase === 'actions') {
    s.turn.actionsLeft++;
  }
  const gain = hasSkill(s, winner, 'ravenous-original') ? 2 : 1;
  gainDominance(s, winner, gain + (first && hasSkill(s, winner, 'ravenous') ? 1 : 0));
}

function resolveCombat(s: GameState, combat: PendingOf<'combat'>) {
  const out = combatOutcome(s, combat);
  s.pending.shift();
  const att = die(s, combat.attacker.die);
  const def = die(s, combat.defender.die);
  const A = combat.attacker.player;
  const D = combat.defender.player;
  if (out.attackerWins) {
    log(s, `${name(s, A)} wins the battle (${out.attacker.total} vs ${out.defender.total}).`, A);
    destroyShip(s, def);
    s.pending.unshift({ kind: 'advance', player: A, die: att.id, to: combat.at });
    onDestroy(s, A, D);
  } else if (out.stubborn) {
    log(s, `${name(s, D)} holds firm and destroys the attacker (${out.defender.total} vs ${out.attacker.total}).`, D);
    destroyShip(s, att);
    onDestroy(s, D, A);
  } else {
    // Repelled: the attacker is already back on the space it attacked from.
    log(s, `${name(s, D)} repels the attack (${out.defender.total} vs ${out.attacker.total}).`, D);
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
    log(s, `${pl.name} fires a missile: ${name(s, side.player)}'s combat roll becomes 1.`, a.by);
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
    log(s, `${name(s, head.player)} seizes planet ${s.board.planets[a.planet].number} through Infamy.`, head.player);
    placeCube(s, head.player, a.planet);
    // Infamy during the card phase still earns a card for the cube.
    if (s.phase === 'play' && s.turn.phase === 'cards' && head.player === s.turn.player) {
      s.pending.unshift({ kind: 'takeCard', player: head.player, count: 1 });
    }
  },
} satisfies Partial<Handlers>;
