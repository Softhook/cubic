import { useCallback, useEffect, useRef, useState } from 'react';
import { actor, apply, checkInvariants, isUndoable, RuleError, type Action, type GameState, type LogEntry } from '@quantum/engine';
import { chooseAction, chooseMissile } from '@quantum/ai';
import { sfx } from '../sound';

export interface Toast {
  id: number;
  text: string;
  player?: number;
  tone: 'info' | 'good' | 'bad' | 'gold';
}

/** How long the AI waits before acting, so humans can follow along. */
function aiDelay(s: GameState): number {
  const head = s.pending[0];
  if (s.phase === 'setup') return 650;
  if (!head) return s.turn.actionsLeft === 3 && !Object.keys(s.turn.moved).length ? 1100 : 850;
  if (head.kind === 'takeCard' || head.kind === 'peek') return 1100;
  if (head.kind === 'advance') return 700;
  return 800;
}

function toneFor(text: string): Toast['tone'] | null {
  if (/wins!|Infamy|seizes/.test(text)) return 'gold';
  if (/conquers|wins the battle|holds firm/.test(text)) return 'good';
  if (/repels|missile|destroys/.test(text)) return 'bad';
  if (/takes the|plays|expands|breakthrough|discards/.test(text)) return 'info';
  return null;
}

function soundFor(entries: LogEntry[]) {
  for (const e of entries) {
    const t = e.text;
    if (t.includes('wins!')) sfx.win();
    else if (/conquers|seizes|deploys around/.test(t)) sfx.cube();
    else if (/wins the battle|holds firm|destroys/.test(t)) sfx.hit();
    else if (t.includes('repels')) sfx.repel();
    else if (t.includes('missile')) sfx.missile();
    else if (/takes the|plays|expands/.test(t)) sfx.card();
  }
}

/** Logs an engine bug with the state and action that trigger it (replay with window.__quantum.load). */
function reportBug(what: string, state: GameState, action: Action, error?: unknown) {
  console.error(`[quantum] ${what}`, { action, error, state: JSON.stringify(state) });
}

export function useGame(initial: GameState) {
  const [game, setGame] = useState(initial);
  const [error, setError] = useState<{ id: number; text: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ref = useRef(game);
  const missileAsked = useRef(new Set<string>());
  // States before each undoable move this turn. Cleared by anything random or final.
  const history = useRef<GameState[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const setHistory = (h: GameState[]) => {
    history.current = h;
    setUndoCount(h.length);
  };

  const commit = useCallback((next: GameState) => {
    const prev = ref.current;
    ref.current = next;
    setGame(next);
    const fresh = next.log.filter((e) => e.id > (prev.log.at(-1)?.id ?? 0));
    soundFor(fresh);
    const shown = fresh
      .map((e) => ({ e, tone: toneFor(e.text) }))
      .filter((x): x is { e: LogEntry; tone: Toast['tone'] } => !!x.tone)
      .map(({ e, tone }) => ({ id: e.id, text: e.text, player: e.player, tone }));
    if (shown.length) {
      setToasts((t) => [...t, ...shown].slice(-4));
      for (const s of shown) window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== s.id)), 4200);
    }
  }, []);

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
    ref.current = prev;
    setGame(prev);
    sfx.select();
  }, []);

  // Ctrl/Cmd+Z undoes the last move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  const reset = useCallback((s: GameState) => {
    ref.current = s;
    setHistory([]);
    missileAsked.current.clear();
    setToasts([]);
    setGame(s);
  }, []);

  // Dev-only hook for browser tests: window.__quantum.{state(), load(s), dispatch(a)}.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__quantum = { state: () => ref.current, load: commit, dispatch };
  }, [commit, dispatch]);

  // AI driver -------------------------------------------------------------------
  useEffect(() => {
    if (game.phase === 'over') return;
    const head = game.pending[0];
    let timer: number | undefined;

    if (head?.kind === 'combat') {
      for (const p of game.players) {
        const k = `${head.id}:${p.id}`;
        if (!p.ai || p.missiles <= 0 || missileAsked.current.has(k)) continue;
        const m = chooseMissile(game, p.id);
        if (!m) {
          missileAsked.current.add(k);
          continue;
        }
        timer = window.setTimeout(() => {
          missileAsked.current.add(k);
          dispatch(m);
        }, 1700);
        return () => window.clearTimeout(timer);
      }
      const humanMayRespond = game.players.some((p) => !p.ai && p.missiles > 0);
      if (!humanMayRespond) timer = window.setTimeout(() => dispatch({ type: 'resolveCombat' }), 2600);
      return () => window.clearTimeout(timer);
    }

    if (!game.players[actor(game)].ai) return;
    timer = window.setTimeout(() => {
      const a = chooseAction(ref.current, { samples: 3 });
      if (a) dispatch(a);
    }, aiDelay(game));
    return () => window.clearTimeout(timer);
  }, [game, dispatch]);

  return { game, dispatch, reset, error, toasts, undo, canUndo: undoCount > 0 };
}
