/**
 * Shared building blocks for the rule modules: errors, the log, dice, actions and the
 * dominance / research / cube bookkeeping that many rules touch.
 */
import { cardWithEffect, SHIP_NAMES } from './data';
import type { SkillEffect } from './effects';
import { die } from './lookups';
import { canGainResearch, canUseAbility, usedThisTurn } from './queries';
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

export function roll(s: GameState, d: Die) {
  d.value = d6(s);
  d.rolls++;
}

/** Rolls a die, re-rolling until it shows a number other than `avoid`. */
export function rollAvoiding(s: GameState, d: Die, avoid?: number) {
  do d.value = d6(s);
  while (d.value === avoid);
  d.rolls++;
}

/**
 * Rolls one of a player's ships during play (Reconfigure, a destroyed ship, an expansion ship…).
 * Clever then lets the owner choose the number instead; Scrappy lets the player whose turn it is
 * re-roll it once, right away. `avoid` is the number a Reconfigure must move away from.
 */
export function rollShip(s: GameState, d: Die, avoid?: number) {
  rollAvoiding(s, d, avoid);
  if (s.phase !== 'play') return;
  if (anySkill(s, d.owner, (r) => r.chooseShipNumbers)) s.pending.unshift({ kind: 'clever', player: d.owner, die: d.id, avoid });
  else if (d.owner === s.turn.player && anySkill(s, d.owner, (r) => r.rerollShips)) s.turn.scrappy = { die: d.id, avoid };
}

/** Reconfigure: re-roll until the number changes (see RuleSet.reconfigure). */
export function rerollNew(s: GameState, d: Die) {
  if (rulesOf(s).reconfigure === 'different') {
    rollShip(s, d, d.value);
    return;
  }
  const seen = (s.turn.seen[d.id] ??= [d.value]);
  if (seen.length >= 6) fail('This ship has already shown every value this turn');
  do d.value = d6(s);
  while (seen.includes(d.value));
  seen.push(d.value);
  d.rolls++;
}

/** A destroyed ship is re-rolled and goes to its owner's scrapyard. */
export function destroyShip(s: GameState, d: Die) {
  d.loc = { zone: 'scrapyard' };
  rollShip(s, d);
  s.turn.seen[d.id] = [d.value];
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
  };
}

/** Phase-1 actions need a game in progress, no open decision, and the action phase. */
export function requireActionPhase(s: GameState): TurnState {
  if (s.phase !== 'play') fail('The game has not started');
  if (s.pending.length) fail('Resolve the current decision first');
  if (s.turn.phase !== 'actions') fail('Not in the action phase');
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
  } else spend(s, 1);
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

/** Dominance reaching 6 triggers Infamy: reset to 1 and place a cube (a pending decision). */
export function gainDominance(s: GameState, p: PlayerId, n: number) {
  const pl = s.players[p];
  pl.dominance = Math.min(6, pl.dominance + n);
  if (pl.dominance >= 6) {
    pl.dominance = 1;
    log(s, `${pl.name} achieves Infamy!`, p, 'infamy');
    s.pending.push({ kind: 'infamy', player: p });
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
