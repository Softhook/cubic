/**
 * Cubic, our own rule set (docs/PROTOTYPING.md): Community Edition with movement capped at 3 and new
 * powers for the 4 (Picket), 5 (Shoot) and 6 (Beacon), which replace Modify, Manoeuvre and Free
 * Reconfigure.
 *
 * Scenarios run on Alpha Sector, the basic map for 2 players (9×9; planets at rows/cols 1, 4, 7,
 * every other cell a space).
 */
import { describe, expect, it } from 'vitest';
import {
  apply,
  CLASSIC_SHIPS,
  deployTargets,
  key,
  legalActions,
  MODES,
  moveOptions,
  picketZone,
  rulesOf,
  shipReach,
  shipsByIndex,
  shootTargets,
  type Action,
  type GameMode,
  type GameState,
} from '../src';
import { quickStart } from './helpers';

const BASE: Record<'cubic' | 'community', GameState> = { cubic: quickStart(2, 1, 'cubic'), community: quickStart(2, 1, 'community') };

/** Player 0 to act with 3 fresh actions, only the listed ships on the map, and the given skills. */
function scenario(dice: Record<string, [number, number, number]>, mode: 'cubic' | 'community' = 'cubic', skills: string[] = []): GameState {
  const s = structuredClone(BASE[mode]);
  for (const d of s.dice) if (d.loc.zone === 'board') d.loc = { zone: 'scrapyard' };
  for (const [id, [r, c, value]] of Object.entries(dice)) {
    const d = s.dice.find((x) => x.id === id)!;
    d.loc = { zone: 'board', r, c };
    d.value = value;
  }
  for (const p of s.players) p.skills = p.id === 0 ? skills.map((id) => ({ id, active: true })) : [];
  s.turn = { ...s.turn, player: 0, phase: 'actions', actionsLeft: 3, moved: {}, abilityUsed: {}, seen: {}, conquests: 0, oncePerTurn: [] };
  for (const d of s.dice) s.turn.seen[d.id] = [d.value];
  return s;
}

const at = (s: GameState, id: string) => s.dice.find((d) => d.id === id)!;
const moves = (s: GameState, id: string) => [...moveOptions(s, id).moves.keys()];
const farthest = (s: GameState, id: string) => Math.max(...[...moveOptions(s, id).moves.values()].map((m) => m.steps));
const offered = (s: GameState, type: Action['type']) => legalActions(s).filter((a) => a.type === type);

describe('Cubic mode', () => {
  it('is listed after the official modes and plays like Community otherwise', () => {
    expect(MODES.map((m) => m.id)).toEqual(['basic', 'original', 'community', 'cubic'] satisfies GameMode[]);
    const cubic = rulesOf(BASE.cubic);
    const community = rulesOf(BASE.community);
    expect(cubic.cards).toBe(community.cards);
    expect(cubic.startingMissiles).toBe(1);
    expect(cubic.maxMovement).toBe(3);
    expect([4, 5, 6].map((v) => cubic.ships[v].power)).toEqual(['picket', 'shoot', 'beacon']);
    expect([1, 2, 3].map((v) => cubic.ships[v])).toEqual([1, 2, 3].map((v) => community.ships[v]));
  });

  it('leaves the official modes alone: classic ships, no movement cap', () => {
    for (const mode of ['basic', 'original', 'community'] as const) {
      const rules = rulesOf(quickStart(2, 1, mode));
      expect(rules.ships, mode).toBe(CLASSIC_SHIPS);
      expect(rules.maxMovement, mode).toBeUndefined();
    }
    const s = scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 4], p1d1: [8, 8, 6] }, 'community');
    expect(offered(s, 'shoot')).toEqual([]);
    expect(picketZone(s, 0, shipsByIndex(s))).toBeUndefined();
    // A Scout opens no deploy spaces a Destroyer in its place wouldn't (in Cubic it does: Beacon).
    const targets = (mode: 'cubic' | 'community', value: number) =>
      deployTargets(scenario({ p1d1: [5, 5, value] }, mode), 1).map(key).sort();
    expect(targets('community', 6)).toEqual(targets('community', 3));
    expect(targets('cubic', 6).length).toBeGreaterThan(targets('cubic', 3).length);
  });
});

