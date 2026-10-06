import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { chooseCombatResponse } from '@quantum/ai';
import { actor, apply, legalActions, MAPS, RuleError, RULESETS, type Action, type GameState, type PlayerId } from '@quantum/engine';
import {
  actBody,
  CHAINED,
  decodeEvent,
  encodePost,
  gameKeys,
  publicKeyOf,
  Timeline,
  type AskMode,
  type Body,
  type NostrEvent,
  type Post,
  type Replay,
  type Step,
} from '@quantum/online';
import { sfx } from '../sound';
import { aiLevelOf, think } from '../game/aiClient';
import { useToasts } from '../game/toasts';
import type { GameView } from '../game/view';
import { nextStep } from './playback';
import { identity, keepStorage, loadEvents, rememberGame, saveEvents } from './storage';
import { RelayLink, type RelayStatus } from './relays';

/**
 * The browser that made the last move also moves the AI players. If it went away, the other
 * players' browsers take over one after another, this long apart (so they don't all post rival
 * moves at once); spectators come last.
 */
const AI_TAKEOVER_MS = 15000;

export interface OnlineGame {
  /** Why the game can't be opened at all (not "not found yet"), if so. */
  failure: string | null;
  /** The game so far; null until its first post has been found (locally or on a relay). */
  replay: Replay | null;
  relays: RelayStatus;
  /** The seats this browser plays. */
  mySeats: PlayerId[];
  view: GameView | null;
  /** Whether the screen shows the current position (false while catching up on others' moves). */
  live: boolean;
  claim(seat: PlayerId, name: string): void;
  setAsk(ask: AskMode): void;
}

/** A post to make, or a function that decides it from the game as it is when it goes out. */
type PostRequest = Body | ((r: Replay) => Body | null);

/** One online game: its posts, kept locally and synced through the relays, and the game they make. */
export function useOnlineGame(secret: string): OnlineGame {
  const { me, replay, relays, failure, post } = usePostLog(secret);
  const mySeats = useMemo(() => replay?.seats.filter((s) => s.owner === me).map((s) => s.id) ?? [], [replay, me]);
  const head = replay?.steps.at(-1)!.state ?? null;
  const { shown, live, toasts } = usePlayback(replay, me);
  useAiSeats(replay, me, post);

  useEffect(() => {
    if (replay) rememberGame({ secret, ...summary(replay, mySeats) });
  }, [replay, mySeats, secret]);

  const [error, setError] = useState<{ id: number; text: string } | null>(null);
  const dispatch = useCallback(
    (a: Action): boolean => {
      if (!head || !live) return false;
      const fail = (text: string) => {
        sfx.error();
        setError({ id: Date.now(), text });
        return false;
      };
      const seat = a.type === 'missile' || a.type === 'reroll' ? a.by : actor(head);
      if (!mySeats.includes(seat)) return fail('Not your move');
      try {
        apply(head, a);
      } catch (e) {
        if (e instanceof RuleError) return fail(e.message);
        console.error('[quantum] apply threw', { action: a, error: e, state: JSON.stringify(head) });
        return fail(`Engine error: ${(e as Error).message}`);
      }
      // Checked again against the game as it is when the post goes out: a second click before
      // the screen caught up would otherwise follow the first move and be refused everywhere.
      post((r) => actBody(r, seat, a));
      return true;
    },
    [head, live, mySeats, post],
  );

  const view = useMemo((): GameView | null => {
    if (!replay || !shown) return null;
    const c = live ? replay.combat : null;
    const mustAnswer = c ? c.waitingOn.filter((s) => mySeats.includes(s) && !c.passed.includes(s)) : [];
    const undoSeat = replay.undoSeat;
    return {
      game: shown.state,
      dispatch,
      // Nothing is this screen's to play while it catches up.
      mine: (p) => live && mySeats.includes(p),
      undo: live && undoSeat !== null && mySeats.includes(undoSeat) ? () => post({ t: 'undo', seat: undoSeat }) : undefined,
      toasts,
      error,
      combat: c
        ? {
            responders: mySeats.filter((s) => !c.passed.includes(s)),
            mustAnswer: mustAnswer.length > 0,
            waitingOn: c.waitingOn.filter((s) => !c.passed.includes(s) && !mySeats.includes(s)),
            pass: () => mustAnswer.forEach((seat) => post({ t: 'pass', seat, stage: c.stage })),
          }
        : undefined,
    };
  }, [replay, shown, live, mySeats, dispatch, post, toasts, error]);

  // Dev-only hook for browser tests: window.__quantumOnline.{state(), view(), legal(), mySeats()}.
  const latest = useRef({ head, view, mySeats });
  latest.current = { head, view, mySeats };
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__quantumOnline = {
      state: () => latest.current.head,
      view: () => latest.current.view,
      mySeats: () => latest.current.mySeats,
      legal: () => (latest.current.head ? legalActions(latest.current.head) : []),
    };
  }, []);

  return {
    failure,
    replay,
    relays,
    mySeats,
    view,
    live,
    claim: (seat, name) => {
      keepStorage();
      post({ t: 'claim', seat, name });
    },
    setAsk: (ask) => mySeats.forEach((seat) => post({ t: 'ask', seat, ask })),
  };
}

