import { n } from '../svg';
import { mono, type MechInk } from './inks';
import { RIGS, type MechKind, type Rig } from './mechs';

/**
 * A mech posed and printed (mechs.ts has the rigs). Angles are in degrees on the page, clockwise positive,
 * for the limb at x > 0 (`plus`, the viewer's right when front on) and the mirrored one (`minus`); each
 * segment's angle is added to the one before it, so a leg's `[hip, knee]` bends at the knee. The feet stay
 * flat unless given, and the mech stands on its lowest foot.
 *
 * Turned (`yaw`), it is drawn in 3D: every part is its front-view outline pushed back through its depth (the
 * hull's, or its limb's thickness), the whole mech turned about its upright axis, and each group (a leg, the
 * hull, an arm) drawn far to near. A part's back and sides print in the side ink, its front over them.
 */
export interface Pose {
  /** Turned towards the viewer: + brings its `plus` side nearer, − its `minus` side. ±35 reads well. */
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
  /** A colour plate printed under it, offset by `dx`, `dy` mm: the misregistered second pass. */
  plate?: { colour: string; dx: number; dy: number };
}

type Part = Rig['hull'][number];
type Pt = [number, number];
/** An affine map: x' = a x + c y + e, y' = b x + d y + f. */
type M = readonly [number, number, number, number, number, number];

const I: M = [1, 0, 0, 1, 0, 0];
/** `m` after `k`: k applied first. */
const mul = (m: M, k: M): M => [
  m[0] * k[0] + m[2] * k[1],
  m[1] * k[0] + m[3] * k[1],
  m[0] * k[2] + m[2] * k[3],
  m[1] * k[2] + m[3] * k[3],
  m[0] * k[4] + m[2] * k[5] + m[4],
  m[1] * k[4] + m[3] * k[5] + m[5],
];
const shift = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const turn = (deg: number, cx = 0, cy = 0): M => {
  const a = (deg * Math.PI) / 180;
  return mul(shift(cx, cy), mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], shift(-cx, -cy)));
};
const at = (m: M, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** An SVG transform list of `translate`, `rotate` and `scale`, as a map. */
function transform(list: string): M {
  let m = I;
  for (const [, fn, args] of list.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const [p, q] = args.split(/[ ,]+/).map(Number);
    m = mul(m, fn === 'translate' ? shift(p, q ?? 0) : fn === 'rotate' ? turn(p) : [p, 0, 0, q ?? p, 0, 0]);
  }
  return m;
}

/** A path's outlines as points: lines, Béziers and the rigs' half-circle arcs, sampled. */
function outlines(d: string): { pts: Pt[]; closed: boolean }[] {
  const tokens = d.match(/[MLCQZAmlcqza]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const out: { pts: Pt[]; closed: boolean }[] = [];
  let cur: Pt[] = [];
  let p: Pt = [0, 0];
  let cmd = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  const start = () => {
    if (cur.length) out.push({ pts: cur, closed: false });
    cur = [];
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') {
      start();
      p = [num(), num()];
      cur.push(p);
      cmd = 'L';
    } else if (cmd === 'L') {
      p = [num(), num()];
      cur.push(p);
    } else if (cmd === 'C' || cmd === 'Q') {
      const ctrl: Pt[] =
        cmd === 'C'
          ? [
              [num(), num()],
              [num(), num()],
            ]
          : [[num(), num()]];
      const end: Pt = [num(), num()];
      const all = [p, ...ctrl, end];
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        // De Casteljau.
        let level = all;
        while (level.length > 1)
          level = level.slice(1).map((q, j) => [level[j][0] + (q[0] - level[j][0]) * t, level[j][1] + (q[1] - level[j][1]) * t] as Pt);
        cur.push(level[0]);
      }
      p = end;
    } else if (cmd === 'a') {
      const r = num();
      i += 3;
      const sweep = num();
      const dx = num();
      const dy = num();
      const c: Pt = [p[0] + dx / 2, p[1] + dy / 2];
      const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
      for (let k = 1; k <= 10; k++) {
        const a = a0 + (sweep ? 1 : -1) * Math.PI * (k / 10);
        cur.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
      }
      p = [p[0] + dx, p[1] + dy];
    } else if (cmd === 'Z' || cmd === 'z') {
      if (cur.length) out.push({ pts: cur, closed: true });
      cur = [];
      cmd = '';
    } else i++;
  }
  if (cur.length) out.push({ pts: cur, closed: false });
  return out;
}

const OUTLINES = new Map<string, ReturnType<typeof outlines>>();
const outlinesOf = (d: string) => {
  if (!OUTLINES.has(d)) OUTLINES.set(d, outlines(d));
  return OUTLINES.get(d)!;
};

