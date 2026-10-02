/**
 * Basic mode, rule by rule, against the 2013 FunForge rulebook
 * (reference/original-2013/Quantum_rules_US.pdf). Page numbers are the printed ones.
 * Basic mode is those rules with the advance cards left out.
 *
 * Scenarios run on Alpha Sector, the basic map for 2 players (9×9 spaces). Planets, by id:
 *
 *    id0 (1,1) 7*   id1 (1,4) 7    id2 (1,7) 7
 *    id3 (4,1) 7    id4 (4,4) 8    id5 (4,7) 7
 *    id6 (7,1) 7    id7 (7,4) 7    id8 (7,7) 7*
 */
import { describe, expect, it } from 'vitest';
import {
  apply,
  carryOptions,
  conquerCheck,
  createGame,
  infamyTargets,
  legalActions,
  moveOptions,
  type Action,
  type Cell,
  type GameState,
} from '../src';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, color: '#fff', ai: true }));

function quickStart(n = 2, seed = 1): GameState {
  let s = createGame({ players: players(n), seed, mode: 'basic' });
  while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
  return s;
}

const BASE = quickStart();

/**
 * A focused position: player 0 to act with 3 fresh actions, only the listed ships on the map
 * (everything else in the scrapyard, reserves untouched) and only the listed cubes placed.
 */
function scenario(
  dice: Record<string, [number, number, number]>,
  cubes: Record<number, number[]> = { 2: [0], 6: [1] },
): GameState {
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

const at = (s: GameState, id: string) => s.dice.find((d) => d.id === id)!;
const loc = (s: GameState, id: string) => at(s, id).loc;
const board = (r: number, c: number) => ({ zone: 'board', r, c });

/** Declares an attack and fixes both combat rolls. */
function attack(s: GameState, action: Action, attackerRoll: number, defenderRoll: number): GameState {
  s = apply(s, action);
  const c = s.pending[0];
  if (c?.kind !== 'combat') throw new Error('no combat');
  c.attacker.dice = [attackerRoll];
  c.defender.dice = [defenderRoll];
  return s;
}

const resolve = (s: GameState) => apply(s, { type: 'resolveCombat' });

// ---------------------------------------------------------------------------

describe('setup (p.3)', () => {
  it('uses the official second-printing basic maps (designer errata, BGG thread 1087563)', () => {
    const numbers = (s: GameState) => s.board.planets.map((p) => (p.start ? `${p.number}*` : `${p.number}`)).join(' ');
    const game = (n: number) => createGame({ players: players(n), seed: 1, mode: 'basic' });
    expect(numbers(game(2))).toBe('7* 7 7 7 8 7 7 7 7*');
    expect(numbers(game(3))).toBe('8* 9 8* 8 9 8 8 7* 8');
    expect(numbers(game(4))).toBe('8* 9 8* 8 10 8 9* 8 9*');
  });

  it('gives each player 5 cubes, dominance and research at 1, 3 ships and 2 expansion ships, no cards or missiles', () => {
    const s = createGame({ players: players(2), seed: 1, mode: 'basic' });
    for (const p of s.players) {
      expect(p).toMatchObject({ cubesLeft: 5, dominance: 1, research: 1, missiles: 0, skills: [] });
      expect(s.dice.filter((d) => d.owner === p.id && d.loc.zone === 'scrapyard')).toHaveLength(3);
      expect(s.dice.filter((d) => d.owner === p.id && d.loc.zone === 'reserve')).toHaveLength(2);
    }
    expect(s.market.skillRow).toEqual([]);
    expect(s.market.tacticRow).toEqual([]);
    expect(s.market.expansions).toBe(0);
  });

  it('allows one re-roll of all 3 starting ships', () => {
    let s = createGame({ players: players(2), seed: 5, mode: 'basic' });
    s = apply(s, { type: 'setupReroll' });
    expect(() => apply(s, { type: 'setupReroll' })).toThrow(/only re-roll once/);
    expect(legalActions(s)).toEqual([{ type: 'setupKeep' }]);
  });

  it('lets the player with the lowest ship total go first', () => {
    let s = createGame({ players: players(3), seed: 5, mode: 'basic' });
    const values = [[6, 6, 6], [2, 2, 2], [5, 5, 5]];
    for (const d of s.dice) if (d.loc.zone === 'scrapyard') d.value = values[d.owner][0];
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'setupKeep' });
    expect(s.turn.player).toBe(1);
    expect(s.pending.map((p) => p.kind === 'placeStart' && p.player)).toEqual([1, 2, 0]);
  });

  it('places every cube first, then each player arranges their own 3 ships in orbital positions', () => {
    let s = createGame({ players: players(2), seed: 1, mode: 'basic' });
    s = apply(apply(s, { type: 'setupKeep' }), { type: 'setupKeep' });
    const first = s.turn.player;
    const other = 1 - first;
    s = apply(s, { type: 'placeStart', planet: 0 });
    expect(s.pending.map((p) => p.kind)).toEqual(['placeStart', 'placeShips']);
    expect(() => apply(s, { type: 'placeStart', planet: 0 })).toThrow(/taken/);
    expect(() => apply(s, { type: 'placeStart', planet: 4 })).toThrow(/starting planet/);
    s = apply(s, { type: 'placeStart', planet: 8 });
    expect(s.pending.map((p) => p.kind === 'placeShips' && p.player)).toEqual([first, other]);

    const [a, b, c] = s.dice.filter((d) => d.owner === first && d.loc.zone === 'scrapyard').map((d) => d.id);
    const reserveDie = s.dice.find((d) => d.owner === first && d.loc.zone === 'reserve')!.id;
    // Planet id0 is at (1,1): its orbital positions are (0,1), (2,1), (1,0) and (1,2).
    expect(() => apply(s, { type: 'placeShip', die: a, to: { r: 0, c: 0 } })).toThrow(/orbital/); // diagonal
    expect(() => apply(s, { type: 'placeShip', die: a, to: { r: 6, c: 7 } })).toThrow(/orbital/); // opponent's planet
    expect(() => apply(s, { type: 'placeShip', die: reserveDie, to: { r: 0, c: 1 } })).toThrow(/starting ships/);
    s = apply(s, { type: 'placeShip', die: c, to: { r: 1, c: 0 } });
    s = apply(s, { type: 'placeShip', die: a, to: { r: 1, c: 2 } });
    expect(s.pending[0]).toMatchObject({ kind: 'placeShips', player: first });
    s = apply(s, { type: 'placeShip', die: b, to: { r: 2, c: 1 } });
    expect(loc(s, a)).toEqual(board(1, 2));
    expect(loc(s, b)).toEqual(board(2, 1));
    expect(loc(s, c)).toEqual(board(1, 0));
    expect(s.pending[0]).toMatchObject({ kind: 'placeShips', player: other });

    while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
    expect(s.turn).toMatchObject({ player: first, actionsLeft: 3, phase: 'actions' });
    for (const p of s.players) expect(p.cubesLeft).toBe(4);
  });
});

