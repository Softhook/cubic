import { generateSecretKey } from 'nostr-tools/pure';
import { gameKeys, hex, type NostrEvent } from '@quantum/online';
import { forget, onStorageFull, remember, stored, storedJson } from '../storage';

/**
 * What a browser keeps of its online games, in localStorage: its identity, every game's events
 * (the whole game, so it can be replayed and re-sent to relays that lost it) and the list of games
 * for the lobby.
 */
const KEY = 'quantum.online.key';
const GAMES = 'quantum.online.games';
const eventsKey = (tag: string) => `quantum.online.events.${tag}`;

/** This browser's Nostr secret key: it signs its posts and so identifies its seats. */
export function identity(): Uint8Array {
  const kept = stored(KEY);
  if (kept && /^[0-9a-f]{64}$/.test(kept)) return Uint8Array.from(kept.match(/../g)!, (b) => parseInt(b, 16));
  // None yet, or storage unavailable: then this identity lasts only for this visit.
  const sk = generateSecretKey();
  remember(KEY, hex(sk));
  return sk;
}

/**
 * Asks the browser not to clear this site's storage when space runs low: it holds this browser's
 * identity, and with it its seats. (Safari may still clear it after weeks without a visit.)
 */
export function keepStorage() {
  void navigator.storage?.persist?.().catch(() => {});
}

export function loadEvents(tag: string): NostrEvent[] {
  return storedJson<NostrEvent[]>(eventsKey(tag)) ?? [];
}

export function saveEvents(tag: string, events: NostrEvent[]) {
  if (!remember(eventsKey(tag), JSON.stringify(events))) console.warn('[quantum] could not save the online game locally');
}

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

/** Finished games kept in this browser (the most recently seen); older ones are let go. */
const KEEP_FINISHED = 5;

export function rememberGame(entry: Partial<OnlineGameEntry> & { secret: string }) {
  const list = onlineGames();
  const old = list.find((g) => g.secret === entry.secret);
  const next: OnlineGameEntry = { addedAt: Date.now(), tag: gameKeys(entry.secret).tag, ...old, ...entry, seenAt: Date.now() };
  const games = [next, ...list.filter((g) => g.secret !== entry.secret)];
  // Each game's events take room in storage it shares with the game on this device.
  const stale = games.filter((g) => g.over).slice(KEEP_FINISHED);
  for (const g of stale) forget(eventsKey(g.tag));
  remember(GAMES, JSON.stringify(games.filter((g) => !stale.includes(g))));
}

/** Whether the game is off the list (it may not be, when storage can't be written). */
export function forgetGame(secret: string): boolean {
  const list = onlineGames();
  const gone = list.find((g) => g.secret === secret);
  // Events first: removing them frees the room to rewrite the list when storage is full.
  if (gone) forget(eventsKey(gone.tag));
  return remember(GAMES, JSON.stringify(list.filter((g) => g.secret !== secret)));
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
