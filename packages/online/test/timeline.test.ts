import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { actor, apply, checkInvariants, legalActions, defaultMap, type GameMode, type Action, type GameState, type PlayerConfig, type PlayerId } from '@quantum/engine';
import { chooseAction, chooseCombatResponse } from '@quantum/ai';
import { actBody, decodeEvent, encodePost, gameKeys, hex, newSecret, PROTOCOL, stateHash, Timeline, type Body, type Post, type Replay } from '../src';
import { seededRandom } from '../../engine/test/helpers';

const seat = (name: string, ai = false): PlayerConfig => ({ name, color: '#fff', ai, aiLevel: 1 });

let clock = 1_000_000;
let ids = 0;
/** A post without the crypto, for the replay tests (the codec has its own tests below). */
function post(author: string, body: Body, prev: string | null = null, at = ++clock): Post {
  return { id: `p${String(++ids).padStart(6, '0')}`, author, at, prev, body };
}

const create = (author: string, players: PlayerConfig[], open: number[], seed = 7, mode: GameMode = 'basic') =>
  post(author, { t: 'create', protocol: PROTOCOL, config: { players, mapId: defaultMap(players.length)!.id, mode, seed }, creator: 0, open });

const head = (r: Replay): GameState => r.steps.at(-1)!.state;

/**
 * One player's browser: its own timeline, the seats it plays, and an AI that picks its moves.
 * `driveAi` makes it also move the AI seats (any browser may).
 */
class Browser {
  timeline = new Timeline();
  sent: Post[] = [];
  private random: () => number;
  constructor(
    public key: string,
    public seats: PlayerId[],
    public driveAi: boolean,
    seed: number,
    private undoRate = 0,
  ) {
    this.random = seededRandom(seed);
  }

  send(body: Body, chained: boolean): Post {
    const r = this.timeline.replay();
    const p = post(this.key, body, chained ? r!.tip : null);
    this.timeline.add(p);
    this.sent.push(p);
    return p;
  }

  /** Makes this browser's next post, if it has one to make. */
  step(): Post | null {
    const r = this.timeline.replay();
    if (!r) return null;
    const s = head(r);
    if (s.phase === 'over') return null;
    const plays = (id: PlayerId) => this.seats.includes(id) || (this.driveAi && r.seats[id].ai);
    if (r.combat) {
      for (const id of r.combat.waitingOn) {
        if (!plays(id) || r.combat.passed.includes(id)) continue;
        const a = chooseCombatResponse(s, id, { level: 1, random: this.random });
        return this.send(a ? actBody(r, id, a)! : { t: 'pass', seat: id, stage: r.combat.stage }, !!a);
      }
      return null;
    }
    if (r.undoSeat !== null && this.seats.includes(r.undoSeat) && this.random() < this.undoRate) return this.send({ t: 'undo', seat: r.undoSeat }, true);
    const who = actor(s);
    if (!plays(who)) return null;
    const a = chooseAction(s, { level: 1, random: this.random, samples: 1 });
    return a ? this.send(actBody(r, who, a)!, true) : null;
  }
}

/** Plays a game between browsers over a network that delays, drops (until resent) and reorders posts. */
function playOnline(browsers: Browser[], seed: number, maxTicks = 20000) {
  const random = seededRandom(seed);
  const inFlight: { to: Browser; post: Post }[] = [];
  for (let tick = 0; tick < maxTicks; tick++) {
    for (const b of browsers) {
      const p = b.step();
      if (p) for (const o of browsers) if (o !== b) inFlight.push({ to: o, post: p });
    }
    // Deliver about half of what is in flight, in random order.
    for (let i = inFlight.length - 1; i >= 0; i--) {
      if (random() < 0.5) continue;
      const j = Math.floor(random() * (i + 1));
      const [m] = inFlight.splice(j, 1);
      m.to.timeline.add(m.post);
    }
    const done = browsers.every((b) => head(b.timeline.replay()!).phase === 'over');
    if (done && !inFlight.length) return tick;
  }
  throw new Error('game did not finish');
}

