import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { holdForTitle } from '../../ambience';
import { OPENS_FULLSCREEN, fullscreenWaiting, resumeFullscreen } from '../../fullscreen';
import { reducedMotion } from '../../game/useMediaQuery';

/**
 * The opening, once per page load: how long the title holds in the middle (unless it waits for a click), and how long
 * it takes to rise.
 */
const INTRO_HOLD_MS = 2600;
export const INTRO_RISE_MS = 1300;
let introPlayed = false;

/**
 * The lobby's opening: the title alone over the backdrop, in the middle of the screen, then rising to its place
 * as the rest fades in. Only on the first visit of a page load (not back from a game), never under reduced
 * motion; a click (or tap) or key skips it. Where that click goes full screen (a phone, the app installed on a
 * computer), the title waits for it, asking after a while, and holds, centred in the new size, until the window
 * has settled: the lobby then comes in full screen. The app installed on Android, already full screen, waits for
 * it too, so it opens the same way. Returns the phase (null once done), whether it waits for a click and has had
 * it, and the offset that centres the title.
 */
export function useIntro(title: RefObject<HTMLHeadingElement | null>) {
  const [phase, setPhase] = useState<'title' | 'rise' | null>(() => (introPlayed || reducedMotion() ? null : 'title'));
  const [waits] = useState(() => OPENS_FULLSCREEN || fullscreenWaiting());
  const [started, setStarted] = useState(false);
  const [offset, setOffset] = useState(0);
  const shown = useRef(0);
  useLayoutEffect(() => {
    shown.current = offset;
  }, [offset]);
  useLayoutEffect(() => {
    if (phase !== 'title' || !title.current) return;
    const h1 = title.current;
    // Measured with the offset on screen (the scale is about its centre), so a new window size re-centres it.
    const centre = () => {
      const r = h1.getBoundingClientRect();
      setOffset(shown.current + innerHeight / 2 - (r.top + r.height / 2));
    };
    centre();
    addEventListener('resize', centre);
    return () => removeEventListener('resize', centre);
  }, [phase, title]);
  useEffect(() => {
    if (!phase) return;
    introPlayed = true;
    // The music waits under the title; its opening starts as the title is to rise, and the title rises when the
    // opening is heard, with its rush.
    const music = phase === 'title' ? holdForTitle() : undefined;
    let live = true;
    const rise = (settling?: Promise<void> | null) => void Promise.all([music?.open(), settling]).then(() => live && setPhase('rise'));
    const t =
      phase === 'title' && waits
        ? undefined
        : setTimeout(() => (phase === 'title' ? rise() : setPhase(null)), phase === 'title' ? INTRO_HOLD_MS : INTRO_RISE_MS);
    const unlisten = () => {
      removeEventListener('click', skip);
      removeEventListener('keydown', skip);
    };
    const skip = (e: Event) => {
      setStarted(true);
      if (phase !== 'title') return setPhase(null);
      clearTimeout(t);
      unlisten();
      // Where this goes full screen, the title also waits for the window to settle.
      rise(resumeFullscreen(e));
    };
    // On a click rather than a press: a phone only allows full screen once the finger lifts.
    addEventListener('click', skip);
    addEventListener('keydown', skip);
    return () => {
      live = false;
      clearTimeout(t);
      unlisten();
      music?.release();
    };
  }, [phase, waits]);
  return { phase, waits, started, offset };
}
