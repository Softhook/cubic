import { generateSecretKey } from 'nostr-tools/pure';
import { gameKeys, hex, type NostrEvent } from '@quantum/online';
import { forget, remember, stored, storedJson } from '../storage';

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

export function rememberGame(entry: Partial<OnlineGameEntry> & { secret: string }) {
  const list = onlineGames();
  const old = list.find((g) => g.secret === entry.secret);
  const next: OnlineGameEntry = { addedAt: Date.now(), tag: gameKeys(entry.secret).tag, ...old, ...entry, seenAt: Date.now() };
  remember(GAMES, JSON.stringify([next, ...list.filter((g) => g.secret !== entry.secret)]));
}

export function forgetGame(secret: string) {
  const list = onlineGames();
  const gone = list.find((g) => g.secret === secret);
  remember(GAMES, JSON.stringify(list.filter((g) => g.secret !== secret)));
  if (gone) forget(eventsKey(gone.tag));
}
