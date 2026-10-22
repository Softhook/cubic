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

/**
 * The buildings' own light, over `area`: made, not weathered, so no fine noise, dust colour or grain, and
 * hard-edged, each standing up sharply from nothing, so its outline catches the light or falls in shadow.
 * Their heights are in the ground's map too, so they still cast their shadows on it.
 */
function built(r: Rng, area: Box): string {
  const light = '<feDistantLight azimuth="225" elevation="38"/>';
  const ramp = (values: string) => `type="table" tableValues="${values}"`;
  return (
    `<filter id="rg-built" filterUnits="userSpaceOnUse" x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" color-interpolation-filters="sRGB">` +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="H"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0" result="SMOOTH"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 0 1" result="ALB"/>' +
    `<feDiffuseLighting in="H" surfaceScale="7" diffuseConstant="1.2" lighting-color="#ffffff" result="L">${light}</feDiffuseLighting>` +
    // Worn: brightness mottled by grime in patches and flecks, larger and finer than the ground's grain.
    turbulence(0.07, 3, r.noiseSeed(), 'gm') +
    '<feColorMatrix in="gm" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="gmG"/>' +
    turbulence(0.45, 2, r.noiseSeed(), 'gf') +
    '<feColorMatrix in="gf" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="gfG"/>' +
    '<feComposite in="ALB" in2="gmG" operator="arithmetic" k1="1.3" k2="0.33" result="alb1"/>' +
    '<feComposite in="alb1" in2="gfG" operator="arithmetic" k1="0.5" k2="0.75" result="ALBW"/>' +
    '<feComposite in="L" in2="ALBW" operator="arithmetic" k1="1.15" result="lit"/>' +
    `<feSpecularLighting in="H" surfaceScale="7" specularConstant="0.35" specularExponent="18" lighting-color="#ffffff" result="spec">${light}</feSpecularLighting>` +
    '<feComposite in="spec" in2="SMOOTH" operator="in" result="specM"/>' +
    '<feComposite in="lit" in2="specM" operator="arithmetic" k2="1" k3="0.6" result="lit2"/>' +
    `<feComponentTransfer in="lit2"><feFuncR ${ramp('0.03 0.17 0.39 0.61 0.81 0.95')}/><feFuncG ${ramp('0.035 0.18 0.4 0.62 0.82 0.96')}/><feFuncB ${ramp('0.045 0.2 0.42 0.64 0.84 0.97')}/></feComponentTransfer>` +
    '<feComposite in2="SourceAlpha" operator="in"/>' +
    '</filter>'
  );
}

/**
 * The shadows the buildings cast on the ground, away from the light (to the bottom right), as long as
 * they're tall: each height (red, 128 the ground) stands in its shadow that much further along, so a dome
 * or a tank throws a long one and a deck or a pipe a short one. Over `area`.
 */
function cast(area: Box): string {
  const levels = Array.from({ length: 12 }, (_, i) => 0.52 + i * 0.04);
  return (
    `<filter id="rg-cast" filterUnits="userSpaceOnUse" x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" color-interpolation-filters="sRGB">` +
    levels
      .map((t, i) => {
        const d = n((t - 0.5) * 42);
        return (
          `<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  40 0 0 0 ${n(-40 * t)}" result="a${i}"/>` +
          `<feOffset in="a${i}" dx="${d}" dy="${d}" result="s${i}"/>`
        );
      })
      .join('') +
    `<feMerge>${levels.map((_, i) => `<feMergeNode in="s${i}"/>`).join('')}</feMerge>` +
    '<feGaussianBlur stdDeviation="0.9"/>' +
    '<feComponentTransfer><feFuncA type="linear" slope="0.85"/></feComponentTransfer>' +
    '</filter>'
  );
}

/** Mars dust settled on the buildings, in drifts: their shapes (`SourceAlpha`) filled with dust where noise says, over `area`. */
const dust = (seed: number, area: Box) =>
  `<filter id="rg-dust" filterUnits="userSpaceOnUse" x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}" color-interpolation-filters="sRGB">` +
  turbulence(0.03, 3, seed, 'dn') +
  '<feColorMatrix in="dn" type="matrix" values="0 0 0 0 0.66  0 0 0 0 0.38  0 0 0 0 0.22  3 0 0 0 -1.1"/>' +
  '<feComposite in2="SourceAlpha" operator="in"/>' +
  '</filter>';

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
  dark: 'rgb(196,150,42)',
  socket: 'rgb(168,215,120)',
  pipe: 'rgb(176,120,200)',
  panel: 'rgb(146,220,110)',
  graded: 'rgb(128,190,128)',
};

