import type { Rng } from '../rng';
import { hsl, n, type Fragment } from '../svg';
import { MISSILE_HUE } from '../tokens';
import { icon } from '../icons';
import { f, line } from './core';

/** A soft glow, e.g. under a ship or at an impact. */
export const glow = (id: string, cx: number, cy: number, rx: number, ry: number, hue: number, a = 0.6, light = 62): Fragment => ({
  defs: `<radialGradient id="${id}"><stop offset="0" stop-color="${hsl(hue, 90, light)}" stop-opacity="${n(a)}"/><stop offset="1" stop-color="${hsl(hue, 90, light)}" stop-opacity="0"/></radialGradient>`,
  body: `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"/>`,
});

/** A line fading from `colour` at its end to nothing at its start: trails and beams. */
export function streak(id: string, x1: number, y1: number, x2: number, y2: number, colour: string, w: number, a = 1): Fragment {
  return {
    defs: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"><stop offset="0" stop-color="${colour}" stop-opacity="0"/><stop offset="1" stop-color="${colour}" stop-opacity="${n(a)}"/></linearGradient>`,
    body: line(x1, y1, x2, y2, `url(#${id})`, w),
  };
}

/** A weapon beam: a coloured streak with a white core. */
export const beam = (id: string, x1: number, y1: number, x2: number, y2: number, hue: number, w = 1.6): Fragment[] => [
  streak(id, x1, y1, x2, y2, hsl(hue, 100, 70), w),
  f(line(x1, y1, x2, y2, '#fff', w * 0.22, ' opacity=".85"')),
];

/** A many-pointed burst: impacts and flares. */
export function burst(id: string, cx: number, cy: number, r: number, hue: number, points: number, r2: Rng): Fragment {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * r2.range(0.18, 0.32) : r * r2.range(0.6, 1);
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`;
  }
  return {
    defs:
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}">` +
      `<stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${hsl(hue, 100, 75)}"/><stop offset="1" stop-color="${hsl(hue, 100, 55)}" stop-opacity="0"/></radialGradient>`,
    body: `<path d="${d}Z" fill="url(#${id})"/>`,
  };
}

/** A ship blown apart: a burst, and shards of its hull flying out. */
export function wreck(id: string, cx: number, cy: number, r: number, shipHue: number, fireHue: number, r2: Rng): Fragment[] {
  let shards = '';
  for (let i = 0; i < 9; i++) {
    const a = r2.range(0, Math.PI * 2);
    const d = r2.range(r * 0.45, r * 1.15);
    const sz = r2.range(r * 0.08, r * 0.2);
    shards += `<path d="M0 ${n(-sz)}L${n(sz * 0.9)} ${n(sz * 0.4)}L${n(-sz * 0.7)} ${n(sz * 0.6)}Z" fill="${hsl(shipHue, 62, r2.pick([30, 46, 64]))}" transform="translate(${n(cx + Math.cos(a) * d)} ${n(cy + Math.sin(a) * d)}) rotate(${n(r2.range(0, 360))})"/>`;
  }
  let sparks = '';
  for (let i = 0; i < 8; i++) {
    const a = r2.range(0, Math.PI * 2);
    const d = r2.range(r * 0.5, r * 1.3);
    sparks += `<circle cx="${n(cx + Math.cos(a) * d)}" cy="${n(cy + Math.sin(a) * d)}" r="${n(r2.range(0.12, 0.35))}" fill="${hsl(fireHue, 100, 80)}"/>`;
  }
  return [burst(id, cx, cy, r, fireHue, 9, r2), f(shards + sparks)];
}

/** A stroked path with an optional arrowhead marker. */
export function arrowPath(id: string, d: string, colour: string, o: { w?: number; dash?: boolean | string; head?: boolean; opacity?: number } = {}): Fragment {
  const head = o.head !== false;
  const dash = o.dash === true ? '1.2 .9' : o.dash || '';
  return {
    defs: head ? `<marker id="${id}-head" viewBox="0 0 6 6" refX="2.4" refY="3" markerWidth="3.6" markerHeight="3.6" orient="auto"><path d="M0 0L6 3L0 6z" fill="${colour}"/></marker>` : '',
    body: `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${n(o.w ?? 0.45)}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${head ? ` marker-end="url(#${id}-head)"` : ''}${o.opacity !== undefined ? ` opacity="${n(o.opacity)}"` : ''}/>`,
  };
}

/** A circular arrow: reroll, another turn, a second use. */
export function loop(id: string, cx: number, cy: number, r: number, colour: string, w = 0.45, start = -60, sweep = 290): Fragment {
  const a0 = (start * Math.PI) / 180;
  const a1 = ((start + sweep) * Math.PI) / 180;
  const d = `M${n(cx + Math.cos(a0) * r)} ${n(cy + Math.sin(a0) * r)}A${n(r)} ${n(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${n(cx + Math.cos(a1) * r)} ${n(cy + Math.sin(a1) * r)}`;
  return arrowPath(id, d, colour, { w });
}

