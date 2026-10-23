import { n } from '../svg';
import { farInk, mono, type MechInk } from './inks';
import { RIGS, type MechKind, type Rig } from './mechs';

/**
 * A mech posed and printed (mechs.ts has the rigs). Angles are in degrees on the page, clockwise positive,
 * for the limb at x > 0 (`plus`, the viewer's right when front on) and the mirrored one (`minus`); each
 * segment's angle is added to the one before it, so a leg's `[hip, knee]` bends at the knee. The feet stay
 * flat unless given, and the mech stands on its lowest foot.
 */
export interface Pose {
  /** Turned to three-quarters: + shows its `plus` side, its side face on the viewer's right; − its `minus` side, on the left. ±35 reads well. */
  yaw?: number;
  /** The upper body leaning about the hips: + clockwise. */
  lean?: number;
  legs?: { plus?: readonly number[]; minus?: readonly number[] };
  arms?: { plus?: readonly number[]; minus?: readonly number[] };
  /** The held rifle's turn about its grip (the Sniper): + clockwise. */
  aim?: number;
}

/** How a mech is placed: its feet's middle at `x`, `y` (mm), `size` mm per board unit, mirrored when `flip`. */
export interface Placing {
  x: number;
  y: number;
  size: number;
  flip?: boolean;
  pose?: Pose;
  ink: MechInk;
  /** The paper behind it, for the far limbs' ink. */
  paper: string;
  /** A colour plate printed under it, offset by `dx`, `dy` mm: the misregistered second pass. */
  plate?: { colour: string; dx: number; dy: number };
}

type Part = Rig['hull'][number];

