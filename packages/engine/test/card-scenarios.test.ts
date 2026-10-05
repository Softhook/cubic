/**
 * A scenario per card, driving it through its real trigger (an actual combat, card pick or turn
 * change) and asserting its effect. Cards in real games, at every AI level and on many maps, are
 * checked by the card audit (card-audit.test.ts).
 *
 * Scenarios are registered with `cardCase`, so the coverage check at the end is built when the
 * file is collected and doesn't depend on which tests run, or in what order.
 */
import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../ai/src';
import {
  apply,
  checkInvariants,
  combatOutcome,
  conquerCheck,
  deployTargets,
  deploysFree,
  die,
  EXPANSION,
  legalActions,
  nomadicTargets,
  orbitals,
  ORIGINAL_COMMAND,
  ORIGINAL_GAMBIT,
  shipsOnBoard,
  skillLimit,
  SKILLS,
  TACTICS,
  type Action,
  type CardDef,
  type CombatPending,
  type GameMode,
  type GameState,
} from '../src';
import { setSkills, toRow } from './audit';
import { arrange, originalGame, quickStart, seededRandom } from './helpers';

const ALL_CARDS: CardDef[] = [...SKILLS, ...TACTICS, EXPANSION, ...ORIGINAL_COMMAND, ...ORIGINAL_GAMBIT];

const covered = new Set<string>();

/** Registers a scenario for these cards. */
function cardCase(ids: string[], name: string, fn: () => void) {
  for (const id of ids) covered.add(id);
  it(name, fn);
}

const keyOf = (a: Action) => JSON.stringify(a, Object.keys(a).sort());

function expectValid(s: GameState, context: string) {
  expect(checkInvariants(s), context).toEqual([]);
}

/** Resolves every open decision with the AI, asserting invariants; returns the decision kinds seen. */
function resolveWithAi(state: GameState, random: () => number): { s: GameState; seen: Set<string> } {
  let s = state;
  const seen = new Set<string>();
  for (let i = 0; s.pending.length; i++) {
    if (i > 50) throw new Error(`decisions did not resolve: ${s.pending.map((p) => p.kind)}`);
    seen.add(s.pending[0].kind);
    const action = chooseAction(s, { random });
    if (!action) throw new Error(`AI has no action for ${s.pending[0].kind}`);
    s = apply(s, action);
    expectValid(s, `after ${keyOf(action)}`);
  }
  return { s, seen };
}

/** The combat now waiting to be resolved. */
function combatOf(s: GameState): CombatPending {
  const head = s.pending[0];
  if (head?.kind !== 'combat') throw new Error(`expected a combat, got ${head?.kind ?? 'nothing'}`);
  return head;
}

/** Player 0 attacks player 1 with fixed dice, both at 3 Dominance; player 0's ship (p0d0) wins or loses. */
function duel(mode: GameMode, seed: number, skills: { me?: string[]; foe?: string[] }, attackerWins: boolean): GameState {
  let s = arrange(quickStart(2, seed, mode), attackerWins ? { p0d0: [2, 2, 2], p1d0: [2, 3, 6] } : { p0d0: [2, 2, 6], p1d0: [2, 3, 1] });
  s.turn.player = 0;
  s.players[0].skills = (skills.me ?? []).map((id) => ({ id, active: true }));
  s.players[1].skills = (skills.foe ?? []).map((id) => ({ id, active: true }));
  for (const pl of s.players) pl.dominance = 3;
  s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
  const combat = combatOf(s);
  combat.attacker.dice = attackerWins ? [1] : [6];
  combat.defender.dice = attackerWins ? [6] : [1];
  s = apply(s, { type: 'resolveCombat' });
  if (s.pending[0]?.kind === 'advance') s = apply(s, { type: 'advance', move: false });
  return s;
}

