import { describe, expect, it } from 'vitest';
import {
  apply,
  combatOutcome,
  conquerCheck,
  createGame,
  legalActions,
  isUndoable,
  moveOptions,
  type Action,
  type GameMode,
  type GameState,
  ORIGINAL_COMMAND,
  ORIGINAL_GAMBIT,
} from '../src';
import { chooseAction, chooseMissile } from '../../ai/src';

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `P${i}`, color: '#fff', ai: true }));

/** Runs setup with the first legal choice for every decision. */
function quickStart(n = 2, seed = 1, mode: GameMode = 'community'): GameState {
  let s = createGame({ players: players(n), seed, mode });
  while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
  return s;
}

/** Empties the map and places dice at given cells for focused rule tests. */
function arrange(s: GameState, placements: Record<string, [number, number, number]>): GameState {
  const t = structuredClone(s);
  for (const d of t.dice) if (d.loc.zone === 'board') d.loc = { zone: 'scrapyard' };
  for (const [id, [r, c, value]] of Object.entries(placements)) {
    const d = t.dice.find((x) => x.id === id)!;
    d.loc = { zone: 'board', r, c };
    d.value = value;
    t.turn.seen[id] = [value];
  }
  return t;
}

function checkInvariants(s: GameState) {
  for (const p of s.players) {
    expect(s.dice.filter((d) => d.owner === p.id)).toHaveLength(5);
    expect(p.dominance).toBeGreaterThanOrEqual(1);
    expect(p.dominance).toBeLessThanOrEqual(6);
    expect(p.research).toBeGreaterThanOrEqual(1);
    expect(p.research).toBeLessThanOrEqual(6);
    expect(p.missiles).toBeGreaterThanOrEqual(0);
  }
  for (const pl of s.board.planets) expect(pl.cubes.length).toBeLessThanOrEqual(pl.capacity);
  const occupied = new Set<string>();
  for (const d of s.dice) {
    if (d.loc.zone !== 'board') continue;
    const k = `${d.loc.r},${d.loc.c}`;
    expect(occupied.has(k), `two ships on ${k}`).toBe(false);
    occupied.add(k);
    expect(s.board.cells[d.loc.r][d.loc.c].kind).toBe('space');
  }
}

describe('setup', () => {
  it('ends with every player on a starting planet with 3 ships', () => {
    const s = quickStart(3, 7);
    expect(s.phase).toBe('play');
    for (const p of s.players) {
      expect(s.board.planets.filter((pl) => pl.cubes.includes(p.id))).toHaveLength(1);
      expect(s.dice.filter((d) => d.owner === p.id && d.loc.zone === 'board')).toHaveLength(3);
      expect(p.skills).toHaveLength(1);
      expect(p.cubesLeft).toBe(4);
    }
    expect(s.market.skillRow).toHaveLength(3);
    expect(s.market.tacticRow).toHaveLength(3);
    expect(s.turn.actionsLeft).toBe(3);
  });

  it('is deterministic for a seed', () => {
    expect(quickStart(2, 42)).toEqual(quickStart(2, 42));
  });
});

describe('movement', () => {
  it('moves orthogonally up to the ship value, blocked by planets and ships', () => {
    // Alpha sector: planet tiles centred at (1,1),(1,4)... ship at (0,0)
    const s = arrange(quickStart(), { p0d0: [0, 0, 2], p0d1: [0, 2, 3] });
    const opts = moveOptions(s, 'p0d0');
    const keys = [...opts.moves.keys()].sort();
    expect(keys).toEqual(['0,1', '1,0', '2,0'].sort());
  });

  it('lets an interceptor move diagonally using its ability', () => {
    // Orthogonal paths are preferred; only diagonal-only destinations use the ability.
    const s = arrange(quickStart(), { p0d0: [0, 0, 5] });
    expect(moveOptions(s, 'p0d0').moves.get('2,2')?.diagonal).toBe(false);
    const s2 = arrange(quickStart(), { p0d0: [2, 2, 5], p1d0: [2, 3, 6], p1d1: [3, 2, 6] });
    expect(moveOptions(s2, 'p0d0').moves.get('3,3')?.diagonal).toBe(true);
  });

  it('finds attacks on adjacent enemies within range', () => {
    const s = arrange(quickStart(), { p0d0: [0, 0, 1], p1d0: [0, 1, 6] });
    expect(moveOptions(s, 'p0d0').attacks.has('p1d0')).toBe(true);
  });
});

