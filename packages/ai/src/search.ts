import {
  actor,
  apply,
  copyState,
  decisionCandidates,
  deployTargets,
  legalActions,
  mulberry32,
  scrapyard,
  tryApply,
  type Action,
  type GameState,
  type Pending,
  type PlayerId,
} from '@quantum/engine';
import { outcomes, type Outcome } from './chance';
import { candidates } from './patient';
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
  /** The policy that plays the opponent's next turn for those tests (default: level 2's). */
  reply?: SearchParams;
  /**
   * Replies played per plan, averaged, each with its own dice; the same dice for every plan, so they
   * are compared fairly. Without it, one reply with the search's own randomness.
   */
  replySamples?: number;
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
    /**
     * Evaluations by player and position: deepening a line scores its positions again, and the
     * reply checks play out the same positions. Shared with the searches that play the replies.
     */
    private readonly evals = new Map<string, number>(),
  ) {
    this.seeds = Array.from({ length: params.samples }, () => seed(random));
  }

  choose(state: GameState): Action | null {
    const head = state.pending[0];
    if (head?.kind === 'combat') return { type: 'resolveCombat' };
    let options = candidates(state, { includeCarry: this.params.carry });
    // Anti-stalemate: after IDLE_LIMIT turns in a row without an action, don't pass again while
    // there is anything else to do (two players who both see no progress would pass forever).
    if (!head && (state.players[this.me].idleTurns ?? 0) >= IDLE_LIMIT && !state.turn.acted) {
      const active = options.filter((a) => a.type !== 'endTurn');
      if (active.length) options = active;
    }
    if (options.length <= 1) return options[0] ?? null;

    const root = hideUnknowns(state, this.random);
    const depth = this.params.depth;
    const scored = options
      .flatMap<{ a: Action; outs: Outcome[] | null; line: Line }>((a) => {
        if (a.type === 'endTurn') return [{ a, outs: null, line: this.standPat(root) }];
        const outs = this.expand(root, a);
        return outs ? [{ a, outs, line: this.action(outs, 0) }] : [];
      })
      .filter((x) => x.line.value > -Infinity)
      .sort((x, y) => y.line.value - x.line.value);
    if (!scored.length) return options[0];

    // Deepen the most promising candidates. Ending the turn needs no deepening.
    if (depth > 1) {
      for (const x of scored.slice(0, this.params.width)) {
        if (this.exhausted()) break;
        if (x.outs) x.line = this.action(x.outs, depth - 1);
      }
      scored.sort((x, y) => y.line.value - x.line.value);
    }
    if (this.params.replies > 0 && !head) {
      // Scores after the reply are on a different scale, so choose among the checked plans only.
      const checked = scored.slice(0, this.params.replies);
      const samples = this.params.replySamples;
      const seeds = samples ? Array.from({ length: samples }, () => seed(this.random)) : [];
      const reply = (end: GameState) =>
        samples ? seeds.reduce((sum, x) => sum + this.afterReply(end, mulberry32(x)), 0) / samples : this.afterReply(end, this.random);
      const after = checked.map((x) => ({ a: x.a, value: 0.5 * x.line.value + 0.5 * reply(x.line.end) }));
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
      const available = legalActions(root).some((x) => x.type === 'missile' && x.by === player && x.side === side);
      if (!available) continue;
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
    // Counted even when cached: the budget measures the search's size, so that a faster search
    // makes the same choices.
    this.evaluations++;
    return { value: this.score(s, this.me), end: s };
  }

  /** evaluate(s, who, mover), cached. */
  private score(s: GameState, who: PlayerId, mover?: PlayerId): number {
    const k = `${who}|${mover ?? ''}|${evalKey(s)}`;
    let value = this.evals.get(k);
    if (value === undefined) this.evals.set(k, (value = evaluate(s, who, mover)));
    return value;
  }

  private exhausted(): boolean {
    return this.evaluations >= this.params.budget;
  }

  /** The outcomes of `a` in `s`, with the decisions that follow settled; null if it is illegal. */
  private expand(s: GameState, a: Action): Outcome[] | null {
    const outs = outcomes(s, a, this.seeds);
    return outs && outs.map((o) => ({ state: this.settle(o.state), p: o.p }));
  }

  /** Expected value of an action, from its `expand`ed outcomes, searching `depth` further actions after it. */
  private action(outs: Outcome[], depth: number): Line {
    let value = 0;
    let end = outs[0].state;
    let likeliest = -1;
    for (const o of outs) {
      const line = this.node(o.state, depth);
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
      const scored = candidates(s, { includeCarry: this.params.carry })
        .filter((a) => a.type !== 'endTurn')
        .flatMap((a) => {
          const outs = this.expand(s, a);
          return outs ? [{ outs, line: this.action(outs, 0) }] : [];
        })
        .sort((x, y) => y.line.value - x.line.value);
      for (const x of scored) if (x.line.value > best.value) best = x.line;
      if (depth > 1) {
        for (const x of scored.slice(0, this.params.innerWidth)) {
          if (this.exhausted()) break;
          const line = this.action(x.outs, depth - 1);
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
      // Candidates are tried here, which is all legalActions would do to them first.
      for (const a of head.kind === 'unveil' ? unveilPlacements(s) : decisionCandidates(s)) {
        const outs = outcomes(s, a, this.seeds.slice(0, 1));
        if (!outs) continue;
        // Nested decisions are settled with the first option, to keep this cheap.
        const v = outs.reduce((sum, o) => sum + o.p * this.score(quickSettle(o.state), who), 0);
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

  /** The value of `end` after I finish my turn and the next player plays theirs (`reply` policy). */
  private afterReply(end: GameState, random: () => number): number {
    const captain = new Search(this.me, LEVEL_2_REPLY, random, this.evals);
    let s = end;
    if (this.myTurn(s)) s = captain.settle(apply(s, { type: 'endTurn' }));
    const them = s.turn.player;
    // A turn of mine is scored as if I end it now (see evaluate.ts nextMover), but here it has
    // only just started: I move next.
    if (them === this.me) return this.score(s, this.me, this.me);
    const opponent = new Search(them, this.params.reply ?? LEVEL_2_REPLY, random, this.evals);
    for (let i = 0; i < 12 && s.phase !== 'over' && s.turn.player === them; i++) {
      const a = s.pending[0] ? (actor(s) === them ? opponent.choose(s) : captain.choose(s)) : opponent.choose(s);
      if (!a) break;
      // The opponent's rolls are sampled: this is a check of the plan, not a full average.
      s = captain.settle(apply({ ...s, rng: seed(random) }, a));
    }
    return this.score(s, this.me, s.turn.player === this.me ? this.me : undefined);
  }
}

/** Turns in a row a player may end without spending an action before the AI must act. */
const IDLE_LIMIT = 2;

/** The level-2 policy, used to play out the opponent's reply. */
const LEVEL_2_REPLY: SearchParams = { depth: 1, width: 0, innerWidth: 0, samples: 1, carry: false, replies: 0, budget: Infinity };

/** Settles pending decisions with the first legal answer. */
function quickSettle(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 6 && s.pending.length && s.phase !== 'over'; i++) {
    const head = s.pending[0];
    // Unveil's first option is always Done; asking legalActions would test every placement first.
    if (head.kind === 'combat' || head.kind === 'unveil') {
      s = apply(s, { type: head.kind === 'combat' ? 'resolveCombat' : 'unveilDone' });
      continue;
    }
    // legalActions(s)[0], without trying the answers after it.
    let next: GameState | null = null;
    for (const a of decisionCandidates(s)) if ((next = tryApply(s, a))) break;
    if (!next) break;
    s = next;
  }
  return s;
}

/**
 * Settling Unveil the Fleet (and Reorganization): the next ship onto the first space it may take, or Done when
 * none is left, so every option at the root is played out alike and cheaply. Unveil is many steps, each with up to
 * a hundred spaces (a skill that deploys anywhere isolated): trying them all at each step made one AI decision
 * take minutes. Where each ship goes is still chosen properly, one ship per decision, at the root (`choose`).
 */
function unveilPlacements(s: GameState): Action[] {
  // Built directly: legalActions would build and test every placement to take the first.
  const head = s.pending[0] as Extract<Pending, { kind: 'unveil' }>;
  const die = scrapyard(s, head.player).find((d) => !head.reorganize || head.rerolled.includes(d.id));
  const [to] = die ? deployTargets(s, head.player) : [];
  return [die && to ? { type: 'unveilDeploy', die: die.id, to } : { type: 'unveilDone' }];
}

function seed(random: () => number): number {
  return Math.floor(random() * 2 ** 32) >>> 0;
}

/**
 * The AI's view of the game: the log dropped (it is never needed, and copying it is slow),
 * a random seed of its own instead of the game's RNG, and the unseen deck cards shuffled.
 */
function hideUnknowns(state: GameState, random: () => number): GameState {
  const s = copyState({ ...state, log: [] });
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

/** Identifies a position for the evaluation cache: also outside my turn, where whose turn it is matters. */
function evalKey(s: GameState): string {
  const t = s.turn;
  const between = s.players.map((p) => [p.bonusTurns.length, p.carriedPicks]);
  return `${s.phase}|${s.winner}|${t.player}|${t.phase}|${JSON.stringify([t.offTurnCubes, between])}|${signature(s)}`;
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
    t.freeMovesUsed,
    t.attacked,
    t.conquered,
    t.curiousUsed,
    t.storedTacticPlayed,
    t.destroyedBy,
    t.scrappy,
    s.players.map((p) => [
      p.dominance,
      p.research,
      p.cubesLeft,
      p.missiles,
      p.skills.map((k) => (k.active ? k.id : `-${k.id}`)),
      p.ambitionTokens,
      p.planAhead,
      p.storedTactics,
    ]),
    s.board.planets.map((p) => p.cubes),
    s.gates,
    s.pending,
  ]);
}
