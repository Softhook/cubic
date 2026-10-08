import { rng } from './rng';
import { planet } from './planet';
import { starfield, type Box } from './starfield';
import { CUBE_PAD, LABEL_TEXT, NUMBER_TEXT, PLANET_DIAMETER, PLANET_FAMILY, TILE, VOID_NEBULA_HUES, type PlanetType } from './tokens';
import { planetFlavour, type PlanetFlavour } from './flavour';
import { dieCut, document, hex, hsl, join, n, type Fragment } from './svg';
import type { TileSpec } from './tileset';

export interface TileOptions {
  /** Include the 3 mm print bleed around the trim. */
  bleed?: boolean;
  /**
   * Print markings: space pads, number badge and cube pads. `'spaces'` draws only the space pads and
   * their hatching, for the game, which draws the number and cube pads itself (they change in play).
   */
  markings?: boolean | 'spaces';
  /** Round the corners (for on-screen use; print uses the die-cut). */
  rounded?: boolean;
  /** Prefix for ids; defaults to the tile id. */
  idPrefix?: string;
  /** Draw only the painted art (no markings) or only the markings (no art). Default: both. */
  only?: 'art' | 'markings';
}

const CELL_CENTRES = [0, 1, 2].map((i) => (i + 0.5) * TILE.cell);
const MID = TILE.size / 2;

/**
 * Where the four spaces meet at the planet's top left and bottom right: clear of dice, so the label
 * and the number go there.
 */
const CORNER = TILE.cell / 2;

/** The flavour label's area, with a little margin: right aligned at the top-left corner, 8 mm tall. */
const inLabel = (x: number, y: number) => x < MID - CORNER - 1 && x > 4 && Math.abs(y - (MID - CORNER)) < 4.2;

/** Bright stars go in the gutters between spaces, away from the planet, its number and its label. */
function inGutter(x: number, y: number): boolean {
  if (Math.hypot(x - MID, y - MID) < 24) return false;
  if (Math.abs(x - (MID + CORNER)) < 11 && Math.abs(y - (MID + CORNER)) < 9) return false;
  if (x < MID - CORNER + 3 && Math.abs(y - (MID - CORNER)) < 6) return false;
  const near = Math.min(...CELL_CENTRES.flatMap((cx) => CELL_CENTRES.map((cy) => Math.max(Math.abs(x - cx), Math.abs(y - cy)))));
  return near > TILE.pad / 2 - 2;
}

/** Where the cube pads go on a planet: a cluster centred on it. Coordinates are pad centres. */
export function cubePadCentres(capacity: number, cx: number, cy: number): { x: number; y: number }[] {
  const h = (CUBE_PAD.size + CUBE_PAD.gap) / 2;
  switch (capacity) {
    case 1:
      return [{ x: cx, y: cy }];
    case 2:
      return [{ x: cx - h, y: cy }, { x: cx + h, y: cy }];
    case 3:
      return [{ x: cx - h, y: cy - h }, { x: cx + h, y: cy - h }, { x: cx, y: cy + h }];
    default:
      return [
        { x: cx - h, y: cy - h },
        { x: cx + h, y: cy - h },
        { x: cx - h, y: cy + h },
        { x: cx + h, y: cy + h },
      ];
  }
}

/** Gap between a box (centre, half-width, half-height) and a square (centre, half-size); 0 if they overlap. */
function boxGap(cx: number, cy: number, hw: number, hh: number, x: number, y: number, h: number): number {
  return Math.hypot(Math.max(0, Math.abs(cx - x) - hw - h), Math.max(0, Math.abs(cy - y) - hh - h));
}

/** Where the planet number goes and how big it is. Offsets are from the planet's centre (mm). */
export interface NumberPlacement {
  x: number;
  y: number;
  size: number;
  /** Half the numeral's width and height: the box checked against the cube pads and dice. */
  halfW: number;
  halfH: number;
}

/**
 * The number is centred where the four spaces meet at the planet's bottom right, clear of the dice
 * and away from the planet. If it would touch a cube pad (the 10's four fill the middle), it moves
 * further out along the same diagonal until it is clear.
 */
