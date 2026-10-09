import {
  attackOdds,
  breakthroughAt,
  cellOf,
  conquerCheck,
  distance,
  grid,
  movementRange,
  orbitals,
  planetFreeSlots,
  rulesOf,
  scrapyard,
  shipReach,
  shipsByIndex,
  shipsOnBoard,
  skillLimit,
  type Die,
  type GameState,
  type Planet,
  type PlayerId,
  type ShipReach,
} from '@quantum/engine';
import { storedTactics } from './patient';

/**
 * Position evaluation for levels 2 and up, in "cube points": one quantum cube is worth CUBE.
 *
 * Unlike the level-1 heuristic it knows whose turn comes next, measures reach with real
 * paths (planets and ships block), values dominance as progress towards Infamy, and counts
 * what each player's ships risk from the enemy ships that can actually reach them.
 */

export const CUBE = 1000;
export const WIN = 1e6;

/** Value of each dominance level (index = dominance). Reaching 6 is Infamy, worth a cube. */
const DOMINANCE = [0, 0, 60, 150, 290, 500];
const SHIP_ON_BOARD = 70;
const SHIP_IN_SCRAPYARD = 30;
const MISSILE = 40;
const SKILL = 110;
/** A Tactic stored with Patient: worth keeping when playing it now would gain less. */
const STORED_TACTIC = 50;
/** A card still to be taken at the end of this turn (conquest or research breakthrough). */
const CARD = 120;

/**
 * Share of a cube a planet is worth when conquering it takes this many actions from now
 * (the Conquer action itself costs 2). Three actions fit in one turn, four or more need two.
 */
const PROGRESS: Record<number, number> = { 2: 0.8, 3: 0.45, 4: 0.28, 5: 0.18 };
/** Chance that a reconfigure-based plan works out (about 1 in 5 per roll, two tries). */
const RECONFIGURE_ODDS = 0.4;
/** Share of a cube for an orbit that makes up the whole target sum (less for part of it), on top of the plan. */
const ORBIT_PROGRESS = 0.12;
/** Share of a cube for a ship two moves from a planet's orbit; less the further it is (below one reacher's presence). */
const APPROACH = 0.024;

interface Ctx {
  s: GameState;
  /** The player who moves next: they act before anyone can react. */
  mover: PlayerId;
  /** Empty spaces each ship on the map can reach with one move (marked by board cell index, r * cols + c), by die id. */
  reach: Map<string, ShipReach>;
  /** Chance each ship is destroyed by an enemy before its owner moves again, by die id. */
  kill: Map<string, number>;
  /** Expected cube points each player loses to attacks on their ships. */
  exposure: number[];
  /** The ships on the map by board cell index, and by player. */
  at: (Die | undefined)[];
  fleets: Die[][];
}

/**
 * Scores `s` for `me`: my value minus the strongest rival's (and a little of the others'). `mover`
 * is who moves next, if not the usual (see nextMover).
 */
export function evaluate(s: GameState, me: PlayerId, mover = nextMover(s, me)): number {
  if (s.phase === 'over') return s.winner === me ? WIN : -WIN;
  const ctx = context(s, mover);
  const values = s.players.map((p) => playerValue(ctx, p.id));
  const rivals = values.filter((_, i) => i !== me);
  const top = Math.max(...rivals);
  const rest = rivals.reduce((a, b) => a + b, 0) - top;
  return values[me] - top - 0.25 * rest;
}

/**
 * Who moves next, from the evaluating player's point of view. A position in my own turn is
 * scored as if I end my turn now (the search decides whether to do more first).
 */
function nextMover(s: GameState, me: PlayerId): PlayerId {
  const t = s.turn;
  if (t.phase === 'actions' && t.player !== me) return t.player;
  if (s.players[t.player].bonusTurns.length) return t.player;
  return (t.player + 1) % s.players.length;
}

