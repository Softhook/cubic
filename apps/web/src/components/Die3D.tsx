import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { playRoll } from '../sound';
import { PIP } from '../theme';

/**
 * A CSS 3D die. Faces sit on a cube; the cube rotates so the face for `value` points at
 * the viewer. When `rolls` changes the die tumbles: several extra full turns on both
 * axes with an ease-out, plus a hop, so it always lands on the engine's result.
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

export function Die3D({
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
  const mounted = useRef(false);

  const setRotation = (duration: number) => {
    const el = cube.current;
    if (!el) return;
    const [bx, by] = FACE_ROTATION[value] ?? [0, 0];
    el.style.transition = duration
      ? `transform ${duration}ms cubic-bezier(.12,.72,.22,1) ${delay}s`
      : 'none';
    el.style.transform = `rotateX(${bx + spins.current.x}deg) rotateY(${by + spins.current.y}deg)`;
  };

  const tumble = () => {
    const turns = () => (2 + Math.floor(Math.random() * 2)) * 360 * (Math.random() < 0.5 ? -1 : 1);
    spins.current = { x: spins.current.x + turns(), y: spins.current.y + turns() };
    setRotation(1100);
    hop.current?.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: `translateY(${-size * 0.55}px) scale(1.12)`, offset: 0.28 },
        { transform: 'translateY(0) scale(0.96)', offset: 0.6 },
        { transform: `translateY(${-size * 0.12}px) scale(1.02)`, offset: 0.78 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: 1000, delay: delay * 1000, easing: 'ease-out' },
    );
    if (sound) window.setTimeout(() => playRoll(), delay * 1000);
  };

  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (tumbleOnMount) {
        // Start from a random orientation without transition, then tumble to the value.
        const el = cube.current;
        if (el) {
          el.style.transition = 'none';
          el.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`;
          void el.offsetWidth;
        }
        tumble();
      } else setRotation(0);
      return;
    }
    if (rolls !== lastRolls.current) {
      lastRolls.current = rolls;
      tumble();
    } else setRotation(450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rolls]);

  const style = {
    '--die-size': `${size}px`,
    '--die-color': color,
    '--die-pip': pip,
  } as CSSProperties;

  return (
    <div className={`die3d ${className}`} style={style} title={title} onClick={onClick}>
      <div className="die3d-shadow" />
      <div className="die3d-hop" ref={hop}>
        <div className="die3d-cube" ref={cube}>
          {FACES.map((f) => (
            <div key={f.n} className={`die3d-face ${f.cls}`}>
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={PIPS[f.n].includes(i) ? 'pip on' : 'pip'} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
