import { useCallback, useEffect, useRef, useState } from 'react';
import { actor, apply, checkInvariants, isUndoable, RuleError, type Action, type GameState, type PlayerId } from '@quantum/engine';
import { sfx } from '../sound';
import { useToasts } from './toasts';
import { saveGame } from './savedGame';
import { useAiDriver } from './useAiDriver';
import { useShortcut } from './useShortcut';
import type { GameView } from './view';

/** Applies an action; false (with an error shown) if the rules refuse it. */
export type Dispatch = (a: Action) => boolean;

/** Logs an engine bug with the state and action that trigger it (replay with window.__quantum.load). */
function reportBug(what: string, state: GameState, action: Action, error?: unknown) {
  console.error(`[quantum] ${what}`, { action, error, state: JSON.stringify(state) });
}

/** The game being played on this device: its state, `dispatch`, undo, toasts and errors. AI players move by themselves. */
export function useGame(initial: GameState): GameView {
  const [game, setGame] = useState(initial);
  const [error, setError] = useState<{ id: number; text: string } | null>(null);
  const { toasts, announce } = useToasts();
  const ref = useRef(game);
  // States before each undoable move this turn. Cleared by anything random or final.
  const history = useRef<GameState[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const setHistory = (h: GameState[]) => {
    history.current = h;
    setUndoCount(h.length);
  };

  const show = (next: GameState) => {
    ref.current = next;
    setGame(next);
  };

  const commit = useCallback(
    (next: GameState) => {
      const prev = ref.current;
      show(next);
      announce(prev, next);
    },
    [announce],
  );

  const dispatch = useCallback(
    (a: Action): boolean => {
      const prev = ref.current;
      let next: GameState;
      try {
        next = apply(prev, a);
      } catch (e) {
        sfx.error();
        if (e instanceof RuleError) {
          setError({ id: Date.now(), text: e.message });
        } else {
          // An engine bug. Keep the game running and log what is needed to reproduce it.
          reportBug('apply threw', prev, a, e);
          setError({ id: Date.now(), text: `Engine error: ${(e as Error).message} (details in the console)` });
        }
        return false;
      }
      if (import.meta.env.DEV) {
        const broken = checkInvariants(next);
        if (broken.length) reportBug(`invariants broken: ${broken.join('; ')}`, prev, a);
      }
      const human = !prev.players[actor(prev)].ai;
      setHistory(human && isUndoable(prev, a, next) ? [...history.current, prev] : []);
      commit(next);
      return true;
    },
    [commit],
  );

  const undo = useCallback(() => {
    const prev = history.current.at(-1);
    if (!prev) return;
    setHistory(history.current.slice(0, -1));
    show(prev);
    sfx.select();
  }, []);

  useUndoShortcut(undo);
  const aiResponding = useAiDriver(game, dispatch);

  // Keep the unfinished game in the browser so a revisit can resume it.
  useEffect(() => saveGame(game), [game]);

  // Dev-only hook for browser tests: window.__quantum.{state(), load(s), dispatch(a)}.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__quantum = { state: () => ref.current, load: commit, dispatch };
  }, [commit, dispatch]);

  const mine = useCallback((p: PlayerId) => !ref.current.players[p].ai, []);
  return { game, dispatch, mine, error, toasts, undo: undoCount > 0 ? undo : undefined, aiResponding };
}

/** Ctrl/Cmd+Z undoes the last move, unless the user is typing or a dialog is open over the board. */
export function useUndoShortcut(undo: (() => void) | undefined) {
  useShortcut(
    (e) => (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z',
    (e) => {
      e.preventDefault();
      undo?.();
    },
  );
}
