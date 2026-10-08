import type { Rng } from '../rng';
import { DOMINANCE, FONTS, RESEARCH } from '../tokens';
import { hsl, n, type Fragment } from '../svg';
import { icon } from '../icons';
import { f, line } from './core';
import { glow } from './effects';

/** Props for the scenes: orbits, beams of light, banners, gauges and other set pieces. Sizes in mm. */

/** A dashed orbit ellipse around a world. */
export const orbit = (cx: number, cy: number, rx: number, ry: number, hue: number, a = 0.8) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2" opacity="${n(a)}"/>`;

/** A column of light from the top of the art down to (x, y): a deployment or an orbital strike. */
export function pillar(id: string, x: number, top: number, y: number, hue: number, w = 3, a = 0.55): Fragment {
  return {
    defs: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 90, 75)}" stop-opacity="0"/><stop offset="1" stop-color="${hsl(hue, 90, 82)}" stop-opacity="${n(a)}"/></linearGradient>`,
    body: `<path d="M${n(x - w)} ${n(top)}H${n(x + w)}L${n(x + w * 1.6)} ${n(y)}H${n(x - w * 1.6)}Z" fill="url(#${id})"/>`,
  };
}

/**
 * A research flask at (cx, cy), scale `s` (1 is 22 mm tall), filled from its base up to `level` with
 * research violet. `extra` is drawn over the glass (marks, bubbles).
 */
export function flask(id: string, cx: number, cy: number, s: number, level: number, extra = ''): Fragment {
  const body = `M${n(cx - 3 * s)} ${n(cy - 14 * s)}V${n(cy - 6 * s)}L${n(cx - 10 * s)} ${n(cy + 8 * s)}Q${n(cx - 11 * s)} ${n(cy + 11 * s)} ${n(cx - 8 * s)} ${n(cy + 11 * s)}H${n(cx + 8 * s)}Q${n(cx + 11 * s)} ${n(cy + 11 * s)} ${n(cx + 10 * s)} ${n(cy + 8 * s)}L${n(cx + 3 * s)} ${n(cy - 6 * s)}V${n(cy - 14 * s)}`;
  return {
    defs: `<clipPath id="${id}"><path d="${body}Z"/></clipPath>`,
    body:
      `<g clip-path="url(#${id})"><rect x="${n(cx - 11 * s)}" y="${n(level)}" width="${n(22 * s)}" height="${n(cy + 11 * s - level)}" fill="${hsl(RESEARCH, 90, 55, 0.75)}"/></g>` +
      `<path d="${body}" fill="none" stroke="${hsl(RESEARCH, 60, 88)}" stroke-width=".45" stroke-linejoin="round"/>` +
      extra,
  };
}

/** The dominance crest: the crown on a round medallion (round, so it is never read as an action hexagon). `dim` is the unlit one. */
export const crest = (cx: number, cy: number, r: number, dim = false) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${dim ? hsl(DOMINANCE, 60, 12, 0.7) : hsl(DOMINANCE, 80, 45)}" stroke="${hsl(DOMINANCE, dim ? 90 : 100, dim ? 70 : 80)}" stroke-width="${n(Math.max(0.3, r * 0.05))}"/>` +
  icon('dominance', cx, cy, r * 1.1, dim ? hsl(DOMINANCE, 100, 75) : '#fff', 2.4);

/** A plain round token, as put on a card to count uses: neutral grey, so it is never read as a player's cube. */
export const token = (cx: number, cy: number, r: number, o: { opacity?: number } = {}) =>
  `<g${o.opacity !== undefined ? ` opacity="${n(o.opacity)}"` : ''}>` +
  `<ellipse cx="${n(cx)}" cy="${n(cy + r * 0.28)}" rx="${n(r)}" ry="${n(r * 0.6)}" fill="${hsl(220, 15, 42)}"/>` +
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r)}" ry="${n(r * 0.6)}" fill="${hsl(220, 15, 82)}" stroke="#fff" stroke-width=".15"/>` +
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r * 0.6)}" ry="${n(r * 0.36)}" fill="none" stroke="${hsl(220, 15, 60)}" stroke-width=".15"/></g>`;

