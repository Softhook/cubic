import { CUBE_PAD, FONTS, PLANET_FAMILY, TILE, WELL, type WellStyle } from '../tokens';
import { icon } from '../icons';
import { hex, n, type Fragment } from '../svg';
import {
  HEX_WELL,
  MID,
  TILE_SPOTS,
  cubePadCentres,
  hexCorners,
  numberCorner,
  numberPlacement,
  type Spot,
  type TileShape,
} from './geometry';
import type { TileSpec } from './set';

/**
 * A tile's print markings: the spaces as wells etched into it, and the planet's cube pads and number. Plain
 * vectors, so they stay editable in Illustrator; the game draws its spaces and empty cube slots with them too.
 */

/** The research flask on each Void space (mm). */
const VOID_ICON = 8;

/** The faint research flask on a Void space centred on (x, y): ships there gain Research. */
export const voidFlask = (x: number, y: number) =>
  `<g stroke-opacity=".15">${icon('research', x, y, VOID_ICON, HATCH.ink, (0.3 * 24) / VOID_ICON)}</g>`;

/**
 * The edges of a well: a rounded square of side `size` with its top left at (x, y), sunk into the
 * tile. Light comes from the top left, so the top and left inner edges are in shade and the bottom and
 * right ones catch the light. Path data for each, inset to sit inside the well's outline.
 */
function wellEdges(x: number, y: number, size: number, rx: number): { shade: string; lit: string } {
  const a = 0.4;
  const b = size - 0.3;
  return {
    shade: `M${n(x + a)} ${n(y + size - rx)}V${n(y + rx)}Q${n(x + a)} ${n(y + a)} ${n(x + rx)} ${n(y + a)}H${n(x + size - rx)}`,
    lit: `M${n(x + b)} ${n(y + rx)}V${n(y + size - rx)}Q${n(x + b)} ${n(y + b)} ${n(x + size - rx)} ${n(y + b)}H${n(x + rx)}`,
  };
}

/**
 * The conquer spaces' hatching: the lines' gap along a pad's side and their inset from its edge, inside
 * its rounded corners (mm), and their colour.
 */
export const HATCH = { gap: 3, inset: 1.5, ink: hex(222, 80, 82) };

/**
 * Diagonal hatching across the pad centred on (cx, cy): plain line segments, clipped by hand to a
 * square inset from the pad, so they stay editable vectors without a clip path.
 */
export function hatch(cx: number, cy: number): string {
  const h = TILE.pad / 2 - HATCH.inset;
  let out = '';
  // Lines u + v = c across the square |u|, |v| ≤ h (u right, v down from the centre): bottom left to top right.
  for (let c = -2 * h + HATCH.gap; c < 2 * h - 0.01; c += HATCH.gap) {
    const u1 = Math.max(-h, c - h);
    const u2 = Math.min(h, c + h);
    out += `<line x1="${n(cx + u1)}" y1="${n(cy + c - u1)}" x2="${n(cx + u2)}" y2="${n(cy + c - u2)}" stroke="${HATCH.ink}" stroke-opacity=".14" stroke-width=".25"/>`;
  }
  return out;
}

/**
 * A hex space's well centred on (cx, cy), `size` tall: etched in as `well`, shaded along its top sides and
 * lit along its bottom ones (corners 3 to 0 are the top, as y is down).
 */
export function hexWell(cx: number, cy: number, size: number, style: WellStyle): string {
  const w = hexCorners(cx, cy, size);
  const pts = (list: Spot[]) => list.map((p) => `${n(p.x)} ${n(p.y)}`);
  return (
    `<polygon points="${pts(w).join(' ')}" fill="#000" fill-opacity="${style.fill}"/>` +
    `<path d="M${pts([w[3], w[4], w[5], w[0]]).join(' L')}" fill="none" stroke="#000" stroke-opacity="${style.shade}" stroke-width="${style.shadeWidth}"/>` +
    `<path d="M${pts([w[0], w[1], w[2], w[3]]).join(' L')}" fill="none" stroke="#fff" stroke-opacity="${style.lit}" stroke-width="${style.litWidth}"/>`
  );
}

/**
 * A well centred on (cx, cy): a dark fill with a shaded and a lit inner edge. Plain vectors, so they
 * stay editable in Illustrator; the game draws its empty cube slots with it too.
 */
export function well(cx: number, cy: number, size: number, rx: number, style: WellStyle): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const e = wellEdges(x, y, size, rx);
  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" rx="${rx}" fill="#000" fill-opacity="${style.fill}"/>` +
    `<path d="${e.shade}" fill="none" stroke="#000" stroke-opacity="${style.shade}" stroke-width="${style.shadeWidth}"/>` +
    `<path d="${e.lit}" fill="none" stroke="#fff" stroke-opacity="${style.lit}" stroke-width="${style.litWidth}"/>`
  );
}

/**
 * Print markings: each space a well etched into the tile, the ones beside a planet (where dice go to
 * conquer it) faintly hatched, and wells for the cubes on the planet with its number in the corner
 * `numberCorner` picks. The planet sits at `at` (spaces from the middle). Plain SVG only (hex colours, no
 * `paint-order` or `dominant-baseline`), so they import into Illustrator as editable vectors.
 */
export function markings(
  spec: TileSpec,
  part: 'all' | 'spaces' | 'planet' = 'all',
  shape: TileShape = 'square',
  at: Spot = { x: 0, y: 0 },
): Fragment {
  const mm = (p: Spot) => ({ x: MID + p.x * TILE.cell, y: MID + p.y * TILE.cell });
  const hasPlanet = spec.number > 0;
  let body = '';
  for (const spot of part === 'planet' ? [] : Object.values(TILE_SPOTS[shape])) {
    const away = Math.hypot(spot.x - at.x, spot.y - at.y);
    if (hasPlanet && away < 1e-6) continue;
    const { x, y } = mm(spot);
    const conquer = hasPlanet && Math.abs(away - 1) < 1e-6;
    const style = conquer ? WELL.conquer : WELL.space;
    body += shape === 'hex' ? hexWell(x, y, TILE.cell * HEX_WELL, style) : well(x, y, TILE.pad, 4, style);
    // The spaces beside a planet are where dice go to conquer it: on a square tile, very faint diagonal hatching marks them.
    if (conquer && shape === 'square') body += hatch(x, y);
    // Ships on the Void gain Research: a faint flask on each space.
    if (spec.number === 0) body += voidFlask(x, y);
  }
  if (hasPlanet && part !== 'spaces') {
    const p = mm(at);
    for (const q of cubePadCentres(spec.number - 6, p.x, p.y)) body += well(q.x, q.y, CUBE_PAD.size, CUBE_PAD.corner, WELL.cube);
    const num = numberPlacement(spec.number, shape);
    const k = numberCorner(at, shape);
    const hue = PLANET_FAMILY[spec.number].hue;
    // White with a dark outline reads on any planet surface and on the space around it. The outline
    // is a second copy underneath; the baseline sits 0.4 em below the centre so the digits are centred.
    const text = (paint: string) =>
      `<text x="${n(p.x + k.x * num.x)}" y="${n(p.y + k.y * num.y + num.size * 0.4)}" ${paint} font-family="${FONTS.body}" font-weight="800" font-size="${n(num.size)}" letter-spacing="${n(-0.03 * num.size)}" text-anchor="middle">${spec.number}</text>`;
    body +=
      text(`fill="none" stroke="${hex(hue, 50, 7)}" stroke-width="${n(num.size * 0.13)}" stroke-linejoin="round"`) + text(`fill="#fff"`);
  }
  return { defs: '', body };
}