describe('conquer', () => {
  it('needs orbital ships summing exactly to the planet number', () => {
    let s = quickStart();
    const centre = s.board.planets.find((p) => p.number === 8)!; // (4,4)
    s = arrange(s, { p0d0: [3, 4, 3], p0d1: [5, 4, 5] });
    expect(conquerCheck(s, 0, centre.id).ok).toBe(true);
    s = arrange(s, { p0d0: [3, 4, 3], p0d1: [5, 4, 4] });
    expect(conquerCheck(s, 0, centre.id).ok).toBe(false);
  });

  it('costs 2 actions and places a cube', () => {
    let s = quickStart();
    s.turn.player = 0;
    const centre = s.board.planets.find((p) => p.number === 8)!;
    s = arrange(s, { p0d0: [3, 4, 3], p0d1: [5, 4, 5] });
    s = apply(s, { type: 'conquer', planet: centre.id });
    expect(s.board.planets[centre.id].cubes).toContain(0);
    expect(s.turn.actionsLeft).toBe(1);
    expect(s.players[0].cubesLeft).toBe(3);
  });
});

describe('combat', () => {
  it('attacker wins ties, gains dominance, defender goes to the scrapyard', () => {
    let s = quickStart();
    s.turn.player = 0;
    s = arrange(s, { p0d0: [0, 0, 2], p1d0: [0, 1, 2] });
    s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    const combat = s.pending[0];
    expect(combat.kind).toBe('combat');
    if (combat.kind !== 'combat') return;
    combat.attacker.dice = [4];
    combat.defender.dice = [4];
    s = apply(s, { type: 'resolveCombat' });
    expect(s.dice.find((d) => d.id === 'p1d0')!.loc.zone).toBe('scrapyard');
    expect(s.players[0].dominance).toBe(2);
    expect(s.pending[0].kind).toBe('advance');
    s = apply(s, { type: 'advance', move: true });
    expect(s.dice.find((d) => d.id === 'p0d0')!.loc).toEqual({ zone: 'board', r: 0, c: 1 });
  });

  it('a missile sets a combat roll to 1', () => {
    let s = quickStart();
    s.turn.player = 0;
    s = arrange(s, { p0d0: [0, 0, 6], p1d0: [0, 1, 1] });
    s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    if (s.pending[0].kind !== 'combat') throw new Error();
    s.pending[0].attacker.dice = [6];
    s.pending[0].defender.dice = [1];
    s = apply(s, { type: 'missile', by: 0, side: 'attacker' }); // 1+6=7 vs 1+1=2: still loses
    expect(s.players[0].missiles).toBe(0);
    s = apply(s, { type: 'resolveCombat' });
    expect(s.dice.find((d) => d.id === 'p0d0')!.loc).toEqual({ zone: 'board', r: 0, c: 0 });
  });
});

describe('full games', () => {
  for (const mode of ['basic', 'original', 'community'] as const)
  for (const n of [2, 3, 4]) {
    it(`${mode}: AI vs AI with ${n} players plays to completion without breaking invariants`, () => {
      let s = createGame({ players: players(n), seed: 100 + n, mode });
      let rng = 1234 + n;
      const random = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
      let steps = 0;
      while (s.phase !== 'over' && steps < 3000) {
        const head = s.pending[0];
        let action: Action | null = null;
        if (head?.kind === 'combat') {
          for (const p of s.players) action ??= chooseMissile(s, p.id);
        }
        action ??= chooseAction(s, { samples: 1, random });
        expect(action, `no action at step ${steps}`).not.toBeNull();
        s = apply(s, action!);
        checkInvariants(s);
        steps++;
      }
      expect(s.phase).toBe('over');
      expect(s.winner).not.toBeNull();
    }, 60_000);
  }
});