/** The current player takes `id` from the tactic row, as if earned in the card phase. */
function takeTactic(s: GameState, id: string, store = false): GameState {
  toRow(s, 'tactic', id);
  s.pending.unshift({ kind: 'takeCard', player: s.turn.player, count: 1 });
  return apply(s, { type: 'takeCard', deck: 'tactic', index: 0, store });
}

describe('tactics, gambits and expansion', () => {
  TACTICS.forEach((tactic, i) =>
    cardCase([tactic.id], tactic.name, () => {
      let s = quickStart(2, 200 + i, 'community');
      const p = s.turn.player;
      const foe = 1 - p;
      setSkills(s, p, []);
      const before = structuredClone(s);
      const ships = shipsOnBoard(s).length;
      const r = resolveWithAi(takeTactic(s, tactic.id), seededRandom(i * 31 + 5));
      s = r.s;
      switch (tactic.id) {
        case 'aggression': expect(s.players[p].dominance).toBe(Math.min(6, before.players[p].dominance + 2)); break;
        case 'black-market': expect(s.players[p].missiles).toBe(before.players[p].missiles + 2); break;
        case 'momentum': expect(s.players[p].bonusTurns).toEqual([...before.players[p].bonusTurns, 2]); break;
        case 'plan-ahead': expect(s.players[p].planAhead).toBe(2); break;
        case 'sabotage': expect(s.players[foe].actionPenalty).toBe(before.players[foe].actionPenalty + 1); break;
        case 'warp-gate': expect(s.gates).toHaveLength(2); break;
        case 'change-of-heart':
          expect(r.seen).toContain('changeOfHeart');
          expect(s.players[p].skills).toHaveLength(1);
          break;
        case 'show-of-force':
          expect(r.seen).toContain('showOfForce');
          expect(shipsOnBoard(s).length).toBe(ships - 1);
          break;
        case 'unveil-the-fleet': expect(r.seen).toContain('unveil'); break;
        default: throw new Error(`no scenario for ${tactic.id}`);
      }
    }),
  );

  cardCase([EXPANSION.id], 'Expansion', () => {
    let s = quickStart(2, 199, 'community');
    const p = s.turn.player;
    s.market.expansions = 1;
    s.pending.unshift({ kind: 'takeCard', player: p, count: 1 });
    const ships = shipsOnBoard(s, p).length;
    s = resolveWithAi(apply(s, { type: 'takeCard', deck: 'expansion', index: 0 }), seededRandom(3)).s;
    expect(shipsOnBoard(s, p)).toHaveLength(ships + 1);
  });

  ORIGINAL_GAMBIT.forEach((gambit, i) =>
    cardCase([gambit.id], `${gambit.name} (Original)`, () => {
      let s = quickStart(2, 500 + i, 'original');
      const p = s.turn.player;
      const foe = 1 - p;
      if (gambit.id === 'o-relocation') {
        s.board.planets[0].cubes.push(foe);
        s.players[foe].cubesLeft--;
      }
      if (gambit.id === 'o-sabotage') setSkills(s, foe, ['o-agile']);
      const before = structuredClone(s);
      const ships = shipsOnBoard(s, p).length;
      const r = resolveWithAi(takeTactic(s, gambit.id), seededRandom(i * 13 + 7));
      s = r.s;
      switch (gambit.id) {
        case 'o-aggression': expect(s.players[p].dominance).toBe(Math.min(6, before.players[p].dominance + 2)); break;
        case 'o-momentum': expect(s.players[p].bonusTurns).toEqual([...before.players[p].bonusTurns, 2]); break;
        case 'o-relocation': expect(s.board.planets[0].cubes).not.toContain(foe); break;
        case 'o-sabotage': expect(s.players[foe].skills).toHaveLength(0); break;
        case 'o-reorganization': expect(r.seen).toContain('unveil'); break;
        case 'o-expansion': expect(shipsOnBoard(s, p)).toHaveLength(ships + 1); break;
        default: throw new Error(`no scenario for ${gambit.id}`);
      }
    }),
  );
});

