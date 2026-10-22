import { rng, type Rng } from './rng';
import { TILE } from './tokens';
import { document, n, turbulence, type Fragment } from './svg';
import type { Box } from './starfield';
import { BLED, HEX_TILE_CUT, cubePadCentres, numberCorner, tileSvg, type Spot, type TileOptions } from './tile';
import type { TileSpec } from './tileset';

/**
 * Mars ground for a hex tile (once the moon), after the Regolith mood board (docs/moodboards/regolith/HexSurface.dc.html):
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
    // Mars: rust and ochre dust, and patches of dark basalt where the wind swept it bare.
    '<feComponentTransfer in="lit2" result="dust">' +
    '<feFuncR type="table" tableValues="0.03 0.13 0.33 0.55 0.74 0.88 0.96"/>' +
    '<feFuncG type="table" tableValues="0.015 0.05 0.13 0.25 0.38 0.52 0.66"/>' +
    '<feFuncB type="table" tableValues="0.01 0.03 0.07 0.13 0.21 0.31 0.43"/>' +
    '</feComponentTransfer>' +
    '<feComponentTransfer in="lit2" result="rock">' +
    '<feFuncR type="table" tableValues="0.02 0.06 0.13 0.22 0.32 0.42 0.5"/>' +
    '<feFuncG type="table" tableValues="0.015 0.045 0.1 0.16 0.23 0.31 0.39"/>' +
    '<feFuncB type="table" tableValues="0.015 0.045 0.1 0.15 0.21 0.28 0.35"/>' +
    '</feComponentTransfer>' +
    turbulence(0.009, 3, s(), 'pn') +
    '<feColorMatrix in="pn" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="pg"/>' +
    '<feComponentTransfer in="pg" result="mD"><feFuncR type="table" tableValues="0 0 0.1 0.9 1 1"/><feFuncG type="table" tableValues="0 0 0.1 0.9 1 1"/><feFuncB type="table" tableValues="0 0 0.1 0.9 1 1"/></feComponentTransfer>' +
    '<feComponentTransfer in="mD" result="mR"><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>' +
    '<feComposite in="dust" in2="mD" operator="arithmetic" k1="1" result="dustM"/>' +
    '<feComposite in="rock" in2="mR" operator="arithmetic" k1="1" result="rockM"/>' +
    '<feComposite in="dustM" in2="rockM" operator="arithmetic" k2="1" k3="1" result="ramp"/>' +
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

/** Dune ripples: a gentle slope up and a sharp drop, every 8, of bright, fairly smooth sand. */
const DUNES =
  `<linearGradient id="rg-duneG" x2="1">${stops([
    [0, 'rgb(116,120,155)'],
    [0.72, 'rgb(146,120,170)'],
    [0.82, 'rgb(114,120,150)'],
    [1, 'rgb(116,120,155)'],
  ])}</linearGradient>` +
  '<pattern id="rg-dunes" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="url(#rg-duneG)"/></pattern>' +
  radial('rg-duneFade', [
    [0, '#fff'],
    [0.55, '#fff', 0.8],
    [1, '#fff', 0],
  ]) +
  '<mask id="rg-duneMask"><ellipse rx="62" ry="38" fill="url(#rg-duneFade)"/></mask>';

/** Now and then a field of dunes, waved about, faded out at its edges. */
function dunes(r: Rng): string {
  if (!r.chance(0.6)) return '';
  const { x, y } = anywhere(r, 30);
  return (
    `<g transform="translate(${n(x)},${n(y)}) rotate(${r.int(0, 179)})" mask="url(#rg-duneMask)">` +
    `<rect x="-70" y="-45" width="140" height="90" fill="url(#rg-dunes)" filter="url(#rg-wx-d)"/></g>`
  );
}

/** Dust devils' tracks: long wandering dark streaks where they swept the bright dust off (darker only: blue is brightness). */
function tracks(r: Rng): string {
  let out = '';
  for (let i = r.int(1, 4); i > 0; i--) {
    let { x, y } = { x: r.range(0, SIZE), y: r.range(0, SIZE) };
    let a = r.range(0, 2 * Math.PI);
    let d = `M${n(x)},${n(y)}`;
    for (let s = 0; s < 8; s++) {
      a += r.range(-0.7, 0.7);
      const [mx, my] = [x + 9 * Math.cos(a), y + 9 * Math.sin(a)];
      [x, y] = [mx + 9 * Math.cos(a), my + 9 * Math.sin(a)];
      d += ` Q${n(mx)},${n(my)} ${n(x)},${n(y)}`;
    }
    out += `<path d="${d}" fill="none" stroke="rgb(255,255,${r.int(120, 160)})" stroke-width="${n(r.range(1.5, 3.5))}" stroke-linecap="round"/>`;
  }
  return `<g style="mix-blend-mode: multiply" filter="url(#rg-soft1)">${out}</g>`;
}

