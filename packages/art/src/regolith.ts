import { rng, type Rng } from './rng';
import { TILE } from './tokens';
import { document, n, turbulence, type Fragment } from './svg';
import type { Box } from './starfield';
import { BLED, HEX_TILE_CUT, cubePadCentres, numberCorner, tileSvg, type Spot, type TileOptions } from './tile';
import type { TileSpec } from './tileset';

/**
 * Moon ground for a hex tile, after the Regolith mood board (docs/moodboards/regolith/HexSurface.dc.html):
 * a height map painted in colour (red is height, 128 the ground; green marks smooth areas; blue is
 * brightness), then lit once by one filter. Drawn in the board's own units, where a space is 69.3 tall,
 * so its numbers carry over; the tile is scaled to millimetres at the end. Each tile's craters, pits and
 * boulders come from its seed.
 *
 * Chrome ignores the lighting's `kernelUnitLength`, so its relief differs from Firefox's and Safari's
 * (the mood board's Surface study); the game draws each tile once to a bitmap, in the player's browser.
 *
 * The ground is drawn, and lit, past the area shown by `MARGIN`: the lighting reads its neighbours and the
 * shadows and warps reach in from further, so at the filter's edge they'd go wrong, as a grey line.
 */

/** One space in the mood board's units. */
const SPACE = 69.3;
const SCALE = TILE.cell / SPACE;
/** The tile's trim, 96 mm, in board units. */
const SIZE = TILE.size / SCALE;
/** How far past the area shown the ground is drawn, in board units: past the furthest shadow (9) and warp (13). */
const MARGIN = 20;

const stops = (list: [number, string, number?][]) =>
  list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('');

const radial = (id: string, list: [number, string, number?][]) => `<radialGradient id="${id}">${stops(list)}</radialGradient>`;

/** Craters carve: the bowl multiplies height (red only), the rim is screened on, so overlaps cut each other. */
const GRADIENTS =
  radial('rg-bowl', [
    [0, 'rgb(70,255,255)'],
    [0.35, 'rgb(80,255,255)'],
    [0.65, 'rgb(115,255,255)'],
    [0.85, 'rgb(180,255,255)'],
    [0.96, 'rgb(235,255,255)'],
    [1, 'rgb(255,255,255)', 0],
  ]) +
  radial('rg-bowlOld', [
    [0, 'rgb(95,255,200)'],
    [0.5, 'rgb(105,255,205)'],
    [0.75, 'rgb(150,255,225)'],
    [0.92, 'rgb(215,255,245)'],
    [1, 'rgb(255,255,255)', 0],
  ]) +
  radial('rg-rim', [
    [0.58, '#000'],
    [0.66, 'rgb(80,0,0)'],
    [0.71, 'rgb(108,0,0)'],
    [0.78, 'rgb(70,0,0)'],
    [0.88, 'rgb(25,0,0)'],
    [1, '#000'],
  ]) +
  radial('rg-terr', [
    [0.7, '#000'],
    [0.8, 'rgb(40,0,0)'],
    [0.88, '#000'],
  ]) +
  radial('rg-peak', [
    [0, 'rgb(120,0,0)'],
    [0.5, 'rgb(55,0,0)'],
    [1, '#000'],
  ]) +
  radial('rg-ej', [
    [0.42, 'rgb(0,0,255)', 0],
    [0.5, 'rgb(0,0,255)'],
    [1, 'rgb(0,0,255)', 0],
  ]) +
  radial('rg-boulder', [
    [0, 'rgb(245,0,128)'],
    [0.6, 'rgb(205,0,128)'],
    [1, 'rgb(128,0,128)', 0],
  ]);

const blur = (id: string, sd: number) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;

