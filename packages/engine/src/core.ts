/**
 * Shared building blocks for the rule modules: errors, the log, dice, actions and the
 * dominance / research / cube bookkeeping that many rules touch.
 */
import { cardWithEffect, effectOf, SHIP_NAMES } from './data';
import type { SkillEffect } from './effects';
import { die } from './lookups';
import { canCurious, canGainResearch, canUseAbility, infamyAt, usedThisTurn } from './queries';
import { d6 } from './rng';
import { rulesOf } from './rules';
import { anySkill, hasSkill, skillRules } from './skillRules';
import { RuleError, type Action, type Die, type GameState, type LogEvent, type OncePerTurn, type Pending, type PlayerId, type TurnState } from './types';

export const ACTIONS_PER_TURN = 3;
const LOG_LIMIT = 80;

// ---------------------------------------------------------------------------
// Handler types

export type ActionOf<K extends Action['type']> = Extract<Action, { type: K }>;
export type PendingOf<K extends Pending['kind']> = Extract<Pending, { kind: K }>;

/** One handler per action type. Handlers mutate the (already cloned) state or throw a RuleError. */
export type Handlers = { [K in Action['type']]: (s: GameState, a: ActionOf<K>) => void };

// ---------------------------------------------------------------------------
// Errors, log, names

export function fail(msg: string): never {
  throw new RuleError(msg);
}

