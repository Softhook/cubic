import { apply, canRespondToCombat, createGame, isUndoable, mayAct, type Action, type CombatPending, type GameState, type PlayerId } from '@quantum/engine';
import { byTime, CHAINED, combatStage, PROTOCOL, stateHash, type AskMode, type Body, type GameConfig, type Post } from './protocol';

export interface Seat {
  id: PlayerId;
  name: string;
  ai: boolean;
  /** Public key of the browser playing this seat; undefined for AI and unclaimed seats. */
  owner?: string;
  /** A seat for a friend to claim. */
  open: boolean;
  ask: AskMode;
}

export interface Step {
  state: GameState;
  /** The post that led here; null for the starting position and for battles resolving by themselves. */
  post: Post | null;
}

export interface CombatWait {
  stage: string;
  /** Seats whose answer the battle waits for. */
  waitingOn: PlayerId[];
  passed: PlayerId[];
}

/**
 * This browser disagrees with another about the game: a move its player made was refused here
 * (`rejected`), or led to a different position here (`differs`). Every browser runs the same
 * posts through the same engine, so this means different app versions (or a bug, or tampering).
 */
export interface Desync {
  seat: PlayerId;
  author: string;
  why: 'rejected' | 'differs';
}

/** Everything a browser derives from the posts it has. */
export interface Replay {
  genesis: Post;
  config: GameConfig;
  seats: Seat[];
  /** Every position of the game, in order; the last is the current one. */
  steps: Step[];
  /** The post a new chained post must follow. */
  tip: string;
  /** When the tip was posted, and by whom (that browser moves the AI players next). */
  tipAt: number;
  tipAuthor: string;
  /** The seat that may take back its last move now, if any. */
  undoSeat: PlayerId | null;
  combat: CombatWait | null;
  /** The first disagreement with another browser, if any. */
  desync: Desync | null;
}

/**
 * Which of two rival chained posts comes next: the earlier, except that an `ask` (a setting anyone
 * may change at any time) never displaces a move made at the same moment.
 */
function byRank(a: Post, b: Post): number {
  return +(a.body.t === 'ask') - +(b.body.t === 'ask') || byTime(a, b);
}

const MAX_NAME = 14;
const cleanName = (s: unknown, fallback: string) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, MAX_NAME) : fallback);

/**
 * The posts of one game, and the game they add up to. Every browser that holds the same posts
 * computes the same game, whatever order they arrived in:
 *
 * - the chain starts at the earliest valid `create`; at each post, the earliest valid post that
 *   follows it comes next (rival posts made at the same moment lose to the earlier one; an `ask`
 *   loses to any other post);
 * - a post counts only if its author plays the seat (anyone may move an AI seat) and the
 *   engine accepts the move (`mayAct`, `apply`);
 * - a battle resolves by itself once every seat it waits for has passed (`waitingOn`).
 *
 * `add` is cheap when a post extends the game; a post that changes the past (a claim, or a rival
 * post that wins) replays the game from the start.
 */
export class Timeline {
  private posts = new Map<string, Post>();
  private children = new Map<string, Post[]>();
  /** Passes by stage, then seat. */
  private passes = new Map<string, Map<PlayerId, Post>>();
  private creates: Post[] = [];
  private claims: Post[] = [];
  private r: Replay | null = null;
  /** The chained posts in the current game, in order, and each one's index in `chain`. */
  private chain: Post[] = [];
  private inChain = new Map<string, number>();
  /** States before each undoable move, newest last, and whose move it was. */
  private undoStack: { state: GameState; seat: PlayerId }[] = [];
  private dirty = true;

  get size(): number {
    return this.posts.size;
  }

  all(): Post[] {
    return [...this.posts.values()];
  }

  /** Adds a post; false if it was already known. */
  add(post: Post): boolean {
    if (this.posts.has(post.id) || !wellFormed(post)) return false;
    this.posts.set(post.id, post);
    const b = post.body;
    if (b.t === 'create') {
      this.creates.push(post);
      this.dirty = true;
    } else if (b.t === 'claim') {
      this.claims.push(post);
      // A claim changes the past only if it wins a seat.
      if (this.r && this.owners().get(b.seat) !== this.r.seats[b.seat]?.owner) this.dirty = true;
    } else if (b.t === 'pass') {
      let m = this.passes.get(b.stage);
      if (!m) this.passes.set(b.stage, (m = new Map()));
      const old = m.get(b.seat);
      if (!old || byTime(post, old) < 0) m.set(b.seat, post);
      if (this.r && !this.dirty && this.r.combat?.stage === b.stage) this.extend();
    } else {
      const sibs = this.children.get(post.prev!) ?? [];
      sibs.push(post);
      sibs.sort(byRank);
      this.children.set(post.prev!, sibs);
      if (this.r && !this.dirty) {
        if (post.prev === this.r.tip) this.extend();
        else {
          // Following a post already in the game: it replaces what came next only if it is earlier.
          const at = post.prev === this.r.genesis.id ? -1 : this.inChain.get(post.prev!);
          if (at !== undefined) {
            const next = this.chain[at + 1];
            if (next && byRank(post, next) < 0) this.dirty = true;
          }
        }
      }
    }
    return true;
  }