/** Weathering: noise pushes a crater's outline about (lobes, slumps), then age softens it. In crater units (r 25). */
const weather = (id: string, freq: number, seed: number, scale: number, sd: number, box = 'x="-30%" y="-30%" width="160%" height="160%"') =>
  `<filter id="${id}" ${box}>` +
  turbulence(freq, 4, seed, 't') +
  `<feDisplacementMap in="SourceGraphic" in2="t" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
  `<feGaussianBlur in="d" stdDeviation="${sd}"/></filter>`;

/** The light: the height map gains fine noise where it isn't smooth, is lit from the top left, shadowed, tinted and grained. Over `area`, in board units. */
function ground(r: Rng, area: Box): string {
  const s = () => r.noiseSeed();
  const offset = (d: number, k: number, i: number) =>
    `<feOffset in="H" dx="${d}" dy="${d}" result="o${i}"/>` +
    `<feComposite in="o${i}" in2="H" operator="arithmetic" k2="1" k3="-1" k4="${k}" result="d${i}"/>`;
  const light = '<feDistantLight azimuth="225" elevation="22"/>';
  return (
    `<filter id="rg-ground" filterUnits="userSpaceOnUse" x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" color-interpolation-filters="sRGB">` +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="H0"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0" result="SMOOTH"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="ALB"/>' +
    turbulence(0.012, 2, s(), 'warp') +
    turbulence(0.03, 7, s(), 'nz') +
    '<feDisplacementMap in="nz" in2="warp" scale="26" xChannelSelector="R" yChannelSelector="G" result="nzw"/>' +
    turbulence(0.018, 3, s(), 'rg', 'turbulence') +
    '<feDisplacementMap in="rg" in2="warp" scale="26" xChannelSelector="R" yChannelSelector="G" result="rgw"/>' +
    '<feComponentTransfer in="rgw" result="ridged"><feFuncA type="table" tableValues="1 0.55 0.3 0.15 0"/></feComponentTransfer>' +
    '<feComponentTransfer in="SMOOTH" result="ROUGH"><feFuncA type="table" tableValues="1 0.02"/></feComponentTransfer>' +
    '<feComposite in="nzw" in2="ROUGH" operator="in" result="nzm"/>' +
    '<feComposite in="ridged" in2="ROUGH" operator="in" result="rgm"/>' +
    '<feComposite in="H0" in2="nzm" operator="arithmetic" k2="0.85" k3="0.28" k4="-0.07" result="h1"/>' +
    '<feComposite in="h1" in2="rgm" operator="arithmetic" k2="1" k3="0.12" k4="-0.05" result="H"/>' +
    `<feDiffuseLighting in="H" kernelUnitLength="0.28" surfaceScale="9" diffuseConstant="1.3" lighting-color="#ffffff" result="L">${light}</feDiffuseLighting>` +
    offset(1.2, -0.06, 1) +
    offset(2.5, -0.13, 2) +
    offset(5, -0.26, 3) +
    offset(9, -0.47, 4) +
    '<feMerge result="sh"><feMergeNode in="d1"/><feMergeNode in="d2"/><feMergeNode in="d3"/><feMergeNode in="d4"/></feMerge>' +
    '<feComponentTransfer in="sh" result="shA"><feFuncA type="linear" slope="9"/></feComponentTransfer>' +
    '<feGaussianBlur in="shA" stdDeviation="0.25" result="shB"/>' +
    '<feFlood flood-color="#000000" flood-opacity="0.82"/>' +
    '<feComposite in2="shB" operator="in" result="SHD"/>' +
    '<feMerge result="Ls"><feMergeNode in="L"/><feMergeNode in="SHD"/></feMerge>' +
    '<feColorMatrix in="ALB" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1" result="albG"/>' +
    turbulence(0.01, 3, s(), 'an') +
    '<feColorMatrix in="an" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="anG"/>' +
    '<feComposite in="albG" in2="anG" operator="arithmetic" k2="1" k3="0.45" k4="-0.22" result="albN"/>' +
    '<feComposite in="Ls" in2="albN" operator="arithmetic" k1="2" result="lit"/>' +
    `<feSpecularLighting in="H" kernelUnitLength="0.28" surfaceScale="9" specularConstant="0.6" specularExponent="40" lighting-color="#e6f6ff" result="spec">${light}</feSpecularLighting>` +
    '<feComposite in="spec" in2="SMOOTH" operator="in" result="specM"/>' +
    '<feComposite in="lit" in2="specM" operator="arithmetic" k2="1" k3="0.7" result="lit2"/>' +
    '<feComponentTransfer in="lit2" result="ramp">' +
    '<feFuncR type="table" tableValues="0.02 0.08 0.2 0.37 0.55 0.72 0.86"/>' +
    '<feFuncG type="table" tableValues="0.025 0.085 0.2 0.36 0.53 0.69 0.83"/>' +
    '<feFuncB type="table" tableValues="0.035 0.095 0.205 0.35 0.5 0.65 0.79"/>' +
    '</feComponentTransfer>' +
    turbulence(1.4, 1, s(), 'grain') +
    '<feComposite in="ramp" in2="grain" operator="arithmetic" k2="1" k3="0.09" k4="-0.045"/>' +
    '</filter>'
  );
}

