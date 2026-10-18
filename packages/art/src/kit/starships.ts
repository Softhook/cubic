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
const sym = (right: Pt[]) =>
  poly([
    ...right,
    ...flip(right)
      .reverse()
      .filter(([x]) => x !== 0),
  ]);
/** Lines, as one path: each pair of points is a segment. */
const segs = (pts: Pt[]) => pts.map(([x, y], i) => `${i % 2 ? 'L' : 'M'}${n(x)} ${n(y)}`).join('');
/** 1 · A ringed fortress, a gun facing each way it can strike. */
const battlestation = () => [
  `<circle r=".74"/>`,
  segs([
    [0, -0.74],
    [0, -1],
    [0.74, 0],
    [1, 0],
    [0, 0.74],
    [0, 1],
    [-0.74, 0],
    [-1, 0],
  ]),
];

/** 2 · A carrier with a ship on its flight deck. */
const flagship = () => [
  sym([
    [0, -1],
    [0.14, -0.84],
    [0.2, -0.3],
    [0.4, 0.12],
    [0.44, 0.56],
    [0.26, 0.64],
    [0.22, 0.88],
    [0, 0.88],
  ]),
];

/** 3 · Twin prongs and a gun deck. */
const destroyer = () => [
  sym([
    [0, -0.52],
    [0.07, -0.62],
    [0.12, -1],
    [0.2, -0.94],
    [0.24, -0.48],
    [0.44, 0.34],
    [0.5, 0.62],
    [0.3, 0.6],
    [0.24, 0.84],
    [0, 0.84],
  ]),
];

/** 4 · A cross: a hull with a beam across its middle and a blocky pod at each end, a little of everything. */
const frigate = () => [
  sym([
    [0, -1],
    [0.12, -0.8],
    [0.18, -0.3],
    [0.44, -0.2],
    [0.5, -0.38],
    [0.64, -0.38],
    [0.7, -0.22],
    [0.7, 0.3],
    [0.62, 0.44],
    [0.5, 0.44],
    [0.44, 0.24],
    [0.2, 0.3],
    [0.22, 0.74],
    [0.12, 0.88],
    [0, 0.8],
  ]),
];

/** 5 · A dart with wings swept along the diagonals, its core in the middle. */
const interceptor = () => [
  // A pod in the middle of the hull holds the die's centre pip.
  sym([
    [0, -1],
    [0.07, -0.7],
    [0.13, -0.38],
    [0.26, -0.14],
    [0.3, 0.04],
    [0.64, 0.46],
    [0.64, 0.64],
    [0.26, 0.38],
    [0.14, 0.54],
    [0.08, 0.74],
    [0, 0.72],
  ]),
];

/** 6 · A needle with small swept fins, all speed. */
const scout = () => [
  sym([
    [0, -1],
    [0.05, -0.8],
    [0.09, 0.14],
    [0.34, 0.54],
    [0.36, 0.76],
    [0.1, 0.64],
    [0.08, 0.92],
    [0, 0.88],
  ]),
];

const CLASSES: Record<number, () => string[]> = { 1: battlestation, 2: flagship, 3: destroyer, 4: frigate, 5: interceptor, 6: scout };

/** A ship of class `value` (1–6) as an outline centred on (cx, cy), `size` mm from nose to tail, lines `line` mm wide, filled with `fill`. */
function starship(value: number, cx: number, cy: number, size: number, line = 0.18, color = '#fff', fill = 'none'): string {
  const k = size / 2;
  const parts = CLASSES[value]().map((p) => (p.startsWith('<') ? p : `<path d="${p}"/>`));
  return (
    `<g transform="translate(${n(cx)} ${n(cy)}) scale(${n(k)})" fill="${fill}" stroke="${color}" stroke-width="${n(line / k)}" stroke-linejoin="round" stroke-linecap="round">` +
    parts.join('') +
    `</g>`
  );
}

/** Where a die's pips sit, as fractions of the face from its centre: far enough out to clear the ship. */
const P = 0.33;
const PIP_SPOTS: Record<number, Pt[]> = {
  1: [[0, 0]],
  2: [
    [-P, -P],
    [P, P],
  ],
  3: [
    [-P, -P],
    [0, 0],
    [P, P],
  ],
  4: [
    [-P, -P],
    [P, -P],
    [-P, P],
    [P, P],
  ],
  5: [
    [-P, -P],
    [P, -P],
    [0, 0],
    [-P, P],
    [P, P],
  ],
  6: [
    [-P, -P],
    [P, -P],
    [-P, 0],
    [P, 0],
    [-P, P],
    [P, P],
  ],
};

