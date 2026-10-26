import { describe, expect, it } from 'vitest';
import { findAdjacentItem, isArrowKey, type HasRect } from '../src/lab/labNav';

interface MockItem extends HasRect {
  id: string;
}

function createMockElement(id: string, rect?: { left: number; top: number; width: number; height: number }): MockItem {
  return {
    id,
    getBoundingClientRect: () => ({
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      right: (rect?.left ?? 0) + (rect?.width ?? 0),
      bottom: (rect?.top ?? 0) + (rect?.height ?? 0),
    }),
  };
}

describe('isArrowKey', () => {
  it('returns true only for arrow keys', () => {
    expect(isArrowKey('ArrowLeft')).toBe(true);
    expect(isArrowKey('ArrowRight')).toBe(true);
    expect(isArrowKey('ArrowUp')).toBe(true);
    expect(isArrowKey('ArrowDown')).toBe(true);

    expect(isArrowKey('Enter')).toBe(false);
    expect(isArrowKey('Escape')).toBe(false);
    expect(isArrowKey('Tab')).toBe(false);
    expect(isArrowKey('a')).toBe(false);
  });
});

describe('findAdjacentItem', () => {
  it('returns null for an empty array', () => {
    expect(findAdjacentItem([], null, 'ArrowRight')).toBe(null);
  });

  it('returns the first item if current is null or not in list', () => {
    const a = createMockElement('a');
    const b = createMockElement('b');
    const external = createMockElement('ext');

    expect(findAdjacentItem([a, b], null, 'ArrowRight')).toBe(a);
    expect(findAdjacentItem([a, b], external, 'ArrowRight')).toBe(a);
  });

  it('navigates linearly with ArrowRight and ArrowLeft', () => {
    const a = createMockElement('a');
    const b = createMockElement('b');
    const c = createMockElement('c');
    const items = [a, b, c];

    expect(findAdjacentItem(items, a, 'ArrowRight')).toBe(b);
    expect(findAdjacentItem(items, b, 'ArrowRight')).toBe(c);
    expect(findAdjacentItem(items, c, 'ArrowRight')).toBe(c); // clamps

    expect(findAdjacentItem(items, c, 'ArrowLeft')).toBe(b);
    expect(findAdjacentItem(items, b, 'ArrowLeft')).toBe(a);
    expect(findAdjacentItem(items, a, 'ArrowLeft')).toBe(a); // clamps
  });

  it('falls back to index stepping when bounding rect is 0 (no layout)', () => {
    const a = createMockElement('a');
    const b = createMockElement('b');
    const items = [a, b];

    expect(findAdjacentItem(items, a, 'ArrowDown')).toBe(b);
    expect(findAdjacentItem(items, b, 'ArrowUp')).toBe(a);
  });

  describe('2D grid navigation', () => {
    // 3 columns:
    // [0] [1] [2]   (row 0: top 0, height 100)
    // [3] [4] [5]   (row 1: top 120, height 100)
    // [6] [7]       (row 2: top 240, height 100 - ragged, only 2 items)
    const el0 = createMockElement('0', { left: 0, top: 0, width: 100, height: 100 });
    const el1 = createMockElement('1', { left: 120, top: 0, width: 100, height: 100 });
    const el2 = createMockElement('2', { left: 240, top: 0, width: 100, height: 100 });

    const el3 = createMockElement('3', { left: 0, top: 120, width: 100, height: 100 });
    const el4 = createMockElement('4', { left: 120, top: 120, width: 100, height: 100 });
    const el5 = createMockElement('5', { left: 240, top: 120, width: 100, height: 100 });

    const el6 = createMockElement('6', { left: 0, top: 240, width: 100, height: 100 });
    const el7 = createMockElement('7', { left: 120, top: 240, width: 100, height: 100 });

    const grid = [el0, el1, el2, el3, el4, el5, el6, el7];

    it('moves down to the same column in the row below', () => {
      expect(findAdjacentItem(grid, el0, 'ArrowDown')).toBe(el3);
      expect(findAdjacentItem(grid, el1, 'ArrowDown')).toBe(el4);
      expect(findAdjacentItem(grid, el2, 'ArrowDown')).toBe(el5);
      expect(findAdjacentItem(grid, el3, 'ArrowDown')).toBe(el6);
      expect(findAdjacentItem(grid, el4, 'ArrowDown')).toBe(el7);
    });

    it('moves down to the closest column when row below has fewer items', () => {
      // From el5 (left: 240), row 2 only has el6 (0) and el7 (120). el7 is closer to 240.
      expect(findAdjacentItem(grid, el5, 'ArrowDown')).toBe(el7);
    });

    it('stays on the current item when already on the bottom row', () => {
      expect(findAdjacentItem(grid, el6, 'ArrowDown')).toBe(el6);
      expect(findAdjacentItem(grid, el7, 'ArrowDown')).toBe(el7);
    });

    it('moves up to the same column in the row above', () => {
      expect(findAdjacentItem(grid, el6, 'ArrowUp')).toBe(el3);
      expect(findAdjacentItem(grid, el7, 'ArrowUp')).toBe(el4);
      expect(findAdjacentItem(grid, el3, 'ArrowUp')).toBe(el0);
      expect(findAdjacentItem(grid, el4, 'ArrowUp')).toBe(el1);
      expect(findAdjacentItem(grid, el5, 'ArrowUp')).toBe(el2);
    });

    it('stays on the current item when already on the top row', () => {
      expect(findAdjacentItem(grid, el0, 'ArrowUp')).toBe(el0);
      expect(findAdjacentItem(grid, el1, 'ArrowUp')).toBe(el1);
      expect(findAdjacentItem(grid, el2, 'ArrowUp')).toBe(el2);
    });
  });
});
