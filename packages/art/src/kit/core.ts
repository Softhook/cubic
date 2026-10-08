import type { Box } from '../starfield';
import type { Rng } from '../rng';
import { n, type Fragment } from '../svg';

/** The base every card illustration is drawn on: the scene it gets, and small helpers. Sizes in mm. */

/** A scene's frame and colours. Every card illustration is a function of one of these. */
export interface Scene {
  id: string;
  r: Rng;
  /** The card's category hue: holo lines, highlights. */
  hue: number;
  /** Art box: the visible window. */
  box: Box;
  /** Two player hues for ships, different for every card: p1 is "you", p2 an opponent. */
  p1: number;
  p2: number;
}

export type Draw = (s: Scene) => Fragment[];

/** A point at a fraction of the art box. */
export const at = (box: Box, fx: number, fy: number): [number, number] => [box.x + box.w * fx, box.y + box.h * fy];

export const f = (body: string, defs = ''): Fragment => ({ defs, body });

export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(w)}" stroke-linecap="round"${extra}/>`;

/** A ` transform` attribute turning a piece `deg` degrees about (cx, cy); empty when it isn't turned. */
export const rotate = (deg: number | undefined, cx: number, cy: number) => (deg ? ` transform="rotate(${n(deg)} ${n(cx)} ${n(cy)})"` : '');
