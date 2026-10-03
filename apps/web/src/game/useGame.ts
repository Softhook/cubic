import { useCallback, useEffect, useRef, useState } from 'react';
import { actor, apply, canRespondToCombat, checkInvariants, isUndoable, RuleError, type Action, type GameState, type LogEntry, type LogEvent } from '@quantum/engine';
import { chooseCombatResponse } from '@quantum/ai';
import { sfx } from '../sound';
import { aiLevelOf, think } from './aiClient';

/** Applies an action; false (with an error shown) if the rules refuse it. */
export type Dispatch = (a: Action) => boolean;

export interface Toast {
  id: number;
  text: string;
  player?: number;
  tone: 'info' | 'good' | 'bad' | 'gold';
}

/** How long the AI waits before acting (thinking time included), so humans can follow along. */
function aiDelay(s: GameState): number {
  const head = s.pending[0];
  if (s.phase === 'setup') return 650;
  if (!head) return s.turn.actionsLeft === 3 && !Object.keys(s.turn.moved).length ? 1100 : 850;
  if (head.kind === 'takeCard' || head.kind === 'peek') return 1100;
  if (head.kind === 'advance') return 700;
  return 800;
}

/** How the UI reacts to each logged event: a toast tone and a sound (either may be absent). */
const REACTIONS: Record<LogEvent, { tone?: Toast['tone']; sound?: () => void }> = {
  victory: { tone: 'gold', sound: () => sfx.win() },
  infamy: { tone: 'gold' },
  seize: { tone: 'gold', sound: () => sfx.cube() },
  conquer: { tone: 'good', sound: () => sfx.cube() },
  startPlanet: { sound: () => sfx.cube() },
  battleWon: { tone: 'good', sound: () => sfx.hit() },
  repelled: { tone: 'bad', sound: () => sfx.repel() },
  missile: { tone: 'bad', sound: () => sfx.missile() },
  shipDestroyed: { tone: 'bad', sound: () => sfx.hit() },
  cardTaken: { tone: 'info', sound: () => sfx.card() },
  cardPlayed: { tone: 'info', sound: () => sfx.card() },
  expansion: { tone: 'info', sound: () => sfx.card() },
  discard: { tone: 'info' },
  breakthrough: { tone: 'info' },
};

const reaction = (e: LogEntry) => (e.event ? REACTIONS[e.event] : {});

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
    for (const e of fresh) reaction(e).sound?.();
    const shown = fresh
      .map((e) => ({ e, tone: reaction(e).tone }))
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
      // Asked again after anything changes the battle (a re-roll or a missile).
      const stage = `${head.id}:${head.rerolls.length}:${+head.attacker.missile}${+head.defender.missile}`;
      for (const p of game.players) {
        const k = `${stage}:${p.id}`;
        if (!p.ai || !canRespondToCombat(game, head, p.id) || missileAsked.current.has(k)) continue;
        const m = chooseCombatResponse(game, p.id, { level: aiLevelOf(p) });
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
      const humanMayRespond = game.players.some((p) => !p.ai && canRespondToCombat(game, head, p.id));
      if (!humanMayRespond) timer = window.setTimeout(() => dispatch({ type: 'resolveCombat' }), 2600);
      return () => window.clearTimeout(timer);
    }

    const player = game.players[actor(game)];
    if (!player.ai) return;
    let cancelled = false;
    const started = performance.now();
    void think(game, aiLevelOf(player)).then((a) => {
      if (cancelled || !a) return;
      const wait = Math.max(0, aiDelay(game) - (performance.now() - started));
      timer = window.setTimeout(() => dispatch(a), wait);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [game, dispatch]);

  return { game, dispatch, reset, error, toasts, undo, canUndo: undoCount > 0 };
}