function context(s: GameState, mover: PlayerId): Ctx {
  const ships = shipsOnBoard(s);
  const at = shipsByIndex(s);
  const fleets: Die[][] = s.players.map(() => []);
  for (const d of ships) fleets[d.owner].push(d);
  const reach = new Map<string, ShipReach>();
  const kill = new Map<string, number>();
  const exposure = s.players.map(() => 0);
  for (const d of ships) {
    const opts = shipReach(s, d, at);
    reach.set(d.id, opts);
    for (const target of opts.attacks) {
      // The next mover attacks first; later players only if the target is still there.
      const odds = attackOdds(d.value, target.value) * (d.owner === mover ? 1 : 0.5);
      kill.set(target.id, Math.max(kill.get(target.id) ?? 0, odds));
    }
  }
  for (const d of ships) {
    const k = kill.get(d.id) ?? 0;
    if (!k) continue;
    // Losing a ship costs the ship, a dominance step, and gives a rival one (maybe Infamy).
    const pl = s.players[d.owner];
    const attacker = strongestAttackerDominance(s, d.owner);
    const loss = SHIP_ON_BOARD - SHIP_IN_SCRAPYARD + dominanceStep(pl.dominance - 1) + dominanceGain(attacker);
    exposure[d.owner] += k * loss * (d.owner === mover ? 0.3 : 0.75);
  }
  return { s, mover, reach, kill, exposure, at, fleets };
}

/** Value lost by dropping from `to + 1` to `to` dominance. */
function dominanceStep(to: number): number {
  return to < 1 ? 0 : DOMINANCE[to + 1] - DOMINANCE[to];
}

/** Value gained by rising one step from `from` dominance; 5 → 6 is Infamy. */
function dominanceGain(from: number): number {
  return from >= 5 ? CUBE + DOMINANCE[1] - DOMINANCE[5] : DOMINANCE[from + 1] - DOMINANCE[from];
}

function strongestAttackerDominance(s: GameState, victim: PlayerId): number {
  return Math.max(...s.players.filter((p) => p.id !== victim).map((p) => p.dominance));
}

function playerValue(ctx: Ctx, p: PlayerId): number {
  const { s } = ctx;
  const pl = s.players[p];
  const cards = !!rulesOf(s).cards;
  let v = -pl.cubesLeft * CUBE;
  v += DOMINANCE[Math.min(pl.dominance, 5)];
  if (cards) {
    const at = breakthroughAt(s, p);
    v += CARD * 0.7 * Math.min(1, (pl.research - 1) / Math.max(1, at - 1));
    if (s.turn.player === p && s.turn.phase === 'actions') v += s.turn.conquests * CARD;
    // Cards already earned but taken later: an Infamy cube on another player's turn, or picks
    // carried into a Momentum turn.
    if (s.turn.phase === 'actions') v += (s.turn.offTurnCubes ?? []).filter((x) => x === p).length * CARD;
    v += (pl.carriedPicks ?? 0) * CARD;
  }
  v += Math.min(pl.skills.length, skillLimit(s, p)) * SKILL;
  v += storedTactics(s, p) * STORED_TACTIC;
  v += pl.missiles * MISSILE;
  v += ctx.fleets[p].length * SHIP_ON_BOARD;
  v += scrapyard(s, p).length * SHIP_IN_SCRAPYARD;
  v -= ctx.exposure[p];
  v += conquestPotential(ctx, p);
  return v;
}

/** The best planets this player is working towards: best + a little of the next two. */
function conquestPotential(ctx: Ctx, p: PlayerId): number {
  const values = ctx.s.board.planets.map((planet) => planetPotential(ctx, p, planet)).sort((a, b) => b - a);
  return (values[0] ?? 0) + 0.35 * (values[1] ?? 0) + 0.15 * (values[2] ?? 0);
}

