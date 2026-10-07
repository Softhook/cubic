import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Zoomed in, a space is at most this big. */
const MAX_CELL = 80;
/** Zoom only where it makes the spaces at least this much bigger; otherwise the board just fits. */
const MIN_GAIN = 1.15;
/** A pointer that moves less than this before it lifts is a tap, not a pan. */
const TAP_SLOP = 8;
/** The wheel's zoom is drawn as a transform and committed once the wheel has been still this long. */
const WHEEL_SETTLE = 150;
/** The click a browser sends right after a drag ends, within this long, is the drag's and is ignored. */
const DRAG_CLICK = 400;

export interface View {
  /** The space's size in pixels. */
  cell: number;
  /** The board's top-left corner, in pixels from the wrap's. */
  x: number;
  y: number;
}

export interface BoardZoom extends View {
  /** The wrap's size in pixels. */
  w: number;
  h: number;
  /** True until a resize or zoom has settled, so ships jump with the map instead of gliding. */
  resizing: boolean;
  zoomed: boolean;
  /** Whether zooming does anything here (it doesn't when the spaces are big already). */
  canZoom: boolean;
  zoomBy: (factor: number) => void;
  fit: () => void;
  /** Pan so the space (r, c) is in the middle, as far as the board's edges allow. */
  centreOn: (r: number, c: number) => void;
}

/** Whether something around `el` scrolls vertically: then a plain wheel over the board scrolls it, not the zoom. */
function scrollsAround(el: HTMLElement): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY;
    const scroller = p === document.scrollingElement || overflow === 'auto' || overflow === 'scroll';
    if (scroller && p.scrollHeight > p.clientHeight + 1) return true;
  }
  return false;
}

/**
 * The board's size and position in its wrap: fitted to it, or zoomed in and panned. Pinch and drag
 * (touch or mouse), the wheel (with Ctrl, a trackpad pinch, or any wheel when nothing around the board
 * scrolls) and `zoomBy` / `fit` / `centreOn` move it. While a gesture is under way the board only gets a
 * CSS transform, and the wrap the class `gesture` (it clips); when it ends, the new size is committed as
 * `cell`, so dice, text and artwork redraw crisp. A drag never ends in a click on the board. A map of
 * another size starts fitted.
 */
