/**
 * Original Command and Gambit cards that open decisions of their own: combat re-rolls (Cruel,
 * Relentless, Scrappy), Dangerous, Clever, Scrappy ship re-rolls, Nomadic and Relocation.
 */
import { describe, expect, it } from 'vitest';
import { apply, legalActions, type Action, type CombatRole, type GameState, type PlayerId } from '../src';
import { arrange, originalGame as game } from './helpers';

const ids = (s: GameState) => ({ me: s.turn.player, foe: 1 - s.turn.player, scout: `p${s.turn.player}d0`, enemy: `p${1 - s.turn.player}d0` });
const at = (s: GameState, id: string) => s.dice.find((d) => d.id === id)!;
const can = (s: GameState, match: (a: Action) => boolean) => legalActions(s).some(match);

/** My Scout attacks the enemy Destroyer. */
const attack = (s: GameState): GameState => apply(s, { type: 'attack', die: ids(s).scout, target: ids(s).enemy });

/** My Scout attacks; the combat dice are set to `rolls` (attacker, defender). */
function battle(s: GameState, rolls: [number, number]): GameState {
  s = attack(s);
  const head = s.pending[0];
  if (head.kind !== 'combat') throw new Error(`expected a battle, got ${head.kind}`);
  head.attacker.dice = [rolls[0]];
  head.defender.dice = [rolls[1]];
  return s;
}

const reroll = (by: PlayerId, side: CombatRole): Action => ({ type: 'reroll', by, side });
const rerolled = (s: GameState) => (s.pending[0].kind === 'combat' ? s.pending[0].rerolls : []);

describe('combat re-rolls (2013 rulebook FAQ: after both have rolled; the new roll must be kept)', () => {
  it('Cruel makes the opponent re-roll, once per battle', () => {
    let s = battle(game({ foe: ['o-cruel'] }), [1, 6]);
    const { me, foe } = ids(s);
    expect(can(s, (a) => a.type === 'reroll' && a.by === foe && a.side === 'attacker')).toBe(true);
    expect(() => apply(s, reroll(foe, 'defender'))).toThrow('No re-roll');
    expect(() => apply(s, reroll(me, 'attacker'))).toThrow('No re-roll');
    s = apply(s, reroll(foe, 'attacker'));
    expect(rerolled(s)).toEqual(['cruel']);
    expect(() => apply(s, reroll(foe, 'attacker'))).toThrow('No re-roll');
  });

  it('Relentless re-rolls your own dice, when attacking or defending', () => {
    const s = battle(game({ foe: ['o-relentless'] }), [1, 6]);
    const { foe } = ids(s);
    expect(() => apply(s, reroll(foe, 'attacker'))).toThrow('No re-roll');
    expect(rerolled(apply(s, reroll(foe, 'defender')))).toEqual(['relentless']);
  });

  it('Scrappy re-rolls your own combat dice on your turn only', () => {
    const attacking = battle(game({ me: ['o-scrappy'] }), [6, 1]);
    expect(rerolled(apply(attacking, reroll(ids(attacking).me, 'attacker')))).toEqual(['scrappy']);
    const defending = battle(game({ foe: ['o-scrappy'] }), [1, 6]);
    expect(() => apply(defending, reroll(ids(defending).foe, 'defender'))).toThrow('No re-roll');
  });

  it('each card re-rolls once, so Relentless and Scrappy together re-roll twice', () => {
    let s = battle(game({ me: ['o-relentless', 'o-scrappy'] }), [6, 1]);
    const { me } = ids(s);
    s = apply(s, reroll(me, 'attacker'));
    s = apply(s, reroll(me, 'attacker'));
    expect([...rerolled(s)].sort()).toEqual(['relentless', 'scrappy']);
    expect(() => apply(s, reroll(me, 'attacker'))).toThrow('No re-roll');
  });

  it('a roll set by a missile or Rational cannot be re-rolled', () => {
    const s = battle(game({ foe: ['o-cruel'], me: ['o-rational'] }), [1, 6]);
    expect(() => apply(s, reroll(ids(s).foe, 'attacker'))).toThrow('No re-roll');
  });
});

