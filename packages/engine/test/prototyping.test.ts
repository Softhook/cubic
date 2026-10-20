/**
 * Prototyping mode (docs/PROTOTYPING.md, src/prototyping): Community Edition with movement capped at 3,
 * zones of control (every ship pickets the spaces around it), a new power for the 5 (Shoot), which
 * replaces Manoeuvre, and over-conquest (an orbit of 12). The first block checks that none of it reaches the official modes, and that the mode
 * folder and the engine meet only at RULESETS and the prototype kit.
 *
 * Scenarios run on Alpha Sector, the basic map for 2 players (9×9; planets at rows/cols 1, 4, 7,
 * every other cell a space), and on Alpha Sector (hex) for zones and Shoot along a hex's 6 sides.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  adjacent,
  apply,
  CLASSIC_SHIPS,
  orbitals,
  conquerCheck,
  grid,
  attackLaunches,
  legalActions,
  MODES,
  moveIndexes,
  movePath,
  moveOptions,
  mulberry32,
  planetFreeSlots,
  rulesOf,
  RULESETS,
  shipsByIndex,
  stopZone,
  tryApply,
  type Action,
  type GameMode,
  type GameState,
} from '../src';
import { beginPlay } from '../src/turn';
import { PROTOTYPING_CARDS } from '../src/prototyping';
import { picket } from '../src/prototyping/powers/picket';
import { shoot as shootPower, shootTargets } from '../src/prototyping/powers/shoot';
import { quickStart } from './helpers';

/** `hex`: Prototyping on Alpha Sector (hex), with axial cells (docs/HEX.md): a space's sides are a row or column away, or (-1, +1) and (+1, -1). */
const BASE: Record<'prototyping' | 'community' | 'hex', GameState> = {
  prototyping: quickStart(2, 1, 'prototyping'),
  community: quickStart(2, 1, 'community'),
  hex: quickStart(2, 1, 'prototyping', 'alpha-hex'),
};

