import { legalActions, type Action, type GameState, type PlayerId } from '@quantum/engine';
import { storedTacticValue } from './cardValues';

/** The card decisions the evaluation alone gets wrong: Patient (stored Tactics: when to play one, what holding one is worth) and Calculating. */

const CALCULATING_ORDER = [4, 3, 5, 2, 6, 1];

/**
 * The legal actions an AI considers. Playing a stored Tactic (Patient) ends the action phase, and
 * the evaluations don't value the actions left, so it is only considered once they are spent.
 */
export function candidates(s: GameState, opts?: { includeCarry?: boolean }): Action[] {
  const all = legalActions(s, opts);
  // Calculating: the evaluation can't tell ship numbers in the scrapyard apart, so ties go to the
  // first. A Frigate (4) can become a 3 or 5 for free, the most flexible; over 200 games each,
  // Calculating won 57% this way against 40% taking 1s (docs/card-benchmark.md).
  const head = s.pending[0];
  if (head?.kind === 'clever' && head.source === 'calculating') {
    const rank = (a: Action) => (a.type === 'clever' ? CALCULATING_ORDER.indexOf(a.value) : 99);
    all.sort((a, b) => rank(a) - rank(b));
  }
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

/** What the player's stored Tactics are worth, card by card; like storedTactics, the one played this turn still counts. */
export function storedTacticsValue(s: GameState, p: PlayerId): number {
  let v = (s.players[p].storedTactics ?? []).reduce((sum, id) => sum + storedTacticValue(id), 0);
  // The stored Tactic played this turn is the last one discarded.
  const played = s.turn.player === p && s.turn.storedTacticPlayed ? s.market.tacticDiscard.at(-1) : undefined;
  if (played) v += 1.01 * storedTacticValue(played);
  return v;
}
