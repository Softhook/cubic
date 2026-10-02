/** Game creation and the setup decisions: fleet roll, starting skill, starting planet and ships. */
import { buildBoard, same } from './board';
import { isImplemented } from './effects';
import { emptyTurn, fail, headOf, log, name, placeCube, roll, type Handlers } from './core';
import { defaultMap, effectOf, MAPS, type CardDef, type GameMode } from './data';
import { die, scrapyard } from './lookups';
import { startSlots } from './queries';
import { next, shuffle } from './rng';
import { RULESETS } from './rules';
import type { Die, GameState, PlayerConfig } from './types';

export interface NewGameOptions {
  players: PlayerConfig[];
  mapId?: string;
  seed?: number;
  /** Defaults to the Community Edition. */
  mode?: GameMode;
}

export function createGame(opts: NewGameOptions): GameState {
  const n = opts.players.length;
  if (n < 2 || n > 5) throw new Error('Quantum needs 2–5 players');
  const mode = opts.mode ?? 'community';
  const rules = RULESETS[mode];
  const map = opts.mapId ? MAPS.find((m) => m.id === opts.mapId) : defaultMap(n);
  if (!map) throw new Error(opts.mapId ? `Unknown map ${opts.mapId}` : `No map for ${n} players`);
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;

  const state: GameState = {
    version: 1,
    mode,
    seed,
    rng: seed,
    board: buildBoard(map),
    players: opts.players.map((p, id) => ({
      ...p,
      id,
      dominance: 1,
      research: 1,
      missiles: rules.startingMissiles,
      cubesLeft: map.cubes,
      skills: [],
      ambitionTokens: 0,
      actionPenalty: 0,
      planAhead: 0,
      bonusTurns: [],
    })),
    dice: [],
    market: {
      skillDeck: [],
      skillRow: [],
      skillDiscard: [],
      tacticDeck: [],
      tacticRow: [],
      tacticDiscard: [],
      expansions: rules.cards?.expansionPile ? n + 1 : 0,
    },
    gates: [],
    turn: emptyTurn(0, 0),
    pending: [],
    phase: 'setup',
    winner: null,
    combatCounter: 0,
    log: [],
    logCounter: 0,
  };

  const m = state.market;
  if (rules.cards) {
    // Only cards whose effect is implemented are shuffled in, so every card drawn works.
    const deck = (defs: CardDef[]) =>
      shuffle(
        state,
        defs.filter((c) => isImplemented(effectOf(c.id))).flatMap((c) => Array.from({ length: c.count }, () => c.id)),
      );
    m.skillDeck = deck(rules.cards.skills);
    m.tacticDeck = deck(rules.cards.tactics);
    for (let i = 0; i < 3; i++) {
      m.skillRow.push(m.skillDeck.shift()!);
      m.tacticRow.push(m.tacticDeck.shift()!);
    }
  }

  // 7 dice per player: 3 starting ships, 2 expansion ships in reserve (2 more are trackers).
  for (const p of state.players) {
    for (let i = 0; i < 5; i++) {
      const d: Die = {
        id: `p${p.id}d${i}`,
        owner: p.id,
        value: 1,
        loc: i < 3 ? { zone: 'scrapyard' } : { zone: 'reserve' },
        rolls: 0,
      };
      if (i < 3) roll(state, d);
      state.dice.push(d);
    }
    state.pending.push({ kind: 'setupRoll', player: p.id, rerolled: false });
    if (rules.cards?.startingSkillDraft) {
      state.pending.push({ kind: 'skillDraft', player: p.id, options: [m.skillDeck.shift()!, m.skillDeck.shift()!] });
    }
  }
  log(state, `New ${rules.title} game on ${map.name}.`);
  return state;
}

/** Lowest fleet total goes first (ties: random); then everyone picks a starting planet in turn order. */
function startDeployment(s: GameState) {
  const sums = s.players.map((p) =>
    s.dice.filter((d) => d.owner === p.id && d.loc.zone === 'scrapyard').reduce((a, d) => a + d.value, 0),
  );
  const low = Math.min(...sums);
  const tied = s.players.filter((p) => sums[p.id] === low);
  const first = tied[Math.floor(next(s) * tied.length)].id;
  s.turn.player = first;
  log(s, `${name(s, first)} has the lowest fleet (${low}) and goes first.`, first);
  for (let i = 0; i < s.players.length; i++) {
    s.pending.push({ kind: 'placeStart', player: (first + i) % s.players.length });
  }
}

export const setupHandlers = {
  setupKeep(s) {
    headOf(s, 'setupRoll', 'Not rolling a fleet');
    s.pending.shift();
    if (!s.pending.length) startDeployment(s);
  },
  setupReroll(s) {
    const head = headOf(s, 'setupRoll', 'Not rolling a fleet');
    if (head.rerolled) fail('You may only re-roll once');
    head.rerolled = true;
    for (const d of scrapyard(s, head.player)) roll(s, d);
  },
  draftSkill(s, a) {
    const head = headOf(s, 'skillDraft', 'Not drafting');
    if (!head.options.includes(a.skill)) fail('Not one of your options');
    s.players[head.player].skills.push({ id: a.skill, active: true });
    for (const o of head.options) if (o !== a.skill) s.market.skillDeck.push(o);
    log(s, `${name(s, head.player)} chooses a starting skill.`, head.player);
    s.pending.shift();
    if (!s.pending.length) startDeployment(s);
  },
  placeStart(s, a) {
    const head = headOf(s, 'placeStart', 'Not placing a starting planet');
    const planet = s.board.planets[a.planet];
    if (!planet?.start) fail('Choose a starting planet');
    if (planet.cubes.length) fail('That starting planet is taken');
    placeCube(s, head.player, planet.id);
    log(s, `${name(s, head.player)} starts at planet ${planet.number}.`, head.player);
    s.pending.shift();
    // Rulebook p.3: every player places a cube first, then ships are placed in player order.
    s.pending.push({ kind: 'placeShips', player: head.player, planet: planet.id });
  },
  placeShip(s, a) {
    const head = headOf(s, 'placeShips', 'Not placing starting ships');
    const d = die(s, a.die);
    if (d.owner !== head.player || d.loc.zone !== 'scrapyard') fail('Choose one of your starting ships');
    if (!startSlots(s, head.planet).some((p) => same(p, a.to))) fail('Place it in an empty orbital position of your starting planet');
    d.loc = { zone: 'board', ...a.to };
    // When the last ship is placed, settle() moves on (turn.ts AUTO_RESOLVE.placeShips).
  },
} satisfies Partial<Handlers>;
