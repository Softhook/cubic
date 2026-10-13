import { useMemo, useState } from 'react';
import type { GameState, LogEntry } from '@quantum/engine';
import { useShortcut } from './useShortcut';

/**
 * For each log entry, the position just after it was written: what the map looked like then. `states`
 * is every position of the game, oldest first. An undo goes back to an earlier position, whose next
 * entries reuse the undone ones' ids; the later position wins, as it is the one the log shows.
 */
export function logPositions(states: readonly GameState[]): Map<number, GameState> {
  const out = new Map<number, GameState>();
  let last = states[0]?.logCounter ?? 0;
  for (const s of states) {
    for (let i = s.log.length - 1; i >= 0 && s.log[i].id > last; i--) out.set(s.log[i].id, s);
    last = s.logCounter;
  }
  return out;
}

export interface Review {
  /** The log entry being looked back at, and the position just after it. */
  entry: LogEntry;
  state: GameState;
  /** The entry before or after it that can be looked back at too, if any. */
  prev?: () => void;
  next?: () => void;
  close(): void;
}

/**
 * Looking back at the game from its log: `pick` an entry to show the map as it was just after it.
 * `game` is the game as it is now, whose log is on screen. ←/→ step through the log, Esc goes back.
 */
export function useReview(game: GameState, positions: readonly GameState[]) {
  const [picked, setPicked] = useState<number | null>(null);
  const at = useMemo(() => logPositions(positions), [positions]);
  const entries = useMemo(() => game.log.filter((e) => at.has(e.id)), [game.log, at]);
  const i = entries.findIndex((e) => e.id === picked);
  const close = () => setPicked(null);
  const go = (j: number) => (j >= 0 && j < entries.length ? () => setPicked(entries[j].id) : undefined);
  // An entry that is gone (taken back by an undo, or too old for the log) ends the review.
  const review: Review | null =
    i < 0 ? null : { entry: entries[i], state: at.get(entries[i].id)!, prev: go(i - 1), next: go(i + 1), close };

  useShortcut(
    (e) =>
      !!review &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      ['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key) &&
      // Escape shuts the phone's bottom sheet first, if it is open (BottomSheet).
      !(e.key === 'Escape' && document.querySelector('.sheet.open')),
    (e) => {
      e.preventDefault();
      if (e.key === 'Escape') close();
      else (e.key === 'ArrowLeft' ? review?.prev : review?.next)?.();
    },
  );

  /** Whether an entry can be looked back at. */
  const can = (id: number) => at.has(id);
  /** Looks back at an entry; picking the one already shown goes back to the game. */
  const pick = (id: number) => setPicked((cur) => (cur === id ? null : id));
  return { review, can, pick };
}
