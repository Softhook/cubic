import { checkInvariants, type GameState } from '@quantum/engine';
import { forget, remember, stored } from '../storage';

/** The unfinished game, kept in localStorage so a revisit can resume it. */
const KEY = 'quantum.savedGame';

export function saveGame(state: GameState) {
  if (state.phase === 'over') forget(KEY);
  else remember(KEY, JSON.stringify(state));
}

export function clearSavedGame() {
  forget(KEY);
}

/** The saved game, or null if there is none or it no longer fits this version of the engine. */
export function loadSavedGame(): GameState | null {
  const raw = stored(KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as GameState;
    if (state?.version !== 1 || state.phase === 'over' || checkInvariants(state).length) throw new Error('stale save');
    return state;
  } catch {
    clearSavedGame();
    return null;
  }
}

/**
 * Per tab: a game on this device is on screen. A reload then brings it back instead of the lobby: a new
 * version taking over in the background (src/pwa.ts), pull to refresh, or the browser reloading the tab.
 */
const ON_SCREEN = 'quantum.gameOnScreen';

export function markGameOnScreen(on: boolean) {
  try {
    if (on) sessionStorage.setItem(ON_SCREEN, '1');
    else sessionStorage.removeItem(ON_SCREEN);
  } catch {
    // no session storage: a reload shows the lobby, with the game to resume
  }
}

/** The saved game, if it was on screen when this tab last reloaded. */
export function gameOnScreenBeforeReload(): GameState | null {
  try {
    return sessionStorage.getItem(ON_SCREEN) ? loadSavedGame() : null;
  } catch {
    return null;
  }
}
