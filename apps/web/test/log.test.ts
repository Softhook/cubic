import { describe, expect, it } from 'vitest';
import { shouldAutoScroll } from '../src/components/Log';

describe('log auto-scroll', () => {
  it('keeps the view pinned near the bottom', () => {
    expect(shouldAutoScroll(500, 200, 700)).toBe(true);
    expect(shouldAutoScroll(300, 200, 700)).toBe(false);
  });

  it('allows reading older entries without being forced to the bottom', () => {
    expect(shouldAutoScroll(0, 200, 1000)).toBe(false);
    expect(shouldAutoScroll(780, 200, 1000)).toBe(false);
    expect(shouldAutoScroll(990, 200, 1000)).toBe(true);
  });
});