describe('online timeline', () => {
  it('two browsers and an AI play a whole game and end with the same game', { timeout: 60000 }, () => {
    const a = new Browser('alice', [0], true, 1, 0.3);
    const b = new Browser('bob', [1], false, 2, 0.3);
    a.timeline.add(create('alice', [seat('Alice'), seat('Open'), seat('Nova', true)], [1], 7, 'community'));
    for (const p of a.timeline.all()) b.timeline.add(p);
    b.send({ t: 'claim', seat: 1, name: '  Bob the very long name  ' }, false);
    a.timeline.add(b.sent[0]);
    a.send({ t: 'ask', seat: 0, ask: 'own' }, true);
    b.timeline.add(a.sent[0]);

    playOnline([a, b], 3);
    const ra = a.timeline.replay()!;
    const rb = b.timeline.replay()!;
    expect(head(rb)).toEqual(head(ra));
    expect(rb.steps.length).toBe(ra.steps.length);
    expect(ra.seats.map((s) => s.name)).toEqual(['Alice', 'Bob the very l', 'Nova']);
    expect(ra.seats[0].ask).toBe('own');
    expect(checkInvariants(head(ra))).toEqual([]);
    // Every move carried the hash of its position, and both browsers got the same ones.
    expect(ra.desync).toBeNull();
    expect(rb.desync).toBeNull();
    // A fresh browser that only receives the posts (in any order) computes the same game.
    const c = new Timeline();
    for (const p of [...a.timeline.all()].reverse()) c.add(p);
    expect(head(c.replay()!)).toEqual(head(ra));
  });

  it('two browsers both moving the AI agree on one game', { timeout: 60000 }, () => {
    const a = new Browser('alice', [0], true, 11);
    const b = new Browser('bob', [], true, 12);
    a.timeline.add(create('alice', [seat('Alice'), seat('Nova', true)], [], 3));
    for (const p of a.timeline.all()) b.timeline.add(p);
    playOnline([a, b], 5);
    expect(head(b.timeline.replay()!)).toEqual(head(a.timeline.replay()!));
    // Both browsers moved the AI at the same time somewhere; only one of each pair counts.
    expect(a.timeline.size).toBeGreaterThan(a.timeline.replay()!.steps.length);
  });

  it('only the owner of a seat may move it', () => {
    const t = new Timeline();
    const g = create('alice', [seat('Alice'), seat('Open')], [1]);
    t.add(g);
    const roll: Action = { type: 'setupKeep' };
    expect(actor(head(t.replay()!))).toBe(0);
    t.add(post('mallory', { t: 'act', seat: 0, action: roll }, g.id));
    expect(t.replay()!.steps).toHaveLength(1);
    t.add(post('alice', { t: 'act', seat: 0, action: roll }, g.id));
    expect(t.replay()!.steps).toHaveLength(2);
    // Seat 1 is open: nobody may move it until it is claimed, then only its claimant.
    const tip = t.replay()!.tip;
    t.add(post('bob', { t: 'act', seat: 1, action: roll }, tip));
    expect(t.replay()!.steps).toHaveLength(2);
    t.add(post('bob', { t: 'claim', seat: 1, name: 'Bob' }));
    expect(t.replay()!.steps).toHaveLength(3);
    expect(head(t.replay()!).players[1].name).toBe('Bob');
  });

  it('the earliest claim of a seat wins, even when it arrives last', () => {
    const t = new Timeline();
    t.add(create('alice', [seat('Alice'), seat('Open')], [1]));
    const late = post('carol', { t: 'claim', seat: 1, name: 'Carol' });
    const early = post('bob', { t: 'claim', seat: 1, name: 'Bob' }, null, late.at - 5);
    t.add(late);
    expect(t.replay()!.seats[1].owner).toBe('carol');
    t.add(early);
    expect(t.replay()!.seats[1].owner).toBe('bob');
    expect(head(t.replay()!).players[1].name).toBe('Bob');
  });

  it('of two rival moves, the earlier wins even when it arrives later', () => {
    const t = new Timeline();
    const g = create('alice', [seat('Alice'), seat('Nova', true)], []);
    t.add(g);
    const late = post('alice', { t: 'act', seat: 0, action: { type: 'setupReroll' } }, g.id);
    const early = post('alice', { t: 'act', seat: 0, action: { type: 'setupKeep' } }, g.id, late.at - 1);
    const s1 = apply(head(t.replay()!), late.body.t === 'act' ? late.body.action : { type: 'endTurn' });
    const after = post('alice', { t: 'act', seat: actor(s1), action: legalActions(s1)[0] }, late.id);
    t.add(late);
    t.add(after);
    expect(t.replay()!.tip).toBe(after.id);
    t.add(early);
    expect(t.replay()!.tip).toBe(early.id);
    expect(t.replay()!.steps.map((s) => s.post?.id)).toEqual([undefined, early.id]);
  });

  it('notices a browser that disagrees about the game', () => {
    const g = create('alice', [seat('Alice'), seat('Open')], [1]);
    const claim = post('bob', { t: 'claim', seat: 1, name: 'Bob' });
    const fresh = () => {
      const t = new Timeline();
      t.add(g);
      t.add(claim);
      return t;
    };
    const s0 = head(fresh().replay()!);
    const keep: Action = { type: 'setupKeep' };

    // Alice's browser took a move this one refuses (here: one the engine doesn't know).
    const t1 = fresh();
    t1.add(post('alice', { t: 'act', seat: 0, action: { type: 'warpDrive' } as unknown as Action }, g.id));
    expect(t1.replay()!.steps).toHaveLength(1);
    expect(t1.replay()!.desync).toEqual({ seat: 0, author: 'alice', why: 'rejected' });

    // Alice's browser got a different position from the move: it still counts, but is flagged.
    const t2 = fresh();
    t2.add(post('alice', { t: 'act', seat: 0, action: keep, h: 'deadbeef' }, g.id));
    expect(t2.replay()!.steps).toHaveLength(2);
    expect(t2.replay()!.desync?.why).toBe('differs');

    // The same move with the right hash, or none (older browsers), is fine.
    const t3 = fresh();
    t3.add(post('alice', { t: 'act', seat: 0, action: keep, h: stateHash(apply(s0, keep)) }, g.id));
    expect(t3.replay()!.desync).toBeNull();
    // A browser that hasn't got Bob's claim yet (so calls him "Open") still agrees on the position.
    const early = new Timeline();
    early.add(g);
    const h = actBody(early.replay()!, 0, keep)!;
    const t5 = fresh();
    t5.add(post('alice', h, g.id));
    expect(t5.replay()!.desync).toBeNull();
    const t4 = fresh();
    t4.add(post('mallory', { t: 'act', seat: 0, action: { type: 'warpDrive' } as unknown as Action }, g.id));
    expect(t4.replay()!.desync).toBeNull();
  });

  it('builds a move for the game as it is now, or none if it no longer fits', () => {
    const t = new Timeline();
    const g = create('alice', [seat('Alice'), seat('Bob')], [1]);
    t.add(g);
    const keep: Action = { type: 'setupKeep' };
    const body = actBody(t.replay()!, 0, keep)!;
    expect(body).toMatchObject({ t: 'act', seat: 0, action: keep, h: stateHash(apply(head(t.replay()!), keep)) });
    t.add(post('alice', body, g.id));
    // A second click on the same button, sent after the first went out: not Alice's move any more.
    expect(actBody(t.replay()!, 0, keep)).toBeNull();
    expect(actBody(t.replay()!, 1, { type: 'warpDrive' } as unknown as Action)).toBeNull();
  });

  it('rejects malformed posts and actions', () => {
    const t = new Timeline();
    const g = create('alice', [seat('Alice'), seat('Nova', true)], []);
    t.add(g);
    for (const action of [{ type: 'constructor' }, { type: 'toString' }, { type: 'move', die: 5 }, { type: 'resolveCombat' }]) {
      t.add(post('alice', { t: 'act', seat: 0, action: action as Action }, g.id));
    }
    t.add(post('alice', { t: 'ask', seat: 0, ask: 'sometimes' as never }, g.id));
    t.add({ id: 'x', author: 'alice', at: 1, prev: null, body: { t: 'act', seat: 0, action: { type: 'setupKeep' } } });
    t.add({ id: 'y', author: 'alice', at: NaN, prev: g.id, body: { t: 'act', seat: 0, action: { type: 'setupKeep' } } });
    expect(t.replay()!.steps).toHaveLength(1);
    expect(t.replay()!.tip).toBe(g.id);
  });

  it('ignores a create post for another protocol or with seats nobody can play', () => {
    const t = new Timeline();
    t.add(post('alice', { t: 'create', protocol: PROTOCOL + 1, config: { players: [seat('A'), seat('B')], mapId: defaultMap(2)!.id, mode: 'basic', seed: 1 }, creator: 0, open: [1] }));
    t.add(create('alice', [seat('A'), seat('B')], []));
    expect(t.replay()).toBeNull();
  });
});

