/** Catching up with an online game: the screen walks forward through the steps, never back. */
import { describe, expect, it } from 'vitest';
import type { Post, Step } from '@quantum/online';
import { quickStart } from '../../../packages/engine/test/helpers';
import { MAX_BEHIND, nextStep, STEP_MS } from '../src/online/playback';

const base = quickStart(2, 1);
const post = (author: string): Post => ({ id: `${author}${Math.random()}`, author, at: 0, prev: 'x', body: { t: 'act', seat: 0, action: { type: 'research' } } });
const step = (state = structuredClone(base), author = 'them'): Step => ({ state, post: post(author) });
const mine = (p: Post) => p.author === 'me';

/** Follows nextStep from `shown` until it has nothing more to show; the steps shown in order. */
function walk(steps: Step[], shown: Step | null): Step[] {
  const seen: Step[] = [];
  for (let n = 0; n < 100; n++) {
    const next = nextStep(steps, shown, mine, Infinity);
    if (!next) return seen;
    seen.push(next.step);
    shown = next.step;
  }
  throw new Error('playback never settles');
}

describe('online playback', () => {
  it('shows the next move after a pause, and own moves at once', () => {
    const steps = [step(), step(), step(undefined, 'me')];
    expect(nextStep(steps, steps[0], mine, 100)).toMatchObject({ step: steps[1], delay: STEP_MS - 100, announce: true });
    expect(nextStep(steps, steps[1], mine, 0)).toMatchObject({ step: steps[2], delay: 0 });
    expect(nextStep(steps, steps[2], mine, 0)).toBeNull();
  });

  it('settles on an undo instead of bouncing between the two positions', () => {
    // Before the move, the move, and the undo, which brings back the first step's state.
    const before = step();
    const moved = step();
    const undone: Step = { state: before.state, post: post('them') };
    const steps = [before, moved, undone];
    expect(walk(steps, moved)).toEqual([undone]);
    expect(walk(steps, before)).toEqual([moved, undone]);
  });

  it('jumps to the present when far behind or when the steps were rebuilt', () => {
    const steps = Array.from({ length: MAX_BEHIND + 3 }, () => step());
    expect(nextStep(steps, steps[0], mine, 0)).toMatchObject({ step: steps.at(-1), delay: 0, announce: false });
    expect(nextStep(steps, step(), mine, 0)).toMatchObject({ step: steps.at(-1), announce: false });
    expect(nextStep(steps, null, mine, 0)).toMatchObject({ step: steps.at(-1), announce: false });
  });
});
