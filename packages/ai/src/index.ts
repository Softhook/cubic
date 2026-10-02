import {
  actor,
  attackOdds,
  cellOf,
  conquerCheck,
  die,
  dieAt,
  isEmptySpace,
  legalActions,
  movementRange,
  orbitals,
  planetFreeSlots,
  shipsOnBoard,
  tryApply,
  type Action,
  type GameState,
  type PlayerId,
} from '@quantum/engine';

/**
 * Level-1 AI: greedy one-ply search. Every legal action is simulated (dice outcomes are
 * sampled with a fresh random seed, so the AI never sees the game's real RNG), the
 * resulting position is scored with a heuristic, and the best action wins.
 */

const RANDOM_ACTIONS = new Set<Action['type']>([
  'attack',
  'freeAttack',
  'reconfigure',
  'freeReconfigure',
  'resourceful',
  'takeCard',
  'peekChoice',
  'refreshMarket',
]);

export interface AiOptions {
  /** Samples per random action. Higher is stronger and slower. */
  samples?: number;
  /** 0 = always best move, higher = more random (easier). */
  noise?: number;
  random?: () => number;
}

export function chooseAction(state: GameState, opts: AiOptions = {}): Action | null {
  const me = actor(state);
  const head = state.pending[0];
  if (head?.kind === 'combat') return { type: 'resolveCombat' };
  const candidates = legalActions(state);
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  return best(state, me, candidates, opts);
}

/** Should `player` fire a missile into the current combat? Dice are already rolled, so this is exact. */
export function chooseMissile(state: GameState, player: PlayerId): Action | null {
  const head = state.pending[0];
  if (head?.kind !== 'combat' || state.players[player].missiles <= 0) return null;
  const options: Action[] = [
    { type: 'missile', by: player, side: 'attacker' },
    { type: 'missile', by: player, side: 'defender' },
  ];
  const baseline = scoreAfter(state, player, { type: 'resolveCombat' });
  let pick: Action | null = null;
  let top = baseline + 15; // a missile is worth keeping unless it clearly helps
  for (const a of options) {
    const s = tryApply(state, a);
    if (!s) continue;
    const v = scoreAfter(s, player, { type: 'resolveCombat' });
    if (v > top) {
      top = v;
      pick = a;
    }
  }
  return pick;
}

function best(state: GameState, me: PlayerId, candidates: Action[], opts: AiOptions): Action {
  const rand = opts.random ?? Math.random;
  const samples = opts.samples ?? 3;
  let top = -Infinity;
  let pick = candidates[0];
  for (const a of candidates) {
    const n = RANDOM_ACTIONS.has(a.type) ? samples : 1;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const sim = withRandomSeed(state, rand);
      total += scoreAfter(sim, me, a);
    }
    const v = total / n + (opts.noise ? (rand() - 0.5) * opts.noise : 0) + tieBreak(a);
    if (v > top) {
      top = v;
      pick = a;
    }
  }
  return pick;
}

/** Small preferences so equal-scoring actions resolve sensibly. */
function tieBreak(a: Action): number {
  if (a.type === 'endTurn') return -0.5;
  // Free abilities must actually improve the position, not just shuffle ships around.
  if (a.type === 'swap' || a.type === 'change' || a.type === 'flexible' || a.type === 'freeReconfigure') return -2;
  if (a.type === 'advance' && a.move) return 0.2;
  return 0;
}

function withRandomSeed(state: GameState, rand: () => number): GameState {
  return { ...state, rng: Math.floor(rand() * 2 ** 32) >>> 0 };
}

/** Scores the position after `a`. An illegal action scores -Infinity; an engine crash propagates. */
function scoreAfter(state: GameState, me: PlayerId, a: Action): number {
  const s = tryApply(state, a);
  if (!s) return -Infinity;
  return score(playOutDecisions(s, me), me);
}

/** Resolves follow-up decisions with a quick default policy so the position can be scored. */
function playOutDecisions(state: GameState, me: PlayerId): GameState {
  let s = state;
  for (let i = 0; i < 12 && s.pending.length && s.phase !== 'over'; i++) {
    const head = s.pending[0];
    if (head.kind === 'setupRoll' || head.kind === 'skillDraft' || head.kind === 'placeStart' || head.kind === 'placeShips') break;
    const a = quickPolicy(s, me);
    const next = a && tryApply(s, a);
    if (!next) break;
    s = next;
  }
  return s;
}