describe('missiles', () => {
  function battle(defender: { skills?: string[]; planAhead?: number }, rolls: [number, number]) {
    let s = quickStart();
    s.turn.player = 1;
    s = arrange(s, { p1d0: [0, 0, 2], p0d0: [0, 1, 5] });
    s.players[0].skills = (defender.skills ?? []).map((id) => ({ id, active: true }));
    s.players[0].planAhead = defender.planAhead ?? 0;
    s = apply(s, { type: 'attack', die: 'p1d0', target: 'p0d0' });
    if (s.pending[0].kind !== 'combat') throw new Error('no combat');
    s.pending[0].attacker.dice = [rolls[0]];
    s.pending[0].defender.dice = [rolls[1]];
    return s;
  }
  const totals = (s: GameState) => {
    const c = s.pending[0];
    if (c.kind !== 'combat') throw new Error('no combat');
    const o = combatOutcome(s, c);
    return [o.attacker.total, o.defender.total];
  };

  it('sets the roll to 1 before modifiers (the logged 3 vs 5 battle)', () => {
    const s = battle({ skills: ['ferocious'] }, [1, 4]);
    expect(totals(s)).toEqual([3, 8]);
    const fired = apply(s, { type: 'missile', by: 0, side: 'defender' });
    expect(totals(fired)).toEqual([3, 5]);
    expect(fired.players[0].missiles).toBe(0);
  });

  it('cannot be wasted on a roll that is already 1', () => {
    expect(() => apply(battle({ planAhead: 1 }, [1, 4]), { type: 'missile', by: 0, side: 'defender' })).toThrow(/already 1/);
    expect(() => apply(battle({}, [1, 1]), { type: 'missile', by: 0, side: 'defender' })).toThrow(/already 1/);
  });

  it('overrides Rational', () => {
    const s = battle({ skills: ['rational'] }, [1, 6]);
    expect(totals(s)).toEqual([3, 8]);
    expect(totals(apply(s, { type: 'missile', by: 0, side: 'defender' }))).toEqual([3, 6]);
  });
});

describe('plan ahead', () => {
  it('lasts until the end of the owner’s next turn', () => {
    let s = quickStart();
    const me = s.turn.player;
    s.players[me].planAhead = 2; // as if taken during this turn's card phase
    s = apply(s, { type: 'endTurn' }); // end of this turn
    expect(s.players[me].planAhead).toBe(1); // active through the opponent's turn
    s = apply(s, { type: 'endTurn' });
    expect(s.turn.player).toBe(me);
    expect(s.players[me].planAhead).toBe(1); // and my next turn
    s = apply(s, { type: 'endTurn' });
    expect(s.players[me].planAhead).toBe(0); // gone after it
  });
});

