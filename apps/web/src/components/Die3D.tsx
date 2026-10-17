import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { playRoll } from '../sound';
import { APPLE_TOUCH } from '../platform';
import { useEffectEvent } from '../game/useEffectEvent';
import { PIP } from '../theme';

/**
 * A CSS 3D die. Faces sit on a cube; the cube rotates so the face for `value` points at
 * the viewer. When `rolls` changes the die tumbles: several extra full turns on both
 * axes with an ease-out, plus a hop, so it always lands on the engine's result.
 *
 * At rest only the front face shows, so a still die is that one face, drawn flat: a cube is ten
 * composited layers, and a map of them made every frame of a zoom or pan slower. The cube is built
 * when the die starts to move (at the face it showed) and goes again once it has landed. Dice that
 * tumble on mount (the fleet, battle and lobby rolls) keep theirs: they roll again under a modal's
 * backdrop-filter, where layers made mid-roll can flash a white frame.
 *
 * On an iPhone or iPad every die keeps its cube. Safari draws a cube's new layers wrong for a frame or two
 * (a hard-edged die that then turns into the real one) and skips the start of a tumble while it makes them,
 * and its flat face doesn't quite match the cube's, so building one per roll and dropping it after showed.
 * A newly built cube also waits two frames before it moves, so the tumble starts once it is on screen.
 *
 * The cube isn't a CSS 3D scene (preserve-3d): each face carries the whole turn, perspective included, and hides
 * when it faces away. A cube is convex, so the faces that show never overlap and nothing needs sorting by depth.
 * Chrome splits and sorts a 3D scene's planes, and a scene's new layers drew a face stretched far out of the die
 * now and then mid-tumble.
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

/** The cube's planes, each with where it sits after the cube's turn (`at`). */
const FACES: { n: number; cls: string; at: string }[] = [
  { n: 1, cls: 'front', at: 'translateZ(var(--half))' },
  { n: 6, cls: 'back', at: 'rotateY(180deg) translateZ(var(--half))' },
  { n: 3, cls: 'right', at: 'rotateY(90deg) translateZ(var(--half))' },
  { n: 4, cls: 'left', at: 'rotateY(-90deg) translateZ(var(--half))' },
  { n: 2, cls: 'top', at: 'rotateX(90deg) translateZ(var(--half))' },
  { n: 5, cls: 'bottom', at: 'rotateX(-90deg) translateZ(var(--half))' },
];
const CORES: { axis: string; at: string }[] = [
  { axis: 'x', at: 'rotateY(90deg)' },
  { axis: 'y', at: 'rotateX(90deg)' },
  { axis: 'z', at: '' },
];
/** The cube's children in order: the core first, so the faces are drawn over it. */
const PLANES = [...CORES, ...FACES].map((p) => p.at);

export interface Die3DProps {
  value: number;
  rolls?: number;
  size: number;
  color: string;
  pip?: string;
  /** Tumble when first shown (combat dice, setup fleet). */
  tumbleOnMount?: boolean;
  /** Changes when the die jumps to another position of the game instead of following play (looking
   * back at it): a roll since then turns it to its face, without tumbling or a sound. */
  scene?: string;
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
  scene,
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
  const lastScene = useRef(scene);
  const mounted = useRef(false);
  /** Whether the cube goes once the die has landed. */
  const flatten = !tumbleOnMount && !APPLE_TOUCH;
  const [moving, setMoving] = useState(!flatten);
  const settle = useRef<number>();
  const clatter = useRef<number>();
  const frame = useRef<number>();
  const hopAnimation = useRef<Animation | undefined>(undefined);
  /** The cube element that has been turned (a cube just built hasn't been). */
  const turned = useRef<HTMLDivElement | null>(null);
  /** Drop a move still waiting on a new cube. */
  const cancelFrame = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  };
  useEffect(
    () => () => {
      clearTimeout(settle.current);
      clearTimeout(clatter.current);
      cancelFrame();
      hopAnimation.current?.cancel();
    },
    [],
  );
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

  /** Turn the cube (its planes, each on its own) to `rotate`. */
  const turn = (el: HTMLDivElement, transition: string, rotate: string) => {
    Array.from(el.children as HTMLCollectionOf<HTMLElement>).forEach((plane, i) => {
      plane.style.transition = transition;
      plane.style.transform = `perspective(calc(var(--die-size) * 7)) ${rotate} ${PLANES[i]}`;
    });
    turned.current = el;
  };

  const rotation = (v: number) => {
    const [bx, by] = FACE_ROTATION[v] ?? [0, 0];
    return `rotateX(${bx + spins.current.x}deg) rotateY(${by + spins.current.y}deg)`;
  };

  /** Turn the cube to `value` over `duration` ms, then lay the die flat again (unless it keeps its cube). */
  const setRotation = (duration: number) => {
    const el = cube.current;
    if (!el) return;
    turn(el, `transform ${duration}ms cubic-bezier(.12,.72,.22,1) ${delay}s`, rotation(value));
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

  const animate = useEffectEvent(() => {
    const el = cube.current;
    if (!mounted.current) {
      mounted.current = true;
      if (!el) return;
      if (tumbleOnMount) {
        // Start from a random orientation, then tumble to the value.
        turn(el, 'none', `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`);
        afterPaint(tumble);
      } else turn(el, 'none', rotation(value));
      return;
    }
    const rolled = rolls !== lastRolls.current;
    if (!rolled && value === lastValue.current) {
      lastScene.current = scene;
      return;
    }
    // A still die builds its cube first; this runs again once it's there (before anything is painted).
    if (!el) return setMoving(true);
    const built = turned.current !== el;
    // Just built: start from the face the die was showing.
    if (built) turn(el, 'none', rotation(lastValue.current));
    const jumped = scene !== lastScene.current;
    lastRolls.current = rolls;
    lastValue.current = value;
    lastScene.current = scene;
    const go = rolled && !jumped ? tumble : () => setRotation(450);
    if (built) afterPaint(go);
    else {
      // A move still waiting on a new cube is overtaken by this one.
      cancelFrame();
      go();
    }
  });
  useLayoutEffect(() => animate(), [value, rolls, moving, scene, animate]);

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
            {/* The die's solid inside, seen through the gaps the faces' rounded corners leave at the cube's corners. */}
            {CORES.map((c) => (
              <div key={c.axis} className={`die3d-core ${c.axis}`} />
            ))}
            {FACES.map((f) => (
              <Face key={f.n} n={f.n} className={f.cls} />
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
