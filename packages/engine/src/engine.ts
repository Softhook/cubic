import { buildBoard, key, mapCentre, orbitals, planetFreeSlots, same } from './board';
import {
  card,
  cardKind,
  effectOf,
  IMPLEMENTED_EFFECTS,
  MAPS,
  ORIGINAL_COMMAND,
  ORIGINAL_GAMBIT,
  SHIP_NAMES,
  SKILLS,
  TACTICS,
  type CardDef,
  type GameMode,
} from './data';
import { d6, next, shuffle } from './rng';
import {
  canMoveDie,
  canReconfigure,
  canUseAbility,
  tacticalOptions,
  carryOptions,
  carryPassengers,
  cellOf,
  combatOutcome,
  combatTotal,
  conquerCheck,
  deployTargets,
  die,
  dieAt,
  freeAttackTargets,
  hasSkill,
  infamyTargets,
  isEmptySpace,
  moveOptions,
  reserve,
  scrapyard,
  shipsOnBoard,
  skillLimit,
} from './queries';
import {
  RuleError,
  type Action,
  type Cell,
  type DeckKind,
  type Die,
  type GameState,
  type Pending,
  type PlayerConfig,
  type PlayerId,
  type TurnState,
} from './types';

export interface NewGameOptions {
  players: PlayerConfig[];
  mapId?: string;
  seed?: number;
  /** Defaults to the Community Edition. */
  mode?: GameMode;
}

const ACTIONS_PER_TURN = 3;
const LOG_LIMIT = 80;

// ---------------------------------------------------------------------------
// Setup

function emptyTurn(player: PlayerId, number: number): TurnState {
  return {
    player,
    number,
    phase: 'actions',
    actionsLeft: 0,
    freeDeploys: 0,
    freeMoves: 0,
    moved: {},
    abilityUsed: {},
    seen: {},
    conquests: 0,
    attacked: false,
    destroyedBy: [],
    oncePerTurn: [],
    bonus: false,
  };
}

export function createGame(opts: NewGameOptions): GameState {
  const n = opts.players.length;
  if (n < 2 || n > 5) throw new Error('Quantum needs 2–5 players');
  const map = MAPS.find((m) => m.id === opts.mapId) ?? MAPS.find((m) => m.players === n);
  if (!map) throw new Error(`No map for ${n} players`);
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const mode = opts.mode ?? 'community';

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
      missiles: mode === 'community' ? 1 : 0,
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
      expansions: mode === 'community' ? n + 1 : 0,
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
  if (mode !== 'basic') {
    const deck = (defs: CardDef[]) =>
      shuffle(
        state,
        defs
          .filter((c) => IMPLEMENTED_EFFECTS.has(effectOf(c.id)))
          .flatMap((c) => Array.from({ length: c.count }, () => c.id)),
      );
    m.skillDeck = deck(mode === 'original' ? ORIGINAL_COMMAND : SKILLS);
    m.tacticDeck = deck(mode === 'original' ? ORIGINAL_GAMBIT : TACTICS);
    for (let i = 0; i < 3; i++) {
      m.skillRow.push(m.skillDeck.shift()!);
      m.tacticRow.push(m.tacticDeck.shift()!);
    }
  }

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
    if (mode === 'community') {
      state.pending.push({
        kind: 'skillDraft',
        player: p.id,
        options: [m.skillDeck.shift()!, m.skillDeck.shift()!],
      });
    }
  }
  const modeName = { basic: 'Basic', original: 'Original', community: 'Community Edition' }[mode];
  log(state, `New ${modeName} game on ${map.name}.`);
  return state;
}

// ---------------------------------------------------------------------------
// Public API

/** Applies an action and returns the new state. Throws RuleError if the action is illegal. */
export function apply(prev: GameState, action: Action): GameState {
  if (prev.phase === 'over') throw new RuleError('The game is over');
  const s = structuredClone(prev);
  handle(s, action);
  settle(s);
  return s;
}

export function tryApply(prev: GameState, action: Action): GameState | null {
  try {
    return apply(prev, action);
  } catch (e) {
    if (e instanceof RuleError) return null;
    throw e;
  }
}

/** The player who must act next (for combat: the attacker, who resolves it). */
export function actor(state: GameState): PlayerId {
  const head = state.pending[0];
  if (!head) return state.turn.player;
  if (head.kind === 'combat') return head.attacker.player;
  return head.player;
}

export function currentPending(state: GameState): Pending | undefined {
  return state.pending[0];
}

// ---------------------------------------------------------------------------
// Helpers

function fail(msg: string): never {
  throw new RuleError(msg);
}

