/** Online games share storage with the game on this device; finished ones make way for it. */
import { beforeEach, describe, expect, it } from 'vitest';
import { forget, remember, stored } from '../src/storage';
import { forgetFinishedGames, onlineGames } from '../src/online/games';
import { rememberGame, saveEvents } from '../src/online/storage';

/** localStorage holding at most `quota` characters (keys and values), like a browser's. */
class FakeStorage {
  data = new Map<string, string>();
  constructor(public quota: number) {}
  private used(except?: string) {
    let n = 0;
    for (const [k, v] of this.data) if (k !== except) n += k.length + v.length;
    return n;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.used(k) + k.length + v.length > this.quota) throw new Error('QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

let store: FakeStorage;
const setQuota = (quota: number) => {
  store = new FakeStorage(quota);
  (globalThis as { localStorage?: unknown }).localStorage = store;
};

/** A secret per game, valid in form; the games' events are `size` characters each. */
const secret = (i: number) => `game${i}`.padEnd(22, 'x');
function addGame(i: number, over: boolean, size = 1000) {
  rememberGame({ secret: secret(i), over });
  const tag = onlineGames().find((g) => g.secret === secret(i))!.tag;
  saveEvents(tag, [{ content: 'e'.repeat(size) } as never]);
}

describe('online games in storage', () => {
  beforeEach(() => setQuota(1_000_000));

  it(`keeps only the most recently seen finished games`, () => {
    for (let i = 0; i < 8; i++) addGame(i, true);
    addGame(8, false);
    const games = onlineGames();
    expect(games.filter((g) => g.over).map((g) => g.secret)).toEqual([7, 6, 5, 4, 3].map(secret));
    expect(games.some((g) => g.secret === secret(8))).toBe(true);
    // The dropped games' events are gone too.
    expect([...store.data.keys()].filter((k) => k.startsWith('quantum.online.events.')).length).toBe(6);
  });

  it('frees room for the saved game by dropping finished games, oldest first', () => {
    addGame(0, true);
    addGame(1, false);
    addGame(2, true);
    // Room for the save once one game's events are gone, not before.
    store.quota = [...store.data].reduce((n, [k, v]) => n + k.length + v.length, 0) + 800;
    expect(remember('quantum.savedGame', 's'.repeat(1400))).toBe(true);
    const left = onlineGames().map((g) => g.secret);
    expect(left).toContain(secret(1));
    expect(left).toContain(secret(2));
    expect(left).not.toContain(secret(0));
  });

  it('never drops a game in progress, and gives up when nothing more can go', () => {
    addGame(0, false);
    addGame(1, true);
    expect(remember('quantum.savedGame', 's'.repeat(2_000_000))).toBe(false);
    expect(onlineGames().map((g) => g.secret)).toEqual([secret(0)]);
    expect(stored('quantum.savedGame')).toBeNull();
  });

  it('lets the lobby forget every finished game and its events', () => {
    addGame(0, true);
    addGame(1, false);
    addGame(2, true);
    expect(forgetFinishedGames().map((g) => g.secret)).toEqual([secret(1)]);
    expect(onlineGames().map((g) => g.secret)).toEqual([secret(1)]);
    expect([...store.data.keys()].filter((k) => k.startsWith('quantum.online.events.')).length).toBe(1);
  });

  it('ends when storage refuses every write', () => {
    addGame(0, true);
    store.setItem = () => {
      throw new Error('SecurityError');
    };
    expect(remember('quantum.mode', 'basic')).toBe(false);
    forget('quantum.mode');
  });
});
