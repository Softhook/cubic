import { rng } from './rng';
import { planet } from './planet';
import { starfield, type Box } from './starfield';
import {
  CUBE_PAD,
  FONTS,
  LABEL_TEXT,
  NUMBER_TEXT,
  PLANET_DIAMETER,
  PLANET_FAMILY,
  TILE,
  VOID_NEBULA_HUES,
  WELL,
  type PlanetType,
  type WellStyle,
} from './tokens';
import { planetFlavour, type PlanetFlavour } from './flavour';
import { icon } from './icons';
import { dieCut, document, gradientMask, hex, hsl, join, n, ridges, tint, turbulence, type Fragment } from './svg';
import type { TileSpec, VoidHeart } from './tileset';

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
  /** `@font-face` rules to embed, so print files set the number and label in their own fonts, not the system's. */
  fontCss?: string;
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
      return [
        { x: cx - h, y: cy },
        { x: cx + h, y: cy },
      ];
    case 3:
      return [
        { x: cx - h, y: cy - h },
        { x: cx + h, y: cy - h },
        { x: cx, y: cy + h },
      ];
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

/** The research flask on each Void space (mm). */
const VOID_ICON = 8;

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

/** Gap between hatch lines and their inset from the pad's edge, inside its rounded corners (mm). */
const HATCH = { gap: 3, inset: 1.5 };

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
    out += `<line x1="${n(cx + u1)}" y1="${n(cy + c - u1)}" x2="${n(cx + u2)}" y2="${n(cy + c - u2)}" stroke="${hex(222, 80, 82)}" stroke-opacity=".14" stroke-width=".25"/>`;
  }
  return out;
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

/** The four spaces beside a planet are a shade darker than the rest. */
const CONQUER_WELL: WellStyle = { ...WELL.space, fill: 0.24 };

/**
 * Print markings: each space a well etched into the tile, the four beside a planet (where dice go to
 * conquer it) faintly hatched, and wells for the cubes on the planet. Plain SVG only
 * (hex colours, no `paint-order` or `dominant-baseline`), so they import into Illustrator as editable vectors.
 */
function markings(spec: TileSpec, spacesOnly = false): Fragment {
  let body = '';
  CELL_CENTRES.forEach((x) =>
    CELL_CENTRES.forEach((y) => {
      if (spec.number > 0 && x === MID && y === MID) return;
      const p = TILE.pad;
      const conquer = spec.number > 0 && (x === MID) !== (y === MID);
      body += well(x, y, p, 4, conquer ? CONQUER_WELL : WELL.space);
      // The four spaces beside a planet are where dice go to conquer it: very faint diagonal hatching marks them.
      if (conquer) body += hatch(x, y);
      // Ships on the Void gain Research: a faint flask on each space.
      if (spec.number === 0)
        body += `<g stroke-opacity=".15">${icon('research', x, y, VOID_ICON, hex(222, 80, 82), (0.3 * 24) / VOID_ICON)}</g>`;
    }),
  );
  if (spec.number > 0 && !spacesOnly) {
    for (const p of cubePadCentres(spec.number - 6, MID, MID)) body += well(p.x, p.y, CUBE_PAD.size, CUBE_PAD.corner, WELL.cube);
    const at = numberPlacement(spec.number);
    const hue = PLANET_FAMILY[spec.number].hue;
    // White with a dark outline reads on any planet surface and on the space around it. The outline
    // is a second copy underneath; the baseline sits 0.4 em below the centre so the digits are centred.
    const text = (paint: string) =>
      `<text x="${n(MID + at.x)}" y="${n(MID + at.y + at.size * 0.4)}" ${paint} font-family="${FONTS.body}" font-weight="800" font-size="${n(at.size)}" letter-spacing="${n(-0.03 * at.size)}" text-anchor="middle">${spec.number}</text>`;
    body +=
      text(`fill="none" stroke="${hex(hue, 50, 7)}" stroke-width="${n(at.size * 0.13)}" stroke-linejoin="round"`) + text(`fill="#fff"`);
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
  // The four lines fit the 8 mm strip between the space pads above and below (pads end 4 mm from
  // the corner), with 0.5 mm to spare: name caps from -3.5, last baseline at +3.2.
  const top = MID - CORNER;
  // Right aligned at the corner, or further left where a big planet (with its atmosphere) reaches the
  // strip: its edge is nearest at the last line, 3.2 mm below the corner.
  const glow = r * 1.08;
  const dy = MID - (top + 3.2);
  const right = Math.min(MID - CORNER - 1.6, glow > dy ? MID - Math.sqrt(glow * glow - dy * dy) - 1.2 : Infinity);
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
        ? `<line x1="${n(start)}" y1="${n(start)}" x2="${n(tip)}" y2="${n(tip)}" stroke="#c7d6ff" stroke-opacity=".45" stroke-width=".15"/>` +
          `<circle cx="${n(tip)}" cy="${n(tip)}" r=".35" fill="#c7d6ff" fill-opacity=".7"/>`
        : ''),
  };
}