/** Height-map colours for the bases (red height, green smoothness, blue brightness): decks stand high and bright, sockets are sunk in them. */
const H = {
  apron: 'rgb(150,0,150)',
  deck: 'rgb(192,160,205)',
  dark: 'rgb(196,150,70)',
  socket: 'rgb(168,215,120)',
  pipe: 'rgb(176,120,200)',
  panel: 'rgb(146,220,110)',
  graded: 'rgb(128,190,128)',
};

const BUILDING_GRADIENTS =
  radial('rg-sphere', [
    [0, 'rgb(255,60,235)'],
    [0.8, 'rgb(228,60,215)'],
    [1, 'rgb(190,60,190)'],
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
  ]);

/** A piece of a base, round its planet's space in board units: the ground levelled under it, its height map, colour laid on the lit relief (by hue, so the light stays), and paint and lights over that. */
interface Part {
  grade?: string;
  heights?: string;
  tint?: string;
  paint?: string;
}

const LAYERS = ['grade', 'heights', 'tint', 'paint'] as const;

/** A part drawn round (x, y), turned by `turn` degrees and grown by `scale`. */
const placed = (x: number, y: number, part: Part, turn = 0, scale = 1): Part =>
  Object.fromEntries(
    LAYERS.map((k) => [
      k,
      part[k] &&
        `<g transform="translate(${n(x)},${n(y)})${turn ? ` rotate(${n(turn)})` : ''}${scale !== 1 ? ` scale(${n(scale)})` : ''}">${part[k]}</g>`,
    ]),
  );

const merged = (parts: Part[]): Required<Part> =>
  Object.fromEntries(LAYERS.map((k) => [k, parts.map((p) => p[k] ?? '').join('')])) as Required<Part>;

const disc = (x: number, y: number, r: number, fill: string, extra = '') =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${extra}/>`;

/** A rounded square `size` across centred on (x, y). */
const square = (x: number, y: number, size: number, rx: number, fill: string, soft = false) =>
  `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${rx}" fill="${fill}"${soft ? ' filter="url(#rg-soft1)"' : ''}/>`;

const box = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra = '') =>
  `<rect x="${n(x - w / 2)}" y="${n(y - h / 2)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}"${extra}/>`;

/** Ground levelled round a part. */
const graded = (x: number, y: number, r: number) => disc(x, y, r, H.graded, ' filter="url(#rg-soft6)"');

/** A glow of light, added to what's under it. */
const glow = (x: number, y: number, r: number, colour: string, opacity: number, soft = 'rg-soft3') =>
  disc(x, y, r, colour, ` opacity="${opacity}" filter="url(#${soft})" style="mix-blend-mode: screen"`);

/** A small light, with its glow. */
const lamp = (x: number, y: number, colour: string) => glow(x, y, 3.2, colour, 0.75, 'rg-soft1') + disc(x, y, 1, '#fff6e0');

/** A raised run (a tube, a pipe or a conduit) from a to b, `w` wide, coloured `colour`. */
function run(a: Spot, b: Spot, w: number, colour: string, height = H.pipe): Part {
  const d = `M${n(a.x)},${n(a.y)} L${n(b.x)},${n(b.y)}`;
  const line = (stroke: string, width: number, extra = '') =>
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${n(width)}" stroke-linecap="round"${extra}/>`;
  return {
    grade: line(H.graded, w + 10, ' filter="url(#rg-soft3)"'),
    heights: line(height, w),
    tint: line(colour, w + 1),
  };
}

/**
 * The hub: a deck round the planet's cube sockets (`cubePadCentres`, one per cube it holds), no larger
 * than they need, edged in amber, a light at a corner.
 */
function hub(pads: readonly Spot[], deck: string, height = H.deck, light = '#F2B233'): Part {
  const xs = pads.map((p) => p.x);
  const ys = pads.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 15, Math.max(...xs) + 15, Math.min(...ys) - 15, Math.max(...ys) + 15];
  const [w, h, cx, cy] = [x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2];
  return {
    grade: graded(cx, cy, Math.max(w, h) / 2 + 12),
    heights:
      box(cx, cy, w + 3, h + 3, 4, H.apron, ' filter="url(#rg-soft1)"') +
      box(cx, cy, w, h, 3.5, height) +
      pads.map((p) => square(p.x, p.y, 24.5, 3.4, H.socket)).join(''),
    tint: box(cx, cy, w + 1, h + 1, 3.5, deck),
    paint:
      box(cx, cy, w - 4, h - 4, 2.5, 'none', ` stroke="#F2B233" stroke-width="0.7" stroke-dasharray="3 2" opacity="0.55"`) +
      lamp(x0 + 3, y0 + 3, light) +
      lamp(x1 - 3, y1 - 3, light),
  };
}