describe('Dangerous (destroy both ships before the dice are rolled; designer, BGG thread 1070690)', () => {
  it('asks the defender before any combat dice are rolled', () => {
    const s = attack(game({ foe: ['o-dangerous'] }));
    expect(s.pending[0]).toMatchObject({ kind: 'dangerous', player: ids(s).foe });
    expect(s.pending.some((p) => p.kind === 'combat')).toBe(false);
  });

  it('destroys both ships, with no dominance change and no "when you destroy" bonus', () => {
    let s = game({ me: ['o-warlike', 'o-ravenous'], foe: ['o-dangerous'] });
    const { me, foe, scout, enemy } = ids(s);
    s = attack(s);
    s = apply(s, { type: 'dangerous', destroy: true });
    expect(at(s, scout).loc.zone).toBe('scrapyard');
    expect(at(s, enemy).loc.zone).toBe('scrapyard');
    expect(s.players[me].dominance).toBe(3);
    expect(s.players[foe].dominance).toBe(3);
    expect(s.turn.actionsLeft).toBe(2); // the attack's action, and nothing back from Warlike
    expect(s.pending).toEqual([]);
  });

  it('declining rolls the dice and the battle goes ahead', () => {
    let s = attack(game({ foe: ['o-dangerous'] }));
    s = apply(s, { type: 'dangerous', destroy: false });
    expect(s.pending[0].kind).toBe('combat');
  });
});

describe('Clever (choose the number whenever a ship would be rolled)', () => {
  it('a Reconfigure lets you choose any new number', () => {
    let s = game({ me: ['o-clever'] });
    const { scout } = ids(s);
    s = apply(s, { type: 'reconfigure', die: scout });
    expect(s.pending[0]).toMatchObject({ kind: 'clever', die: scout, avoid: 6 });
    expect(() => apply(s, { type: 'clever', value: 6 })).toThrow('must change');
    s = apply(s, { type: 'clever', value: 1 });
    expect(at(s, scout).value).toBe(1);
    expect(s.pending).toEqual([]);
  });

  it('applies to your ship destroyed on another player’s turn, after the attacker advances', () => {
    let s = battle(game({ foe: ['o-clever'] }), [1, 6]);
    const { foe, enemy } = ids(s);
    s = apply(s, { type: 'resolveCombat' });
    expect(s.pending.map((p) => p.kind)).toEqual(['advance', 'clever']);
    s = apply(s, { type: 'advance', move: true });
    expect(s.pending[0]).toMatchObject({ kind: 'clever', player: foe, die: enemy });
    s = apply(s, { type: 'clever', value: 4 });
    expect(at(s, enemy)).toMatchObject({ value: 4, loc: { zone: 'scrapyard' } });
  });

  it('chooses an Expansion ship’s number before placing it', () => {
    let s = game({ me: ['o-clever'] });
    s.market.tacticRow[0] = 'o-expansion';
    s.pending = [{ kind: 'takeCard', player: s.turn.player, count: 1 }];
    s = apply(s, { type: 'takeCard', deck: 'tactic', index: 0 });
    expect(s.pending.map((p) => p.kind)).toEqual(['clever', 'placeExpansion']);
  });
});

describe('Scrappy (re-roll each of your ship rolls once, on your turn)', () => {
  it('re-rolls a Reconfigure once, still to a number other than the original', () => {
    let s = game({ me: ['o-scrappy'] });
    const { scout } = ids(s);
    s = apply(s, { type: 'reconfigure', die: scout });
    expect(can(s, (a) => a.type === 'scrappy')).toBe(true);
    for (let i = 0; i < 20; i++) expect(at(apply({ ...s, rng: i * 7919 }, { type: 'scrappy' }), scout).value).not.toBe(6);
    s = apply(s, { type: 'scrappy' });
    expect(() => apply(s, { type: 'scrappy' })).toThrow('Nothing to re-roll');
  });

  it('is given up by taking any other action first', () => {
    let s = game({ me: ['o-scrappy'] });
    s = apply(s, { type: 'reconfigure', die: ids(s).scout });
    s = apply(s, { type: 'research' });
    expect(can(s, (a) => a.type === 'scrappy')).toBe(false);
  });

  it('does not apply to your ships rolled on another player’s turn', () => {
    let s = battle(game({ foe: ['o-scrappy'] }), [1, 6]);
    s = apply(s, { type: 'resolveCombat' });
    s = apply(s, { type: 'advance', move: false });
    expect(can(s, (a) => a.type === 'scrappy')).toBe(false);
  });
});

