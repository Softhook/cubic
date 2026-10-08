import { forget, onStorageFull, remember, storedJson } from '../storage';

/**
 * The lobby's list of this browser's online games, in localStorage. Apart from the rest of the online
 * code (storage.ts), so the lobby loads without it.
 */
const GAMES = 'quantum.online.games';
export const eventsKey = (tag: string) => `quantum.online.events.${tag}`;

/** A game in the lobby's list, with how it stood when this browser last saw it. */
export interface OnlineGameEntry {
  secret: string;
  tag: string;
  addedAt: number;
  seenAt: number;
  mode?: string;
  map?: string;
  players?: string[];
  status?: string;
  myTurn?: boolean;
  over?: boolean;
}

export function onlineGames(): OnlineGameEntry[] {
  const list = storedJson<OnlineGameEntry[]>(GAMES);
  return Array.isArray(list) ? list.sort((a, b) => b.seenAt - a.seenAt) : [];
}

export function saveOnlineGames(games: OnlineGameEntry[]): boolean {
  return remember(GAMES, JSON.stringify(games));
}

/** Whether the game is off the list (it may not be, when storage can't be written). */
export function forgetGame(secret: string): boolean {
  const list = onlineGames();
  const gone = list.find((g) => g.secret === secret);
  // Events first: removing them frees the room to rewrite the list when storage is full.
  if (gone) forget(eventsKey(gone.tag));
  return saveOnlineGames(list.filter((g) => g.secret !== secret));
}

/** Takes finished games off the list (and their events out of storage); returns what's left. */
export function forgetFinishedGames(): OnlineGameEntry[] {
  for (const g of onlineGames()) if (g.over) forgetGame(g.secret);
  return onlineGames();
}

// Storage full (the game on this device can't be saved, say): finished games go first, the least
// recently seen first. Games still being played stay; they are what holds this browser's moves.
onStorageFull(() => {
  const oldest = onlineGames()
    .filter((g) => g.over)
    .at(-1);
  // Only a list that got shorter counts, so trying again always ends.
  return !!oldest && forgetGame(oldest.secret);
});