/** A part placed for drawing: its map in the front plane, the middle of its depth, and its thickness. */
interface Item {
  part: Part;
  m: M;
  z: number;
  t: number;
}

/** A group drawn together (a leg, the hull, an arm): how far out to the side it hangs, its order when level, and its parts. */
interface Group {
  x: number;
  z: number;
  seq: number;
  items: Item[];
}

const FILLS = new Set(['k', 'j', 'r', 'pf', 'gun']);

/** A leg's angles with the foot kept flat when not given. */
const legAngles = (a: readonly number[] = [], segs: number) => {
  const out = Array.from({ length: segs }, (_, i) => a[i] ?? 0);
  if (segs > 2 && a[2] === undefined) out[2] = -(out[0] + out[1]);
  return out;
};

/** The maps of a limb's segments, each turned about its pivot and carrying the next. */
function chainMaps(segs: Rig['leg'], angles: readonly number[], base: M): M[] {
  const maps: M[] = [];
  let m = base;
  segs.forEach((s, i) => {
    m = mul(m, turn(angles[i] ?? 0, s.pivot[0], s.pivot[1]));
    maps.push(m);
  });
  return maps;
}

/** The mech's parts placed, in groups, in board units. */
function groups(rig: Rig, pose: Pose): Group[] {
  const hullT = rig.depth;
  const limbT = rig.limb ?? rig.depth / 2;
  const legA = (s: 1 | -1) => legAngles(s > 0 ? pose.legs?.plus : pose.legs?.minus, rig.leg.length).map((a) => a * s);
  const armA = (s: 1 | -1) =>
    Array.from({ length: rig.arm.length }, (_, i) => ((s > 0 ? pose.arms?.plus : pose.arms?.minus)?.[i] ?? 0) * s);
  const mirror = (s: 1 | -1): M => [s, 0, 0, 1, 0, 0];
  // Stand on the lowest foot: how far each ankle rises.
  const ankleRise = (s: 1 | -1) => {
    if (rig.leg.length < 3) return 0;
    const maps = chainMaps(rig.leg, legA(s), I);
    const ankle = rig.leg[rig.leg.length - 1].pivot;
    return at(maps[rig.leg.length - 2], [ankle[0], ankle[1]])[1] - ankle[1];
  };
  const ground = shift(0, -Math.max(ankleRise(1), ankleRise(-1)));
  const upper = mul(ground, turn(pose.lean ?? 0, 0, rig.leg[0].pivot[1]));
  const item = (part: Part, m: M, z: number, t: number): Item => ({ part, m, z: z + (part[3] ?? 0), t: FILLS.has(part[0]) ? t : 0 });

  const out: Group[] = [];
  // The legs stand a little behind the hull's middle, so the hull's front covers the hips.
  for (const s of [1, -1] as const) {
    const maps = chainMaps(rig.leg, legA(s), mul(ground, mirror(s)));
    out.push({
      x: s * rig.leg[0].pivot[0],
      z: -limbT,
      seq: s > 0 ? 0 : 1,
      items: rig.leg.flatMap((seg, i) => seg.parts.map((p) => item(p, maps[i], 0, limbT))),
    });
  }
  out.push({
    x: 0,
    z: 0,
    seq: 2,
    // Seams and lights on the hull's front.
    items: [...rig.hull.map((p) => item(p, upper, 0, hullT)), ...rig.detail.map((p) => item(p, upper, hullT / 2, 0))],
  });
  for (const s of [1, -1] as const) {
    if (!rig.arm.length) continue;
    const maps = chainMaps(rig.arm, armA(s), mul(upper, mirror(s)));
    const extra = s > 0 ? rig.armExtra?.plain : rig.armExtra?.mirror;
    out.push({
      x: s * rig.arm[0].pivot[0],
      z: 0,
      seq: s > 0 ? 3 : 4,
      items: rig.arm.flatMap((seg, i) => [...seg.parts, ...(extra?.[i] ?? [])].map((p) => item(p, maps[i], 0, limbT))),
    });
  }
  if (rig.held) {
    const grip = mul(upper, turn(pose.aim ?? 0, rig.held.pivot[0], rig.held.pivot[1]));
    const z = hullT / 2 + 6;
    const gun = mul(grip, transform(rig.held.frame));
    out.push({
      x: 0,
      z,
      seq: 5,
      items: [...rig.held.gun.map((p) => item(p, gun, z, 8)), ...rig.held.hands.map((p) => item(p, grip, z + 2, 8))],
    });
  }
  if (rig.top) out.push({ x: 0, z: 0, seq: 6, items: rig.top.map((p) => item(p, upper, 0, limbT * 0.5)) });
  return out;
}