describe('Nomadic (relocate a ship to an orbit of a planet on a neighbouring tile; designer, BGG thread 1182319)', () => {
  /** My Destroyer orbits the 7 at (1,1), at (2,1). */
  function nomadic(): GameState {
    const s = game({ me: ['o-nomadic'] });
    return arrange(s, { [`p${s.turn.player}d1`]: [2, 1, 3], [`p${1 - s.turn.player}d0`]: [3, 4, 3] });
  }
  const destroyer = (s: GameState) => `p${s.turn.player}d1`;
  const targets = (s: GameState) =>
    legalActions(s)
      .flatMap((a) => (a.type === 'nomadic' && a.die === destroyer(s) ? [`${a.to.r},${a.to.c}`] : []))
      .sort();

  it('reaches the empty orbits of the planets on the orthogonally neighbouring tiles only', () => {
    // Planets at (1,4) and (4,1); not the 8 at (4,4), which is diagonal.
    expect(targets(nomadic())).toEqual(['0,4', '1,3', '1,5', '2,4', '3,1', '4,0', '4,2', '5,1'].sort());
  });

  it('costs an action, is once per turn, and is not the ship’s move', () => {
    let s = nomadic();
    s = apply(s, { type: 'nomadic', die: destroyer(s), to: { r: 2, c: 4 } });
    expect(at(s, destroyer(s)).loc).toEqual({ zone: 'board', r: 2, c: 4 });
    expect(s.turn.actionsLeft).toBe(2);
    expect(targets(s)).toEqual([]);
    expect(can(s, (a) => a.type === 'move' && a.die === destroyer(s))).toBe(true);
  });

  it('needs a ship in an orbital position', () => {
    const s = nomadic();
    expect(legalActions(s).some((a) => a.type === 'nomadic' && a.die === ids(s).scout)).toBe(false);
  });
});

describe('Relocation (revised card: move another player’s cube to any planet without theirs)', () => {
  function relocation(): GameState {
    const s = game();
    const { foe } = ids(s);
    const centre = s.board.planets.find((p) => p.number === 8)!;
    centre.cubes.push(foe);
    s.players[foe].cubesLeft--;
    s.market.tacticRow[0] = 'o-relocation';
    s.pending = [{ kind: 'takeCard', player: s.turn.player, count: 1 }];
    return apply(s, { type: 'takeCard', deck: 'tactic', index: 0 });
  }

  it('offers any planet with room and without the owner’s cube, larger ones included', () => {
    const s = relocation();
    const { foe } = ids(s);
    expect(s.pending[0].kind).toBe('relocation');
    const moves = legalActions(s).filter((a): a is Extract<Action, { type: 'relocate' }> => a.type === 'relocate');
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.owner).toBe(foe);
      expect(s.board.planets[m.to].cubes).not.toContain(foe);
    }
    // The 1st printing barred a larger planet; the revised card lets the foe's 7 go to the 8.
    const centre = s.board.planets.find((p) => p.number === 8)!;
    centre.cubes = centre.cubes.filter((c) => c !== foe);
    const start = s.board.planets.find((p) => p.number === 7 && p.cubes.includes(foe))!;
    expect(legalActions(s)).toContainEqual({ type: 'relocate', planet: start.id, owner: foe, to: centre.id });
  });

  it('moves the cube; the owner keeps the same number of cubes on the map', () => {
    let s = relocation();
    const { foe } = ids(s);
    const centre = s.board.planets.find((p) => p.number === 8)!;
    const to = s.board.planets.find((p) => p.number === 7 && !p.cubes.length)!;
    s = apply(s, { type: 'relocate', planet: centre.id, owner: foe, to: to.id });
    expect(s.board.planets[centre.id].cubes).not.toContain(foe);
    expect(s.board.planets[to.id].cubes).toEqual([foe]);
    expect(s.players[foe].cubesLeft).toBe(relocation().players[foe].cubesLeft);
  });
});
