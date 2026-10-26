/** What the Regolith card scenes (skills.ts, tactics.ts) share beyond the kit: the usual ground, flags, flames, gloves. */
import { n } from '../../svg';
import { INKS } from '../inks';
import type { Pose } from '../pose';
import { land, mech, paperGround, sky, stencil, type Stage } from '../kit';

/** The usual horizon. */
const HZ = 33;

/** Paper, sky and the world's ground: the start of most scenes. */
export const outdoors = (s: Stage, horizon = HZ, o: Parameters<typeof sky>[1] = {}) => paperGround(s) + sky(s, o) + land(s, horizon);

export const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
export const stroke = (d: string, ink: string, w: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

/** The stage's mech ink with the key in the side ink: a wreck, or a mech further back. */
export const sideInk = (s: Stage) => ({ ...s.ink, key: s.ink.side });

/** A downed mech: in the side ink, knocked over by `deg` about its feet at `x`, `y`. */
export const wreck = (s: Stage, kind: Parameters<typeof mech>[1], x: number, y: number, size: number, deg: number, plate?: false) =>
  `<g transform="rotate(${deg} ${x} ${y})">${mech(s, kind, x, y, size, { yaw: 25 }, { ink: sideInk(s), plate })}</g>`;

/** A gloved hand: a mitten from the wrist at `x`, `y`, turned `deg`, `size` mm long. */
export const glove = (x: number, y: number, size: number, deg: number, ink: string) =>
  `<g transform="translate(${n(x)},${n(y)}) rotate(${n(deg)}) scale(${n(size / 10)})"><path d="M-3,0 L-3,-6 Q-3,-10 1,-10 L5,-10 Q8,-10 8,-7 L8,-2 L4,0 Z" fill="${ink}"/><path d="M-3,-5 L-6,-8 Q-8,-6 -5,-3 L-3,-2 Z" fill="${ink}"/><rect x="-4" y="0" width="9" height="6" fill="${ink}"/></g>`;

/** A flag on its pole, the cloth in `cloth`, its foot at `x`, `y`. */
export const flag = (s: Stage, x: number, y: number, h: number, cloth: string, text = '', dir = 1) =>
  stroke(`M${n(x)},${n(y)} L${n(x)},${n(y - h)}`, s.key, 0.6) +
  path(
    `M${n(x)},${n(y - h)} q${n(dir * 4)},-1.2 ${n(dir * 9)},0.6 l${n(-dir * 0.6)},${n(h * 0.18)} l${n(dir * 0.6)},${n(h * 0.18)} q${n(-dir * 5)},-1.6 ${n(-dir * 9)},0.4 Z`,
    cloth,
  ) +
  (text ? stencil(text, x + dir * 4.4, y - h + h * 0.27, h * 0.24, s.key) : '');

/** A hex outline on the ground in perspective, centred at `x`, `y`, `r` across, squashed by `squash`. */
export const hexOnGround = (x: number, y: number, r: number, squash: number, ink: string, w = 0.5, dash = '') => {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 * Math.PI) / 180;
    return `${n(x + Math.cos(a) * r)},${n(y + Math.sin(a) * r * squash)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="none" stroke="${ink}" stroke-width="${n(w)}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
};

/** A booster's flame pointing down from `x`, `y`: amber round a bone core, `w` wide and `len` long. */
const flame = (x: number, y: number, w: number, len: number) =>
  path(
    `M${n(x - w / 2)},${n(y)} Q${n(x - w * 0.3)},${n(y + len * 0.5)} ${n(x)},${n(y + len)} Q${n(x + w * 0.3)},${n(y + len * 0.5)} ${n(x + w / 2)},${n(y)} Z`,
    INKS.amber,
  ) +
  path(
    `M${n(x - w * 0.22)},${n(y)} Q${n(x - w * 0.12)},${n(y + len * 0.3)} ${n(x)},${n(y + len * 0.55)} Q${n(x + w * 0.12)},${n(y + len * 0.3)} ${n(x + w * 0.22)},${n(y)} Z`,
    INKS.bone,
  );

/** How far each mech's feet stand from its middle, in board units, for its boosters. */
const FEET = { breacher: 62, behemoth: 80, tactician: 44, chameleon: 42, sniper: 40, wisp: 70 } as const;

/** How a dropping mech holds itself: legs tucked a little, arms out. */
const TUCKED = { legs: { plus: [-10, 24], minus: [10, -24] }, arms: { plus: [-20, 0], minus: [-20, 0] } } as const;

/** A mech coming down on its boosters: tucked unless posed, a flame under each foot, its feet's middle at `x`, `y`. */
export const dropping = (s: Stage, kind: keyof typeof FEET, x: number, y: number, size: number, yaw = 0, pose: Pose = TUCKED) => {
  const feet = FEET[kind] * size;
  return (
    flame(x - feet, y, 34 * size, 150 * size) + flame(x + feet, y, 34 * size, 150 * size) + mech(s, kind, x, y, size, { ...pose, yaw })
  );
};
