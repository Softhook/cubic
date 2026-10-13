/** Looking back from the log: each entry shows the position just after it was written. */
import { describe, expect, it } from 'vitest';
import type { GameState } from '@quantum/engine';
import { quickStart } from '../../../packages/engine/test/helpers';
import { logPositions } from '../src/game/review';

const base = quickStart(2, 1);

/** `s` after a move that writes `n` log entries. */
function after(s: GameState, n: number): GameState {
  const next = structuredClone(s);
  for (let i = 0; i < n; i++) next.log.push({ id: ++next.logCounter, text: `entry ${next.logCounter}` });
  return next;
}

describe('logPositions', () => {
  it('maps each entry to the position its move led to', () => {
    const a = after(base, 1);
    const b = after(a, 2);
    const c = after(b, 0);
    const d = after(c, 1);
    const at = logPositions([base, a, b, c, d]);
    const id = base.logCounter;
    expect(at.get(id + 1)).toBe(a);
    expect(at.get(id + 2)).toBe(b);
    expect(at.get(id + 3)).toBe(b);
    expect(at.get(id + 4)).toBe(d);
    // What was logged before the first known position can't be shown.
    for (const e of base.log) expect(at.has(e.id)).toBe(false);
  });

  it('after an undo, an entry reusing an undone id shows the new position', () => {
    const a = after(base, 1);
    const undone = after(a, 1);
    const redone = after(a, 1);
    const at = logPositions([base, a, undone, a, redone]);
    expect(at.get(a.logCounter + 1)).toBe(redone);
    expect(at.get(a.logCounter)).toBe(a);
  });
});
