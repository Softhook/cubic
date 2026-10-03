import { useEffect, useState } from 'react';

// Safari (incl. iPad) still only ships the webkit-prefixed API.
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = document as FsDocument;
const root = document.documentElement as FsElement;

const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
const isFullscreen = () => !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);

function toggle() {
  if (isFullscreen()) (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
  else (root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root)?.catch?.(() => {});
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