/**
 * The game's events: loaded from this browser, synced with the relays, saved back, and replayed.
 * `replay` is a new object whenever the game changes. `post` signs a post, adds it to the game at
 * once and sends it to the relays.
 */
function usePostLog(secret: string) {
  const sk = useMemo(identity, []);
  const me = useMemo(() => publicKeyOf(sk), [sk]);
  const keys = useMemo(() => gameKeys(secret), [secret]);
  const timeline = useMemo(() => new Timeline(), [secret]);
  const events = useMemo(() => new Map<string, NostrEvent>(), [secret]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [relays, setRelays] = useState<RelayStatus>({ connected: 0, total: 0, unsent: 0 });
  const [failure, setFailure] = useState<string | null>(null);
  const link = useRef<RelayLink | null>(null);

  // The timeline changes in place; React gets a fresh copy, batched (a relay can send hundreds of
  // events in a burst). A timer, not an animation frame: those never fire in a background tab,
  // which would stop it from following the game and moving the AI.
  const batch = useRef<number | undefined>(undefined);
  const publish = useCallback(() => {
    if (batch.current !== undefined) return;
    batch.current = window.setTimeout(() => {
      batch.current = undefined;
      const r = timeline.replay();
      setReplay(r && { ...r, seats: r.seats.map((s) => ({ ...s })), steps: [...r.steps] });
    }, 16);
  }, [timeline]);
  useEffect(() => () => window.clearTimeout(batch.current), []);

  const save = useThrottled(() => saveEvents(keys.tag, [...events.values()]), 400);

  /** Adds an event (a relay's, or ours from storage); true if it was new and valid. */
  const receive = useCallback(
    (e: NostrEvent, trusted = false) => {
      if (events.has(e.id)) return false;
      const p = decodeEvent(keys, e, trusted);
      if (!p) return false;
      events.set(e.id, e);
      return timeline.add(p);
    },
    [keys, events, timeline],
  );

  useEffect(() => {
    let l: RelayLink | null = null;
    try {
      for (const e of loadEvents(keys.tag)) receive(e, true);
      publish();
      const store = { get: (id: string) => events.get(id), all: () => [...events.values()] };
      l = new RelayLink(keys.tag, store, (e) => receive(e) && (save(), publish()), setRelays);
      l.start();
      link.current = l;
    } catch (e) {
      console.error('[quantum] could not open the online game', e);
      setFailure(e instanceof Error ? e.message : String(e));
    }
    return () => {
      l?.close();
      link.current = null;
    };
  }, [keys, events, receive, publish, save]);

  const post = useCallback(
    (req: PostRequest) => {
      const r = timeline.replay();
      if (!r) return;
      const body = typeof req === 'function' ? req(r) : req;
      if (!body) return;
      const { event, post: p } = encodePost(keys, sk, body, CHAINED.has(body.t) ? r.tip : null);
      events.set(event.id, event);
      timeline.add(p);
      save();
      publish();
      link.current?.publish(event);
    },
    [keys, sk, timeline, events, save, publish],
  );

  return { me, replay, relays, failure, post };
}

/**
 * What the screen shows: the current position, or, while catching up on moves made by others,
 * each one in turn (see `nextStep`). Toasts announce what each shown step changed.
 */
function usePlayback(replay: Replay | null, me: string) {
  const { toasts, announce } = useToasts();
  const [shown, setShown] = useState<Step | null>(null);
  const shownAt = useRef(0);

  // A layout effect, so a step shown at once (this browser's own move) replaces the previous one
  // before the screen is painted: no frame where the game looks like it's catching up.
  useLayoutEffect(() => {
    if (!replay) return;
    const own = (p: Post) => p.author === me && 'seat' in p.body && !replay.seats[p.body.seat]?.ai;
    const next = nextStep(replay.steps, shown, own, performance.now() - shownAt.current);
    if (!next) return;
    const show = () => {
      if (next.announce && shown) announce(shown.state, next.step.state);
      shownAt.current = performance.now();
      setShown(next.step);
    };
    if (next.delay === 0) return show();
    const t = window.setTimeout(show, next.delay);
    return () => window.clearTimeout(t);
  }, [replay, shown, me, announce]);

  return { shown, live: !!shown && shown === replay?.steps.at(-1), toasts };
}

/**
 * Moves the AI seats: the browser that made the last move does; any other takes over once the
 * game has waited `AI_TAKEOVER_MS` for it.
 */
function useAiSeats(replay: Replay | null, me: string, post: (req: PostRequest) => void) {
  const working = useRef('');
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    const head = replay?.steps.at(-1)!.state;
    if (!replay || !head || head.phase === 'over') return;
    const work = aiWork(replay, head);
    if (!work) return;
    // Every browser ranks the others the same way, so they take over in turn.
    const others = [...new Set(replay.seats.flatMap((s) => (s.owner && s.owner !== replay.tipAuthor ? [s.owner] : [])))].sort();
    const turn = AI_TAKEOVER_MS * (1 + (others.includes(me) ? others.indexOf(me) : others.length));
    // Capped, so a poster whose clock runs ahead can't hold the game up for longer.
    const wait = replay.tipAuthor === me ? 0 : Math.min(turn, turn - (Date.now() - replay.tipAt));
    if (wait > 0) {
      const t = window.setTimeout(() => setRecheck((n) => n + 1), wait + 50);
      return () => window.clearTimeout(t);
    }
    const stage = replay.combat?.stage ?? '';
    const job = `${replay.tip}|${stage}|${work.seat}`;
    if (working.current === job) return;
    working.current = job;
    // A move worked out for a position that has moved on since is dropped.
    const current = (r: Replay) => r.tip === replay.tip && (r.combat?.stage ?? '') === stage;
    const level = aiLevelOf(head.players[work.seat]);
    if (work.combat) {
      const a = chooseCombatResponse(head, work.seat, { level });
      post((r) => (!current(r) ? null : a ? actBody(r, work.seat, a) : { t: 'pass', seat: work.seat, stage }));
    } else {
      void think(head, level).then((a) => a && post((r) => (current(r) ? actBody(r, work.seat, a) : null)));
    }
  }, [replay, me, post, recheck]);
}

