import { hsl, n, type Fragment } from '../svg';

/**
 * The six ship classes as flat, two-tone starships seen from above, nose up, and the die face each
 * one lives on. The die's pips are part of the drawing: the centre pip of 1, 3 and 5 is the ship's
 * glowing core, the others sit in the corners and at the sides, clear of the hull.
 *
 * Ships are drawn in unit space (nose at y = −1, tail at y = 1), lit from the left: the left half of
 * every hull is the light tone, the right half the shade.
 */

type Pt = [number, number];

const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
const flip = (pts: Pt[]) => pts.map(([x, y]): Pt => [-x, y]);

const LIGHT = hsl(214, 22, 90);
const SHADE = hsl(220, 16, 64);
const DARK = hsl(226, 30, 22);

/**
 * A symmetric hull from its right half (top to bottom, from and back to the centre line): the whole
 * outline in the shade, the left half over it in the light tone.
 */
const hull = (right: Pt[]) => {
  const left = flip(right);
  const whole = [...right, ...[...left].reverse().filter(([x]) => x !== 0)];
  return `<path d="${poly(whole)}" fill="${SHADE}"/><path d="${poly(left)}" fill="${LIGHT}"/>`;
};
/** A shape and its mirror image, each lit from the left. */
const pair = (right: Pt[]) => `<path d="${poly(right)}" fill="${SHADE}"/><path d="${poly(flip(right))}" fill="${LIGHT}"/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, r = 0) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ''} fill="${fill}"/>`;
const accent = (hue: number) => hsl(hue, 95, 62);
const stripe = (hue: number, x1: number, y1: number, x2: number, y2: number) =>
  [1, -1].map((s) => `<path d="M${n(s * x1)} ${n(y1)}L${n(s * x2)} ${n(y2)}" stroke="${accent(hue)}" stroke-width=".06" stroke-linecap="round"/>`).join('');
/** A small engine flame below (x, y), in the player's colour. */
const flame = (hue: number, x: number, y: number, w: number, len: number) =>
  `<path d="M${n(x - w / 2)} ${n(y)}L${n(x + w / 2)} ${n(y)}L${n(x)} ${n(y + len)}Z" fill="${accent(hue)}"/>`;

/** 1 · A ringed fortress with a gun facing each way it can strike. */
function battlestation(): string {
  let out = '';
  for (const a of [45, 135, 225, 315]) out += `<g transform="rotate(${a})">${rect(-0.06, -0.78, 0.12, 0.4, SHADE)}</g>`;
  out += `<circle r=".74" fill="none" stroke="${SHADE}" stroke-width=".16"/><path d="M0 -.74A.74 .74 0 0 0 0 .74" fill="none" stroke="${LIGHT}" stroke-width=".16"/>`;
  for (const a of [0, 90, 180, 270]) out += `<g transform="rotate(${a})">${rect(-0.03, -1, 0.06, 0.2, LIGHT)}${rect(-0.13, -0.86, 0.26, 0.2, a === 90 || a === 180 ? SHADE : LIGHT, 0.04)}</g>`;
  return out + `<circle r=".42" fill="${SHADE}"/><path d="M0 -.42A.42 .42 0 0 0 0 .42Z" fill="${LIGHT}"/><circle r=".27" fill="${DARK}"/>`;
}

/** 2 · A carrier with a ship on its flight deck. */
function flagship(h: number): string {
  return (
    flame(h, -0.13, 0.86, 0.14, 0.16) + flame(h, 0.13, 0.86, 0.14, 0.16) +
    hull([[0, -1], [0.14, -0.84], [0.2, -0.3], [0.4, 0.12], [0.44, 0.56], [0.26, 0.64], [0.22, 0.88], [0, 0.88]]) +
    rect(-0.08, -0.66, 0.16, 1.36, DARK, 0.05) +
    `<path d="M0 -.58L.1 -.26L0 -.32L-.1 -.26Z" fill="${accent(h)}"/>` +
    stripe(h, 0.3, 0.2, 0.36, 0.48)
  );
}

/** 3 · Twin prongs and a gun deck. */
function destroyer(h: number): string {
  return (
    flame(h, -0.13, 0.84, 0.13, 0.2) + flame(h, 0.13, 0.84, 0.13, 0.2) +
    hull([[0, -0.52], [0.07, -0.62], [0.12, -1], [0.2, -0.94], [0.24, -0.48], [0.44, 0.34], [0.5, 0.62], [0.3, 0.6], [0.24, 0.84], [0, 0.84]]) +
    rect(-0.05, -0.44, 0.1, 0.28, DARK, 0.03) + rect(-0.05, 0.22, 0.1, 0.44, DARK, 0.03) +
    stripe(h, 0.3, 0.28, 0.43, 0.5)
  );
}

