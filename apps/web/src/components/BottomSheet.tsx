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
 * (until the screen's width changes), so the map doesn't jump when the turn panel gains a row; the peek
 * keeps that height too (`--peek-min`), so a shorter turn panel leaves space, never a glimpse of the rest.
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
  // Opened for a card to pick: the market (first in the rest) shows under the turn panel, wherever it was scrolled.
  useLayoutEffect(() => {
    if (wanted && rest.current) rest.current.scrollTop = 0;
  }, [wanted]);
  const peekBox = useRef<HTMLDivElement>(null);
  const restHeight = useRef({ h: 0, width: 0 });
  useLayoutEffect(() => {
    const el = sheet.current;
    const box = peekBox.current;
    const content = box?.firstElementChild as HTMLElement | null;
    if (!el || !box || !content) return;
    const measure = () => {
      const r = restHeight.current;
      if (el.clientWidth !== r.width) Object.assign(r, { h: 0, width: el.clientWidth });
      // The handle, the turn panel at its own height, and the space under it.
      const h = Math.max(r.h, Math.ceil(box.offsetTop + content.offsetHeight + parseFloat(getComputedStyle(box).paddingBottom)));
      if (h === r.h) return;
      r.h = h;
      el.parentElement?.style.setProperty('--sheet-rest', `${h}px`);
      // A shorter turn panel leaves the peek at this height, so what's below it never shows while shut.
      box.style.setProperty('--peek-min', `${h - box.offsetTop}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.parentElement?.style.removeProperty('--sheet-rest');
    };
  }, []);

  // Dragging the handle moves the sheet with the finger; letting go snaps it open or shut. A tap toggles it
  // on the pointer's release: on a touch screen a drag is followed by no click, so clicks only count from the keyboard.
  const drag = useRef<{ y: number; from: number; travel: number; moved: boolean } | null>(null);
  const travel = () => (sheet.current ? sheet.current.offsetHeight - restHeight.current.h : 0);
  /** How far down the sheet is with the finger at `y`: 0 open, `travel` shut. */
  const offset = (d: NonNullable<typeof drag.current>, y: number) => Math.min(d.travel, Math.max(0, d.from + y - d.y));
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = travel();
    drag.current = { y: e.clientY, from: open ? 0 : t, travel: t, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || !sheet.current) return;
    if (!d.moved && Math.abs(e.clientY - d.y) < TAP_SLOP) return;
    d.moved = true;
    sheet.current.style.transition = 'none';
    sheet.current.style.transform = `translateY(${offset(d, e.clientY)}px)`;
  };
  /** The drag is over: let go (`e`), or taken by the browser (none), when the sheet goes back to where it was. */
  const endDrag = (e?: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !sheet.current) return;
    sheet.current.style.transition = '';
    sheet.current.style.transform = '';
    if (!e) return;
    if (!d.moved) return setOpen(!open);
    const at = offset(d, e.clientY);
    // Past a third of the way from where it started is far enough.
    setOpen(open ? at < d.travel / 3 : at < (d.travel * 2) / 3);
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
          onPointerUp={endDrag}
          onPointerCancel={() => endDrag()}
          onClick={(e) => e.detail === 0 && setOpen(!open)}
        >
          <span />
        </button>
        <div className="sheet-peek" ref={peekBox}>
          {peek}
        </div>
        {/* Shut, it's off screen: nothing in it can be tabbed to (React 18 has no `inert` prop). */}
        <div className="sheet-rest" ref={rest} {...(open ? {} : { inert: '' })}>
          {children}
        </div>
      </div>
    </>
  );
}
