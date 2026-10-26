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

  if (key === 'ArrowRight') {
    return items[Math.min(items.length - 1, index + 1)];
  }

  if (key === 'ArrowLeft') {
    return items[Math.max(0, index - 1)];
  }

  const currentRect = current.getBoundingClientRect();

  // If layout info is unavailable (e.g. non-browser test environment), fall back to index stepping.
  if (currentRect.height === 0 && currentRect.width === 0) {
    if (key === 'ArrowDown') return items[Math.min(items.length - 1, index + 1)];
    if (key === 'ArrowUp') return items[Math.max(0, index - 1)];
  }

  const currentCenterX = currentRect.left + currentRect.width / 2;

  if (key === 'ArrowDown') {
    const threshold = currentRect.top + currentRect.height * 0.5;
    const candidates = items.filter((item) => item.getBoundingClientRect().top >= threshold);
    if (candidates.length === 0) return current;

    // Find the row closest below (minimum top)
    const minTop = Math.min(...candidates.map((c) => c.getBoundingClientRect().top));
    const nextRow = candidates.filter((c) => c.getBoundingClientRect().top <= minTop + 20);

    let closest = nextRow[0];
    let minDiff = Math.abs(closest.getBoundingClientRect().left + closest.getBoundingClientRect().width / 2 - currentCenterX);

    for (let i = 1; i < nextRow.length; i++) {
      const item = nextRow[i];
      const r = item.getBoundingClientRect();
      const diff = Math.abs(r.left + r.width / 2 - currentCenterX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = item;
      }
    }
    return closest;
  }

  if (key === 'ArrowUp') {
    const threshold = (currentRect.bottom ?? currentRect.top + currentRect.height) - currentRect.height * 0.5;
    const candidates = items.filter((item) => {
      const r = item.getBoundingClientRect();
      const bottom = r.bottom ?? r.top + r.height;
      return bottom <= threshold;
    });
    if (candidates.length === 0) return current;

    // Find the row closest above (maximum top)
    const maxTop = Math.max(...candidates.map((c) => c.getBoundingClientRect().top));
    const prevRow = candidates.filter((c) => c.getBoundingClientRect().top >= maxTop - 20);

    let closest = prevRow[0];
    let minDiff = Math.abs(closest.getBoundingClientRect().left + closest.getBoundingClientRect().width / 2 - currentCenterX);

    for (let i = 1; i < prevRow.length; i++) {
      const item = prevRow[i];
      const r = item.getBoundingClientRect();
      const diff = Math.abs(r.left + r.width / 2 - currentCenterX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = item;
      }
    }
    return closest;
  }

  return null;
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