export function log(s: GameState, text: string, player?: PlayerId, event?: LogEvent) {
  s.log.push(event ? { id: ++s.logCounter, text, player, event } : { id: ++s.logCounter, text, player });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export const name = (s: GameState, p: PlayerId) => s.players[p].name;
export const shipName = (d: Die) => `${SHIP_NAMES[d.value]} (${d.value})`;

/** The pending decision at the head of the queue, if it is of the given kind. */
export function headOf<K extends Pending['kind']>(s: GameState, kind: K, message: string): PendingOf<K> {
  const head = s.pending[0];
  if (head?.kind !== kind) fail(message);
  return head as PendingOf<K>;
}

// ---------------------------------------------------------------------------
// Dice

/** Rolls a die, re-rolling until it shows a number other than `avoid` (if given). */
export function roll(s: GameState, d: Die, avoid?: number) {
  do d.value = d6(s);
  while (d.value === avoid);
  d.rolls++;
}

/** Records the die's current number among those it has shown this turn (for Reconfigure). */
export function markSeen(s: GameState, d: Die) {
  const seen = (s.turn.seen[d.id] ??= []);
  if (!seen.includes(d.value)) seen.push(d.value);
}

/**
 * Rolls one of a player's ships during play (Reconfigure, a destroyed ship, an expansion ship…).
 * Clever then lets the owner choose the number instead; Scrappy lets the player whose turn it is
 * re-roll it once, right away. `avoid` is the number a Reconfigure must move away from.
 */
export function rollShip(s: GameState, d: Die, avoid?: number) {
  roll(s, d, avoid);
  if (s.phase !== 'play') return;
  if (anySkill(s, d.owner, (r) => r.chooseShipNumbers)) s.pending.unshift({ kind: 'clever', player: d.owner, die: d.id, avoid, source: 'clever' });
  else if (d.owner === s.turn.player && anySkill(s, d.owner, (r) => r.rerollShips)) s.turn.scrappy = { die: d.id, avoid };
}

/** Reconfigure: re-roll until the number changes (see RuleSet.reconfigure). */
export function rerollNew(s: GameState, d: Die) {
  if (rulesOf(s).reconfigure === 'different') rollShip(s, d, d.value);
  else {
    const seen = (s.turn.seen[d.id] ??= [d.value]);
    if (seen.length >= 6) fail('This ship has already shown every value this turn');
    do d.value = d6(s);
    while (seen.includes(d.value));
    seen.push(d.value);
    d.rolls++;
  }
  // CE Clever: the result may be shifted by 1, even onto a number already shown this turn; no wrap
  // between 1 and 6, as with Flexible (decided 2026-10-03, OPEN-QUESTIONS #63).
  if (anySkill(s, d.owner, (r) => r.adjustReconfigure)) {
    const options = [d.value - 1, d.value, d.value + 1].filter((v) => v >= 1 && v <= 6);
    s.pending.unshift({ kind: 'clever', player: d.owner, die: d.id, options, source: 'clever' });
  }
}

/** A destroyed ship is re-rolled and goes to its owner's scrapyard. */
export function destroyShip(s: GameState, d: Die) {
  d.loc = { zone: 'scrapyard' };
  rollShip(s, d);
  s.turn.seen[d.id] = [d.value];
  if (s.phase === 'play' && anySkill(s, d.owner, (r) => r.chooseScrapyardNumber)) {
    if (!s.pending.some((p) => p.kind === 'clever' && p.die === d.id)) {
      s.pending.unshift({ kind: 'clever', player: d.owner, die: d.id, source: 'calculating' });
    }
  }
}

// ---------------------------------------------------------------------------
// Turn bookkeeping

export function emptyTurn(player: PlayerId, number: number): TurnState {
  return {
    player,
    number,
    phase: 'actions',
    actionsLeft: 0,
    freeDeploys: 0,
    freeMoves: 0,
    freeMovesUsed: 0,
    moved: {},
    abilityUsed: {},
    seen: {},
    conquests: 0,
    attacked: false,
    destroyedBy: [],
    oncePerTurn: [],
    bonus: false,
    curiousUsed: false,
    storedTacticPlayed: false,
  };
}

/** Phase-1 actions need a game in progress, no open decision, and the action phase. */
export function requireActionPhase(s: GameState, allowAfterLock = false): TurnState {
  if (s.phase !== 'play') fail('The game has not started');
  if (s.pending.length) fail('Resolve the current decision first');
  if (s.turn.phase !== 'actions') fail('Not in the action phase');
  if (!allowAfterLock && s.turn.curiousUsed) fail('No actions allowed after using Curious');
  if (!allowAfterLock && s.turn.storedTacticPlayed) fail('No actions allowed after playing a stored tactic');
  return s.turn;
}

export function spend(s: GameState, n: number) {
  if (s.turn.actionsLeft < n) fail(n === 1 ? 'No actions left' : `Needs ${n} actions`);
  s.turn.actionsLeft -= n;
}

/** Pays for a move: a Curious free move if there is one, otherwise an action. */
export function spendMove(s: GameState) {
  const t = s.turn;
  if (t.freeMoves > 0) {
    t.freeMoves--;
    t.freeMovesUsed++;
  } else if (t.actionsLeft > 0) {
    spend(s, 1);
  } else if (canCurious(s, t.player)) {
    t.curiousUsed = true;
  } else {
    fail('No actions left');
  }
}

/**
 * Original Curious (2nd-printing errata, BGG thread 1087563): the free move is only allowed on a
 * turn without attacks. Attacking forfeits it, and any free move already taken this turn is paid
 * for with an action, as if it had been an ordinary move.
 */
export function payForAttack(s: GameState) {
  const t = s.turn;
  if (t.actionsLeft < t.freeMovesUsed) fail('Curious: you took a free move, so attacking this turn costs 1 more action');
  t.actionsLeft -= t.freeMovesUsed;
  t.freeMovesUsed = 0;
  t.freeMoves = 0;
}

export function ownShip(s: GameState, id: string, zone?: Die['loc']['zone']): Die {
  const d = die(s, id);
  if (d.owner !== s.turn.player) fail('Not your ship');
  if (zone && d.loc.zone !== zone) fail(`Ship is not ${zone === 'board' ? 'on the map' : `in the ${zone}`}`);
  return d;
}

export function markMoved(s: GameState, d: Die) {
  s.turn.moved[d.id] = (s.turn.moved[d.id] ?? 0) + 1;
}

/** Uses a die's ability for this turn, falling back to Cunning for a second use. */
export function markAbility(s: GameState, d: Die) {
  if (!canUseAbility(s, d)) fail('This ship already used its ability this turn');
  if (s.turn.abilityUsed[d.id]) s.turn.oncePerTurn.push('cunning');
  s.turn.abilityUsed[d.id] = true;
}

export function oncePerTurn(s: GameState, tag: OncePerTurn) {
  if (usedThisTurn(s, tag)) fail('Already used this turn');
  s.turn.oncePerTurn.push(tag);
}

export function requireSkill(s: GameState, p: PlayerId, skill: SkillEffect) {
  if (!hasSkill(s, p, skill)) fail(`Requires the ${cardWithEffect(skill)?.name ?? skill} card`);
}

// ---------------------------------------------------------------------------
// Tracks and cubes

export function gainResearch(s: GameState, p: PlayerId, n: number) {
  if (!canGainResearch(s, p)) return;
  s.players[p].research = Math.min(6, s.players[p].research + n);
}

/**
 * Dominance reaching 6 triggers Infamy: place a cube (a pending decision), then reset to 1. With
 * nowhere to place it, dominance stays at 6 (2013 rulebook p.9: reset "after you have placed your
 * quantum cube").
 */
export function gainDominance(s: GameState, p: PlayerId, n: number) {
  const pl = s.players[p];
  pl.dominance = Math.min(6, pl.dominance + n);
  const thresh = infamyAt(s, p);
  if (pl.dominance >= thresh && !s.pending.some((x) => x.kind === 'infamy' && x.player === p)) {
    log(s, `${pl.name} achieves Infamy!`, p, 'infamy');
    s.pending.push({ kind: 'infamy', player: p });
  }
}

/**
 * `winner` destroyed an enemy ship, in combat or with a card such as Show of Force: gains `dominance`
 * plus the bonuses of their "destroy" skills (Hostile, Plundering, Ravenous; RULE-SUGGESTIONS #26).
 */
export function destroyedEnemyShip(s: GameState, winner: PlayerId, dominance: number, victim?: PlayerId) {
  const first = !s.turn.destroyedBy.includes(winner);
  if (first) s.turn.destroyedBy.push(winner);
  const ownTurn = winner === s.turn.player;
  const ctx = { first, ownTurn, ownActionPhase: ownTurn && s.turn.phase === 'actions' };
  let research = 0;
  for (const r of skillRules(s, winner)) {
    const b = r.onDestroy?.(ctx) ?? {};
    research += b.research ?? 0;
    s.turn.actionsLeft += b.actions ?? 0;
    dominance += b.dominance ?? 0;
  }
  if (research) gainResearch(s, winner, research);
  gainDominance(s, winner, dominance);
  if (victim !== undefined && victim !== winner) {
    if (s.players[victim].skills.some((sk) => effectOf(sk.id) === 'prideful')) {
      s.pending.push({ kind: 'prideful', player: winner, victim });
    }
    if (first && hasSkill(s, winner, 'ruthless') && s.players[victim].skills.some((sk) => sk.active)) {
      s.pending.push({ kind: 'ruthless', player: winner, victim });
    }
  }
}

export function loseDominance(s: GameState, p: PlayerId, n: number, destroyed = false) {
  const keep = skillRules(s, p).map((r) => r.keepDominance);
  if (keep.includes('always') || (destroyed && keep.includes('destroyed'))) return;
  const pl = s.players[p];
  pl.dominance = Math.max(1, pl.dominance - n);
}

/** Places a cube; the game ends the moment a player places their last one. */
export function placeCube(s: GameState, p: PlayerId, planetId: number) {
  const planet = s.board.planets[planetId];
  planet.cubes.push(p);
  const pl = s.players[p];
  pl.cubesLeft--;
  if (s.phase === 'play' && p === s.turn.player) s.turn.conquests++;
  if (pl.cubesLeft <= 0) {
    s.phase = 'over';
    s.winner = p;
    s.pending = [];
    log(s, `${pl.name} places their final cube and wins!`, p, 'victory');
  }
}
