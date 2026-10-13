import { useEffect, useState, type CSSProperties } from 'react';
import type { GameState } from '@quantum/engine';
import type { Toast } from '../game/toasts';

/** The game's news. `now`: the screen shows an earlier position (looking back), so it says the news is of the game now. */
export function Toasts({ toasts, game, now }: { toasts: Toast[]; game: GameState; now?: boolean }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.tone}`}
          style={{ '--pc': t.player !== undefined ? game.players[t.player]?.color : 'var(--accent)' } as CSSProperties}
        >
          {now && <small className="toast-now">Now</small>}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function ErrorToast({ error }: { error: { id: number; text: string } | null }) {
  const [visible, setVisible] = useState<typeof error>(null);
  useEffect(() => {
    if (!error) return;
    setVisible(error);
    const t = window.setTimeout(() => setVisible(null), 2600);
    return () => window.clearTimeout(t);
  }, [error]);
  if (!visible) return null;
  return (
    <div className="error-toast" key={visible.id}>
      {visible.text}
    </div>
  );
}