/** The AI seat that has something to do now, if any. */
function aiWork(r: Replay, s: GameState): { seat: PlayerId; combat: boolean } | null {
  if (r.combat) {
    const seat = r.combat.waitingOn.find((id) => r.seats[id].ai && !r.combat!.passed.includes(id));
    return seat === undefined ? null : { seat, combat: true };
  }
  const who = actor(s);
  return r.seats[who].ai ? { seat: who, combat: false } : null;
}

/** How the game stands, for the lobby's list. */
function summary(r: Replay, mySeats: PlayerId[]) {
  const s = r.steps.at(-1)!.state;
  const open = r.seats.filter((x) => x.open && !x.owner).length;
  const waitingOnMe = r.combat ? r.combat.waitingOn.some((id) => mySeats.includes(id) && !r.combat!.passed.includes(id)) : mySeats.includes(actor(s));
  return {
    mode: RULESETS[r.config.mode]?.name,
    map: MAPS.find((m) => m.id === r.config.mapId)?.name,
    players: r.seats.map((x) => x.name),
    over: s.phase === 'over',
    myTurn: s.phase !== 'over' && waitingOnMe,
    status:
      s.phase === 'over'
        ? `${s.players[s.winner ?? 0].name} won`
        : open
          ? `Waiting for ${open} player${open > 1 ? 's' : ''} to join`
          : s.phase === 'setup'
            ? 'Setting up'
            : `Turn ${s.turn.number}`,
  };
}

/** `fn` at most once per `ms`; anything still waiting runs when the page or the game closes. */
function useThrottled(fn: () => void, ms: number) {
  const latest = useRef(fn);
  latest.current = fn;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const flush = () => {
      if (timer.current === undefined) return;
      window.clearTimeout(timer.current);
      timer.current = undefined;
      latest.current();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
  return useCallback(() => {
    if (timer.current !== undefined) return;
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      latest.current();
    }, ms);
  }, [ms]);
}