/** A point `d` spaces from the planet's space at `angle` degrees (0 right, y down), in board units. */
const toward = (angle: number, d: number): Spot => ({
  x: d * SPACE * Math.cos((angle * Math.PI) / 180),
  y: d * SPACE * Math.sin((angle * Math.PI) / 180),
});

/**
 * The ways a base may spread from its planet's space, best first in a random order: towards the neighbouring
 * hexes (flat-topped, so they meet it at 30° + k·60°) that are on the tile, and not past the number's corner.
 */
function exits(r: Rng, at: Spot, numbered: boolean): number[] {
  const k = numberCorner(at, 'hex');
  const corner = (Math.atan2(k.y * 0.5, (k.x * 0.5) / Math.sqrt(3)) * 180) / Math.PI;
  return [-90, -30, 30, 90, 150, 210]
    .filter((a) => {
      const { x, y } = toward(a, 1);
      const off = Math.abs(((((a - corner) % 360) + 540) % 360) - 180);
      return Math.hypot(at.x + x / SPACE, at.y + y / SPACE) < 1.01 && (!numbered || off > 50);
    })
    .map((a) => ({ a, k: r.next() }))
    .sort((p, q) => p.k - q.k)
    .map((p) => p.a);
}

/** A glass dome `size` across, its plants glowing through it. */
function dome(size: number, glass: string, plants: string): Part {
  const spokes = [0, 60, 120]
    .map((a) => {
      const { x, y } = { x: size * Math.cos((a * Math.PI) / 180), y: size * Math.sin((a * Math.PI) / 180) };
      return `M${n(-x)},${n(-y)} L${n(x)},${n(y)}`;
    })
    .join(' ');
  return {
    grade: graded(0, 0, size + 7),
    heights: disc(0, 0, size + 2, H.deck) + disc(0, 0, size, 'url(#rg-dome)'),
    tint: disc(0, 0, size + 2.5, '#8d969c') + disc(0, 0, size, glass),
    paint:
      glow(0, 0, size * 0.65, plants, 0.45) +
      `<g fill="none" stroke="#e6fff6" stroke-width="0.4" opacity="0.4"><circle r="${n(size * 0.5)}"/><circle r="${n(size * 0.85)}"/><path d="${spokes}"/></g>` +
      `<ellipse cx="${n(-size * 0.35)}" cy="${n(-size * 0.4)}" rx="${n(size * 0.3)}" ry="${n(size * 0.18)}" transform="rotate(-40 ${n(-size * 0.35)} ${n(-size * 0.4)})" fill="#fff" opacity="0.45" filter="url(#rg-soft1)"/>`,
  };
}

/** Solar panels in two rows, across the way they're turned. */
function solar(): Part {
  const cells = [-1, 0, 1].flatMap((i) => [-1, 1].map((j) => ({ x: i * 10.5, y: j * 4.2 })));
  const each = (f: (c: Spot) => string) => cells.map(f).join('');
  return {
    grade: graded(0, 0, 22),
    heights: box(0, 0, 3, 18, 0.5, H.pipe) + each((c) => box(c.x, c.y, 9.5, 7, 0.5, H.panel)),
    tint: each((c) => box(c.x, c.y, 9.5, 7, 0.5, '#2448b8')),
    paint:
      each((c) => box(c.x, c.y, 9.5, 7, 0.5, 'none', ' stroke="#bfe6ff" stroke-width="0.3" opacity="0.6"')) +
      each(
        (c) =>
          `<path d="M${n(c.x - 4.75)},${n(c.y)} H${n(c.x + 4.75)} M${n(c.x)},${n(c.y - 3.5)} V${n(c.y + 3.5)}" stroke="#bfe6ff" stroke-width="0.2" opacity="0.4"/>`,
      ) +
      glow(-6, -2, 6, '#9fd8ff', 0.18),
  };
}

