/**
 * Cross-checks between the engine's parts, over every state of seeded AI-vs-AI games:
 *
 * - sound:    every action legalActions() offers is accepted by apply().
 * - complete: every phase-1 action apply() accepts is offered by legalActions(), checked by brute
 *             force over all dice × cells × targets on a sample of states (DEEP=1: all states).
 * - invariants hold after every action, and the checker itself notices broken states.
 *
 * The UI and the AI only offer what legalActions() returns, so a failure here is a move a
 * player could not make, or one the engine would refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  apply,
  checkInvariants,
  createGame,
  legalActions,
  tryApply,
  type Action,
  type Cell,
  type GameMode,
  type GameState,
} from '../src';
import { chooseAction, chooseMissile } from '../../ai/src';

const DEEP = !!process.env.DEEP;

const keyOf = (a: Action) => JSON.stringify(a, Object.keys(a).sort());

/** Every phase-1 action worth trying in this state, legal or not. */
function bruteForce(s: GameState, withCarry: boolean): Action[] {
  const me = s.turn.player;
  const cells: Cell[] = [];
  for (let r = 0; r < s.board.rows; r++) for (let c = 0; c < s.board.cols; c++) if (s.board.cells[r][c].kind === 'space') cells.push({ r, c });
  const mine = s.dice.filter((d) => d.owner === me);
  const onBoard = s.dice.filter((d) => d.loc.zone === 'board');
  const out: Action[] = [
    { type: 'endTurn' },
    { type: 'research' },
    { type: 'composed' },
    { type: 'ambitious' },
    { type: 'tyrannical' },
  ];
  for (const p of s.board.planets) out.push({ type: 'conquer', planet: p.id });
  for (const d of mine) {
    out.push(
      { type: 'reconfigure', die: d.id },
      { type: 'freeReconfigure', die: d.id },
      { type: 'change', die: d.id, value: 3 },
      { type: 'change', die: d.id, value: 5 },
      { type: 'flexible', die: d.id, delta: 1 },
      { type: 'flexible', die: d.id, delta: -1 },
      { type: 'resourceful', die: d.id },
    );
    for (const to of cells) out.push({ type: 'move', die: d.id, to }, { type: 'deploy', die: d.id, to }, { type: 'tactical', die: d.id, to });
    for (const o of onBoard) {
      if (o.owner === me) out.push({ type: 'swap', die: d.id, other: o.id });
      else out.push({ type: 'attack', die: d.id, target: o.id }, { type: 'freeAttack', die: d.id, target: o.id }, { type: 'tactical', die: d.id, target: o.id });
    }
    const at = d.loc;
    if (withCarry && d.value === 2 && at.zone === 'board') {
      // Only spaces within reach can be destinations or drops (range 2, +1 for Agile, +1 to drop).
      const near = cells.filter((c) => Math.abs(c.r - at.r) + Math.abs(c.c - at.c) <= 4);
      for (const p of mine) {
        if (p.id === d.id || p.loc.zone !== 'board') continue;
        for (const to of near)
          for (const drop of near)
            if (Math.abs(drop.r - to.r) <= 1 && Math.abs(drop.c - to.c) <= 1) {
              out.push({ type: 'carry', die: d.id, passenger: p.id, to, drop });
              out.push({ type: 'tactical', die: d.id, passenger: p.id, to, drop });
            }
      }
    }
  }
  return out;
}

function playChecked(mode: GameMode, players: number, seed: number) {
  let s = createGame({ players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, color: '#fff', ai: true })), seed, mode });
  let rng = seed * 31;
  const random = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let step = 0; s.phase !== 'over' && step < 3000; step++) {
    const where = `step ${step}`;
    const legal = legalActions(s, { includeCarry: true });
    for (const a of legal) expect(tryApply(s, a), `${where}: legal but refused: ${keyOf(a)}`).not.toBeNull();

    // Brute force is slow, so it samples states (`DEEP=1 npx vitest run consistency` checks every state of more games).
    const actionPhase = s.phase === 'play' && !s.pending.length && s.turn.phase === 'actions';
    if (actionPhase && (DEEP || step % 4 === 0)) {
      const offered = new Set(legal.map(keyOf));
      for (const a of bruteForce(s, DEEP || step % 20 === 0)) {
        if (offered.has(keyOf(a))) continue;
        expect(tryApply(s, a), `${where}: accepted but not offered: ${keyOf(a)}`).toBeNull();
      }
    }

    let action: Action | null = null;
    if (s.pending[0]?.kind === 'combat') for (const p of s.players) action ??= chooseMissile(s, p.id);
    action ??= chooseAction(s, { samples: 1, random });
    expect(action, `${where}: no action`).not.toBeNull();
    s = apply(s, action!);
    expect(checkInvariants(s), `${where}: after ${keyOf(action!)}`).toEqual([]);
  }
  expect(s.phase).toBe('over');
}

describe('legal actions agree with the engine', () => {
  for (const mode of ['basic', 'original', 'community'] as const)
    for (const [players, seed] of DEEP ? [[2, 21], [3, 22], [4, 23]] : [[3, 22]])
      it(`${mode}, ${players} players, seed ${seed}`, () => playChecked(mode, players, seed), DEEP ? 600_000 : 60_000);
});

describe('invariant checker', () => {
  const fresh = () => {
    let s = createGame({ players: [{ name: 'A', color: '#fff', ai: true }, { name: 'B', color: '#fff', ai: true }], seed: 5, mode: 'community' });
    while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
    return s;
  };

  it('accepts a fresh game', () => {
    expect(checkInvariants(fresh())).toEqual([]);
  });

  it('notices two ships on one space', () => {
    const s = fresh();
    const [a, b] = s.dice.filter((d) => d.loc.zone === 'board');
    b.loc = { ...a.loc };
    expect(checkInvariants(s).join()).toMatch(/two ships/);
  });

  it('notices a lost card', () => {
    const s = fresh();
    s.market.skillRow.pop();
    expect(checkInvariants(s).join()).toMatch(/card .* expected/);
  });

  it('notices a cube appearing from nowhere', () => {
    const s = fresh();
    s.players[0].cubesLeft++;
    expect(checkInvariants(s).join()).toMatch(/cubes placed/);
  });
});