const BUILDING_GRADIENTS =
  `<linearGradient id="rg-vault" x2="0" y2="1">${stops([
    [0, 'rgb(165,255,120)'],
    [0.5, 'rgb(225,255,150)'],
    [1, 'rgb(165,255,120)'],
  ])}</linearGradient>` +
  radial('rg-sphere', [
    [0, 'rgb(255,60,235)'],
    [0.8, 'rgb(228,60,215)'],
    [1, 'rgb(190,60,190)'],
  ]) +
  radial('rg-glass', [
    [0, 'rgb(250,255,150)'],
    [0.6, 'rgb(228,255,140)'],
    [0.88, 'rgb(185,255,125)'],
    [1, 'rgb(150,255,115)'],
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
  /** How far it reaches from its middle: the circle it stands in, before it's placed. */
  extent?: number;
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

/** A part's drawing, layer by layer. */
type Drawn = Record<(typeof LAYERS)[number], string>;

const merged = (parts: Part[]): Drawn => Object.fromEntries(LAYERS.map((k) => [k, parts.map((p) => p[k] ?? '').join('')])) as Drawn;

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
      box(cx, cy, w + 3, h + 3, 4, H.apron) +
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

/** A glass dome `size` across, its plants glowing through it; its frame starts `clear` out from its middle, past a hatch there. */
function dome(size: number, glass: string, plants: string, clear = 0): Part {
  const spokes = [0, 60, 120, 180, 240, 300]
    .map((a) => {
      const [c, s] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
      return `M${n(clear * c)},${n(clear * s)} L${n(size * c)},${n(size * s)}`;
    })
    .join(' ');
  const rings = [0.5, 0.85, 0.94].filter((k) => k * size > clear + 1);
  return {
    grade: graded(0, 0, size + 7),
    heights: disc(0, 0, size + 2, H.deck) + disc(0, 0, size, 'url(#rg-glass)'),
    tint: disc(0, 0, size + 2.5, '#8d969c') + disc(0, 0, size, glass),
    paint:
      glow(0, 0, size * 0.65, plants, 0.45) +
      `<g fill="none" stroke="#1e2426" stroke-width="0.5" opacity="0.55">${rings.map((k) => `<circle r="${n(size * k)}"/>`).join('')}<path d="${spokes}"/></g>` +
      `<ellipse cx="${n(-size * 0.35)}" cy="${n(-size * 0.4)}" rx="${n(size * 0.3)}" ry="${n(size * 0.18)}" transform="rotate(-40 ${n(-size * 0.35)} ${n(-size * 0.4)})" fill="#fff" opacity="0.22" filter="url(#rg-soft1)"/>`,
  };
}

/** Up to `count` things in a row `gap` apart, centred on 0. */
const row = (count: number, gap: number) => Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * gap);

/** One to three greenhouse halls side by side: vaulted violet glass, magenta grow lights under it. */
function greenhouses(r: Rng): Part {
  const ys = row(r.pick([1, 2, 2, 3]), 13);
  const len = r.range(26, 38);
  const ribs = row(Math.floor(len / 4.5), 4.5)
    .map((x) => `M${n(x)},-4.5 V4.5`)
    .join(' ');
  return {
    extent: Math.hypot(len / 2 + 1, (ys.length * 13 - 2.5) / 2),
    grade: graded(0, 0, len / 2 + 8),
    heights: ys.map((y) => box(0, y, len + 2, 10.5, 5, H.apron) + box(0, y, len, 9, 4.5, 'url(#rg-vault)')).join(''),
    tint: ys.map((y) => box(0, y, len + 2, 10.5, 5, '#8e72c4')).join(''),
    paint: ys
      .map(
        (y) =>
          `<ellipse cx="0" cy="${n(y)}" rx="${n(len * 0.4)}" ry="3" fill="#ff5fd2" opacity="0.4" filter="url(#rg-soft1)" style="mix-blend-mode: screen"/>` +
          `<path d="${ribs}" transform="translate(0,${n(y)})" stroke="#1e2426" stroke-width="0.45" opacity="0.5"/>`,
      )
      .join(''),
  };
}

/** Small blue domes, one to three, joined in a line. */
function domelets(r: Rng): Part {
  const xs = row(r.int(1, 3), 26);
  return {
    extent: (xs.length - 1) * 13 + 13,
    ...merged([
      ...(xs.length > 1 ? [run({ x: xs[0], y: 0 }, { x: xs[xs.length - 1], y: 0 }, 5, '#a7b0b6')] : []),
      ...xs.map((x) => placed(x, r.range(-3, 3), dome(r.range(6.5, 10), '#4b93b5', '#8fe8ff'))),
    ]),
  };
}

/** Solar panels, one or two rows of two to four, across the way they're turned. */
function solar(r: Rng): Part {
  const cells = row(r.int(2, 4), 10.5).flatMap((x) => row(r.pick([1, 2, 2]), 8.4).map((y) => ({ x, y })));
  const each = (f: (c: Spot) => string) => cells.map(f).join('');
  const span = Math.max(...cells.map((c) => Math.abs(c.x))) + 6;
  return {
    extent: Math.hypot(span, Math.max(...cells.map((c) => Math.abs(c.y))) + 3.5),
    grade: graded(0, 0, span + 6),
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

/** Two to four gold tanks in a huddle, sizes mixed, far enough apart that none touches the next. */
function tankFarm(r: Rng): Part {
  const count = r.int(2, 4);
  // Tanks up to 12.2 across with their aprons, a little clear ground between.
  const spread = [13, 15, 18][count - 2];
  const turn = r.range(0, 360);
  const spots = Array.from({ length: count }, (_, i) => {
    const a = ((turn + (360 * i) / count) * Math.PI) / 180;
    return { x: spread * Math.cos(a), y: spread * Math.sin(a) };
  });
  return {
    extent: spread + 12.2,
    ...merged([{ grade: graded(0, 0, 32) }, ...spots.map((s) => tank(s.x, s.y, r.range(8, 11))), { paint: lamp(0, 0, '#ffcf4a') }]),
  };
}

/** One or two tall flare stacks, burning off gas. */
function flares(r: Rng): Part {
  const xs = row(r.pick([1, 1, 2]), 15);
  return {
    extent: (xs.length - 1) * 7.5 + 8,
    ...merged(
      xs.map((x) =>
        placed(x, 0, {
          grade: graded(0, 0, 14),
          heights: square(0, 0, 11, 1, H.dark) + disc(0, 0, 3.2, 'rgb(250,120,200)'),
          tint: square(0, 0, 11.5, 1, '#55504a') + disc(0, 0, 3.4, '#c9c4bc'),
          paint:
            glow(-1, -1, 11, '#ff6a10', 0.55, 'rg-soft6') +
            glow(-1, -1, 5, '#ff9a2a', 0.85) +
            glow(-1, -1, 2.2, '#ffe9a0', 1, 'rg-soft1') +
            disc(-1, -1, 0.9, '#fff'),
        }),
      ),
    ),
  };
}

/** Three to five process columns in a row on a platform, copper. */
function columns(r: Rng): Part {
  const xs = row(r.int(3, 5), 11.5);
  const len = xs.length * 11.5 + 1;
  const size = xs.map(() => r.range(3.6, 5.2));
  return {
    extent: Math.hypot(len / 2, 6.75),
    grade: graded(0, 0, len / 2 + 6),
    heights: box(0, 0, len, 13, 2, H.deck) + xs.map((x, i) => disc(x, 0, size[i], 'url(#rg-sphere)')).join(''),
    tint: box(0, 0, len + 0.5, 13.5, 2, '#8e8a86') + xs.map((x, i) => disc(x, 0, size[i] + 0.3, '#d4802a')).join(''),
    paint: xs.map((x) => disc(x - 1.4, -1.4, 1.2, '#fff4d8', ' opacity="0.7"')).join('') + lamp(-len / 2 + 2, 5, '#ff3b2a'),
  };
}

/** An open pit stepping down to glowing ice, three to five benches deep. */
function pit(r: Rng): Part {
  const steps = r.int(3, 5);
  const outer = r.range(19, 26);
  return {
    extent: outer,
    // Dug ground, not built: lit with the surface.
    grade:
      graded(0, 0, outer + 6) +
      Array.from({ length: steps }, (_, i) => {
        const k = i / steps;
        return disc(
          0,
          0,
          outer * (1 - k * 0.8),
          `rgb(${n(116 - k * 64)},${n(170 + k * 80)},${n(150 + k * 80)})`,
          i ? '' : ' filter="url(#rg-wx-y)"',
        );
      }).join(''),
    tint: disc(0, 0, outer, '#bfd9e6'),
    paint:
      glow(0, 0, outer * 0.55, '#3fe6ff', 0.55, 'rg-soft6') +
      glow(0, 0, outer * 0.27, '#7ff5ff', 0.85) +
      `<path d="M-3,-2 L1,-4 L4,0 L1,3 L-2,2 Z" fill="#effeff" opacity="0.85" filter="url(#rg-soft1)"/>` +
      `<circle r="${n(outer)}" fill="#eaf6ff" opacity="0.18" filter="url(#rg-soft3)" style="mix-blend-mode: screen"/>`,
  };
}

/** A drill rig: a lattice tower, its light on top. */
const rig = (): Part => ({
  extent: 9.5,
  grade: graded(0, 0, 14),
  heights:
    `<rect x="-6.5" y="-6.5" width="13" height="13" fill="none" stroke="${H.pipe}" stroke-width="2"/>` +
    `<path d="M-6.5,-6.5 L6.5,6.5 M6.5,-6.5 L-6.5,6.5" stroke="rgb(220,120,200)" stroke-width="1.6"/>` +
    disc(0, 0, 2.6, 'rgb(250,120,210)'),
  tint: square(0, 0, 15, 0, '#e8eef2'),
  paint: `<path d="M-6.5,-6.5 L6.5,6.5 M6.5,-6.5 L-6.5,6.5" stroke="#fff" stroke-width="0.4" opacity="0.5"/>` + lamp(0, 0, '#ff3b3b'),
});

/** Two to four ice silos, white with blue caps. */
function silos(r: Rng): Part {
  const xs = row(r.int(2, 4), 13.5);
  return {
    extent: (xs.length - 1) * 6.75 + 6,
    grade: graded(0, 0, xs.length * 5.5 + 8),
    heights: xs.map((x) => disc(x, 0, 5.6, 'url(#rg-dome)')).join(''),
    tint: xs.map((x) => disc(x, 0, 6, '#eef5fb')).join(''),
    paint: xs.map((x) => disc(x, 0, 2.2, '#2f8fff', ' opacity="0.9"') + disc(x - 0.6, -0.6, 0.7, '#dff1ff')).join(''),
  };
}

/** A cooling tower: a dark ring round a hot glowing throat. */
const coolingTower = (): Part => ({
  extent: 15.5,
  grade: graded(0, 0, 21),
  heights: disc(0, 0, 15.5, H.apron) + disc(0, 0, 14.5, 'rgb(240,170,50)') + disc(0, 0, 10, 'rgb(70,200,40)'),
  tint: disc(0, 0, 15.5, '#2e2c30'),
  paint:
    glow(0, 0, 10, '#ff3c0a', 0.75, 'rg-soft3') +
    glow(0, 0, 5.5, '#ffa41f', 0.9) +
    glow(0, 0, 2.4, '#fff1b0', 1, 'rg-soft1') +
    `<circle r="12.3" fill="none" stroke="#ff7a1a" stroke-width="0.5" stroke-dasharray="1 2.2" opacity="0.8"/>`,
});

/** Three to six radiator fins, black, heat glowing between them. */
function radiators(r: Rng): Part {
  const xs = row(r.int(3, 6), 6);
  const len = r.range(18, 26);
  const gaps = xs.slice(1).map((x) => x - 3);
  return {
    extent: Math.hypot(xs.length * 3, len / 2 + 0.5),
    grade: graded(0, 0, Math.max(len / 2, xs.length * 3) + 8),
    heights: xs.map((x) => box(x, 0, 3.2, len, 0.6, 'rgb(220,150,45)')).join(''),
    tint: box(0, 0, xs.length * 6 - 2, len + 1, 1, '#2a282c'),
    paint:
      gaps
        .map(
          (x) =>
            `<path d="M${n(x)},${n(-len / 2 + 1)} V${n(len / 2 - 1)}" stroke="#ff6a00" stroke-width="1.6" opacity="0.6" filter="url(#rg-soft1)" style="mix-blend-mode: screen"/>`,
        )
        .join('') +
      gaps
        .map((x) => `<path d="M${n(x)},${n(-len / 2 + 2)} V${n(len / 2 - 2)}" stroke="#ffc060" stroke-width="0.4" opacity="0.9"/>`)
        .join(''),
  };
}

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

/** Cargo containers set down in rows, three to seven, a few askew, in the usual colours. */
function containers(r: Rng): Part {
  let heights = '';
  let tint = '';
  let paint = '';
  // Slots in a grid, each a container's length and width with a gap, taken at random.
  const slots = row(2, 13).flatMap((x) => row(3, 7.5).map((y) => ({ x, y, k: r.next() })));
  for (const { x: sx, y: sy } of slots.sort((a, b) => a.k - b.k).slice(0, r.int(3, 6))) {
    const [x, y] = [sx + r.range(-0.6, 0.6), sy + r.range(-0.4, 0.4)];
    const turn = r.chance(0.25) ? r.range(-8, 8) : 0;
    const at = `translate(${n(x)},${n(y)}) rotate(${n(turn)})`;
    heights += `<g transform="${at}">${box(0, 0, 11, 5, 0.5, r.chance(0.3) ? 'rgb(214,150,200)' : 'rgb(182,150,200)')}</g>`;
    tint += `<g transform="${at}">${box(0, 0, 11, 5, 0.5, r.pick(['#d9622b', '#e8e2d4', '#2f6fd0', '#c9a227', '#b8322a']))}</g>`;
    paint += `<g transform="${at}"><path d="M-3.5,-2.5 V2.5 M0,-2.5 V2.5 M3.5,-2.5 V2.5" stroke="#000" stroke-width="0.3" opacity="0.3"/></g>`;
  }
  return { extent: 17, grade: graded(0, 0, 20), heights, tint, paint };
}

/** A dish aerial on its mount, turned to the sky. */
const dish = (light: string): Part => ({
  extent: 9,
  grade: graded(0, 0, 13),
  heights: disc(0, 0, 9, H.apron) + disc(0, 0, 8, 'rgb(236,150,215)') + disc(1, 1, 5.5, 'rgb(196,200,215)', ' filter="url(#rg-soft1)"'),
  tint: disc(0, 0, 9, '#e9ecee'),
  paint: `<path d="M1,1 L-4,-4" stroke="#2a2d30" stroke-width="0.8"/>` + lamp(-4, -4, light),
});

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
  // Cracks in the ground, lit with it.
  let grade = '';
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
    grade += `<path d="${d}" fill="none" stroke="rgb(80,0,128)" stroke-width="2" stroke-linejoin="round"/>`;
    paint +=
      `<path d="${d}" fill="none" stroke="#a46bff" stroke-width="4" opacity="0.45" filter="url(#rg-soft1)" style="mix-blend-mode: screen"/>` +
      `<path d="${d}" fill="none" stroke="#e2ccff" stroke-width="0.7" stroke-linejoin="round" opacity="0.9"/>`;
  }
  return { grade, paint };
}

/** A landing pad ringed in amber, now and then with a lander standing on it. */
function landingPad(lander: boolean, light: string): Part {
  const legs = [45, 135, 225, 315].map((a) => toward(a, 0.11));
  const lamps = [0, 90, 180, 270].map((a) => toward(a, 0.19));
  return {
    extent: 15,
    grade: graded(0, 0, 20),
    heights:
      disc(0, 0, 15, H.apron) +
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

/** An outbuilding a base may have: how likely it is, how far out it stands (in spaces), how it's linked to the hub along `a`, what it is, how much larger than drawn, and whether it's turned with the way out. */
interface Annex {
  weight: number;
  reach: [number, number];
  link: (a: number, p: Spot) => Part;
  part: (r: Rng) => Part;
  scale: number;
  turned: boolean;
}

const annex = (
  weight: number,
  reach: [number, number],
  link: (a: number, p: Spot) => Part,
  part: (r: Rng) => Part,
  scale = BIG,
  turned = false,
): Annex => ({ weight, reach, link, part, scale, turned });

/** The clear ground kept between a base's buildings, in board units. */
const GAP = 3;

/** How far p is from the line from a to b. */
function gap(p: Spot, a: Spot, b: Spot): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/**
 * A base's outbuildings, one each way out (`ways`) for as many as it has: picked by weight, none twice
 * until each has stood once, each a little nearer or further out and larger or smaller. Each stands
 * clear of the hub (`hub` across from the planet's space), of the others and their links, and on the
 * tile (the planet's space at `centre` on it): moved further out, or made smaller, until it is, or left
 * out if it can't be.
 */
function outskirts(r: Rng, ways: readonly number[], count: number, pool: readonly Annex[], centre: Spot, hub: number): Part[] {
  const taken: (Spot & { r: number })[] = [];
  const links: [Spot, Spot][] = [];
  const out: Part[] = [];
  let left = [...pool];
  for (const a of ways.slice(0, count)) {
    if (!left.length) left = [...pool];
    let pick = r.next() * left.reduce((s, x) => s + x.weight, 0);
    const annex = left.find((x) => (pick -= x.weight) < 0) ?? left[0];
    left = left.filter((x) => x !== annex);
    const part = annex.part(r);
    const turn = annex.turned ? a + 90 : r.range(-15, 15);
    const grow = annex.scale * r.range(0.88, 1.1);
    const near = r.range(...annex.reach);
    const from = toward(a, 0.3);
    const fit = (() => {
      for (const k of [1, 0.9, 0.8, 0.7])
        for (let d = near; d <= near + 0.35; d += 0.025) {
          const p = toward(a, d);
          const e = (part.extent ?? 15) * grow * k;
          if (Math.hypot(p.x, p.y) < hub + e + GAP) continue;
          // Further out is only nearer the tile's edge.
          if (inside(centre.x + p.x, centre.y + p.y) < e + 1) break;
          if (taken.some((f) => Math.hypot(p.x - f.x, p.y - f.y) < e + f.r + GAP)) continue;
          if (links.some(([s, t]) => gap(p, s, t) < e + GAP)) continue;
          if (taken.some((f) => gap(f, from, p) < f.r + GAP)) continue;
          return { p, e, scale: grow * k };
        }
      return undefined;
    })();
    if (!fit) continue;
    taken.push({ ...fit.p, r: fit.e });
    links.push([from, fit.p]);
    out.push(annex.link(a, fit.p), placed(fit.p.x, fit.p.y, part, turn, fit.scale));
  }
  return out;
}

/** How many outbuildings a base has: one to four, two or three most often. */
const SPREAD = [1, 1, 2, 2, 2, 3, 3, 3, 4];

/**
 * The base on a planet's space, after the planets' own colours: a hub round its cube sockets (one per cube
 * the planet holds), and a few outbuildings out in the hexes round it, joined to it, a different few on
 * each tile: for a 7 a habitat under a great green dome, with violet greenhouses, blue domes and solar
 * panels; for an 8 a refinery, gold tanks and burning flare stacks; for a 9 an ice mine in a ring of frost,
 * its pit glowing blue; for a 10 a black reactor with red-hot cooling towers; any of them with a landing
 * pad, containers or a dish; and on a Void tile a sinkhole ringed by violet crystals, its cracks glowing.
 * Centred on the planet's space, in board units. `at` is where the planet sits on its tile (in spaces from
 * the middle).
 */
function base(number: number, at: Spot, r: Rng): Drawn | undefined {
  const pads = cubePadCentres(number - 6, 0, 0).map((p) => ({ x: p.x / SCALE, y: p.y / SCALE }));
  const ways = exits(r, at, number > 0);
  const count = r.pick(SPREAD);
  const centre = { x: SIZE / 2 + at.x * SPACE, y: SIZE / 2 + at.y * SPACE };
  const outskirtsOf = (hubReach: number, pool: Annex[]) => outskirts(r, ways, count, pool, centre, hubReach);
  // Links start at the hub's edge, so none crosses the cube sockets.
  const tube = (w: number, colour: string) => (a: number, p: Spot) => run(toward(a, 0.3), p, w * r.range(0.8, 1.2), colour);
  const road = (a: number, p: Spot): Part => {
    const d = `M${n(toward(a, 0.3).x)},${n(toward(a, 0.3).y)} L${n(p.x)},${n(p.y)}`;
    return {
      grade: `<path d="${d}" stroke="${H.graded}" stroke-width="14" filter="url(#rg-soft3)"/>`,
      paint: `<path d="${d}" stroke="#e6eef2" stroke-width="0.9" stroke-dasharray="2.5 2" opacity="0.6"/>`,
    };
  };
  const common = (light: string): Annex[] => [
    annex(1.2, [0.7, 0.8], tube(3, '#8d969c'), (r) => landingPad(r.chance(0.6), light), 1.15),
    annex(0.8, [0.6, 0.78], tube(2.5, '#8d969c'), containers, 1.5),
    annex(0.6, [0.55, 0.72], tube(2, '#8d969c'), () => dish(light), 1.2),
  ];
  switch (number) {
    case 0:
      return merged([
        { grade: disc(0, 0, r.range(38, 48), 'url(#rg-sink)', ' filter="url(#rg-wx-m)"') },
        fissures(r, r.int(2, 6), 32, r.range(45, 66)),
        crystals(r, r.int(5, 11), 36),
        crystals(r, r.int(0, 4), 60),
        {
          paint:
            glow(0, 0, 24, '#6a2cff', 0.6, 'rg-soft6') +
            glow(0, 0, 8, '#d6b8ff', 0.75) +
            disc(0, 0, 14, '#000', ' opacity="0.35" filter="url(#rg-soft3)"'),
        },
      ]);
    case 7: {
      const great = r.range(25, 30);
      return merged([
        ...outskirtsOf(great + 2.5, [
          annex(2, [0.74, 0.84], tube(6, '#a7b0b6'), greenhouses, 1.15, true),
          annex(1.5, [0.64, 0.74], tube(6, '#a7b0b6'), domelets, BIG, true),
          annex(1.5, [0.7, 0.8], tube(2.5, '#8d969c'), solar, BIG, true),
          ...common('#7dffb0'),
        ]),
        // The great dome is the base's middle: its hatch, on top, holds the cube.
        dome(great, '#4a9c7a', '#6dff9e', 22),
        hub(pads, '#9aa3a8', 'rgb(246,160,205)', '#7dffb0'),
      ]);
    }
    case 8:
      return merged([
        ...outskirtsOf(32, [
          annex(2.5, [0.7, 0.8], tube(3, '#f2ad2c'), tankFarm, 1),
          annex(1.5, [0.6, 0.72], tube(3, '#c9c4bc'), flares, BIG, true),
          annex(1.5, [0.72, 0.8], tube(3.5, '#d4802a'), columns, BIG, true),
          ...common('#ffcf4a'),
        ]),
        hub(pads, '#a59c90'),
      ]);
    case 9: {
      const frost = r.range(45, 66);
      return merged([
        {
          grade: disc(0, 0, frost, 'url(#rg-frost)', ' style="mix-blend-mode: lighten"'),
          paint: glow(0, 0, frost, '#d6ecff', 0.28, 'rg-soft6'),
        },
        ...outskirtsOf(40, [
          annex(2.5, [0.74, 0.84], road, pit),
          annex(1.5, [0.6, 0.72], tube(3.5, '#e8eef2'), rig, 1.6),
          annex(1.5, [0.68, 0.78], tube(3.5, '#e8eef2'), silos, BIG, true),
          ...common('#7fe9ff'),
        ]),
        hub(pads, '#c4ced4', H.deck, '#7fe9ff'),
      ]);
    }
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
      const power = (a: number, p: Spot) => conduit(toward(a, 0.6), p, '#ff5a14');
      return merged([
        ...outskirtsOf(49, [
          annex(2.5, [0.78, 0.86], power, coolingTower, 1.2),
          annex(1.2, [0.8, 0.88], power, coolingTower, 1),
          annex(2, [0.8, 0.88], power, radiators, 1.15, true),
          ...common('#ff7a1a').slice(0, 2),
        ]),
        {
          grade: graded(0, 0, 52),
          heights:
            `<polygon points="${octagon(45)}" fill="${H.apron}"/>` +
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
    defs:
      GRADIENTS +
      BUILDING_GRADIENTS +
      DUNES +
      filters +
      ground(r.fork('ground'), DRAWN) +
      built(r.fork('built'), DRAWN) +
      cast(DRAWN) +
      dust(r.noiseSeed(), DRAWN) +
      CRATERS +
      RIDGE,
    body:
      `<g transform="scale(${n(SCALE)})"><g filter="url(#rg-ground)">${heights}</g>` +
      // The buildings' filters are over the tile's area, so they're applied outside the move to the planet's space.
      (site
        ? `<g filter="url(#rg-cast)">${place(site.heights)}</g>` +
          `<g filter="url(#rg-built)">${place(site.heights)}</g>` +
          place(`<g style="mix-blend-mode: color">${site.tint}</g>`) +
          `<g filter="url(#rg-dust)" opacity="0.9" style="mix-blend-mode: soft-light">${place(site.heights)}</g>` +
          place(site.paint)
        : '') +
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
