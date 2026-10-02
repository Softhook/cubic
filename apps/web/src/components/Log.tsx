import { useEffect, useRef, type CSSProperties } from 'react';
import type { GameState } from '@quantum/engine';

export function Log({ game }: { game: GameState }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [game.log.length, game.logCounter]);
  return (
    <section className="panel log">
      <h3>Captain’s log</h3>
      <ol ref={ref}>
        {game.log.slice(-40).map((e) => (
          <li key={e.id} style={{ '--pc': e.player !== undefined ? game.players[e.player].color : 'var(--muted)' } as CSSProperties}>
            {e.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