describe('activated skills', () => {
  cardCase(['composed', 'o-cerebral'], 'Composed / Cerebral', () => {
    for (const [mode, id] of [['community', 'composed'], ['original', 'o-cerebral']] as const) {
      let s = quickStart(2, 601, mode);
      const p = s.turn.player;
      s.players[p].skills = [{ id, active: true }];
      s.players[p].dominance = 3;
      s.players[p].research = 1;
      s = apply(s, { type: 'composed' });
      expect(s.players[p].dominance).toBe(2);
      expect(s.players[p].research).toBe(4);
    }
  });

  cardCase(['ambitious'], 'Ambitious', () => {
    let s = quickStart(2, 603, 'community');
    const p = s.turn.player;
    s.players[p].skills = [{ id: 'ambitious', active: true }];
    const actions = s.turn.actionsLeft;
    s = apply(s, { type: 'ambitious' });
    expect(s.turn.actionsLeft).toBe(actions + 1);
    expect(s.players[p].ambitionTokens).toBe(1);
  });

  cardCase(['flexible', 'o-flexible'], 'Flexible', () => {
    for (const [mode, id] of [['community', 'flexible'], ['original', 'o-flexible']] as const) {
      let s = quickStart(2, 604, mode);
      const p = s.turn.player;
      s.players[p].skills = [{ id, active: true }];
      const ship = shipsOnBoard(s, p)[0].id;
      die(s, ship).value = 3;
      s = apply(s, { type: 'flexible', die: ship, delta: 1 });
      expect(die(s, ship).value).toBe(4);
    }
  });

  cardCase(['resourceful', 'o-resourceful'], 'Resourceful', () => {
    for (const [mode, id] of [['community', 'resourceful'], ['original', 'o-resourceful']] as const) {
      let s = quickStart(2, 606, mode);
      const p = s.turn.player;
      s.players[p].skills = [{ id, active: true }];
      const ship = shipsOnBoard(s, p)[0].id;
      const actions = s.turn.actionsLeft;
      s = apply(s, { type: 'resourceful', die: ship });
      expect(die(s, ship).loc.zone).toBe('scrapyard');
      expect(s.turn.actionsLeft).toBe(actions + 1);
    }
  });

  cardCase(['tactical', 'o-tactical'], 'Tactical', () => {
    for (const [mode, id] of [['community', 'tactical'], ['original', 'o-tactical']] as const) {
      let s = arrange(quickStart(2, 608, mode), { p0d0: [2, 2, 3] });
      s.players[0].skills = [{ id, active: true }];
      s.turn.player = 0;
      s = apply(s, { type: 'tactical', die: 'p0d0', to: { r: 2, c: 3 } });
      expect(die(s, 'p0d0').loc).toEqual({ zone: 'board', r: 2, c: 3 });
    }
  });

  cardCase(['o-nomadic'], 'Nomadic', () => {
    let s = originalGame({ me: ['o-nomadic'] });
    const ship = shipsOnBoard(s, s.turn.player)[0];
    die(s, ship.id).loc = { zone: 'board', ...orbitals(s.board, s.board.planets[0])[0] };
    const targets = nomadicTargets(s, ship.id);
    expect(targets.length).toBeGreaterThan(0);
    s = apply(s, { type: 'nomadic', die: ship.id, to: targets[0] });
    expect(die(s, ship.id).loc).toEqual({ zone: 'board', ...targets[0] });
  });

  cardCase(['o-tyrannical'], 'Tyrannical (Original)', () => {
    let s = quickStart(2, 610, 'original');
    const p = s.turn.player;
    s.players[p].skills = [{ id: 'o-tyrannical', active: true }];
    s.players[p].research = 3;
    s.players[p].dominance = 1;
    s = apply(s, { type: 'tyrannical' });
    expect(s.players[p].research).toBe(2);
    expect(s.players[p].dominance).toBe(2);
  });

  cardCase(['patient'], 'Patient', () => {
    let s = quickStart(2, 611, 'community');
    const p = s.turn.player;
    s.players[p].skills = [{ id: 'patient', active: true }];
    s = takeTactic(s, 'aggression', true);
    expect(s.players[p].storedTactics).toEqual(['aggression']);
    const dominance = s.players[p].dominance;
    s = apply(s, { type: 'playStoredTactic', card: 'aggression' });
    expect(s.players[p].dominance).toBe(dominance + 2);
    expect(s.players[p].storedTactics).toEqual([]);
    expect(legalActions(s)).toEqual([{ type: 'endTurn' }]);
  });

  cardCase(['curious'], 'Curious (CE)', () => {
    let s = quickStart(2, 713, 'community');
    const p = s.turn.player;
    s.players[p].skills = [{ id: 'curious', active: true }];
    s.players[p].research = 1;
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'research' });
    expect(s.turn.actionsLeft).toBe(0);
    s = apply(s, { type: 'research' });
    expect(s.turn.curiousUsed).toBe(true);
    expect(s.players[p].research).toBe(5);
    expect(legalActions(s)).toEqual([{ type: 'endTurn' }]);
  });

  cardCase(['profiteering'], 'Profiteering', () => {
    let s = quickStart(2, 716, 'community');
    const p = s.turn.player;
    s.players[p].skills = [{ id: 'profiteering', active: true }];
    s.pending.unshift({ kind: 'takeCard', player: p, count: 1, conquer: 1 });
    const missiles = s.players[p].missiles;
    s = apply(s, { type: 'profiteer' });
    expect(s.players[p].missiles).toBe(missiles + 1);
  });
});

