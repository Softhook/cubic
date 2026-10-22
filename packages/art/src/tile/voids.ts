import { rng } from '../rng';
import { hsl, gradientMask, n, ridges, tint, turbulence, type Fragment } from '../svg';
import { MID } from './geometry';
import type { VoidHeart } from './set';

/** What sits at the heart of a Void tile, in space: a black hole, a rift or a supernova, centred on the tile. */

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
      `<g clip-path="url(#${id}-far-half)">${discG}${soft(lens)}</g>` +
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
export const VOID_HEARTS: Record<VoidHeart, (id: string) => Fragment> = { blackHole, rift, supernova };
