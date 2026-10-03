/**
 * The Original Command and Gambit cards that play like a hook on the existing rules (extra
 * actions, movement, conquering, combat, destroying ships, cards). Rulings quoted from the 2013
 * rulebook FAQ (p.14) are tested where they apply, as are card notes from the fan "Quantum rules
 * summary v1" (BGG file 101664, "rules summary"; see reference/README.md).
 */
import { describe, expect, it } from 'vitest';
import { apply, combatOutcome, conquerCheck, legalActions, movementRange, type Action, type GameState } from '../src';
import { arrange, originalGame as game } from './helpers';

const ids = (s: GameState) => ({ me: s.turn.player, foe: 1 - s.turn.player });
const ship = (owner: number, i: number) => `p${owner}d${i}`;
const at = (s: GameState, id: string) => s.dice.find((d) => d.id === id)!;
const can = (s: GameState, match: (a: Action) => boolean) => legalActions(s).some(match);

/** Places my ships (and the enemy's, as `foe`) as [row, col, value]; everything else leaves the map. */
function place(s: GameState, mine: [number, number, number][], foes: [number, number, number][] = []): GameState {
  const { me, foe } = ids(s);
  return arrange(s, {
    ...Object.fromEntries(mine.map((p, i) => [ship(me, i), p])),
    ...Object.fromEntries(foes.map((p, i) => [ship(foe, i), p])),
  });
}

/** Ends my turn and the opponent's, so my next turn starts (start-of-turn bonuses apply). */
const nextTurn = (s: GameState) => apply(apply(s, { type: 'endTurn' }), { type: 'endTurn' });

/** My first ship attacks the enemy's first ship, with the combat dice set to `rolls` (attacker, defender), and resolves. */
function fight(s: GameState, rolls: [number, number]): GameState {
  const { me, foe } = ids(s);
  s = apply(s, { type: 'attack', die: ship(me, 0), target: ship(foe, 0) });
  const head = s.pending[0];
  if (head.kind !== 'combat') throw new Error(`expected a battle, got ${head.kind}`);
  head.attacker.dice = [rolls[0]];
  head.defender.dice = [rolls[1]];
  return apply(s, { type: 'resolveCombat' });
}

/** Takes `cards` from the face-up rows in the card phase (Command cards first, then Gambits). */
function take(s: GameState, cards: { command?: string; gambit?: string }): GameState {
  s.turn.phase = 'cards';
  s.pending = [{ kind: 'takeCard', player: s.turn.player, count: Number(!!cards.command) + Number(!!cards.gambit) }];
  if (cards.command) {
    s.market.skillRow[0] = cards.command;
    s = apply(s, { type: 'takeCard', deck: 'skill', index: 0 });
  }
  if (cards.gambit) {
    s.market.tacticRow[0] = cards.gambit;
    s = apply(s, { type: 'takeCard', deck: 'tactic', index: 0 });
  }
  return s;
}

/** Alpha Sector: the centre planet, an 8 at (4,4). */
const centre = (s: GameState) => s.board.planets.find((p) => p.number === 8)!.id;

describe('start-of-turn bonuses', () => {
  it('Arrogant: an extra action with more ships on the map than any other player', () => {
    const ahead = place(game({ me: ['o-arrogant'] }), [[0, 0, 6], [2, 0, 3], [2, 2, 2]], [[0, 1, 3]]);
    expect(nextTurn(ahead).turn.actionsLeft).toBe(4);
    const level = place(game({ me: ['o-arrogant'] }), [[0, 0, 6]], [[0, 1, 3]]);
    expect(nextTurn(level).turn.actionsLeft).toBe(3);
  });

  it('extra actions do not let a ship move a second time (FAQ)', () => {
    let s = nextTurn(place(game({ me: ['o-arrogant'] }), [[0, 0, 6], [2, 0, 3], [2, 2, 2]], [[0, 1, 3]]));
    const scout = ship(ids(s).me, 0);
    s = apply(s, legalActions(s).find((a) => a.type === 'move' && a.die === scout)!);
    expect(s.turn.actionsLeft).toBe(3);
    expect(can(s, (a) => a.type === 'move' && a.die === scout)).toBe(false);
  });

  it('Brilliant: +2 research', () => {
    const s = game({ me: ['o-brilliant'] });
    expect(nextTurn(s).players[ids(s).me].research).toBe(3);
  });

  it('Conformist: an extra action when 2 of your ships on the map show the same number', () => {
    expect(nextTurn(place(game({ me: ['o-conformist'] }), [[0, 0, 3], [2, 0, 3], [2, 2, 6]])).turn.actionsLeft).toBe(4);
    expect(nextTurn(place(game({ me: ['o-conformist'] }), [[0, 0, 3], [2, 0, 4], [2, 2, 6]])).turn.actionsLeft).toBe(3);
  });
});

