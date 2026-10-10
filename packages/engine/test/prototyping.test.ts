/**
 * Prototyping mode (docs/PROTOTYPING.md, src/prototyping): Community Edition with movement capped at 3,
 * a new power for the 5 (Shoot), which replaces Manoeuvre, and over-conquest (an orbit of 12). The first block checks that none of it reaches the official modes, and that the mode
 * folder and the engine meet only at RULESETS and the prototype kit.
 *
 * Scenarios run on Alpha Sector, the basic map for 2 players (9×9; planets at rows/cols 1, 4, 7,
 * every other cell a space).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  apply,
  CLASSIC_SHIPS,
  orbitals,
  conquerCheck,
  legalActions,
  MODES,
  moveOptions,
  planetFreeSlots,
  rulesOf,
  RULESETS,
  shipsByIndex,
  stopZone,
  type Action,
  type GameMode,
  type GameState,
} from '../src';
import { beginPlay } from '../src/turn';
import { shoot as shootPower, shootTargets } from '../src/prototyping/powers/shoot';
import { quickStart } from './helpers';

const BASE: Record<'prototyping' | 'community', GameState> = {
  prototyping: quickStart(2, 1, 'prototyping'),
  community: quickStart(2, 1, 'community'),
};

/** Player 0 to act with 3 fresh actions, only the listed ships on the map, and the given skills. */
function scenario(dice: Record<string, [number, number, number]>, mode: 'prototyping' | 'community' = 'prototyping', skills: string[] = []): GameState {
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
const farthest = (s: GameState, id: string) => Math.max(...[...moveOptions(s, id).moves.values()].map((m) => m.steps));
const offered = (s: GameState, type: Action['type']) => legalActions(s).filter((a) => a.type === type);
/** The ships p0d0 may shoot now, by the legal actions (so cost and power included). */
const shots = (s: GameState) => legalActions(s).flatMap((a) => (a.type === 'power' && a.die === 'p0d0' && a.target ? [a.target] : [])).sort();

describe('Prototyping mode', () => {
  it('is listed after the official modes and plays like Community otherwise', () => {
    expect(MODES.map((m) => m.id)).toEqual(['basic', 'original', 'community', 'prototyping'] satisfies GameMode[]);
    const prototyping = rulesOf(BASE.prototyping);
    const community = rulesOf(BASE.community);
    expect(prototyping.name).toBe('Prototyping');
    expect(prototyping.cards).toBe(community.cards);
    expect(prototyping.startingMissiles).toBe(1);
    expect(prototyping.maxMovement).toBe(3);
    expect(prototyping.overConquest).toBe(true);
    expect(prototyping.ships[5].hooks).toBe(shootPower.hooks);
    expect(prototyping.ships[5].power).toBeUndefined();
    expect([1, 2, 3, 4, 6].map((v) => prototyping.ships[v])).toEqual([1, 2, 3, 4, 6].map((v) => community.ships[v]));
  });

  it('leaves the official modes alone: classic ships, no movement cap', () => {
    for (const mode of ['basic', 'original', 'community'] as const) {
      const rules = rulesOf(quickStart(2, 1, mode));
      expect(rules.ships, mode).toBe(CLASSIC_SHIPS);
      expect(rules.maxMovement, mode).toBeUndefined();
    }
    const s = scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 4], p1d1: [8, 8, 6] }, 'community');
    expect(offered(s, 'power')).toEqual([]);
    expect(stopZone(s, 0, shipsByIndex(s))).toBeUndefined();
  });

  it('official ships have no prototype hooks', () => {
    for (const mode of ['basic', 'original', 'community'] as const) {
      for (const ship of Object.values(RULESETS[mode].ships)) expect(ship.hooks, `${mode} ${ship.name}`).toBeUndefined();
    }
  });

  const src = join(__dirname, '../src');
  const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : sourceExtensions.some((ext) => e.name.endsWith(ext)) ? [join(dir, e.name)] : [],
    );
  const moduleSpecifiers = (text: string): string[] => {
    const source = ts.createSourceFile('boundary.ts', text, ts.ScriptTarget.Latest, true);
    const found: string[] = [];
    const add = (node: ts.Expression | undefined) => {
      if (node && ts.isStringLiteralLike(node)) found.push(node.text);
    };
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression);
      else if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0]);
        else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add(node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  };
  const imports = (f: string) => moduleSpecifiers(readFileSync(f, 'utf8'));
  const importedPath = (file: string, specifier: string) => resolve(dirname(file), specifier);
  const inPrototyping = (f: string) => relative(src, f).startsWith('prototyping/');
  const inPrototypingPath = (f: string) => {
    const path = relative(src, f);
    return path === 'prototyping' || path.startsWith('prototyping/');
  };

  it('is reached from the engine only through RULESETS (rules.ts)', () => {
    const importers = files(src)
      .filter((f) => !inPrototyping(f))
      .filter((f) => imports(f).some((i) => inPrototypingPath(importedPath(f, i))))
      .map((f) => relative(src, f));
    expect(importers).toEqual(['rules.ts']);
  });

  it('uses the engine only through the prototype kit (prototype.ts)', () => {
    for (const f of files(src).filter(inPrototyping)) {
      for (const i of imports(f)) {
        const target = relative(src, importedPath(f, i)).replace(/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '');
        expect(target === 'prototype' || target.startsWith('prototyping/'), `${relative(src, f)} imports ${i}`).toBe(true);
      }
    }
  });

  it('recognizes static, re-export, dynamic and require imports in the boundary check', () => {
    expect(
      moduleSpecifiers(
        "import './a'; export * from './b'; import('./c'); require('./d'); import item = require('./e');",
      ),
    ).toEqual(['./a', './b', './c', './d', './e']);
  });

  it('uses mode-configured regular-turn actions and research cap', () => {
    const rules = RULESETS.prototyping;
    const oldActions = rules.actionsPerTurn;
    const oldResearchLimit = rules.researchLimit;
    try {
      rules.actionsPerTurn = 2;
      rules.researchLimit = 4;

      const started = scenario({});
      beginPlay(started);
      expect(started.turn.actionsLeft).toBe(2);

      const ready = scenario({});
      ready.players[0].research = 3;
      expect(offered(ready, 'research')).toHaveLength(1);
      const researched = apply(ready, { type: 'research' });
      expect(researched.players[0].research).toBe(4);
      expect(offered(researched, 'research')).toEqual([]);
      expect(() => apply(researched, { type: 'research' })).toThrow(/at 4/);
    } finally {
      rules.actionsPerTurn = oldActions;
      rules.researchLimit = oldResearchLimit;
    }
  });
});