  /** The game so far, or null until a valid `create` post is known. */
  replay(): Replay | null {
    if (this.dirty) this.rebuild();
    return this.r;
  }

  /** Who owns each open seat: the author of its earliest claim. */
  private owners(): Map<PlayerId, string> {
    const out = new Map<PlayerId, string>();
    const g = this.r?.genesis ?? [...this.creates].sort(byTime)[0];
    if (!g || g.body.t !== 'create') return out;
    out.set(g.body.creator, g.author);
    const open = new Set(g.body.open);
    for (const c of [...this.claims].sort(byTime)) {
      const b = c.body as Extract<Body, { t: 'claim' }>;
      if (open.has(b.seat) && !out.has(b.seat)) out.set(b.seat, c.author);
    }
    return out;
  }

  private rebuild() {
    this.dirty = false;
    this.r = null;
    this.chain = [];
    this.inChain.clear();
    this.undoStack = [];
    for (const g of [...this.creates].sort(byTime)) {
      const r = start(g);
      if (!r) continue;
      this.r = r;
      break;
    }
    if (!this.r) return;
    const owners = this.owners();
    const names = new Map<PlayerId, string>();
    for (const c of [...this.claims].sort(byTime)) {
      const b = c.body as Extract<Body, { t: 'claim' }>;
      if (owners.get(b.seat) === c.author && !names.has(b.seat)) names.set(b.seat, cleanName(b.name, this.r.seats[b.seat].name));
    }
    for (const s of this.r.seats) {
      s.owner = owners.get(s.id);
      s.name = names.get(s.id) ?? s.name;
    }
    const first = this.r.steps[0].state;
    for (const s of this.r.seats) first.players[s.id].name = s.name;
    this.extend();
  }

  /** Follows the chain from the tip as far as the posts allow. */
  private extend() {
    const r = this.r!;
    for (;;) {
      const state = r.steps.at(-1)!.state;
      const combat = state.pending[0]?.kind === 'combat' ? (state.pending[0] as CombatPending) : null;
      r.combat = combat ? this.combatWait(state, combat) : null;
      if (combat && r.combat!.waitingOn.every((s) => r.combat!.passed.includes(s))) {
        r.steps.push({ state: apply(state, { type: 'resolveCombat' }), post: null });
        this.undoStack = [];
        continue;
      }
      const next = (this.children.get(r.tip) ?? []).find((p) => this.follow(p));
      if (!next) break;
    }
    const top = this.undoStack.at(-1);
    r.undoSeat = top ? top.seat : null;
  }

  /** Applies a chained post at the tip if it is valid; false (and nothing changes) otherwise. */
  private follow(p: Post): boolean {
    const r = this.r!;
    const b = p.body as Extract<Body, { t: 'act' | 'undo' | 'ask' }>;
    const seat = r.seats[b.seat];
    if (!seat || !(seat.ai ? b.t === 'act' : seat.owner === p.author)) return false;
    const prev = r.steps.at(-1)!.state;
    let next: GameState | null = null;
    if (b.t === 'act') {
      // Having passed this stage of a battle, a seat has nothing more to say in it.
      if (r.combat && r.combat.passed.includes(b.seat)) return false;
      // The poster's browser checked the move against this same position before sending it, so
      // the engine refusing it here means the two browsers don't agree on the rules.
      const refused = () => {
        if (!seat.ai) r.desync ??= { seat: b.seat, author: p.author, why: 'rejected' };
        return false;
      };
      if (prev.phase === 'over' || !mayAct(prev, b.seat, b.action)) return refused();
      try {
        next = apply(prev, b.action);
      } catch {
        return refused();
      }
      if (b.h !== undefined) {
        if (b.h !== stateHash(next)) r.desync ??= { seat: b.seat, author: p.author, why: 'differs' };
        // A later move on which that browser agrees: it has caught up (reloaded a newer version).
        else if (r.desync?.author === p.author) r.desync = null;
      }
      this.undoStack = !seat.ai && isUndoable(prev, b.action, next) ? [...this.undoStack, { state: prev, seat: b.seat }] : [];
    } else if (b.t === 'undo') {
      const top = this.undoStack.at(-1);
      if (top?.seat !== b.seat) return false;
      this.undoStack = this.undoStack.slice(0, -1);
      next = top.state;
    } else {
      seat.ask = b.ask;
    }
    if (next) r.steps.push({ state: next, post: p });
    this.inChain.set(p.id, this.chain.length);
    this.chain.push(p);
    r.tip = p.id;
    r.tipAt = p.at;
    r.tipAuthor = p.author;
    return true;
  }