describe('codec', () => {
  it('round-trips a post and rejects other games and tampering', () => {
    const keys = gameKeys(newSecret());
    const other = gameKeys(newSecret());
    const sk = generateSecretKey();
    const body: Body = { t: 'claim', seat: 1, name: 'Bob' };
    const { event, post: p } = encodePost(keys, sk, body, null, 1234);
    expect(p.author).toBe(getPublicKey(sk));
    expect(event.content).not.toContain('Bob');
    expect(decodeEvent(keys, event)).toEqual(p);
    expect(decodeEvent(other, event)).toBeNull();
    // As received from a relay: plain JSON (nostr-tools caches a successful check on the object).
    const wire = () => JSON.parse(JSON.stringify(event)) as typeof event;
    expect(decodeEvent(keys, { ...wire(), content: event.content.slice(0, -2) + 'AA' })).toBeNull();
    expect(decodeEvent(keys, { ...wire(), pubkey: getPublicKey(generateSecretKey()) })).toBeNull();
  });

  it('derives the same tag and key as ever (games in progress depend on it)', () => {
    const keys = gameKeys('gq_wKfjFrFzGQCE2WHmazg');
    expect(keys.tag).toBe('8dbaab9cb552779f596f192afa6f545f');
    expect(hex(keys.key)).toBe('13c0a7eff257563e07c4ef255bfdff7f0fd75ba77d3af14363f9f505dedc6823');
  });
});