describe('movement cap', () => {
  it('caps the die value at 3', () => {
    for (const value of [3, 4, 5, 6]) expect(farthest(scenario({ p0d0: [0, 0, value] }), 'p0d0'), `a ${value}`).toBe(3);
    expect(farthest(scenario({ p0d0: [0, 0, 2] }), 'p0d0')).toBe(2);
    expect(farthest(scenario({ p0d0: [0, 0, 6] }, 'community'), 'p0d0')).toBe(6);
  });

  it('applies before skill bonuses: a 6 with Agile moves 4 (ruling 2026-10-08)', () => {
    expect(farthest(scenario({ p0d0: [0, 0, 6] }, 'prototyping', ['agile']), 'p0d0')).toBe(4);
    expect(farthest(scenario({ p0d0: [0, 0, 2] }, 'prototyping', ['agile']), 'p0d0')).toBe(3);
  });
});

describe('classic 5 ability is gone, 4 and 6 are kept', () => {
  it('a Frigate can change and a Scout can reconfigure for free, as in Community', () => {
    const s = scenario({ p0d0: [0, 0, 4], p0d1: [0, 8, 6] });
    expect(offered(s, 'change').length).toBeGreaterThan(0);
    expect(offered(s, 'freeReconfigure').length).toBeGreaterThan(0);
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

describe('Shoot (5 Interceptor)', () => {
  /** Shoots and fixes both combat rolls (lower total wins). */
  function shoot(s: GameState, target: string, attackerRoll: number, defenderRoll: number) {
    s = apply(s, { type: 'power', die: 'p0d0', target });
    const c = s.pending[0];
    if (c?.kind !== 'combat') throw new Error('no combat');
    c.attacker.dice = [attackerRoll];
    c.defender.dice = [defenderRoll];
    return apply(s, { type: 'resolveCombat' });
  }
  const mine = (s: GameState, type: Action['type']) => legalActions(s).filter((a) => a.type === type && 'die' in a && a.die === 'p0d0');

  it('attacks a ship 2 spaces away, and stays put when it wins', () => {
    const s0 = scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3] });
    expect(offered(s0, 'power')).toEqual([{ type: 'power', die: 'p0d0', target: 'p1d0' }]);
    const s = shoot(s0, 'p1d0', 1, 6);
    expect(at(s, 'p1d0').loc.zone).toBe('scrapyard');
    expect(at(s, 'p0d0').loc).toEqual({ zone: 'board', r: 0, c: 0 });
    expect(s.pending.some((p) => p.kind === 'advance')).toBe(false);
    expect(s.players[0].dominance).toBeGreaterThan(BASE.prototyping.players[0].dominance);
  });

  it('shoot, then move: one action for both, and no attack after', () => {
    const s = shoot(scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3], p1d1: [3, 0, 2] }), 'p1d0', 6, 1);
    expect(s.turn.actionsLeft).toBe(2);
    expect(mine(s, 'power')).toEqual([]);
    expect(mine(s, 'attack')).toEqual([]);
    expect(() => apply(s, { type: 'attack', die: 'p0d0', target: 'p1d1' })).toThrow(/can’t attack/);
    const moved = apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 1 } });
    expect(moved.turn.actionsLeft).toBe(2);
    expect(mine(moved, 'move')).toEqual([]);
  });

  it('a ship that fired keeps its free move and can’t attack, even after changing number', () => {
    const fired = shoot(scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3], p1d1: [0, 4, 2] }, 'prototyping', ['flexible']), 'p1d0', 6, 1);
    const s = apply(fired, { type: 'flexible', die: 'p0d0', delta: -1 });
    expect(at(s, 'p0d0').value).toBe(4);
    expect(mine(s, 'attack')).toEqual([]);
    expect(() => apply(s, { type: 'attack', die: 'p0d0', target: 'p1d1' })).toThrow(/can’t attack/);
    const moved = apply(s, { type: 'move', die: 'p0d0', to: { r: 1, c: 0 } });
    expect(moved.turn.actionsLeft).toBe(2);
  });

  it('a ship that moved, then became an Interceptor, can’t shoot for free', () => {
    const moved = apply(scenario({ p0d0: [0, 0, 4], p1d0: [0, 4, 3] }, 'prototyping', ['flexible']), { type: 'move', die: 'p0d0', to: { r: 0, c: 2 } });
    expect(shots(apply(moved, { type: 'flexible', die: 'p0d0', delta: 1 }))).toEqual([]);
  });

  it('move, then shoot: the shot is free', () => {
    const s0 = scenario({ p0d0: [0, 0, 5], p1d0: [2, 2, 3] });
    expect(shots(s0)).toEqual([]);
    const moved = apply(s0, { type: 'move', die: 'p0d0', to: { r: 0, c: 2 } });
    expect(moved.turn.actionsLeft).toBe(2);
    const s = shoot(moved, 'p1d0', 1, 6);
    expect(s.turn.actionsLeft).toBe(2);
    expect(at(s, 'p0d0').loc).toEqual({ zone: 'board', r: 0, c: 2 });
    expect(mine(s, 'power')).toEqual([]);
  });

  it('not after a normal attack', () => {
    const s0 = scenario({ p0d0: [0, 0, 5], p1d0: [0, 1, 6], p1d1: [2, 0, 3] });
    const s = apply(s0, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    const resolved = apply(s, { type: 'resolveCombat' });
    expect(shots(resolved.pending.length ? apply(resolved, { type: 'advance', move: false }) : resolved)).toEqual([]);
  });

  it('reaches the first ship in a clear orthogonal line, at any distance', () => {
    const ids = (s: GameState) => shootTargets(s, at(s, 'p0d0')).map((d) => d.id).sort();
    expect(ids(scenario({ p0d0: [0, 2, 5], p1d0: [0, 3, 3], p1d1: [0, 0, 2] }))).toEqual(['p1d0', 'p1d1']);
    expect(ids(scenario({ p0d0: [0, 0, 5], p1d0: [0, 8, 3] }))).toEqual(['p1d0']);
    // Not diagonal, and not a knight's move.
    expect(ids(scenario({ p0d0: [0, 2, 5], p1d0: [1, 3, 3], p1d1: [2, 3, 2] }))).toEqual([]);
  });

  it('is blocked by ships, planets and the edge of the board', () => {
    expect(shots(scenario({ p0d0: [0, 0, 5], p0d1: [0, 1, 2], p1d0: [0, 2, 3] }))).toEqual([]);
    expect(shots(scenario({ p0d0: [0, 0, 5], p1d0: [0, 3, 3], p1d1: [0, 6, 2] }))).toEqual(['p1d0']); // only the first
    expect(shots(scenario({ p0d0: [1, 0, 5], p1d0: [1, 2, 3] }))).toEqual([]); // a planet in between
    expect(shots(scenario({ p0d0: [0, 0, 5], p0d1: [0, 2, 3] }))).toEqual([]);
  });

  it('only a Prototyping Interceptor can shoot', () => {
    expect(shots(scenario({ p0d0: [0, 0, 4], p1d0: [0, 2, 3] }))).toEqual([]);
    const community = scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3] }, 'community');
    expect(shots(community)).toEqual([]);
    expect(() => apply(community, { type: 'power', die: 'p0d0', target: 'p1d0' })).toThrow(/no such power/);
  });
});

