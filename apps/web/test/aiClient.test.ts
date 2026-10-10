import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_LEVEL } from '@quantum/ai';
import { aiLevelOf } from '../src/game/aiClient';

describe('aiLevelOf', () => {
  it('keeps supported AI levels', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(aiLevelOf({ name: 'AI', color: '#fff', ai: true, aiLevel: level })).toBe(level);
    }
  });

  it('uses the default for missing or unsupported levels', () => {
    expect(aiLevelOf({ name: 'AI', color: '#fff', ai: true })).toBe(DEFAULT_AI_LEVEL);
    for (const aiLevel of [0, 2.5, 6, Number.NaN]) {
      expect(aiLevelOf({ name: 'AI', color: '#fff', ai: true, aiLevel })).toBe(DEFAULT_AI_LEVEL);
    }
  });
});
