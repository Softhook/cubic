import { useSyncExternalStore } from 'react';

type Store = { subscribe: (onChange: () => void) => () => void; get: () => boolean };
const stores = new Map<string, Store>();

/** One MediaQueryList per query, so the subscription stays put across renders. */
function store(query: string): Store {
  let s = stores.get(query);
  if (!s) {
    const mq = matchMedia(query);
    s = {
      subscribe: (onChange) => {
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
      },
      get: () => mq.matches,
    };
    stores.set(query, s);
  }
  return s;
}

/** Whether a CSS media query matches now; re-renders when it changes (e.g. the phone is turned). */
export function useMediaQuery(query: string): boolean {
  const s = store(query);
  return useSyncExternalStore(s.subscribe, s.get);
}

/** Phone-sized screens, portrait or landscape; the same query styles.css uses to shrink popups. */
export const PHONE = '(max-width: 600px), (max-height: 500px)';

/** Short screens (phones on their side): the popups' dice shrink, as in styles.css. */
export const SHORT = '(max-height: 500px)';

/** A finger, not a mouse: phones and tablets. */
export const COARSE = '(pointer: coarse)';

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Phones held upright: the map above a bottom sheet (GameScreen, which marks it `.sheet-layout` for styles.css). */
export const SHEET = '(max-width: 699px) and (orientation: portrait)';