const circle = (r: number, fill: string, blend: string, opacity?: number, filter?: string) =>
  `<circle r="${r}" fill="url(#${fill})" style="mix-blend-mode: ${blend}"${opacity === undefined ? '' : ` opacity="${opacity}"`}${filter ? ` filter="url(#${filter})"` : ''}/>`;

/** A crater's bowl and rim, weathered by `wx`; past its oldest age, terraces inside the rim. */
const crater = (wx: string, terraced: boolean, bowl = 'rg-bowl', opacity?: number, rim?: number) =>
  circle(25, bowl, 'multiply', opacity, wx) +
  circle(36, 'rg-rim', 'screen', rim, wx) +
  (terraced ? circle(25, 'rg-terr', 'screen', undefined, wx) : '');

/** Craters by age, r 25 (rim 36): old ones shallow and soft, young ones crisp with a bright ejecta ring, the big one with a central peak. */
const CRATERS =
  `<g id="rg-cr-o">${crater('rg-wx-o', false, 'rg-bowlOld', 0.7, 0.45)}</g>` +
  `<g id="rg-cr-m">${crater('rg-wx-m', true, 'rg-bowl', 0.85, 0.75)}</g>` +
  `<g id="rg-cr-y">${crater('rg-wx-y', true)}${circle(55, 'rg-ej', 'lighten', 0.4)}</g>` +
  `<g id="rg-cr-big">${crater('rg-wx-y', true)}${circle(7, 'rg-peak', 'screen', undefined, 'rg-wx-y')}${circle(68, 'rg-ej', 'lighten', 0.5)}</g>`;

/** A low ridge: a soft rise with a sharper crest. */
const RIDGE =
  '<g id="rg-ridge">' +
  '<path d="M-30,10 C-22,-6 -6,-16 12,-16 C24,-16 32,-8 30,2 C26,14 4,18 -12,20 C-24,21 -32,18 -30,10 Z" fill="rgb(200,0,128)" filter="url(#rg-soft6)"/>' +
  '<path d="M-22,8 C-12,-4 6,-11 22,-6" fill="none" stroke="rgb(226,0,128)" stroke-width="6" stroke-linecap="round" filter="url(#rg-soft3)"/>' +
  '<path d="M-20,6 C-11,-5 6,-11 21,-7" fill="none" stroke="rgb(236,0,128)" stroke-width="1.6" stroke-linecap="round" filter="url(#rg-soft1)"/>' +
  '</g>';

/** The hex flower's outline (its cut), in board units. */
const OUTLINE = HEX_TILE_CUT.map((side) => side.map((v) => v / SCALE));

/** How far (x, y) is inside the hex flower, in board units: negative outside it. */
function inside(x: number, y: number): number {
  let d = Infinity;
  let crossings = 0;
  for (const [x1, y1, x2, y2] of OUTLINE) {
    const [dx, dy] = [x2 - x1, y2 - y1];
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    d = Math.min(d, Math.hypot(x - x1 - t * dx, y - y1 - t * dy));
    if (y1 > y !== y2 > y && x < x1 + ((y - y1) / (y2 - y1)) * dx) crossings++;
  }
  return crossings % 2 ? d : -d;
}

/**
 * How many features may run over the flower's edge, cut off where the next tile starts: a few, so the
 * edge doesn't look swept clear, but most stop short of it, as a crater cut in two shows at a seam.
 */
const OVER_EDGE = 0.15;

/**
 * A point anywhere on the hex flower for a feature `reach` across from its middle: clear of the edge by
 * that, or now and then (`OVER_EDGE`) only within the flower. Spread evenly, not drawn to the middle.
 */
