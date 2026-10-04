import { useEffect, useState, type CSSProperties } from 'react';
import type { GameState } from '@quantum/engine';
import type { Toast } from '../game/toasts';

export function Toasts({ toasts, game }: { toasts: Toast[]; game: GameState }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} style={{ '--pc': t.player !== undefined ? game.players[t.player]?.color : 'var(--accent)' } as CSSProperties}>
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
  return <div className="error-toast" key={visible.id}>{visible.text}</div>;
}