/** 4 · A core hull and two outrigger pods: a little of everything. */
function frigate(h: number): string {
  const pod = (x: number) =>
    `<g transform="translate(${n(x)} 0)">${hull([[0, -0.56], [0.09, -0.44], [0.09, 0.44], [0, 0.52]])}${rect(-0.04, -0.48, 0.08, 0.1, accent(h), 0.03)}</g>` + flame(h, x, 0.5, 0.1, 0.16);
  return (
    flame(h, 0, 0.86, 0.14, 0.2) +
    pair([[0.12, -0.05], [0.42, -0.05], [0.42, 0.07], [0.12, 0.07]]) +
    pod(-0.5) + pod(0.5) +
    hull([[0, -1], [0.11, -0.84], [0.16, -0.4], [0.17, 0.7], [0.1, 0.86], [0, 0.86]]) +
    rect(-0.04, -0.7, 0.08, 0.34, DARK, 0.03)
  );
}

/** 5 · A dart with wings swept along the diagonals. */
function interceptor(h: number): string {
  return (
    flame(h, -0.07, 0.72, 0.1, 0.24) + flame(h, 0.07, 0.72, 0.1, 0.24) +
    pair([[0.1, -0.06], [0.66, 0.5], [0.66, 0.66], [0.1, 0.42]]) +
    stripe(h, 0.22, 0.1, 0.58, 0.46) +
    hull([[0, -1], [0.07, -0.74], [0.12, -0.2], [0.13, 0.5], [0.08, 0.74], [0, 0.72]]) +
    `<ellipse cy="-.56" rx=".045" ry=".14" fill="${DARK}"/>`
  );
}

/** 6 · A needle with sensor booms and one big engine. */
function scout(h: number): string {
  return (
    flame(h, 0, 0.7, 0.16, 0.32) +
    `<path d="M.04 -.56L.26 -.88M-.04 -.56L-.26 -.88" stroke="${SHADE}" stroke-width=".05" stroke-linecap="round"/>` +
    pair([[0.1, 0.24], [0.3, 0.46], [0.3, 0.6], [0.14, 0.56]]) +
    hull([[0, -1], [0.05, -0.74], [0.09, -0.2], [0.12, 0.3], [0.12, 0.66], [0, 0.7]]) +
    `<circle cy="-.2" r=".055" fill="${DARK}"/>`
  );
}

const CLASSES: Record<number, (hue: number) => string> = { 1: battlestation, 2: flagship, 3: destroyer, 4: frigate, 5: interceptor, 6: scout };

/** A ship of class `value` (1–6) centred on (cx, cy), `size` mm from nose to tail, accents in `hue`. */
export function starship(value: number, cx: number, cy: number, size: number, hue: number): string {
  return `<g transform="translate(${n(cx)} ${n(cy)}) scale(${n(size / 2)})">${CLASSES[value](hue)}</g>`;
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
 * pips around it in the player's colour. A centre pip is the ship's core, so it is drawn over the hull.
 */
export function shipDie(id: string, value: number, cx: number, cy: number, size: number, hue: number): Fragment {
  const r = size * 0.04;
  const pips = PIP_SPOTS[value]
    .map(([x, y]) => {
      const px = cx + x * size;
      const py = cy + y * size;
      return `<circle cx="${n(px)}" cy="${n(py)}" r="${n(r * 2.2)}" fill="url(#${id}-glow)"/><circle cx="${n(px)}" cy="${n(py)}" r="${n(r)}" fill="${hsl(hue, 100, 70)}"/>`;
    })
    .join('');
  // The Battlestation is round, so it is drawn smaller to sit inside the corners.
  const ship = starship(value, cx, cy, size * (value === 1 ? 0.58 : 0.7), hue);
  const box = `x="${n(cx - size / 2)}" y="${n(cy - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.16)}"`;
  return {
    defs: `<radialGradient id="${id}-glow"><stop offset="0" stop-color="${hsl(hue, 100, 65)}" stop-opacity=".6"/><stop offset="1" stop-color="${hsl(hue, 100, 65)}" stop-opacity="0"/></radialGradient>`,
    body: `<rect ${box} fill="${hsl(228, 32, 14)}"/><rect ${box} fill="none" stroke="${hsl(hue, 70, 60)}" stroke-width="${n(size * 0.012)}" stroke-opacity=".5"/>` + ship + pips,
  };
}