function anywhere(r: Rng, reach: number): Spot {
  const clear = r.chance(OVER_EDGE) ? 0 : reach;
  let p = { x: SIZE / 2, y: SIZE / 2 };
  for (let i = 0; i < 80; i++) {
    const q = { x: r.range(0, SIZE), y: r.range(0, SIZE) };
    const d = inside(q.x, q.y);
    if (d >= clear) return q;
    // Too big to keep clear of the edge anywhere: the last point inside the flower will do.
    if (d >= 0) p = q;
  }
  return p;
}

/** How far a crater of each kind reaches, at scale 1: its rim (36), or where its bright ejecta fades (r 55, 68). */
const CRATER_REACH: Record<string, number> = { o: 38, m: 38, y: 42, big: 52 };

/** Copies of a crater, each placed, turned and stretched a little (as the mood board's are). */
function craters(r: Rng, kind: string, count: number, min: number, max: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const s = r.range(min, max);
    const { x, y } = anywhere(r, CRATER_REACH[kind] * s);
    out += `<use href="#rg-cr-${kind}" transform="translate(${n(x)},${n(y)}) rotate(${r.int(0, 359)}) scale(${n(s)},${n(s * r.range(0.9, 1))})"/>`;
  }
  return out;
}

/** Pits too small to weather apart: bowls in one group and rims in another, sizes skewed small. */
function pits(r: Rng, count: number, min: number, max: number): string {
  const list = Array.from({ length: count }, () => {
    const size = min + (max - min) * r.next() ** 2;
    // The rim is 1.45 times the bowl, and weathered a little further.
    return { ...anywhere(r, size * 1.45 + 1), r: size };
  });
  const group = (attrs: string, k: number) =>
    `<g ${attrs} filter="url(#rg-wx-p)">${list.map((p) => `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(p.r * k)}"/>`).join('')}</g>`;
  return (
    group('fill="url(#rg-bowl)" style="mix-blend-mode: multiply"', 1) +
    group('fill="url(#rg-rim)" style="mix-blend-mode: screen" opacity="0.75"', 1.45)
  );
}

/** Boulders strewn in a few clusters. */
function boulders(r: Rng, clusters: number, each: number): string {
  let out = '';
  for (let c = 0; c < clusters; c++) {
    const { x, y } = anywhere(r, 18);
    for (let i = 0; i < each; i++) {
      const a = r.range(0, 2 * Math.PI);
      const d = 14 * Math.sqrt(r.next());
      out += `<circle cx="${n(x + d * Math.cos(a))}" cy="${n(y + d * Math.sin(a))}" r="${n(r.range(0.9, 3.6))}"/>`;
    }
  }
  return `<g fill="url(#rg-boulder)">${out}</g>`;
}

/** Height-map colours for the buildings: plinths sit high and smooth, bays are sunk in their decks. */
const H = {
  apron: 'rgb(150,0,110)',
  deck: 'rgb(196,150,125)',
  rim: 'rgb(208,150,135)',
  floor: 'rgb(172,215,135)',
  base: 'rgb(140,225,150)',
};

const BUILDING_GRADIENTS =
  radial('rg-tank', [
    [0, 'rgb(255,0,128)'],
    [0.8, 'rgb(225,0,128)'],
    [1, 'rgb(190,0,128)'],
  ]) +
  radial('rg-dome', [
    [0, 'rgb(250,255,225)'],
    [0.6, 'rgb(228,255,210)'],
    [0.88, 'rgb(185,255,195)'],
    [1, 'rgb(150,255,185)'],
  ]) +
  radial('rg-sink', [
    [0, 'rgb(0,0,15)'],
    [0.5, 'rgb(8,0,25)'],
    [0.78, 'rgb(70,0,80)'],
    [0.9, 'rgb(158,0,125)'],
    [1, 'rgb(128,0,128)', 0],
  ]) +
  radial('rg-frost', [
    [0, 'rgb(0,210,225)', 0.9],
    [1, 'rgb(0,210,225)', 0],
  ]) +
  radial('rg-pile', [
    [0, 'rgb(180,255,240)'],
    [1, 'rgb(140,255,220)'],
  ]);