/**
 * A Void tile's black hole. A hot disc of matter circles a black shadow, brighter on the side that
 * spins toward the viewer; its far side is bent by gravity over the top of the shadow and, fainter,
 * under it, and a thin bright ring hugs the shadow's edge.
 */
function blackHole(id: string): Fragment {
  const r = rng(`${id}:hole`);
  const ramp = [hsl(48, 100, 94), hsl(38, 100, 72), hsl(26, 100, 56), hsl(14, 95, 42)];
  /** The shadow's radius (mm). */
  const shadow = 8;
  const tilt = r.range(-13, -5);
  const ring = (rx: number, ry: number, w: number, c: string, o: number) =>
    `<ellipse rx="${n(rx)}" ry="${n(ry)}" fill="none" stroke="${c}" stroke-width="${n(w)}" stroke-opacity="${n(o)}"/>`;
  const colour = (t: number) => ramp[Math.min(3, Math.floor(t * 4))];
  // The disc: rings from the hot inner edge out, seen nearly edge on.
  const flat = r.range(0.17, 0.21);
  let disc = '';
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const rx = 11 + t * 23;
    disc += ring(rx, rx * flat, 2.6, colour(t), 0.95 - t * 0.7);
  }
  // The lensed far side: nearly circular rings just outside the shadow.
  let lens = '';
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    lens += ring(shadow + 1.6 + t * 4.5, shadow + 1.2 + t * 3.6, 1.4, colour(t), 0.9 - t * 0.6);
  }
  const soft = (inner: string) => `<g filter="url(#${id}-soft)">${inner}</g>`;
  const discG = `<g mask="url(#${id}-doppler)">${soft(disc)}</g>`;
  // Everything here (disc, lens and their blur) fits this box, in the hole's rotated frame (mm).
  const box = { x: -44, y: -24, w: 88, h: 48 };
  const region = `filterUnits="userSpaceOnUse" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"`;
  return {
    defs:
      `<filter id="${id}-near" ${region}><feGaussianBlur stdDeviation=".7"/></filter>` +
      // A wide glow at 70% under a near one, laid together in sRGB like two layers.
      `<filter id="${id}-soft" ${region}><feGaussianBlur in="SourceGraphic" stdDeviation="2.2"/><feComponentTransfer result="wide"><feFuncA type="linear" slope=".7"/></feComponentTransfer>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation=".7" result="near"/><feMerge color-interpolation-filters="sRGB"><feMergeNode in="wide"/><feMergeNode in="near"/></feMerge></filter>` +
      `<linearGradient id="${id}-dopg" gradientUnits="userSpaceOnUse" x1="-34" y1="0" x2="34" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient>` +
      gradientMask(`${id}-doppler`, box, `${id}-dopg`) +
      `<clipPath id="${id}-near-half"><rect x="-50" y="0" width="100" height="50"/></clipPath>` +
      `<clipPath id="${id}-far-half"><rect x="-50" y="-50" width="100" height="50"/></clipPath>` +
      `<radialGradient id="${id}-halo" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="44"><stop offset="0" stop-color="${hsl(32, 100, 60)}" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`,
    body:
      `<g transform="translate(${MID} ${MID}) rotate(${n(tilt)})">` +
      `<circle r="44" fill="url(#${id}-halo)"/>` +
      discG +
      `<g clip-path="url(#${id}-far-half)">${soft(lens)}</g>` +
      `<g clip-path="url(#${id}-near-half)" opacity=".55"><g filter="url(#${id}-near)">${lens}</g></g>` +
      `<circle r="${shadow}" fill="#000"/>` +
      `<circle r="${n(shadow + 0.35)}" fill="none" stroke="${ramp[0]}" stroke-width=".45" filter="url(#${id}-near)"/>` +
      // The near half of the disc passes in front of the shadow.
      `<g clip-path="url(#${id}-near-half)">${discG}</g>` +
      `</g>`,
  };
}