describe('turns and actions (p.4)', () => {
  it('gives 3 actions; unused actions do not carry over', () => {
    let s = scenario({ p0d0: [0, 0, 3] });
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 1 } });
    expect(s.turn.actionsLeft).toBe(2);
    s = apply(s, { type: 'endTurn' });
    expect(s.turn).toMatchObject({ player: 1, actionsLeft: 3 });
    s = apply(s, { type: 'endTurn' });
    expect(s.turn).toMatchObject({ player: 0, actionsLeft: 3 });
  });

  it('allows the same action more than once, but no more than 3 actions', () => {
    let s = scenario({ p0d0: [0, 0, 1], p0d1: [2, 0, 1], p0d2: [3, 3, 1], p0d3: [5, 5, 1] }, { 2: [0], 6: [1] });
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 1 } });
    s = apply(s, { type: 'move', die: 'p0d1', to: { r: 3, c: 0 } });
    s = apply(s, { type: 'move', die: 'p0d2', to: { r: 3, c: 2 } });
    expect(() => apply(s, { type: 'move', die: 'p0d3', to: { r: 5, c: 6 } })).toThrow(/No actions left/);
  });

  it('passes the turn clockwise', () => {
    let s = quickStart(3, 2);
    const first = s.turn.player;
    s = apply(s, { type: 'endTurn' });
    expect(s.turn.player).toBe((first + 1) % 3);
  });

  it('has no research action and no card phase in Basic mode', () => {
    let s = scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 2] });
    expect(() => apply(s, { type: 'research' })).toThrow(/no research/);
    s = apply(s, { type: 'conquer', planet: 4 });
    s = apply(s, { type: 'endTurn' });
    expect(s.pending).toEqual([]);
    expect(s.turn.player).toBe(1);
  });
});