/** A rounded square `size` across centred on (x, y). */
const square = (x: number, y: number, size: number, rx: number, fill: string, soft = false) =>
  `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${size}" height="${size}" rx="${rx}" fill="${fill}"${soft ? ' filter="url(#rg-soft1)"' : ''}/>`;

/**
 * The cube bays, sunk in their decks, where the game's cube pads are (`cubePadCentres`, in board units).
 * Each on its own plinth, or (`deck` null) in a deck the building already has.
 */
function bays(pads: readonly Spot[], deck: string | null = H.deck): string {
  const each = (f: (p: Spot) => string) => pads.map(f).join('');
  return (
    (deck ? each((p) => square(p.x, p.y, 31, 4, H.apron, true)) + each((p) => square(p.x, p.y, 29, 3.5, deck)) : '') +
    each((p) => square(p.x, p.y, 26, 4.6, H.rim)) +
    each((p) => square(p.x, p.y, 23, 3.4, H.floor))
  );
}

/** Painted on the lit ground: amber ticks at each bay's corners. */
const bayTicks = (pads: readonly Spot[]) =>
  `<path d="${pads
    .flatMap((p) =>
      [-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => {
          const [x, y] = [p.x + sx * 14.1, p.y + sy * 14.1];
          return `M${n(x - sx * 4)},${n(y)} L${n(x)},${n(y)} L${n(x)},${n(y - sy * 4)}`;
        }),
      ),
    )
    .join(' ')}" fill="none" stroke="#F2B233" stroke-width="0.7" opacity="0.65"/>`;