describe('movement and deploying', () => {
  it('Agile: +1 movement', () => {
    const s = place(game({ me: ['o-agile'] }), [[0, 0, 2]]);
    expect(movementRange(s, at(s, ship(ids(s).me, 0)))).toBe(3);
  });

  it('Energetic: a ship may move again, each move costing an action', () => {
    let s = place(game({ me: ['o-energetic'] }), [[0, 0, 6]]);
    const scout = ship(ids(s).me, 0);
    for (let i = 0; i < 2; i++) s = apply(s, legalActions(s).find((a) => a.type === 'move' && a.die === scout)!);
    expect(s.turn.actionsLeft).toBe(1);
    expect(can(s, (a) => a.type === 'move' && a.die === scout)).toBe(true);
  });

  it('Eager: deploying costs no action', () => {
    let s = place(game({ me: ['o-eager'] }), [[0, 0, 6]]);
    s = apply(s, legalActions(s).find((a) => a.type === 'deploy')!);
    expect(s.turn.actionsLeft).toBe(3);
  });

  it('Stealthy: deploy to any empty space with no ship next to it', () => {
    const lonely = (s: GameState) => can(s, (a) => a.type === 'deploy' && a.to.r === 5 && a.to.c === 0);
    const crowded = (s: GameState) => can(s, (a) => a.type === 'deploy' && a.to.r === 0 && a.to.c === 2);
    const s = place(game({ me: ['o-stealthy'] }), [[0, 0, 6]], [[0, 1, 3]]);
    expect(lonely(s)).toBe(true);
    expect(crowded(s)).toBe(false); // next to the enemy at (0,1)
    expect(lonely(place(game(), [[0, 0, 6]], [[0, 1, 3]]))).toBe(false);
  });
});

describe('ship abilities', () => {
  it('Cunning: one ship ability a second time each turn', () => {
    let s = place(game({ me: ['o-cunning'] }), [[2, 0, 3], [2, 2, 6]]);
    const destroyer = ship(ids(s).me, 0);
    const other = ship(ids(s).me, 1);
    s = apply(s, { type: 'swap', die: destroyer, other });
    s = apply(s, { type: 'swap', die: destroyer, other });
    expect(() => apply(s, { type: 'swap', die: destroyer, other })).toThrow('already used its ability');
  });

  it('Cunning does not let an Interceptor move a second time (FAQ)', () => {
    let s = place(game({ me: ['o-cunning'] }), [[0, 0, 5]]);
    const interceptor = ship(ids(s).me, 0);
    s = apply(s, legalActions(s).find((a) => a.type === 'move' && a.die === interceptor)!);
    expect(can(s, (a) => a.type === 'move' && a.die === interceptor)).toBe(false);
  });

  it('Flexible: ±1 once per turn, and the changed ship still has only one ability use (FAQ)', () => {
    let s = place(game({ me: ['o-flexible'] }), [[2, 0, 3], [2, 2, 6]]);
    const destroyer = ship(ids(s).me, 0);
    s = apply(s, { type: 'swap', die: destroyer, other: ship(ids(s).me, 1) });
    s = apply(s, { type: 'flexible', die: destroyer, delta: 1 });
    expect(at(s, destroyer).value).toBe(4);
    expect(() => apply(s, { type: 'flexible', die: destroyer, delta: -1 })).toThrow('Already used');
    expect(() => apply(s, { type: 'change', die: destroyer, value: 5 })).toThrow('already used its ability');
  });

  it('Resourceful: scrap a ship from the map for an extra action, once per turn', () => {
    let s = place(game({ me: ['o-resourceful'] }), [[0, 0, 6], [2, 0, 3]]);
    s = apply(s, { type: 'resourceful', die: ship(ids(s).me, 0) });
    expect(at(s, ship(ids(s).me, 0)).loc.zone).toBe('scrapyard');
    expect(s.turn.actionsLeft).toBe(4);
    expect(() => apply(s, { type: 'resourceful', die: ship(ids(s).me, 1) })).toThrow('Already used');
  });
});