describe('reconfigure (p.5)', () => {
  it('re-rolls a ship on the map to a different number for 1 action', () => {
    let s = scenario({ p0d0: [0, 0, 4] });
    for (let i = 0; i < 3; i++) {
      const before = at(s, 'p0d0').value;
      s = apply(s, { type: 'reconfigure', die: 'p0d0' });
      expect(at(s, 'p0d0').value).not.toBe(before);
    }
    expect(s.turn.actionsLeft).toBe(0);
  });

  it('can re-roll a ship in the scrapyard, but not an expansion ship', () => {
    const s = scenario({});
    const before = at(s, 'p0d1').value;
    const next = apply(s, { type: 'reconfigure', die: 'p0d1' });
    expect(at(next, 'p0d1').value).not.toBe(before);
    expect(loc(next, 'p0d1')).toEqual({ zone: 'scrapyard' });
    expect(legalActions(s)).toContainEqual({ type: 'reconfigure', die: 'p0d1' });
    expect(() => apply(s, { type: 'reconfigure', die: 'p0d3' })).toThrow(/cannot be reconfigured/);
  });

  it('does not give a ship that already moved a second move', () => {
    let s = scenario({ p0d0: [0, 0, 2] });
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 2 } });
    s = apply(s, { type: 'reconfigure', die: 'p0d0' });
    expect(() => apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 3 } })).toThrow(/already moved/);
  });
});

describe('deploy (p.5)', () => {
  // Player 0's cube is on planet id2 (1,7).
  it('moves a scrapyard ship to an empty orbital position of a planet with your cube', () => {
    let s = scenario({ p0d0: [0, 7, 3] });
    expect(() => apply(s, { type: 'deploy', die: 'p0d1', to: { r: 0, c: 7 } })).toThrow(/orbit/); // occupied
    expect(() => apply(s, { type: 'deploy', die: 'p0d1', to: { r: 0, c: 6 } })).toThrow(/orbit/); // diagonal
    expect(() => apply(s, { type: 'deploy', die: 'p0d1', to: { r: 0, c: 4 } })).toThrow(/orbit/); // planet without your cube
    const value = at(s, 'p0d1').value;
    s = apply(s, { type: 'deploy', die: 'p0d1', to: { r: 2, c: 7 } });
    expect(at(s, 'p0d1')).toMatchObject({ value, loc: board(2, 7) });
    expect(s.turn.actionsLeft).toBe(2);
  });

  it('is not the ship’s move: it can deploy and move in the same turn', () => {
    let s = scenario({});
    s = apply(s, { type: 'deploy', die: 'p0d1', to: { r: 2, c: 7 } });
    at(s, 'p0d1').value = 2;
    s = apply(s, { type: 'move', die: 'p0d1', to: { r: 3, c: 6 } });
    expect(s.turn.actionsLeft).toBe(1);
  });

  it('never deploys the expansion ships', () => {
    const s = scenario({});
    expect(() => apply(s, { type: 'deploy', die: 'p0d3', to: { r: 2, c: 7 } })).toThrow(/not in the scrapyard/);
  });
});

describe('move (p.6)', () => {
  const dests = (s: GameState, id: string) => [...moveOptions(s, id).moves.keys()].sort();

  it('moves orthogonally up to the die number, turning as often as needed', () => {
    const s = scenario({ p0d0: [3, 3, 2] });
    expect(dests(s, 'p0d0')).toEqual(
      ['1,3', '2,3', '2,2', '2,4', '3,2', '3,1', '3,4', '3,5', '4,3', '4,2', '5,3'].sort(),
    );
    expect(moveOptions(s, 'p0d0').moves.get('2,2')?.steps).toBe(2);
  });

  it('treats planets as obstacles to move around', () => {
    // (1,0) → (1,2) is blocked by planet (1,1); the way around takes 4 steps.
    expect(dests(scenario({ p0d0: [1, 0, 2] }, {}), 'p0d0')).not.toContain('1,2');
    expect(dests(scenario({ p0d0: [1, 0, 4] }, {}), 'p0d0')).toContain('1,2');
  });

  it('cannot pass through or land on ships, friendly or enemy', () => {
    const s = scenario({ p0d0: [0, 0, 6], p0d1: [0, 1, 3], p1d0: [1, 0, 3] });
    expect(dests(s, 'p0d0')).toEqual([]);
  });

  it('moves each ship only once per turn', () => {
    let s = scenario({ p0d0: [0, 0, 3] });
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 1 } });
    expect(() => apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 2 } })).toThrow(/already moved/);
  });
});

