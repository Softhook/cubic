import { useSyncExternalStore } from 'react';
import { remember, stored } from '../storage';

/*
 * How hex maps look: on the moon (the Regolith tiles, ground with a building on each planet's space) or
 * in space, as the original tiles. Kept on this device; the top bar switches it (MoonButton).
 */

let moon = stored('quantum.moon') !== 'off';
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setMoonMaps(on: boolean) {
  moon = on;
  remember('quantum.moon', on ? 'on' : 'off');
  listeners.forEach((l) => l());
}

/** Whether hex maps are drawn on the moon. */
export const useMoonMaps = () => useSyncExternalStore(subscribe, () => moon);