describe('conquering (the centre 8)', () => {
  /** Whether my ships at `ships` can conquer the centre 8. */
  const conquers = (skills: string[], ships: [number, number, number][]) => {
    const s = place(game({ me: skills }), ships);
    return conquerCheck(s, ids(s).me, centre(s)).ok;
  };

  it('Ingenious: diagonal ships count towards the total', () => {
    const ships: [number, number, number][] = [[3, 3, 5], [3, 4, 3]];
    expect(conquers(['o-ingenious'], ships)).toBe(true);
    expect(conquers([], ships)).toBe(false);
  });

  it('Ingenious: each diagonal ship may be left out of the total', () => {
    // Orbit 5 + 3 = 8 on its own; the diagonal 2 would make 10.
    const ships: [number, number, number][] = [[3, 4, 5], [4, 3, 3], [3, 3, 2]];
    expect(conquers([], ships)).toBe(true);
    expect(conquers(['o-ingenious'], ships)).toBe(true);
    // Orbit 5 + diagonals 2 and 1: only 5 + 2 + 1 = 8 works, so both diagonals count.
    expect(conquers(['o-ingenious'], [[3, 4, 5], [3, 3, 2], [5, 5, 1]])).toBe(true);
  });

  it('Intelligent: the total may be 1 higher or lower', () => {
    const totals = (skills: string[]) => [[3, 4], [4, 5], [5, 5]].map(([a, b]) => conquers(skills, [[3, 4, a], [5, 4, b]]));
    expect(totals(['o-intelligent'])).toEqual([true, true, false]); // 7, 9, 10
    expect(totals([])).toEqual([false, false, false]);
  });
});

describe('combat', () => {
  it('Strategic: −2 when another of your ships is next to your ship in the battle', () => {
    const totals = (skills: { me?: string[]; foe?: string[] }) => {
      let s = place(game(skills), [[0, 0, 6], [1, 0, 2]], [[0, 1, 3], [0, 2, 4]]);
      const { me, foe } = ids(s);
      s = apply(s, { type: 'attack', die: ship(me, 0), target: ship(foe, 0) });
      const head = s.pending[0];
      if (head.kind !== 'combat') throw new Error('no battle');
      head.attacker.dice = [3];
      head.defender.dice = [3];
      const o = combatOutcome(s, head);
      return [o.attacker.total, o.defender.total];
    };
    expect(totals({})).toEqual([9, 6]);
    expect(totals({ me: ['o-strategic'] })).toEqual([7, 6]);
    expect(totals({ foe: ['o-strategic'] })).toEqual([9, 4]);
  });

  /** Combat totals [attacker, defender] for my 6 at (2,2) attacking the enemy 3 at (2,3), both rolling `rolls`. */
  const battle = (skills: { me?: string[]; foe?: string[] }, friends: [number, number, number][] = [], rolls: [number, number] = [3, 3]) => {
    let s = place(game(skills), [[2, 2, 6], ...friends], [[2, 3, 3]]);
    const { me, foe } = ids(s);
    s = apply(s, { type: 'attack', die: ship(me, 0), target: ship(foe, 0) });
    const head = s.pending[0];
    if (head.kind !== 'combat') throw new Error('no battle');
    [head.attacker.dice, head.defender.dice] = [[rolls[0]], [rolls[1]]];
    const o = combatOutcome(s, head);
    return [o.attacker.total, o.defender.total];
  };

  it('Strategic: an attacker is supported by a ship orthogonally next to the defender, not diagonally (rules summary)', () => {
    expect(battle({ me: ['o-strategic'] }, [[3, 3, 2]])).toEqual([7, 6]); // (3,3) is next to the defender only
    expect(battle({ me: ['o-strategic'] }, [[3, 4, 2]])).toEqual([9, 6]); // (3,4) is diagonal to the defender
  });

  it('Ferocious and Strategic can take a roll below 1 (rules summary)', () => {
    // Roll 1, Ferocious −1, Strategic −2: the roll counts as −2.
    expect(battle({ me: ['o-ferocious', 'o-strategic'] }, [[3, 3, 2]], [1, 3])).toEqual([6 + 1 - 1 - 2, 6]);
  });
});