describe('triggered and choice skills', () => {
  cardCase(['clever', 'o-clever'], 'Clever', () => {
    // CE: after a Reconfigure, keep the number or change it by 1.
    let s = arrange(quickStart(2, 701, 'community'), { p0d0: [2, 2, 3] });
    s.turn.player = 0;
    s.players[0].skills = [{ id: 'clever', active: true }];
    s = apply(s, { type: 'reconfigure', die: 'p0d0' });
    const ce = s.pending[0];
    expect(ce).toMatchObject({ kind: 'clever', source: 'clever' });
    const rolled = die(s, 'p0d0').value;
    s = apply(s, { type: 'clever', value: rolled });
    expect(die(s, 'p0d0').value).toBe(rolled);

    // Original: choose the number instead of rolling it.
    let so = arrange(quickStart(2, 702, 'original'), { p0d0: [2, 2, 3] });
    so.turn.player = 0;
    so.players[0].skills = [{ id: 'o-clever', active: true }];
    so = apply(so, { type: 'reconfigure', die: 'p0d0' });
    expect(so.pending[0]).toMatchObject({ kind: 'clever', avoid: 3 });
    expect(() => apply(so, { type: 'clever', value: 3 })).toThrow();
    so = apply(so, { type: 'clever', value: 5 });
    expect(die(so, 'p0d0').value).toBe(5);
  });

  cardCase(['calculating'], 'Calculating', () => {
    // Player 1's defending ship is destroyed: its owner picks the number it shows in the scrapyard.
    let s = duel('community', 703, { foe: ['calculating'] }, true);
    expect(die(s, 'p1d0').loc.zone).toBe('scrapyard');
    expect(s.pending.find((p) => p.kind === 'clever')).toMatchObject({ player: 1, die: 'p1d0', source: 'calculating' });
    while (s.pending[0].kind !== 'clever') s = apply(s, legalActions(s)[0]);
    s = apply(s, { type: 'clever', value: 4 });
    expect(die(s, 'p1d0').value).toBe(4);
  });

  cardCase(['brilliant', 'o-brilliant'], 'Brilliant', () => {
    for (const [mode, id] of [['community', 'brilliant'], ['original', 'o-brilliant']] as const) {
      let s = quickStart(2, 704, mode);
      const p = s.turn.player;
      s.players[p].skills = [{ id, active: true }];
      s.players[p].research = 1;
      s = apply(s, { type: 'endTurn' });
      s = apply(s, { type: 'endTurn' });
      expect(s.players[p].research).toBe(3);
    }
  });

  cardCase(['o-scrappy'], 'Scrappy', () => {
    let s = arrange(quickStart(2, 706, 'original'), { p0d0: [2, 2, 3] });
    s.turn.player = 0;
    s.players[0].skills = [{ id: 'o-scrappy', active: true }];
    s = apply(s, { type: 'reconfigure', die: 'p0d0' });
    expect(s.turn.scrappy).toMatchObject({ die: 'p0d0' });
    s = apply(s, { type: 'scrappy' });
    expect(s.turn.scrappy).toBeUndefined();
  });

  cardCase(['ruthless'], 'Ruthless', () => {
    let s = duel('community', 707, { me: ['ruthless'], foe: ['agile'] }, true);
    expect(s.pending[0]).toMatchObject({ kind: 'ruthless', player: 0, victim: 1 });
    s = apply(s, { type: 'ruthless', skill: 'agile' });
    expect(s.players[1].skills[0]).toMatchObject({ active: false, disabledUntil: 0 });
  });

  cardCase(['prideful'], 'Prideful', () => {
    let s = duel('community', 708, { foe: ['prideful'] }, true);
    expect(s.pending[0]).toMatchObject({ kind: 'prideful', player: 0, victim: 1 });
    s = apply(s, { type: 'prideful', take: true });
    expect(s.players[0].skills).toEqual([{ id: 'prideful', active: true }]);
    expect(s.players[1].skills).toEqual([]);
  });

  cardCase(['dangerous', 'o-dangerous'], 'Dangerous', () => {
    for (const [mode, id] of [['community', 'dangerous'], ['original', 'o-dangerous']] as const) {
      let s = arrange(quickStart(2, 709, mode), { p0d0: [2, 2, 3], p1d0: [2, 3, 3] });
      s.turn.player = 0;
      s.players[1].skills = [{ id, active: true }];
      s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
      expect(s.pending[0]).toMatchObject({ kind: 'dangerous', player: 1 });
      s = apply(s, { type: 'dangerous', destroy: true });
      expect(die(s, 'p0d0').loc.zone).toBe('scrapyard');
      expect(die(s, 'p1d0').loc.zone).toBe('scrapyard');
    }
  });

  cardCase(['o-cruel', 'o-relentless'], 'Cruel / Relentless', () => {
    // Cruel re-rolls the attacker's die when defending; Relentless re-rolls its own when attacking.
    for (const [id, by] of [['o-cruel', 1], ['o-relentless', 0]] as const) {
      let s = arrange(quickStart(2, 711, 'original'), { p0d0: [2, 2, 3], p1d0: [2, 3, 3] });
      s.turn.player = 0;
      s.players[by].skills = [{ id, active: true }];
      s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
      const combat = combatOf(s);
      combat.attacker.dice = by === 1 ? [1] : [6];
      combat.defender.dice = by === 1 ? [6] : [1];
      s = apply(s, { type: 'reroll', by, side: 'attacker' });
      expect(combatOf(s).rerolls).toHaveLength(1);
    }
  });

  cardCase(['cunning', 'o-cunning'], 'Cunning', () => {
    for (const [mode, id] of [['community', 'cunning'], ['original', 'o-cunning']] as const) {
      let s = arrange(quickStart(2, 714, mode), { p0d0: [2, 2, 6] });
      s.players[0].skills = [{ id, active: true }];
      s.turn.player = 0;
      s = apply(s, { type: 'freeReconfigure', die: 'p0d0' });
      while (s.pending.length) s = apply(s, legalActions(s)[0]);
      die(s, 'p0d0').value = 6;
      s = apply(s, { type: 'freeReconfigure', die: 'p0d0' });
      expect(s.turn.oncePerTurn).toContain('cunning');
    }
  });
});