/** A Void tile's rift: the violet nebula pulled into a dark core. */
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

/**
 * A Void tile's supernova: a blinding white-blue star at the centre with light spikes, inside an
 * expanding shell of glowing gas, red and orange filaments at its shock front around a teal haze.
 */
function supernova(id: string): Fragment {
  const r = rng(`${id}:nova`);
  /** The shell's radius (mm). */
  const shell = r.range(21, 25);
  const at = `gradientUnits="userSpaceOnUse" cx="${MID}" cy="${MID}"`;
  /** A square of half-size `h` round the centre, and a filter region on it. */
  const square = (h: number) => ({ x: MID - h, y: MID - h, w: 2 * h, h: 2 * h });
  const region = (b: ReturnType<typeof square>) =>
    `filterUnits="userSpaceOnUse" x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" color-interpolation-filters="sRGB"`;
  const rect = (b: ReturnType<typeof square>, paint: string) =>
    `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" ${paint}/>`;
  // The haze fills the shell, the filaments reach past it.
  const haze = square(shell + 3);
  // (The swirl shifts the noise up to 4.5 mm, so the filaments' region keeps that much spare.)
  const fil = square(shell + 15);
  // Light spikes: angle, length, thickness, opacity. Two long ones and two short diagonals.
  const spikes = (
    [
      [0, 30, 0.22, 0.85],
      [90, 30, 0.22, 0.85],
      [45, 13, 0.14, 0.5],
      [135, 13, 0.14, 0.5],
    ] as const
  )
    .map(([a, rx, ry, o]) => `<ellipse rx="${rx}" ry="${ry}" transform="rotate(${n(a + r.range(-4, 4))})" fill="#fff" opacity="${o}"/>`)
    .join('');
  return {
    defs:
      // Filaments: ridge noise, swirled, turned into thin red lines with hot orange cores at the shock front.
      `<filter id="${id}-fil" ${region(fil)}>` +
      turbulence('.085', 4, r.noiseSeed(), 'n', 'turbulence') +
      turbulence('.035', 2, r.noiseSeed(), 'w') +
      `<feDisplacementMap in="n" in2="w" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      ridges([12, 100, 60], 4, 'd', 'red') +
      ridges([34, 100, 74], 9, 'd', 'hot') +
      `<feGaussianBlur in="red" stdDeviation=".6" result="glow"/>` +
      `<feMerge><feMergeNode in="glow"/><feMergeNode in="red"/><feMergeNode in="hot"/></feMerge></filter>` +
      // Haze: soft teal cloud filling the shell.
      `<filter id="${id}-haze" ${region(haze)}>${turbulence('.05', 4, r.noiseSeed(), 'c')}${tint([186, 90, 60], 3.4, -1.2, 'c')}</filter>` +
      `<radialGradient id="${id}-shellg" ${at} r="${n(shell + 10)}"><stop offset="${n((shell - 9) / (shell + 10))}" stop-color="#000"/><stop offset="${n(shell / (shell + 10))}" stop-color="#fff"/><stop offset="${n((shell + 4) / (shell + 10))}" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#000"/></radialGradient>` +
      gradientMask(`${id}-shell`, fil, `${id}-shellg`) +
      `<radialGradient id="${id}-innerg" ${at} r="${n(shell + 2)}"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".7" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#000"/></radialGradient>` +
      gradientMask(`${id}-inner`, haze, `${id}-innerg`) +
      `<radialGradient id="${id}-glow" ${at} r="18"><stop offset="0" stop-color="#fff"/><stop offset=".07" stop-color="${hsl(190, 100, 92)}" stop-opacity=".95"/><stop offset=".3" stop-color="${hsl(200, 100, 72)}" stop-opacity=".4"/><stop offset="1" stop-color="${hsl(210, 100, 60)}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${id}-halo" ${at} r="46"><stop offset="0" stop-color="${hsl(330, 90, 60)}" stop-opacity=".12"/><stop offset="1" stop-color="${hsl(330, 90, 60)}" stop-opacity="0"/></radialGradient>` +
      `<filter id="${id}-spike" filterUnits="userSpaceOnUse" x="-32" y="-32" width="64" height="64"><feGaussianBlur stdDeviation=".22"/></filter>`,
    body:
      rect(square(MID), `fill="url(#${id}-halo)"`) +
      `<g mask="url(#${id}-inner)">${rect(haze, `filter="url(#${id}-haze)" opacity=".85"`)}</g>` +
      `<g mask="url(#${id}-shell)">${rect(fil, `filter="url(#${id}-fil)"`)}</g>` +
      `<circle cx="${MID}" cy="${MID}" r="18" fill="url(#${id}-glow)"/>` +
      `<g transform="translate(${MID} ${MID})" filter="url(#${id}-spike)">${spikes}</g>` +
      `<circle cx="${MID}" cy="${MID}" r=".9" fill="#fff"/>`,
  };
}