describe('attack (p.6)', () => {
  it('costs a movement point to enter the enemy square', () => {
    const range = (value: number, enemyCol: number) =>
      moveOptions(scenario({ p0d0: [0, 0, value], p1d0: [0, enemyCol, 6] }), 'p0d0').attacks.has('p1d0');
    expect(range(1, 1)).toBe(true);
    expect(range(1, 2)).toBe(false);
    expect(range(3, 3)).toBe(true);
    expect(range(3, 4)).toBe(false);
  });

  it('ends the ship’s movement and costs 1 action', () => {
    let s = scenario({ p0d0: [0, 0, 3], p1d0: [0, 2, 1] });
    s = resolve(attack(s, { type: 'attack', die: 'p0d0', target: 'p1d0' }, 6, 1));
    expect(s.turn.actionsLeft).toBe(2);
    expect(() => apply(s, { type: 'move', die: 'p0d0', to: { r: 1, c: 0 } })).toThrow(/already moved/);
  });

  it('attacker wins ties: defender is re-rolled into the scrapyard, dominance +1 / −1', () => {
    let s = scenario({ p0d0: [0, 0, 3], p1d0: [0, 2, 4] });
    s.players[1].dominance = 3;
    s = resolve(attack(s, { type: 'attack', die: 'p0d0', target: 'p1d0' }, 3, 2)); // 6 vs 6
    expect(loc(s, 'p1d0')).toEqual({ zone: 'scrapyard' });
    expect(at(s, 'p1d0').rolls).toBeGreaterThan(at(BASE, 'p1d0').rolls);
    expect(s.players[0].dominance).toBe(2);
    expect(s.players[1].dominance).toBe(2);
  });

  it('lets the winner move into the defender’s square or stay where it attacked from', () => {
    const won = resolve(attack(scenario({ p0d0: [0, 0, 3], p1d0: [0, 2, 4] }), { type: 'attack', die: 'p0d0', target: 'p1d0' }, 1, 6));
    expect(won.pending[0]).toMatchObject({ kind: 'advance', player: 0 });
    expect(loc(apply(won, { type: 'advance', move: true }), 'p0d0')).toEqual(board(0, 2));
    expect(loc(apply(won, { type: 'advance', move: false }), 'p0d0')).toEqual(board(0, 1));
  });

  it('a repelled attacker moves back to the square it attacked from; nobody loses anything', () => {
    let s = scenario({ p0d0: [0, 0, 6], p1d0: [0, 2, 1] });
    s.players[0].dominance = 4;
    s = resolve(attack(s, { type: 'attack', die: 'p0d0', target: 'p1d0' }, 1, 1)); // 7 vs 2
    expect(at(s, 'p0d0')).toMatchObject({ value: 6, loc: board(0, 1) });
    expect(loc(s, 'p1d0')).toEqual(board(0, 2));
    expect(s.players[0].dominance).toBe(4);
    expect(s.players[1].dominance).toBe(1);
    expect(s.pending).toEqual([]);
  });

  it('keeps dominance between 1 and 6', () => {
    let s = scenario({ p0d0: [0, 0, 1], p1d0: [0, 1, 6] });
    s = resolve(attack(s, { type: 'attack', die: 'p0d0', target: 'p1d0' }, 1, 6));
    expect(s.players[1].dominance).toBe(1);
  });
});

