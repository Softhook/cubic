import { useEffect, useRef } from 'react';
import { reducedMotion } from '../../game/useMediaQuery';
import { startShow } from './show';

/** The victory fireworks (display.ts fired by show.ts), behind the game-over popup. Nothing at all under reduced motion. */
export function Fireworks({ color }: { color: string }) {
  const glowRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!glowRef.current || !sparkRef.current || reducedMotion()) return;
    return startShow(glowRef.current, sparkRef.current, color);
  }, [color]);

  return (
    <>
      <canvas ref={glowRef} className="fireworks" aria-hidden />
      <canvas ref={sparkRef} className="fireworks" aria-hidden />
    </>
  );
}
