/** Legal action enumeration, used by the AI and for UI hints. */
import { same, spaces } from './board';
import { actor, tryApply } from './engine';
import type { PendingOf } from './core';
import { reserve, scrapyard, shipsOnBoard } from './lookups';
import {
  actionsClosed,
  canCurious,
  canGainResearch,
  canMoveDie,
  canPlayStoredTactic,
  canReconfigure,
  canScrappy,
  canUseAbility,
  carryOptions,
  carryPassengers,
  combatRerolls,
  conquerCheck,
  deploysFree,
  deployTargets,
  freeAttackTargets,
  infamyTargets,
  moveOptions,
  nomadicTargets,
  relocationOptions,
  startSlots,
  tacticalOptions,
  usedThisTurn,
} from './queries';
import { rulesOf } from './rules';
import { anySkill, hasSkill } from './skillRules';
import type { Action, Die, GameState, Pending } from './types';

/**
 * Candidate answers to each pending decision. Candidates may include illegal ones:
 * legalActions() keeps only those the engine accepts.
 */
const DECISION_CANDIDATES: { [K in Pending['kind']]: (s: GameState, head: PendingOf<K>) => Action[] } = {
  setupRoll: (_, head) => [{ type: 'setupKeep' }, ...(head.rerolled ? [] : [{ type: 'setupReroll' } as const])],
  skillDraft: (_, head) => head.options.map((skill) => ({ type: 'draftSkill', skill })),
  placeStart: (s) => s.board.planets.filter((p) => p.start && !p.cubes.length).map((p) => ({ type: 'placeStart', planet: p.id })),
  placeShips: (s, head) =>
    scrapyard(s, head.player).flatMap((d) => startSlots(s, head.planet).map((to) => ({ type: 'placeShip', die: d.id, to }) as const)),
  combat: (s, head) => {
    const out: Action[] = [{ type: 'resolveCombat' }];
    for (const pl of s.players) {
      if (pl.missiles <= 0) continue;
      if (!head.attacker.missile) out.push({ type: 'missile', by: pl.id, side: 'attacker' });
      if (!head.defender.missile) out.push({ type: 'missile', by: pl.id, side: 'defender' });
    }
    for (const by of [head.attacker.player, head.defender.player]) {
      for (const { side } of combatRerolls(s, head, by)) out.push({ type: 'reroll', by, side });
    }
    return out;
  },
  dangerous: () => [
    { type: 'dangerous', destroy: false },
    { type: 'dangerous', destroy: true },
  ],
  brilliant: () => [
    { type: 'brilliant', gain: true },
    { type: 'brilliant', gain: false },
  ],
  clever: (_, head) => (head.options ?? [1, 2, 3, 4, 5, 6].filter((v) => v !== head.avoid)).map((value) => ({ type: 'clever', value })),
  relocation: (s, head) => relocationOptions(s, head.player).map((o) => ({ type: 'relocate', ...o })),
  advance: () => [
    { type: 'advance', move: true },
    { type: 'advance', move: false },
  ],
  infamy: (s, head) => infamyTargets(s, head.player).map((p) => ({ type: 'infamy', planet: p.id })),
  takeCard: (s, head) => {
    const m = s.market;
    const out: Action[] = [];
    const patient = anySkill(s, head.player, (r) => r.storeTactics);
    m.skillRow.forEach((_, index) => out.push({ type: 'takeCard', deck: 'skill', index }));
    m.tacticRow.forEach((_, index) => {
      out.push({ type: 'takeCard', deck: 'tactic', index });
      if (patient) out.push({ type: 'takeCard', deck: 'tactic', index, store: true });
    });
    if (m.expansions > 0 && reserve(s, head.player).length) out.push({ type: 'takeCard', deck: 'expansion', index: 0 });
    out.push({ type: 'refreshMarket' }, { type: 'profiteer' });
    return out;
  },
  peek: () => [
    { type: 'peekChoice', takeTop: true },
    { type: 'peekChoice', takeTop: false },
  ],
  discardSkill: (s, head) =>
    s.players[head.player].skills
      .filter((sk) => sk.id !== head.cannotDiscard)
      .map((sk) => ({ type: 'discardSkill', skill: sk.id })),
  placeExpansion: (s, head) => [
    { type: 'placeExpansion', to: null },
    ...deployTargets(s, head.player).map((to) => ({ type: 'placeExpansion', to }) as const),
  ],
  showOfForce: (s) => shipsOnBoard(s).map((d) => ({ type: 'showOfForce', die: d.id })),
  warpGate: (s, head) =>
    spaces(s.board)
      .filter((cell) => !head.placed.some((p) => same(p, cell)))
      .map((cell) => ({ type: 'warpGate', cell })),
  changeOfHeart: (s) => [...new Set(s.market.skillDeck)].map((skill) => ({ type: 'changeOfHeart', skill })),
  patientTactic: (s) => [{ type: 'patientTactic' } as const, ...s.market.tacticRow.map((_, index) => ({ type: 'patientTactic', index }) as const)],
  prideful: () => [{ type: 'prideful', take: true }, { type: 'prideful', take: false }],
  ruthless: (s, head) => [
    { type: 'ruthless' } as const,
    ...s.players[head.victim].skills.filter((sk) => sk.active).map((sk) => ({ type: 'ruthless', skill: sk.id }) as const),
  ],
  unveil: (s, head) => {
    const out: Action[] = [{ type: 'unveilDone' }];
    const targets = deployTargets(s, head.player);
    const rerollable = head.reorganize
      ? s.dice.filter((d) => d.owner === head.player && d.loc.zone !== 'reserve')
      : scrapyard(s, head.player);
    for (const d of rerollable) if (!head.rerolled.includes(d.id)) out.push({ type: 'unveilReroll', die: d.id });
    for (const d of scrapyard(s, head.player)) {
      if (head.reorganize && !head.rerolled.includes(d.id)) continue;
      for (const to of targets) out.push({ type: 'unveilDeploy', die: d.id, to });
    }
    return out;
  },
};

