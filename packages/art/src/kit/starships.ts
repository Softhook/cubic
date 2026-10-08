import { hsl, n, type Fragment } from '../svg';

/**
 * The six ship classes as white line drawings seen from above, nose up, and the die face each one
 * lives on. The die's pips are part of the drawing: the centre pip of 1, 3 and 5 is the ship's core,
 * the others sit in the corners and at the sides, clear of the hull.
 *
 * Ships are drawn in unit space (nose at y = −1, tail at y = 1) as outlines only: one silhouette per
 * part, so no line shows through another, and nothing drawn inside.
 */

type Pt = [number, number];

const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
const flip = (pts: Pt[]) => pts.map(([x, y]): Pt => [-x, y]);
/** A symmetric outline from its right half (top to bottom, from and back to the centre line). */
const sym = (right: Pt[]) => poly([...right, ...flip(right).reverse().filter(([x]) => x !== 0)]);
/** Lines, as one path: each pair of points is a segment. */
const segs = (pts: Pt[]) => pts.map(([x, y], i) => `${i % 2 ? 'L' : 'M'}${n(x)} ${n(y)}`).join('');
/** A segment and its mirror image. */
const both = (x1: number, y1: number, x2: number, y2: number) => segs([[x1, y1], [x2, y2], [-x1, y1], [-x2, y2]]);

/** 1 · A ringed fortress, a gun facing each way it can strike. */
const battlestation = () => [
  `<circle r=".74"/>`,
  segs([[0, -0.74], [0, -1], [0.74, 0], [1, 0], [0, 0.74], [0, 1], [-0.74, 0], [-1, 0]]),
];

/** 2 · A carrier with a ship on its flight deck. */
const flagship = () => [
  sym([[0, -1], [0.14, -0.84], [0.2, -0.3], [0.4, 0.12], [0.44, 0.56], [0.26, 0.64], [0.22, 0.88], [0, 0.88]]),
];

/** 3 · Twin prongs and a gun deck. */
const destroyer = () => [
  sym([[0, -0.52], [0.07, -0.62], [0.12, -1], [0.2, -0.94], [0.24, -0.48], [0.44, 0.34], [0.5, 0.62], [0.3, 0.6], [0.24, 0.84], [0, 0.84]]),
];

/** 4 · A core hull and two outrigger pods: a little of everything. */
const frigate = () => [
  sym([[0, -1], [0.11, -0.84], [0.16, -0.4], [0.17, 0.7], [0.1, 0.86], [0, 0.86]]),
  ...[-0.5, 0.5].map((x) => poly(([[0, -0.56], [0.09, -0.44], [0.09, 0.44], [0, 0.52], [-0.09, 0.44], [-0.09, -0.44]] as Pt[]).map(([px, py]): Pt => [px + x, py]))),
  both(0.17, 0.02, 0.41, 0.02),
];

/** 5 · A dart with wings swept along the diagonals, its core in the middle. */
const interceptor = () => [
  // A pod in the middle of the hull holds the die's centre pip.
  sym([[0, -1], [0.07, -0.7], [0.13, -0.38], [0.26, -0.14], [0.3, 0.04], [0.64, 0.46], [0.64, 0.64], [0.26, 0.38], [0.14, 0.54], [0.08, 0.74], [0, 0.72]]),
];

/** 6 · A needle with sensor booms and fins. */
const scout = () => [
  sym([[0, -1], [0.05, -0.74], [0.09, -0.2], [0.12, 0.24], [0.3, 0.46], [0.3, 0.6], [0.13, 0.56], [0.12, 0.66], [0, 0.7]]),
  both(0.04, -0.56, 0.26, -0.88),
];

const CLASSES: Record<number, () => string[]> = { 1: battlestation, 2: flagship, 3: destroyer, 4: frigate, 5: interceptor, 6: scout };

/** A ship of class `value` (1–6) as a white outline centred on (cx, cy), `size` mm from nose to tail, lines `line` mm wide. */
export function starship(value: number, cx: number, cy: number, size: number, line = 0.18): string {
  const k = size / 2;
  const parts = CLASSES[value]().map((p) => (p.startsWith('<') ? p : `<path d="${p}"/>`));
  return (
    `<g transform="translate(${n(cx)} ${n(cy)}) scale(${n(k)})" fill="none" stroke="#fff" stroke-width="${n(line / k)}" stroke-linejoin="round" stroke-linecap="round">` +
    parts.join('') +
    `</g>`
  );
}

/** Where a die's pips sit, as fractions of the face from its centre: far enough out to clear the ship. */
const P = 0.33;
const PIP_SPOTS: Record<number, Pt[]> = {
  1: [[0, 0]],
  2: [[-P, -P], [P, P]],
  3: [[-P, -P], [0, 0], [P, P]],
  4: [[-P, -P], [P, -P], [-P, P], [P, P]],
  5: [[-P, -P], [P, -P], [0, 0], [-P, P], [P, P]],
  6: [[-P, -P], [P, -P], [-P, 0], [P, 0], [-P, P], [P, P]],
};

/**
 * A ship on its die face: a rounded square `size` mm across, the ship in the middle and the value's
 * pips around it in the accent colour. A centre pip is the ship's core, so it is drawn over the hull.
 */
export function shipDie(id: string, value: number, cx: number, cy: number, size: number, hue: number): Fragment {
  const r = size * 0.08;
  const pips = PIP_SPOTS[value]
    .map(([x, y]) => {
      const px = cx + x * size;
      const py = cy + y * size;
      return `<circle cx="${n(px)}" cy="${n(py)}" r="${n(r * 1.8)}" fill="url(#${id}-glow)"/><circle cx="${n(px)}" cy="${n(py)}" r="${n(r)}" fill="${hsl(hue, 100, 70)}"/>`;
    })
    .join('');
  // The Battlestation is round, so it is drawn smaller to sit inside the corners.
  const ship = starship(value, cx, cy, size * (value === 1 ? 0.64 : 0.78));
  const box = `x="${n(cx - size / 2)}" y="${n(cy - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.16)}"`;
  return {
    defs:
      // A slight blur, so the outline reads as a soft hologram rather than a hard line.
      `<filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".12"/></filter>` +
      `<radialGradient id="${id}-glow"><stop offset="0" stop-color="${hsl(hue, 100, 65)}" stop-opacity=".6"/><stop offset="1" stop-color="${hsl(hue, 100, 65)}" stop-opacity="0"/></radialGradient>`,
    body: `<rect ${box} fill="${hsl(228, 32, 14)}"/><rect ${box} fill="none" stroke="${hsl(hue, 70, 60)}" stroke-width="${n(size * 0.012)}" stroke-opacity=".5"/>` + `<g filter="url(#${id}-soft)" opacity=".82">${ship}</g>` + pips,
  };
}