/** A sphere tank, gold, banded. */
const tank = (x: number, y: number, r: number): Part => ({
  heights: disc(x, y, r + 1.2, H.apron) + disc(x, y, r, 'url(#rg-sphere)'),
  tint: disc(x, y, r + 1, '#f2ad2c'),
  paint:
    `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.62)}" fill="none" stroke="#5b3a08" stroke-width="0.6" opacity="0.5"/>` +
    disc(x - r * 0.35, y - r * 0.35, r * 0.28, '#fffbe8', ' opacity="0.7" filter="url(#rg-soft1)"'),
});

/** A tall flare stack, burning off gas. */
const flare = (): Part => ({
  grade: graded(0, 0, 14),
  heights: square(0, 0, 11, 1, H.dark) + disc(0, 0, 3.2, 'rgb(250,120,200)'),
  tint: square(0, 0, 11.5, 1, '#55504a') + disc(0, 0, 3.4, '#c9c4bc'),
  paint:
    glow(-1, -1, 11, '#ff6a10', 0.55, 'rg-soft6') +
    glow(-1, -1, 5, '#ff9a2a', 0.85) +
    glow(-1, -1, 2.2, '#ffe9a0', 1, 'rg-soft1') +
    disc(-1, -1, 0.9, '#fff'),
});

/** Process columns in a row on a platform, copper. */
const columns = (): Part => ({
  grade: graded(0, 0, 22),
  heights: box(0, 0, 38, 13, 2, H.deck) + [-13.5, -4.5, 4.5, 13.5].map((x, i) => disc(x, 0, i % 2 ? 4 : 4.8, 'url(#rg-sphere)')).join(''),
  tint: box(0, 0, 38.5, 13.5, 2, '#8e8a86') + [-13.5, -4.5, 4.5, 13.5].map((x, i) => disc(x, 0, i % 2 ? 4.3 : 5.1, '#d4802a')).join(''),
  paint: [-13.5, -4.5, 4.5, 13.5].map((x) => disc(x - 1.4, -1.4, 1.2, '#fff4d8', ' opacity="0.7"')).join('') + lamp(-17, 5, '#ff3b2a'),
});

/** An open pit stepping down to glowing ice. */
const pit = (): Part => ({
  grade: graded(0, 0, 30),
  heights: [24, 18.5, 13, 8]
    .map((r, i) => disc(0, 0, r, `rgb(${116 - i * 16},${170 + i * 20},${150 + i * 20})`, i ? '' : ' filter="url(#rg-wx-y)"'))
    .join(''),
  tint: disc(0, 0, 24, '#bfd9e6'),
  paint:
    glow(0, 0, 13, '#3fe6ff', 0.55, 'rg-soft6') +
    glow(0, 0, 6.5, '#7ff5ff', 0.85) +
    `<path d="M-3,-2 L1,-4 L4,0 L1,3 L-2,2 Z" fill="#effeff" opacity="0.85" filter="url(#rg-soft1)"/>` +
    `<circle r="24" fill="#eaf6ff" opacity="0.18" filter="url(#rg-soft3)" style="mix-blend-mode: screen"/>`,
});

/** A drill rig: a lattice tower, its light on top. */
const rig = (): Part => ({
  grade: graded(0, 0, 14),
  heights:
    `<rect x="-6.5" y="-6.5" width="13" height="13" fill="none" stroke="${H.pipe}" stroke-width="2"/>` +
    `<path d="M-6.5,-6.5 L6.5,6.5 M6.5,-6.5 L-6.5,6.5" stroke="rgb(220,120,200)" stroke-width="1.6"/>` +
    disc(0, 0, 2.6, 'rgb(250,120,210)'),
  tint: square(0, 0, 15, 0, '#e8eef2'),
  paint: `<path d="M-6.5,-6.5 L6.5,6.5 M6.5,-6.5 L-6.5,6.5" stroke="#fff" stroke-width="0.4" opacity="0.5"/>` + lamp(0, 0, '#ff3b3b'),
});

/** Ice silos, white with blue caps. */
const silos = (): Part => {
  const xs = [-11, 0, 11];
  return {
    grade: graded(0, 0, 20),
    heights: xs.map((x) => disc(x, 0, 5.6, 'url(#rg-dome)')).join(''),
    tint: xs.map((x) => disc(x, 0, 6, '#eef5fb')).join(''),
    paint: xs.map((x) => disc(x, 0, 2.2, '#2f8fff', ' opacity="0.9"') + disc(x - 0.6, -0.6, 0.7, '#dff1ff')).join(''),
  };
};