describe('over-conquest', () => {
  const full = (mode: 'prototyping' | 'community') => {
    const s = scenario({ p0d0: [0, 1, 6], p0d1: [1, 0, 6] }, mode);
    const planet = s.board.planets.find((p) => p.cubes.length === 0)!;
    return { s, planet };
  };

  it('is off outside Prototyping: a full planet cannot be conquered', () => {
    const { s, planet } = full('community');
    planet.cubes.push(1, 1, 1, 1, 1, 1, 1, 1);
    expect(conquerCheck(s, 0, planet.id).ok).toBe(false);
  });

  it('needs a sum of 12 and displaces a chosen opponent cube', () => {
    const base = scenario({}, 'prototyping');
    const planet = base.board.planets[0];
    const target = 12;
    const spots = orbitals(base.board, planet);
    const values: number[] = [];
    for (let left = target; left > 0; left -= values[values.length - 1]) values.push(Math.min(6, left));
    const placed: Record<string, [number, number, number]> = {};
    values.forEach((v, i) => (placed[`p0d${i}`] = [spots[i].r, spots[i].c, v]));
    const s = scenario(placed, 'prototyping');
    const p = s.board.planets[0];
    while (planetFreeSlots(p) > 0) p.cubes.push(1);
    const check = conquerCheck(s, 0, p.id);
    expect(check.target).toBe(target);
    expect(check.ok).toBe(true);
    expect(check.replace).toEqual([1]);
    const before = s.players[1].cubesLeft;
    const after = apply(s, { type: 'conquer', planet: p.id, replace: 1 });
    expect(after.players[1].cubesLeft).toBe(before + 1);
    expect(after.board.planets[0].cubes.filter((c) => c === 0)).toHaveLength(1);
    expect(after.board.planets[0].cubes.filter((c) => c === 1)).toHaveLength(p.cubes.length - 1);
  });
  it('is also offered on a planet with room, next to a plain conquest', () => {
    const base = scenario({}, 'prototyping');
    const planet = base.board.planets.find((q) => q.capacity >= 2)!;
    const spots = orbitals(base.board, planet);
    const values: number[] = [];
    for (let left = 12; left > 0; left -= values[values.length - 1]) values.push(Math.min(6, left));
    const placed: Record<string, [number, number, number]> = {};
    values.forEach((v, i) => (placed[`p0d${i}`] = [spots[i].r, spots[i].c, v]));
    const s = scenario(placed, 'prototyping');
    const p = s.board.planets[planet.id];
    p.cubes = [1];
    expect(planetFreeSlots(p)).toBeGreaterThan(0);
    expect(conquerCheck(s, 0, p.id).ok).toBe(false);
    expect(conquerCheck(s, 0, p.id, true).ok).toBe(true);
    expect(legalActions(s)).toContainEqual({ type: 'conquer', planet: p.id, replace: 1 });
    const after = apply(s, { type: 'conquer', planet: p.id, replace: 1 });
    expect(after.board.planets[planet.id].cubes).toEqual([0]);
  });
});
