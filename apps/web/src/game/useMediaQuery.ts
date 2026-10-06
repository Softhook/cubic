import { useSyncExternalStore } from 'react';

/** Whether a CSS media query matches now; re-renders when it changes (e.g. the phone is turned). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
  );
}