describe('movement cap', () => {
  it('caps the die value at 3', () => {
    for (const value of [3, 4, 5, 6]) expect(farthest(scenario({ p0d0: [0, 0, value] }), 'p0d0'), `a ${value}`).toBe(3);
    expect(farthest(scenario({ p0d0: [0, 0, 2] }), 'p0d0')).toBe(2);
    expect(farthest(scenario({ p0d0: [0, 0, 6] }, 'community'), 'p0d0')).toBe(6);
  });

  it('applies before skill bonuses: a 6 with Agile moves 4 (ruling 2026-10-08)', () => {
    expect(farthest(scenario({ p0d0: [0, 0, 6] }, 'cubic', ['agile']), 'p0d0')).toBe(4);
    expect(farthest(scenario({ p0d0: [0, 0, 2] }, 'cubic', ['agile']), 'p0d0')).toBe(3);
  });
});

describe('classic 4, 5 and 6 abilities are gone', () => {
  it('a Frigate cannot change, a Scout cannot reconfigure for free', () => {
    const s = scenario({ p0d0: [0, 0, 4], p0d1: [0, 8, 6] });
    expect(offered(s, 'change')).toEqual([]);
    expect(offered(s, 'freeReconfigure')).toEqual([]);
    expect(() => apply(s, { type: 'change', die: 'p0d0', value: 3 })).toThrow(/ability/);
    expect(() => apply(s, { type: 'freeReconfigure', die: 'p0d1' })).toThrow(/ability/);
  });

  it('an Interceptor never moves diagonally', () => {
    const s = scenario({ p0d0: [2, 2, 5] });
    expect([...moveOptions(s, 'p0d0').moves.values()].every((m) => !m.diagonal)).toBe(true);
    expect([...moveOptions(scenario({ p0d0: [2, 2, 5] }, 'community'), 'p0d0').moves.values()].some((m) => m.diagonal)).toBe(true);
  });

  it('the 1, 2 and 3 keep theirs', () => {
    const s = scenario({ p0d0: [0, 0, 1], p0d1: [0, 4, 3], p1d0: [0, 1, 4] });
    expect(offered(s, 'freeAttack')).toHaveLength(1);
    expect(offered(s, 'swap')).toHaveLength(1);
  });
});

describe('Picket (4 Frigate)', () => {
  // An enemy Frigate at (1,2) pickets (0,1)–(0,3), (1,3) and (2,1)–(2,3).
  const picket = (me: [number, number, number], extra: Record<string, [number, number, number]> = {}) =>
    scenario({ p0d0: me, p1d0: [1, 2, 4], ...extra });

  it('stops an enemy ship that moves into a surrounding space', () => {
    const s = picket([0, 0, 3]);
    expect(moves(s, 'p0d0')).toContain(key({ r: 0, c: 1 }));
    expect(moves(s, 'p0d0')).not.toContain(key({ r: 0, c: 2 }));
    expect(moves(s, 'p0d0')).not.toContain(key({ r: 0, c: 3 }));
    // Without Picket the same ship reaches (0,3) along the top row.
    expect(moves(scenario({ p0d0: [0, 0, 3], p1d0: [1, 2, 4] }, 'community'), 'p0d0')).toContain(key({ r: 0, c: 3 }));
  });

  it('lets a ship that starts next to the Frigate move away', () => {
    expect(moves(picket([2, 2, 3]), 'p0d0')).toContain(key({ r: 5, c: 2 }));
  });

  it('still lets the stopped ship attack from there', () => {
    const s = picket([0, 0, 3], { p1d1: [0, 2, 2] });
    const attack = moveOptions(s, 'p0d0').attacks.get('p1d1');
    expect(attack?.from).toEqual({ r: 0, c: 1 });
  });

  it('does not stop its own side', () => {
    const s = scenario({ p0d0: [0, 0, 3], p0d1: [1, 2, 4] });
    expect(moves(s, 'p0d0')).toContain(key({ r: 0, c: 3 }));
  });

  it('agrees with the AI’s fast reach search', () => {
    for (const me of [[0, 0, 3], [2, 2, 3], [0, 4, 6]] as [number, number, number][]) {
      const s = picket(me, { p1d1: [0, 2, 2] });
      const fast = shipReach(s, at(s, 'p0d0'), shipsByIndex(s));
      const opts = moveOptions(s, 'p0d0');
      expect(fast.count).toBe(opts.moves.size);
      expect(fast.attacks.map((d) => d.id).sort()).toEqual([...opts.attacks.keys()].sort());
    }
  });
});