/** What can sit at the centre of a Void tile (tileset.ts picks one per tile). */
const VOID_HEARTS: Record<VoidHeart, (id: string) => Fragment> = { blackHole, rift, supernova };

/**
 * One or two small moons beside the planet, lit from the top left like it, at varied angles and
 * distances. They stay out of the top-left (the label) and bottom-right (the number) quadrants.
 */
function moons(r: number, id: string, number: number, type: PlanetType, rand: ReturnType<typeof rng>): Fragment {
  const hue = PLANET_FAMILY[number].hue;
  // Moons borrow their planet's colouring: mossy and teal by the oceans, white by the ice, tan by the
  // gas giants, and charred with glowing cracks by the lava worlds.
  const pal =
    type === 'lava'
      ? { h: 8, s: 40, l: 38 }
      : type === 'ice' || number === 9
        ? { h: 200, s: 30, l: 84 }
        : type === 'gas'
          ? { h: 36, s: 42, l: 66 }
          : { h: 140, s: 26, l: 58 };
  const count = rand.int(0, 2);
  // One free arc each: up and to the right, or down and to the left (degrees, y down).
  const arcs: [number, number][] = rand.chance(0.5)
    ? [
        [-85, -5],
        [95, 175],
      ]
    : [
        [95, 175],
        [-85, -5],
      ];
  let defs = '';
  let body = '';
  for (let i = 0; i < count; i++) {
    const mr = r * rand.range(0.07, 0.13);
    const a = (rand.range(...arcs[i]) * Math.PI) / 180;
    const d = r * 1.12 + mr + rand.range(1, 7);
    const x = MID + Math.cos(a) * d;
    const y = MID + Math.sin(a) * d;
    const h = pal.h + rand.range(-8, 8);
    const l = pal.l + rand.range(-6, 6);
    defs += `<radialGradient id="${id}-moon${i}" cx=".32" cy=".28" r=".85"><stop offset="0" stop-color="${hsl(h, pal.s, l)}"/><stop offset=".55" stop-color="${hsl(h, pal.s, l * 0.5)}"/><stop offset="1" stop-color="${hsl(hue, 40, 5)}"/></radialGradient>`;
    body += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(mr * 1.8)}" fill="${hsl(hue, 70, 60)}" fill-opacity=".12"/>`;
    body += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(mr)}" fill="url(#${id}-moon${i})"/>`;
    if (type === 'lava')
      body += `<circle cx="${n(x + mr * 0.25)}" cy="${n(y + mr * 0.2)}" r="${n(mr * 0.3)}" fill="${hsl(28, 95, 55)}" fill-opacity=".55"/>`;
  }
  return { defs, body };
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
  if (isVoid) parts.push(VOID_HEARTS[spec.heart ?? 'blackHole'](id));
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
      moons(
        PLANET_DIAMETER[spec.number] / 2,
        `${id}-planet`,
        spec.number,
        spec.type ?? PLANET_FAMILY[spec.number].types[0],
        art.fork('moons'),
      ),
    );
  }
  if (!isVoid && o.only !== 'art') parts.push(label(spec));
  if (o.markings && o.only !== 'art') parts.push(marks());

  if (o.fontCss) parts.push({ defs: `<style>${o.fontCss}</style>`, body: '' });

  const all = join(...parts);
  return document(o.rounded ? dieCut(all, id, TILE.size, TILE.size, TILE.corner) : all, area);
}

/** Whether a tile's planet has rings (picked from its seed, when its spec doesn't say). */
export function tileHasRings(spec: TileSpec): boolean {
  if (spec.rings !== undefined || spec.number === 0) return !!spec.rings;
  return planet({
    rng: rng(spec.seed).fork('planet'),
    id: spec.id,
    cx: MID,
    cy: MID,
    r: PLANET_DIAMETER[spec.number] / 2,
    number: spec.number,
    type: spec.type ?? PLANET_FAMILY[spec.number].types[0],
  }).rings;
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
