import { hsl, n, type Fragment } from '../svg';
import { f } from './core';
import { glow } from './effects';

/** Pip positions on a unit face. */
export const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.23], [0.73, 0.23], [0.27, 0.5], [0.73, 0.5], [0.27, 0.77], [0.73, 0.77]],
};

/** Two faces that can sit beside `top` on a real die (opposite faces add up to 7). */
function sideFaces(top: number): [number, number] {
  const free = [1, 2, 3, 4, 5, 6].filter((v) => v !== top && v !== 7 - top);
  const left = free[0];
  return [left, free.find((v) => v !== left && v !== 7 - left)!];
}

export interface DieOptions {
  opacity?: number;
  rotate?: number;
  pips?: boolean;
  /** Draw as a dashed outline only: a ship that was here, or is about to be. */
  ghost?: boolean;
}

/**
 * A die-ship as an isometric cube centred on (cx, cy), `s` mm along an edge. Each face is a unit
 * square mapped onto the cube by a transform, so its rounded corners and pips foreshorten correctly.
 */
export function die(cx: number, cy: number, s: number, value: number, hue: number, o: DieOptions = {}): string {
  const k = 0.866 * s;
  const h = s / 2;
  const base = `M${n(cx)} ${n(cy - s)}L${n(cx + k)} ${n(cy - h)}L${n(cx + k)} ${n(cy + h)}L${n(cx)} ${n(cy + s)}L${n(cx - k)} ${n(cy + h)}L${n(cx - k)} ${n(cy - h)}Z`;
  const attrs = (o.opacity !== undefined ? ` opacity="${n(o.opacity)}"` : '') + (o.rotate ? ` transform="rotate(${n(o.rotate)} ${n(cx)} ${n(cy)})"` : '');
  if (o.ghost) {
    const edges = `M${n(cx)} ${n(cy)}L${n(cx)} ${n(cy + s)}M${n(cx)} ${n(cy)}L${n(cx - k)} ${n(cy - h)}M${n(cx)} ${n(cy)}L${n(cx + k)} ${n(cy - h)}`;
    return (
      `<g${attrs} fill="none" stroke="${hsl(hue, 80, 72)}" stroke-width="${n(Math.max(0.2, s * 0.05))}" stroke-dasharray="${n(s * 0.16)} ${n(s * 0.12)}" stroke-linejoin="round">` +
      `<path d="${base}" fill="${hsl(hue, 80, 60, 0.08)}"/><path d="${edges}" opacity=".7"/></g>`
    );
  }
  const [left, right] = sideFaces(value);
  const face = (m: number[], light: number, v: number) =>
    `<g transform="matrix(${m.map(n).join(' ')})">` +
    `<rect x=".05" y=".05" width=".9" height=".9" rx=".16" fill="${hsl(hue, 62, light)}"/>` +
    (o.pips === false ? [] : PIPS[v]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".085" fill="${hsl(hue, 70, light < 40 ? 88 : 12)}" opacity=".9"/>`).join('') +
    `</g>`;
  return (
    `<g${attrs}>` +
    `<path d="${base}" fill="${hsl(hue, 60, 10)}" stroke="${hsl(hue, 60, 10)}" stroke-width="${n(s * 0.08)}" stroke-linejoin="round"/>` +
    face([k, h, -k, h, cx, cy - s], 64, value) +
    face([k, h, 0, s, cx - k, cy - h], 46, left) +
    face([k, -h, 0, s, cx, cy], 30, right) +
    `</g>`
  );
}

/** A ship with its engine glow. */
export const ship = (id: string, cx: number, cy: number, s: number, value: number, hue: number, o: DieOptions = {}): Fragment => {
  if (o.ghost) return f(die(cx, cy, s, value, hue, o));
  const g = glow(id, cx, cy + s * 0.9, s * 1.5, s * 0.55, hue, 0.55 * (o.opacity ?? 1));
  return { defs: g.defs, body: g.body + die(cx, cy, s, value, hue, o) };
};

/** A player's cube (dominance marker on a planet): a small plain die. */
export const cube = (cx: number, cy: number, s: number, hue: number, o: DieOptions = {}) => die(cx, cy, s, 1, hue, { ...o, pips: false });
