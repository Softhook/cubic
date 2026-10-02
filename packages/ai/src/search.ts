import { actor, apply, legalActions, type Action, type GameState, type PlayerId } from '@quantum/engine';
import { outcomes } from './chance';
import { evaluate } from './evaluate';

/**
 * Levels 2 and up: expectimax search over the rest of the current turn.
 *
 * A node is a position in my own action phase. Its value is the best of ending the turn now
 * (the evaluation) and every action I could take next. Random actions branch into all their
 * outcomes, weighted by probability; decisions that follow (advance after a battle, card
 * picks) are answered by each player's best one-step choice. All candidates are tried one
 * step deep; only the `width` most promising are searched further, down to `depth`.
 *
 * With `replies`, the best few plans are also checked against the opponent's actual next
 * turn (played by the level-2 policy), which catches threats the evaluation misjudges.
 */

export interface SearchParams {
  /** Actions looked ahead within the turn (1 = greedy). */
  depth: number;
  /** Candidates searched beyond one step at the root, and at deeper nodes. */
  width: number;
  innerWidth: number;
  /**
   * Positions evaluated per decision before the search stops deepening. A count rather than a
   * time limit, so that games replay identically.
   */
  budget: number;
  /** Samples for card draws and other random effects that are not enumerated. */
  samples: number;
  /** Include every Flagship transport (many options). */
  carry: boolean;
  /** How many of the best plans to test against the opponent's next turn (0 = none). */
  replies: number;
}

interface Line {
  value: number;
  /** Where the best line ends: the position the evaluation scored (most likely outcome). */
  end: GameState;
}

export class Search {
  private readonly tt = new Map<string, Line>();
  private readonly seeds: number[];
  private evaluations = 0;

  constructor(
    private readonly me: PlayerId,
    private readonly params: SearchParams,
    private readonly random: () => number,
  ) {
    this.seeds = Array.from({ length: params.samples }, () => seed(random));
  }

  choose(state: GameState): Action | null {
    const head = state.pending[0];
    if (head?.kind === 'combat') return { type: 'resolveCombat' };
    const candidates = legalActions(state, { includeCarry: this.params.carry });
    if (candidates.length <= 1) return candidates[0] ?? null;

    const root = hideUnknowns(state, this.random);
    const depth = this.params.depth;
    const scored = candidates
      .map((a) => ({ a, line: a.type === 'endTurn' ? this.standPat(root) : this.action(root, a, 0) }))
      .filter((x) => x.line.value > -Infinity)
      .sort((x, y) => y.line.value - x.line.value);
    if (!scored.length) return candidates[0];

    // Deepen the most promising candidates. Ending the turn needs no deepening.
    if (depth > 1) {
      for (const x of scored.slice(0, this.params.width)) {
        if (this.exhausted()) break;
        if (x.a.type !== 'endTurn') x.line = this.action(root, x.a, depth - 1);
      }
      scored.sort((x, y) => y.line.value - x.line.value);
    }
    if (this.params.replies > 0 && !head) {
      // Scores after the reply are on a different scale, so choose among the checked plans only.
      const checked = scored.slice(0, this.params.replies);
      const after = checked.map((x) => ({ a: x.a, value: 0.5 * x.line.value + 0.5 * this.afterReply(x.line.end) }));
      return after.reduce((b, x) => (x.value > b.value ? x : b)).a;
    }
    return scored[0].a;
  }

  /** Should `player` fire a missile into the current combat? The dice are known, so this is exact. */
  missile(state: GameState, player: PlayerId): Action | null {
    const head = state.pending[0];
    if (head?.kind !== 'combat' || state.players[player].missiles <= 0) return null;
    const root = hideUnknowns(state, this.random);
    const after = (s: GameState) => evaluate(this.settle(apply(s, { type: 'resolveCombat' })), player);
    let pick: Action | null = null;
    // The evaluation already counts a kept missile; a small margin avoids firing for nothing.
    let top = after(root) + 10;
    for (const side of ['attacker', 'defender'] as const) {
      const a: Action = { type: 'missile', by: player, side };
      const fired = legalActions(root).some((x) => x.type === 'missile' && x.by === player && x.side === side);
      if (!fired) continue;
      const v = after(apply(root, a));
      if (v > top) {
        top = v;
        pick = a;
      }
    }
    return pick;
  }

  // -------------------------------------------------------------------------

  private myTurn(s: GameState): boolean {
    return s.phase === 'play' && !s.pending.length && s.turn.phase === 'actions' && s.turn.player === this.me;
  }

  private standPat(s: GameState): Line {
    this.evaluations++;
    return { value: evaluate(s, this.me), end: s };
  }

  private exhausted(): boolean {
    return this.evaluations >= this.params.budget;
  }

  /** Expected value of taking `a` in `s`, searching `depth` further actions after it. */
  private action(s: GameState, a: Action, depth: number): Line {
    const outs = outcomes(s, a, this.seeds);
    if (!outs) return { value: -Infinity, end: s };
    let value = 0;
    let end = s;
    let likeliest = -1;
    for (const o of outs) {
      const line = this.node(this.settle(o.state), depth);
      value += o.p * line.value;
      if (o.p > likeliest) {
        likeliest = o.p;
        end = line.end;
      }
    }
    return { value, end };
  }