describe('construct (p.7)', () => {
  // Planet id4 is an 8 at (4,4): orbitals (3,4) (5,4) (4,3) (4,5).
  it('needs your orbital ships to add up exactly to the planet number', () => {
    expect(conquerCheck(scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 2] }), 0, 4).ok).toBe(true);
    expect(conquerCheck(scenario({ p0d0: [3, 4, 5], p0d1: [5, 4, 2], p0d2: [4, 3, 1] }), 0, 4).ok).toBe(true);
    expect(conquerCheck(scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 3] }), 0, 4).ok).toBe(false);
    expect(conquerCheck(scenario({ p0d0: [3, 4, 4], p0d1: [5, 4, 3] }), 0, 4).ok).toBe(false);
  });

  it('counts all of your orbital ships — you cannot leave one out', () => {
    expect(conquerCheck(scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 2], p0d2: [4, 3, 1] }), 0, 4).ok).toBe(false);
  });

  it('ignores diagonal ships and enemy ships', () => {
    const s = scenario({ p0d0: [3, 4, 5], p0d1: [5, 4, 3], p0d2: [3, 3, 1], p1d0: [4, 3, 2], p1d1: [4, 5, 1] });
    expect(conquerCheck(s, 0, 4)).toMatchObject({ ok: true, sum: 8 });
  });

  it('uses 2 actions and places a cube', () => {
    let s = scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 2] });
    s = apply(s, { type: 'conquer', planet: 4 });
    expect(s.board.planets[4].cubes).toEqual([0]);
    expect(s.players[0].cubesLeft).toBe(3);
    expect(s.turn.actionsLeft).toBe(1);
    s.turn.actionsLeft = 1;
    s.board.planets[4].cubes = [];
    expect(() => apply(s, { type: 'conquer', planet: 4 })).toThrow(/Needs 2 actions/);
  });

  it('allows only one of your cubes per planet, but different players may share one', () => {
    const ships = { p0d0: [3, 4, 6], p0d1: [5, 4, 2] } as Record<string, [number, number, number]>;
    expect(conquerCheck(scenario(ships, { 2: [0], 6: [1], 4: [0] }), 0, 4)).toMatchObject({ ok: false, reason: 'You already have a cube here' });
    expect(conquerCheck(scenario(ships, { 2: [0], 6: [1], 4: [1] }), 0, 4).ok).toBe(true);
    expect(conquerCheck(scenario(ships, { 2: [0], 6: [1], 4: [1, 1] }), 0, 4)).toMatchObject({ ok: false, reason: 'No empty cube location' });
  });

  it('size-7 planets hold 1 cube, 8 hold 2, 9 hold 3, 10 hold 4', () => {
    const caps = (n: number) => quickStart(n, 1).board.planets.map((p) => [p.number, p.capacity]);
    for (const [num, cap] of [...caps(2), ...caps(3), ...caps(4)]) expect(cap).toBe(num - 6);
  });
});

