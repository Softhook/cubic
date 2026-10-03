import { rng } from './rng';
import { planet } from './planet';
import { starfield, type Box } from './starfield';
import { CUBE_PAD, PLANET_DIAMETER, PLANET_FAMILY, TILE } from './tokens';
import { document, hsl, join, n, type Fragment } from './svg';
import type { TileSpec } from './tileset';

export interface TileOptions {
  /** Include the 3 mm print bleed around the trim. */
  bleed?: boolean;
  /** Print markings: space pads, number badge and cube pads. The game draws its own instead. */
  markings?: boolean;
  /** Round the corners (for on-screen use; print uses the die-cut). */
  rounded?: boolean;
  /** Prefix for ids; defaults to the tile id. */
  idPrefix?: string;
}

const CELL_CENTRES = [0, 1, 2].map((i) => (i + 0.5) * TILE.cell);
const MID = TILE.size / 2;

/** Bright stars go in the gutters between spaces and away from the planet. */
function inGutter(x: number, y: number): boolean {
  if (Math.hypot(x - MID, y - MID) < 24) return false;
  const near = Math.min(...CELL_CENTRES.flatMap((cx) => CELL_CENTRES.map((cy) => Math.max(Math.abs(x - cx), Math.abs(y - cy)))));
  return near > TILE.pad / 2 - 2;
}

/** Where the cube pads go on a planet: a cluster just below the centre. Coordinates are pad centres. */
export function cubePadCentres(capacity: number, cx: number, cy: number): { x: number; y: number }[] {
  const step = CUBE_PAD.size + CUBE_PAD.gap;
  const h = step / 2;
  switch (capacity) {
    case 1:
      return [{ x: cx, y: cy + 3 }];
    case 2:
      return [{ x: cx - h, y: cy + 3 }, { x: cx + h, y: cy + 3 }];
    case 3:
      return [{ x: cx - h, y: cy + 2 - h }, { x: cx + h, y: cy + 2 - h }, { x: cx, y: cy + 2 + h }];
    default:
      return [
        { x: cx - h, y: cy + 2 - h },
        { x: cx + h, y: cy + 2 - h },
        { x: cx - h, y: cy + 2 + h },
        { x: cx + h, y: cy + 2 + h },
      ];
  }
}

function markings(spec: TileSpec): Fragment {
  let body = '';
  CELL_CENTRES.forEach((x) =>
    CELL_CENTRES.forEach((y) => {
      if (spec.number > 0 && x === MID && y === MID) return;
      const p = TILE.pad;
      body += `<rect x="${n(x - p / 2)}" y="${n(y - p / 2)}" width="${p}" height="${p}" rx="4" fill="#fff" fill-opacity=".03" stroke="${hsl(222, 80, 82)}" stroke-opacity=".3" stroke-width=".3"/>`;
    }),
  );
  if (spec.number > 0) {
    const R = PLANET_DIAMETER[spec.number] / 2;
    const pads = cubePadCentres(spec.number - 6, MID, MID);
    const s = CUBE_PAD.size;
    for (const p of pads) {
      body += `<rect x="${n(p.x - s / 2)}" y="${n(p.y - s / 2)}" width="${s}" height="${s}" rx="1.6" fill="#000" fill-opacity=".42" stroke="#fff" stroke-opacity=".75" stroke-width=".3"/>`;
    }
    // The number badge sits between the planet's top edge and the cubes, so cubes never cover it.
    const top = MID - R;
    const padsTop = Math.min(...pads.map((p) => p.y)) - s / 2;
    const br = Math.min(4.5, (padsTop - top) / 2 - 0.3);
    const by = (top + padsTop) / 2;
    const hue = PLANET_FAMILY[spec.number].hue;
    body +=
      `<circle cx="${MID}" cy="${n(by)}" r="${n(br)}" fill="${hsl(hue, 40, 8)}" fill-opacity=".85" stroke="${hsl(hue, 85, 70)}" stroke-width=".35"/>` +
      `<text x="${MID}" y="${n(by)}" fill="#fff" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="${n(br * 1.25)}" text-anchor="middle" dominant-baseline="central">${spec.number}</text>`;
  }
  return { defs: '', body };
}

/** The Void tile: a violet nebula pulled into a dark rift. */
function rift(id: string): Fragment {
  const r = rng(`${id}:rift`);
  let arms = '';
  const count = r.int(3, 5);
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * Math.PI * 2 + r.range(-0.3, 0.3);
    const pts: string[] = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const rad = 8 + t * 34;
      const a = a0 + t * 2.6;
      pts.push(`${n(MID + Math.cos(a) * rad)},${n(MID + Math.sin(a) * rad)}`);
    }
    arms += `<polyline points="${pts.join(' ')}" fill="none" stroke="${hsl(290, 90, 72)}" stroke-width="${n(r.range(1.2, 3))}" stroke-opacity="${n(r.range(0.15, 0.35))}" stroke-linecap="round"/>`;
  }
  return {
    defs:
      `<filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4"/></filter>` +
      `<radialGradient id="${id}-core"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#05010d" stop-opacity=".95"/><stop offset="1" stop-color="#05010d" stop-opacity="0"/></radialGradient>`,
    body:
      `<g filter="url(#${id}-soft)">${arms}<circle cx="${MID}" cy="${MID}" r="10" fill="none" stroke="${hsl(285, 95, 75)}" stroke-width="1.4" stroke-opacity=".8"/></g>` +
      `<circle cx="${MID}" cy="${MID}" r="16" fill="url(#${id}-core)"/>`,
  };
}

/** One map tile (trim 96 × 96 mm) as a standalone SVG document. */
export function tileSvg(spec: TileSpec, o: TileOptions = {}): string {
  const id = o.idPrefix ?? spec.id;
  const b = o.bleed ? TILE.bleed : 0;
  const frame: Box = { x: 0, y: 0, w: TILE.size, h: TILE.size };
  const area: Box = { x: -b, y: -b, w: TILE.size + 2 * b, h: TILE.size + 2 * b };
  const art = rng(spec.seed);
  const isVoid = spec.number === 0;

  const parts: Fragment[] = [
    starfield({
      rng: art.fork('sky'),
      id: `${id}-sky`,
      area,
      frame,
      brightAllowed: inGutter,
      ...(isVoid ? { hues: [285, 320] as [number, number], nebula: 1 } : {}),
    }),
  ];
  if (isVoid) parts.push(rift(id));
  else {
    parts.push(
      planet({
        rng: art.fork('planet'),
        id: `${id}-planet`,
        cx: MID,
        cy: MID,
        r: PLANET_DIAMETER[spec.number] / 2,
        number: spec.number,
        type: spec.type ?? PLANET_FAMILY[spec.number].types[0],
        rings: spec.rings,
      }),
    );
  }
  if (o.markings) parts.push(markings(spec));

  let all = join(...parts);
  if (o.rounded) {
    all = {
      defs: all.defs + `<clipPath id="${id}-corners"><rect width="${TILE.size}" height="${TILE.size}" rx="4"/></clipPath>`,
      body: `<g clip-path="url(#${id}-corners)">${all.body}</g>`,
    };
  }
  return document(all, area);
}