export function numberPlacement(number: number): NumberPlacement {
  const digits = String(number).length;
  const size = digits > 1 ? NUMBER_TEXT.sizeTwoDigits : NUMBER_TEXT.size;
  const halfW = 0.32 * size * digits;
  const halfH = 0.37 * size;
  const pads = cubePadCentres(number - 6, 0, 0);
  let d = CORNER;
  while (pads.some((p) => boxGap(d, d, halfW, halfH, p.x, p.y, CUBE_PAD.size / 2) < 0.8)) d += 0.05;
  return { x: d, y: d, size, halfW, halfH };
}

/** Gap between hatch lines and their inset from the pad's edge, inside its rounded corners (mm). */
const HATCH = { gap: 3, inset: 1.5 };

/**
 * Diagonal hatching across the pad centred on (cx, cy): plain line segments, clipped by hand to a
 * square inset from the pad, so they stay editable vectors without a clip path.
 */
function hatch(cx: number, cy: number): string {
  const h = TILE.pad / 2 - HATCH.inset;
  let out = '';
  // Lines u + v = c across the square |u|, |v| ≤ h (u right, v down from the centre): bottom left to top right.
  for (let c = -2 * h + HATCH.gap; c < 2 * h - 0.01; c += HATCH.gap) {
    const u1 = Math.max(-h, c - h);
    const u2 = Math.min(h, c + h);
    out += `<line x1="${n(cx + u1)}" y1="${n(cy + c - u1)}" x2="${n(cx + u2)}" y2="${n(cy + c - u2)}" stroke="${hex(222, 80, 82)}" stroke-opacity=".3" stroke-width=".3"/>`;
  }
  return out;
}

/**
 * Print markings. Plain SVG only (hex colours, no `paint-order` or `dominant-baseline`), so they import
 * into Illustrator as editable vectors.
 */
function markings(spec: TileSpec, spacesOnly = false): Fragment {
  let body = '';
  CELL_CENTRES.forEach((x) =>
    CELL_CENTRES.forEach((y) => {
      if (spec.number > 0 && x === MID && y === MID) return;
      const p = TILE.pad;
      body += `<rect x="${n(x - p / 2)}" y="${n(y - p / 2)}" width="${p}" height="${p}" rx="4" fill="#fff" fill-opacity=".03" stroke="${hex(222, 80, 82)}" stroke-opacity=".3" stroke-width=".3"/>`;
      // The four spaces beside a planet are where dice go to conquer it: faint diagonal hatching marks them.
      if (spec.number > 0 && (x === MID) !== (y === MID)) body += hatch(x, y);
    }),
  );
  if (spec.number > 0 && !spacesOnly) {
    const s = CUBE_PAD.size;
    for (const p of cubePadCentres(spec.number - 6, MID, MID)) {
      body += `<rect x="${n(p.x - s / 2)}" y="${n(p.y - s / 2)}" width="${s}" height="${s}" rx="1.6" fill="#000" fill-opacity=".42" stroke="#fff" stroke-opacity=".75" stroke-width=".3"/>`;
    }
    const at = numberPlacement(spec.number);
    const hue = PLANET_FAMILY[spec.number].hue;
    // White with a dark outline reads on any planet surface and on the space around it. The outline
    // is a second copy underneath; the baseline sits 0.4 em below the centre so the digits are centred.
    const text = (paint: string) =>
      `<text x="${n(MID + at.x)}" y="${n(MID + at.y + at.size * 0.4)}" ${paint} font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="${n(at.size)}" letter-spacing="${n(-0.03 * at.size)}" text-anchor="middle">${spec.number}</text>`;
    body += text(`fill="none" stroke="${hex(hue, 50, 7)}" stroke-width="${n(at.size * 0.13)}" stroke-linejoin="round"`) + text(`fill="#fff"`);
  }
  return { defs: '', body };
}