describe('ship abilities (p.8)', () => {
  it('cost no action and can still be used after the third action', () => {
    let s = scenario({ p0d0: [0, 0, 3], p0d1: [8, 8, 6] });
    s.turn.actionsLeft = 0;
    s = apply(s, { type: 'swap', die: 'p0d0', other: 'p0d1' });
    s = apply(s, { type: 'freeReconfigure', die: 'p0d1' });
    expect(s.turn.actionsLeft).toBe(0);
  });

  it('only ships on the map, on your own turn', () => {
    const s = scenario({ p1d0: [0, 0, 3], p1d1: [8, 8, 3] });
    expect(() => apply(s, { type: 'swap', die: 'p1d0', other: 'p1d1' })).toThrow(/Not your ship/);
    const scrap = scenario({});
    at(scrap, 'p0d0').value = 6;
    expect(() => apply(scrap, { type: 'freeReconfigure', die: 'p0d0' })).toThrow(/not on the map/);
  });

  it('one ability per die per turn, even if its number changes', () => {
    let s = scenario({ p0d0: [0, 0, 4], p0d1: [8, 8, 2] });
    s = apply(s, { type: 'change', die: 'p0d0', value: 3 });
    expect(() => apply(s, { type: 'swap', die: 'p0d0', other: 'p0d1' })).toThrow(/already used its ability/);
  });

  it('1 Battlestation — Strike: a free 1-space attack, even after moving and attacking', () => {
    let s = scenario({ p0d0: [0, 2, 1], p1d0: [0, 4, 1] });
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 3 } });
    s = resolve(attack(s, { type: 'freeAttack', die: 'p0d0', target: 'p1d0' }, 6, 1));
    expect(s.turn.actionsLeft).toBe(2);
    expect(loc(s, 'p0d0')).toEqual(board(0, 3));

    let t = scenario({ p0d0: [0, 3, 1], p1d0: [0, 4, 1] });
    t = resolve(attack(t, { type: 'attack', die: 'p0d0', target: 'p1d0' }, 6, 1));
    t = attack(t, { type: 'freeAttack', die: 'p0d0', target: 'p1d0' }, 1, 6);
    t = apply(resolve(t), { type: 'advance', move: true });
    expect(loc(t, 'p0d0')).toEqual(board(0, 4));
    expect(t.turn.actionsLeft).toBe(2);
  });

  it('Strike reaches orthogonal neighbours only', () => {
    const s = scenario({ p0d0: [0, 3, 1], p1d0: [2, 4, 1] });
    expect(() => apply(s, { type: 'freeAttack', die: 'p0d0', target: 'p1d0' })).toThrow(/adjacent/);
  });

  it('2 Flagship — Transport: carry a ship from a surrounding space, move 1–2, drop it in a surrounding space', () => {
    const base = scenario({ p0d0: [2, 2, 2], p0d1: [3, 3, 5] });
    const carry = (to: Cell, drop: Cell): Action => ({ type: 'carry', die: 'p0d0', passenger: 'p0d1', to, drop });
    expect(() => apply(base, carry({ r: 2, c: 5 }, { r: 3, c: 5 }))).toThrow(/Invalid carry/); // 3 spaces
    expect(() => apply(base, carry({ r: 2, c: 4 }, { r: 5, c: 5 }))).toThrow(/Invalid carry/); // too far to drop
    let s = apply(base, carry({ r: 2, c: 4 }, { r: 3, c: 5 }));
    expect(loc(s, 'p0d0')).toEqual(board(2, 4));
    expect(loc(s, 'p0d1')).toEqual(board(3, 5));
    expect(s.turn.actionsLeft).toBe(2);
    // The transport was the flagship's move; the passenger may still move.
    expect(() => apply(s, { type: 'move', die: 'p0d0', to: { r: 2, c: 5 } })).toThrow(/already moved/);
    s = apply(s, { type: 'move', die: 'p0d1', to: { r: 3, c: 6 } });
    expect(loc(s, 'p0d1')).toEqual(board(3, 6));
  });

  it('2 Flagship — Transport may fly out and back, ending where it started (designer, BGG thread 1074052)', () => {
    const s = scenario({ p0d0: [2, 2, 2], p0d1: [3, 3, 5] });
    const back = apply(s, { type: 'carry', die: 'p0d0', passenger: 'p0d1', to: { r: 2, c: 2 }, drop: { r: 1, c: 3 } });
    expect(loc(back, 'p0d0')).toEqual(board(2, 2));
    expect(loc(back, 'p0d1')).toEqual(board(1, 3));
    expect(back.turn.actionsLeft).toBe(2);
    // Boxed in: (2,0)'s neighbours are all occupied, so it cannot move at all and cannot transport.
    const boxed = scenario({ p0d0: [2, 0, 2], p0d1: [3, 1, 5], p0d2: [1, 0, 6], p1d0: [3, 0, 6], p1d1: [2, 1, 6] });
    expect(carryOptions(boxed, 'p0d0', 'p0d1').size).toBe(0);
  });

  it('3 Destroyer — Warp: swap with any of your ships; not the destroyer’s move', () => {
    let s = scenario({ p0d0: [0, 0, 3], p0d1: [8, 8, 6] });
    s = apply(s, { type: 'swap', die: 'p0d0', other: 'p0d1' });
    expect(loc(s, 'p0d0')).toEqual(board(8, 8));
    expect(loc(s, 'p0d1')).toEqual(board(0, 0));
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 8, c: 6 } });
    expect(s.turn.actionsLeft).toBe(2);
  });

  it('4 Frigate — Modify: becomes a 3 or a 5, and cannot use the new ability', () => {
    const s = scenario({ p0d0: [2, 2, 4] });
    expect(() => apply(s, { type: 'change', die: 'p0d0', value: 2 as 3 })).toThrow(/3 or a 5/);
    const five = apply(s, { type: 'change', die: 'p0d0', value: 5 });
    expect(at(five, 'p0d0').value).toBe(5);
    expect(five.turn.actionsLeft).toBe(3);
    const moves = moveOptions(five, 'p0d0').moves;
    expect([...moves.values()].some((m) => m.diagonal)).toBe(false);
    expect(Math.max(...[...moves.values()].map((m) => m.steps))).toBe(5);
  });

  it('5 Interceptor — Maneuver: moves and attacks diagonally, using its ability', () => {
    let s = scenario({ p0d0: [2, 2, 5], p0d1: [2, 3, 6], p0d2: [3, 2, 6], p1d0: [8, 8, 6] });
    expect(moveOptions(s, 'p0d0').moves.get('3,3')).toMatchObject({ diagonal: true, steps: 1 });
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 3, c: 3 } });
    expect(s.turn.abilityUsed.p0d0).toBe(true);

    const diag = scenario({ p0d0: [2, 2, 5], p0d1: [2, 3, 6], p0d2: [3, 2, 6], p1d0: [3, 3, 6] });
    expect(moveOptions(diag, 'p0d0').attacks.get('p1d0')).toMatchObject({ diagonal: true, from: { r: 2, c: 2 } });
  });

  it('6 Scout — Free Reconfigure: re-rolls until it is no longer a 6', () => {
    let s = scenario({ p0d0: [0, 0, 6] });
    s = apply(s, { type: 'freeReconfigure', die: 'p0d0' });
    expect(at(s, 'p0d0').value).not.toBe(6);
    expect(s.turn.actionsLeft).toBe(3);
  });
});

