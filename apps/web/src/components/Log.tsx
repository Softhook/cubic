import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameState } from '@quantum/engine';
import { logText } from '../game/logText';
import { remember, stored } from '../storage';

const STORAGE_KEY = 'quantum.logOpen';

/** The game's log. Collapsed (the default, remembered) it is one row with the latest entry; the whole row toggles it. */
export function Log({ game }: { game: GameState }) {
  const ref = useRef<HTMLOListElement>(null);
  const [open, setOpen] = useState(() => stored(STORAGE_KEY) === '1');
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [game.log.length, game.logCounter, open]);
  const toggle = () => {
    setOpen(!open);
    remember(STORAGE_KEY, open ? '0' : '1');
  };
  const colour = (player?: number) => ({ '--pc': player !== undefined ? game.players[player].color : 'var(--muted)' }) as CSSProperties;
  const latest = game.log.at(-1);
  return (
    <section className={`panel log ${open ? '' : 'collapsed'}`}>
      <button type="button" className="log-toggle" aria-expanded={open} onClick={toggle}>
        <span className="log-title">Captain’s log</span>
        {!open && latest && (
          <span key={latest.id} className="log-latest" style={colour(latest.player)}>
            {logText(game, latest)}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ol ref={ref}>
          {game.log.slice(-40).map((e) => (
            <li key={e.id} style={colour(e.player)}>
              {logText(game, e)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