/** A warning light, with its glow. */
const beacon = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="3.2" fill="#F2B233" opacity="0.5" filter="url(#rg-soft1)"/><circle cx="${x}" cy="${y}" r="1.1" fill="#fff1c9"/>`;

/** A row of lit windows, across or down. */
const windows = (x: number, y: number, down = false) =>
  `<g fill="#9FE8F4">${[0, 3, 6].map((d) => `<rect x="${down ? x : x + d}" y="${down ? y + d : y}" width="1.2" height="1.2"/>`).join('')}</g>`;

interface Building {
  /** How far the ground is levelled round it. */
  graded: number;
  /** Its height map. */
  heights: string;
  /** Paint and lights, over the lit ground. */
  paint: string;
}

/**
 * The building on a planet's space, after the mood board's objectives, round its cube bays (one per cube
 * the planet holds): a habitat dome for a 7, a refinery for an 8, an ice mine for a 9, a reactor for a 10,
 * and a sinkhole on a Void tile. Centred on the planet's space, in board units. `at` is where the planet
 * sits on its tile (in spaces from the middle).
 */
function building(number: number, at: Spot): Building | undefined {
  const pads = cubePadCentres(number - 6, 0, 0).map((p) => ({ x: p.x / SCALE, y: p.y / SCALE }));
  switch (number) {
    case 0:
      return {
        graded: 0,
        heights: '<circle r="38" fill="url(#rg-sink)" filter="url(#rg-wx-m)"/>',
        paint: '<circle r="15" fill="#000" opacity="0.5" filter="url(#rg-soft3)"/>',
      };
    case 7: {
      // The dome stands at the top left (towards the light) or, off the tile's middle, in the corner nearest
      // the middle that the number doesn't take, so the tile's edge doesn't cut it off.
      const taken = numberCorner(at, 'hex');
      const corners = [-1, 1].flatMap((x) => [-1, 1].map((y) => ({ x, y }))).filter((k) => k.x !== taken.x || k.y !== taken.y);
      const far = (k: Spot) => Math.hypot(at.x * SPACE + k.x * 23, at.y * SPACE + k.y * 23);
      const dome = at.x || at.y ? corners.reduce((a, b) => (far(b) < far(a) ? b : a)) : { x: -1, y: -1 };
      const mirror = (f: string) => `<g transform="scale(${-dome.x},${-dome.y})">${f}</g>`;
      return {
        graded: 44,
        heights: mirror(
          `<circle cx="-23" cy="-23" r="18" fill="${H.base}"/>` +
            square(0, 0, 34, 3, H.apron, true) +
            square(0, 0, 32, 3, H.deck) +
            bays(pads, null) +
            '<circle cx="-23" cy="-23" r="13" fill="url(#rg-dome)"/>',
        ),
        paint: mirror(
          '<g fill="none" stroke="#1a1e21" stroke-width="0.5" opacity="0.4" transform="translate(-23,-23)"><path d="M0,-13 L0,13 M-13,0 L13,0 M-9.2,-9.2 L9.2,9.2 M-9.2,9.2 L9.2,-9.2"/><circle r="8"/></g>' +
            bayTicks(pads) +
            windows(-14, 6, true) +
            beacon(14, -14),
        ),
      };
    }
    case 8:
      return {
        graded: 46,
        heights:
          `<rect x="-30" y="-14.5" width="60" height="31" rx="3" fill="${H.apron}" filter="url(#rg-soft1)"/>` +
          `<rect x="-29" y="-13.5" width="58" height="29" rx="2.5" fill="${H.deck}"/>` +
          bays(pads, null) +
          '<path d="M-14,-19.5 L-14,-12.5 M14,-19.5 L14,-12.5 M-2,-30.5 L2,-30.5" fill="none" stroke="rgb(176,0,128)" stroke-width="2.4"/>' +
          [-14, 14]
            .map(
              (x) =>
                `<circle cx="${x}" cy="-30.5" r="12.5" fill="url(#rg-tank)"/><circle cx="${x}" cy="-30.5" r="12.5" fill="rgb(0,0,230)" style="mix-blend-mode: lighten"/>`,
            )
            .join('') +
          '<circle cx="-26" cy="-11.5" r="1.4" fill="rgb(235,0,160)"/>',
        paint: bayTicks(pads) + windows(-4, 13) + beacon(-26, -11.5),
      };
    case 9:
      return {
        graded: 50,
        heights:
          '<circle r="46" fill="url(#rg-frost)" style="mix-blend-mode: lighten"/>' +
          '<path d="M-29,24 L-29,36" stroke="rgb(168,0,140)" stroke-width="5" filter="url(#rg-soft1)"/>' +
          '<ellipse cx="-29" cy="40" rx="9" ry="5.5" fill="url(#rg-pile)" filter="url(#rg-soft1)"/>' +
          '<circle cx="-29" cy="14" r="12" fill="rgb(160,190,140)"/>' +
          bays(pads, 'rgb(188,120,118)') +
          '<circle r="44" fill="url(#rg-frost)" style="mix-blend-mode: lighten" opacity="0.45"/>' +
          square(-29, 14, 19, 0, H.apron, true) +
          square(-29, 14, 17, 0, 'rgb(250,0,150)'),
        paint:
          '<g fill="none" stroke="#2a2724" opacity="0.75" transform="translate(-29,14)"><rect x="-8.5" y="-8.5" width="17" height="17" stroke-width="1.2"/><path d="M-8.5,-8.5 L8.5,8.5 M8.5,-8.5 L-8.5,8.5" stroke-width="1"/></g>' +
          '<circle cx="-29" cy="14" r="4.2" fill="none" stroke="#e0dbd0" stroke-width="1.2"/><circle cx="-29" cy="14" r="1.6" fill="#9FC4CF"/>' +
          '<path d="M-29,24 L-29,36" stroke="#e0dbd0" stroke-width="0.6" stroke-dasharray="1.5 1.5" opacity="0.6"/>' +
          bayTicks(pads),
      };
    case 10: {
      const vents = [
        [37, 0],
        [-37, 0],
        [0, 37],
        [0, -37],
      ];
      return {
        graded: 54,
        heights:
          `<polygon points="44,18.2 18.2,44 -18.2,44 -44,18.2 -44,-18.2 -18.2,-44 18.2,-44 44,-18.2" fill="${H.base}"/>` +
          `<g fill="rgb(178,40,110)">${vents.map(([x, y]) => `<rect x="-5" y="-5" width="10" height="10" transform="translate(${x},${y}) rotate(45)"/>`).join('')}</g>` +
          bays(pads),
        paint:
          `<g stroke="#1a1816" stroke-width="0.7" opacity="0.55">${vents
            .map(([x, y]) => `<path d="M-4,-2 L4,-2 M-4,0 L4,0 M-4,2 L4,2" transform="translate(${x},${y}) rotate(${x ? 90 : 0})"/>`)
            .join('')}</g>` +
          bayTicks(pads) +
          vents.map(([x, y]) => beacon(x * 1.12, y * 1.12)).join(''),
      };
    }
    default:
      return undefined;
  }
}

/** The trim and its bleed in board units, and the margin past it, which the ground is drawn and lit over. */
const DRAWN: Box = {
  x: BLED.x / SCALE - MARGIN,
  y: BLED.y / SCALE - MARGIN,
  w: BLED.w / SCALE + 2 * MARGIN,
  h: BLED.h / SCALE + 2 * MARGIN,
};

/** A tile's moon ground over its trim and bleed (mm, the trim's top left at 0, 0), its building standing `at` its planet's space. */
function regolithArt(spec: TileSpec, at: Spot): Fragment {
  const r = rng(spec.seed).fork('regolith');
  const site = building(spec.number, at);
  const [bx, by] = [SIZE / 2 + at.x * SPACE, SIZE / 2 + at.y * SPACE];
  const place = (f: string) => `<g transform="translate(${n(bx)},${n(by)})">${f}</g>`;
  const ridges = Array.from({ length: r.int(0, 2) }, () => {
    const { x, y } = anywhere(r, 34);
    return `<use href="#rg-ridge" transform="translate(${n(x)},${n(y)}) rotate(${r.int(-40, 40)})"/>`;
  }).join('');
  const heights =
    `<rect x="${n(DRAWN.x)}" y="${n(DRAWN.y)}" width="${n(DRAWN.w)}" height="${n(DRAWN.h)}" fill="rgb(128,0,128)"/>` +
    ridges +
    craters(r, 'o', r.int(1, 2), 0.6, 1.4) +
    (r.chance(0.25) ? craters(r, 'big', 1, 0.8, 1.05) : '') +
    craters(r, 'm', r.int(1, 2), 0.32, 0.8) +
    craters(r, 'y', r.int(1, 2), 0.24, 0.6) +
    // As many on the flower as there were when they were strewn past the tile's square too.
    pits(r.fork('pits'), 55, 0.45, 1.12) +
    pits(r.fork('small'), 21, 1.2, 5.6) +
    boulders(r.fork('boulders'), 1, 15) +
    // The ground is levelled round a building, smoothing over any crater there, then it's built.
    (site?.graded ? place(`<circle r="${site.graded}" fill="rgb(128,190,128)" filter="url(#rg-soft6)"/>`) : '') +
    (site ? place(site.heights) : '');
  const filters =
    blur('rg-soft1', 1) +
    blur('rg-soft3', 3) +
    blur('rg-soft6', 6) +
    weather('rg-wx-y', 0.07, r.noiseSeed(), 5, 0.5) +
    weather('rg-wx-m', 0.06, r.noiseSeed(), 7, 1.3) +
    weather('rg-wx-o', 0.05, r.noiseSeed(), 10, 2.6) +
    weather('rg-wx-p', 0.3, r.noiseSeed(), 1.8, 0.6, 'x="0" y="0" width="100%" height="100%"');
  return {
    defs: GRADIENTS + BUILDING_GRADIENTS + filters + ground(r.fork('ground'), DRAWN) + CRATERS + RIDGE,
    body: `<g transform="scale(${n(SCALE)})"><g filter="url(#rg-ground)">${heights}</g>${site ? place(site.paint) : ''}</g>`,
  };
}

/**
 * A hex tile's moon ground, in place of its sky and planet, trim 96 × 96 mm and its 3 mm bleed (so a map's
 * clip a touch past the hexes still lands on ground): the planet's building stands `at` its space (in
 * spaces from the tile's middle, x right and y down). No markings: the game draws the cubes and the
 * number over its bays.
 */
export function regolithSvg(spec: TileSpec, at: Spot = { x: 0, y: 0 }): string {
  return document(regolithArt(spec, at), BLED, true);
}

/**
 * A hex tile on the moon as printed (`tileSvg` with the moon ground for its art): knocked out past its
 * flower, with its markings, the cube pads in the building's bays.
 */
export const regolithTileSvg = (spec: TileSpec, o: Omit<TileOptions, 'shape' | 'ground'> = {}): string =>
  tileSvg(spec, { ...o, shape: 'hex', ground: (at) => regolithArt(spec, at) });
