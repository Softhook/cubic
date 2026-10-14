import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@quantum/engine';

/** The id of the game's last log entry, 0 before there is one. */
export const lastLogId = (game: GameState) => game.log.at(-1)?.id ?? 0;

/** Whether the step from `before` to `game` was play: undo moves ships and takes cubes away too, but never adds log entries. */
export const isPlayStep = (before: GameState, game: GameState) => lastLogId(game) > lastLogId(before);

/**
 * Things shown for a moment (an effect, an explosion, a flying card): `show` adds some, and each batch
 * goes again after `ms`. Nothing is left waiting once the component has gone.
 */
export function useTransient<T>(ms: number): [items: T[], show: (fresh: T[]) => void] {
  const [items, setItems] = useState<T[]>([]);
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);
  const show = useCallback(
    (fresh: T[]) => {
      if (!fresh.length) return;
      setItems((x) => [...x, ...fresh]);
      const t = window.setTimeout(() => {
        timers.current.delete(t);
        setItems((x) => x.filter((i) => !fresh.includes(i)));
      }, ms);
      timers.current.add(t);
    },
    [ms],
  );
  return [items, show];
}