  private combatWait(state: GameState, combat: CombatPending): CombatWait {
    const stage = combatStage(combat);
    const given = this.passes.get(stage);
    const seats = this.r!.seats;
    const passed = seats.filter((s) => {
      const p = given?.get(s.id);
      return p && (s.ai || s.owner === p.author);
    });
    const waitingOn = seats.filter((s) => {
      if (!canRespondToCombat(state, combat, s.id)) return false;
      if (s.ai || !s.owner) return true;
      const fighting = s.id === combat.attacker.player || s.id === combat.defender.player;
      return s.ask === 'always' || (s.ask === 'own' && fighting);
    });
    return { stage, waitingOn: waitingOn.map((s) => s.id), passed: passed.map((s) => s.id) };
  }
}

/**
 * The `act` post that makes `seat` play `action` in the game as it stands, or null if the game
 * wouldn't take it (checked here so a stale click never goes out as a post every browser drops).
 */
export function actBody(r: Replay, seat: PlayerId, action: Action): Body | null {
  const s = r.steps.at(-1)!.state;
  if (s.phase === 'over' || !mayAct(s, seat, action) || r.combat?.passed.includes(seat)) return null;
  try {
    return { t: 'act', seat, action, h: stateHash(apply(s, action)) };
  } catch {
    return null;
  }
}

function start(g: Post): Replay | null {
  const b = g.body;
  if (b.t !== 'create' || b.protocol !== PROTOCOL) return null;
  const n = b.config?.players?.length;
  const seatOk = (s: unknown) => Number.isInteger(s) && (s as number) >= 0 && (s as number) < n;
  if (!seatOk(b.creator) || !Array.isArray(b.open) || !b.open.every(seatOk) || b.open.includes(b.creator)) return null;
  let state: GameState;
  try {
    state = createGame({ players: b.config.players, mapId: b.config.mapId, mode: b.config.mode, seed: b.config.seed });
  } catch {
    return null;
  }
  const seats: Seat[] = state.players.map((p) => ({
    id: p.id,
    name: cleanName(p.name, `Player ${p.id + 1}`),
    ai: p.ai,
    open: b.open.includes(p.id),
    ask: 'always',
  }));
  // A human seat is either the creator's or open; anything else would be a seat nobody can play.
  if (seats.some((s) => !s.ai && !s.open && s.id !== b.creator) || seats[b.creator].ai) return null;
  return { genesis: g, config: b.config, seats, steps: [{ state, post: null }], tip: g.id, tipAt: g.at, tipAuthor: g.author, undoSeat: null, combat: null, desync: null };
}

const ASK: ReadonlySet<unknown> = new Set<AskMode>(['always', 'own', 'never']);

/** Rejects posts that don't have the shape of their type (they come from other browsers). */
function wellFormed(p: Post): boolean {
  const b = p.body as Body | undefined;
  // A time that isn't a number would make the order of rival posts differ between browsers.
  if (typeof p.id !== 'string' || typeof p.author !== 'string' || !Number.isFinite(p.at) || !b || typeof b !== 'object') return false;
  if (CHAINED.has(b.t) !== (typeof p.prev === 'string')) return false;
  const seat = 'seat' in b && Number.isInteger(b.seat);
  switch (b.t) {
    case 'create':
      return typeof b.config === 'object' && b.config !== null;
    case 'claim':
      return seat && typeof b.name === 'string';
    case 'act':
      return seat && typeof b.action === 'object' && b.action !== null && typeof b.action.type === 'string' && (b.h === undefined || typeof b.h === 'string');
    case 'undo':
      return seat;
    case 'ask':
      return seat && ASK.has(b.ask);
    case 'pass':
      return seat && typeof b.stage === 'string';
    default:
      return false;
  }
}
