import { useEffect, useState } from 'react';
import { FULLSCREEN_SUPPORTED, isFullscreen, toggleFullscreen } from '../fullscreen';

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

  if (!FULLSCREEN_SUPPORTED) return null;

  return (
    <button
      className="icon-btn"
      data-fullscreen-toggle
      title={on ? 'Exit full screen' : 'Full screen'}
      aria-label={on ? 'Exit full screen' : 'Full screen'}
      onClick={toggleFullscreen}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {on ? <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" /> : <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />}
      </svg>
    </button>
  );
}