/** A cooling tower: a dark ring round a hot glowing throat. */
const coolingTower = (): Part => ({
  grade: graded(0, 0, 21),
  heights: disc(0, 0, 15.5, H.apron, ' filter="url(#rg-soft1)"') + disc(0, 0, 14.5, 'rgb(240,170,80)') + disc(0, 0, 10, 'rgb(70,200,40)'),
  tint: disc(0, 0, 15.5, '#2e2c30'),
  paint:
    glow(0, 0, 10, '#ff3c0a', 0.75, 'rg-soft3') +
    glow(0, 0, 5.5, '#ffa41f', 0.9) +
    glow(0, 0, 2.4, '#fff1b0', 1, 'rg-soft1') +
    `<circle r="12.3" fill="none" stroke="#ff7a1a" stroke-width="0.5" stroke-dasharray="1 2.2" opacity="0.8"/>`,
});

/** Radiator fins, black, heat glowing between them. */
const radiators = (): Part => {
  const xs = [-12, -6, 0, 6, 12];
  return {
    grade: graded(0, 0, 22),
    heights: xs.map((x) => box(x, 0, 3.2, 24, 0.6, 'rgb(220,150,70)')).join(''),
    tint: box(0, 0, 28, 25, 1, '#2a282c'),
    paint:
      [-9, -3, 3, 9]
        .map(
          (x) =>
            `<path d="M${x},-11 V11" stroke="#ff6a00" stroke-width="1.6" opacity="0.6" filter="url(#rg-soft1)" style="mix-blend-mode: screen"/>`,
        )
        .join('') + [-9, -3, 3, 9].map((x) => `<path d="M${x},-10 V10" stroke="#ffc060" stroke-width="0.4" opacity="0.9"/>`).join(''),
  };
};

/** A conduit carrying power, glowing along its length. */
function conduit(a: Spot, b: Spot, colour: string): Part {
  const d = `M${n(a.x)},${n(a.y)} L${n(b.x)},${n(b.y)}`;
  return {
    ...run(a, b, 4, '#2a282c', H.dark),
    paint:
      `<path d="${d}" stroke="${colour}" stroke-width="3.5" opacity="0.5" filter="url(#rg-soft1)" style="mix-blend-mode: screen"/>` +
      `<path d="${d}" stroke="#ffe2a0" stroke-width="0.6" stroke-dasharray="3 2"/>`,
  };
}

/** Crystals jutting from the ground, violet, catching light. */
function crystals(r: Rng, count: number, reach: number): Part {
  let heights = '';
  let tint = '';
  let paint = '';
  for (let i = 0; i < count; i++) {
    const a = r.range(0, 360);
    const d = reach * r.range(0.85, 1.12);
    const { x, y } = { x: d * Math.cos((a * Math.PI) / 180), y: d * Math.sin((a * Math.PI) / 180) };
    const [len, w] = [r.range(8, 15), r.range(2.5, 4.5)];
    const shard = `M0,${n(-w)} L${n(len)},0 L0,${n(w)} L${n(-len * 0.25)},0 Z`;
    const at = `translate(${n(x)},${n(y)}) rotate(${n(a + r.range(-30, 30))})`;
    heights += `<path d="${shard}" transform="${at}" fill="rgb(245,230,240)"/>`;
    tint += `<path d="${shard}" transform="${at}" fill="#9a5cff" stroke="#9a5cff" stroke-width="1"/>`;
    paint +=
      `<path d="M0,0 L${n(len)},0" transform="${at}" stroke="#f1e4ff" stroke-width="0.5" opacity="0.8"/>` +
      `<path d="${shard}" transform="${at}" fill="#b07bff" opacity="0.5" filter="url(#rg-soft1)" style="mix-blend-mode: screen"/>`;
  }
  return { heights, tint, paint };
}

/** Glowing cracks running out from a point, jagged, `reach` long. */
function fissures(r: Rng, count: number, from: number, reach: number): Part {
  let heights = '';
  let paint = '';
  for (let i = 0; i < count; i++) {
    let a = r.range(0, 2 * Math.PI);
    let [x, y] = [from * Math.cos(a), from * Math.sin(a)];
    let d = `M${n(x)},${n(y)}`;
    for (let s = 0; s < 6; s++) {
      a += r.range(-0.5, 0.5);
      const step = reach / 6;
      [x, y] = [x + step * Math.cos(a), y + step * Math.sin(a)];
      d += ` L${n(x)},${n(y)}`;
    }
    heights += `<path d="${d}" fill="none" stroke="rgb(80,0,128)" stroke-width="2" stroke-linejoin="round"/>`;
    paint +=
      `<path d="${d}" fill="none" stroke="#a46bff" stroke-width="4" opacity="0.45" filter="url(#rg-soft1)" style="mix-blend-mode: screen"/>` +
      `<path d="${d}" fill="none" stroke="#e2ccff" stroke-width="0.7" stroke-linejoin="round" opacity="0.9"/>`;
  }
  return { heights, paint };
}

