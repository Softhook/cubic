/**
 * The engine works whichever of its modules is imported first. `npm run circular` keeps runtime import
 * cycles out, but a module that calls another while loading could still depend on load order. This
 * loads each module first, in a fresh module graph, then plays a few moves.
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODE } from '../src/rulesets';

const SRC = join(__dirname, '../src');

function modules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? modules(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

/** A game of the default mode (the one that loads the most of the engine) a few moves in, as JSON (a saved game), and a legal action in it. */
async function savedGame() {
  vi.resetModules();
  const engine = await import('../src');
  let s = engine.createGame({ players: [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', ai: true })), mode: DEFAULT_MODE, seed: 1 });
  for (let i = 0; i < 10; i++) s = engine.apply(s, engine.legalActions(s)[0]);
  return { state: JSON.parse(JSON.stringify(s)), action: engine.legalActions(s)[0] };
}

// rulesOf reads a table that rulesets.ts registers when it loads, so every module that takes a state from
// outside must load rulesets.ts itself: a caller may import that module alone, with a saved state.
describe('each entry point works without src/index.ts', () => {
  it('createGame (setup.ts)', async () => {
    vi.resetModules();
    const { createGame } = await import('../src/setup');
    expect(createGame({ players: [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', ai: true })), mode: DEFAULT_MODE, seed: 1 }).mode).toBe(
      DEFAULT_MODE,
    );
  });
  it('apply (engine.ts)', async () => {
    const { state, action } = await savedGame();
    vi.resetModules();
    const { apply } = await import('../src/engine');
    expect(apply(state, action)).toBeTruthy();
  });
  it('legalActions (legal.ts)', async () => {
    const { state } = await savedGame();
    vi.resetModules();
    const { legalActions } = await import('../src/legal');
    expect(legalActions(state).length).toBeGreaterThan(0);
  });
  it('checkInvariants (invariants.ts)', async () => {
    const { state } = await savedGame();
    vi.resetModules();
    const { checkInvariants } = await import('../src/invariants');
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe('the engine loads whichever module comes first', () => {
  for (const file of modules(SRC)) {
    it(relative(SRC, file), async () => {
      vi.resetModules();
      await import(file);
      const engine = await import('../src');
      let s = engine.createGame({ players: [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', ai: true })), mode: DEFAULT_MODE, seed: 1 });
      for (let i = 0; i < 20; i++) s = engine.apply(s, engine.legalActions(s)[0]);
      expect(engine.checkInvariants(s)).toEqual([]);
    });
  }
});
