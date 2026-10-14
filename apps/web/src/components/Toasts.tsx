import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameState, LogEntry, PlayerId } from '@quantum/engine';
import type { Toast } from '../game/toasts';
import { CardArt } from './CardViewer';

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

/** How long a played card stays over the map; a card taken from the market, a little longer. */
const PLAYED_MS = 3200;
const TAKEN_MS = 4800;
const shownFor = (e: LogEntry) => (e.event === 'cardTaken' ? TAKEN_MS : PLAYED_MS);

/**
 * The card another player has just played, taken or used (a skill), shown large over the map for a
 * moment, one at a time.
 * `mine`: whether this screen plays for a player (their own plays aren't shown). Needs no tap to go.
 * `review`: the entries of the move being looked back at; the card among them, anyone's, is shown
 * instead, and the game's own wait until the review ends.
 */
export function PlayedCard({ game, mine, review }: { game: GameState; mine: (p: PlayerId) => boolean; review?: readonly LogEntry[] }) {
  // The last log entry already seen: only plays made while the screen is open are shown.
  const seen = useRef(game.log.at(-1)?.id ?? 0);
  const [queue, setQueue] = useState<LogEntry[]>([]);
  useEffect(() => {
    const last = game.log.at(-1)?.id ?? 0;
    // An undo takes entries back; their ids are used again.
    if (last <= seen.current) {
      seen.current = last;
      return;
    }
    const fresh = game.log.filter((e) => e.id > seen.current);
    seen.current = last;
    const played = fresh.filter((e) => e.card && e.player !== undefined && !mine(e.player));
    if (played.length) setQueue((q) => [...q, ...played]);
  }, [game, mine]);

  const reviewed = review?.find((e) => e.card && e.player !== undefined);
  const shown = review ? reviewed : queue[0];
  useEffect(() => {
    if (!shown || review) return;
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), shownFor(shown));
    return () => window.clearTimeout(t);
  }, [shown, review]);
  if (!shown) return null;
  const player = game.players[shown.player!];
  const style = { '--pc': player.color, '--pc-ms': `${shownFor(shown)}ms` } as CSSProperties;
  return (
    <div className="played-card" key={`${review ? 'r' : 'l'}${shown.id}`} style={style} aria-hidden>
      <small>
        {player.name} {shown.event === 'cardPlayed' ? 'plays' : shown.event === 'cardTaken' ? 'takes' : 'uses'}
      </small>
      <CardArt id={shown.card!} size="md" />
    </div>
  );
}