/** A landing pad ringed in amber, now and then with a lander standing on it. */
function landingPad(lander: boolean, light: string): Part {
  const legs = [45, 135, 225, 315].map((a) => toward(a, 0.11));
  const lamps = [0, 90, 180, 270].map((a) => toward(a, 0.19));
  return {
    grade: graded(0, 0, 20),
    heights:
      disc(0, 0, 15, H.apron, ' filter="url(#rg-soft1)"') +
      disc(0, 0, 14, H.deck) +
      (lander
        ? legs
            .map((l) => `<path d="M0,0 L${n(l.x)},${n(l.y)}" stroke="${H.pipe}" stroke-width="1.4"/>` + disc(l.x, l.y, 1.6, H.pipe))
            .join('') + disc(0, 0, 5, 'url(#rg-dome)')
        : ''),
    tint: disc(0, 0, 15, '#8d969c') + (lander ? disc(0, 0, 5.5, '#f2f2f2') : ''),
    paint:
      '<circle r="11" fill="none" stroke="#F2B233" stroke-width="1.2" stroke-dasharray="4 2.6" opacity="0.8"/>' +
      (lander
        ? '<circle r="3.2" fill="none" stroke="#e8322a" stroke-width="1"/>'
        : '<path d="M-4,-4 V4 M4,-4 V4 M-4,0 H4" stroke="#F2B233" stroke-width="1.3" opacity="0.85"/>') +
      lamps.map((l) => lamp(l.x, l.y, light)).join(''),
  };
}

/** How much larger than drawn a base's outbuildings stand, reaching well into the hexes round it. */
const BIG = 1.35;

/**
 * The base on a planet's space, after the planets' own colours: a hub round its cube sockets (one per cube
 * the planet holds), and buildings reaching out into the hexes round it, joined to it: for a 7 a habitat
 * of green glass domes and solar panels; for an 8 a refinery, gold tanks and a burning flare stack; for a 9
 * an ice mine, its pit glowing blue in a ring of frost; for a 10 a black reactor with red-hot cooling towers;
 * and on a Void tile a sinkhole ringed by violet crystals, its cracks glowing. A base with room to spare
 * has a landing pad too. Centred on the planet's space, in board units. `at` is where the planet sits on
 * its tile (in spaces from the middle).
 */
