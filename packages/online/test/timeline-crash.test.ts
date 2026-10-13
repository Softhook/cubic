/**
 * An engine bug met while replaying a post (anything but a RuleError) is not the poster's mistake:
 * the timeline reports it as `crashed`, not `rejected`, and logs it. A file of its own, because it
 * swaps in an engine that fails on a marked move.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actor, defaultMap, type Action, type PlayerConfig } from '@quantum/engine';
import { PROTOCOL, Timeline, type Body, type Post } from '../src';

// The real engine, except that it fails (as a bug would) on an action marked `crash`.
vi.mock('@quantum/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@quantum/engine')>();
  return {
    ...real,
    apply: (s: Parameters<typeof real.apply>[0], a: Action) => {
      if ((a as { crash?: boolean }).crash) throw new TypeError('engine bug');
      return real.apply(s, a);
    },
  };
});

let clock = 1_000_000;
let ids = 0;
const post = (author: string, body: Body, prev: string | null = null): Post => ({ id: `p${++ids}`, author, at: ++clock, prev, body });
const seat = (name: string, ai = false): PlayerConfig => ({ name, color: '#fff', ai, aiLevel: 1 });

function game(players: PlayerConfig[]) {
  const t = new Timeline();
  const g = post('alice', { t: 'create', protocol: PROTOCOL, config: { players, mapId: defaultMap(players.length)!.id, mode: 'basic', seed: 7 }, creator: 0, open: [] });
  t.add(g);
  return { t, g };
}

describe('a move the engine crashes on', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is reported as crashed, not as the poster’s mistake, and logged', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { t, g } = game([seat('Alice'), seat('Bot', true)]);
    t.add(post('alice', { t: 'act', seat: 0, action: { type: 'setupKeep', crash: true } as Action }, g.id));
    expect(t.replay()!.steps).toHaveLength(1);
    expect(t.replay()!.desync).toEqual({ seat: 0, author: 'alice', why: 'crashed' });
    expect(errors).toHaveBeenCalledWith('[quantum] the engine failed on a move', expect.objectContaining({ error: expect.any(TypeError) }));
  });

  it('is reported for an AI seat too, where a refused move is not', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    /** Alice keeps her fleet; then it is the AI seat's turn to choose, and Alice's browser moves it. */
    const aiToMove = () => {
      const { t, g } = game([seat('Alice'), seat('Bot', true)]);
      const keep = post('alice', { t: 'act', seat: 0, action: { type: 'setupKeep' } }, g.id);
      t.add(keep);
      expect(actor(t.replay()!.steps.at(-1)!.state)).toBe(1);
      return { t, after: keep.id };
    };
    const refused = aiToMove();
    refused.t.add(post('alice', { t: 'act', seat: 1, action: { type: 'warpDrive' } as unknown as Action }, refused.after));
    expect(refused.t.replay()!.desync).toBeNull();

    const crashed = aiToMove();
    crashed.t.add(post('alice', { t: 'act', seat: 1, action: { type: 'setupKeep', crash: true } as Action }, crashed.after));
    expect(crashed.t.replay()!.desync).toEqual({ seat: 1, author: 'alice', why: 'crashed' });
  });
});