/** The made-up name and survey data printed beside a tile's planet. */
export function tileFlavour(spec: TileSpec): PlanetFlavour {
  const type: PlanetType = spec.type ?? PLANET_FAMILY[spec.number].types[0];
  return planetFlavour(rng(spec.seed).fork('name'), type, spec.number);
}

/**
 * The planet's flavour label: a made-up name, catalogue number and survey data in tiny type, right
 * aligned where the spaces meet at the planet's top left, with a thin leader line to the planet.
 */
function label(spec: TileSpec): Fragment {
  const fl = tileFlavour(spec);
  const r = PLANET_DIAMETER[spec.number] / 2;
  const right = MID - CORNER - 1.6;
  // The four lines fit the 8 mm strip between the space pads above and below (pads end 4 mm from
  // the corner), with 0.5 mm to spare: name caps from -3.5, last baseline at +3.2.
  const top = MID - CORNER;
  const line = (y: number, size: number, text: string, extra: string) =>
    `<text x="${n(right)}" y="${n(y)}" font-family="${LABEL_TEXT.font}" font-size="${size}" text-anchor="end" ${extra}>${text}</text>`;
  const tip = MID - (r + 0.8) / Math.SQRT2;
  const start = MID - CORNER - 0.9;
  return {
    defs: '',
    body:
      line(top - 2.25, LABEL_TEXT.name, fl.name.toUpperCase(), `font-weight="700" letter-spacing=".35" fill="#e6eeff" fill-opacity=".75"`) +
      [fl.designation, fl.cls, fl.data]
        .map((t, i) => line(top - 0.3 + i * 1.75, LABEL_TEXT.line, t, `letter-spacing=".04" fill="#c7d6ff" fill-opacity=".55"`))
        .join('') +
      (tip > start
        ? `<line x1="${n(start)}" y1="${n(start)}" x2="${n(tip)}" y2="${n(tip)}" stroke="#c7d6ff" stroke-opacity=".45" stroke-width=".12"/>` +
          `<circle cx="${n(tip)}" cy="${n(tip)}" r=".35" fill="#c7d6ff" fill-opacity=".7"/>`
        : ''),
  };
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

  const marks = () => markings(spec, o.markings === 'spaces');
  if (o.only === 'markings') return document(marks(), area);
  const parts: Fragment[] = [
    starfield({
      rng: art.fork('sky'),
      id: `${id}-sky`,
      area,
      frame,
      brightAllowed: inGutter,
      ...(isVoid ? {} : { faintAllowed: (x: number, y: number) => !inLabel(x, y) }),
      ...(isVoid ? { hues: VOID_NEBULA_HUES, nebula: 1 } : {}),
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
  if (!isVoid && o.only !== 'art') parts.push(label(spec));
  if (o.markings && o.only !== 'art') parts.push(marks());

  const all = join(...parts);
  return document(o.rounded ? dieCut(all, id, TILE.size, TILE.size, TILE.corner) : all, area);
}

/**
 * A tile for Illustrator and other editors that can't render SVG filters: the painted art as an embedded
 * bitmap (pass a PNG data URL of `tileSvg(spec, { only: 'art', bleed })`), with the markings on top as
 * vectors. Each sits in its own named group, which Illustrator opens as layers.
 */
export function editableTileSvg(spec: TileSpec, artPng: string, o: Pick<TileOptions, 'bleed' | 'markings'> = {}): string {
  const b = o.bleed ? TILE.bleed : 0;
  const w = TILE.size + 2 * b;
  const area: Box = { x: -b, y: -b, w, h: w };
  const marks = o.markings ? markings(spec, o.markings === 'spaces') : { defs: '', body: '' };
  const flavour = spec.number > 0 ? label(spec).body : '';
  return document(
    {
      defs: marks.defs,
      body:
        `<g id="art"><image x="${n(-b)}" y="${n(-b)}" width="${n(w)}" height="${n(w)}" preserveAspectRatio="none" href="${artPng}" xlink:href="${artPng}"/></g>` +
        `<g id="label">${flavour}</g>` +
        `<g id="markings">${marks.body}</g>`,
    },
    area,
  ).replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
}
