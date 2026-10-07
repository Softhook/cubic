import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useShortcut } from '../game/useShortcut';

/** A drag shorter than this is a tap on the handle. */
const TAP_SLOP = 6;

/**
 * The phone's bottom sheet, flush with the bottom of its parent (the layout) and over the map. At rest it shows
 * `peek` (the turn panel); dragged or tapped open it shows `children` too, scrolling, with the map
 * dimmed behind it (a tap there closes it). It opens by itself while `wantOpen` (a card to pick) and
 * closes again after.
 *
 * The resting height is set on the parent as `--sheet-rest`, for the map to stop above it. It only grows
 * (until the screen's width changes), so the map doesn't jump when the turn panel gains a row.
 */
export function BottomSheet({ peek, wantOpen, children }: { peek: ReactNode; wantOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(wantOpen);
  // Follows `wantOpen` during render (not in an effect), so the sheet never flashes shut first.
  const [wanted, setWanted] = useState(wantOpen);
  if (wantOpen !== wanted) {
    setWanted(wantOpen);
    setOpen(wantOpen);
  }
  useShortcut((e) => open && e.key === 'Escape', () => setOpen(false));

  const sheet = useRef<HTMLDivElement>(null);
  const rest = useRef<HTMLDivElement>(null);
  const restHeight = useRef({ h: 0, width: 0 });
  useLayoutEffect(() => {
    const el = sheet.current;
    const after = rest.current;
    if (!el || !after) return;
    const measure = () => {
      const r = restHeight.current;
      if (el.clientWidth !== r.width) Object.assign(r, { h: 0, width: el.clientWidth });
      const h = Math.max(r.h, after.offsetTop);
      if (h === r.h) return;
      r.h = h;
      el.parentElement?.style.setProperty('--sheet-rest', `${h}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const child of el.children) if (child !== after) ro.observe(child);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.parentElement?.style.removeProperty('--sheet-rest');
    };
  }, []);

  // Dragging the handle moves the sheet with the finger; letting go snaps it open or shut.
  const drag = useRef<{ y: number; from: number; travel: number; moved: boolean } | null>(null);
  const tapped = useRef(false);
  const travel = () => (sheet.current ? sheet.current.offsetHeight - restHeight.current.h : 0);
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, from: open ? 0 : travel(), travel: travel(), moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || !sheet.current) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < TAP_SLOP) return;
    d.moved = true;
    sheet.current.style.transition = 'none';
    sheet.current.style.transform = `translateY(${Math.min(d.travel, Math.max(0, d.from + dy))}px)`;
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !sheet.current) return;
    sheet.current.style.transition = '';
    sheet.current.style.transform = '';
    if (!d.moved) return; // a tap: the click toggles
    tapped.current = true; // the click that follows a drag isn't a tap
    const at = Math.min(d.travel, Math.max(0, d.from + e.clientY - d.y));
    // Past a third of the way from where it started is far enough.
    setOpen(open ? at < d.travel / 3 : at < (d.travel * 2) / 3);
  };
  const onClick = () => {
    if (tapped.current) return void (tapped.current = false);
    setOpen(!open);
  };

  return (
    <>
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className={`sheet ${open ? 'open' : ''}`} ref={sheet}>
        <button
          type="button"
          className="sheet-handle"
          aria-label={open ? 'Show less' : 'Show players, cards and log'}
          aria-expanded={open}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
        >
          <span />
        </button>
        <div className="sheet-peek">{peek}</div>
        {/* Shut, what shows of it can't be tabbed to or tapped (React 18 has no `inert` prop). */}
        <div className="sheet-rest" ref={rest} {...(open ? {} : { inert: '' })}>
          {children}
        </div>
      </div>
    </>
  );
}