describe('destroying ships', () => {
  const battleground = (skills: { me?: string[]; foe?: string[] }) => place(game(skills), [[0, 0, 6]], [[0, 1, 3]]);

  it('Plundering: +3 research for destroying a ship on your turn', () => {
    const s = fight(battleground({ me: ['o-plundering'] }), [1, 6]);
    expect(s.players[ids(s).me].research).toBe(4);
  });

  it('Plundering does not apply when you destroy the attacker on another player’s turn (Stubborn)', () => {
    const s = fight(battleground({ foe: ['o-plundering', 'o-stubborn'] }), [6, 1]);
    expect(at(s, ship(ids(s).me, 0)).loc.zone).toBe('scrapyard');
    expect(s.players[ids(s).foe].research).toBe(1);
  });

  it('Stubborn: the destroyed attacker loses 1 dominance, as if the defender had attacked (FAQ, rules summary)', () => {
    const s = fight(battleground({ foe: ['o-stubborn'] }), [6, 1]);
    expect(at(s, ship(ids(s).me, 0)).loc.zone).toBe('scrapyard');
    expect([s.players[ids(s).me].dominance, s.players[ids(s).foe].dominance]).toEqual([2, 4]);
  });

  // Rules summary: the ±2 is instead of the usual ±1, not on top of it.
  it('Ravenous: dominance +2 for a kill, −2 for a loss', () => {
    const winner = fight(battleground({ me: ['o-ravenous'] }), [1, 6]);
    expect([winner.players[ids(winner).me].dominance, winner.players[ids(winner).foe].dominance]).toEqual([5, 2]);
    const loser = fight(battleground({ foe: ['o-ravenous'] }), [1, 6]);
    expect([loser.players[ids(loser).me].dominance, loser.players[ids(loser).foe].dominance]).toEqual([4, 1]);
  });

  it('Righteous: your dominance is not reduced when one of your ships is destroyed', () => {
    const s = fight(battleground({ foe: ['o-righteous'] }), [1, 6]);
    expect(s.players[ids(s).foe].dominance).toBe(3);
    expect(s.players[ids(s).me].dominance).toBe(4);
  });

  it('Righteous (Original) still lets you gain research, unlike the Community Edition card', () => {
    const s = game({ me: ['o-righteous'] });
    expect(apply(s, { type: 'research' }).players[ids(s).me].research).toBe(2);
  });

  it('Warlike: an extra action the first time you destroy a ship on your turn', () => {
    let s = place(game({ me: ['o-warlike'] }), [[0, 0, 6], [2, 1, 1]], [[0, 1, 3], [3, 1, 3]]);
    s = fight(s, [1, 6]);
    expect(s.turn.actionsLeft).toBe(3); // the attack's action back
    s = apply(s, { type: 'advance', move: false });
    s = apply(s, { type: 'freeAttack', die: ship(ids(s).me, 1), target: ship(ids(s).foe, 1) });
    if (s.pending[0].kind !== 'combat') throw new Error('no battle');
    s.pending[0].attacker.dice = [1];
    s.pending[0].defender.dice = [6];
    s = apply(s, { type: 'resolveCombat' });
    expect(at(s, ship(ids(s).foe, 1)).loc.zone).toBe('scrapyard');
    expect(s.turn.actionsLeft).toBe(3); // no second bonus
  });
});

