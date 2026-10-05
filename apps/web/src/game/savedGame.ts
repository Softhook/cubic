import { checkInvariants, type GameState } from '@quantum/engine';

/** The unfinished game, kept in localStorage so a revisit can resume it. */
const KEY = 'quantum.savedGame';

export function saveGame(state: GameState) {
  try {
    if (state.phase === 'over') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable or full */
  }
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The saved game, or null if there is none or it no longer fits this version of the engine. */
export function loadSavedGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as GameState;
    if (state?.version !== 1 || state.phase === 'over' || checkInvariants(state).length) throw new Error('stale save');
    return state;
  } catch {
    clearSavedGame();
    return null;
  }
}
