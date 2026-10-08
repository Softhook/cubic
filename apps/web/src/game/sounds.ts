import { effectOf, type Die, type GameState, type LogEntry, type LogEvent } from '@quantum/engine';
import { sfx } from '../sound';

type Sound = keyof typeof sfx;

/** The sound for each logged event. Ships destroyed, moved or deployed are heard from the state instead (see `playSounds`). */
const EVENT_SOUNDS: Partial<Record<LogEvent, Sound>> = {
  victory: 'win',
  infamy: 'infamy',
  seize: 'cube',
  conquer: 'cube',
  startPlanet: 'cube',
  repelled: 'repel',
  missile: 'missile',
  cardTaken: 'card',
  expansion: 'launch',
  discard: 'discard',
  breakthrough: 'breakthrough',
};

/** Each Tactic or Gambit effect's signature sound; any other card played sounds like a card. */
const TACTIC_SOUNDS: Record<string, Sound> = {
  aggression: 'drums',
  'black-market': 'coins',
  'change-of-heart': 'shuffle',
  momentum: 'momentum',
  'plan-ahead': 'lockOn',
  sabotage: 'powerDown',
  'sabotage-original': 'powerDown',
  'show-of-force': 'alarm',
  'unveil-the-fleet': 'unveil',
  reorganization: 'unveil',
  'warp-gate': 'portal',
  expansion: 'launch',
};

const onBoard = (d: Die) => (d.loc.zone === 'board' ? d.loc : null);
const sameCell = (a: { r: number; c: number }, b: { r: number; c: number }) => a.r === b.r && a.c === b.c;

/** What the step from `prev` to `next` sounds like. `fresh`: the log entries it added. */
export function soundsFor(prev: GameState, next: GameState, fresh: LogEntry[]): { first: Sound[]; then: Sound[]; destroyed: number } {
  const first = new Set<Sound>();
  const then = new Set<Sound>();

  // Cards played resolve first; their effects (ships, missiles) follow a beat later.
  const played = fresh.filter((e) => e.event === 'cardPlayed');
  for (const id of played.length ? next.market.tacticDiscard.slice(-played.length) : []) {
    first.add(TACTIC_SOUNDS[effectOf(id)] ?? 'card');
  }
  for (const e of fresh) {
    const s = e.event && EVENT_SOUNDS[e.event];
    if (s) first.add(s);
  }
  const effects = first.size ? then : first;

  // Ships: flown, arrived, destroyed, swapped or renumbered.
  const before = new Map(prev.dice.map((d) => [d.id, d]));
  const moved: { from: { r: number; c: number }; to: { r: number; c: number } }[] = [];
  let destroyed = 0;
  for (const d of next.dice) {
    const p = before.get(d.id);
    if (!p) continue;
    const from = onBoard(p);
    const to = onBoard(d);
    if (from && to && !sameCell(from, to)) moved.push({ from, to });
    else if (!from && to) effects.add('warpIn');
    else if (from && !to) destroyed++;
    else if (d.value !== p.value && d.rolls === p.rolls) effects.add('retune');
  }
  const swapped = moved.some((a) => moved.some((b) => a !== b && sameCell(a.from, b.to) && sameCell(a.to, b.from)));
  if (swapped) effects.add('swap');
  else if (moved.length) effects.add('fly');
  if (destroyed) effects.add('explode');

  if (next.players.some((pl, i) => pl.missiles > prev.players[i].missiles)) effects.add('missileLoad');
  if (next.gates.length > prev.gates.length) effects.add('portal');

  // Once-per-turn skills used this step.
  const sameTurn = prev.turn.number === next.turn.number && prev.turn.player === next.turn.player;
  if (sameTurn && next.turn.oncePerTurn.length > prev.turn.oncePerTurn.length) effects.add('skill');

  return { first: [...first], then: [...then], destroyed };
}

/** Plays what the step from `prev` to `next` sounds like. */
export function playSounds(prev: GameState, next: GameState, fresh: LogEntry[]) {
  const { first, then, destroyed } = soundsFor(prev, next, fresh);
  const play = (s: Sound) => (s === 'explode' ? sfx.explode(destroyed) : sfx[s]());
  first.forEach(play);
  if (then.length) window.setTimeout(() => then.forEach(play), 350);
}
