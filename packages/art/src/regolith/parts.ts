import { n, turbulence } from '../svg';
import type { Spot } from '../tile';
import { polar, stops, radial } from './core';

/**
 * How a piece of a base is drawn: in layers (`Part`), with the height-map colours, gradients and small shapes
 * the buildings, craft and bases share.
 */

/** Height-map colours for the bases (red height, green smoothness, blue brightness): decks stand high and bright, sockets are sunk in them. */
export const H = {
  apron: 'rgb(150,0,150)',
  deck: 'rgb(192,160,205)',
  dark: 'rgb(196,150,42)',
  socket: 'rgb(168,215,120)',
  pipe: 'rgb(176,120,200)',
  panel: 'rgb(146,220,110)',
  graded: 'rgb(128,190,128)',
};

/**
 * The biohazard sign, 14.4 across and centred on its box (its arms reach further up than down, so it's
 * moved down by the difference): three crescents round a ring, cut through by a hole in the middle and gaps
 * along each arm. And its paint, worn: chipped away in flecks and thinned in patches.
 */
const BIOHAZARD = (() => {
  const arms = [-90, 30, 150];
  const at = (k: number, d: number) => `cx="${n(polar(arms[k], d).x)}" cy="${n(polar(arms[k], d).y)}"`;
  return (
    '<mask id="rg-biohazardCut" maskUnits="userSpaceOnUse" x="-10" y="-10" width="20" height="20"><g transform="translate(0,0.9)">' +
    arms.map((_, k) => `<circle ${at(k, 3.6)} r="3.6" fill="#fff"/>`).join('') +
    '<circle r="3.75" fill="none" stroke="#fff" stroke-width="0.75"/>' +
    arms.map((_, k) => `<circle ${at(k, 4.7)} r="2.5" fill="#000"/>`).join('') +
    '<circle r="1.2" fill="#000"/>' +
    arms.map((a) => `<path d="M0,0 L${n(polar(a, 2.4).x)},${n(polar(a, 2.4).y)}" stroke="#000" stroke-width="0.45"/>`).join('') +
    '</g></mask>' +
    '<filter id="rg-worn" color-interpolation-filters="sRGB">' +
    turbulence(0.5, 3, 11, 'chip') +
    '<feColorMatrix in="chip" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  6 0 0 0 -1.6" result="kept"/>' +
    turbulence(0.12, 2, 5, 'thin') +
    '<feColorMatrix in="thin" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.5 0 0 0 0.2" result="left"/>' +
    '<feComposite in="kept" in2="left" operator="arithmetic" k1="1"/>' +
    '<feComposite in="SourceGraphic" operator="in"/>' +
    '</filter>' +
    '<symbol id="rg-biohazard" overflow="visible"><rect x="-10" y="-10" width="20" height="20" fill="currentColor" mask="url(#rg-biohazardCut)"/></symbol>'
  );
})();

/** The biohazard sign, painted red on a socket at (x, y): worn, and multiplied in, so the grime and light under it show through. */
export const biohazard = (p: Spot) =>
  `<g style="mix-blend-mode: multiply"><use href="#rg-biohazard" transform="translate(${n(p.x)},${n(p.y)}) scale(1.35)" color="#d8261c" filter="url(#rg-worn)"/></g>`;

export const BUILDING_GRADIENTS =
  BIOHAZARD +
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
  radial('rg-nose', [
    [0, 'rgb(255,170,235)'],
    [0.5, 'rgb(240,170,225)'],
    [1, 'rgb(205,170,205)'],
  ]) +
  // A pad's deck, darkened (blue is brightness) where engines have fired on it.
  radial('rg-scorch', [
    [0, 'rgb(192,160,40)'],
    [0.45, 'rgb(192,160,90)'],
    [0.8, H.deck],
  ]) +
  radial('rg-frost', [
    [0, 'rgb(0,210,225)', 0.9],
    [1, 'rgb(0,210,225)', 0],
  ]);

/** A piece of a base, round its planet's space in board units: the ground levelled under it, its height map, colour laid on the lit relief (by hue, so the light stays), and paint and lights over that. */
export interface Part {
  /** How far it reaches from its middle: the circle it stands in, before it's placed. */
  extent?: number;
  grade?: string;
  heights?: string;
  tint?: string;
  paint?: string;
}

const LAYERS = ['grade', 'heights', 'tint', 'paint'] as const;

/** A part drawn round (x, y), turned by `turn` degrees and grown by `scale`. */
export const placed = (x: number, y: number, part: Part, turn = 0, scale = 1): Part =>
  Object.fromEntries(
    LAYERS.map((k) => [
      k,
      part[k] &&
        `<g transform="translate(${n(x)},${n(y)})${turn ? ` rotate(${n(turn)})` : ''}${scale !== 1 ? ` scale(${n(scale)})` : ''}">${part[k]}</g>`,
    ]),
  );

/** A part's drawing, layer by layer. */
export type Drawn = Record<(typeof LAYERS)[number], string>;

export const merged = (parts: Part[]): Drawn => Object.fromEntries(LAYERS.map((k) => [k, parts.map((p) => p[k] ?? '').join('')])) as Drawn;

export const disc = (x: number, y: number, r: number, fill: string, extra = '') =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${extra}/>`;

/** A rounded square `size` across centred on (x, y). */
export const square = (x: number, y: number, size: number, rx: number, fill: string, soft = false) =>
  `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${rx}" fill="${fill}"${soft ? ' filter="url(#rg-soft1)"' : ''}/>`;

export const box = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra = '') =>
  `<rect x="${n(x - w / 2)}" y="${n(y - h / 2)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}"${extra}/>`;

/** Ground levelled round a part. */
export const graded = (x: number, y: number, r: number) => disc(x, y, r, H.graded, ' filter="url(#rg-soft6)"');

/** A glow of light, added to what's under it. */
export const glow = (x: number, y: number, r: number, colour: string, opacity: number, soft = 'rg-soft3') =>
  disc(x, y, r, colour, ` opacity="${opacity}" filter="url(#${soft})" style="mix-blend-mode: screen"`);

/** A small light, with its glow. */
export const lamp = (x: number, y: number, colour: string) => glow(x, y, 3.2, colour, 0.75, 'rg-soft1') + disc(x, y, 1, '#fff6e0');

/** A raised run (a tube, a pipe or a conduit) from a to b, `w` wide, coloured `colour`. */
export function run(a: Spot, b: Spot, w: number, colour: string, height = H.pipe): Part {
  const d = `M${n(a.x)},${n(a.y)} L${n(b.x)},${n(b.y)}`;
  const line = (stroke: string, width: number, extra = '') =>
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${n(width)}" stroke-linecap="round"${extra}/>`;
  return {
    grade: line(H.graded, w + 10, ' filter="url(#rg-soft3)"'),
    heights: line(height, w),
    tint: line(colour, w + 1),
  };
}
