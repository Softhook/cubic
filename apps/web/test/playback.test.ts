/** Catching up with an online game: the screen walks forward through the steps, never back. */
import { describe, expect, it } from 'vitest';
import type { Post, Step } from '@quantum/online';
import { quickStart } from '../../../packages/engine/test/helpers';
import type { CombatPending } from '@quantum/engine';
import { COMBAT_MS, MAX_BEHIND, nextStep, STEP_MS } from '../src/online/playback';

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

  it('keeps your own battle on screen until it is dismissed, but not each stage of it', () => {
    const side = { player: 0, die: 'x', ship: 3, dice: [4], missile: false };
    const battle = (missile: boolean): CombatPending => ({ kind: 'combat', id: 7, attacker: { ...side, missile }, defender: { ...side, player: 1 }, from: [0, 0], at: [0, 1], rerolls: [] }) as unknown as CombatPending;
    const fighting = (missile: boolean) => step({ ...structuredClone(base), pending: [battle(missile)] });
    const steps = [fighting(false), fighting(true), step()];
    // A missile changes the battle: shown after the usual pause.
    expect(nextStep(steps, steps[0], mine, 0, { mine: true, dismissed: false })).toMatchObject({ step: steps[1], delay: COMBAT_MS });
    // The battle is over: held until the player dismisses it.
    expect(nextStep(steps, steps[1], mine, Infinity, { mine: true, dismissed: false })).toBeNull();
    expect(nextStep(steps, steps[1], mine, 0, { mine: true, dismissed: true })).toMatchObject({ step: steps[2], delay: 0, announce: true });
    // Other players' battles move on after a pause.
    expect(nextStep(steps, steps[1], mine, 1000)).toMatchObject({ step: steps[2], delay: COMBAT_MS - 1000 });
  });
});
