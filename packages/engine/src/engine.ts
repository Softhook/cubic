/**
 * The rules engine's public API: a game is a pure `(state, action) → state` function.
 *
 * Every action type has exactly one handler (the Handlers type makes the compiler enforce it),
 * grouped by topic:
 *
 *   setup.ts      game creation, fleet roll, starting skill, starting planet and ships
 *   actions.ts    Move/Attack, Deploy, Reconfigure, Research, Conquer, end turn
 *   abilities.ts  ship abilities 1–6
 *   combat.ts     attacks, missiles, advancing, Infamy
 *   cards.ts      the card market, Tactic effects and their decisions
 *   effects.ts    the implemented Skill and Tactic effects, as types
 *   skills.ts     skills a player activates
 *   turn.ts       start / end of turn, and auto-resolving decisions after each action
 *   legal.ts      legal action enumeration (AI, UI hints)
 *   rules.ts      what differs between rule sets (Basic, Original, Community)
 *   core.ts       shared helpers: errors, log, dice, tracks, cubes
 *   queries.ts    read-only questions about a state (movement, conquering, combat totals…)
 *   invariants.ts consistency checks every state must pass (tests, dev builds)
 */
import { abilityHandlers } from './abilities';
import { actionHandlers } from './actions';
import { cardHandlers } from './cards';
import { combatHandlers } from './combat';
import type { Handlers } from './core';
import { setupHandlers } from './setup';
import { skillHandlers } from './skills';
import { settle } from './turn';
import { RuleError, type Action, type GameState, type Pending, type PlayerId } from './types';

const HANDLERS: Handlers = {
  ...setupHandlers,
  ...actionHandlers,
  ...abilityHandlers,
  ...combatHandlers,
  ...cardHandlers,
  ...skillHandlers,
};

/** Applies an action and returns the new state. Throws RuleError if the action is illegal. */
export function apply(prev: GameState, action: Action): GameState {
  if (prev.phase === 'over') throw new RuleError('The game is over');
  const handler = HANDLERS[action.type] as ((s: GameState, a: Action) => void) | undefined;
  if (!handler) throw new RuleError(`Unknown action ${action.type}`);
  const s = structuredClone(prev);
  handler(s, action);
  settle(s);
  return s;
}

/** Like apply, but returns null instead of throwing for an illegal action. */
export function tryApply(prev: GameState, action: Action): GameState | null {
  try {
    return apply(prev, action);
  } catch (e) {
    if (e instanceof RuleError) return null;
    throw e;
  }
}

/** The player who must act next (for combat: the attacker, who resolves it). */
export function actor(state: GameState): PlayerId {
  const head = state.pending[0];
  if (!head) return state.turn.player;
  if (head.kind === 'combat') return head.attacker.player;
  return head.player;
}

export function currentPending(state: GameState): Pending | undefined {
  return state.pending[0];
}
