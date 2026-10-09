import { legalActions, type Action, type GameState, type PlayerId } from '@quantum/engine';

/** Patient (stored Tactics) for the AI: when to consider playing one, and what holding one is worth. */

/**
 * The legal actions an AI considers. Playing a stored Tactic (Patient) ends the action phase, and
 * the evaluations don't value the actions left, so it is only considered once they are spent.
 */
export function candidates(s: GameState, opts?: { includeCarry?: boolean }): Action[] {
  const all = legalActions(s, opts);
  return s.turn.actionsLeft > 0 ? all.filter((a) => a.type !== 'playStoredTactic') : all;
}

/**
 * Tactics the player holds with Patient, for the evaluations. The one played this turn still counts
 * until the turn ends, so playing it is judged by its effect alone (ties go to playing it).
 */
export function storedTactics(s: GameState, p: PlayerId): number {
  const playedNow = s.turn.player === p && s.turn.storedTacticPlayed ? 1.01 : 0;
  return (s.players[p].storedTactics?.length ?? 0) + playedNow;
}