describe('dominance and infamy (p.9)', () => {
  function infamous() {
    let s = scenario({ p0d0: [0, 0, 1], p1d0: [0, 1, 6] });
    s.players[0].dominance = 5;
    s = resolve(attack(s, { type: 'attack', die: 'p0d0', target: 'p1d0' }, 1, 6));
    return apply(s, { type: 'advance', move: false });
  }

  it('places a cube immediately at 6 — on any planet without your cube, no ship needed — then resets to 1', () => {
    let s = infamous();
    expect(s.pending[0]).toMatchObject({ kind: 'infamy', player: 0 });
    expect(s.players[0].dominance).toBe(1);
    expect(infamyTargets(s, 0).map((p) => p.id)).toEqual([0, 1, 3, 4, 5, 7, 8]); // planet 6 is a full 7
    expect(() => apply(s, { type: 'infamy', planet: 2 })).toThrow(/without your cube/);
    s = apply(s, { type: 'infamy', planet: 8 });
    expect(s.board.planets[8].cubes).toEqual([0]);
    expect(s.players[0].cubesLeft).toBe(3);
    // The turn goes on.
    expect(s.turn).toMatchObject({ player: 0, phase: 'actions', actionsLeft: 2 });
  });

  it('cannot place on a full planet', () => {
    const s = infamous();
    s.board.planets[8].cubes = [1];
    expect(() => apply(s, { type: 'infamy', planet: 8 })).toThrow(/without your cube/);
  });
});

describe('quantum entanglement (designer errata, BGG thread 1087563)', () => {
  // Every planet with room already holds player 0's cube: planet 4 (size 8) has one free location.
  const full = { 0: [1], 1: [1], 2: [0], 3: [1], 4: [0], 5: [1], 6: [1], 7: [1], 8: [1] };

  it('lets you build on your own planet only when nothing else is open, at +3 per cube you have there', () => {
    expect(conquerCheck(scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 5] }, full), 0, 4)).toMatchObject({ ok: true, target: 11 });
    expect(conquerCheck(scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 2] }, full), 0, 4).ok).toBe(false);
    const open = { ...full, 8: [] };
    expect(conquerCheck(scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 5] }, open), 0, 4).ok).toBe(false);
  });

  it('applies to Infamy too', () => {
    expect(infamyTargets(scenario({}, full), 0).map((p) => p.id)).toEqual([4]);
  });
});

describe('winning (p.2, p.9)', () => {
  const four = { 0: [0], 1: [0], 2: [0], 3: [0], 6: [1] };

  it('ends the game the moment you construct your final cube', () => {
    let s = scenario({ p0d0: [3, 4, 6], p0d1: [5, 4, 2] }, four);
    expect(s.players[0].cubesLeft).toBe(1);
    s = apply(s, { type: 'conquer', planet: 4 });
    expect(s).toMatchObject({ phase: 'over', winner: 0, pending: [] });
    expect(() => apply(s, { type: 'endTurn' })).toThrow(/over/);
  });

  it('or place it through Infamy', () => {
    let s = scenario({ p0d0: [0, 0, 1], p1d0: [0, 1, 6] }, four);
    s.players[0].dominance = 5;
    s = apply(resolve(attack(s, { type: 'attack', die: 'p0d0', target: 'p1d0' }, 1, 6)), { type: 'advance', move: true });
    s = apply(s, { type: 'infamy', planet: 8 });
    expect(s).toMatchObject({ phase: 'over', winner: 0 });
  });
});