describe('Shoot (5 Interceptor)', () => {
  /** Shoots and fixes both combat rolls (lower total wins). */
  function shoot(s: GameState, target: string, attackerRoll: number, defenderRoll: number) {
    s = apply(s, { type: 'shoot', die: 'p0d0', target });
    const c = s.pending[0];
    if (c?.kind !== 'combat') throw new Error('no combat');
    c.attacker.dice = [attackerRoll];
    c.defender.dice = [defenderRoll];
    return apply(s, { type: 'resolveCombat' });
  }
  const mine = (s: GameState, type: Action['type']) => legalActions(s).filter((a) => a.type === type && 'die' in a && a.die === 'p0d0');

  it('attacks a ship 2 spaces away, and stays put when it wins', () => {
    const s0 = scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3] });
    expect(offered(s0, 'shoot')).toEqual([{ type: 'shoot', die: 'p0d0', target: 'p1d0' }]);
    const s = shoot(s0, 'p1d0', 1, 6);
    expect(at(s, 'p1d0').loc.zone).toBe('scrapyard');
    expect(at(s, 'p0d0').loc).toEqual({ zone: 'board', r: 0, c: 0 });
    expect(s.pending.some((p) => p.kind === 'advance')).toBe(false);
    expect(s.players[0].dominance).toBeGreaterThan(BASE.cubic.players[0].dominance);
  });

  it('shoot, then move: one action for both, and no attack after', () => {
    const s = shoot(scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3], p1d1: [3, 0, 2] }), 'p1d0', 6, 1);
    expect(s.turn.actionsLeft).toBe(2);
    expect(mine(s, 'shoot')).toEqual([]);
    expect(mine(s, 'attack')).toEqual([]);
    expect(() => apply(s, { type: 'attack', die: 'p0d0', target: 'p1d1' })).toThrow(/fired/);
    const moved = apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 1 } });
    expect(moved.turn.actionsLeft).toBe(2);
    expect(mine(moved, 'move')).toEqual([]);
  });

  it('move, then shoot: the shot is free', () => {
    const s0 = scenario({ p0d0: [0, 0, 5], p1d0: [0, 4, 3] });
    expect(shootTargets(s0, 'p0d0')).toEqual([]);
    const moved = apply(s0, { type: 'move', die: 'p0d0', to: { r: 0, c: 2 } });
    expect(moved.turn.actionsLeft).toBe(2);
    const s = shoot(moved, 'p1d0', 1, 6);
    expect(s.turn.actionsLeft).toBe(2);
    expect(at(s, 'p0d0').loc).toEqual({ zone: 'board', r: 0, c: 2 });
    expect(mine(s, 'shoot')).toEqual([]);
  });

  it('not after a normal attack', () => {
    const s0 = scenario({ p0d0: [0, 0, 5], p1d0: [0, 1, 6], p1d1: [2, 0, 3] });
    const s = apply(s0, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    const resolved = apply(s, { type: 'resolveCombat' });
    expect(shootTargets(resolved.pending.length ? apply(resolved, { type: 'advance', move: false }) : resolved, 'p0d0')).toEqual([]);
  });

  it('reaches 1 or 2 spaces in a straight line, diagonals included', () => {
    const ids = (s: GameState) => shootTargets(s, 'p0d0').map((d) => d.id).sort();
    expect(ids(scenario({ p0d0: [0, 2, 5], p1d0: [0, 3, 3], p1d1: [1, 3, 2], p1d2: [2, 2, 6] }))).toEqual(['p1d0', 'p1d1', 'p1d2']);
    expect(ids(scenario({ p0d0: [0, 2, 5], p1d0: [2, 4, 1] }))).toEqual(['p1d0']);
    // Not a knight's move, and not 3 away.
    expect(ids(scenario({ p0d0: [0, 2, 5], p1d0: [1, 0, 3], p1d1: [0, 5, 2] }))).toEqual([]);
  });

  it('needs an empty space in between at range 2, and an enemy', () => {
    expect(shootTargets(scenario({ p0d0: [0, 0, 5], p0d1: [0, 1, 2], p1d0: [0, 2, 3] }), 'p0d0')).toEqual([]);
    expect(shootTargets(scenario({ p0d0: [1, 0, 5], p1d0: [1, 2, 3] }), 'p0d0')).toEqual([]); // a planet in between
    expect(shootTargets(scenario({ p0d0: [0, 0, 5], p1d0: [2, 2, 3] }), 'p0d0')).toEqual([]); // a planet on the diagonal
    expect(shootTargets(scenario({ p0d0: [0, 2, 5], p0d1: [1, 3, 1], p1d0: [2, 4, 3] }), 'p0d0')).toEqual([]);
    expect(shootTargets(scenario({ p0d0: [0, 0, 5], p0d1: [0, 2, 3] }), 'p0d0')).toEqual([]);
    expect(shootTargets(scenario({ p0d0: [0, 0, 5], p1d0: [0, 3, 3] }), 'p0d0')).toEqual([]);
  });

  it('only a Cubic Interceptor can shoot', () => {
    expect(shootTargets(scenario({ p0d0: [0, 0, 4], p1d0: [0, 2, 3] }), 'p0d0')).toEqual([]);
    const community = scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3] }, 'community');
    expect(() => apply(community, { type: 'shoot', die: 'p0d0', target: 'p1d0' })).toThrow();
  });
});

