import { describe, expect, it } from 'vitest';
import {
  apply,
  combatOutcome,
  conquerCheck,
  createGame,
  deployTargets,
  legalActions,
  isUndoable,
  moveOptions,
  type Action,
  type GameMode,
  type GameState,
  ORIGINAL_COMMAND,
  ORIGINAL_GAMBIT,
} from '../src';
import { arrange, players, quickStart } from './helpers';

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

describe('void tiles (The Void maps; BGA rules help)', () => {
  // Axiomatic: the void tile is tile row 1, col 1, so board rows and cols 3–5.
  const start = (mode: GameMode) => {
    let s = createGame({ players: players(2), seed: 5, mode, mapId: 'axiomatic' });
    while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
    for (const p of s.players) p.skills = [];
    return s;
  };

  it('is a tile of empty spaces with no planet', () => {
    const s = start('community');
    for (let r = 3; r < 6; r++) for (let c = 3; c < 6; c++) expect(s.board.cells[r][c]).toMatchObject({ kind: 'space', void: true });
    expect(s.board.planets.some((p) => p.r >= 3 && p.r < 6 && p.c >= 3 && p.c < 6)).toBe(false);
  });

  for (const mode of ['original', 'community'] as GameMode[])
    it(`${mode}: +1 research per own ship on it at the start of your turn`, () => {
      const s0 = start(mode);
      const me = s0.turn.player;
      const next = 1 - me;
      let s = arrange(s0, {
        [`p${next}d0`]: [3, 3, 4],
        [`p${next}d1`]: [5, 5, 4],
        [`p${next}d2`]: [0, 4, 4], // next to the void, not on it
        [`p${me}d0`]: [4, 4, 4],
      });
      s.players[me].research = 1;
      s.players[next].research = 1;
      s = apply(s, { type: 'endTurn' });
      expect(s.turn.player).toBe(next);
      expect(s.players[next].research).toBe(3);
      expect(s.players[me].research).toBe(1); // only gained at the start of your own turn
    });

  it('research gained this way is capped at 6', () => {
    const s0 = start('community');
    const me = s0.turn.player;
    const next = 1 - me;
    let s = arrange(s0, { [`p${next}d0`]: [3, 3, 4], [`p${next}d1`]: [5, 5, 4], [`p${me}d0`]: [0, 4, 4] });
    s.players[next].research = 5;
    s = apply(s, { type: 'endTurn' });
    expect(s.players[next].research).toBe(6);
  });
});