describe('research and dominance', () => {
  it('Precocious: a research breakthrough at 4', () => {
    const at4 = (skills: string[]) => {
      const s = game({ me: skills });
      s.players[s.turn.player].research = 4;
      return apply(s, { type: 'endTurn' });
    };
    const s = at4(['o-precocious']);
    expect(s.pending[0]).toMatchObject({ kind: 'takeCard', count: 1 });
    expect(s.players[ids(s).me].research).toBe(1);
    expect(at4([]).pending).toEqual([]);
  });

  it('Tyrannical: once per turn, 1 research for 1 dominance', () => {
    let s = game({ me: ['o-tyrannical'] });
    const { me } = ids(s);
    s.players[me].research = 3;
    s = apply(s, { type: 'tyrannical' });
    expect([s.players[me].research, s.players[me].dominance]).toEqual([2, 4]);
    expect(() => apply(s, { type: 'tyrannical' })).toThrow('Already used');
    const broke = game({ me: ['o-tyrannical'] });
    expect(() => apply(broke, { type: 'tyrannical' })).toThrow('No research');
  });
});

describe('Gambit cards', () => {
  it('Aggression: dominance +2', () => {
    const s = game();
    const { me } = ids(s); // taking the card ends the turn
    expect(take(s, { gambit: 'o-aggression' }).players[me].dominance).toBe(5);
  });

  it('Momentum: a new turn with 2 actions, where ships move again and new Command cards work (FAQ)', () => {
    let s = game();
    const { me } = ids(s);
    s.turn.moved[ship(me, 0)] = 1;
    s = take(s, { command: 'o-eager', gambit: 'o-momentum' });
    expect(s.turn).toMatchObject({ player: me, actionsLeft: 2, bonus: true, phase: 'actions', moved: {} });
    expect(s.players[me].skills).toContainEqual({ id: 'o-eager', active: true });
    s = apply(s, legalActions(s).find((a) => a.type === 'deploy')!);
    expect(s.turn.actionsLeft).toBe(2);
  });

  it('Expansion: with Stealthy the new ship may go anywhere no ship is next to (rules summary)', () => {
    let s = place(game({ me: ['o-stealthy'] }), [[0, 0, 6]], [[0, 1, 3]]);
    const { me } = ids(s);
    s = take(s, { gambit: 'o-expansion' });
    const head = s.pending[0];
    if (head.kind !== 'placeExpansion') throw new Error(`expected an expansion ship, got ${head.kind}`);
    s = apply(s, { type: 'placeExpansion', to: { r: 5, c: 0 } });
    expect(at(s, head.die).loc).toEqual({ zone: 'board', r: 5, c: 0 });
    expect(at(s, head.die).owner).toBe(me);
  });

  it('Reorganization: re-rolled ships are placed again; with Stealthy anywhere no ship is next to (FAQ)', () => {
    let s = place(game({ me: ['o-stealthy'] }), [[0, 0, 6]], [[0, 1, 3]]);
    const { me } = ids(s);
    s = take(s, { gambit: 'o-reorganization' });
    expect(s.pending[0]).toMatchObject({ kind: 'unveil', reorganize: true });
    s = apply(s, { type: 'unveilReroll', die: ship(me, 0) });
    expect(at(s, ship(me, 0)).loc.zone).toBe('scrapyard');
    expect(() => apply(s, { type: 'unveilDeploy', die: ship(me, 1), to: { r: 5, c: 0 } })).toThrow('Only re-rolled');
    s = apply(s, { type: 'unveilDeploy', die: ship(me, 0), to: { r: 5, c: 0 } });
    expect(at(s, ship(me, 0)).loc).toEqual({ zone: 'board', r: 5, c: 0 });
  });
});