describe('passive skills and rule hooks', () => {
  cardCase(['agile', 'o-agile'], 'Agile', () => {
    for (const [mode, id] of [['community', 'agile'], ['original', 'o-agile']] as const) {
      let s = arrange(quickStart(2, 801, mode), { p0d0: [0, 0, 3] });
      s.turn.player = 0;
      expect(() => apply(s, { type: 'move', die: 'p0d0', to: { r: 4, c: 0 } })).toThrow();
      s.players[0].skills = [{ id, active: true }];
      s = apply(s, { type: 'move', die: 'p0d0', to: { r: 4, c: 0 } });
      expect(die(s, 'p0d0').loc).toEqual({ zone: 'board', r: 4, c: 0 });
    }
  });

  cardCase(['devious'], 'Devious', () => {
    let s = arrange(quickStart(2, 803, 'community'), { p0d0: [0, 0, 2], p1d0: [1, 0, 4] });
    s.turn.player = 0;
    s.players[0].skills = [{ id: 'devious', active: true }];
    s = apply(s, { type: 'move', die: 'p0d0', to: { r: 2, c: 0 } });
    expect(die(s, 'p0d0').loc).toEqual({ zone: 'board', r: 2, c: 0 });
  });

  cardCase(['stealthy', 'o-stealthy'], 'Stealthy', () => {
    for (const [mode, id] of [['community', 'stealthy'], ['original', 'o-stealthy']] as const) {
      let s = quickStart(2, 805, mode);
      s.turn.player = 0;
      die(s, 'p0d0').loc = { zone: 'scrapyard' };
      const normal = deployTargets(s, 0).length;
      s.players[0].skills = [{ id, active: true }];
      const targets = deployTargets(s, 0);
      expect(targets.length).toBeGreaterThan(normal);
      s = apply(s, { type: 'deploy', die: 'p0d0', to: targets[targets.length - 1] });
      expect(die(s, 'p0d0').loc.zone).toBe('board');
    }
  });

  cardCase(['steadfast', 'o-energetic'], 'Steadfast / Energetic', () => {
    for (const [mode, id] of [['community', 'steadfast'], ['original', 'o-energetic']] as const) {
      let s = arrange(quickStart(2, 807, mode), { p0d0: [0, 0, 1] });
      s.players[0].skills = [{ id, active: true }];
      s.turn.player = 0;
      s = apply(s, { type: 'move', die: 'p0d0', to: { r: 1, c: 0 } });
      s = apply(s, { type: 'move', die: 'p0d0', to: { r: 2, c: 0 } });
      expect(die(s, 'p0d0').loc).toEqual({ zone: 'board', r: 2, c: 0 });
    }
  });

  cardCase(['talented'], 'Talented', () => {
    const s = quickStart(2, 809, 'community');
    s.players[0].skills = [];
    expect(skillLimit(s, 0)).toBe(3);
    s.players[0].skills = [{ id: 'talented', active: true }];
    expect(skillLimit(s, 0)).toBe(5);
  });

  cardCase(['precocious', 'o-precocious'], 'Precocious', () => {
    for (const [mode, id] of [['community', 'precocious'], ['original', 'o-precocious']] as const) {
      let s = quickStart(2, 810, mode);
      s.turn.player = 0;
      s.players[0].research = 4;
      expect(apply(s, { type: 'endTurn' }).pending.some((p) => p.kind === 'takeCard')).toBe(false);
      s.players[0].skills = [{ id, active: true }];
      s = apply(s, { type: 'endTurn' });
      expect(s.pending.some((p) => p.kind === 'takeCard')).toBe(true);
    }
  });

  cardCase(['righteous', 'o-righteous'], 'Righteous', () => {
    // Both keep Dominance when a ship is destroyed; the CE card also blocks every research gain.
    for (const [mode, id] of [['community', 'righteous'], ['original', 'o-righteous']] as const) {
      const before = duel(mode, 812, {}, false).players[1].dominance;
      expect(duel(mode, 812, {}, true).players[1].dominance).toBeLessThan(before);
      expect(duel(mode, 812, { foe: [id] }, true).players[1].dominance).toBe(before);
    }
    const s = quickStart(2, 813, 'community');
    s.players[s.turn.player].skills = [{ id: 'righteous', active: true }];
    expect(() => apply(s, { type: 'research' })).toThrow('You cannot gain research');
  });

  cardCase(['brutal'], 'Brutal', () => {
    const s = arrange(quickStart(2, 820, 'community'), { p0d0: [2, 2, 6], p1d0: [2, 3, 3] });
    s.players[0].skills = [{ id: 'brutal', active: true }];
    s.turn.player = 0;
    expect(combatOf(apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' })).attacker.dice).toHaveLength(2);
  });

  /** The attacker's combat total with fixed dice of 3 each, with `skills` on `side`. */
  function total(mode: GameMode, skills: string[], side: 0 | 1, placements: Record<string, [number, number, number]> = {}) {
    let s = arrange(quickStart(2, 821, mode), { p0d0: [2, 2, 6], p1d0: [2, 3, 3], ...placements });
    s.players[side].skills = skills.map((id) => ({ id, active: true }));
    s.turn.player = 0;
    s = apply(s, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    const combat = combatOf(s);
    combat.attacker.dice = [3];
    combat.defender.dice = [3];
    return { s, combat, out: combatOutcome(s, combat) };
  }

  cardCase(['ferocious', 'o-ferocious'], 'Ferocious', () => {
    for (const [mode, id] of [['community', 'ferocious'], ['original', 'o-ferocious']] as const) {
      expect(total(mode, [id], 0).out.attacker.total).toBe(total(mode, [], 0).out.attacker.total - 1);
    }
  });

  cardCase(['rational', 'o-rational'], 'Rational', () => {
    for (const [mode, id] of [['community', 'rational'], ['original', 'o-rational']] as const) {
      const { s, combat } = total(mode, [id], 0);
      combat.attacker.dice = [6];
      expect(combatOutcome(s, combat).attacker.roll).toBe(3);
    }
  });

  cardCase(['strategic', 'o-strategic'], 'Strategic', () => {
    for (const [mode, id] of [['community', 'strategic'], ['original', 'o-strategic']] as const) {
      const support = { p0d1: [1, 2, 2] as [number, number, number] };
      expect(total(mode, [id], 0, support).out.attacker.total).toBe(total(mode, [], 0, support).out.attacker.total - 2);
    }
  });

  cardCase(['stubborn', 'o-stubborn'], 'Stubborn', () => {
    for (const [mode, id] of [['community', 'stubborn'], ['original', 'o-stubborn']] as const) {
      const { out } = total(mode, [id], 1, { p1d0: [2, 3, 6] });
      expect(out.attackerWins).toBe(false);
      expect(out.stubborn).toBe(true);
    }
  });

  cardCase(['ingenious', 'o-ingenious', 'intelligent', 'o-intelligent', 'pioneering', 'tyrannical'], 'Conquer skills', () => {
    const conquers = (id: string | null, ships: [number, number, number][], research?: number) => {
      const base = originalGame({ me: id ? [id] : [] });
      const me = base.turn.player;
      const s = arrange(base, Object.fromEntries(ships.map((p, i) => [`p${me}d${i}`, p])));
      if (research !== undefined) s.players[me].research = research;
      if (id === 'tyrannical') s.players[me].dominance = 2;
      const centre = s.board.planets.find((p) => p.number === 8)!.id;
      return conquerCheck(s, me, centre).ok;
    };
    const cases: [string, [number, number, number][], number?][] = [
      ['ingenious', [[3, 3, 5], [3, 4, 3]]], // a diagonal ship counts
      ['o-ingenious', [[3, 3, 5], [3, 4, 3]]],
      ['intelligent', [[3, 4, 3], [5, 4, 4]]], // 7 for an 8
      ['o-intelligent', [[3, 4, 3], [5, 4, 4]]],
      ['pioneering', [[3, 4, 2]], 8], // research in place of a ship
      ['tyrannical', [[3, 4, 6]]], // ship 6 + dominance 2
    ];
    for (const [id, ships, research] of cases) {
      expect(conquers(null, ships, research), `${id} needed`).toBe(false);
      expect(conquers(id, ships, research), id).toBe(true);
    }
  });

  cardCase(['industrious', 'o-curious', 'o-arrogant', 'o-conformist'], 'Start-of-turn bonuses', () => {
    let s = quickStart(2, 814, 'community');
    const p = s.turn.player;
    s.players[p].skills = [{ id: 'industrious', active: true }];
    s = apply(apply(s, { type: 'endTurn' }), { type: 'endTurn' });
    expect(s.turn.freeDeploys).toBe(1);

    let so = quickStart(2, 815, 'original');
    const po = so.turn.player;
    so.players[po].skills = [{ id: 'o-curious', active: true }];
    so = apply(apply(so, { type: 'endTurn' }), { type: 'endTurn' });
    expect(so.turn.freeMoves).toBe(1);

    let sa = quickStart(2, 816, 'original');
    const pa = sa.turn.player;
    sa.players[pa].skills = [{ id: 'o-arrogant', active: true }];
    for (const d of sa.dice) if (d.owner === 1 - pa) d.loc = { zone: 'scrapyard' };
    sa = apply(apply(sa, { type: 'endTurn' }), { type: 'endTurn' });
    expect(sa.turn.actionsLeft).toBe(4);

    let sc = quickStart(2, 817, 'original');
    const pc = sc.turn.player;
    sc.players[pc].skills = [{ id: 'o-conformist', active: true }];
    const [a, b] = shipsOnBoard(sc, pc);
    a.value = 3;
    b.value = 3;
    sc = apply(apply(sc, { type: 'endTurn' }), { type: 'endTurn' });
    expect(sc.turn.actionsLeft).toBe(4);
  });

  cardCase(['hostile', 'o-warlike'], 'Hostile / Warlike', () => {
    for (const [mode, id] of [['community', 'hostile'], ['original', 'o-warlike']] as const) {
      // The attack's action is given back.
      expect(duel(mode, 835, { me: [id] }, true).turn.actionsLeft).toBe(3);
      expect(duel(mode, 835, {}, true).turn.actionsLeft).toBe(2);
    }
  });

  cardCase(['plundering', 'o-plundering'], 'Plundering', () => {
    for (const [mode, id] of [['community', 'plundering'], ['original', 'o-plundering']] as const) {
      const s = duel(mode, 837, { me: [id] }, true);
      expect(s.players[0].research).toBe(duel(mode, 837, {}, true).players[0].research + 3);
    }
  });

  cardCase(['ravenous', 'o-ravenous'], 'Ravenous', () => {
    for (const [mode, id] of [['community', 'ravenous'], ['original', 'o-ravenous']] as const) {
      const s = duel(mode, 839, { me: [id] }, true);
      expect(s.players[0].dominance).toBe(duel(mode, 839, {}, true).players[0].dominance + 1);
    }
  });

  cardCase(['o-eager'], 'Eager', () => {
    const s = quickStart(2, 818, 'original');
    expect(deploysFree(s, 0)).toBe(false);
    s.players[0].skills = [{ id: 'o-eager', active: true }];
    expect(deploysFree(s, 0)).toBe(true);
  });
});

it('has a scenario for every card', () => {
  expect(ALL_CARDS.map((c) => c.id).filter((id) => !covered.has(id))).toEqual([]);
});