  /** The best line from `s`: end the turn now, or take up to `depth` more actions. */
  private node(s: GameState, depth: number): Line {
    if (!this.myTurn(s)) return this.standPat(s);
    const k = `${depth}|${signature(s)}`;
    const hit = this.tt.get(k);
    if (hit) return hit;

    let best = this.standPat(s);
    if (depth > 0 && !this.exhausted()) {
      const scored = legalActions(s, { includeCarry: this.params.carry })
        .filter((a) => a.type !== 'endTurn')
        .map((a) => ({ a, line: this.action(s, a, 0) }))
        .filter((x) => x.line.value > -Infinity)
        .sort((x, y) => y.line.value - x.line.value);
      for (const x of scored) if (x.line.value > best.value) best = x.line;
      if (depth > 1) {
        for (const x of scored.slice(0, this.params.innerWidth)) {
          if (this.exhausted()) break;
          const line = this.action(s, x.a, depth - 1);
          if (line.value > best.value) best = line;
        }
      }
    }
    this.tt.set(k, best);
    return best;
  }

  /** Answers pending decisions (other than mine at the start of a turn) with one-step choices. */
  private settle(state: GameState): GameState {
    let s = state;
    for (let i = 0; i < 20 && s.pending.length && s.phase !== 'over'; i++) {
      const head = s.pending[0];
      if (head.kind === 'setupRoll' || head.kind === 'skillDraft' || head.kind === 'placeStart' || head.kind === 'placeShips') break;
      if (head.kind === 'combat') {
        s = apply(s, { type: 'resolveCombat' });
        continue;
      }
      const who = actor(s);
      let pick: GameState | null = null;
      let top = -Infinity;
      for (const a of legalActions(s)) {
        const outs = outcomes(s, a, this.seeds.slice(0, 1));
        if (!outs) continue;
        // Nested decisions are settled with the first option, to keep this cheap.
        const v = outs.reduce((sum, o) => sum + o.p * evaluate(quickSettle(o.state), who), 0);
        if (v > top) {
          top = v;
          pick = outs[0].state;
        }
      }
      if (!pick) break;
      s = pick;
    }
    return s;
  }

  /** The value of `end` after I finish my turn and the next player plays theirs (level-2 policy). */
  private afterReply(end: GameState): number {
    const captain = new Search(this.me, LEVEL_2_REPLY, this.random);
    let s = end;
    if (this.myTurn(s)) s = captain.settle(apply(s, { type: 'endTurn' }));
    const them = s.turn.player;
    if (them === this.me) return evaluate(s, this.me);
    const opponent = new Search(them, LEVEL_2_REPLY, this.random);
    for (let i = 0; i < 12 && s.phase !== 'over' && s.turn.player === them; i++) {
      const a = s.pending[0] ? (actor(s) === them ? opponent.choose(s) : captain.choose(s)) : opponent.choose(s);
      if (!a) break;
      // The opponent's rolls are sampled once: this is a check of the plan, not a full average.
      s = captain.settle(apply({ ...s, rng: seed(this.random) }, a));
    }
    return evaluate(s, this.me);
  }
}

/** The level-2 policy, used to play out the opponent's reply. */
const LEVEL_2_REPLY: SearchParams = { depth: 1, width: 0, innerWidth: 0, samples: 1, carry: false, replies: 0, budget: Infinity };

function quickSettle(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 6 && s.pending.length && s.phase !== 'over'; i++) {
    const head = s.pending[0];
    const a: Action | undefined = head.kind === 'combat' ? { type: 'resolveCombat' } : legalActions(s)[0];
    if (!a) break;
    s = apply(s, a);
  }
  return s;
}

function seed(random: () => number): number {
  return Math.floor(random() * 2 ** 32) >>> 0;
}

/**
 * The AI's view of the game: the log dropped (it is never needed, and copying it is slow),
 * a random seed of its own instead of the game's RNG, and the unseen deck cards shuffled.
 */
function hideUnknowns(state: GameState, random: () => number): GameState {
  const s = structuredClone({ ...state, log: [] });
  s.rng = seed(random);
  const peek = s.pending[0]?.kind === 'peek' ? s.pending[0].deck : null;
  shuffle(s.market.skillDeck, peek === 'skill' ? 1 : 0, random);
  shuffle(s.market.tacticDeck, peek === 'tactic' ? 1 : 0, random);
  return s;
}

/** Shuffles `xs` in place, leaving the first `keep` cards (known to the player) in place. */
function shuffle(xs: string[], keep: number, random: () => number) {
  for (let i = xs.length - 1; i > keep; i--) {
    const j = keep + Math.floor(random() * (i - keep + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
}

/** Identifies a position within a turn, for the transposition table. */
function signature(s: GameState): string {
  const t = s.turn;
  return JSON.stringify([
    s.dice.map((d) => [d.value, d.loc.zone === 'board' ? d.loc.r * 100 + d.loc.c : d.loc.zone]),
    t.actionsLeft,
    t.freeMoves,
    t.freeDeploys,
    t.moved,
    t.abilityUsed,
    t.seen,
    t.oncePerTurn,
    t.conquests,
    s.players.map((p) => [p.dominance, p.research, p.cubesLeft, p.missiles, p.skills.length]),
    s.board.planets.map((p) => p.cubes),
    s.gates,
  ]);
}
