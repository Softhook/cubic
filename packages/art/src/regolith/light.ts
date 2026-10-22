import type { Rng } from '../rng';
import { n, turbulence } from '../svg';
import type { Box } from '../starfield';
import { type World, LIT, region } from './core';

/**
 * The Regolith ground's light: filters that turn a height map into lit, coloured ground (`ground`), and
 * the buildings' own harder light, their cast shadows and Mars's dust on them.
 */

/** The moon: cool grey dust, a touch blue in the shadows. */
const MOON_RAMP =
  '<feComponentTransfer in="lit2" result="ramp">' +
  '<feFuncR type="table" tableValues="0.02 0.08 0.2 0.37 0.55 0.72 0.86"/>' +
  '<feFuncG type="table" tableValues="0.025 0.085 0.2 0.36 0.53 0.69 0.83"/>' +
  '<feFuncB type="table" tableValues="0.035 0.095 0.205 0.35 0.5 0.65 0.79"/>' +
  '</feComponentTransfer>';

/** Mars: rust and ochre dust, and patches of dark basalt where the wind swept it bare (the broad noise's alpha lays them). */
const MARS_RAMP =
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
  '<feColorMatrix in="broad" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1" result="pg"/>' +
  '<feComponentTransfer in="pg" result="mD"><feFuncR type="table" tableValues="0 0 0.1 0.9 1 1"/><feFuncG type="table" tableValues="0 0 0.1 0.9 1 1"/><feFuncB type="table" tableValues="0 0 0.1 0.9 1 1"/></feComponentTransfer>' +
  '<feComponentTransfer in="mD" result="mR"><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>' +
  '<feComposite in="dust" in2="mD" operator="arithmetic" k1="1" result="dustM"/>' +
  '<feComposite in="rock" in2="mR" operator="arithmetic" k1="1" result="rockM"/>' +
  '<feComposite in="dustM" in2="rockM" operator="arithmetic" k2="1" k3="1" result="ramp"/>';

/** The light: the height map gains fine noise where it isn't smooth, is lit from the top left, shadowed, tinted for its world and grained. Over `area`, in board units. */
export function ground(r: Rng, area: Box, world: World): string {
  const s = () => r.noiseSeed();
  // A point is in shadow where the ground towards the light, `d` away, stands higher than it: read from the
  // height map before its fine noise, as moving the noisy one makes Chrome work it all out again for each
  // shadow (~65 ms a time), and the noise's own shadows are too small to see.
  const offset = (d: number, k: number, i: number) =>
    `<feOffset in="H0" dx="${d}" dy="${d}" result="o${i}"/>` +
    `<feComposite in="o${i}" in2="H0" operator="arithmetic" k2="1" k3="-1" k4="${k}" result="d${i}"/>`;
  const light = '<feDistantLight azimuth="225" elevation="22"/>';
  return (
    `<filter id="rg-ground" filterUnits="userSpaceOnUse" ${region(area)} color-interpolation-filters="sRGB">` +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="H0"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0" result="SMOOTH"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="ALB"/>' +
    // One broad noise, four ways: its red and green warp the fine noise, its blue mottles the brightness, its alpha lays the dust and rock patches.
    turbulence(0.01, 3, s(), 'broad') +
    turbulence(0.03, 7, s(), 'nz') +
    turbulence(0.018, 3, s(), 'rg', 'turbulence') +
    '<feDisplacementMap in="nz" in2="broad" scale="26" xChannelSelector="R" yChannelSelector="G" result="nzw"/>' +
    '<feDisplacementMap in="rg" in2="broad" scale="26" xChannelSelector="R" yChannelSelector="G" result="rgw"/>' +
    '<feComponentTransfer in="rgw" result="ridged"><feFuncA type="table" tableValues="1 0.55 0.3 0.15 0"/></feComponentTransfer>' +
    '<feComponentTransfer in="SMOOTH" result="ROUGH"><feFuncA type="table" tableValues="1 0.02"/></feComponentTransfer>' +
    '<feComposite in="nzw" in2="ROUGH" operator="in" result="nzm"/>' +
    '<feComposite in="ridged" in2="ROUGH" operator="in" result="rgm"/>' +
    '<feComposite in="H0" in2="nzm" operator="arithmetic" k2="0.85" k3="0.28" k4="-0.07" result="h1"/>' +
    '<feComposite in="h1" in2="rgm" operator="arithmetic" k2="1" k3="0.12" k4="-0.05" result="H"/>' +
    `<feDiffuseLighting in="H" kernelUnitLength="${LIT}" surfaceScale="9" diffuseConstant="1.3" lighting-color="#ffffff" result="L">${light}</feDiffuseLighting>` +
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
    '<feColorMatrix in="broad" type="matrix" values="0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 0 1" result="anG"/>' +
    '<feComposite in="albG" in2="anG" operator="arithmetic" k2="1" k3="0.45" k4="-0.22" result="albN"/>' +
    '<feComposite in="Ls" in2="albN" operator="arithmetic" k1="2" result="lit"/>' +
    `<feSpecularLighting in="H" kernelUnitLength="${LIT}" surfaceScale="9" specularConstant="0.6" specularExponent="40" lighting-color="#e6f6ff" result="spec">${light}</feSpecularLighting>` +
    '<feComposite in="spec" in2="SMOOTH" operator="in" result="specM"/>' +
    '<feComposite in="lit" in2="specM" operator="arithmetic" k2="1" k3="0.7" result="lit2"/>' +
    (world === 'moon' ? MOON_RAMP : MARS_RAMP) +
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
export function built(r: Rng, area: Box): string {
  const light = '<feDistantLight azimuth="225" elevation="38"/>';
  const ramp = (values: string) => `type="table" tableValues="${values}"`;
  return (
    `<filter id="rg-built" filterUnits="userSpaceOnUse" ${region(area)} color-interpolation-filters="sRGB">` +
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
export function cast(area: Box): string {
  const levels = Array.from({ length: 12 }, (_, i) => 0.52 + i * 0.04);
  return (
    `<filter id="rg-cast" filterUnits="userSpaceOnUse" ${region(area)} color-interpolation-filters="sRGB">` +
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
export const dust = (seed: number, area: Box) =>
  `<filter id="rg-dust" filterUnits="userSpaceOnUse" ${region(area)} color-interpolation-filters="sRGB">` +
  turbulence(0.03, 3, seed, 'dn') +
  '<feColorMatrix in="dn" type="matrix" values="0 0 0 0 0.66  0 0 0 0 0.38  0 0 0 0 0.22  3 0 0 0 -1.1"/>' +
  '<feComposite in2="SourceAlpha" operator="in"/>' +
  '</filter>';