/** Player 0 to act with 3 fresh actions, only the listed ships on the map, and the given skills. */
function scenario(
  dice: Record<string, [number, number, number]>,
  mode: keyof typeof BASE = 'prototyping',
  skills: string[] = [],
): GameState {
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
const shots = (s: GameState) =>
  legalActions(s)
    .flatMap((a) => (a.type === 'power' && a.die === 'p0d0' && a.target ? [a.target] : []))
    .sort();

describe('Prototyping mode', () => {
  it('is listed after the official modes and plays like Community otherwise', () => {
    expect(MODES.map((m) => m.id)).toEqual(['basic', 'original', 'community', 'prototyping'] satisfies GameMode[]);
    const prototyping = rulesOf(BASE.prototyping);
    const community = rulesOf(BASE.community);
    expect(prototyping.name).toBe('Prototyping');
    expect(prototyping.cards).toBe(PROTOTYPING_CARDS ? community.cards : null);
    expect(prototyping.mapGroups).toEqual([...community.mapGroups, 'hex', 'drift']);
    expect(prototyping.startingMissiles).toBe(1);
    expect(prototyping.maxMovement).toBe(3);
    expect(prototyping.overConquest).toBe(true);
    expect(prototyping.ships[5].hooks).toEqual({ ...shootPower.hooks, ...picket.hooks });
    expect(prototyping.ships[5].power).toBeUndefined();
    const withoutHooks = (v: number) => ({ ...prototyping.ships[v], hooks: undefined });
    expect([1, 2, 3, 4, 6].map(withoutHooks)).toEqual([1, 2, 3, 4, 6].map((v) => ({ ...community.ships[v], hooks: undefined })));
    for (const v of [1, 2, 3, 4, 5, 6]) expect(prototyping.ships[v].hooks?.stopsEnemies, `ship ${v}`).toBe(picket.hooks.stopsEnemies);
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
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
        add(node.moduleReference.expression);
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

  it('is reached from the engine only through RULESETS (rulesets.ts)', () => {
    const importers = files(src)
      .filter((f) => !inPrototyping(f))
      .filter((f) => imports(f).some((i) => inPrototypingPath(importedPath(f, i))))
      .map((f) => relative(src, f));
    expect(importers).toEqual(['rulesets.ts']);
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
    expect(moduleSpecifiers("import './a'; export * from './b'; import('./c'); require('./d'); import item = require('./e');")).toEqual([
      './a',
      './b',
      './c',
      './d',
      './e',
    ]);
  });

  it('uses mode-configured regular-turn actions and research cap', () => {
    const rules = RULESETS.prototyping;
    const oldActions = rules.actionsPerTurn;
    const oldResearchLimit = rules.researchLimit;
    const oldCards = rules.cards;
    try {
      rules.actionsPerTurn = 2;
      rules.researchLimit = 4;
      // Research needs cards, which Prototyping may be playing without (PROTOTYPING_CARDS): lend it Community's.
      rules.cards = RULESETS.community.cards;

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
      rules.cards = oldCards;
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

describe('zones of control (Picket on every ship)', () => {
  const reachable = (s: GameState) => [...moveOptions(s, 'p0d0').moves.keys()];

  it('stops an enemy ship next to a ship, up, down, left or right: it can’t move through', () => {
    // From (0,2), the only way to (0,4) passes (0,3), next to the enemy at (1,3) (a planet is at (1,4)).
    const s = scenario({ p0d0: [0, 2, 3], p1d0: [1, 3, 6] });
    expect(reachable(s)).toContain('0,3');
    expect(reachable(s)).not.toContain('0,4');
    expect(reachable(scenario({ p0d0: [0, 2, 3], p1d0: [1, 3, 6] }, 'community'))).toContain('0,4');
  });

  it('doesn’t stop it diagonally', () => {
    // (0,2) is diagonal to the enemy at (1,3), so a ship from (0,0) passes it and stops at (0,3).
    expect(reachable(scenario({ p0d0: [0, 0, 3], p1d0: [1, 3, 6] }))).toContain('0,3');
  });

  it('still lets it attack from there', () => {
    const s = scenario({ p0d0: [0, 0, 3], p1d0: [0, 3, 6] });
    expect(moveOptions(s, 'p0d0').attacks.has('p1d0')).toBe(true);
  });

  it('lets a ship that starts in a zone leave, and never stops friendly ships', () => {
    expect(reachable(scenario({ p0d0: [0, 2, 3], p1d0: [0, 3, 6] }))).toContain('0,0');
    expect(reachable(scenario({ p0d0: [0, 2, 3], p0d1: [2, 3, 6] }))).toContain('2,2');
  });

  it('every ship has a zone, and the engine refuses a move through one', () => {
    for (const v of [1, 2, 3, 4, 5, 6])
      expect(reachable(scenario({ p0d0: [0, 2, 3], p1d0: [1, 3, v] })), `enemy ${v}`).not.toContain('0,4');
    const move: Action = { type: 'move', die: 'p0d0', to: { r: 0, c: 4 } };
    expect(tryApply(scenario({ p0d0: [0, 2, 3], p1d0: [1, 3, 6] }), move)).toBeNull();
    expect(tryApply(scenario({ p0d0: [0, 2, 3], p1d0: [1, 3, 6] }, 'community'), move)).not.toBeNull();
  });

  it('lets a stopped ship attack another enemy next to it, but not with no steps left', () => {
    // Stopped at (2,2) by p1d0's zone, with p1d1 below it.
    expect([...moveOptions(scenario({ p0d0: [2, 0, 3], p1d0: [2, 3, 6], p1d1: [3, 2, 6] }), 'p0d0').attacks.keys()].sort()).toEqual([
      'p1d0',
      'p1d1',
    ]);
    expect(moveOptions(scenario({ p0d0: [0, 0, 2], p1d0: [0, 3, 6] }), 'p0d0').attacks.size).toBe(0);
  });

  it('doesn’t stop a player with Devious, who may also pass through the ship', () => {
    // Devious passes (0,2), next to p1d0, and p1d0 itself for free: (0,4) is 3 steps from (0,0).
    expect(reachable(scenario({ p0d0: [0, 0, 3], p1d0: [0, 3, 6] }, 'prototyping', ['devious']))).toContain('0,4');
    expect(reachable(scenario({ p0d0: [0, 0, 3], p1d0: [0, 3, 6] }))).not.toContain('0,4');
    expect(reachable(scenario({ p0d0: [0, 2, 3], p1d0: [1, 3, 6] }, 'prototyping', ['devious']))).toContain('0,4');
    expect(reachable(scenario({ p0d0: [0, 2, 3], p1d0: [1, 3, 6] }))).not.toContain('0,4');
  });

  it('stops a ship on a Warp Gate exit in a zone', () => {
    const s = scenario({ p0d0: [0, 0, 3], p1d0: [3, 3, 6] });
    s.gates = [
      { r: 0, c: 1 },
      { r: 3, c: 2 },
    ];
    expect(reachable(s)).toContain('3,2');
    expect(reachable(s)).not.toContain('2,2'); // 3 steps only through the gate and (3,2)
  });

  it('covers a hex’s 6 sides on a hex map, but not its diagonals', () => {
    const s = scenario({ p1d0: [4, 5, 6] }, 'hex');
    const g = grid(s.board);
    const zone = [...picket.hooks.stopsEnemies!(s, at(s, 'p1d0'), 4 * g.cols + 5)].map((i) => g.cells[i]);
    expect(zone).toEqual(adjacent(s.board, { r: 4, c: 5 }));
    expect(zone).toHaveLength(6);
    // (5,3) is a hex diagonal of the enemy at (4,5); (5,4), a side a square would call diagonal, stops it, so
    // (5,5) and the spaces past (4,4) are out of reach.
    const moves = reachable(scenario({ p0d0: [5, 3, 2], p1d0: [4, 5, 6] }, 'hex'));
    expect(moves).toEqual(expect.arrayContaining(['5,4', '4,4']));
    expect(moves).not.toContain('5,5');
    expect(moves).not.toContain('3,4');
    expect(reachable(scenario({ p0d0: [5, 3, 2] }, 'hex'))).toEqual(expect.arrayContaining(['5,5', '3,4']));
  });

  it('agrees with a plain reference search on random positions', () => {
    const g = grid(BASE.prototyping.board);
    const spaces = [...Array(g.size).keys()].filter((i) => g.space[i]);
    const random = mulberry32(42);
    for (let n = 0; n < 500; n++) {
      const dice: Record<string, [number, number, number]> = {};
      [...spaces]
        .sort(() => random() - 0.5)
        .slice(0, 2 + Math.floor(random() * 8))
        .forEach((i, k) => (dice[`p${k % 2}d${Math.floor(k / 2)}`] = [Math.floor(i / g.cols), i % g.cols, 1 + Math.floor(random() * 6)]));
      const s = scenario(dice);
      for (const id of Object.keys(dice).filter((x) => x.startsWith('p0'))) {
        const got = moveIndexes(s, id);
        const want = referenceReach(s, id);
        expect(
          [...got.moves.keys()].sort((a, b) => a - b),
          `${n} ${id}`,
        ).toEqual(want.moves);
        expect([...got.attacks.keys()].sort(), `${n} ${id}`).toEqual(want.attacks);
      }
    }
  });
});

/** Moves and attacks by a plain breadth-first search, 1 step per space, stopping in any space next to an enemy (no gates or skills). */
function referenceReach(s: GameState, id: string) {
  const g = grid(s.board);
  const at = shipsByIndex(s);
  const me = at.find((d) => d?.id === id)!;
  const from = at.indexOf(me);
  const zone = new Set(at.flatMap((d, i) => (d && d.owner !== me.owner ? g.ortho[i] : [])));
  const range = Math.min(3, me.value);
  const steps = new Map([[from, 0]]);
  const queue = [from];
  const attacks = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    if (steps.get(cur)! >= range) continue;
    for (const nb of g.ortho[cur]) {
      if (at[nb]) {
        if (at[nb]!.owner !== me.owner) attacks.add(at[nb]!.id);
      } else if (g.space[nb] && !steps.has(nb) && !(cur !== from && zone.has(cur))) {
        steps.set(nb, steps.get(cur)! + 1);
        queue.push(nb);
      }
    }
  }
  steps.delete(from);
  return { moves: [...steps.keys()].sort((a, b) => a - b), attacks: [...attacks].sort() };
}

describe('where an attack goes in from', () => {
  // Planets are at rows and columns 1, 4 and 7. A 4 at (3,2) can attack p1d0 at (2,3) from every space next to it:
  // (2,2) and (3,3) are next to nothing else, (1,3) and (2,4) are both in the orbit of the planet at (1,4).
  const launches = (s: GameState) => attackLaunches(s, 'p0d0', 'p1d0').map((x) => `${x.from.r},${x.from.c}`);
  const attack = (r: number, c: number): Action => ({ type: 'attack', die: 'p0d0', target: 'p1d0', from: { r, c } });

  it('offers one space for each different outcome, the nearest', () => {
    const s = scenario({ p0d0: [3, 2, 4], p1d0: [2, 3, 6] }, 'community');
    expect(moveOptions(s, 'p0d0').attacks.get('p1d0')?.launches).toHaveLength(4);
    expect(launches(s)).toEqual(['2,2', '1,3']);
    expect(offered(s, 'attack')).toHaveLength(2);
  });

  it('refuses a space with the same outcome as an offered one, and attacks from the one chosen', () => {
    const s = scenario({ p0d0: [3, 2, 4], p1d0: [2, 3, 6] }, 'community');
    expect(tryApply(s, attack(3, 3))).toBeNull();
    expect(tryApply(s, attack(2, 4))).toBeNull();
    const after = tryApply(s, attack(1, 3))!;
    expect(at(after, 'p0d0').loc).toEqual({ zone: 'board', r: 1, c: 3 });
  });

  it('offers no choice with only one space to attack from', () => {
    expect(launches(scenario({ p0d0: [2, 2, 2], p1d0: [2, 3, 6] }, 'community'))).toEqual(['2,2']);
  });

  it('tells apart the planets in the corners with Ingenious, which conquers from them', () => {
    // (2,2) has the planet at (1,1) in a corner, (3,3) the one at (4,4).
    const s = scenario({ p0d0: [3, 2, 4], p1d0: [2, 3, 6] }, 'community', ['ingenious']);
    expect(launches(s).sort()).toEqual(['1,3', '2,2', '3,3']);
  });

  it('tells apart a space next to another enemy ship, which stops a ship in its zone of control', () => {
    // (2,2) is next to p1d1 as well; (2,4) is out of reach, as p1d0's zone stops the ship at (3,3).
    const s = scenario({ p0d0: [3, 2, 3], p1d0: [2, 3, 6], p1d1: [2, 1, 6] });
    expect(launches(s)).toEqual(['2,2', '3,3']);
  });
});

describe('the way a ship flies (movePath)', () => {
  const path = (s: GameState, r: number, c: number) => movePath(s, 'p0d0', { r, c }).map((p) => `${p.r},${p.c}`);

  it('goes straight when it can', () => {
    expect(path(scenario({ p0d0: [2, 2, 4] }, 'community'), 2, 5)).toEqual(['2,2', '2,3', '2,4', '2,5']);
  });

  it('goes round a ship in the way, one space at a time, by a shortest way', () => {
    const way = path(scenario({ p0d0: [2, 2, 4], p1d0: [2, 3, 6] }, 'community'), 2, 4);
    expect(way).toHaveLength(5);
    expect(way).not.toContain('2,3');
    for (let i = 1; i < way.length; i++) {
      const [[r0, c0], [r1, c1]] = [way[i - 1], way[i]].map((p) => p.split(',').map(Number));
      expect(Math.abs(r1 - r0) + Math.abs(c1 - c0), way.join(' ')).toBe(1);
    }
  });

  it('passes through enemy ships for free with Devious', () => {
    const s = scenario({ p0d0: [2, 0, 1], p1d0: [2, 1, 6], p1d1: [2, 2, 6] }, 'community', ['devious']);
    expect(path(s, 2, 3)).toEqual(['2,0', '2,1', '2,2', '2,3']);
  });

  it('is empty where the ship can’t go, as past a zone of control', () => {
    expect(path(scenario({ p0d0: [2, 2, 3], p1d0: [1, 3, 6] }), 2, 4)).toEqual([]);
    expect(path(scenario({ p0d0: [2, 2, 3], p1d0: [1, 3, 6] }), 2, 3)).toEqual(['2,2', '2,3']);
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

  it('is the ship’s one action: no move, attack or second shot after it', () => {
    const s = shoot(scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3], p1d1: [3, 0, 2] }), 'p1d0', 6, 1);
    expect(s.turn.actionsLeft).toBe(2);
    expect(mine(s, 'power')).toEqual([]);
    expect(mine(s, 'move')).toEqual([]);
    expect(mine(s, 'attack')).toEqual([]);
    expect(() => apply(s, { type: 'move', die: 'p0d0', to: { r: 0, c: 1 } })).toThrow(/already moved/);
  });

  it('can’t shoot after moving or after a normal attack', () => {
    const s0 = scenario({ p0d0: [0, 0, 5], p1d0: [0, 4, 3] });
    expect(shots(s0)).toEqual(['p1d0']);
    expect(shots(apply(s0, { type: 'move', die: 'p0d0', to: { r: 1, c: 0 } }))).toEqual([]);
    const s1 = scenario({ p0d0: [0, 0, 5], p1d0: [0, 1, 6], p1d1: [2, 0, 3] });
    const attacked = apply(s1, { type: 'attack', die: 'p0d0', target: 'p1d0' });
    const resolved = apply(attacked, { type: 'resolveCombat' });
    expect(shots(resolved.pending.length ? apply(resolved, { type: 'advance', move: false }) : resolved)).toEqual([]);
  });

  it('reaches the first ship in a clear orthogonal line, at any distance', () => {
    const ids = (s: GameState) =>
      shootTargets(s, at(s, 'p0d0'))
        .map((d) => d.id)
        .sort();
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

  it('shoots along a hex’s 6 sides on a hex map, not its diagonals', () => {
    const ids = (s: GameState) =>
      shootTargets(s, at(s, 'p0d0'))
        .map((d) => d.id)
        .sort();
    // From (7,3): along +c to (7,6), along (+1,-1) to (9,1) and down to (10,3); (6,3)'s line meets a planet.
    expect(ids(scenario({ p0d0: [7, 3, 5], p1d0: [7, 6, 3], p1d1: [9, 1, 2], p1d2: [10, 3, 1] }, 'hex'))).toEqual(['p1d0', 'p1d1', 'p1d2']);
    // (8,4) and (5,4) are hex diagonals, two hexes away between two sides.
    expect(ids(scenario({ p0d0: [7, 3, 5], p1d0: [8, 4, 3], p1d1: [5, 4, 2] }, 'hex'))).toEqual([]);
  });

  it('flies over the void', () => {
    const s = scenario({ p0d0: [0, 0, 5], p1d0: [0, 2, 3] });
    s.board.cells[0][1].void = true;
    expect(shootTargets(s, at(s, 'p0d0')).map((d) => d.id)).toEqual(['p1d0']);
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
    const planet = base.board.planets.find((q) => q.cubes.length === 0)!;
    const target = 12;
    const spots = orbitals(base.board, planet);
    const values: number[] = [];
    for (let left = target; left > 0; left -= values[values.length - 1]) values.push(Math.min(6, left));
    const placed: Record<string, [number, number, number]> = {};
    values.forEach((v, i) => (placed[`p0d${i}`] = [spots[i].r, spots[i].c, v]));
    const s = scenario(placed, 'prototyping');
    const p = s.board.planets[planet.id];
    while (planetFreeSlots(p) > 0) p.cubes.push(1);
    const check = conquerCheck(s, 0, p.id);
    expect(check.target).toBe(target);
    expect(check.ok).toBe(true);
    expect(check.replace).toEqual([1]);
    const before = s.players[1].cubesLeft;
    const after = apply(s, { type: 'conquer', planet: p.id, replace: 1 });
    expect(after.players[1].cubesLeft).toBe(before + 1);
    expect(after.board.planets[planet.id].cubes.filter((c) => c === 0)).toHaveLength(1);
    expect(after.board.planets[planet.id].cubes.filter((c) => c === 1)).toHaveLength(p.cubes.length - 1);
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
