import {
  cellAt,
  diagonals,
  isDiagonalStep,
  key,
  orbitals,
  planetFreeSlots,
  same,
  stepNeighbours,
  surrounding,
  adjacent,
} from './board';
import { effectOf } from './data';
import type { SkillEffect } from './effects';
import { rulesOf } from './rules';
import type { Cell, CombatPending, Die, GameState, OncePerTurn, Planet, PlayerId } from './types';

// ---------------------------------------------------------------------------
// Lookups

export function die(state: GameState, id: string): Die {
  const d = state.dice.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown die ${id}`);
  return d;
}

export function dieAt(state: GameState, p: Cell): Die | undefined {
  return state.dice.find((d) => d.loc.zone === 'board' && d.loc.r === p.r && d.loc.c === p.c);
}

export function cellOf(d: Die): Cell | null {
  return d.loc.zone === 'board' ? { r: d.loc.r, c: d.loc.c } : null;
}

export function shipsOnBoard(state: GameState, player?: PlayerId): Die[] {
  return state.dice.filter(
    (d) => d.loc.zone === 'board' && (player === undefined || d.owner === player),
  );
}

export function scrapyard(state: GameState, player: PlayerId): Die[] {
  return state.dice.filter((d) => d.owner === player && d.loc.zone === 'scrapyard');
}

export function reserve(state: GameState, player: PlayerId): Die[] {
  return state.dice.filter((d) => d.owner === player && d.loc.zone === 'reserve');
}

/** True when the player owns an active skill with this effect (e.g. Cerebral has the 'composed' effect). */
export function hasSkill(state: GameState, player: PlayerId, effect: SkillEffect): boolean {
  return state.players[player].skills.some((s) => s.active && effectOf(s.id) === effect);
}

/** The id of the player's card that provides an effect, for showing its name. */
export function skillCard(state: GameState, player: PlayerId, effect: SkillEffect): string | undefined {
  return state.players[player].skills.find((s) => s.active && effectOf(s.id) === effect)?.id;
}

/** Whether a once-per-turn effect has been used this turn. */
export function usedThisTurn(state: GameState, tag: OncePerTurn): boolean {
  return state.turn.oncePerTurn.includes(tag);
}

/** Cunning: one ship ability may be used a second time each turn. */
export function cunningAvailable(state: GameState, player: PlayerId): boolean {
  return hasSkill(state, player, 'cunning') && !usedThisTurn(state, 'cunning');
}

export function canUseAbility(state: GameState, d: Die): boolean {
  return !state.turn.abilityUsed[d.id] || cunningAvailable(state, d.owner);
}

/**
 * Reconfigure targets one of your ships on the map or in your scrapyard (2013 rulebook p.5).
 * The Community Edition additionally requires a value the die has not shown this turn.
 */
export function canReconfigure(state: GameState, d: Die): boolean {
  if (d.loc.zone === 'reserve') return false;
  return rulesOf(state).reconfigure === 'different' || (state.turn.seen[d.id]?.length ?? 1) < 6;
}

export function skillLimit(state: GameState, player: PlayerId): number {
  return hasSkill(state, player, 'talented') ? 5 : 3;
}

export function isEmptySpace(state: GameState, p: Cell): boolean {
  const cell = cellAt(state.board, p);
  return !!cell && cell.kind === 'space' && !dieAt(state, p);
}

// ---------------------------------------------------------------------------
// Movement

export function movementRange(state: GameState, d: Die): number {
  return d.value + (hasSkill(state, d.owner, 'agile') ? 1 : 0);
}

export interface MoveOptions {
  /** Reachable empty spaces, keyed by "r,c". `diagonal` means the interceptor ability is needed. */
  moves: Map<string, { cell: Cell; steps: number; diagonal: boolean }>;
  /** Attackable enemy dice, keyed by die id, with the space the attack is launched from. */
  attacks: Map<string, { from: Cell; at: Cell; diagonal: boolean }>;
}

function reach(state: GameState, start: Cell, range: number, diagonal: boolean, ignore: Cell[] = []) {
  const steps = new Map<string, { cell: Cell; steps: number; usedDiagonal: boolean }>();
  steps.set(key(start), { cell: start, steps: 0, usedDiagonal: false });
  const queue: Cell[] = [start];
  const passable = (p: Cell) => {
    const cell = cellAt(state.board, p);
    if (!cell || cell.kind !== 'space') return false;
    if (ignore.some((x) => same(x, p))) return true;
    return !dieAt(state, p);
  };
  while (queue.length) {
    const cur = queue.shift()!;
    const info = steps.get(key(cur))!;
    if (info.steps >= range) continue;
    for (const nb of stepNeighbours(state, cur, diagonal)) {
      if (steps.has(key(nb)) || !passable(nb)) continue;
      steps.set(key(nb), {
        cell: nb,
        steps: info.steps + 1,
        usedDiagonal: info.usedDiagonal || isDiagonalStep(cur, nb),
      });
      queue.push(nb);
    }
  }
  return steps;
}

export function canMoveDie(state: GameState, d: Die): boolean {
  return (
    d.loc.zone === 'board' &&
    ((state.turn.moved[d.id] ?? 0) === 0 || hasSkill(state, d.owner, 'steadfast'))
  );
}

export function moveOptions(state: GameState, dieId: string): MoveOptions {
  const d = die(state, dieId);
  const start = cellOf(d);
  const result: MoveOptions = { moves: new Map(), attacks: new Map() };
  if (!start) return result;
  const range = movementRange(state, d);
  const passes: boolean[] = [false];
  if (d.value === 5 && canUseAbility(state, d)) passes.push(true);

  for (const diagonal of passes) {
    const reached = reach(state, start, range, diagonal);
    for (const [k, info] of reached) {
      if (info.steps === 0 || result.moves.has(k)) continue;
      result.moves.set(k, { cell: info.cell, steps: info.steps, diagonal });
    }
    for (const info of reached.values()) {
      if (info.steps >= range) continue;
      for (const nb of stepNeighbours(state, info.cell, diagonal)) {
        const target = dieAt(state, nb);
        if (!target || target.owner === d.owner || result.attacks.has(target.id)) continue;
        result.attacks.set(target.id, { from: info.cell, at: nb, diagonal });
      }
    }
  }
  return result;
}

/**
 * Destinations for a flagship carrying `passenger`, and where the passenger may be dropped.
 * `range` defaults to the flagship's movement; Tactical transports exactly 1 space.
 */
export function carryOptions(state: GameState, flagshipId: string, passengerId: string, range?: number) {
  const flag = die(state, flagshipId);
  const passenger = die(state, passengerId);
  const start = cellOf(flag);
  const pCell = cellOf(passenger);
  const result = new Map<string, { cell: Cell; drops: Cell[] }>();
  if (!start || !pCell) return result;
  range ??= movementRange(state, flag);
  const reached = reach(state, start, range, false, [pCell]);
  for (const [k, info] of reached) {
    // The flagship must move, but may fly out and back to its own space (designer ruling,
    // BGG thread 1074052): that needs 2 movement and one free neighbouring space.
    if (info.steps === 0 && (range < 2 || reached.size < 2)) continue;
    const drops = surrounding(state.board, info.cell).filter((q) => {
      const cell = cellAt(state.board, q);
      if (!cell || cell.kind !== 'space') return false;
      const occupant = dieAt(state, q);
      return !occupant || occupant.id === flag.id || occupant.id === passenger.id;
    });
    if (drops.length) result.set(k, { cell: info.cell, drops });
  }
  return result;
}

export function carryPassengers(state: GameState, flagshipId: string): Die[] {
  const flag = die(state, flagshipId);
  const start = cellOf(flag);
  if (!start) return [];
  return surrounding(state.board, start)
    .map((p) => dieAt(state, p))
    .filter((d): d is Die => !!d && d.owner === flag.owner);
}

/** Enemy ships a battlestation can attack with its free attack. */
export function freeAttackTargets(state: GameState, dieId: string): Die[] {
  const d = die(state, dieId);
  const start = cellOf(d);
  if (!start) return [];
  return stepNeighbours(state, start, false)
    .map((p) => dieAt(state, p))
    .filter((x): x is Die => !!x && x.owner !== d.owner);
}

// ---------------------------------------------------------------------------
// Setup and cards

/** Empty orbital positions of a starting planet. */
export function startSlots(state: GameState, planetId: number): Cell[] {
  return orbitals(state.board, state.board.planets[planetId]).filter((p) => isEmptySpace(state, p));
}

/** Whether there is any card the player could take from the market. */
export function canTakeAnyCard(state: GameState, player: PlayerId): boolean {
  const m = state.market;
  return m.skillRow.length > 0 || m.tacticRow.length > 0 || (m.expansions > 0 && reserve(state, player).length > 0);
}

// ---------------------------------------------------------------------------
// Deploy

export function deployTargets(state: GameState, player: PlayerId): Cell[] {
  const targets = new Map<string, Cell>();
  for (const planet of state.board.planets) {
    if (!planet.cubes.includes(player)) continue;
    for (const p of orbitals(state.board, planet)) {
      if (isEmptySpace(state, p)) targets.set(key(p), p);
    }
  }
  if (hasSkill(state, player, 'stealthy')) {
    for (let r = 0; r < state.board.rows; r++) {
      for (let c = 0; c < state.board.cols; c++) {
        const p = { r, c };
        if (!isEmptySpace(state, p)) continue;
        if (adjacent(state.board, p).some((q) => dieAt(state, q))) continue;
        targets.set(key(p), p);
      }
    }
  }
  return [...targets.values()];
}

// ---------------------------------------------------------------------------
// Conquer

export interface ConquerCheck {
  ok: boolean;
  sum: number;
  target: number;
  ships: Die[];
  reason?: string;
}

export function conquerCheck(state: GameState, player: PlayerId, planetId: number): ConquerCheck {
  const planet = state.board.planets[planetId];
  const own = planet.cubes.filter((x) => x === player).length;
  let target = planet.number;
  const fail = (reason: string, ships: Die[] = [], sum = 0): ConquerCheck => ({
    ok: false,
    sum,
    target,
    ships,
    reason,
  });

  if (planetFreeSlots(planet) <= 0) return fail('No empty cube location');
  if (own > 0) {
    // Quantum Entanglement: only once you hold every planet that still has room.
    const blocked = state.board.planets.some(
      (p) => planetFreeSlots(p) > 0 && !p.cubes.includes(player),
    );
    if (blocked) return fail('You already have a cube here');
    target += 3 * own;
  }

  const spaces = [...orbitals(state.board, planet)];
  if (hasSkill(state, player, 'ingenious')) spaces.push(...diagonals(state.board, planet));
  const ships = spaces.map((p) => dieAt(state, p)).filter((d): d is Die => !!d && d.owner === player);
  const sum = ships.reduce((a, d) => a + d.value, 0);
  if (!ships.length) return fail('No ships in orbit', ships, sum);

  const sums = [sum];
  const p = state.players[player];
  if (hasSkill(state, player, 'tyrannical')) sums.push(sum + p.dominance);
  if (hasSkill(state, player, 'pioneering')) for (const d of ships) sums.push(sum - d.value + p.research);
  const targets = [target];
  if (hasSkill(state, player, 'intelligent')) targets.push(target - 1, target + 1);

  const ok = sums.some((s) => targets.includes(s));
  return { ok, sum, target, ships, reason: ok ? undefined : `Orbit totals ${sum}, needs ${target}` };
}

/** Any planet without your cube; if none has room, Quantum Entanglement allows your own planets. */
export function infamyTargets(state: GameState, player: PlayerId): Planet[] {
  const open = state.board.planets.filter((p) => planetFreeSlots(p) > 0);
  const fresh = open.filter((p) => !p.cubes.includes(player));
  return fresh.length ? fresh : open;
}

export interface TacticalOptions {
  /** `diagonal` steps need the Interceptor's Maneuver ability. */
  moves: { cell: Cell; diagonal: boolean }[];
  attacks: { die: Die; diagonal: boolean }[];
}

/**
 * Tactical: one step (or an attack on an adjacent enemy) for a single ship. An Interceptor that
 * still has its ability may step or attack diagonally (forum consensus, BGG thread 2433096).
 */
export function tacticalOptions(state: GameState, dieId: string): TacticalOptions {
  const d = die(state, dieId);
  const start = cellOf(d);
  const result: TacticalOptions = { moves: [], attacks: [] };
  if (!start) return result;
  const straight = stepNeighbours(state, start, false);
  const near = straight.map((cell) => ({ cell, diagonal: false }));
  if (d.value === 5 && canUseAbility(state, d)) {
    for (const cell of stepNeighbours(state, start, true))
      if (!straight.some((p) => same(p, cell))) near.push({ cell, diagonal: true });
  }
  for (const { cell, diagonal } of near) {
    const target = dieAt(state, cell);
    if (!target && isEmptySpace(state, cell)) result.moves.push({ cell, diagonal });
    else if (target && target.owner !== d.owner) result.attacks.push({ die: target, diagonal });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Combat

export interface CombatPart {
  label: string;
  value: number;
}

export interface CombatTotal {
  roll: number;
  total: number;
  parts: CombatPart[];
}

/**
 * Combat roll pipeline (see docs/OPEN-QUESTIONS.md #10):
 * roll (Brutal: lower of two) → set effects (Rational 3, Plan Ahead 1) → missile (1) → modifiers.
 */
export function combatTotal(state: GameState, combat: CombatPending, side: 'attacker' | 'defender'): CombatTotal {
  const s = combat[side];
  const p = state.players[s.player];
  const parts: CombatPart[] = [];
  let roll = s.dice.length > 1 ? Math.min(...s.dice) : s.dice[0];
  let label = s.dice.length > 1 ? 'Brutal roll' : 'Roll';
  if (hasSkill(state, s.player, 'rational')) {
    roll = 3;
    label = 'Rational';
  }
  if (p.planAhead > 0) {
    roll = 1;
    label = 'Plan Ahead';
  }
  if (s.missile) {
    roll = 1;
    label = 'Missile';
  }
  parts.push({ label, value: roll });
  parts.push({ label: 'Ship', value: s.ship });
  if (hasSkill(state, s.player, 'ferocious')) parts.push({ label: 'Ferocious', value: -1 });
  if (hasSkill(state, s.player, 'strategic')) {
    const spaces = side === 'attacker' ? [combat.from, combat.at] : [combat.at];
    const supported = spaces.some((sp) =>
      adjacent(state.board, sp).some((q) => {
        const d = dieAt(state, q);
        return d && d.owner === s.player && d.id !== s.die;
      }),
    );
    if (supported) parts.push({ label: 'Strategic', value: -2 });
  }
  const total = parts.reduce((a, x) => a + x.value, 0);
  return { roll, total, parts };
}

export function combatOutcome(state: GameState, combat: CombatPending) {
  const a = combatTotal(state, combat, 'attacker');
  const d = combatTotal(state, combat, 'defender');
  const tie = a.total === d.total;
  const stubborn = tie && hasSkill(state, combat.defender.player, 'stubborn');
  const attackerWins = a.total < d.total || (tie && !stubborn);
  return { attacker: a, defender: d, attackerWins, stubborn };
}

/** Probability that an attacker ship of value `a` beats a defender of value `d` with plain dice. */
export function attackOdds(a: number, d: number): number {
  let wins = 0;
  for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (a + x <= d + y) wins++;
  return wins / 36;
}
