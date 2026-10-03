import type { Rng } from './rng';
import { NEBULA_HUES, SPACE_BASE } from './tokens';
import { hsl, hslToRgb, n, type Fragment } from './svg';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StarfieldOptions {
  rng: Rng;
  /** Unique prefix for ids, so several drawings can share one page. */
  id: string;
  /** Area to fill (mm), including any bleed. */
  area: Box;
  /** The area the edge fade is measured from (the trim); defaults to `area`. */
  frame?: Box;
  /** Nebula hues; picked from the seed when omitted. */
  hues?: [number, number];
  /** How strong the nebula is, 0–1. */
  nebula?: number;
  /** Where a bright star may go; the tile keeps them in the gutters, away from the planet. */
  brightAllowed?: (x: number, y: number) => boolean;
  /** Where a faint star may go; the tile keeps them off its small print. */
  faintAllowed?: (x: number, y: number) => boolean;
}

/** Star colours by temperature, with how common each is. */
const STAR_COLOURS: { c: [number, number, number]; w: number }[] = [
  { c: [220, 30, 97], w: 0.55 },
  { c: [210, 90, 86], w: 0.2 },
  { c: [45, 90, 84], w: 0.17 },
  { c: [22, 95, 72], w: 0.08 },
];

/** Index into STAR_COLOURS, weighted by how common each colour is. */
function starColour(rng: Rng): number {
  let u = rng.next();
  for (let i = 0; i < STAR_COLOURS.length; i++) {
    if ((u -= STAR_COLOURS[i].w) <= 0) return i;
  }
  return 0;
}

interface CloudOptions {
  id: string;
  area: Box;
  /** Noise frequency per mm ("x y" for stretched clouds). */
  freq: string;
  octaves: number;
  seed: number;
  colour: [number, number, number];
  /** Peak opacity. */
  strength: number;
  /** Noise level below which the cloud is clear: higher means smaller clouds. */
  cut: number;
  /** How far the cloud fades in above `cut`: bigger is softer. */
  soft: number;
  /** Swirl: how far (mm) a second noise pushes the cloud around. */
  warp: number;
  warpSeed: number;
  /** Fine bright filaments inside the cloud, 0–1. */
  filaments?: number;
}

/** A nebula layer: fractal noise, swirled by a second noise, turned into a cloud of one colour. */
function cloud(o: CloudOptions): Fragment {
  const { id, area } = o;
  const [r, g, b] = hslToRgb(...o.colour);
  // alpha = k·(noise − cut): clear below `cut`, reaching `strength` at cut + soft.
  const k = o.strength / o.soft;
  const base = Number(o.freq.split(' ')[0]);
  let filaments = '';
  if (o.filaments) {
    const [fr, fg, fb] = hslToRgb(o.colour[0], o.colour[1], Math.min(90, o.colour[2] + 30));
    filaments =
      `<feTurbulence type="turbulence" baseFrequency="${n(base * 3)}" numOctaves="3" seed="${o.warpSeed + 7}" result="ridge"/>` +
      `<feDisplacementMap in="ridge" in2="warp" scale="${n(o.warp)}" xChannelSelector="R" yChannelSelector="G" result="ridgeW"/>` +
      `<feColorMatrix in="ridgeW" type="matrix" values="0 0 0 0 ${n(fr)} 0 0 0 0 ${n(fg)} 0 0 0 0 ${n(fb)} ${n(-o.filaments * 9)} 0 0 0 ${n(o.filaments)}" result="lines"/>` +
      `<feComposite in="lines" in2="cloud" operator="in" result="fil"/>` +
      `<feMerge><feMergeNode in="cloud"/><feMergeNode in="fil"/></feMerge>`;
  }
  return {
    defs:
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${n(base * 1.7)}" numOctaves="2" seed="${o.warpSeed}" result="warp"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency="${o.freq}" numOctaves="${o.octaves}" seed="${o.seed}" result="noise"/>` +
      `<feDisplacementMap in="noise" in2="warp" scale="${n(o.warp)}" xChannelSelector="R" yChannelSelector="G" result="swirled"/>` +
      `<feColorMatrix in="swirled" type="matrix" values="0 0 0 0 ${n(r)} 0 0 0 0 ${n(g)} 0 0 0 0 ${n(b)} ${n(k)} 0 0 0 ${n(-k * o.cut)}" result="cloud"/>` +
      filaments +
      `</filter>`,
    body: `<rect x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" filter="url(#${id})"/>`,
  };
}


/** A soft square mask: opaque in the middle, fading to nothing towards the frame's edge. */
export function edgeFade(id: string, area: Box, frame: Box, inset: number, softness: number): string {
  return (
    `<filter id="${id}-blur" filterUnits="userSpaceOnUse" x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}"><feGaussianBlur stdDeviation="${n(softness)}"/></filter>` +
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}">` +
    `<rect x="${n(frame.x + inset)}" y="${n(frame.y + inset)}" width="${n(frame.w - 2 * inset)}" height="${n(frame.h - 2 * inset)}" rx="${n(inset)}" fill="#fff" filter="url(#${id}-blur)"/>` +
    `</mask>`
  );
}