function log(s: GameState, text: string, player?: PlayerId) {
  s.log.push({ id: ++s.logCounter, text, player });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

const name = (s: GameState, p: PlayerId) => s.players[p].name;
const shipName = (d: Die) => `${SHIP_NAMES[d.value]} (${d.value})`;

function roll(s: GameState, d: Die) {
  d.value = d6(s);
  d.rolls++;
}

/**
 * Reconfigure: re-roll until the number changes. The Community Edition is stricter:
 * the die must show a value it hasn't shown this turn.
 */
function rerollNew(s: GameState, d: Die) {
  if (s.mode !== 'community') {
    const old = d.value;
    do d.value = d6(s);
    while (d.value === old);
    d.rolls++;
    return;
  }
  const seen = (s.turn.seen[d.id] ??= [d.value]);
  if (seen.length >= 6) fail('This ship has already shown every value this turn');
  do d.value = d6(s);
  while (seen.includes(d.value));
  seen.push(d.value);
  d.rolls++;
}

function destroyShip(s: GameState, d: Die) {
  d.loc = { zone: 'scrapyard' };
  roll(s, d);
  s.turn.seen[d.id] = [d.value];
}

function spend(s: GameState, n: number) {
  if (s.turn.actionsLeft < n) fail(n === 1 ? 'No actions left' : `Needs ${n} actions`);
  s.turn.actionsLeft -= n;
}

function requireActionPhase(s: GameState) {
  if (s.phase !== 'play') fail('The game has not started');
  if (s.pending.length) fail('Resolve the current decision first');
  if (s.turn.phase !== 'actions') fail('Not in the action phase');
}

function ownShip(s: GameState, id: string, zone?: Die['loc']['zone']): Die {
  const d = die(s, id);
  if (d.owner !== s.turn.player) fail('Not your ship');
  if (zone && d.loc.zone !== zone) fail(`Ship is not ${zone === 'board' ? 'on the map' : `in the ${zone}`}`);
  return d;
}

function useAbility(s: GameState, d: Die, value: number) {
  if (d.loc.zone !== 'board') fail('Only ships on the map can use abilities');
  if (d.value !== value) fail(`Only a ${SHIP_NAMES[value]} can do that`);
  markAbility(s, d);
}

/** Uses a die's ability for this turn, falling back to Cunning for a second use. */
function markAbility(s: GameState, d: Die) {
  if (!canUseAbility(s, d)) fail('This ship already used its ability this turn');
  if (s.turn.abilityUsed[d.id]) s.turn.oncePerTurn.push('cunning');
  s.turn.abilityUsed[d.id] = true;
}

function oncePerTurn(s: GameState, tag: string) {
  if (s.turn.oncePerTurn.includes(tag)) fail('Already used this turn');
  s.turn.oncePerTurn.push(tag);
}

function requireSkill(s: GameState, p: PlayerId, skill: string) {
  if (!hasSkill(s, p, skill)) fail(`Requires the ${card(skill).name} skill`);
}

function gainResearch(s: GameState, p: PlayerId, n: number) {
  if (hasSkill(s, p, 'righteous')) return;
  s.players[p].research = Math.min(6, s.players[p].research + n);
}

function gainDominance(s: GameState, p: PlayerId, n: number) {
  const pl = s.players[p];
  pl.dominance = Math.min(6, pl.dominance + n);
  if (pl.dominance >= 6) {
    pl.dominance = 1;
    log(s, `${pl.name} achieves Infamy!`, p);
    s.pending.push({ kind: 'infamy', player: p });
  }
}

function loseDominance(s: GameState, p: PlayerId, n: number, destroyed = false) {
  if (hasSkill(s, p, 'righteous')) return;
  if (destroyed && hasSkill(s, p, 'righteous-original')) return;
  const pl = s.players[p];
  pl.dominance = Math.max(1, pl.dominance - n);
}

function placeCube(s: GameState, p: PlayerId, planetId: number) {
  const planet = s.board.planets[planetId];
  planet.cubes.push(p);
  const pl = s.players[p];
  pl.cubesLeft--;
  if (s.phase === 'play' && p === s.turn.player) s.turn.conquests++;
  if (pl.cubesLeft <= 0) {
    s.phase = 'over';
    s.winner = p;
    s.pending = [];
    log(s, `${pl.name} places their final cube and wins!`, p);
  }
}

/** Effects of `winner` destroying one of `loser`'s ships in combat. */
function onDestroy(s: GameState, winner: PlayerId, loser: PlayerId) {
  const first = !s.turn.destroyedBy.includes(winner);
  if (first) s.turn.destroyedBy.push(winner);
  loseDominance(s, loser, hasSkill(s, loser, 'ravenous-original') ? 2 : 1, true);
  const myTurn = winner === s.turn.player;
  if (first && hasSkill(s, winner, 'plundering')) gainResearch(s, winner, 3);
  if (first && myTurn && hasSkill(s, winner, 'plundering-original')) gainResearch(s, winner, 3);
  if (first && hasSkill(s, winner, 'hostile') && winner === s.turn.player && s.turn.phase === 'actions') {
    s.turn.actionsLeft++;
  }
  const gain = hasSkill(s, winner, 'ravenous-original') ? 2 : 1;
  gainDominance(s, winner, gain + (first && hasSkill(s, winner, 'ravenous') ? 1 : 0));
}

function draw(s: GameState, deck: DeckKind): string | undefined {
  const m = s.market;
  const d = deck === 'skill' ? m.skillDeck : m.tacticDeck;
  const discard = deck === 'skill' ? m.skillDiscard : m.tacticDiscard;
  if (!d.length && discard.length) {
    d.push(...shuffle(s, discard));
    discard.length = 0;
  }
  return d.shift();
}

function takeFromRow(s: GameState, deck: DeckKind, index: number): string {
  const row = deck === 'skill' ? s.market.skillRow : s.market.tacticRow;
  if (index < 0 || index >= row.length) fail('No card there');
  const [taken] = row.splice(index, 1);
  const next = draw(s, deck);
  if (next) row.unshift(next);
  return taken;
}

function gainCard(s: GameState, p: PlayerId, id: string) {
  const def = card(id);
  const pl = s.players[p];
  if (cardKind(id) === 'skill') {
    pl.skills.push({ id, active: false });
    log(s, `${pl.name} takes the ${def.name} ${s.mode === 'original' ? 'Command card' : 'skill'}.`, p);
    if (pl.skills.length > skillLimit(s, p)) s.pending.unshift({ kind: 'discardSkill', player: p, reason: 'limit' });
  } else {
    log(s, `${pl.name} plays ${def.name}.`, p);
    s.market.tacticDiscard.push(id);
    resolveTactic(s, p, id);
  }
}

function resolveTactic(s: GameState, p: PlayerId, id: string) {
  const pl = s.players[p];
  switch (effectOf(id)) {
    case 'aggression':
      gainDominance(s, p, 2);
      break;
    case 'black-market':
      pl.missiles += 2;
      break;
    case 'change-of-heart':
      if (s.market.skillDeck.length) s.pending.unshift({ kind: 'changeOfHeart', player: p });
      break;
    case 'momentum':
      pl.bonusTurns.push(2);
      break;
    case 'plan-ahead':
      pl.planAhead = 2;
      break;
    case 'sabotage':
      for (const o of s.players) if (o.id !== p) o.actionPenalty++;
      break;
    case 'show-of-force':
      if (shipsOnBoard(s).length) s.pending.unshift({ kind: 'showOfForce', player: p });
      break;
    case 'unveil-the-fleet':
      for (const d of shipsOnBoard(s, p)) destroyShip(s, d);
      s.pending.unshift({ kind: 'unveil', player: p, rerolled: [] });
      break;
    case 'warp-gate':
      s.pending.unshift({ kind: 'warpGate', player: p, placed: [] });
      break;
    case 'expansion': {
      const res = reserve(s, p);
      if (!res.length) {
        log(s, `${pl.name} has no reserve ships left.`, p);
        break;
      }
      roll(s, res[0]);
      s.pending.unshift({ kind: 'placeExpansion', player: p, die: res[0].id });
      break;
    }
    case 'reorganization':
      s.pending.unshift({ kind: 'unveil', player: p, rerolled: [], reorganize: true });
      break;
    case 'sabotage-original':
      for (const o of s.players) {
        if (o.id !== p && o.skills.length) s.pending.unshift({ kind: 'discardSkill', player: o.id, reason: 'sabotage' });
      }
      break;
    default:
      throw new Error(`Unhandled tactic ${id}`);
  }
}

function startCombat(s: GameState, attacker: Die, defender: Die, from: Cell) {
  const rollFor = (p: PlayerId) =>
    hasSkill(s, p, 'brutal') ? [d6(s), d6(s)] : [d6(s)];
  const at = cellOf(defender)!;
  attacker.loc = { zone: 'board', r: from.r, c: from.c };
  s.turn.attacked = true;
  s.pending.unshift({
    kind: 'combat',
    id: ++s.combatCounter,
    attacker: { player: attacker.owner, die: attacker.id, ship: attacker.value, dice: rollFor(attacker.owner), missile: false },
    defender: { player: defender.owner, die: defender.id, ship: defender.value, dice: rollFor(defender.owner), missile: false },
    from,
    at,
  });
  log(s, `${name(s, attacker.owner)}'s ${shipName(attacker)} attacks ${name(s, defender.owner)}'s ${shipName(defender)}.`, attacker.owner);
}

function startTurn(s: GameState, player: PlayerId, actions: number, bonus: boolean) {
  const pl = s.players[player];
  s.turn = emptyTurn(player, s.turn.number + 1);
  s.turn.bonus = bonus;
  let n = actions;
  if (!bonus) {
    n -= pl.actionPenalty;
    pl.actionPenalty = 0;
  }
  s.turn.actionsLeft = Math.max(0, n);
  s.turn.freeDeploys = hasSkill(s, player, 'industrious') ? 1 : 0;
  s.turn.freeMoves = hasSkill(s, player, 'curious-original') ? 1 : 0;
  const mine = shipsOnBoard(s, player);
  if (hasSkill(s, player, 'arrogant') && s.players.every((o) => o.id === player || shipsOnBoard(s, o.id).length < mine.length)) {
    s.turn.actionsLeft++;
  }
  if (hasSkill(s, player, 'conformist') && new Set(mine.map((d) => d.value)).size < mine.length) {
    s.turn.actionsLeft++;
  }
  for (const d of s.dice) if (d.owner === player) s.turn.seen[d.id] = [d.value];

  if (hasSkill(s, player, 'brilliant')) gainResearch(s, player, 2);
  const onVoid = shipsOnBoard(s, player).filter((d) => {
    const c = cellOf(d)!;
    return s.board.cells[c.r][c.c].void;
  }).length;
  if (onVoid) gainResearch(s, player, onVoid);
  log(s, bonus ? `${pl.name} takes a bonus turn.` : `${pl.name}'s turn.`, player);
}

function endTurn(s: GameState) {
  const p = s.turn.player;
  const pl = s.players[p];
  s.turn.phase = 'cards';
  if (s.mode === 'basic') return;
  let cards = s.turn.conquests;
  const threshold = hasSkill(s, p, 'precocious') ? 4 : 6;
  if (pl.research >= threshold) {
    pl.research = 1;
    cards++;
    log(s, `${pl.name} makes a research breakthrough.`, p);
  }
  if (cards > 0) s.pending.push({ kind: 'takeCard', player: p, count: cards });
}

function finishTurn(s: GameState) {
  const p = s.turn.player;
  const pl = s.players[p];
  for (const sk of pl.skills) sk.active = true;
  if (pl.planAhead > 0) pl.planAhead--;
  const bonus = pl.bonusTurns.shift();
  if (bonus !== undefined) startTurn(s, p, bonus, true);
  else startTurn(s, (p + 1) % s.players.length, ACTIONS_PER_TURN, false);
}

function canTakeAny(s: GameState, p: PlayerId): boolean {
  const m = s.market;
  return m.skillRow.length > 0 || m.tacticRow.length > 0 || (m.expansions > 0 && reserve(s, p).length > 0);
}

/** Drops decisions that have no legal choice and advances the turn when nothing is pending. */
function settle(s: GameState) {
  for (let guard = 0; guard < 50; guard++) {
    if (s.phase === 'over') return;
    const head = s.pending[0];
    if (head?.kind === 'infamy' && !infamyTargets(s, head.player).length) {
      log(s, `${name(s, head.player)} has nowhere to place an Infamy cube.`, head.player);
      s.pending.shift();
      continue;
    }
    if (head?.kind === 'showOfForce' && !shipsOnBoard(s).length) {
      s.pending.shift();
      continue;
    }
    if (head?.kind === 'takeCard' && !canTakeAny(s, head.player)) {
      s.pending.shift();
      continue;
    }
    if (!head && s.phase === 'play' && s.turn.phase === 'cards') {
      finishTurn(s);
      continue;
    }
    return;
  }
}

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

// ---------------------------------------------------------------------------
// Action handler

function handle(s: GameState, a: Action) {
  const head = s.pending[0];

  // Decisions -----------------------------------------------------------------
  switch (a.type) {
    case 'setupKeep': {
      if (head?.kind !== 'setupRoll') fail('Not rolling a fleet');
      s.pending.shift();
      if (!s.pending.length) startDeployment(s);
      return;
    }
    case 'setupReroll': {
      if (head?.kind !== 'setupRoll') fail('Not rolling a fleet');
      if (head.rerolled) fail('You may only re-roll once');
      head.rerolled = true;
      for (const d of scrapyard(s, head.player)) roll(s, d);
      return;
    }
    case 'draftSkill': {
      if (head?.kind !== 'skillDraft') fail('Not drafting');
      if (!head.options.includes(a.skill)) fail('Not one of your options');
      s.players[head.player].skills.push({ id: a.skill, active: true });
      for (const o of head.options) if (o !== a.skill) s.market.skillDeck.push(o);
      log(s, `${name(s, head.player)} chooses a starting skill.`, head.player);
      s.pending.shift();
      if (!s.pending.length) startDeployment(s);
      return;
    }
    case 'placeStart': {
      if (head?.kind !== 'placeStart') fail('Not placing a starting planet');
      const planet = s.board.planets[a.planet];
      if (!planet?.start) fail('Choose a starting planet');
      if (planet.cubes.length) fail('That starting planet is taken');
      placeCube(s, head.player, planet.id);
      const centre = mapCentre(s.board);
      const slots = orbitals(s.board, planet).sort(
        (x, y) =>
          Math.hypot(x.r - centre.r, x.c - centre.c) - Math.hypot(y.r - centre.r, y.c - centre.c),
      );
      for (const d of scrapyard(s, head.player)) {
        const slot = slots.find((p) => isEmptySpace(s, p));
        if (slot) d.loc = { zone: 'board', ...slot };
      }
      log(s, `${name(s, head.player)} deploys around planet ${planet.number}.`, head.player);
      s.pending.shift();
      if (!s.pending.length) {
        s.phase = 'play';
        const first = s.turn.player;
        s.turn.number = 0;
        startTurn(s, first, ACTIONS_PER_TURN, false);
      }
      return;
    }
    case 'missile': {
      if (head?.kind !== 'combat') fail('No combat to target');
      const pl = s.players[a.by];
      if (!pl || pl.missiles <= 0) fail('No missiles left');
      const side = head[a.side];
      if (side.missile || combatTotal(s, head, a.side).roll === 1) fail('That combat roll is already 1');
      pl.missiles--;
      side.missile = true;
      log(s, `${pl.name} fires a missile: ${name(s, side.player)}'s combat roll becomes 1.`, a.by);
      return;
    }
    case 'resolveCombat': {
      if (head?.kind !== 'combat') fail('No combat to resolve');
      resolveCombat(s, head);
      return;
    }
    case 'advance': {
      if (head?.kind !== 'advance') fail('Nothing to advance');
      s.pending.shift();
      const d = die(s, head.die);
      if (a.move && !dieAt(s, head.to)) d.loc = { zone: 'board', ...head.to };
      return;
    }
    case 'infamy': {
      if (head?.kind !== 'infamy') fail('No Infamy to resolve');
      if (!infamyTargets(s, head.player).some((p) => p.id === a.planet)) fail('Choose a planet without your cube');
      s.pending.shift();
      log(s, `${name(s, head.player)} seizes planet ${s.board.planets[a.planet].number} through Infamy.`, head.player);
      placeCube(s, head.player, a.planet);
      if (s.phase === 'play' && s.turn.phase === 'cards' && head.player === s.turn.player) {
        s.pending.unshift({ kind: 'takeCard', player: head.player, count: 1 });
      }
      return;
    }
    case 'takeCard': {
      if (head?.kind !== 'takeCard') fail('Not taking a card');
      const p = head.player;
      if (a.deck === 'expansion') {
        const res = reserve(s, p);
        if (s.market.expansions <= 0) fail('No Expansion cards left');
        if (!res.length) fail('Your reserve is empty');
        consumeCardPick(s);
        s.market.expansions--;
        roll(s, res[0]);
        s.pending.unshift({ kind: 'placeExpansion', player: p, die: res[0].id });
        log(s, `${name(s, p)} expands their fleet.`, p);
        return;
      }
      const deck = a.deck === 'skill' ? s.market.skillDeck : s.market.tacticDeck;
      const row = a.deck === 'skill' ? s.market.skillRow : s.market.tacticRow;
      if (s.mode === 'community' && a.index === row.length - 1 && row.length === 3 && deck.length) {
        s.pending.unshift({ kind: 'peek', player: p, deck: a.deck, top: deck[0] });
        return;
      }
      consumeCardPick(s);
      gainCard(s, p, takeFromRow(s, a.deck, a.index));
      return;
    }
    case 'peekChoice': {
      if (head?.kind !== 'peek') fail('Not peeking');
      s.pending.shift();
      consumeCardPick(s);
      const id = a.takeTop
        ? (head.deck === 'skill' ? s.market.skillDeck : s.market.tacticDeck).shift()!
        : takeFromRow(s, head.deck, 2);
      gainCard(s, head.player, id);
      return;
    }
    case 'discardSkill': {
      if (head?.kind !== 'discardSkill') fail('Not discarding');
      const pl = s.players[head.player];
      const i = pl.skills.findIndex((x) => x.id === a.skill);
      if (i < 0) fail('You do not have that skill');
      pl.skills.splice(i, 1);
      s.market.skillDiscard.push(a.skill);
      s.pending.shift();
      log(s, `${pl.name} discards ${card(a.skill).name}.`, head.player);
      if (pl.skills.length > skillLimit(s, head.player)) s.pending.unshift({ ...head, reason: 'limit' });
      return;
    }
    case 'placeExpansion': {
      if (head?.kind !== 'placeExpansion') fail('No expansion ship to place');
      const d = die(s, head.die);
      if (a.to) {
        if (!deployTargets(s, head.player).some((p) => same(p, a.to!))) fail('Place it in orbit of one of your planets');
        d.loc = { zone: 'board', ...a.to };
      } else d.loc = { zone: 'scrapyard' };
      s.turn.seen[d.id] = [d.value];
      s.pending.shift();
      return;
    }
    case 'showOfForce': {
      if (head?.kind !== 'showOfForce') fail('No Show of Force to resolve');
      const d = die(s, a.die);
      if (d.loc.zone !== 'board') fail('Choose a ship on the map');
      s.pending.shift();
      log(s, `${name(s, head.player)} destroys ${name(s, d.owner)}'s ${shipName(d)}.`, head.player);
      destroyShip(s, d);
      gainDominance(s, head.player, 1);
      return;
    }
    case 'warpGate': {
      if (head?.kind !== 'warpGate') fail('No Warp Gate to place');
      const cell = s.board.cells[a.cell.r]?.[a.cell.c];
      if (!cell || cell.kind !== 'space') fail('Gates go on empty spaces');
      if (head.placed.some((p) => same(p, a.cell))) fail('Choose a different space');
      head.placed.push(a.cell);
      if (head.placed.length === 2) {
        s.gates = head.placed;
        s.pending.shift();
      }
      return;
    }
    case 'changeOfHeart': {
      if (head?.kind !== 'changeOfHeart') fail('Not choosing a skill');
      const i = s.market.skillDeck.indexOf(a.skill);
      if (i < 0) fail('That skill is not in the deck');
      s.market.skillDeck.splice(i, 1);
      s.market.skillDeck = shuffle(s, s.market.skillDeck);
      s.pending.shift();
      gainCard(s, head.player, a.skill);
      return;
    }
    case 'unveilReroll': {
      if (head?.kind !== 'unveil') fail('Not unveiling');
      const d = die(s, a.die);
      const zones = head.reorganize ? ['board', 'scrapyard'] : ['scrapyard'];
      if (d.owner !== head.player || !zones.includes(d.loc.zone)) fail('Choose one of your ships');
      if (head.rerolled.includes(d.id)) fail('Already re-rolled');
      head.rerolled.push(d.id);
      // Reorganization: a re-rolled ship leaves the map and is placed again (or scrapped).
      if (head.reorganize) d.loc = { zone: 'scrapyard' };
      roll(s, d);
      return;
    }
    case 'unveilDeploy': {
      if (head?.kind !== 'unveil') fail('Not unveiling');
      const d = die(s, a.die);
      if (d.owner !== head.player || d.loc.zone !== 'scrapyard') fail('Choose a ship in your scrapyard');
      if (head.reorganize && !head.rerolled.includes(d.id)) fail('Only re-rolled ships can be placed');
      if (!deployTargets(s, head.player).some((p) => same(p, a.to))) fail('Not a deploy space');
      d.loc = { zone: 'board', ...a.to };
      return;
    }
    case 'unveilDone': {
      if (head?.kind !== 'unveil') fail('Not unveiling');
      s.pending.shift();
      return;
    }
  }

  // Phase 1 ------------------------------------------------------------------
  requireActionPhase(s);
  const t = s.turn;
  const me = t.player;

  switch (a.type) {
    case 'move': {
      const d = ownShip(s, a.die, 'board');
      if (!canMoveDie(s, d)) fail('This ship already moved this turn');
      const opt = moveOptions(s, d.id).moves.get(key(a.to));
      if (!opt) fail('Out of range');
      if (t.freeMoves > 0) t.freeMoves--;
      else spend(s, 1);
      if (opt.diagonal) markAbility(s, d);
      d.loc = { zone: 'board', ...a.to };
      t.moved[d.id] = (t.moved[d.id] ?? 0) + 1;
      return;
    }
    case 'attack': {
      const d = ownShip(s, a.die, 'board');
      if (!canMoveDie(s, d)) fail('This ship already moved this turn');
      const opt = moveOptions(s, d.id).attacks.get(a.target);
      if (!opt) fail('Target out of range');
      spend(s, 1);
      if (opt.diagonal) markAbility(s, d);
      t.moved[d.id] = (t.moved[d.id] ?? 0) + 1;
      startCombat(s, d, die(s, a.target), opt.from);
      return;
    }
    case 'deploy': {
      const d = ownShip(s, a.die, 'scrapyard');
      if (!deployTargets(s, me).some((p) => same(p, a.to))) fail('Deploy into orbit of a planet with your cube');
      if (hasSkill(s, me, 'eager')) {
        /* Eager: deploying is free */
      } else if (t.freeDeploys > 0) t.freeDeploys--;
      else spend(s, 1);
      d.loc = { zone: 'board', ...a.to };
      return;
    }
    case 'reconfigure': {
      const d = ownShip(s, a.die);
      if (!canReconfigure(s, d)) fail(s.mode === 'community' ? 'This ship cannot be reconfigured' : 'Only ships on the map can be reconfigured');
      spend(s, 1);
      rerollNew(s, d);
      return;
    }
    case 'research': {
      if (s.mode === 'basic') fail('Basic mode has no research');
      if (s.players[me].research >= 6) fail('Research is already at 6');
      if (hasSkill(s, me, 'righteous')) fail('Righteous: you cannot gain research');
      spend(s, 1);
      gainResearch(s, me, 1);
      return;
    }
    case 'conquer': {
      const check = conquerCheck(s, me, a.planet);
      if (!check.ok) fail(check.reason ?? 'Cannot conquer');
      spend(s, 2);
      log(s, `${name(s, me)} conquers planet ${s.board.planets[a.planet].number}.`, me);
      placeCube(s, me, a.planet);
      return;
    }
    case 'endTurn': {
      endTurn(s);
      return;
    }
    case 'freeAttack': {
      const d = ownShip(s, a.die, 'board');
      if (!freeAttackTargets(s, d.id).some((x) => x.id === a.target)) fail('Target must be adjacent');
      useAbility(s, d, 1);
      startCombat(s, d, die(s, a.target), cellOf(d)!);
      return;
    }
    case 'carry': {
      const d = ownShip(s, a.die, 'board');
      if (!canMoveDie(s, d)) fail('This ship already moved this turn');
      if (!carryPassengers(s, d.id).some((x) => x.id === a.passenger)) fail('Passenger must be next to the flagship');
      const dest = carryOptions(s, d.id, a.passenger).get(key(a.to));
      if (!dest || !dest.drops.some((p) => same(p, a.drop))) fail('Invalid carry');
      if (same(a.to, a.drop)) fail('Drop the passenger next to the flagship');
      spend(s, 1);
      useAbility(s, d, 2);
      d.loc = { zone: 'board', ...a.to };
      die(s, a.passenger).loc = { zone: 'board', ...a.drop };
      t.moved[d.id] = (t.moved[d.id] ?? 0) + 1;
      return;
    }
    case 'swap': {
      const d = ownShip(s, a.die, 'board');
      const o = ownShip(s, a.other, 'board');
      if (o.id === d.id) fail('Choose another ship');
      useAbility(s, d, 3);
      [d.loc, o.loc] = [o.loc, d.loc];
      return;
    }
    case 'change': {
      const d = ownShip(s, a.die, 'board');
      if (a.value !== 3 && a.value !== 5) fail('A frigate becomes a 3 or a 5');
      useAbility(s, d, 4);
      d.value = a.value;
      (t.seen[d.id] ??= []).push(a.value);
      return;
    }
    case 'freeReconfigure': {
      const d = ownShip(s, a.die, 'board');
      useAbility(s, d, 6);
      rerollNew(s, d);
      return;
    }
    case 'composed': {
      requireSkill(s, me, 'composed');
      oncePerTurn(s, 'composed');
      loseDominance(s, me, 1);
      gainResearch(s, me, 3);
      return;
    }
    case 'ambitious': {
      requireSkill(s, me, 'ambitious');
      oncePerTurn(s, 'ambitious');
      const pl = s.players[me];
      t.actionsLeft++;
      pl.ambitionTokens++;
      if (pl.ambitionTokens >= 3) {
        pl.skills = pl.skills.filter((x) => x.id !== 'ambitious');
        pl.ambitionTokens = 0;
        s.market.skillDiscard.push('ambitious');
        log(s, `${pl.name}'s Ambitious skill is exhausted.`, me);
      }
      return;
    }
    case 'flexible': {
      requireSkill(s, me, 'flexible');
      const d = ownShip(s, a.die, 'board');
      const v = d.value + a.delta;
      if (v < 1 || v > 6) fail('Ship numbers range from 1 to 6');
      oncePerTurn(s, 'flexible');
      d.value = v;
      (t.seen[d.id] ??= []).push(v);
      return;
    }
    case 'tyrannical': {
      requireSkill(s, me, 'tyrannical-original');
      const pl = s.players[me];
      if (pl.research <= 1) fail('No research to convert');
      oncePerTurn(s, 'tyrannical');
      pl.research--;
      gainDominance(s, me, 1);
      return;
    }
    case 'tactical': {
      const original = hasSkill(s, me, 'tactical-original');
      if (!original) requireSkill(s, me, 'tactical');
      const d = ownShip(s, a.die, 'board');
      if (original && !canMoveDie(s, d)) fail('This ship already moved this turn');
      const opts = tacticalOptions(s, d.id);
      if (a.target) {
        const target = opts.attacks.find((x) => x.id === a.target);
        if (!target) fail('Target must be adjacent');
        oncePerTurn(s, 'tactical');
        if (original) t.moved[d.id] = (t.moved[d.id] ?? 0) + 1;
        startCombat(s, d, target, cellOf(d)!);
        return;
      }
      if (!a.to || !opts.moves.some((p) => same(p, a.to!))) fail('Move one space to an empty space');
      oncePerTurn(s, 'tactical');
      if (original) t.moved[d.id] = (t.moved[d.id] ?? 0) + 1;
      d.loc = { zone: 'board', ...a.to };
      return;
    }
    case 'resourceful': {
      requireSkill(s, me, 'resourceful');
      const d = ownShip(s, a.die, 'board');
      oncePerTurn(s, 'resourceful');
      destroyShip(s, d);
      t.actionsLeft++;
      return;
    }
  }
  fail(`Cannot ${(a as Action).type} now`);
}

function consumeCardPick(s: GameState) {
  const head = s.pending[0];
  if (head?.kind !== 'takeCard') return;
  head.count--;
  if (head.count <= 0) s.pending.shift();
}

function resolveCombat(s: GameState, combat: Extract<Pending, { kind: 'combat' }>) {
  const out = combatOutcome(s, combat);
  s.pending.shift();
  const att = die(s, combat.attacker.die);
  const def = die(s, combat.defender.die);
  const A = combat.attacker.player;
  const D = combat.defender.player;
  if (out.attackerWins) {
    log(s, `${name(s, A)} wins the battle (${out.attacker.total} vs ${out.defender.total}).`, A);
    destroyShip(s, def);
    s.pending.unshift({ kind: 'advance', player: A, die: att.id, to: combat.at });
    onDestroy(s, A, D);
  } else if (out.stubborn) {
    log(s, `${name(s, D)} holds firm and destroys the attacker (${out.defender.total} vs ${out.attacker.total}).`, D);
    destroyShip(s, att);
    onDestroy(s, D, A);
  } else {
    log(s, `${name(s, D)} repels the attack (${out.defender.total} vs ${out.attacker.total}).`, D);
  }
}

// ---------------------------------------------------------------------------
// Legal action enumeration (used by the AI and for UI hints)

export function legalActions(s: GameState, opts: { includeCarry?: boolean } = {}): Action[] {
  if (s.phase === 'over') return [];
  const head = s.pending[0];
  const out: Action[] = [];
  if (head) {
    switch (head.kind) {
      case 'setupRoll':
        out.push({ type: 'setupKeep' });
        if (!head.rerolled) out.push({ type: 'setupReroll' });
        break;
      case 'skillDraft':
        for (const skill of head.options) out.push({ type: 'draftSkill', skill });
        break;
      case 'placeStart':
        for (const p of s.board.planets) if (p.start && !p.cubes.length) out.push({ type: 'placeStart', planet: p.id });
        break;
      case 'combat':
        out.push({ type: 'resolveCombat' });
        for (const pl of s.players) {
          if (pl.missiles <= 0) continue;
          if (!head.attacker.missile) out.push({ type: 'missile', by: pl.id, side: 'attacker' });
          if (!head.defender.missile) out.push({ type: 'missile', by: pl.id, side: 'defender' });
        }
        break;
      case 'advance':
        out.push({ type: 'advance', move: true }, { type: 'advance', move: false });
        break;
      case 'infamy':
        for (const p of infamyTargets(s, head.player)) out.push({ type: 'infamy', planet: p.id });
        break;
      case 'takeCard': {
        const m = s.market;
        m.skillRow.forEach((_, index) => out.push({ type: 'takeCard', deck: 'skill', index }));
        m.tacticRow.forEach((_, index) => out.push({ type: 'takeCard', deck: 'tactic', index }));
        if (m.expansions > 0 && reserve(s, head.player).length) out.push({ type: 'takeCard', deck: 'expansion', index: 0 });
        break;
      }
      case 'peek':
        out.push({ type: 'peekChoice', takeTop: true }, { type: 'peekChoice', takeTop: false });
        break;
      case 'discardSkill':
        for (const sk of s.players[head.player].skills) out.push({ type: 'discardSkill', skill: sk.id });
        break;
      case 'placeExpansion':
        out.push({ type: 'placeExpansion', to: null });
        for (const to of deployTargets(s, head.player)) out.push({ type: 'placeExpansion', to });
        break;
      case 'showOfForce':
        for (const d of shipsOnBoard(s)) out.push({ type: 'showOfForce', die: d.id });
        break;
      case 'warpGate':
        for (let r = 0; r < s.board.rows; r++)
          for (let c = 0; c < s.board.cols; c++)
            if (isEmptySpace(s, { r, c }) && !head.placed.some((p) => p.r === r && p.c === c))
              out.push({ type: 'warpGate', cell: { r, c } });
        break;
      case 'changeOfHeart':
        for (const skill of new Set(s.market.skillDeck)) out.push({ type: 'changeOfHeart', skill });
        break;
      case 'unveil': {
        out.push({ type: 'unveilDone' });
        const targets = deployTargets(s, head.player);
        const rerollable = head.reorganize ? s.dice.filter((d) => d.owner === head.player && d.loc.zone !== 'reserve') : scrapyard(s, head.player);
        for (const d of rerollable) if (!head.rerolled.includes(d.id)) out.push({ type: 'unveilReroll', die: d.id });
        for (const d of scrapyard(s, head.player)) {
          if (head.reorganize && !head.rerolled.includes(d.id)) continue;
          for (const to of targets) out.push({ type: 'unveilDeploy', die: d.id, to });
        }
        break;
      }
    }
    return out.filter((a) => tryApply(s, a) !== null);
  }

  if (s.phase !== 'play' || s.turn.phase !== 'actions') return [];
  const me = s.turn.player;
  const t = s.turn;
  out.push({ type: 'endTurn' });
  const actions = t.actionsLeft;
  const pl = s.players[me];

  for (const d of shipsOnBoard(s, me)) {
    if ((actions > 0 || t.freeMoves > 0) && canMoveDie(s, d)) {
      const opts = moveOptions(s, d.id);
      for (const m of opts.moves.values()) out.push({ type: 'move', die: d.id, to: m.cell });
      if (actions > 0) for (const target of opts.attacks.keys()) out.push({ type: 'attack', die: d.id, target });
    }
    if (actions > 0 && canReconfigure(s, d)) out.push({ type: 'reconfigure', die: d.id });
    if ((hasSkill(s, me, 'tactical') || (hasSkill(s, me, 'tactical-original') && canMoveDie(s, d))) && !t.oncePerTurn.includes('tactical')) {
      const opts = tacticalOptions(s, d.id);
      for (const to of opts.moves) out.push({ type: 'tactical', die: d.id, to });
      for (const x of opts.attacks) out.push({ type: 'tactical', die: d.id, target: x.id });
    }
    if (canUseAbility(s, d)) {
      if (d.value === 1) for (const x of freeAttackTargets(s, d.id)) out.push({ type: 'freeAttack', die: d.id, target: x.id });
      if (d.value === 3) for (const o of shipsOnBoard(s, me)) if (o.id !== d.id) out.push({ type: 'swap', die: d.id, other: o.id });
      if (d.value === 4) out.push({ type: 'change', die: d.id, value: 3 }, { type: 'change', die: d.id, value: 5 });
      if (d.value === 6) out.push({ type: 'freeReconfigure', die: d.id });
      if (d.value === 2 && opts.includeCarry && actions > 0 && canMoveDie(s, d)) {
        for (const p of carryPassengers(s, d.id))
          for (const dest of carryOptions(s, d.id, p.id).values())
            for (const drop of dest.drops) out.push({ type: 'carry', die: d.id, passenger: p.id, to: dest.cell, drop });
      }
    }
    if (hasSkill(s, me, 'flexible') && !t.oncePerTurn.includes('flexible')) {
      out.push({ type: 'flexible', die: d.id, delta: 1 }, { type: 'flexible', die: d.id, delta: -1 });
    }
    if (hasSkill(s, me, 'resourceful') && !t.oncePerTurn.includes('resourceful')) {
      out.push({ type: 'resourceful', die: d.id });
    }
  }
  const eager = hasSkill(s, me, 'eager');
  const targets = deployTargets(s, me);
  for (const d of scrapyard(s, me)) {
    if (actions > 0 || t.freeDeploys > 0 || eager) for (const to of targets) out.push({ type: 'deploy', die: d.id, to });
    if (actions > 0 && canReconfigure(s, d)) out.push({ type: 'reconfigure', die: d.id });
  }
  if (s.mode !== 'basic' && actions > 0 && pl.research < 6 && !hasSkill(s, me, 'righteous')) out.push({ type: 'research' });
  if (hasSkill(s, me, 'tyrannical-original') && !t.oncePerTurn.includes('tyrannical') && pl.research > 1) out.push({ type: 'tyrannical' });
  if (actions >= 2) for (const p of s.board.planets) if (conquerCheck(s, me, p.id).ok) out.push({ type: 'conquer', planet: p.id });
  if (hasSkill(s, me, 'composed') && !t.oncePerTurn.includes('composed')) out.push({ type: 'composed' });
  if (hasSkill(s, me, 'ambitious') && !t.oncePerTurn.includes('ambitious')) out.push({ type: 'ambitious' });
  return out;
}

export { planetFreeSlots };

// ---------------------------------------------------------------------------
// Undo

/** Deterministic phase-1 actions a player may take back. Anything involving dice or cards is final. */
const UNDOABLE = new Set<Action['type']>([
  'move',
  'deploy',
  'research',
  'conquer',
  'carry',
  'swap',
  'change',
  'flexible',
  'composed',
  'tyrannical',
  'ambitious',
  'tactical',
]);

/**
 * Whether `action` (which turned `prev` into `next`) may be undone: it must be a
 * deterministic move by the current player that consumed no randomness, revealed no
 * cards and did not start a battle or end the game. Undo exists to fix misclicks,
 * never to re-roll.
 */
export function isUndoable(prev: GameState, action: Action, next: GameState): boolean {
  if (!UNDOABLE.has(action.type)) return false;
  if (action.type === 'tactical' && action.target) return false;
  if (next.rng !== prev.rng || next.phase !== 'play') return false;
  if (next.turn.number !== prev.turn.number || next.pending.length) return false;
  const m = (s: GameState) => [s.market.skillDeck.length, s.market.tacticDeck.length, s.market.skillRow.join(), s.market.tacticRow.join()].join('|');
  return m(prev) === m(next);
}
