/**
 * The engine's modules import each other in cycles (core and queries, for one). That is safe only while
 * no module calls into the cycle while it is loading: then the engine works whichever module is
 * imported first. This loads each module first, in a fresh module graph, then plays a few moves.
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const SRC = join(__dirname, '../src');

function modules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? modules(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

describe('the engine loads whichever module comes first', () => {
  for (const file of modules(SRC)) {
    it(relative(SRC, file), async () => {
      vi.resetModules();
      await import(file);
      const engine = await import('../src');
      let s = engine.createGame({ players: [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', ai: true })), mode: 'prototyping', seed: 1 });
      for (let i = 0; i < 20; i++) s = engine.apply(s, engine.legalActions(s)[0]);
      expect(engine.checkInvariants(s)).toEqual([]);
    });
  }
});
