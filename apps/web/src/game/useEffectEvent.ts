import { useCallback, useRef } from 'react';

/**
 * React 19's useEffectEvent, for React 18: a function that never changes but always runs the latest
 * `fn`, so an effect can read the current props without rerunning when they change.
 */
export function useEffectEvent<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback((...args: A) => latest.current(...args), []);
}