/**
 * A deep-space background: base colour, two nebula colours and dark dust (faded out towards the
 * edges, so tiles sit together cleanly), a field of faint stars and a few bright ones.
 */
export function starfield(o: StarfieldOptions): Fragment {
  const { id, area } = o;
  const frame = o.frame ?? area;
  const neb = o.rng.fork('nebula');
  const stars = o.rng.fork('stars');
  const bright = o.rng.fork('bright');
  // Visible but behind the planet: the planet carries the colour.
  const strength = o.nebula ?? neb.range(0.34, 0.5);
  const jitter = neb.range(-6, 6);
  const [lo, hi] = NEBULA_HUES;
  const h1 = o.hues ? o.hues[0] + jitter : neb.range(lo, hi);
  // The second colour moves towards the middle of the range, so it never leaves it.
  const h2 = o.hues ? o.hues[1] + jitter : h1 + (h1 < (lo + hi) / 2 ? 1 : -1) * neb.range(25, 55);
  const scale = frame.w / 96;
  const f = (x: number) => n(x / scale);
  // Blue looks darker than pink at the same lightness, so blue clouds get lifted and thickened.
  const blueness = (h: number) => Math.min(1, Math.max(0, (275 - h) / 55));
  const lift = (h: number) => 18 * blueness(h);
  const boost = (h: number) => 1 + 0.35 * blueness(h);

  const layers = [
    cloud({ id: `${id}-n1`, area, freq: f(neb.range(0.016, 0.026)), octaves: 5, seed: neb.noiseSeed(), colour: [h1, 70, 46 + lift(h1)], strength: Math.min(1, strength * 0.8 * boost(h1)), cut: neb.range(0.4, 0.47), soft: 0.3, warp: 14 * scale, warpSeed: neb.noiseSeed(), filaments: 0.35 }),
    cloud({ id: `${id}-n2`, area, freq: f(neb.range(0.026, 0.04)), octaves: 4, seed: neb.noiseSeed(), colour: [h2, 75, 58 + lift(h2)], strength: Math.min(1, strength * 0.5 * boost(h2)), cut: neb.range(0.48, 0.54), soft: 0.22, warp: 10 * scale, warpSeed: neb.noiseSeed() }),
    cloud({ id: `${id}-dust`, area, freq: `${f(0.045)} ${f(0.03)}`, octaves: 5, seed: neb.noiseSeed(), colour: [SPACE_BASE[0], 40, 3], strength: 0.8, cut: 0.5, soft: 0.2, warp: 8 * scale, warpSeed: neb.noiseSeed() }),
  ];

  let starMarks = '';
  const count = Math.round(area.w * area.h * 0.034);
  for (let i = 0; i < count; i++) {
    const x = area.x + stars.next() * area.w;
    const y = area.y + stars.next() * area.h;
    const u = stars.next();
    const r = (0.09 + 0.3 * u ** 6) * scale;
    const [h, s, l] = STAR_COLOURS[starColour(stars)].c;
    const a = 0.25 + 0.75 * stars.next() ** 1.5;
    // Skipped only after every draw, so the other stars stay where they were.
    if (o.faintAllowed && !o.faintAllowed(x - frame.x, y - frame.y)) continue;
    starMarks += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${hsl(h, s, l)}" opacity="${n(a)}"/>`;
  }

  let glowDefs = '';
  STAR_COLOURS.forEach(({ c: [h, s, l] }, i) => {
    glowDefs +=
      `<radialGradient id="${id}-g${i}"><stop offset="0" stop-color="${hsl(h, s, 92)}"/>` +
      `<stop offset=".12" stop-color="${hsl(h, s, l)}" stop-opacity=".7"/>` +
      `<stop offset=".4" stop-color="${hsl(h, s, l)}" stop-opacity=".14"/>` +
      `<stop offset="1" stop-color="${hsl(h, s, l)}" stop-opacity="0"/></radialGradient>`;
  });
  let brightMarks = '';
  const wanted = bright.int(3, 6);
  const spots: { x: number; y: number }[] = [];
  for (let placed = 0, tries = 0; placed < wanted && tries < 200; tries++) {
    const x = frame.x + bright.range(8, frame.w - 8);
    const y = frame.y + bright.range(8, frame.h - 8);
    if (o.brightAllowed && !o.brightAllowed(x - frame.x, y - frame.y)) continue;
    if (spots.some((p) => Math.hypot(p.x - x, p.y - y) < 18 * scale)) continue;
    spots.push({ x, y });
    placed++;
    const ci = starColour(bright);
    const size = bright.range(2.2, 4.5) * scale;
    brightMarks += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(size)}" fill="url(#${id}-g${ci})"/>`;
    brightMarks += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(0.35 * scale)}" fill="#fff"/>`;
  }

  const [bh, bs, bl] = SPACE_BASE;
  return {
    defs: layers.map((l) => l.defs).join('') + edgeFade(`${id}-fade`, area, frame, 9 * scale, 6 * scale) + glowDefs,
    body:
      `<rect x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" fill="${hsl(bh, bs, bl)}"/>` +
      `<g mask="url(#${id}-fade)">${layers.map((l) => l.body).join('')}</g>` +
      starMarks +
      brightMarks,
  };
}
