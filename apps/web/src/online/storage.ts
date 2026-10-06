import { generateSecretKey } from 'nostr-tools/pure';
import { gameKeys, hex, type NostrEvent } from '@quantum/online';

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
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && /^[0-9a-f]{64}$/.test(stored)) return Uint8Array.from(stored.match(/../g)!, (b) => parseInt(b, 16));
  } catch {
    /* storage unavailable: a new identity for this visit */
  }
  const sk = generateSecretKey();
  try {
    localStorage.setItem(KEY, hex(sk));
  } catch {
    /* ignore */
  }
  return sk;
}

export function loadEvents(tag: string): NostrEvent[] {
  try {
    const raw = localStorage.getItem(eventsKey(tag));
    return raw ? (JSON.parse(raw) as NostrEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveEvents(tag: string, events: NostrEvent[]) {
  try {
    localStorage.setItem(eventsKey(tag), JSON.stringify(events));
  } catch (e) {
    console.warn('[quantum] could not save the online game locally', e);
  }
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
  try {
    const list = JSON.parse(localStorage.getItem(GAMES) ?? '[]') as OnlineGameEntry[];
    return Array.isArray(list) ? list.sort((a, b) => b.seenAt - a.seenAt) : [];
  } catch {
    return [];
  }
}

export function rememberGame(entry: Partial<OnlineGameEntry> & { secret: string }) {
  const list = onlineGames();
  const old = list.find((g) => g.secret === entry.secret);
  const next: OnlineGameEntry = { addedAt: Date.now(), tag: gameKeys(entry.secret).tag, ...old, ...entry, seenAt: Date.now() };
  try {
    localStorage.setItem(GAMES, JSON.stringify([next, ...list.filter((g) => g.secret !== entry.secret)]));
  } catch {
    /* ignore */
  }
}

export function forgetGame(secret: string) {
  const list = onlineGames();
  const gone = list.find((g) => g.secret === secret);
  try {
    localStorage.setItem(GAMES, JSON.stringify(list.filter((g) => g.secret !== secret)));
    if (gone) localStorage.removeItem(eventsKey(gone.tag));
  } catch {
    /* ignore */
  }
}
