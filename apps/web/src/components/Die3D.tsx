import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { playRoll } from '../sound';
import { APPLE_TOUCH } from '../platform';
import { PIP } from '../theme';

/**
 * A CSS 3D die. Faces sit on a cube; the cube rotates so the face for `value` points at
 * the viewer. When `rolls` changes the die tumbles: several extra full turns on both
 * axes with an ease-out, plus a hop, so it always lands on the engine's result.
 *
 * At rest only the front face shows, so a still die is that one face, drawn flat: a cube is eleven
 * composited layers, and a map of them made every frame of a zoom or pan slower. The cube is built
 * when the die starts to move (at the face it showed) and goes again once it has landed. Dice that
 * tumble on mount (the fleet, battle and lobby rolls) keep theirs: they roll again under a modal's
 * backdrop-filter, where layers made mid-roll can flash a white frame.
 *
 * On an iPhone or iPad every die keeps its cube. Safari draws a cube's new layers wrong for a frame or two
 * (a hard-edged die that then turns into the real one) and skips the start of a tumble while it makes them,
 * and its flat face doesn't quite match the cube's, so building one per roll and dropping it after showed.
 * A newly built cube also waits two frames before it moves, so the tumble starts once it is on screen.
 */

// Rotation that brings each face to the front (front=1, top=2, right=3, left=4, bottom=5, back=6).
const FACE_ROTATION: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

/** Lit pips per face, as indices into a 3 × 3 grid (row by row). */
export const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const FACES: { n: number; cls: string }[] = [
  { n: 1, cls: 'front' },
  { n: 6, cls: 'back' },
  { n: 3, cls: 'right' },
  { n: 4, cls: 'left' },
  { n: 2, cls: 'top' },
  { n: 5, cls: 'bottom' },
];

export interface Die3DProps {
  value: number;
  rolls?: number;
  size: number;
  color: string;
  pip?: string;
  /** Tumble when first shown (combat dice, setup fleet). */
  tumbleOnMount?: boolean;
  /** Seconds to wait before the tumble (to stagger several dice). */
  delay?: number;
  sound?: boolean;
  className?: string;
  title?: string;
  onClick?: () => void;
}

/** Memoised: the map re-renders on every move, and a die is up to six faces of nine pips. */
export const Die3D = memo(function Die3D({
  value,
  rolls = 0,
  size,
  color,
  pip = PIP,
  tumbleOnMount,
  delay = 0,
  sound = true,
  className = '',
  title,
  onClick,
}: Die3DProps) {
  const cube = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const spins = useRef({ x: 0, y: 0 });
  const lastRolls = useRef(rolls);
  const lastValue = useRef(value);
  const mounted = useRef(false);
  /** Whether the cube goes once the die has landed. */
  const flatten = !tumbleOnMount && !APPLE_TOUCH;
  const [moving, setMoving] = useState(!flatten);
  const settle = useRef<number>();
  const clatter = useRef<number>();
  const frame = useRef<number>();
  const hopAnimation = useRef<Animation | undefined>(undefined);
  /** Drop a move still waiting on a new cube. */
  const cancelFrame = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  };
  useEffect(() => () => {
    clearTimeout(settle.current);
    clearTimeout(clatter.current);
    cancelFrame();
    hopAnimation.current?.cancel();
  }, []);
  /** Run `go` once the cube just built has been on screen for a frame. */
  const afterPaint = (go: () => void) => {
    cancelFrame();
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        go();
      });
    });
  };

  const rotation = (v: number) => {
    const [bx, by] = FACE_ROTATION[v] ?? [0, 0];
    return `rotateX(${bx + spins.current.x}deg) rotateY(${by + spins.current.y}deg)`;
  };

  /** Turn the cube to `value` over `duration` ms, then lay the die flat again (unless it keeps its cube). */
  const setRotation = (duration: number) => {
    const el = cube.current;
    if (!el) return;
    el.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.22,1) ${delay}s`;
    el.style.transform = rotation(value);
    clearTimeout(settle.current);
    if (flatten) settle.current = window.setTimeout(() => setMoving(false), delay * 1000 + duration + 50);
  };

  const tumble = () => {
    const turns = () => (2 + Math.floor(Math.random() * 2)) * 360 * (Math.random() < 0.5 ? -1 : 1);
    spins.current = { x: spins.current.x + turns(), y: spins.current.y + turns() };
    setRotation(1100);
    hopAnimation.current?.cancel();
    hopAnimation.current = hop.current?.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: `translateY(${-size * 0.55}px) scale(1.12)`, offset: 0.28 },
        { transform: 'translateY(0) scale(0.96)', offset: 0.6 },
        { transform: `translateY(${-size * 0.12}px) scale(1.02)`, offset: 0.78 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: 1000, delay: delay * 1000, easing: 'ease-out' },
    );
    clearTimeout(clatter.current); // a roll still waiting to sound is overtaken by this one
    if (sound) clatter.current = window.setTimeout(() => playRoll(), delay * 1000);
  };

  useLayoutEffect(() => {
    const el = cube.current;
    if (!mounted.current) {
      mounted.current = true;
      if (!el) return;
      el.style.transition = 'none';
      if (tumbleOnMount) {
        // Start from a random orientation, then tumble to the value.
        el.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`;
        afterPaint(tumble);
      } else el.style.transform = rotation(value);
      return;
    }
    const rolled = rolls !== lastRolls.current;
    if (!rolled && value === lastValue.current) return;
    // A still die builds its cube first; this runs again once it's there (before anything is painted).
    if (!el) return setMoving(true);
    const built = !el.style.transform;
    if (built) {
      // Just built: start from the face the die was showing.
      el.style.transition = 'none';
      el.style.transform = rotation(lastValue.current);
    }
    lastRolls.current = rolls;
    lastValue.current = value;
    const go = rolled ? tumble : () => setRotation(450);
    if (built) afterPaint(go);
    else {
      // A move still waiting on a new cube is overtaken by this one.
      cancelFrame();
      go();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rolls, moving]);

  const style = {
    '--die-size': `${size}px`,
    '--die-color': color,
    '--die-pip': pip,
  } as CSSProperties;

  return (
    <div className={`die3d ${className}`} style={style} title={title} onClick={onClick}>
      <div className="die3d-shadow" />
      <div className="die3d-hop" ref={hop}>
        {moving ? (
          <div className="die3d-cube" ref={cube}>
            {FACES.map((f) => (
              <Face key={f.n} n={f.n} className={f.cls} />
            ))}
            {/* The die's solid inside, seen through the gaps the faces' rounded corners leave at the cube's corners. */}
            {['x', 'y', 'z'].map((axis) => (
              <div key={axis} className={`die3d-core ${axis}`} />
            ))}
          </div>
        ) : (
          <Face n={value} className="still" />
        )}
      </div>
    </div>
  );
});

function Face({ n, className }: { n: number; className: string }) {
  return (
    <div className={`die3d-face ${className}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[n].includes(i) ? 'pip on' : 'pip'} />
      ))}
    </div>
  );
}
