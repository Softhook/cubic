/**
 * AI levels: the positions each level must handle, and full games between levels.
 * Strength is measured separately by self-play (see docs/AI.md); these tests pin down behaviour.
 *
 * Scenarios run on Alpha Sector, the basic map for 2 players (9×9 spaces). Planets, by id:
 *
 *    id0 (1,1) 7*   id1 (1,4) 7    id2 (1,7) 7
 *    id3 (4,1) 7    id4 (4,4) 8    id5 (4,7) 7
 *    id6 (7,1) 7    id7 (7,4) 7    id8 (7,7) 7*
 */
import { describe, expect, it } from 'vitest';
import { apply, checkInvariants, grid, orbitals, type Action, type GameState } from '@quantum/engine';
import { arrange, playAiGame, quickStart, seededRandom } from '../../engine/test/helpers';
import { chooseAction, type AiLevel } from '../src';

const BASE = quickStart(2, 1, 'basic');

/** Player 0 to act with 3 fresh actions; only the listed ships on the map and cubes placed. */
function scenario(dice: Record<string, [number, number, number]>, cubes: Record<number, number[]> = { 2: [0], 6: [1] }): GameState {
  const s = structuredClone(BASE);
  for (const d of s.dice) if (d.loc.zone === 'board') d.loc = { zone: 'scrapyard' };
  for (const [id, [r, c, value]] of Object.entries(dice)) {
    const d = s.dice.find((x) => x.id === id)!;
    d.loc = { zone: 'board', r, c };
    d.value = value;
  }
  for (const p of s.board.planets) p.cubes = [...(cubes[p.id] ?? [])];
  for (const p of s.players) {
    p.cubesLeft = 5 - s.board.planets.reduce((a, pl) => a + pl.cubes.filter((x) => x === p.id).length, 0);
    p.dominance = 1;
  }
  s.turn = { ...s.turn, player: 0, phase: 'actions', actionsLeft: 3, moved: {}, abilityUsed: {}, seen: {}, conquests: 0, oncePerTurn: [] };
  for (const d of s.dice) s.turn.seen[d.id] = [d.value];
  return s;
}

/** Lets the AI play player 0's whole turn. */
function playTurn(state: GameState, level: AiLevel): { s: GameState; actions: Action[] } {
  const random = seededRandom(7);
  const actions: Action[] = [];
  let s = state;
  while (s.phase === 'play' && s.turn.player === 0 && actions.length < 30) {
    const a = chooseAction(s, { level, random })!;
    actions.push(a);
    s = apply(s, a);
  }
  return { s, actions };
}

const LEVELS: AiLevel[] = [1, 2, 3, 4, 5];

describe.each(LEVELS)('level %i', (level) => {
  it('conquers a planet whose orbit already adds up', () => {
    const { s } = playTurn(scenario({ p0d0: [0, 4, 3], p0d1: [2, 4, 4] }), level);
    expect(s.board.planets[1].cubes).toContain(0);
  });

  it('moves a ship into orbit and conquers in the same turn, even next to an enemy', () => {
    // A 1 orbits planet 1 (needs 7); the 6 can reach (1,5). An enemy 2 waits at (2,3).
    const { s } = playTurn(scenario({ p0d0: [0, 4, 1], p0d1: [4, 6, 6], p1d0: [2, 3, 2] }), level);
    expect(s.board.planets[1].cubes).toContain(0);
  });

  it('attacks an orbit that would give the opponent their last cube', () => {
    // Player 1 has one cube left, and 3 + 4 around planet 5 (a 7).
    const cubes = { 0: [0], 1: [1], 6: [1], 7: [1], 8: [1] };
    const start = scenario({ p0d0: [3, 5, 2], p0d1: [0, 0, 5], p1d0: [3, 7, 3], p1d1: [5, 7, 4] }, cubes);
    expect(start.players[1].cubesLeft).toBe(1);
    const { actions } = playTurn(start, level);
    expect(actions.some((a) => a.type === 'attack' && (a.target === 'p1d0' || a.target === 'p1d1'))).toBe(true);
  });
});

describe.each([2, 3, 4, 5] as AiLevel[])('contested orbit (Regolith), level %i', (level) => {
  /**
   * On Alpha Sector (hex): player 0's 6 and a ship of the rest make a free planet's number in its
   * orbit, but player 1's 6 sits in it too. Player 0's 2 waits next to it outside the orbit; on a
   * hex the orbit's spaces touch, so the orbiting ships may attack it too. Clearing it opens the
   * conquest in the same turn.
   */
  function siege(): { s: GameState; planet: number } {
    const base = quickStart(2, 1, 'regolith', 'alpha-hex');
    const planet = base.board.planets.find((q) => !q.start && !q.cubes.length)!;
    const orbit = orbitals(base.board, planet);
    const inOrbit = (q: { r: number; c: number }) => orbit.some((o) => o.r === q.r && o.c === q.c);
    const g = grid(base.board);
    const index = (q: { r: number; c: number }) => q.r * g.cols + q.c;
    // A blocker with a space outside the orbit next to it, for the attacker.
    const blocker = orbit.find((o) => g.orthoCells[index(o)].some((q) => g.space[index(q)] && !inOrbit(q)))!;
    const launch = g.orthoCells[index(blocker)].find((q) => g.space[index(q)] && !inOrbit(q))!;
    const [a, b] = orbit.filter((o) => o !== blocker);
    let s = arrange(base, {
      p0d0: [a.r, a.c, 6],
      p0d1: [b.r, b.c, planet.number - 6],
      p0d2: [launch.r, launch.c, 2],
      p1d0: [blocker.r, blocker.c, 6],
    });
    s = structuredClone(s);
    s.turn = {
      ...s.turn,
      player: 0,
      phase: 'actions',
      actionsLeft: 3,
      moved: {},
      abilityUsed: {},
      seen: {},
      conquests: 0,
      oncePerTurn: [],
    };
    for (const d of s.dice) s.turn.seen[d.id] = [d.value];
    return { s, planet: planet.id };
  }

  it('attacks the enemy ship blocking an orbit that makes the sum', () => {
    const { s, planet } = siege();
    const { s: after, actions } = playTurn(s, level);
    // A normal attack, the 1's free one, or a shot.
    expect(actions.some((a) => (a.type === 'attack' || a.type === 'freeAttack' || a.type === 'power') && a.target === 'p1d0')).toBe(true);
    // Having cleared it, it conquers in the same turn.
    if (after.dice.find((d) => d.id === 'p1d0')!.loc.zone !== 'board') expect(after.board.planets[planet].cubes).toContain(0);
  });
});

describe('full games', () => {
  it.each([
    ['basic', [2, 3]],
    ['community', [2, 2]],
  ] as const)('%s: levels %j play to the end, keeping every invariant', (mode, levels) => {
    const { state } = playAiGame({
      mode,
      players: 2,
      seed: 3,
      aiSeed: 4,
      levels: [...levels],
      after: (s, action, step) => expect(checkInvariants(s), `after step ${step}: ${JSON.stringify(action)}`).toEqual([]),
    });
    expect(state.phase).toBe('over');
  });

  it('scores positions cleanly when a player is stuck at dominance 6', () => {
    const s = scenario({ p0d0: [0, 4, 3], p1d0: [1, 5, 2] });
    s.players[0].dominance = 6;
    s.players[1].dominance = 6;
    const a = chooseAction(s, { level: 3, random: seededRandom(1) });
    expect(a).not.toBeNull();
  });
});
