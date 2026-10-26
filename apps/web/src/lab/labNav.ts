import { useEffect } from 'react';

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export function isArrowKey(key: string): key is ArrowKey {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
}

export interface HasRect {
  getBoundingClientRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
    bottom?: number;
    right?: number;
  };
}

/**
 * Finds the adjacent item in a list or 2D grid for arrow key navigation.
 * Left/Right move linearly through items.
 * Up/Down move vertically across rows in a grid, selecting the closest item by horizontal center.
 */
export function findAdjacentItem<T extends HasRect>(items: readonly T[], current: T | null, key: ArrowKey): T | null {
  if (items.length === 0) return null;
  if (!current || !items.includes(current)) {
    return items[0];
  }

  const index = items.indexOf(current);
  const step = (by: number) => items[Math.max(0, Math.min(items.length - 1, index + by))];

  if (key === 'ArrowRight') return step(1);
  if (key === 'ArrowLeft') return step(-1);

  const rect = current.getBoundingClientRect();
  const down = key === 'ArrowDown';

  // If layout info is unavailable (e.g. non-browser test environment), fall back to index stepping.
  if (rect.height === 0 && rect.width === 0) return step(down ? 1 : -1);

  // The items starting below (or ending above) this one's middle; the nearest row of them; its closest column.
  const middle = rect.top + rect.height / 2;
  const centre = (r: ReturnType<HasRect['getBoundingClientRect']>) => r.left + r.width / 2;
  const candidates = items.filter((item) => {
    const r = item.getBoundingClientRect();
    return down ? r.top >= middle : (r.bottom ?? r.top + r.height) <= middle;
  });
  if (candidates.length === 0) return current;
  const tops = candidates.map((c) => c.getBoundingClientRect().top);
  const rowTop = down ? Math.min(...tops) : Math.max(...tops);
  const row = candidates.filter((c) => Math.abs(c.getBoundingClientRect().top - rowTop) <= 20);
  const offset = (item: T) => Math.abs(centre(item.getBoundingClientRect()) - centre(rect));
  return row.reduce((best, item) => (offset(item) < offset(best) ? item : best));
}

/**
 * Art Lab keyboard shortcut: allows Arrow keys to move between items (tiles in TileLab, cards in CardLab,
 * or player aid editions in AidLab).
 */
export function useLabArrowNav() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isArrowKey(e.key)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        return;
      }
      if (document.querySelector('[aria-modal="true"]')) return;

      const thumbs = Array.from(document.querySelectorAll<HTMLButtonElement>('.lab-thumb')).filter(
        (b) => b.offsetParent !== null || b.getClientRects().length > 0,
      );

      if (thumbs.length > 0) {
        e.preventDefault();
        const active =
          document.activeElement instanceof HTMLButtonElement && thumbs.includes(document.activeElement) ? document.activeElement : null;
        const on = thumbs.find((b) => b.classList.contains('on')) ?? null;
        const current = active ?? on ?? thumbs[0];

        const target = findAdjacentItem(thumbs, current, e.key);
        if (target) {
          target.click();
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }

      // If no thumbnails (e.g. Player Aid lab), allow arrows to switch between player aid editions
      const aidButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.lab-head .segmented button')).filter(
        (b) => b.offsetParent !== null || b.getClientRects().length > 0,
      );
      if (aidButtons.length === 2 && document.querySelector('.lab-aid-page')) {
        e.preventDefault();
        const target = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? aidButtons[0] : aidButtons[1];
        target.click();
        target.focus({ preventScroll: true });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
