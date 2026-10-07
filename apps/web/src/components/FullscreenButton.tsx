import { useEffect, useState } from 'react';

// Safari (incl. iPad) still only ships the webkit-prefixed API.
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = document as FsDocument;
const root = document.documentElement as FsElement;

// The installed app opens full screen on Android (manifest `display_override`) and stays that way, so
// there is nothing to do or toggle; where it opens `standalone` instead, it goes full screen the same
// way as the browser.
const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen) && !matchMedia('(display-mode: fullscreen)').matches;
const isFullscreen = () => !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
/** Whether full screen was asked for and not left on purpose, to restore it when the phone drops it. */
let wanted = false;
/** A request on its way, so a tap's pointerup and click don't both ask. */
let asking = false;
const enter = () => {
  wanted = true;
  if (asking) return;
  asking = true;
  const done = () => { asking = false; };
  const request = (root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root, { navigationUI: 'hide' });
  if (request?.then) request.then(done, done);
  else done();
};
const phone = () => supported && matchMedia('(pointer: coarse)').matches;

/**
 * Phones drop full screen on their own: the screen locking, another app coming up, a browser dialog
 * (confirm, prompt), the back gesture. Browsers only allow asking again from a tap, so whenever it was
 * wanted and is gone, the next tap anywhere brings it back; coming back to the page tries straight away.
 * Not on a computer, where Esc is how you leave full screen. Not a tap on the full screen button
 * either: that tap is the player's own choice, and asking here too would race its toggle.
 */
const restore = (e: Event) => {
  if (e.target instanceof Element && e.target.closest('[data-fullscreen-toggle]')) return;
  restoreFullscreen();
};

/**
 * Back to full screen if the phone dropped it, for right after something known to (a browser dialog,
 * the share sheet). It works while the tap that opened it still counts; if it doesn't, the next tap does.
 */
export function restoreFullscreen() {
  if (wanted && !isFullscreen() && document.visibilityState === 'visible' && phone()) enter();
}
document.addEventListener('visibilitychange', restore);
document.addEventListener('pointerup', restore, { capture: true });
document.addEventListener('click', restore, { capture: true });

/**
 * Phones play full screen: the address bar and system bars take a lot of a small screen. Browsers only
 * allow it from a tap, so the lobby calls this from the tap that starts or opens a game.
 */
export function fullscreenOnPhone() {
  if (phone() && !isFullscreen()) enter();
}

/**
 * A screen opened without a lobby tap (the lobby itself, an invite link, a reload) goes full screen on
 * its first tap; once per screen, so leaving full screen sticks.
 */
export function useFullscreenOnFirstTap() {
  useEffect(() => {
    if (!phone()) return;
    document.addEventListener('click', fullscreenOnPhone, { once: true, capture: true });
    return () => document.removeEventListener('click', fullscreenOnPhone, { capture: true });
  }, []);
}

function toggle() {
  if (isFullscreen()) {
    wanted = false;
    (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
  } else enter();
}

export function FullscreenButton() {
  const [on, setOn] = useState(isFullscreen);

  useEffect(() => {
    const sync = () => setOn(isFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  if (!supported) return null;

  return (
    <button className="icon-btn" data-fullscreen-toggle title={on ? 'Exit full screen' : 'Full screen'} aria-label={on ? 'Exit full screen' : 'Full screen'} onClick={toggle}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {on ? (
          <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
        ) : (
          <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
        )}
      </svg>
    </button>
  );
}
