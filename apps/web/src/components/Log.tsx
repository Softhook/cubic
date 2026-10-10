import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameState } from '@quantum/engine';
import { logText } from '../game/logText';
import { remember, stored } from '../storage';

const STORAGE_KEY = 'quantum.logOpen';
const AUTO_SCROLL_THRESHOLD = 12;

export function shouldAutoScroll(scrollTop: number, clientHeight: number, scrollHeight: number, threshold = AUTO_SCROLL_THRESHOLD) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

/** The game's log. Collapsed (the default, remembered) it is just its title; the whole row toggles it. */
export function Log({ game }: { game: GameState }) {
  const ref = useRef<HTMLOListElement>(null);
  const [open, setOpen] = useState(() => stored(STORAGE_KEY) === '1');
  useEffect(() => {
    const list = ref.current;
    if (!open || !list) return;
    if (!shouldAutoScroll(list.scrollTop, list.clientHeight, list.scrollHeight)) return;
    requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    });
  }, [game.log.length, game.logCounter, open]);
  const toggle = () => {
    setOpen(!open);
    remember(STORAGE_KEY, open ? '0' : '1');
  };
  const colour = (player?: number) => ({ '--pc': player !== undefined ? game.players[player].color : 'var(--muted)' }) as CSSProperties;
  return (
    <section className={`panel log ${open ? '' : 'collapsed'}`}>
      <button type="button" className="log-toggle" aria-expanded={open} onClick={toggle}>
        <span className="log-title">Captain’s log</span>
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