describe('modes', () => {
  it('basic: no cards, no missiles, no research', () => {
    const s = quickStart(2, 3, 'basic');
    expect(s.market.skillRow).toHaveLength(0);
    expect(s.market.tacticRow).toHaveLength(0);
    expect(s.market.expansions).toBe(0);
    expect(s.players.every((p) => p.missiles === 0 && p.skills.length === 0)).toBe(true);
    expect(() => apply(s, { type: 'research' })).toThrow(/no research/);
    expect(legalActions(s).some((a) => a.type === 'research')).toBe(false);
  });

  it('original: Command/Gambit decks, no starting skill, no missiles, Expansion in the Gambit deck', () => {
    const s = quickStart(2, 3, 'original');
    const command = new Set(ORIGINAL_COMMAND.map((c) => c.id));
    const gambit = new Set(ORIGINAL_GAMBIT.map((c) => c.id));
    expect([...s.market.skillDeck, ...s.market.skillRow].every((id) => command.has(id))).toBe(true);
    expect([...s.market.tacticDeck, ...s.market.tacticRow].every((id) => gambit.has(id))).toBe(true);
    expect([...s.market.tacticDeck, ...s.market.tacticRow].filter((id) => id === 'o-expansion')).toHaveLength(8);
    expect(s.market.expansions).toBe(0);
    expect(s.players.every((p) => p.missiles === 0 && p.skills.length === 0)).toBe(true);
  });

  it('original: reconfigure on the map or in the scrapyard, and only needs a different number', () => {
    let s = quickStart(2, 3, 'original');
    s = arrange(s, { [`p${s.turn.player}d0`]: [0, 0, 4] });
    const me = s.turn.player;
    const scrapped = s.dice.find((d) => d.owner === me && d.loc.zone === 'scrapyard')!;
    expect(apply(s, { type: 'reconfigure', die: scrapped.id }).turn.actionsLeft).toBe(2);
    let t = s;
    for (let i = 0; i < 3; i++) {
      const before = t.dice.find((d) => d.id === `p${me}d0`)!.value;
      t = apply(t, { type: 'reconfigure', die: `p${me}d0` });
      expect(t.dice.find((d) => d.id === `p${me}d0`)!.value).not.toBe(before);
    }
  });

  it('original Sabotage makes every other player discard a Command card', () => {
    let s = quickStart(3, 3, 'original');
    const me = s.turn.player;
    for (const p of s.players) p.skills = [{ id: 'o-agile', active: true }, { id: 'o-eager', active: true }];
    s.market.tacticRow[0] = 'o-sabotage';
    s.pending = [{ kind: 'takeCard', player: me, count: 1 }];
    s = apply(s, { type: 'takeCard', deck: 'tactic', index: 0 });
    expect(s.pending.filter((p) => p.kind === 'discardSkill')).toHaveLength(2);
    while (s.pending[0]?.kind === 'discardSkill') s = apply(s, { type: 'discardSkill', skill: 'o-agile' });
    for (const p of s.players) expect(p.skills).toHaveLength(p.id === me ? 2 : 1);
  });

  it('original cards reuse shared effects (Cerebral works like Composed)', () => {
    let s = quickStart(2, 3, 'original');
    const me = s.turn.player;
    s.players[me].skills = [{ id: 'o-cerebral', active: true }];
    s.players[me].dominance = 3;
    s = apply(s, { type: 'composed' });
    expect(s.players[me].dominance).toBe(2);
    expect(s.players[me].research).toBe(4);
  });

  describe('original Curious (2nd-printing errata: a free move on a turn without attacks)', () => {
    /**
     * Alpha Sector (planets at rows/cols 1, 4, 7). The current player has a Flagship at (2,2), a
     * Destroyer at (3,3) and a Battlestation at (5,5) next to an enemy Scout at (5,6).
     */
    function curious(actionsLeft: number): GameState {
      let s = createGame({ players: players(2), seed: 3, mode: 'original', mapId: 'alpha-sector' });
      while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
      const me = s.turn.player;
      const foe = 1 - me;
      s = arrange(s, { [`p${me}d0`]: [2, 2, 2], [`p${me}d1`]: [3, 3, 3], [`p${me}d2`]: [5, 5, 1], [`p${foe}d0`]: [5, 6, 6] });
      s.players[me].skills = [{ id: 'o-curious', active: true }];
      s.turn.actionsLeft = actionsLeft;
      s.turn.freeMoves = 1;
      return s;
    }
    const ids = (s: GameState) => ({ flag: `p${s.turn.player}d0`, destroyer: `p${s.turn.player}d1`, station: `p${s.turn.player}d2`, enemy: `p${1 - s.turn.player}d0` });

    it('the free move can pay for a Transport (a move without an attack)', () => {
      const s = curious(0);
      const { flag, destroyer } = ids(s);
      const carry: Action = { type: 'carry', die: flag, passenger: destroyer, to: { r: 2, c: 3 }, drop: { r: 3, c: 3 } };
      expect(legalActions(s, { includeCarry: true })).toContainEqual(carry);
      const after = apply(s, carry);
      expect(after.turn.freeMoves).toBe(0);
      expect(after.turn.actionsLeft).toBe(0);
    });

    it('attacking after the free move pays for it with an action', () => {
      let s = curious(3);
      const { destroyer, station, enemy } = ids(s);
      s = apply(s, { type: 'move', die: destroyer, to: { r: 3, c: 2 } });
      expect(s.turn.actionsLeft).toBe(3);
      s = apply(s, { type: 'attack', die: station, target: enemy });
      expect(s.turn.actionsLeft).toBe(1); // the attack, plus the move it can no longer get for free
      expect(s.turn.freeMoves).toBe(0);
    });

    it('cannot attack (even with a free Strike) when the free move cannot be paid for', () => {
      let s = curious(0);
      const { destroyer, station, enemy } = ids(s);
      s = apply(s, { type: 'move', die: destroyer, to: { r: 3, c: 2 } });
      expect(() => apply(s, { type: 'freeAttack', die: station, target: enemy })).toThrow(/Curious/);
      expect(legalActions(s).some((a) => a.type === 'freeAttack' || a.type === 'attack')).toBe(false);
    });

    it('attacking first forfeits the free move', () => {
      let s = curious(3);
      const { destroyer, station, enemy } = ids(s);
      s = apply(s, { type: 'freeAttack', die: station, target: enemy });
      s = apply(s, { type: 'resolveCombat' });
      if (s.pending[0]?.kind === 'advance') s = apply(s, { type: 'advance', move: false });
      expect(s.turn.freeMoves).toBe(0);
      s = apply(s, { type: 'move', die: destroyer, to: { r: 3, c: 2 } });
      expect(s.turn.actionsLeft).toBe(2);
    });
  });
});

