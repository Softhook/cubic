import { generateSecretKey } from 'nostr-tools/pure';
import { gameKeys, hex, type NostrEvent } from '@quantum/online';
import { forget, remember, stored, storedJson } from '../storage';
import { eventsKey, onlineGames, saveOnlineGames, type OnlineGameEntry } from './games';

/**
 * What a browser keeps of its online games, in localStorage: its identity, every game's events
 * (the whole game, so it can be replayed and re-sent to relays that lost it) and the list of games
 * for the lobby (games.ts).
 */
const KEY = 'quantum.online.key';

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
  saveOnlineGames(games.filter((g) => !stale.includes(g)));
}
