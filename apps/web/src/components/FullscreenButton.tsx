import { useEffect, useState } from 'react';

// Safari (incl. iPad) still only ships the webkit-prefixed API.
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = document as FsDocument;
const root = document.documentElement as FsElement;

// Opened from the home screen with the manifest's `display: fullscreen`, there are no bars to hide.
const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen) && !matchMedia('(display-mode: fullscreen)').matches;
const isFullscreen = () => !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
const enter = () => (root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root)?.catch?.(() => {});

const phone = () => supported && matchMedia('(pointer: coarse)').matches;

/**
 * Phones play full screen: the address bar and system bars take a lot of a small screen. Browsers only
 * allow it from a tap, so the lobby calls this from the tap that starts or opens a game.
 */
export function fullscreenOnPhone() {
  if (phone() && !isFullscreen()) enter();
}

/**
 * A game opened without a lobby tap (an invite link, a reload) goes full screen on its first tap; once
 * per game screen, so leaving full screen sticks.
 */
export function useFullscreenOnFirstTap() {
  useEffect(() => {
    if (!phone()) return;
    document.addEventListener('click', fullscreenOnPhone, { once: true, capture: true });
    return () => document.removeEventListener('click', fullscreenOnPhone, { capture: true });
  }, []);
}

function toggle() {
  if (isFullscreen()) (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
  else enter();
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
    <button className="icon-btn" title={on ? 'Exit full screen' : 'Full screen'} aria-label={on ? 'Exit full screen' : 'Full screen'} onClick={toggle}>
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
