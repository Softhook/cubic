import { useEffect, useRef } from 'react';

/**
 * A global keyboard shortcut: calls `run` for keys `matches` accepts, unless the user is typing or a
 * dialog is open over the board.
 */
export function useShortcut(matches: (e: KeyboardEvent) => boolean, run: (e: KeyboardEvent) => void) {
  const latest = useRef({ matches, run });
  latest.current = { matches, run };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!latest.current.matches(e)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      latest.current.run(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