/**
 * A ship on its die face, as a hologram: a rounded square of dark glass with faint scan lines, lit from
 * the top left, the ship projected over it in the accent colour (a tinted hull, a glowing outline, a
 * soft beam behind) and the value's pips as lit orbs. A centre pip is the ship's core, so it is drawn
 * over the hull. Everything scales with `size`, so the die looks the same at any size.
 */
export function shipDie(id: string, value: number, cx: number, cy: number, size: number, hue: number): Fragment {
  const s = size;
  const r = s * 0.08;
  const box = (inset = 0, dy = 0) =>
    `x="${n(cx - s / 2 + inset)}" y="${n(cy - s / 2 + inset + dy)}" width="${n(s - 2 * inset)}" height="${n(s - 2 * inset)}" rx="${n(s * 0.16 - inset)}"`;
  const scan = Array.from({ length: 9 }, (_, i) => `M${n(cx - s / 2)} ${n(cy - s / 2 + (i + 0.5) * (s / 9))}h${n(s)}`).join('');
  // The Battlestation is round, so it is drawn smaller to sit inside the corners.
  const at = (line: number, color: string, fill?: string) => starship(value, cx, cy, s * (value === 1 ? 0.64 : 0.78), line, color, fill);
  const pips = PIP_SPOTS[value]
    .map(([x, y]) => {
      const p = `cx="${n(cx + x * s)}" cy="${n(cy + y * s)}"`;
      return `<circle ${p} r="${n(r * 2)}" fill="url(#${id}-halo)"/><circle ${p} r="${n(r)}" fill="url(#${id}-orb)"/>`;
    })
    .join('');
  return {
    defs:
      `<linearGradient id="${id}-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue + 30, 45, 20)}"/><stop offset="1" stop-color="${hsl(228, 50, 7)}"/></linearGradient>` +
      `<linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 100, 80)}"/><stop offset=".5" stop-color="${hsl(hue, 80, 50)}" stop-opacity=".4"/><stop offset="1" stop-color="${hsl(hue, 90, 60)}" stop-opacity=".8"/></linearGradient>` +
      `<radialGradient id="${id}-beam" cy=".62" r=".6"><stop offset="0" stop-color="${hsl(hue, 100, 60)}" stop-opacity=".45"/><stop offset="1" stop-color="${hsl(hue, 100, 60)}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="${id}-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 100, 75)}" stop-opacity=".55"/><stop offset="1" stop-color="${hsl(hue, 100, 55)}" stop-opacity=".08"/></linearGradient>` +
      `<radialGradient id="${id}-orb" cx=".4" cy=".35"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${hsl(hue, 100, 72)}"/><stop offset="1" stop-color="${hsl(hue, 100, 45)}"/></radialGradient>` +
      `<radialGradient id="${id}-halo"><stop offset="0" stop-color="${hsl(hue, 100, 65)}" stop-opacity=".7"/><stop offset="1" stop-color="${hsl(hue, 100, 65)}" stop-opacity="0"/></radialGradient>` +
      `<filter id="${id}-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${n(s * 0.025)}"/></filter>` +
      `<clipPath id="${id}-clip"><rect ${box()}/></clipPath>`,
    body:
      // A soft shadow under the die, then the glass, its scan lines and the projector's beam.
      `<rect ${box(0, s * 0.04)} fill="#000" opacity=".5" filter="url(#${id}-blur)"/>` +
      `<rect ${box()} fill="url(#${id}-face)"/>` +
      `<g clip-path="url(#${id}-clip)"><path d="${scan}" stroke="${hsl(hue, 90, 70)}" stroke-width="${n(s * 0.006)}" opacity=".12"/>` +
      `<circle cx="${n(cx)}" cy="${n(cy + s * 0.1)}" r="${n(s * 0.5)}" fill="url(#${id}-beam)"/></g>` +
      // The ship: tinted hull, a blurred glow along the outline, and a crisp near-white line on top.
      at(0, 'none', `url(#${id}-hull)`) +
      `<g filter="url(#${id}-blur)" opacity=".7">${at(s * 0.05, hsl(hue, 100, 65))}</g>` +
      at(s * 0.014, hsl(hue, 60, 92)) +
      pips +
      `<rect ${box(s * 0.01)} fill="none" stroke="url(#${id}-rim)" stroke-width="${n(s * 0.022)}"/>`,
  };
}