function base(number: number, at: Spot, r: Rng): Required<Part> | undefined {
  const pads = cubePadCentres(number - 6, 0, 0).map((p) => ({ x: p.x / SCALE, y: p.y / SCALE }));
  const ways = exits(r, at, number > 0);
  const out = (i: number, d: number, f: (p: Spot, a: number, from: Spot) => Part[]): Part[] => {
    const a = ways[i];
    // Links start at the hub's edge, so none crosses the cube sockets.
    return a === undefined ? [] : f(toward(a, d), a, toward(a, 0.3));
  };
  const pad = (light: string) =>
    out(3, 0.74, (p, _, from) => [run(from, p, 3, '#8d969c'), placed(p.x, p.y, landingPad(r.chance(0.6), light), 0, 1.15)]);
  switch (number) {
    case 0:
      return merged([
        { heights: disc(0, 0, 46, 'url(#rg-sink)', ' filter="url(#rg-wx-m)"') },
        fissures(r, r.int(4, 5), 32, 62),
        crystals(r, r.int(7, 10), 36),
        crystals(r, r.int(2, 3), 60),
        {
          paint:
            glow(0, 0, 24, '#6a2cff', 0.6, 'rg-soft6') +
            glow(0, 0, 8, '#d6b8ff', 0.75) +
            disc(0, 0, 14, '#000', ' opacity="0.35" filter="url(#rg-soft3)"'),
        },
      ]);
    case 7:
      return merged([
        ...out(0, 0.72, (p, _, from) => [
          run(from, p, 7, '#a7b0b6'),
          placed(p.x, p.y, dome(19, '#2fcf8c', '#6dff9e'), 0, BIG),
          { paint: lamp(p.x + 22, p.y - 12, '#7dffb0') },
        ]),
        ...out(1, 0.68, (p, a, from) => {
          const side = toward(a + 90, 0.2);
          const [d1, d2] = [
            { x: p.x + side.x, y: p.y + side.y },
            { x: p.x - side.x, y: p.y - side.y },
          ];
          return [
            run(from, p, 6, '#a7b0b6'),
            run(d1, d2, 5, '#a7b0b6'),
            placed(d1.x, d1.y, dome(9, '#3ab8e8', '#8fe8ff'), 0, BIG),
            placed(d2.x, d2.y, dome(7.5, '#3ab8e8', '#8fe8ff'), 0, BIG),
          ];
        }),
        ...out(2, 0.76, (p, a, from) => [run(from, p, 2.5, '#8d969c'), placed(p.x, p.y, solar(), a + 90, BIG)]),
        ...pad('#7dffb0'),
        hub(pads, '#9aa3a8', H.deck, '#7dffb0'),
      ]);
    case 8:
      return merged([
        ...out(0, 0.74, (p, a, from) => {
          const spots = [0, 120, 240].map((t) => toward(a + t + 30, 0.23)).map((s) => ({ x: p.x + s.x, y: p.y + s.y }));
          const side = toward(a + 90, 0.05);
          return [
            run({ x: from.x + side.x, y: from.y + side.y }, p, 3, '#f2ad2c'),
            run({ x: from.x - side.x, y: from.y - side.y }, p, 3, '#f2ad2c'),
            { grade: graded(p.x, p.y, 34) },
            ...spots.map((s) => tank(s.x, s.y, 12.5)),
            { paint: lamp(p.x, p.y, '#ffcf4a') },
          ];
        }),
        ...out(1, 0.66, (p, _, from) => [run(from, p, 3, '#c9c4bc'), placed(p.x, p.y, flare(), 0, BIG)]),
        ...out(2, 0.76, (p, a, from) => [run(from, p, 3.5, '#d4802a'), placed(p.x, p.y, columns(), a + 90, BIG)]),
        ...pad('#ffcf4a'),
        hub(pads, '#a59c90'),
      ]);
    case 9:
      return merged([
        { grade: disc(0, 0, 60, 'url(#rg-frost)', ' style="mix-blend-mode: lighten"'), paint: glow(0, 0, 58, '#d6ecff', 0.28, 'rg-soft6') },
        ...out(0, 0.8, (p, _, from) => [
          {
            grade: `<path d="M${n(from.x)},${n(from.y)} L${n(p.x)},${n(p.y)}" stroke="${H.graded}" stroke-width="14" filter="url(#rg-soft3)"/>`,
          },
          {
            paint: `<path d="M${n(from.x)},${n(from.y)} L${n(p.x)},${n(p.y)}" stroke="#e6eef2" stroke-width="0.9" stroke-dasharray="2.5 2" opacity="0.6"/>`,
          },
          placed(p.x, p.y, pit(), 0, BIG),
        ]),
        ...out(1, 0.66, (p, _, from) => [run(from, p, 3.5, '#e8eef2'), placed(p.x, p.y, rig(), 0, 1.6)]),
        ...out(2, 0.74, (p, a, from) => [run(from, p, 3.5, '#e8eef2'), placed(p.x, p.y, silos(), a + 90, BIG)]),
        ...pad('#7fe9ff'),
        hub(pads, '#c4ced4', H.deck, '#7fe9ff'),
      ]);
    case 10: {
      const vents = [
        [37, 0],
        [-37, 0],
        [0, 37],
        [0, -37],
      ];
      const octagon = (s: number) =>
        [
          [1, 0.41],
          [0.41, 1],
          [-0.41, 1],
          [-1, 0.41],
          [-1, -0.41],
          [-0.41, -1],
          [0.41, -1],
          [1, -0.41],
        ]
          .map(([x, y]) => `${n(x * s)},${n(y * s)}`)
          .join(' ');
      // The conduits start at the reactor's edge.
      const edge = (a: number) => toward(a, 0.6);
      return merged([
        ...out(0, 0.82, (p, a) => [conduit(edge(a), p, '#ff5a14'), placed(p.x, p.y, coolingTower(), 0, 1.25)]),
        ...out(1, 0.82, (p, a) => [conduit(edge(a), p, '#ff5a14'), placed(p.x, p.y, coolingTower(), 0, 1.1)]),
        ...out(2, 0.84, (p, a) => [conduit(edge(a), p, '#ff5a14'), placed(p.x, p.y, radiators(), a + 90, 1.2)]),
        ...out(3, 0.84, (p, a) => [conduit(edge(a), p, '#ff5a14'), placed(p.x, p.y, radiators(), a + 90, 1.1)]),
        {
          grade: graded(0, 0, 52),
          heights:
            `<polygon points="${octagon(45)}" fill="${H.apron}" filter="url(#rg-soft1)"/>` +
            `<polygon points="${octagon(44)}" fill="${H.dark}"/>` +
            `<g fill="rgb(150,40,90)">${vents.map(([x, y]) => `<rect x="-5" y="-5" width="10" height="10" transform="translate(${x},${y}) rotate(45)"/>`).join('')}</g>`,
          tint: `<polygon points="${octagon(45)}" fill="#2e2c30"/>`,
          paint:
            `<polygon points="${octagon(41)}" fill="none" stroke="#ff5a14" stroke-width="0.8" opacity="0.6"/>` +
            vents.map(([x, y]) => glow(x, y, 5, '#ff4a0a', 0.8) + glow(x, y, 2, '#ffd27a', 1, 'rg-soft1')).join(''),
        },
        hub(pads, '#3a383c', H.dark, '#ff7a1a'),
      ]);
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

/** A tile's Mars ground over its trim and bleed (mm, the trim's top left at 0, 0), its base standing `at` its planet's space. */
function regolithArt(spec: TileSpec, at: Spot): Fragment {
  const r = rng(spec.seed).fork('regolith');
  const site = base(spec.number, at, r.fork('base'));
  const [bx, by] = [SIZE / 2 + at.x * SPACE, SIZE / 2 + at.y * SPACE];
  const place = (f: string) => `<g transform="translate(${n(bx)},${n(by)})">${f}</g>`;
  const ridges = Array.from({ length: r.int(0, 2) }, () => {
    const { x, y } = anywhere(r, 34);
    return `<use href="#rg-ridge" transform="translate(${n(x)},${n(y)}) rotate(${r.int(-40, 40)})"/>`;
  }).join('');
  const heights =
    `<rect x="${n(DRAWN.x)}" y="${n(DRAWN.y)}" width="${n(DRAWN.w)}" height="${n(DRAWN.h)}" fill="rgb(128,0,128)"/>` +
    dunes(r.fork('dunes')) +
    tracks(r.fork('tracks')) +
    ridges +
    craters(r, 'o', r.int(1, 2), 0.6, 1.4) +
    (r.chance(0.25) ? craters(r, 'big', 1, 0.8, 1.05) : '') +
    craters(r, 'm', r.int(1, 2), 0.32, 0.8) +
    craters(r, 'y', r.int(1, 2), 0.24, 0.6) +
    // As many on the flower as there were when they were strewn past the tile's square too.
    pits(r.fork('pits'), 55, 0.45, 1.12) +
    pits(r.fork('small'), 21, 1.2, 5.6) +
    boulders(r.fork('boulders'), 1, 15) +
    // The ground is levelled round a base, smoothing over any crater there, then it's built.
    (site ? place(site.grade + site.heights) : '');
  const filters =
    blur('rg-soft1', 1) +
    blur('rg-soft3', 3) +
    blur('rg-soft6', 6) +
    weather('rg-wx-y', 0.07, r.noiseSeed(), 5, 0.5) +
    weather('rg-wx-m', 0.06, r.noiseSeed(), 7, 1.3) +
    weather('rg-wx-o', 0.05, r.noiseSeed(), 10, 2.6) +
    weather('rg-wx-p', 0.3, r.noiseSeed(), 1.8, 0.6, 'x="0" y="0" width="100%" height="100%"') +
    weather('rg-wx-d', 0.02, r.noiseSeed(), 14, 0.4);
  return {
    defs: GRADIENTS + BUILDING_GRADIENTS + DUNES + filters + ground(r.fork('ground'), DRAWN) + CRATERS + RIDGE,
    body:
      `<g transform="scale(${n(SCALE)})"><g filter="url(#rg-ground)">${heights}</g>` +
      (site ? place(`<g style="mix-blend-mode: color">${site.tint}</g>${site.paint}`) : '') +
      '</g>',
  };
}

/**
 * A hex tile's Mars ground, in place of its sky and planet, trim 96 × 96 mm and its 3 mm bleed (so a map's
 * clip a touch past the hexes still lands on ground): the planet's building stands `at` its space (in
 * spaces from the tile's middle, x right and y down). No markings: the game draws the cubes and the
 * number over its bays.
 */
export function regolithSvg(spec: TileSpec, at: Spot = { x: 0, y: 0 }): string {
  return document(regolithArt(spec, at), BLED, true);
}

/**
 * A hex tile on Mars as printed (`tileSvg` with the Mars ground for its art): knocked out past its
 * flower, with its markings, the cube pads in the building's bays.
 */
export const regolithTileSvg = (spec: TileSpec, o: Omit<TileOptions, 'shape' | 'ground'> = {}): string =>
  tileSvg(spec, { ...o, shape: 'hex', ground: (at) => regolithArt(spec, at) });