function quickPolicy(s: GameState, me: PlayerId): Action | null {
  const head = s.pending[0];
  if (!head) return null;
  if (head.kind === 'combat') return { type: 'resolveCombat' };
  const options = legalActions(s);
  if (head.kind === 'showOfForce') {
    const enemy = options.find((a) => a.type === 'showOfForce' && die(s, a.die).owner !== me);
    return enemy ?? options[0] ?? null;
  }
  if (head.kind === 'takeCard') {
    return options.find((a) => a.type === 'takeCard' && a.deck === 'expansion') ?? options[0] ?? null;
  }
  if (head.kind === 'peek') return { type: 'peekChoice', takeTop: false };
  if (head.kind === 'unveil') {
    return options.find((a) => a.type === 'unveilDeploy') ?? { type: 'unveilDone' };
  }
  if (head.kind === 'placeExpansion') {
    return options.find((a) => a.type === 'placeExpansion' && a.to) ?? options[0] ?? null;
  }
  return options[0] ?? null;
}

// ---------------------------------------------------------------------------
// Evaluation

const SKILL_VALUE = 60;

export function score(s: GameState, me: PlayerId): number {
  if (s.phase === 'over') return s.winner === me ? 1e6 : -1e6;
  const mine = playerValue(s, me, true);
  let rival = 0;
  for (const p of s.players) if (p.id !== me) rival = Math.max(rival, playerValue(s, p.id, false));
  return mine - 0.7 * rival;
}

function playerValue(s: GameState, p: PlayerId, detailed: boolean): number {
  const pl = s.players[p];
  let v = -pl.cubesLeft * 1000;
  v += pl.dominance * pl.dominance * 6;
  v += pl.research * 14;
  v += pl.missiles * 25;
  v += Math.min(pl.skills.length, 5) * SKILL_VALUE;
  for (const d of s.dice) {
    if (d.owner !== p) continue;
    if (d.loc.zone === 'board') v += 40;
    else if (d.loc.zone === 'scrapyard') v += 15;
  }
  v += conquerPotential(s, p);
  if (detailed) v -= danger(s, p);
  return v;
}

function conquerPotential(s: GameState, p: PlayerId): number {
  const values: number[] = [];
  const myShips = shipsOnBoard(s, p);
  for (const planet of s.board.planets) {
    if (planetFreeSlots(planet) <= 0 || planet.cubes.includes(p)) continue;
    const slots = orbitals(s.board, planet);
    const inOrbit = slots.map((c) => dieAt(s, c)).filter((d) => d && d.owner === p);
    const sum = inOrbit.reduce((a, d) => a + d!.value, 0);
    const empty = slots.filter((c) => isEmptySpace(s, c)).length;
    const target = planet.number;
    let v: number;
    if (conquerCheck(s, p, planet.id).ok) v = 320;
    else if (sum < target && empty > 0 && target - sum <= 6) v = 40 + 30 * inOrbit.length;
    else if (sum < target) v = 12 * inOrbit.length;
    else v = Math.max(0, 8 * inOrbit.length - (sum - target) * 6);
    // Ships that could reach an empty orbital slot next turn.
    if (empty > 0) {
      for (const d of myShips) {
        if (inOrbit.includes(d)) continue;
        const c = cellOf(d)!;
        const near = slots.some(
          (q) => isEmptySpace(s, q) && Math.abs(q.r - c.r) + Math.abs(q.c - c.c) <= movementRange(s, d),
        );
        if (near) v += 6;
      }
    }
    values.push(v);
  }
  values.sort((a, b) => b - a);
  return (values[0] ?? 0) + 0.3 * (values[1] ?? 0);
}

/** Expected loss from enemy ships that could attack ours next turn (rough reach estimate). */
function danger(s: GameState, p: PlayerId): number {
  let total = 0;
  const enemies = s.dice.filter((d) => d.loc.zone === 'board' && d.owner !== p);
  for (const mine of shipsOnBoard(s, p)) {
    const c = cellOf(mine)!;
    let worst = 0;
    for (const e of enemies) {
      const ec = cellOf(e)!;
      const dist = Math.abs(ec.r - c.r) + Math.abs(ec.c - c.c);
      if (dist <= movementRange(s, e) + 1 && dist > 0) worst = Math.max(worst, attackOdds(e.value, mine.value));
    }
    total += worst * 45;
  }
  return total;
}