/** Concentric pulse rings. */
export function rings(cx: number, cy: number, r0: number, step: number, count: number, hue: number, ry = 1, w = 0.5): string {
  let s = '';
  for (let i = 0; i < count; i++)
    s += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r0 + i * step)}" ry="${n((r0 + i * step) * ry)}" fill="none" stroke="${hsl(hue, 95, 72)}" stroke-width="${n(Math.max(0.12, w - i * 0.1))}" opacity="${n(Math.max(0.15, 1 - i * 0.22))}"/>`;
  return s;
}

/** A regular polygon path (hexagon by default), pointy-top. */
export function poly(cx: number, cy: number, r: number, sides = 6, rot = -90): string {
  let d = '';
  for (let i = 0; i < sides; i++) {
    const a = ((rot + (i * 360) / sides) * Math.PI) / 180;
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}

/** Motes of light drifting from (x1, y1) to (x2, y2), brighter towards the end. */
export function motes(r2: Rng, x1: number, y1: number, x2: number, y2: number, count: number, hue: number, wave = 2): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const t = r2.range(0.08, 0.95);
    s += `<circle cx="${n(x1 + (x2 - x1) * t + Math.sin(t * 7) * wave)}" cy="${n(y1 + (y2 - y1) * t + Math.cos(t * 5) * wave * 0.5)}" r="${n(r2.range(0.2, 0.6))}" fill="${hsl(hue, 100, 82)}" opacity="${n(0.35 + t * 0.65)}"/>`;
  }
  return s;
}

/** A lightning bolt from (x1, y1) to (x2, y2). */
export function bolt(r2: Rng, x1: number, y1: number, x2: number, y2: number, hue: number, steps = 6, jitter = 2): string {
  let d = `M${n(x1)} ${n(y1)}`;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    d += `L${n(x1 + (x2 - x1) * t + r2.range(-jitter, jitter))} ${n(y1 + (y2 - y1) * t + r2.range(-jitter, jitter))}`;
  }
  d += `L${n(x2)} ${n(y2)}`;
  return `<path d="${d}" fill="none" stroke="${hsl(hue, 100, 75)}" stroke-width=".7" stroke-linejoin="round" opacity=".8"/><path d="${d}" fill="none" stroke="#fff" stroke-width=".22" stroke-linejoin="round"/>`;
}

/** A glowing horizon arc at the bottom of the art: the curve of a planet seen up close. */
export function horizon(id: string, x0: number, x1: number, y: number, bulge: number, hue: number): Fragment[] {
  const mx = (x0 + x1) / 2;
  return [
    glow(`${id}-g`, mx, y, (x1 - x0) * 0.6, bulge * 2.2, hue, 0.45, 62),
    f(`<path d="M${n(x0)} ${n(y + bulge)}Q${n(mx)} ${n(y - bulge)} ${n(x1)} ${n(y + bulge)}" fill="none" stroke="${hsl(hue, 100, 82)}" stroke-width=".4" opacity=".8"/>`),
  ];
}

/** A ring of tick marks, every `major`th one longer: dials and gauges. */
export function dial(cx: number, cy: number, r: number, hue: number, count = 36, major = 6): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r0 = i % major ? r : r - 1;
    s += line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1), hsl(hue, 80, 75), i % major ? 0.18 : 0.35);
  }
  return s;
}

/**
 * A wooden crate seen isometrically like the dice, edge `s`, with hazard bands; with `open`, its lid
 * swung up on the back hinge and the dark inside showing.
 */
