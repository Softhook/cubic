/**
 * Which app this is, for what it keeps in the browser: every localStorage key and the IndexedDB name start
 * with APP_ID. Apps served from one origin (softhook.github.io/cubic and /regolith) share their storage, so
 * each needs its own; a fork changes it here and nowhere else (docs/regolith/SPLIT.md).
 */
export const APP_ID = 'quantum';

/** A localStorage key in this app's namespace: `appKey('mode')` is `quantum.mode`. */
export const appKey = (name: string) => `${APP_ID}.${name}`;
