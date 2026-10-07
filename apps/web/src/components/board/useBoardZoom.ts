import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { REDUCED_MOTION } from '../../game/useMediaQuery';
import { canZoom as zoomable, centredOn, clampCell, fitted, frame, place, softCell, zoomAround, type View } from './zoomGeometry';

/** A pointer that moves less than this before it lifts is a tap, not a pan. */
const TAP_SLOP = 8;
/** The wheel's zoom is drawn as a transform and committed once the wheel has been still this long. */
const WHEEL_SETTLE = 150;
/** The click a browser sends right after a drag ends, within this long, is the drag's and is ignored. */
const DRAG_CLICK = 400;
/** A flung map slows down with this time constant (ms), as a scrolled page does. */
const FLING_DECAY = 325;
/** Slower than this (px/ms) when let go, the map just stops. */
const FLING_MIN = 0.25;
/** How long the buttons' zoom, a wheel notch and the spring back from past an edge take (ms). */
const GLIDE_MS = 260;
const WHEEL_GLIDE_MS = 180;

export interface BoardZoom extends View {
  /** The wrap's size in pixels. */
  w: number;
  h: number;
  zoomed: boolean;
  /** Whether zooming does anything here (it doesn't when the spaces are big already). */
  canZoom: boolean;
  zoomBy: (factor: number) => void;
  fit: () => void;
  /** Pan so the space (r, c) is in the middle, as far as the board's edges allow. */
  centreOn: (r: number, c: number) => void;
  /**
   * Zoomed in, pan the space (r, c) into view if it's off screen, at the same zoom. Does nothing at the
   * whole map or while a finger or the mouse is on it, so it never fights a gesture.
   */
  reveal: (r: number, c: number) => void;
  /** Shows that the map zooms: in on the space (r, c) and back out again. A touch or the wheel stops it. */
  demo: (r: number, c: number) => void;
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
 * scrolls) and `zoomBy` / `fit` / `centreOn` move it; the last three, and a wheel's notches, glide there. A
 * flung map carries on and slows down; pulled past an edge or a zoom limit, it gives and springs back. While a gesture is under way the board only gets a
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

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Measured before the first paint, so the map doesn't show at a default size and then shrink.
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrap]);

  const f = frame(size.w, size.h, rows, cols);
  const canZoom = zoomable(f);
  const zoomed = canZoom && view.map === map && view.zoom > 1.001;
  const current = zoomed ? place(f, clampCell(f, f.fit * view.zoom), view.x, view.y) : fitted(f);

  const commit = (v: View) => {
    if (v.cell === current.cell && v.x === current.x && v.y === current.y) {
      if (board.current) board.current.style.transform = ''; // nothing to redraw; just drop the preview
      return;
    }
    setView({ zoom: v.cell / f.fit, x: v.x, y: v.y, map });
  };

  // Gesture handlers are attached once and read the latest values from here.
  const latest = useRef({ f, current, zoomed, commit, stopDemo: () => {} });
  /** Glides the map to the view `to` makes of where it's going (set by the gesture effect once mounted). */
  const glide = useRef<(to: (from: View) => View) => void>();
  /** Whether a pointer is down on the map (set by the gesture effect). */
  const touching = useRef<() => boolean>(() => false);

  // The demo runs on timers; a touch, the wheel or unmounting stops it and puts the map back.
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopDemo = useCallback(() => {
    if (!demoTimers.current.length) return;
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    wrap.current?.classList.remove('gesture');
    if (board.current) Object.assign(board.current.style, { transition: '', transform: '' });
  }, [wrap, board]);
  const demo = (r: number, c: number) => {
    const el = board.current;
    if (!el || !canZoom || zoomed) return;
    stopDemo();
    const cell = Math.min(f.max, current.cell * 2);
    const to = centredOn(f, cell, r, c);
    const at = (ms: number, step: () => void) => demoTimers.current.push(setTimeout(step, ms));
    wrap.current?.classList.add('gesture');
    el.style.transition = 'transform .9s cubic-bezier(.45, 0, .25, 1)';
    at(30, () => (el.style.transform = `translate(${to.x - current.x}px, ${to.y - current.y}px) scale(${cell / current.cell})`));
    at(2100, () => (el.style.transform = ''));
    at(3050, stopDemo);
  };

  latest.current = { f, current, zoomed, commit, stopDemo };
  useLayoutEffect(() => stopDemo, [stopDemo]);

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
    let live: View | null = null; // what's on screen while panning, pinching, wheeling or gliding
    let goal: View | null = null; // where a glide is heading
    let focus = { x: 0, y: 0 }; // the middle of the last pinch, which a spring back zooms around
    let track: { t: number; x: number; y: number }[] = []; // the last 100ms of a one-finger pan, for its speed
    let frame = 0; // a glide or fling under way
    let swallowUntil = 0; // clicks before this time belong to a drag
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    let lastWheel = -Infinity; // when the last wheel event came, so a burst measures the page once
    let scrolls = false; // whether something around the board scrolls, as of this wheel burst
    // The wrap's place on the page, measured when a gesture starts (the board moves, the wrap doesn't).
    let rect = el.getBoundingClientRect();
    const reduced = matchMedia(REDUCED_MOTION);

    const local = (e: PointerEvent | WheelEvent) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    /** Show `v` as a transform of the committed view, clipped to the wrap. */
    const preview = (v: View) => {
      live = v;
      el.classList.add('gesture');
      const from = latest.current.current;
      if (board.current) board.current.style.transform = `translate(${v.x - from.x}px, ${v.y - from.y}px) scale(${v.cell / from.cell})`;
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      goal = null;
    };
    /** Commit what's on screen, so it redraws crisp. */
    const finish = () => {
      stop();
      clearTimeout(wheelTimer);
      el.classList.remove('gesture');
      if (!live) return;
      latest.current.commit(live);
      live = null;
    };
    /** Ease from what's on screen to `to`, then `done`. */
    const tween = (to: View, ms: number, done: () => void = finish) => {
      stop();
      const from = live ?? latest.current.current;
      if (reduced.matches) {
        preview(to);
        return done();
      }
      goal = to;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const k = 1 - (1 - t) ** 3;
        // Size and position change in step, so whatever point the glide zooms around stays put.
        preview({ cell: from.cell + (to.cell - from.cell) * k, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
        if (t < 1) frame = requestAnimationFrame(step);
        else {
          frame = 0;
          goal = null;
          done();
        }
      };
      frame = requestAnimationFrame(step);
    };
    /** Let go while moving: the map carries on and slows down, stopping at the edges. */
    const fling = (vx: number, vy: number) => {
      stop();
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(32, now - last);
        last = now;
        const v = live!;
        const want = { x: v.x + vx * dt, y: v.y + vy * dt };
        const next = place(latest.current.f, v.cell, want.x, want.y);
        if (next.x !== want.x) vx = 0;
        if (next.y !== want.y) vy = 0;
        const decay = Math.exp(-dt / FLING_DECAY);
        vx *= decay;
        vy *= decay;
        preview(next);
        if (Math.hypot(vx, vy) < 0.02) return finish();
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    /** The last finger lifted: spring back inside the limits, or fling, or just stop. */
    const release = () => {
      if (swallowUntil === Infinity) swallowUntil = performance.now() + DRAG_CLICK;
      if (!live) return finish();
      const settled = zoomAround(latest.current.f, live, 1, focus.x, focus.y);
      if (Math.abs(settled.cell - live.cell) > 0.01 || Math.abs(settled.x - live.x) > 0.5 || Math.abs(settled.y - live.y) > 0.5) return tween(settled, GLIDE_MS);
      const now = performance.now();
      const recent = track.filter((p) => now - p.t < 100);
      const [a, b] = [recent[0], recent[recent.length - 1]];
      // A finger that stopped before lifting doesn't fling.
      if (a && b && b.t > a.t && now - b.t < 50) {
        const vx = (b.x - a.x) / (b.t - a.t);
        const vy = (b.y - a.y) / (b.t - a.t);
        if (Math.hypot(vx, vy) > FLING_MIN) return fling(vx, vy);
      }
      finish();
    };
    /** Pointers came or went: carry on from where the gesture is now. */
    const rebase = () => {
      base = live ?? latest.current.current;
      start = new Map(pointers);
      track = [];
    };
    const lift = (id: number) => {
      if (!pointers.delete(id)) return;
      if (pointers.size === 0) release();
      else rebase();
    };
    touching.current = () => pointers.size > 0;
    glide.current = (to) => {
      latest.current.stopDemo();
      clearTimeout(wheelTimer);
      tween(to(goal ?? live ?? latest.current.current), GLIDE_MS);
    };

    const down = (e: PointerEvent) => {
      latest.current.stopDemo();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as Element).closest('.zoom-controls, .zoom-hint')) return;
      if (!zoomable(latest.current.f)) return;
      // A touch catches a moving map, and is only that, not a tap on what's under it.
      if (pointers.size === 0) {
        swallowUntil = frame ? Infinity : 0;
        rect = el.getBoundingClientRect();
      }
      stop();
      clearTimeout(wheelTimer);
      pointers.set(e.pointerId, local(e));
      rebase();
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      // The button was let go where we didn't see it (outside the window, say): that drag is over.
      if (e.pointerType === 'mouse' && e.buttons === 0) return lift(e.pointerId);
      pointers.set(e.pointerId, local(e));
      const { f, zoomed } = latest.current;
      const pts = [...pointers.values()];
      const was = [...pointers.keys()].map((id) => start.get(id)!);
      let next: View;
      if (pts.length >= 2) {
        const [a, b] = pts;
        const [a0, b0] = was;
        const s = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, Math.hypot(a0.x - b0.x, a0.y - b0.y));
        const cell = softCell(f, base.cell * s);
        const k = cell / base.cell;
        const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
        const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        focus = m1;
        next = place(f, cell, m1.x - (m0.x - base.x) * k, m1.y - (m0.y - base.y) * k, true);
      } else {
        // One pointer pans, but only a zoomed board, and only once it has moved more than a tap would.
        const [p] = pts;
        const [p0] = was;
        if (!live && (!zoomed || Math.hypot(p.x - p0.x, p.y - p0.y) < TAP_SLOP)) return;
        next = place(f, base.cell, base.x + p.x - p0.x, base.y + p.y - p0.y, true);
        const now = performance.now();
        track = [...track.filter((q) => now - q.t < 100), { t: now, x: next.x, y: next.y }];
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
      latest.current.stopDemo();
      const { f, current } = latest.current;
      const now = performance.now();
      if (now - lastWheel > WHEEL_SETTLE) {
        scrolls = scrollsAround(el);
        rect = el.getBoundingClientRect();
      }
      lastWheel = now;
      if (!zoomable(f) || pointers.size || (!e.ctrlKey && scrolls)) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const at = local(e);
      const from = goal ?? live ?? current;
      const next = zoomAround(f, from, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), at.x, at.y);
      if (next.cell === from.cell && next.x === from.x && next.y === from.y) return;
      clearTimeout(wheelTimer);
      const settle = () => void (wheelTimer = setTimeout(finish, WHEEL_SETTLE));
      // A mouse wheel moves in notches: each glides. A trackpad's stream of small steps is smooth already.
      if (e.deltaMode !== 0 || (!e.ctrlKey && Math.abs(dy) >= 40)) return tween(next, WHEEL_GLIDE_MS, settle);
      stop();
      preview(next);
      settle();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('click', click, true);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      stop();
      clearTimeout(wheelTimer);
      glide.current = undefined;
      touching.current = () => false;
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('click', click, true);
      el.removeEventListener('wheel', wheel);
    };
  }, [wrap, board]);

  /** Glide to a view, or jump there before the gesture effect is attached. */
  const go = (to: (from: View) => View) => (glide.current ? glide.current(to) : commit(to(current)));

  return {
    ...current,
    w: size.w,
    h: size.h,
    zoomed,
    canZoom,
    zoomBy: (factor) => go((from) => zoomAround(f, from, factor, f.w / 2, f.h / 2)),
    fit: () => go(() => fitted(f)),
    demo,
    centreOn: (r, c) => go((from) => centredOn(f, from.cell, r, c)),
    reveal: (r, c) => {
      if (!zoomed || touching.current()) return;
      const { cell, x, y } = current;
      const inView = x + c * cell >= 0 && x + (c + 1) * cell <= f.w && y + r * cell >= 0 && y + (r + 1) * cell <= f.h;
      if (!inView) go((from) => centredOn(f, from.cell, r, c));
    },
  };
}