const path = (ps: Pt[], closed: boolean) => 'M' + ps.map(([x, y]) => `${n(x)},${n(y)}`).join(' L') + (closed ? ' Z' : '');

/** Whether an outline turns sharply at its `i`th point: a corner, where a printed edge would run back. */
function corner(ps: Pt[], i: number): boolean {
  const a = ps[(i - 1 + ps.length) % ps.length];
  const b = ps[i];
  const c = ps[(i + 1) % ps.length];
  const u = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const v = Math.atan2(c[1] - b[1], c[0] - b[0]);
  const turned = Math.abs(((v - u + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return turned > Math.PI / 6;
}

/** Twice the signed area: each side wall is wound the same way, so they fill together. */
const area = (ps: Pt[]) => ps.reduce((s, p, i) => s + p[0] * ps[(i + 1) % ps.length][1] - ps[(i + 1) % ps.length][0] * p[1], 0);

/** The mech drawn in board units in `c`. */
function drawn(rig: Rig, pose: Pose, c: MechInk): string {
  const yaw = ((pose.yaw ?? 0) * Math.PI) / 180;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // Turned about the upright axis: + yaw brings x > 0 nearer.
  const view = (p: Pt, z: number): Pt => [p[0] * cos - z * sin, p[1]];
  const fill: Record<string, string> = { k: c.key, j: c.joint, r: c.recess, pf: c.light, gun: c.gun };
  const ordered = groups(rig, pose)
    .map((g) => ({ g, near: g.x * sin + g.z * cos }))
    .sort((a, b) => a.near - b.near || a.g.seq - b.g.seq);
  let out = '';
  for (const { g } of ordered) {
    // The group's backs and side walls first, then its fronts over them.
    let sides = '';
    let edges = '';
    if (Math.abs(sin) > 0.01)
      for (const it of g.items) {
        if (!it.t || it.part[0] === 'pf') continue;
        for (const o of outlinesOf(it.part[1])) {
          if (!o.closed) continue;
          const body = o.pts.map((p) => at(it.m, p));
          const back = body.map((p) => view(p, it.z - it.t / 2));
          const front = body.map((p) => view(p, it.z + it.t / 2));
          const walls = back.map((b, i) => [b, back[(i + 1) % back.length], front[(i + 1) % front.length], front[i]]);
          sides += [back, ...walls].map((q) => path(area(q) < 0 ? [...q].reverse() : q, true)).join(' ') + ' ';
          // Its edges: the back outline, and a line back from each corner; curves stay smooth.
          edges +=
            path(back, true) + ' ' + body.flatMap((_, i) => (corner(body, i) ? [path([front[i], back[i]], false)] : [])).join(' ') + ' ';
        }
      }
    // In the side ink, their edges seamed as the fronts' panel lines are: the parts read as blocks.
    if (sides)
      out +=
        `<path d="${sides}" fill="${c.side}"/>` +
        `<path d="${edges}" fill="none" stroke="${c.seam}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const it of g.items) {
      const [kind, d, w] = it.part;
      const face = outlinesOf(d)
        .map((o) =>
          path(
            o.pts.map((p) => view(at(it.m, p), it.z + it.t / 2)),
            o.closed,
          ),
        )
        .join(' ');
      if (FILLS.has(kind)) {
        const seam =
          kind === 'k' || kind === 'gun' ? ` stroke="${kind === 'k' ? c.seam : c.recess}" stroke-width="1.4" stroke-linejoin="round"` : '';
        out += `<path d="${face}" fill="${fill[kind]}"${seam}/>`;
      } else {
        const colour = kind === 'l' ? c.seam : kind === 'rod' ? c.rod : kind === 'p' ? c.light : c.key;
        const width = w ?? (kind === 'l' ? 1.4 : kind === 'rod' ? 4 : 2.5);
        out += `<path d="${face}" fill="none" stroke="${colour}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
  }
  return out;
}

/** A mech posed and placed, with its colour plate under it. */
export function mech(kind: MechKind, o: Placing): string {
  const rig = RIGS[kind];
  const pose = o.pose ?? {};
  const s = o.size * (rig.scale ?? 1);
  const place = (dx: number, dy: number, body: string) =>
    `<g transform="translate(${n(o.x + dx)},${n(o.y + dy)}) scale(${n(o.flip ? -s : s)},${n(s)})">${body}</g>`;
  const plate = o.plate ? place(o.plate.dx, o.plate.dy, drawn(rig, pose, mono(o.plate.colour))) : '';
  return plate + place(0, 0, drawn(rig, pose, o.ink));
}
