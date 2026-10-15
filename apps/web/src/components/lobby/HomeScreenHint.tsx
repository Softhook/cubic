import { useState } from 'react';
import { APPLE_TOUCH, FROM_HOME_SCREEN } from '../../platform';
import { remember, stored } from '../../storage';

/** A dismissed hint, remembered between visits. */
const HOME_HINT_KEY = 'quantum.homeScreenHint';

/**
 * iPhone and iPad have no full screen for a page (FullscreenButton) and no install prompt, so the lobby says how
 * to get the next best thing: added to the Home Screen, the game opens without Safari's bars. Until dismissed.
 */
export function HomeScreenHint() {
  const [shown, setShown] = useState(() => APPLE_TOUCH && !FROM_HOME_SCREEN && !stored(HOME_HINT_KEY));
  if (!shown) return null;
  const dismiss = () => {
    remember(HOME_HINT_KEY, 'dismissed');
    setShown(false);
  };
  return (
    <div className="home-hint" role="note">
      <div className="home-hint-body">
        <strong>Play full screen</strong>
        <span className="home-hint-steps">
          <span className="home-hint-step">
            <svg
              width="13"
              height="15"
              viewBox="0 0 14 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 1v9M4 4l3-3 3 3M4.5 7H2.5v8h9V7h-2" />
            </svg>
            Share
          </span>
          <span aria-hidden="true">→</span>
          <span className="home-hint-step">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="1" y="1" width="12" height="12" rx="3" />
              <path d="M7 4v6M4 7h6" />
            </svg>
            Add to Home Screen
          </span>
        </span>
      </div>
      <button className="icon-btn" aria-label="Dismiss" title="Dismiss" onClick={dismiss}>
        <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}
