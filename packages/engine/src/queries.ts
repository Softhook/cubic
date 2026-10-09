/** Read-only questions about a state: movement, deploying, conquering, combat totals… */
import {
  cellAt,
  diagonals,
  delta,
  grid,
  type Grid,
  key,
  linked,
  orbitals,
  planetFreeSlots,
  same,
  spaces,
  stepNeighbours,
  surrounding,
} from './board';
import { card, effectOf } from './data';
import { cellOf, die, dieAt, isEmptySpace, reserve } from './lookups';
import { rulesOf } from './rules';
import { activeSkills, anySkill, ruleOf, skillRules, type ActiveSkill, type CombatPart } from './skillRules';
import type { Cell, CombatPending, CombatRole, Die, GameState, OncePerTurn, Planet, PlayerId, TurnState } from './types';

export type { CombatPart } from './skillRules';

// ---------------------------------------------------------------------------
// Turn limits

/** Whether a once-per-turn effect has been used this turn. */
export function usedThisTurn(state: GameState, tag: OncePerTurn): boolean {
  return state.turn.oncePerTurn.includes(tag);
}

/** Cunning: one ship ability may be used a second time each turn. */
export function cunningAvailable(state: GameState, player: PlayerId): boolean {
  return anySkill(state, player, (r) => r.abilityTwice) && !usedThisTurn(state, 'cunning');
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

/**
 * Unlike other skills, a held Talented raises the limit at once, before it becomes active at the end
 * of the turn, so taking it as a 4th skill forces no discard (RULE-SUGGESTIONS #49).
 */
export function skillLimit(state: GameState, player: PlayerId): number {
  return Math.max(3, ...state.players[player].skills.map((s) => ruleOf(s.id).skillLimit ?? 0));
}

/** Research needed for a breakthrough at the end of the turn. */
export function breakthroughAt(state: GameState, player: PlayerId): number {
  return Math.min(6, ...skillRules(state, player).map((r) => r.breakthroughAt ?? 6));
}

/** Dominance needed for Infamy (normally 6, or 4 with Prideful). */
export function infamyAt(state: GameState, player: PlayerId): number {
  return Math.min(6, ...skillRules(state, player).map((r) => r.infamyAt ?? 6));
}

/**
 * Whether no more actions may be taken this turn, only ending it (or playing a stored Tactic): after
 * the CE Curious extra action or a stored Tactic (Patient).
 */
export function actionsClosed(t: TurnState): boolean {
  return !!(t.curiousUsed || t.storedTacticPlayed);
}

/** CE Curious: whether the player may take an additional Move or Research action. */
export function canCurious(state: GameState, player: PlayerId): boolean {
  const t = state.turn;
  return (
    anySkill(state, player, (r) => r.peacefulExtraAction) &&
    player === t.player &&
    t.phase === 'actions' &&
    !t.attacked &&
    (t.conquered ?? 0) === 0 &&
    !t.curiousUsed
  );
}

/** Patient: whether the player can play a stored Tactic at the end of their turn. */
export function canPlayStoredTactic(state: GameState, player: PlayerId): boolean {
  const t = state.turn;
  const pl = state.players[player];
  return (
    anySkill(state, player, (r) => r.storeTactics) &&
    player === t.player &&
    t.phase === 'actions' &&
    !t.storedTacticPlayed &&
    (pl.storedTactics?.length ?? 0) > 0
  );
}

/** Profiteering: whether the current card pick may be taken as a missile instead. */
export function canProfiteer(state: GameState): boolean {
  const head = state.pending[0];
  return head?.kind === 'takeCard' && (head.conquer ?? 0) > 0 && anySkill(state, head.player, (r) => r.missileForConquest);
}

/** Whether the player can gain research at all. */
export function canGainResearch(state: GameState, player: PlayerId): boolean {
  return !anySkill(state, player, (r) => r.noResearch);
}

/** Whether deploying is free for the player. */
export function deploysFree(state: GameState, player: PlayerId): boolean {
  return anySkill(state, player, (r) => r.freeDeploy);
}

/** Scrappy: whether the player whose turn it is may re-roll the ship rolled by the last action (core.ts rollShip). */
export function canScrappy(state: GameState): boolean {
  return !!state.turn.scrappy;
}

// ---------------------------------------------------------------------------
// Movement

export function movementRange(state: GameState, d: Die): number {
  return d.value + skillRules(state, d.owner).reduce((n, r) => n + (r.movement ?? 0), 0);
}

export interface MoveOptions {
  /** Reachable empty spaces, keyed by "r,c". `diagonal` means the interceptor ability is needed. */
  moves: Map<string, { cell: Cell; steps: number; diagonal: boolean }>;
  /** Attackable enemy dice, keyed by die id, with the space the attack is launched from. */
  attacks: Map<string, { from: Cell; at: Cell; diagonal: boolean }>;
}

/**
 * Spaces a ship can reach within `range` steps, with the fewest steps to each, by board cell index
 * (see board.ts grid): this runs for every ship in every position the AI scores. `found` lists
 * them in the order they were first reached, the start first. `ignore` lists occupied spaces
 * treated as empty. With `through` (Devious), the ship may pass through that player's enemies'
 * ships at no cost; such spaces are marked in `passing`, as it can't stop there.
 */
function reach(state: GameState, start: Cell, range: number, diagonal: boolean, ignore: Cell[] = [], through?: PlayerId, at = shipsByIndex(state)) {
  const g = grid(state.board);
  const ignored = ignore.map((p) => p.r * g.cols + p.c);
  const steps = new Int32Array(g.size).fill(-1);
  const passing = new Uint8Array(g.size);
  const from = start.r * g.cols + start.c;
  const found: number[] = [from];
  steps[from] = 0;
  const gate = gates(state, g);
  const near = diagonal ? g.around : g.ortho;
  /** 0 = blocked, 1 = free, 2 = passed through (Devious). */
  const entry = (i: number): number => {
    if (!g.space[i]) return 0;
    const d = at[i];
    if (!d || (ignored.length && ignored.includes(i))) return 1;
    return through !== undefined && d.owner !== through ? 2 : 0;
  };
  // 0-1 breadth-first search: free passes go to the front of the queue. Without them it is a plain BFS.
  const queue: number[] = [from];
  let head = 0;
  const visit = (cur: number, nb: number) => {
    const kind = entry(nb);
    if (!kind) return;
    const cost = steps[cur] + (kind === 2 ? 0 : 1);
    if (steps[nb] >= 0 && steps[nb] <= cost) return;
    if (steps[nb] < 0) found.push(nb);
    steps[nb] = cost;
    passing[nb] = kind === 2 ? 1 : 0;
    if (kind === 2) {
      if (head > 0) queue[--head] = nb;
      else queue.unshift(nb);
    } else queue.push(nb);
  };
  while (head < queue.length) {
    const cur = queue[head++];
    if (steps[cur] >= range) continue;
    for (const nb of near[cur]) visit(cur, nb);
    const partner = gate(cur);
    if (partner >= 0) visit(cur, partner);
  }
  return { found, steps, passing };
}

/** The Warp Gate partner of a cell index, or -1 (see board.ts stepNeighbours). */
function gates(state: GameState, g: Grid): (i: number) => number {
  if (state.gates.length !== 2) return () => -1;
  const [a, b] = state.gates.map((p) => p.r * g.cols + p.c);
  return (i) => (i === a ? b : i === b ? a : -1);
}

export function canMoveDie(state: GameState, d: Die): boolean {
  return (
    d.loc.zone === 'board' &&
    ((state.turn.moved[d.id] ?? 0) === 0 || anySkill(state, d.owner, (r) => r.moveRepeatedly))
  );
}

export function moveOptions(state: GameState, dieId: string): MoveOptions {
  const { cells } = grid(state.board);
  const { moves, attacks } = moveIndexes(state, dieId);
  const result: MoveOptions = { moves: new Map(), attacks: new Map() };
  for (const [i, m] of moves) result.moves.set(key(cells[i]), { cell: cells[i], ...m });
  for (const [id, x] of attacks) result.attacks.set(id, { from: cells[x.from], at: cells[x.at], diagonal: x.diagonal });
  return result;
}

/** The ships on the map by board cell index (see board.ts grid), for moveIndexes. */
export function shipsByIndex(state: GameState): (Die | undefined)[] {
  const cols = state.board.cols;
  const at: (Die | undefined)[] = [];
  for (const d of state.dice) if (d.loc.zone === 'board') at[d.loc.r * cols + d.loc.c] = d;
  return at;
}

/**
 * moveOptions by board cell index (see board.ts grid), for code that asks about many ships and positions: the AI.
 * It may pass the ship itself and `at` (shipsByIndex), to look them up once for all ships.
 */
export function moveIndexes(state: GameState, ship: string | Die, at = shipsByIndex(state)) {
  const d = typeof ship === 'string' ? die(state, ship) : ship;
  const result = {
    moves: new Map<number, { steps: number; diagonal: boolean }>(),
    attacks: new Map<string, { from: number; at: number; diagonal: boolean }>(),
  };
  const start = cellOf(d);
  if (!start) return result;
  const range = movementRange(state, d);
  const passes: boolean[] = [false];
  if (d.value === 5 && canUseAbility(state, d)) passes.push(true);

  // Devious: normal moves only, not Transport or the Tactical step (decided 2026-10-03, OPEN-QUESTIONS #65).
  const through = anySkill(state, d.owner, (r) => r.moveThroughEnemies) ? d.owner : undefined;
  const g = grid(state.board);
  const gate = gates(state, g);
  for (const diagonal of passes) {
    const { found, steps, passing } = reach(state, start, range, diagonal, [], through, at);
    for (const i of found) {
      if (steps[i] === 0 || passing[i] || result.moves.has(i)) continue;
      result.moves.set(i, { steps: steps[i], diagonal });
    }
    const near = diagonal ? g.around : g.ortho;
    const attack = (from: number, nb: number) => {
      const target = at[nb];
      if (!target || target.owner === d.owner || result.attacks.has(target.id)) return;
      result.attacks.set(target.id, { from, at: nb, diagonal });
    };
    for (const i of found) {
      if (steps[i] >= range || passing[i]) continue;
      for (const nb of near[i]) attack(i, nb);
      const partner = gate(i);
      if (partner >= 0) attack(i, partner);
    }
  }
  return result;
}

export interface ShipReach {
  /** 1 on each empty space one move reaches, by board cell index (see board.ts grid). */
  moves: Uint8Array;
  /** How many spaces are marked in `moves`. */
  count: number;
  /** The enemy ships it can attack. */
  attacks: Die[];
}

/** Scratch space for shipReach's search, reused: it runs for every ship in every position the AI scores. */
let STEPS = new Int32Array(0);
let QUEUE = new Int32Array(0);

/**
 * Where a ship can go with one move: the same spaces and targets as moveIndexes, without the steps
 * to each, for the AI's evaluation. `at` is shipsByIndex(state).
 */
export function shipReach(state: GameState, d: Die, at: (Die | undefined)[]): ShipReach {
  const g = grid(state.board);
  const result: ShipReach = { moves: new Uint8Array(g.size), count: 0, attacks: [] };
  const start = cellOf(d);
  if (!start) return result;
  if (anySkill(state, d.owner, (r) => r.moveThroughEnemies)) {
    const opts = moveIndexes(state, d, at);
    for (const i of opts.moves.keys()) result.moves[i] = 1;
    result.count = opts.moves.size;
    for (const id of opts.attacks.keys()) result.attacks.push(die(state, id));
    return result;
  }
  if (STEPS.length < g.size) {
    STEPS = new Int32Array(g.size);
    QUEUE = new Int32Array(g.size);
  }
  const range = movementRange(state, d);
  const from = start.r * g.cols + start.c;
  const [gateA, gateB] = state.gates.length === 2 ? state.gates.map((p) => p.r * g.cols + p.c) : [-1, -1];
  const diagonals = d.value === 5 && canUseAbility(state, d);
  for (let pass = 0; pass < (diagonals ? 2 : 1); pass++) {
    const near = pass ? g.around : g.ortho;
    // Plain breadth-first search: without Devious every step costs 1.
    STEPS.fill(-1, 0, g.size);
    STEPS[from] = 0;
    QUEUE[0] = from;
    let head = 0;
    let tail = 1;
    while (head < tail) {
      const cur = QUEUE[head++];
      const steps = STEPS[cur];
      if (steps >= range) continue;
      const list = near[cur];
      for (let k = 0; k <= list.length; k++) {
        const nb = k < list.length ? list[k] : cur === gateA ? gateB : cur === gateB ? gateA : -1;
        if (nb < 0) continue;
        const ship = at[nb];
        if (ship) {
          if (ship.owner !== d.owner && !result.attacks.includes(ship)) result.attacks.push(ship);
          continue;
        }
        if (STEPS[nb] >= 0 || !g.space[nb]) continue;
        STEPS[nb] = steps + 1;
        QUEUE[tail++] = nb;
        if (!result.moves[nb]) {
          result.moves[nb] = 1;
          result.count++;
        }
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
  const { cells } = grid(state.board);
  const { found, steps } = reach(state, start, range, false, [pCell]);
  for (const i of found) {
    // The flagship must move, but may fly out and back to its own space (designer ruling,
    // BGG thread 1074052): that needs 2 movement and one free neighbouring space.
    if (steps[i] === 0 && (range < 2 || found.length < 2)) continue;
    const cell = cells[i];
    const drops = surrounding(state.board, cell).filter((q) => {
      const cell = cellAt(state.board, q);
      if (!cell || cell.kind !== 'space') return false;
      const occupant = dieAt(state, q);
      return !occupant || occupant.id === flag.id || occupant.id === passenger.id;
    });
    if (drops.length) result.set(key(cell), { cell, drops });
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

/**
 * Nomadic (Original): empty orbital positions of the planets on the tiles next to the planet the
 * ship orbits. "Next to" means the 4 orthogonally adjacent tiles (designer, BGG thread 1182319).
 */
export function nomadicTargets(state: GameState, dieId: string): Cell[] {
  const at = cellOf(die(state, dieId));
  if (!at) return [];
  const home = state.board.planets.find((p) => orbitals(state.board, p).some((q) => same(q, at)));
  if (!home) return [];
  // Planets sit at the centre of their 3×3 tile, so planets on neighbouring tiles are 3 spaces away.
  const near = state.board.planets.filter((p) => {
    const d = delta(home, p, state.board);
    return (d.r === 0 && Math.abs(d.c) === 3) || (d.c === 0 && Math.abs(d.r) === 3);
  });
  return near.flatMap((p) => orbitals(state.board, p).filter((q) => isEmptySpace(state, q)));
}

// ---------------------------------------------------------------------------
// Setup and cards

/** Empty orbital positions of a starting planet. */
export function startSlots(state: GameState, planetId: number): Cell[] {
  return orbitals(state.board, state.board.planets[planetId]).filter((p) => isEmptySpace(state, p));
}

/**
 * Whether the player may take this face-up card. An Expansion needs a ship in the reserve:
 * "If you already have both of your expansion ships in the game, you cannot use EXPANSION
 * cards" (2013 rulebook p.9).
 */
export function canTakeCard(state: GameState, player: PlayerId, id: string): boolean {
  return effectOf(id) !== 'expansion' || reserve(state, player).length > 0;
}

/** Whether the player may spend a card pick on dealing new face-up cards (Original). */
export function canRefreshMarket(state: GameState): boolean {
  const m = state.market;
  return !!rulesOf(state).cards?.refresh && m.skillRow.length + m.tacticRow.length > 0;
}

/** Whether there is anything the player could do with a card pick. */
export function canTakeAnyCard(state: GameState, player: PlayerId): boolean {
  const m = state.market;
  return (
    [...m.skillRow, ...m.tacticRow].some((id) => canTakeCard(state, player, id)) ||
    (m.expansions > 0 && reserve(state, player).length > 0) ||
    canRefreshMarket(state)
  );
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
  if (anySkill(state, player, (r) => r.deployIsolated)) {
    for (const p of spaces(state.board)) {
      if (isEmptySpace(state, p) && !linked(state, p).some((q) => dieAt(state, q))) targets.set(key(p), p);
    }
  }
  return [...targets.values()];
}

// ---------------------------------------------------------------------------
// Cubes: conquering, Infamy, Relocation

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

  const rules = skillRules(state, player).flatMap((r) => (r.conquer ? [r.conquer] : []));
  const mine = (spaces: readonly Cell[]) => spaces.map((p) => dieAt(state, p)).filter((d): d is Die => !!d && d.owner === player);
  const orbit = mine(orbitals(state.board, planet));
  const corners = rules.some((r) => r.diagonals) ? mine(diagonals(state.board, planet)) : [];
  const all = [...orbit, ...corners];
  const total = (ships: Die[]) => ships.reduce((a, d) => a + d.value, 0);
  if (!all.length) return fail('No ships in orbit', all, 0);

  const p = state.players[player];
  const tolerance = Math.max(0, ...rules.map((r) => r.tolerance ?? 0));
  // Every orbital ship counts; Ingenious lets each diagonal ship count or not ("may be counted").
  for (let mask = 0; mask < 1 << corners.length; mask++) {
    const ships = [...orbit, ...corners.filter((_, i) => mask & (1 << i))];
    if (!ships.length) continue;
    const sum = total(ships);
    const ctx = { sum, ships, dominance: p.dominance, research: p.research };
    const sums = [sum, ...rules.flatMap((r) => r.sums?.(ctx) ?? [])];
    if (sums.some((s) => Math.abs(s - target) <= tolerance)) return { ok: true, sum, target, ships };
  }
  const sum = total(all);
  return fail(`Orbit totals ${sum}, needs ${target}`, all, sum);
}

/** Any planet without your cube; if none has room, Quantum Entanglement allows your own planets. */
export function infamyTargets(state: GameState, player: PlayerId): Planet[] {
  const open = state.board.planets.filter((p) => planetFreeSlots(p) > 0);
  const fresh = open.filter((p) => !p.cubes.includes(player));
  return fresh.length ? fresh : open;
}

export interface RelocationOption {
  /** The planet the cube leaves. */
  planet: number;
  owner: PlayerId;
  to: number;
}

/**
 * Relocation (Original): move another player's cube to a planet with room and none of their
 * cubes. Revised-edition text: the 1st printing's "cannot have a higher planet number" was
 * dropped (BGG thread 2465215).
 */
export function relocationOptions(state: GameState, player: PlayerId): RelocationOption[] {
  const out: RelocationOption[] = [];
  for (const from of state.board.planets) {
    for (const owner of new Set(from.cubes)) {
      for (const to of state.board.planets) {
        const option = { planet: from.id, owner, to: to.id };
        if (canRelocate(state, player, option)) out.push(option);
      }
    }
  }
  return out;
}

/** Whether `player` may make this Relocation move. */
export function canRelocate(state: GameState, player: PlayerId, { planet, owner, to }: RelocationOption): boolean {
  const from = state.board.planets[planet];
  const dest = state.board.planets[to];
  if (!from || !dest || owner === player || to === planet || !from.cubes.includes(owner)) return false;
  return planetFreeSlots(dest) > 0 && !dest.cubes.includes(owner);
}

// ---------------------------------------------------------------------------
// Combat

export interface CombatTotal {
  roll: number;
  total: number;
  parts: CombatPart[];
}

/** The value a side's combat roll is set to, overriding the dice: a missile, Plan Ahead or Rational (in that priority). */
function rollOverride(state: GameState, combat: CombatPending, side: CombatRole): CombatPart | undefined {
  const s = combat[side];
  if (s.missile) return { label: 'Missile', value: 1 };
  if (state.players[s.player].planAhead > 0) return { label: 'Plan Ahead', value: 1 };
  const fixed = activeSkills(state, s.player).filter((a) => a.rule.combat?.roll !== undefined).pop();
  return fixed && { label: card(fixed.card).name, value: fixed.rule.combat!.roll! };
}

/**
 * Combat roll pipeline (see docs/OPEN-QUESTIONS.md #10):
 * roll (Brutal: lower of two) → set effects (Rational 3, Plan Ahead 1) → missile (1) → modifiers.
 */
export function combatTotal(state: GameState, combat: CombatPending, side: CombatRole): CombatTotal {
  const s = combat[side];
  const skills = activeSkills(state, s.player).filter((a) => a.rule.combat);
  const parts: CombatPart[] = [];
  const set = rollOverride(state, combat, side);
  const roll = set?.value ?? (s.dice.length > 1 ? Math.min(...s.dice) : s.dice[0]);
  parts.push({ label: set?.label ?? (s.dice.length > 1 ? 'Brutal roll' : 'Roll'), value: roll });
  parts.push({ label: 'Ship', value: s.ship });
  for (const { card: id, rule } of skills) {
    const value = rule.combat!.modifier?.({ state, combat, side }) ?? 0;
    if (value) parts.push({ label: card(id).name, value });
  }
  const total = parts.reduce((a, x) => a + x.value, 0);
  return { roll, total, parts };
}

export function combatOutcome(state: GameState, combat: CombatPending) {
  const a = combatTotal(state, combat, 'attacker');
  const d = combatTotal(state, combat, 'defender');
  const tie = a.total === d.total;
  const stubbornDefence = anySkill(state, combat.defender.player, (r) => r.combat?.stubborn);
  const attackerWins = a.total < d.total || (tie && !stubbornDefence);
  // Stubborn: when the defender wins (ties included), the attacker is destroyed.
  const stubborn = stubbornDefence && !attackerWins;
  return { attacker: a, defender: d, attackerWins, stubborn };
}

/**
 * The skill that lets `by` re-roll `side`'s combat dice now, if any: their own (Relentless;
 * Scrappy on their turn) or their opponent's (Cruel). Each is usable once per battle, and not on a
 * roll a missile, Plan Ahead or Rational has set.
 */
export function combatReroll(state: GameState, combat: CombatPending, by: PlayerId, side: CombatRole): ActiveSkill | undefined {
  const target = combat[side].player;
  const opponent = side === 'attacker' ? combat.defender.player : combat.attacker.player;
  if (by !== target && by !== opponent) return undefined;
  if (rollOverride(state, combat, side)) return undefined;
  return activeSkills(state, by).find(({ effect, rule }) => {
    const r = rule.combat?.reroll;
    if (!r || combat.rerolls.includes(effect)) return false;
    if (r.ownTurnOnly && by !== state.turn.player) return false;
    return r.whose === 'own' ? by === target : by === opponent;
  });
}

/** Every combat re-roll `by` could make now, on either side. */
export function combatRerolls(state: GameState, combat: CombatPending, by: PlayerId): { side: CombatRole; skill: ActiveSkill }[] {
  return (['attacker', 'defender'] as const).flatMap((side) => {
    const skill = combatReroll(state, combat, by, side);
    return skill ? [{ side, skill }] : [];
  });
}

/**
 * Whether `by` is offered a missile on `side`'s combat roll. A combatant is only offered their own
 * roll (a lower roll for the opponent only helps them), and not while already winning. Bystanders
 * may fire at either roll. A roll that is already 1 is never offered.
 */
export function missileOffered(state: GameState, combat: CombatPending, by: PlayerId, side: CombatRole): boolean {
  if (state.players[by].missiles <= 0 || combat[side].missile || combatTotal(state, combat, side).roll === 1) return false;
  if (by !== combat.attacker.player && by !== combat.defender.player) return true;
  return combat[side].player === by && combatOutcome(state, combat).attackerWins !== (side === 'attacker');
}

/** Whether `player` can still respond to the battle: a missile, or a re-roll card. */
export function canRespondToCombat(state: GameState, combat: CombatPending, player: PlayerId): boolean {
  return (
    (['attacker', 'defender'] as const).some((side) => missileOffered(state, combat, player, side)) ||
    combatRerolls(state, combat, player).length > 0
  );
}

/** How many combat dice the player rolls (the lowest counts). */
export function combatDice(state: GameState, player: PlayerId): number {
  return Math.max(1, ...skillRules(state, player).map((r) => r.combat?.dice ?? 1));
}

/** Probability that an attacker ship of value `a` beats a defender of value `d` with plain dice. */
export function attackOdds(a: number, d: number): number {
  let wins = 0;
  for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (a + x <= d + y) wins++;
  return wins / 36;
}