function planetPotential(ctx: Ctx, p: PlayerId, planet: Planet): number {
  const { s } = ctx;
  if (planetFreeSlots(planet) <= 0) return 0;
  // A planet with my cube is only open again through Quantum Entanglement.
  if (planet.cubes.includes(p) && s.board.planets.some((q) => planetFreeSlots(q) > 0 && !q.cubes.includes(p))) return 0;
  const check = conquerCheck(s, p, planet.id);
  const mover = ctx.mover === p;

  if (check.ok) {
    // Still my turn with the actions to conquer: nobody can stop it.
    const t = s.turn;
    if (t.player === p && t.phase === 'actions' && !s.pending.length && t.actionsLeft >= 2) return CUBE * 0.95;
    if (mover) return CUBE * PROGRESS[2];
    // The others move first: any orbiting ship they destroy breaks the sum.
    const safe = check.ships.reduce((a, d) => a * (1 - (ctx.kill.get(d.id) ?? 0)), 1);
    return CUBE * PROGRESS[2] * (0.35 + 0.55 * safe);
  }

  const { sum, target, ships: inOrbit } = check;
  const gap = target - sum;
  const { cols, space, cells } = grid(s.board);
  const empty = orbitals(s.board, planet)
    .map((c) => c.r * cols + c.c)
    .filter((i) => space[i] && !ctx.at[i]);
  const reaches = (d: Die) => empty.some((i) => ctx.reach.get(d.id)?.moves[i]);
  const outside = ctx.fleets[p].filter((d) => !inOrbit.includes(d));
  const reachers = outside.filter(reaches);

  let best = 0;
  const option = (actions: number, odds = 1) => (best = Math.max(best, PROGRESS[actions] * odds));
  // One ship of the right value flies in.
  if (reachers.some((d) => d.value === gap)) option(3);
  // One orbiting ship flies off and leaves the right sum.
  if (inOrbit.some((d) => sum - d.value === target && (ctx.reach.get(d.id)?.count ?? 0) > 0)) option(3);
  // Reconfigure an orbiting ship to the missing value.
  for (const d of inOrbit) {
    const need = target - (sum - d.value);
    if (need >= 1 && need <= 6 && need !== d.value) option(3, RECONFIGURE_ODDS);
  }
  // Two ships fly in to fill the gap.
  if (empty.length >= 2) {
    for (let i = 0; i < reachers.length; i++)
      for (let j = i + 1; j < reachers.length; j++) if (reachers[i].value + reachers[j].value === gap) option(4);
  }
  // Any ship flies in and is reconfigured to fit (one die covers a gap of at most 6).
  if (reachers.length && gap >= 1 && gap <= 6) option(4, RECONFIGURE_ODDS);
  // Two ships fly in, one of them reconfigured to fit.
  if (empty.length >= 2 && reachers.length >= 2 && gap >= 2 && gap <= 12) option(5, RECONFIGURE_ODDS);

  // Progress: ships already in orbit are part of the sum, worth more the more of it they make up.
  // An orbit over the target has to shed ships first, so it counts for nothing.
  const progress = gap > 0 ? ORBIT_PROGRESS * (sum / target) : 0;
  // Presence: ships that could join the orbit are a start even without a plan yet.
  const presence = 0.015 * Math.min(reachers.length, 3);
  // Approach: a planet no ship reaches in one move is still worth heading for, a little more the
  // fewer moves it takes, so that a distant last planet doesn't leave every move scoring the same.
  let approach = 0;
  if (!inOrbit.length && !reachers.length && empty.length) {
    for (const d of outside) {
      const from = cellOf(d);
      if (!from) continue;
      const moves = Math.ceil(Math.min(...empty.map((i) => distance(from, cells[i], s.board))) / Math.max(1, movementRange(s, d)));
      approach = Math.max(approach, APPROACH / Math.max(2, moves));
    }
  }
  const value = CUBE * (Math.max(best, presence, approach) + progress);
  return mover ? value : value * 0.8;
}
