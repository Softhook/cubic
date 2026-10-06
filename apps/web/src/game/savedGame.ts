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