describe('maps per rule set', () => {
  it('Basic and Original are played only on published maps; Community also on the BGA maps', () => {
    expect(() => createGame({ players: players(2), mode: 'basic', mapId: 'precis' })).toThrow(/isn't played with the Basic rules/);
    expect(() => createGame({ players: players(2), mode: 'original', mapId: 'precis' })).toThrow(/Original/);
    expect(createGame({ players: players(2), mode: 'community', mapId: 'precis' }).board.mapId).toBe('precis');
    expect(createGame({ players: players(2), mode: 'basic', mapId: 'axiomatic' }).board.mapId).toBe('axiomatic');
  });

  it('rejects a map for a different player count', () => {
    expect(() => createGame({ players: players(3), mapId: 'alpha-sector' })).toThrow(/2-player map/);
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

describe('Stubborn (2013 card text and CE card sheet)', () => {
  /** Player 0's Scout attacks player 1's Battlestation, which has Stubborn; the combat rolls are fixed. */
  function stubbornCombat(attackRoll: number, defenceRoll: number): GameState {
    let s = quickStart();
    s.turn.player = 0;
    s = arrange(s, { p0d0: [0, 0, 6], p1d0: [0, 1, 1] });
    s.players[1].skills = [{ id: 'stubborn', active: true }];
    s.players[0].dominance = 3;
    s.players[1].dominance = 3;
    s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    if (s.pending[0].kind !== 'combat') throw new Error();
    s.pending[0].attacker.dice = [attackRoll];
    s.pending[0].defender.dice = [defenceRoll];
    return apply(s, { type: 'resolveCombat' });
  }

  it('destroys the attacker when the defender wins outright', () => {
    const s = stubbornCombat(6, 1); // 12 vs 2
    expect(s.dice.find((d) => d.id === 'p0d0')!.loc.zone).toBe('scrapyard');
    expect(s.players[1].dominance).toBe(4);
    expect(s.players[0].dominance).toBe(2);
  });

  it('wins ties and destroys the attacker', () => {
    const s = stubbornCombat(1, 6); // 7 vs 7
    expect(s.dice.find((d) => d.id === 'p0d0')!.loc.zone).toBe('scrapyard');
    expect(s.dice.find((d) => d.id === 'p1d0')!.loc.zone).toBe('board');
  });

  it('loses normally when the attacker has the lower total', () => {
    let s = quickStart();
    s.turn.player = 0;
    s = arrange(s, { p0d0: [0, 0, 1], p1d0: [0, 1, 6] });
    s.players[1].skills = [{ id: 'stubborn', active: true }];
    s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    if (s.pending[0].kind !== 'combat') throw new Error();
    s.pending[0].attacker.dice = [1];
    s.pending[0].defender.dice = [1];
    s = apply(s, { type: 'resolveCombat' });
    expect(s.dice.find((d) => d.id === 'p1d0')!.loc.zone).toBe('scrapyard');
  });
});

describe('Composed / Cerebral', () => {
  it('needs dominance to lose ("reduce your dominance by 1")', () => {
    for (const [mode, id] of [['community', 'composed'], ['original', 'o-cerebral']] as const) {
      const s = quickStart(2, 3, mode);
      const me = s.turn.player;
      s.players[me].skills = [{ id, active: true }];
      s.players[me].dominance = 1;
      expect(legalActions(s).some((a) => a.type === 'composed')).toBe(false);
      expect(() => apply(s, { type: 'composed' })).toThrow('No dominance to lose');
    }
  });
});

describe('Original card market (2013 rulebook p.9)', () => {
  function picking(mode: GameMode = 'original'): GameState {
    let s = quickStart(2, 3, mode);
    s = apply(s, { type: 'endTurn' });
    s.pending = [{ kind: 'takeCard', player: s.turn.player, count: 2 }];
    return s;
  }

  it('a card pick may be spent on discarding all six face-up cards and dealing six new ones', () => {
    const s = picking();
    const before = [...s.market.skillRow, ...s.market.tacticRow];
    const next = apply(s, { type: 'refreshMarket' });
    expect(next.market.skillRow).toHaveLength(3);
    expect(next.market.tacticRow).toHaveLength(3);
    expect(next.market.skillDiscard).toEqual(s.market.skillRow);
    expect(next.market.tacticDiscard).toEqual(s.market.tacticRow);
    expect([...next.market.skillRow, ...next.market.tacticRow]).not.toEqual(before);
    expect(next.pending[0]).toMatchObject({ kind: 'takeCard', count: 1 });
  });

  it('the Community Edition has no refresh', () => {
    const s = picking('community');
    expect(legalActions(s).some((a) => a.type === 'refreshMarket')).toBe(false);
    expect(() => apply(s, { type: 'refreshMarket' })).toThrow();
  });

  it('an Expansion cannot be taken once both expansion ships are in the game', () => {
    const s = picking();
    s.market.tacticRow[0] = 'o-expansion';
    for (const d of s.dice) if (d.owner === s.turn.player && d.loc.zone === 'reserve') d.loc = { zone: 'scrapyard' };
    expect(legalActions(s).some((a) => a.type === 'takeCard' && a.deck === 'tactic' && a.index === 0)).toBe(false);
    expect(() => apply(s, { type: 'takeCard', deck: 'tactic', index: 0 })).toThrow('Your reserve is empty');
  });
});

describe('RULE-SUGGESTIONS §5.3', () => {
  it('#49: a held Talented raises the skill limit at once, so taking it as a 4th skill forces no discard', () => {
    for (const [taken, discard] of [['talented', false], ['stealthy', true]] as const) {
      let s = quickStart(2, 3);
      s = apply(s, { type: 'endTurn' });
      const me = s.turn.player;
      s.players[me].skills = ['agile', 'ferocious', 'brutal'].map((id) => ({ id, active: true }));
      s.market.skillRow[0] = taken;
      s.pending = [{ kind: 'takeCard', player: me, count: 1 }];
      s = apply(s, { type: 'takeCard', deck: 'skill', index: 0 });
      expect(s.players[me].skills).toHaveLength(4);
      expect(s.pending[0]?.kind === 'discardSkill').toBe(discard);
    }
  });

  it('#49: discarding Talented while over 3 skills asks for another discard', () => {
    let s = quickStart(2, 3);
    const me = s.turn.player;
    s.players[me].skills = ['agile', 'ferocious', 'brutal', 'stealthy', 'talented'].map((id) => ({ id, active: true }));
    s.pending = [{ kind: 'discardSkill', player: me, reason: 'limit' }];
    s = apply(s, { type: 'discardSkill', skill: 'talented' });
    expect(s.pending[0]).toMatchObject({ kind: 'discardSkill', player: me });
  });

  it('#30: the two Warp Gate spaces are adjacent for Strategic support', () => {
    const attackerTotal = (gates: boolean) => {
      let s = quickStart();
      s.turn.player = 0;
      // The supporting ship sits on the far gate, adjacent to the attacker's space only through the link.
      s = arrange(s, { p0d0: [0, 0, 3], p1d0: [0, 1, 3], p0d1: [8, 8, 2] });
      s.players[0].skills = [{ id: 'strategic', active: true }];
      s.gates = gates ? [{ r: 0, c: 0 }, { r: 8, c: 8 }] : [];
      s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
      if (s.pending[0].kind !== 'combat') throw new Error();
      s.pending[0].attacker.dice = [4];
      s.pending[0].defender.dice = [4];
      return combatOutcome(s, s.pending[0]).attacker.total;
    };
    expect(attackerTotal(true)).toBe(attackerTotal(false) - 2);
  });

  it('#30: the two Warp Gate spaces are adjacent for Stealthy deploys', () => {
    const isolated = (gates: boolean) => {
      let s = quickStart();
      s = arrange(s, { p1d0: [8, 8, 3] });
      s.players[0].skills = [{ id: 'stealthy', active: true }];
      s.gates = gates ? [{ r: 0, c: 0 }, { r: 8, c: 8 }] : [];
      return deployTargets(s, 0).some((c) => c.r === 0 && c.c === 0);
    };
    expect(isolated(false)).toBe(true);
    expect(isolated(true)).toBe(false);
  });

  it('#33: Composed is not offered under Righteous, where it could do nothing', () => {
    const s = quickStart(2, 3);
    const me = s.turn.player;
    s.players[me].skills = ['composed', 'righteous'].map((id) => ({ id, active: true }));
    s.players[me].dominance = 3;
    expect(legalActions(s).some((a) => a.type === 'composed')).toBe(false);
    expect(() => apply(s, { type: 'composed' })).toThrow('You cannot gain research');
  });

  describe('#26: Show of Force fires "destroy" skills, with no dominance loss for the victim', () => {
    function showOfForce(target: 'enemy' | 'own'): { s: GameState; me: number; foe: number } {
      let s = quickStart(2, 3);
      const me = s.turn.player;
      const foe = 1 - me;
      s = arrange(s, { [`p${me}d0`]: [0, 0, 3], [`p${foe}d0`]: [8, 8, 3] });
      s.players[me].skills = ['plundering', 'ravenous'].map((id) => ({ id, active: true }));
      s.players[me].dominance = 3;
      s.players[me].research = 1;
      s.players[foe].dominance = 3;
      s.pending = [{ kind: 'showOfForce', player: me }];
      s = apply(s, { type: 'showOfForce', die: target === 'enemy' ? `p${foe}d0` : `p${me}d0` });
      return { s, me, foe };
    }

    it('on an enemy ship: Plundering and Ravenous trigger; the victim keeps their dominance', () => {
      const { s, me, foe } = showOfForce('enemy');
      expect(s.players[me].research).toBe(4);
      expect(s.players[me].dominance).toBe(5); // +1 card text, +1 Ravenous
      expect(s.players[foe].dominance).toBe(3);
    });

    it('on your own ship: only the card text applies', () => {
      const { s, me } = showOfForce('own');
      expect(s.players[me].research).toBe(1);
      expect(s.players[me].dominance).toBe(4);
    });
  });
});