/** Every Flagship transport by `d`: passenger, destination and drop. `range` 1 is Tactical's step. */
function carries(s: GameState, d: Die, range?: number) {
  return carryPassengers(s, d.id).flatMap((p) =>
    [...carryOptions(s, d.id, p.id, range).values()].flatMap((dest) => dest.drops.map((drop) => ({ passenger: p.id, to: dest.cell, drop }))),
  );
}

/** Phase-1 options for the current player. `includeCarry` adds every Flagship transport (many). */
function actionPhaseOptions(s: GameState, opts: { includeCarry?: boolean }): Action[] {
  const me = s.turn.player;
  const t = s.turn;
  const pl = s.players[me];
  const out: Action[] = [{ type: 'endTurn' }];

  if (canPlayStoredTactic(s, me)) {
    for (const c of pl.storedTactics ?? []) out.push({ type: 'playStoredTactic', card: c });
  }

  if (actionsClosed(t)) return out;

  const actions = t.actionsLeft;
  // A move is paid with an action, an Original Curious free move, or the CE Curious extra action (spendMove).
  const curious = actions === 0 && canCurious(s, me);
  const canPayMove = actions > 0 || t.freeMoves > 0 || curious;
  // Attacking makes you pay for any Curious free moves already taken (payForAttack).
  const canAttack = (cost: number) => actions >= cost + t.freeMovesUsed;
  const nomadic = actions > 0 && hasSkill(s, me, 'nomadic') && !usedThisTurn(s, 'nomadic');

  for (const d of shipsOnBoard(s, me)) {
    if (canPayMove && canMoveDie(s, d)) {
      const moves = moveOptions(s, d.id);
      for (const m of moves.moves.values()) out.push({ type: 'move', die: d.id, to: m.cell });
      if (canAttack(1)) for (const target of moves.attacks.keys()) out.push({ type: 'attack', die: d.id, target });
    }
    if (actions > 0 && canReconfigure(s, d)) out.push({ type: 'reconfigure', die: d.id });
    if ((hasSkill(s, me, 'tactical') || (hasSkill(s, me, 'tactical-original') && canMoveDie(s, d))) && !usedThisTurn(s, 'tactical')) {
      const tac = tacticalOptions(s, d.id);
      for (const m of tac.moves) out.push({ type: 'tactical', die: d.id, to: m.cell });
      if (canAttack(0)) for (const x of tac.attacks) out.push({ type: 'tactical', die: d.id, target: x.die.id });
      if (d.value === 2 && opts.includeCarry && canUseAbility(s, d)) {
        for (const c of carries(s, d, 1)) out.push({ type: 'tactical', die: d.id, ...c });
      }
    }
    if (canUseAbility(s, d)) {
      if (d.value === 1 && canAttack(0)) for (const x of freeAttackTargets(s, d.id)) out.push({ type: 'freeAttack', die: d.id, target: x.id });
      if (d.value === 3) for (const o of shipsOnBoard(s, me)) if (o.id !== d.id) out.push({ type: 'swap', die: d.id, other: o.id });
      if (d.value === 4) out.push({ type: 'change', die: d.id, value: 3 }, { type: 'change', die: d.id, value: 5 });
      if (d.value === 6) out.push({ type: 'freeReconfigure', die: d.id });
      if (d.value === 2 && opts.includeCarry && canPayMove && canMoveDie(s, d)) {
        for (const c of carries(s, d)) out.push({ type: 'carry', die: d.id, ...c });
      }
    }
    if (hasSkill(s, me, 'flexible') && !usedThisTurn(s, 'flexible')) {
      if (d.value < 6) out.push({ type: 'flexible', die: d.id, delta: 1 });
      if (d.value > 1) out.push({ type: 'flexible', die: d.id, delta: -1 });
    }
    if (hasSkill(s, me, 'resourceful') && !usedThisTurn(s, 'resourceful')) {
      out.push({ type: 'resourceful', die: d.id });
    }
    if (nomadic) for (const to of nomadicTargets(s, d.id)) out.push({ type: 'nomadic', die: d.id, to });
  }
  const freeDeploy = deploysFree(s, me);
  const targets = deployTargets(s, me);
  for (const d of scrapyard(s, me)) {
    if (actions > 0 || t.freeDeploys > 0 || freeDeploy) for (const to of targets) out.push({ type: 'deploy', die: d.id, to });
    if (actions > 0 && canReconfigure(s, d)) out.push({ type: 'reconfigure', die: d.id });
  }
  if (rulesOf(s).cards && (actions > 0 || curious) && pl.research < 6 && canGainResearch(s, me)) out.push({ type: 'research' });
  if (hasSkill(s, me, 'tyrannical-original') && !usedThisTurn(s, 'tyrannical') && pl.research > 1) out.push({ type: 'tyrannical' });
  if (actions >= 2) for (const p of s.board.planets) if (conquerCheck(s, me, p.id).ok) out.push({ type: 'conquer', planet: p.id });
  if (hasSkill(s, me, 'composed') && !usedThisTurn(s, 'composed') && pl.dominance > 1 && canGainResearch(s, me)) out.push({ type: 'composed' });
  if (hasSkill(s, me, 'ambitious') && !usedThisTurn(s, 'ambitious')) out.push({ type: 'ambitious' });
  return out;
}

export function legalActions(s: GameState, opts: { includeCarry?: boolean } = {}): Action[] {
  if (s.phase === 'over') return [];
  const head = s.pending[0];
  let out: Action[];
  if (head) {
    const candidates = (DECISION_CANDIDATES[head.kind] as (s: GameState, h: Pending) => Action[])(s, head);
    out = candidates.filter((a) => tryApply(s, a) !== null);
  } else if (s.phase === 'play' && s.turn.phase === 'actions') out = actionPhaseOptions(s, opts);
  else return [];
  // Scrappy's re-roll is open to the player whose turn it is, whatever they are deciding.
  if (canScrappy(s) && actor(s) === s.turn.player) out.push({ type: 'scrappy' });
  return out;
}