function part([kind, d, w]: Part, c: MechInk): string {
  const stroke = (colour: string, width: number) =>
    ` fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
  const attrs: Record<string, string> = {
    k: ` fill="${c.key}" stroke="${c.seam}" stroke-width="1.4" stroke-linejoin="round"`,
    j: ` fill="${c.joint}"`,
    r: ` fill="${c.recess}"`,
    l: stroke(c.seam, 1.4),
    rod: stroke(c.rod, w ?? 4),
    p: stroke(c.light, w ?? 2),
    pf: ` fill="${c.light}"`,
    w: stroke(c.key, w ?? 2.5),
    gun: ` fill="${c.gun}" stroke="${c.recess}" stroke-width="1.4" stroke-linejoin="round"`,
  };
  return `<path d="${d}"${attrs[kind]}/>`;
}

const parts = (ps: readonly Part[], c: MechInk) => ps.map((p) => part(p, c)).join('');

/** Turns `[x, y]` by `deg` about `[cx, cy]`. */
function turn([x, y]: readonly [number, number], deg: number, [cx, cy]: readonly [number, number]): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** A leg's angles with the foot kept flat when not given. */
const legAngles = (a: readonly number[] = [], segs: number) => {
  const out = Array.from({ length: segs }, (_, i) => a[i] ?? 0);
  if (segs > 2 && a[2] === undefined) out[2] = -(out[0] + out[1]);
  return out;
};

/** A limb's segments, each turned about its pivot by its angle, nested so each carries the next. */
function chain(rig: Rig, which: 'leg' | 'arm', angles: readonly number[], c: MechInk, extra: readonly (readonly Part[])[] = []): string {
  const segs = rig[which];
  let open = '';
  let close = '';
  segs.forEach((s, i) => {
    open += `<g transform="rotate(${n(angles[i] ?? 0)} ${s.pivot[0]} ${s.pivot[1]})">${parts(s.parts, c)}${parts(extra[i] ?? [], c)}`;
    close += '</g>';
  });
  return open + close;
}

/** Where a leg's ankle ends up, its y: to stand the mech on its lowest foot. */
function ankleY(rig: Rig, angles: readonly number[]): number {
  const [hip, knee, ankle] = rig.leg;
  if (!ankle) return 0;
  let p: [number, number] = [ankle.pivot[0], ankle.pivot[1]];
  p = turn(p, angles[1], knee.pivot);
  p = turn(p, angles[0], hip.pivot);
  return p[1] - ankle.pivot[1];
}

/** One side's limb: drawn as is at x > 0, mirrored for `minus`, with its angles mirrored to stay on the page's sense. */
const side = (sign: 1 | -1, body: string) => (sign > 0 ? body : `<g transform="scale(-1,1)">${body}</g>`);

/** The mech drawn in board units with `c`: everything but the placing. */
function drawn(kind: MechKind, pose: Pose, c: MechInk, far: MechInk): string {
  const rig = RIGS[kind];
  const yaw = pose.yaw ?? 0;
  const turned = Math.abs(yaw) > 1;
  const cos = Math.cos((yaw * Math.PI) / 180);
  const sideFace = (rig.depth * Math.abs(Math.sin((yaw * Math.PI) / 180))) / cos;
  // The side turned towards the viewer is nearer: its face shows, and its limbs are drawn over the hull.
  const near: 1 | -1 = yaw > 0 ? 1 : -1;
  const legA = (s: 1 | -1) => legAngles(s > 0 ? pose.legs?.plus : pose.legs?.minus, rig.leg.length).map((a) => a * s);
  const armA = (s: 1 | -1) =>
    Array.from({ length: rig.arm.length }, (_, i) => ((s > 0 ? pose.arms?.plus : pose.arms?.minus)?.[i] ?? 0) * s);
  const extra = (s: 1 | -1) => (s > 0 ? rig.armExtra?.plain : rig.armExtra?.mirror);
  const leg = (s: 1 | -1, ink: MechInk) => side(s, chain(rig, 'leg', legA(s), ink));
  const arm = (s: 1 | -1, ink: MechInk) => (rig.arm.length ? side(s, chain(rig, 'arm', armA(s), ink, extra(s))) : '');
  const hipY = rig.leg[0].pivot[1];
  const held = rig.held
    ? `<g transform="rotate(${n(pose.aim ?? 0)} ${rig.held.pivot[0]} ${rig.held.pivot[1]})"><g transform="${rig.held.frame}">${parts(rig.held.gun, c)}</g>${parts(rig.held.hands, c)}</g>`
    : '';
  const upper = (body: string) => `<g transform="rotate(${n(pose.lean ?? 0)} 0 ${hipY})">${body}</g>`;
  // Stand on the lowest foot.
  const drop = -Math.max(ankleY(rig, legA(1)), ankleY(rig, legA(-1)));
  let out: string;
  if (!turned) {
    out =
      leg(1, c) + leg(-1, c) + upper(parts(rig.hull, c) + parts(rig.detail, c) + arm(1, c) + arm(-1, c) + held + parts(rig.top ?? [], c));
  } else {
    // The limbs stand halfway back, the hull's side face runs back from its front.
    const shift = (body: string, by: number) => `<g transform="translate(${n(by)},0)">${body}</g>`;
    const limbs = (near * sideFace) / 2;
    const steps = 8;
    let slab = '';
    for (let i = steps; i >= 1; i--) slab += shift(parts(rig.hull, mono(c.side)), (near * sideFace * i) / steps);
    out =
      upper(shift(arm(-near as 1 | -1, far), limbs)) +
      shift(leg(-near as 1 | -1, far), limbs) +
      shift(leg(near, c), limbs) +
      upper(slab + parts(rig.hull, c) + parts(rig.detail, c) + parts(rig.top ?? [], c) + shift(arm(near, c), limbs) + held);
    out = `<g transform="scale(${n(cos)},1)">${out}</g>`;
  }
  return `<g transform="translate(0,${n(drop)})">${out}</g>`;
}

/** A mech posed and placed, with its colour plate under it. */
export function mech(kind: MechKind, o: Placing): string {
  const rig = RIGS[kind];
  const pose = o.pose ?? {};
  const s = o.size * (rig.scale ?? 1);
  const place = (dx: number, dy: number, body: string) =>
    `<g transform="translate(${n(o.x + dx)},${n(o.y + dy)}) scale(${n(o.flip ? -s : s)},${n(s)})">${body}</g>`;
  const plate = o.plate ? place(o.plate.dx, o.plate.dy, drawn(kind, pose, mono(o.plate.colour), mono(o.plate.colour))) : '';
  return plate + place(0, 0, drawn(kind, pose, o.ink, farInk(o.ink, o.paper)));
}