export function useBoardZoom(wrap: RefObject<HTMLDivElement>, board: RefObject<HTMLDivElement>, rows: number, cols: number): BoardZoom {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // The zoom as a multiple of the fitted size, so it survives a resize; x, y as last committed; `map`
  // the map it was for.
  const map = `${rows}x${cols}`;
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0, map });
  const [resizing, setResizing] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout>>();
  const jump = useCallback(() => {
    setResizing(true);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => setResizing(false), 200);
  }, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Measured before the first paint, so the map doesn't show at a default size and then shrink.
    setSize({ w: el.clientWidth, h: el.clientHeight });
    let first = true;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      // The observer's first call only confirms the size measured above.
      if (first) return void (first = false);
      jump();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(settle.current);
    };
  }, [wrap, jump]);

  const fitCell = Math.max(8, Math.min(140, Math.floor(Math.min(size.w / cols, size.h / rows))));
  const canZoom = MAX_CELL >= fitCell * MIN_GAIN;
  const maxCell = canZoom ? MAX_CELL : fitCell;
  const clampCell = (c: number) => Math.min(maxCell, Math.max(fitCell, c));
  /** Centred along an axis the board fits in; otherwise kept covering the wrap. */
  const place = (cell: number, x: number, y: number): View => {
    const axis = (pos: number, length: number, room: number) => (length <= room ? (room - length) / 2 : Math.min(0, Math.max(room - length, pos)));
    return { cell, x: axis(x, cols * cell, size.w), y: axis(y, rows * cell, size.h) };
  };
  const zoomed = canZoom && view.map === map && view.zoom > 1.001;
  const current = zoomed ? place(clampCell(fitCell * view.zoom), view.x, view.y) : place(fitCell, 0, 0);

  const commit = (v: View) => {
    if (v.cell === current.cell && v.x === current.x && v.y === current.y) {
      if (board.current) board.current.style.transform = ''; // nothing to redraw; just drop the preview
      return;
    }
    setView({ zoom: v.cell / fitCell, x: v.x, y: v.y, map });
    jump();
  };
  /** Zoom `from` by `factor`, keeping the point (fx, fy) of the wrap where it is. */
  const zoomAround = (from: View, factor: number, fx: number, fy: number): View => {
    const cell = clampCell(from.cell * factor);
    const s = cell / from.cell;
    return place(cell, fx - (fx - from.x) * s, fy - (fy - from.y) * s);
  };

  // Gesture handlers are attached once and read the latest values from here.
  const latest = useRef({ current, canZoom, zoomed, place, clampCell, zoomAround, commit });
  latest.current = { current, canZoom, zoomed, place, clampCell, zoomAround, commit };

  // The committed view has been drawn: drop the gesture's transform.
  useLayoutEffect(() => {
    if (board.current) board.current.style.transform = '';
  }, [board, current.cell, current.x, current.y]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let base: View = latest.current.current; // the view when the pointers last changed
    let start = new Map<number, { x: number; y: number }>();
    let live: View | null = null; // set while panning, pinching or wheeling
    let swallowUntil = 0; // clicks before this time belong to a drag
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;

    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    /** Show `v` as a transform of the committed view, clipped to the wrap. */
    const preview = (v: View) => {
      live = v;
      el.classList.add('gesture');
      const from = latest.current.current;
      if (board.current) board.current.style.transform = `translate(${v.x - from.x}px, ${v.y - from.y}px) scale(${v.cell / from.cell})`;
    };
    /** Pointers came or went: carry on from where the gesture is now. */
    const rebase = () => {
      base = live ?? latest.current.current;
      start = new Map(pointers);
    };
    const finish = () => {
      clearTimeout(wheelTimer);
      el.classList.remove('gesture');
      if (!live) return;
      latest.current.commit(live);
      live = null;
      swallowUntil = performance.now() + DRAG_CLICK;
    };
    const lift = (id: number) => {
      if (!pointers.delete(id)) return;
      if (pointers.size === 0) finish();
      else rebase();
    };

    const down = (e: PointerEvent) => {
      swallowUntil = 0;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as Element).closest('.zoom-controls, .zoom-hint')) return;
      if (!latest.current.canZoom) return;
      if (live && pointers.size === 0) finish(); // a wheel zoom still settling
      pointers.set(e.pointerId, local(e));
      rebase();
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      // The button was let go where we didn't see it (outside the window, say): that drag is over.
      if (e.pointerType === 'mouse' && e.buttons === 0) return lift(e.pointerId);
      pointers.set(e.pointerId, local(e));
      const { place, clampCell, zoomed } = latest.current;
      const pts = [...pointers.values()];
      const was = [...pointers.keys()].map((id) => start.get(id)!);
      let next: View;
      if (pts.length >= 2) {
        const [a, b] = pts;
        const [a0, b0] = was;
        const s = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, Math.hypot(a0.x - b0.x, a0.y - b0.y));
        const cell = clampCell(base.cell * s);
        const k = cell / base.cell;
        const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
        const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        next = place(cell, m1.x - (m0.x - base.x) * k, m1.y - (m0.y - base.y) * k);
      } else {
        // One pointer pans, but only a zoomed board, and only once it has moved more than a tap would.
        const [p] = pts;
        const [p0] = was;
        if (!live && (!zoomed || Math.hypot(p.x - p0.x, p.y - p0.y) < TAP_SLOP)) return;
        next = place(base.cell, base.x + p.x - p0.x, base.y + p.y - p0.y);
      }
      if (!el.hasPointerCapture(e.pointerId)) for (const id of pointers.keys()) el.setPointerCapture(id);
      swallowUntil = Infinity;
      preview(next);
    };
    const up = (e: PointerEvent) => lift(e.pointerId);
    // A drag that ends over a ship or a space must not also act on it.
    const click = (e: MouseEvent) => {
      if (performance.now() >= swallowUntil) return;
      swallowUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    };
    const wheel = (e: WheelEvent) => {
      const { canZoom, zoomAround, current } = latest.current;
      if (!canZoom || pointers.size || (!e.ctrlKey && scrollsAround(el))) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const f = local(e);
      const from = live ?? current;
      const next = zoomAround(from, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), f.x, f.y);
      if (next.cell === from.cell && next.x === from.x && next.y === from.y) return;
      preview(next);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(finish, WHEEL_SETTLE);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('click', click, true);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      clearTimeout(wheelTimer);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('click', click, true);
      el.removeEventListener('wheel', wheel);
    };
  }, [wrap, board]);

  return {
    ...current,
    w: size.w,
    h: size.h,
    resizing,
    zoomed,
    canZoom,
    zoomBy: (factor) => commit(zoomAround(current, factor, size.w / 2, size.h / 2)),
    fit: () => commit(place(fitCell, 0, 0)),
    centreOn: (r, c) => commit(place(current.cell, size.w / 2 - (c + 0.5) * current.cell, size.h / 2 - (r + 0.5) * current.cell)),
  };
}
