/** Which copy of a card left the market, for its flight. */
import { describe, expect, it } from 'vitest';
import { leftRow } from '../src/game/marketRow';

describe('leftRow', () => {
  it('finds where the cards gone from a row were, with new ones entering at its front', () => {
    expect(leftRow(['a', 'b', 'c'], ['n', 'a', 'c'])).toEqual([1]);
    expect(leftRow(['a', 'b', 'c'], ['a', 'c'])).toEqual([1]);
    expect(leftRow(['a', 'b', 'c'], ['n', 'm', 'b'])).toEqual([0, 2]);
    expect(leftRow(['a', 'b'], [])).toEqual([0, 1]);
  });

  it('tells copies of a card apart', () => {
    expect(leftRow(['x', 'y', 'x'], ['n', 'x', 'y'])).toEqual([2]);
    expect(leftRow(['x', 'y', 'x'], ['n', 'y', 'x'])).toEqual([0]);
  });
});
