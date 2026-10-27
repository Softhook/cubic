/**
 * Which app this is, for what it keeps in the browser: every localStorage key and the IndexedDB name start
 * with APP_ID. Apps served from one origin (softhook.github.io/cubic and /regolith) share their storage, so
 * each needs its own; a fork changes it here and nowhere else.
 */
export const APP_ID = 'cubic';

/**
 * The game's name, where the app names itself to players: the lobby's title, the share sheet, and every file
 * it saves (`cubic-manual.html`, `cubic-tiles.zip`). A fork changes it here.
 */
export const GAME_NAME = 'Cubic';

/** A saved file's name: `gameFile('manual.html')` is `cubic-manual.html`. */
export const gameFile = (rest: string) => `${GAME_NAME.toLowerCase()}-${rest}`;

/** A localStorage key in this app's namespace: `appKey('mode')` is `cubic.mode`. */
export const appKey = (name: string) => `${APP_ID}.${name}`;
