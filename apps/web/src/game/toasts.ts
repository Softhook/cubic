import { useCallback, useState } from 'react';
import type { GameState, LogEntry, LogEvent } from '@quantum/engine';
import { logText } from './logText';
import { playSounds } from './sounds';

export interface Toast {
  id: number;
  text: string;
  player?: number;
  tone: 'info' | 'good' | 'bad' | 'gold';
}

/** The toast tone for each logged event (none: no toast). Sounds are in sounds.ts. */
const TONES: Record<LogEvent, Toast['tone'] | undefined> = {
  victory: 'gold',
  infamy: 'gold',
  seize: 'gold',
  conquer: 'good',
  startPlanet: undefined,
  battleWon: 'good',
  repelled: 'bad',
  missile: 'bad',
  shipDestroyed: 'bad',
  cardTaken: 'info',
  cardPlayed: 'info',
  expansion: 'info',
  discard: 'info',
  breakthrough: 'info',
};

const toneOf = (e: LogEntry) => (e.event ? TONES[e.event] : undefined);

const MAX_TOASTS = 4;
const TOAST_MS = 4200;

/** Toasts for notable log entries. `announce(prev, next)` reacts to the entries `next` adds. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const announce = useCallback((prev: GameState, next: GameState) => {
    const fresh = next.log.filter((e) => e.id > (prev.log.at(-1)?.id ?? 0));
    playSounds(prev, next, fresh);
    const shown = fresh.flatMap((e): Toast[] => {
      const tone = toneOf(e);
      return tone ? [{ id: e.id, text: logText(next, e), player: e.player, tone }] : [];
    });
    if (!shown.length) return;
    setToasts((t) => [...t, ...shown].slice(-MAX_TOASTS));
    for (const s of shown) window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== s.id)), TOAST_MS);
  }, []);

  return { toasts, announce };
}