describe('Beacon (6 Scout)', () => {
  it('lets its owner deploy into the empty spaces around it', () => {
    const s = scenario({ p0d0: [2, 2, 6], p0d1: [3, 3, 1] });
    const targets = deployTargets(s, 0).map(key);
    // (1,1) is a planet and (3,3) is taken: 6 of the 8 surrounding cells.
    for (const c of [[1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2]]) expect(targets).toContain(key({ r: c[0], c: c[1] }));
    expect(targets).not.toContain(key({ r: 3, c: 3 }));
    const scrap = s.dice.find((d) => d.owner === 0 && d.loc.zone === 'scrapyard')!;
    const deployed = apply(s, { type: 'deploy', die: scrap.id, to: { r: 3, c: 1 } });
    expect(at(deployed, scrap.id).loc).toEqual({ zone: 'board', r: 3, c: 1 });
  });

  it('only works for its owner, only on the map, and only in Cubic', () => {
    const near = (s: GameState, p: number) => deployTargets(s, p).map(key).includes(key({ r: 2, c: 3 }));
    expect(near(scenario({ p0d0: [2, 2, 6] }), 1)).toBe(false);
    expect(near(scenario({ p0d1: [8, 8, 1] }), 0)).toBe(false);
    expect(near(scenario({ p0d0: [2, 2, 6] }, 'community'), 0)).toBe(false);
  });
});
