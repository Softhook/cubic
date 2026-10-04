import { useCallback, useState } from 'react';
import type { GameState, LogEntry, LogEvent } from '@quantum/engine';
import { sfx } from '../sound';

export interface Toast {
  id: number;
  text: string;
  player?: number;
  tone: 'info' | 'good' | 'bad' | 'gold';
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

const MAX_TOASTS = 4;
const TOAST_MS = 4200;

/** Toasts for notable log entries. `announce(prev, next)` reacts to the entries `next` adds. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const announce = useCallback((prev: GameState, next: GameState) => {
    const fresh = next.log.filter((e) => e.id > (prev.log.at(-1)?.id ?? 0));
    for (const e of fresh) reaction(e).sound?.();
    const shown = fresh.flatMap((e): Toast[] => {
      const tone = reaction(e).tone;
      return tone ? [{ id: e.id, text: e.text, player: e.player, tone }] : [];
    });
    if (!shown.length) return;
    setToasts((t) => [...t, ...shown].slice(-MAX_TOASTS));
    for (const s of shown) window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== s.id)), TOAST_MS);
  }, []);

  return { toasts, announce };
}
