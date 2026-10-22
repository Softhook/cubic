import { useSyncExternalStore } from 'react';
import { remember, stored } from '../storage';

/*
 * How hex maps look: on their world's ground, the moon's or Mars's (the Regolith tiles, with a building on
 * each planet's space), or in space, as the original tiles. Kept on this device; the top bar switches it
 * (WorldButton).
 */

let onGround = stored('quantum.ground') !== 'off';
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setGroundMaps(on: boolean) {
  onGround = on;
  remember('quantum.ground', on ? 'on' : 'off');
  listeners.forEach((l) => l());
}

/** Whether hex maps are drawn on their world's ground. */
export const useGroundMaps = () => useSyncExternalStore(subscribe, () => onGround);