/** A targeting reticle. */
export const reticle = (cx: number, cy: number, r: number, colour: string) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${colour}" stroke-width=".3" stroke-dasharray="${n(r * 0.6)} ${n(r * 0.2)}"/>` +
  [0, 90, 180, 270].map((a) => {
    const t = (a * Math.PI) / 180;
    return line(cx + Math.cos(t) * r * 0.75, cy + Math.sin(t) * r * 0.75, cx + Math.cos(t) * r * 1.3, cy + Math.sin(t) * r * 1.3, colour, 0.3);
  }).join('');

/** An energy shield: a dome of light around (cx, cy). */
export function shield(id: string, cx: number, cy: number, rx: number, ry: number, hue: number): Fragment {
  return {
    defs: `<radialGradient id="${id}" cx=".5" cy=".55" r=".5"><stop offset=".6" stop-color="${hsl(hue, 90, 70)}" stop-opacity="0"/><stop offset=".93" stop-color="${hsl(hue, 90, 70)}" stop-opacity=".35"/><stop offset="1" stop-color="${hsl(hue, 100, 85)}" stop-opacity=".8"/></radialGradient>`,
    body:
      `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"/>` +
      `<path d="M${n(cx - rx * 0.55)} ${n(cy - ry * 0.7)}A${n(rx)} ${n(ry)} 0 0 1 ${n(cx + rx * 0.2)} ${n(cy - ry * 0.95)}" fill="none" stroke="#fff" stroke-width=".3" opacity=".6" stroke-linecap="round"/>`,
  };
}

/** A missile, pointing along `angle` (degrees) from its nose at (x, y): the one drawing for missiles, on cards, in the manual and in the game. */
export const missile = (x: number, y: number, angle: number, scale = 1, hue = MISSILE_HUE) =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${n(scale)})">` +
  `<path d="M-3.4 -.6L-4.6 -1.7H-3.6L-2.2 -.6ZM-3.4 .6L-4.6 1.7H-3.6L-2.2 .6Z" fill="${hsl(hue, 80, 50)}" stroke="${hsl(220, 30, 20)}" stroke-width=".15"/>` +
  `<path d="M3.6 0C3 -.5 2.2 -.6 1.6 -.6H-3.6V.6H1.6C2.2 .6 3 .5 3.6 0Z" fill="${hsl(220, 15, 88)}" stroke="${hsl(220, 30, 20)}" stroke-width=".18"/>` +
  `<path d="M3.6 0C3 -.5 2.6 -.58 2.2 -.6V.6C2.6 .58 3 .5 3.6 0Z" fill="${hsl(hue, 100, 60)}"/>` +
  `<path d="M-3.6 -.45L-5 0L-3.6 .45Z" fill="${hsl(35, 100, 70)}"/></g>`;

/** A slash through something: disabled, forbidden. */
export const slash = (cx: number, cy: number, r: number, colour = hsl(0, 95, 62)) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${colour}" stroke-width=".45"/>` + line(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.7, colour, 0.45);

/** An icon struck through: what a card forbids ("no combat", "no conquering"). */
export const forbidden = (name: string, cx: number, cy: number, opacity = 0.9) =>
  `<g opacity="${n(opacity)}">${icon(name, cx, cy, 3.4, hsl(0, 50, 65))}${slash(cx, cy, 2.8)}</g>`;

/** Little four-point sparkles around a point. */
export function sparkles(r2: Rng, cx: number, cy: number, d0: number, d1: number, count: number, colour = '#fff'): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = r2.range(0, Math.PI * 2);
    const d = r2.range(d0, d1);
    s += `<path d="M0 -1L.25 -.25L1 0L.25 .25L0 1L-.25 .25L-1 0L-.25 -.25Z" fill="${colour}" transform="translate(${n(cx + Math.cos(a) * d)} ${n(cy + Math.sin(a) * d)}) scale(${n(r2.range(0.5, 1.2))})"/>`;
  }
  return s;
}

/** Fast-motion lines behind a ship moving along (dx, dy). */
export function trails(id: string, r2: Rng, x: number, y: number, dx: number, dy: number, len: number, spread: number, colour: string, count = 6): Fragment[] {
  const m = Math.hypot(dx, dy);
  const ux = dx / m;
  const uy = dy / m;
  const out: Fragment[] = [];
  for (let i = 0; i < count; i++) {
    const o = r2.range(-spread, spread);
    const sx = x - uy * o;
    const sy = y + ux * o;
    const l = len * r2.range(0.6, 1);
    out.push(streak(`${id}-${i}`, sx - ux * l, sy - uy * l, sx - ux * r2.range(2, 4), sy - uy * r2.range(2, 4), colour, r2.range(0.25, 0.8), r2.range(0.5, 1)));
  }
  return out;
}