describe('Tactical with ship abilities (forum consensus, BGG threads 1093051 and 2433096)', () => {
  /**
   * Alpha Sector (planets at rows/cols 1, 4, 7). The current player has a Flagship at (2,2), a
   * Destroyer at (3,3) and an Interceptor at (5,5); an enemy Scout sits diagonally at (4,6).
   */
  function tactical(mode: GameMode, skill: string): GameState {
    let s = createGame({ players: players(2), seed: 3, mode, mapId: 'alpha-sector' });
    while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
    const me = s.turn.player;
    s = arrange(s, { [`p${me}d0`]: [2, 2, 2], [`p${me}d1`]: [3, 3, 3], [`p${me}d2`]: [5, 5, 5], [`p${1 - me}d0`]: [4, 6, 6] });
    s.players[me].skills = [{ id: skill, active: true }];
    s.turn.actionsLeft = 3;
    return s;
  }
  const ids = (s: GameState) => ({ flag: `p${s.turn.player}d0`, destroyer: `p${s.turn.player}d1`, interceptor: `p${s.turn.player}d2`, enemy: `p${1 - s.turn.player}d0` });
  const at = (s: GameState, id: string) => s.dice.find((d) => d.id === id)!.loc;

  it('a Flagship can transport over the 1 space, using its ability (and, on the Original card, its move)', () => {
    const s = tactical('original', 'o-tactical');
    const { flag, destroyer } = ids(s);
    const carry: Action = { type: 'tactical', die: flag, passenger: destroyer, to: { r: 2, c: 3 }, drop: { r: 3, c: 4 } };
    expect(legalActions(s, { includeCarry: true })).toContainEqual(carry);
    const after = apply(s, carry);
    expect(at(after, flag)).toEqual({ zone: 'board', r: 2, c: 3 });
    expect(at(after, destroyer)).toEqual({ zone: 'board', r: 3, c: 4 });
    expect(after.turn.actionsLeft).toBe(3);
    expect(after.turn.abilityUsed[flag]).toBe(true);
    expect(() => apply(after, { type: 'move', die: flag, to: { r: 2, c: 4 } })).toThrow(/already moved/);
    // Exactly 1 space: no 2-space flight, and no out-and-back.
    expect(() => apply(s, { ...carry, to: { r: 2, c: 4 }, drop: { r: 3, c: 4 } })).toThrow(/Invalid carry/);
    expect(() => apply(s, { ...carry, to: { r: 2, c: 2 }, drop: { r: 2, c: 3 } })).toThrow(/Invalid carry/);
  });

  it('a Flagship that already used its ability cannot transport with Tactical', () => {
    const s = tactical('original', 'o-tactical');
    const { flag, destroyer } = ids(s);
    s.turn.abilityUsed[flag] = true;
    expect(() => apply(s, { type: 'tactical', die: flag, passenger: destroyer, to: { r: 2, c: 3 }, drop: { r: 3, c: 4 } })).toThrow(/ability/);
  });

  it('an Interceptor can step or attack diagonally, using its ability', () => {
    const s = tactical('community', 'tactical');
    const { interceptor, enemy } = ids(s);
    const step = apply(s, { type: 'tactical', die: interceptor, to: { r: 6, c: 6 } });
    expect(at(step, interceptor)).toEqual({ zone: 'board', r: 6, c: 6 });
    expect(step.turn.abilityUsed[interceptor]).toBe(true);
    const strike = apply(s, { type: 'tactical', die: interceptor, target: enemy });
    expect(strike.pending[0]?.kind).toBe('combat');
    expect(strike.turn.abilityUsed[interceptor]).toBe(true);
    // An orthogonal step leaves the ability unused.
    expect(apply(s, { type: 'tactical', die: interceptor, to: { r: 5, c: 6 } }).turn.abilityUsed[interceptor]).toBeFalsy();
    // Without its ability, no diagonals.
    s.turn.abilityUsed[interceptor] = true;
    expect(() => apply(s, { type: 'tactical', die: interceptor, to: { r: 6, c: 6 } })).toThrow(/one space/);
    expect(() => apply(s, { type: 'tactical', die: interceptor, target: enemy })).toThrow(/adjacent/);
  });
});

describe('undo', () => {
  it('allows deterministic moves and forbids anything random', () => {
    let s = quickStart();
    const me = s.turn.player;
    s = arrange(s, { [`p${me}d0`]: [0, 0, 3], [`p${1 - me}d0`]: [0, 1, 6] });
    const moveTo = { r: 1, c: 0 };
    const moved = apply(s, { type: 'move', die: `p${me}d0`, to: moveTo });
    expect(isUndoable(s, { type: 'move', die: `p${me}d0`, to: moveTo }, moved)).toBe(true);

    const reroll = { type: 'reconfigure', die: `p${me}d0` } as const;
    expect(isUndoable(s, reroll, apply(s, reroll))).toBe(false);

    const attack = { type: 'attack', die: `p${me}d0`, target: `p${1 - me}d0` } as const;
    expect(isUndoable(s, attack, apply(s, attack))).toBe(false);

    const end = { type: 'endTurn' } as const;
    expect(isUndoable(s, end, apply(s, end))).toBe(false);
  });
});