export function crate(cx: number, cy: number, s: number, open = true): string {
  const k = 0.866 * s;
  const P = (x: number, y: number) => `${n(x)} ${n(y)}`;
  const edge = hsl(30, 40, 52);
  // Corners of the top face: back, right, front, left.
  const back = [cx, cy - s] as const;
  const right = [cx + k, cy - s / 2] as const;
  const front = [cx, cy] as const;
  const left = [cx - k, cy - s / 2] as const;
  const face = (pts: (readonly [number, number])[], fill: string) => `<path d="M${pts.map(([x, y]) => P(x, y)).join('L')}Z" fill="${fill}" stroke="${edge}" stroke-width=".3" stroke-linejoin="round"/>`;
  // The lid swings open on the back-left edge, so it stands up behind the crate.
  const v = [-s * 0.22, -s * 0.92] as const;
  const lid = open ? face([left, back, [back[0] + v[0], back[1] + v[1]], [left[0] + v[0], left[1] + v[1]]], hsl(30, 25, 30)) : '';
  const bands = [0.3, 0.68]
    .map((t) => line(left[0], left[1] + s * t, front[0], front[1] + s * t, hsl(42, 90, 55), 0.5, ' opacity=".85"') + line(front[0], front[1] + s * t, right[0], right[1] + s * t, hsl(42, 80, 42), 0.5, ' opacity=".85"'))
    .join('');
  const top = open
    ? face([back, right, front, left], hsl(30, 30, 7)) + `<path d="M${P(left[0] + s * 0.12, left[1] + s * 0.02)}L${P(back[0], back[1] + s * 0.14)}L${P(right[0] - s * 0.12, right[1] + s * 0.02)}" fill="none" stroke="${hsl(30, 25, 18)}" stroke-width=".3"/>`
    : face([back, right, front, left], hsl(30, 25, 34));
  return (
    lid +
    face([left, front, [cx, cy + s], [cx - k, cy + s / 2]], hsl(30, 25, 26)) +
    face([front, right, [cx + k, cy + s / 2], [cx, cy + s]], hsl(30, 25, 16)) +
    bands +
    top
  );
}

/** An hourglass, for "until the end of your next turn" and "at the end of your turn". */
export const hourglass = (cx: number, cy: number, h: number, hue: number) => {
  const w = h * 0.55;
  return (
    `<path d="M${n(cx - w / 2)} ${n(cy - h / 2)}H${n(cx + w / 2)}L${n(cx + w * 0.08)} ${n(cy)}L${n(cx + w / 2)} ${n(cy + h / 2)}H${n(cx - w / 2)}L${n(cx - w * 0.08)} ${n(cy)}Z" fill="${hsl(hue, 80, 60, 0.12)}" stroke="${hsl(hue, 90, 78)}" stroke-width=".35" stroke-linejoin="round"/>` +
    `<path d="M${n(cx - w * 0.3)} ${n(cy + h / 2 - 0.4)}Q${n(cx)} ${n(cy + h * 0.12)} ${n(cx + w * 0.3)} ${n(cy + h / 2 - 0.4)}Z" fill="${hsl(hue, 100, 75)}"/>` +
    `<path d="M${n(cx - w * 0.32)} ${n(cy - h * 0.32)}H${n(cx + w * 0.32)}L${n(cx)} ${n(cy - h * 0.02)}Z" fill="${hsl(hue, 100, 75)}" opacity=".7"/>` +
    line(cx, cy, cx, cy + h * 0.38, hsl(hue, 100, 85), 0.2)
  );
};

/** A small badge with a numeral in it, e.g. a ship number or a planet number. */
export const badge = (cx: number, cy: number, r: number, text: string, hue: number, font = FONTS.title) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${hsl(228, 50, 8, 0.8)}" stroke="${hsl(hue, 90, 72)}" stroke-width=".3"/>` +
  `<text x="${n(cx)}" y="${n(cy + 0.1)}" font-family="${font}" font-weight="900" font-size="${n(r * 1.1)}" fill="${hsl(hue, 100, 85)}" text-anchor="middle" dominant-baseline="central">${text}</text>`;
