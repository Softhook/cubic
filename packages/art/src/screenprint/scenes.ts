import { icon } from '../icons';
import { n } from '../svg';
import type { World } from '../tile/look';
import { INKS, ON_NIGHT, ON_PAPER, mono } from './inks';
import type { Pose } from './pose';
import {
  GROUND,
  flash,
  ht,
  label,
  land,
  mech,
  paperGround,
  person,
  plated,
  print,
  rays,
  rect,
  rings,
  sky,
  smoke,
  sparks,
  stencil,
  storm,
  type Stage,
} from './kit';

/**
 * One scene per Regolith card, keyed by card id, drawn from the art brief picked for it (data/regolith.yaml
 * `art`): the mechs posed from their rigs, the buildings and ground the tiles have. The art window is 63.5 wide
 * and 42 tall, in mm; scenes may draw past it into the bleed.
 */
export interface SpScene {
  world: World;
  /** What it shows, for the Art Lab. */
  caption: string;
  draw: (s: Stage) => string;
}

/** The usual horizon. */
const HZ = 33;

/** Paper, sky and the world's ground: the start of most scenes. */
const outdoors = (s: Stage, horizon = HZ, o: Parameters<typeof sky>[1] = {}) => paperGround(s) + sky(s, o) + land(s, horizon);

const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const stroke = (d: string, ink: string, w: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

/** The stage's mech ink with the key in the side ink: a wreck, or a mech further back. */
const sideInk = (s: Stage) => ({ ...s.ink, key: s.ink.side });

/** A downed mech: in the side ink, knocked over by `deg` about its feet at `x`, `y`. */
const wreck = (s: Stage, kind: Parameters<typeof mech>[1], x: number, y: number, size: number, deg: number, plate?: false) =>
  `<g transform="rotate(${deg} ${x} ${y})">${mech(s, kind, x, y, size, { yaw: 25 }, { ink: sideInk(s), plate })}</g>`;

/** A gloved hand: a mitten from the wrist at `x`, `y`, turned `deg`, `size` mm long. */
const glove = (x: number, y: number, size: number, deg: number, ink: string) =>
  `<g transform="translate(${n(x)},${n(y)}) rotate(${n(deg)}) scale(${n(size / 10)})"><path d="M-3,0 L-3,-6 Q-3,-10 1,-10 L5,-10 Q8,-10 8,-7 L8,-2 L4,0 Z" fill="${ink}"/><path d="M-3,-5 L-6,-8 Q-8,-6 -5,-3 L-3,-2 Z" fill="${ink}"/><rect x="-4" y="0" width="9" height="6" fill="${ink}"/></g>`;

/** A flag on its pole, the cloth in `cloth`, its foot at `x`, `y`. */
const flag = (s: Stage, x: number, y: number, h: number, cloth: string, text = '', dir = 1) =>
  stroke(`M${n(x)},${n(y)} L${n(x)},${n(y - h)}`, s.key, 0.6) +
  path(
    `M${n(x)},${n(y - h)} q${n(dir * 4)},-1.2 ${n(dir * 9)},0.6 l${n(-dir * 0.6)},${n(h * 0.18)} l${n(dir * 0.6)},${n(h * 0.18)} q${n(-dir * 5)},-1.6 ${n(-dir * 9)},0.4 Z`,
    cloth,
  ) +
  (text ? stencil(text, x + dir * 4.4, y - h + h * 0.27, h * 0.24, s.key) : '');

/** A hex outline on the ground in perspective, centred at `x`, `y`, `r` across, squashed by `squash`. */
const hexOnGround = (x: number, y: number, r: number, squash: number, ink: string, w = 0.5, dash = '') => {
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
const dropping = (s: Stage, kind: keyof typeof FEET, x: number, y: number, size: number, yaw = 0, pose: Pose = TUCKED) => {
  const feet = FEET[kind] * size;
  return (
    flame(x - feet, y, 34 * size, 150 * size) + flame(x + feet, y, 34 * size, 150 * size) + mech(s, kind, x, y, size, { ...pose, yaw })
  );
};

export const SCENES: Record<string, SpScene> = {
  // ---------------------------------------------------------------------------------------------- Skills
  'r-agile': {
    world: 'deimos',
    caption: "a mechanic on a step ladder, a wrench on a Wisp's knee joint, sparks flying",
    draw: (s) =>
      paperGround(s) +
      rays(36, 16, 26, s.plate) +
      land(s, 36, { rims: false }) +
      mech(s, 'wisp', 24, 39, 0.19, { yaw: -28 }) +
      // the step ladder, the mechanic on it, the wrench on the knee
      stroke('M44,39 L48,22 M52,39 L48,22 M45.2,34 L50.8,34 M46.4,29 L49.6,29', s.key, 0.7) +
      `<g transform="rotate(16 37 15.6)">${rect(37, 14.4, 9, 2.4, s.key)}<circle cx="37" cy="15.6" r="2.6" fill="none" stroke="${s.key}" stroke-width="1.4"/></g>` +
      person(48, 29, 0.2, { facing: -1, arms: [124, 112], elbows: [-10, -6], lean: -6, legs: [6, -6] }, s.key, s.paper) +
      sparks(s.r, 37, 15.6, 16, 8) +
      flash(37, 15.6, 2, 8),
  },

  'r-ambitious': {
    world: 'mars',
    caption: 'a Breacher pushed past its limit',
    draw: (s) =>
      paperGround(s) +
      rays(30, 14, 30, s.plate, 180, 360) +
      land(s, 34) +
      mech(s, 'breacher', 30, 36, 0.12, {
        yaw: -32,
        lean: 10,
        legs: { plus: [-20, 26], minus: [18, 8] },
        arms: { plus: [-30, -20], minus: [26, 10] },
      }),
  },
  'r-brilliant': {
    world: 'phobos',
    caption: 'a radar station on the surface, its dish on the roof, its pulses going down through the strata',
    draw: (s) => {
      const g = GROUND[s.world];
      // the ground cut away under the station: strata, and the pulses going down through them
      let strata = '';
      for (let i = 0; i < 4; i++) {
        const y = 21 + i * 5;
        strata += stroke(`M-3,${n(y)} q8,${n(-1 + (i % 2) * 2)} 16,0 t16,0 t16,0 t16,0 t16,0`, g.shade, 0.5, ' opacity="0.8"');
      }
      return (
        paperGround(s) +
        sky(s, { planet: { x: 54, y: 6, r: 6 } }) +
        land(s, 16, { marks: false }) +
        rect(-3, 17.5, 70, 28, ht(s, 'shade'), ' opacity="0.6"') +
        strata +
        rings(26, 16.5, 3, 4, 6, INKS.amber, 0.6, 20, 160) +
        print(s, 'containers', 9, 16.5, { size: 0.08 }) +
        print(s, 'workshop', 26, 16.5, { size: 0.12 }) +
        print(s, 'dish', 21, 9.4, { size: 0.08 }) +
        print(s, 'mast', 41, 16.5, { size: 0.1 })
      );
    },
  },
  'r-brutal': {
    world: 'deimos',
    caption: 'a Breacher front on, firing both fists at the viewer, two muzzle flashes',
    draw: (s) =>
      paperGround(s) +
      rays(32, 20, 32, s.plate) +
      land(s, 36, { rims: false }) +
      mech(s, 'breacher', 32, 40, 0.13, { arms: { plus: [-16, -10], minus: [16, 10] } }) +
      flash(14, 31.5, 4.2, 10) +
      flash(50, 31.5, 4.2, 10, 12) +
      sparks(s.r, 14, 31.5, 12, 10) +
      sparks(s.r, 50, 31.5, 12, 10),
  },
  'r-calculating': {
    world: 'phobos',
    caption: 'the salvage yard crane lowering one chassis over a wreck',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 14, y: 9, r: 7 } }) +
      print(s, 'rocks', 22, 36, { size: 0.16, plate: GROUND.phobos.shade }) +
      wreck(s, 'tactician', 44, 34, 0.08, -78) +
      print(s, 'crane', 54, 34, { size: 0.16, flip: true }) +
      stroke('M41.2,14.8 L41.2,22', s.key, 0.4) +
      stroke('M40,22 q1.2,2 2.4,0', s.key, 0.6) +
      mech(s, 'chameleon', 41, 32, 0.045, { yaw: -25 }, { plate: INKS.oxide }),
  },
  'r-clever': {
    world: 'mars',
    caption: 'a Chameleon in a gantry, one arm off and hanging from the hoist beside its open shoulder',
    draw: (s) =>
      outdoors(s, 36, { planet: { x: 54, y: 8, r: 8 } }) +
      print(s, 'gantry', 32, 38, { size: 0.24 }) +
      mech(s, 'chameleon', 28, 38, 0.115, { detach: { arm: 'plus', show: 'mech' } }) +
      stroke('M42.4,5.6 L42.4,16', s.key, 0.35, ' stroke-dasharray="0.6 0.4"') +
      mech(s, 'chameleon', 35, 38.5, 0.115, { detach: { arm: 'plus', show: 'arm' } }) +
      sparks(s.r, 35.4, 15.5, 10, 5),
  },
  'r-composed': {
    world: 'phobos',
    caption: 'a Chameleon powered down in a low crouch, a radar dish beside it sweeping the sky',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 34, y: 8, r: 6 } }) +
      smoke(s, 18, 14, 10, GROUND.phobos.light) +
      mech(s, 'chameleon', 18, 40, 0.12, {
        yaw: -12,
        legs: { plus: [-34, 62], minus: [34, -62] },
        arms: { plus: [4, 0], minus: [-4, 0] },
      }) +
      // the dish: its sweep fanning out from the feed
      `<path d="M51.4,15.4 L38,-4 L64,-4 Z" fill="${INKS.amber}" opacity="0.22"/>` +
      rings(51.4, 15.4, 3, 3, 5, INKS.amber, 0.6, 235, 305) +
      print(s, 'dish', 48, 34, { size: 0.3 }),
  },
  'r-cunning': {
    world: 'deimos',
    caption: 'a Tactician with its ability pulsing out twice, dotted rings to its left and right',
    draw: (s) => {
      // dotted arcs, one set each side: the ability used a second time
      const pulse = (from: number, to: number) =>
        [7, 12, 17, 22, 27, 32]
          .map((r, i) => {
            const a1 = (from * Math.PI) / 180;
            const a2 = (to * Math.PI) / 180;
            return `<path d="M${n(32 + Math.cos(a1) * r)},${n(24 + Math.sin(a1) * r)} A${r},${r} 0 0,1 ${n(32 + Math.cos(a2) * r)},${n(24 + Math.sin(a2) * r)}" fill="none" stroke="${INKS.ice}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="0.01 2.6" opacity="${n(1 - i * 0.1)}"/>`;
          })
          .join('');
      return (
        outdoors(s, 36, { planet: { x: 54, y: 8, r: 6 } }) +
        pulse(140, 220) +
        pulse(-40, 40) +
        mech(s, 'tactician', 32, 39, 0.1, { yaw: 20 })
      );
    },
  },
  'r-curious': {
    world: 'phobos',
    caption: 'a Wisp working a core drill on its tripod over cracked ice',
    draw: (s) =>
      outdoors(s, 30) +
      `<ellipse cx="26" cy="38" rx="22" ry="3.4" fill="${INKS.ice}"/>` +
      stroke('M26,38 l-6,1.5 l-5,-0.6 M26,38 l4,2 l7,0.4 M26,38 l2,-1.6 l8,-0.8', s.key, 0.35) +
      // the tripod, its drill string and motor, a core coming up
      stroke('M26,14 L17,39 M26,14 L35,39 M26,14 L27,40', s.key, 0.8) +
      rect(25.3, 14, 1.4, 24, s.key) +
      rect(22.6, 18, 6.8, 4.4, s.plate, ` stroke="${s.key}" stroke-width="0.5"`) +
      `<circle cx="26" cy="13.6" r="1.4" fill="${INKS.amber}"/>` +
      rect(9, 34.6, 8, 1.6, INKS.ice, ` stroke="${s.key}" stroke-width="0.35"`) +
      mech(s, 'wisp', 49, 40, 0.13, { yaw: -24 }),
  },
  'r-dangerous': {
    world: 'mars',
    caption: 'a Breacher with charges strapped across its chest',
    draw: (s) => {
      const charges = [-30, -10, 10, 30]
        .map(
          (x) =>
            `<rect x="${x - 7}" y="-152" width="14" height="20" fill="${INKS.amber}" stroke="${s.key}" stroke-width="1.4"/><path d="M${x - 7},-142 h14" stroke="${s.key}" stroke-width="1.2"/>`,
        )
        .join('');
      // diagonal stripes behind it, like a hazard board
      let stripes = '';
      for (let x = -48; x < 72; x += 10) stripes += path(`M${x},-4 l5,0 l46,46 l-5,0 Z`, s.plate);
      return (
        paperGround(s) +
        stripes +
        land(s, 38, { rims: false }) +
        mech(s, 'breacher', 32, 44, 0.165, { arms: { plus: [10, -10], minus: [10, -10] } }) +
        `<g transform="translate(32,44) scale(0.165)">${charges}</g>`
      );
    },
  },
  'r-devious': {
    world: 'deimos',
    caption: 'a Wisp ducking between an enemy Behemoth’s legs',
    draw: (s) =>
      outdoors(s, 36, { planet: { x: 32, y: 10, r: 7 } }) +
      mech(s, 'behemoth', 31, 44, 0.38, { yaw: 12, legs: { plus: [-14, 20], minus: [18, -14] } }, { plate: INKS.oxide }) +
      mech(s, 'wisp', 30.5, 40.5, 0.08, { yaw: -40, legs: { plus: [24, -24], minus: [-24, 24] } }, { ink: ON_NIGHT }) +
      stroke('M34,39 l5,0 M33,41 l6,0', s.key, 0.45, ' opacity="0.6"'),
  },
  'r-ferocious': {
    world: 'mars',
    caption: 'a Chameleon firing its long gun level, the barrel red hot, a round leaving it',
    draw: (s) =>
      paperGround(s) +
      rays(42, 19.6, 26, s.plate, 120, 240) +
      land(s, 34) +
      mech(s, 'chameleon', 18, 38, 0.12, { arms: { plus: [-10, -80] } }) +
      rect(30, 18.4, 11, 2.4, ht(s, 'plate')) +
      flash(42, 19.6, 4, 11) +
      stroke('M46,19.6 L66,19.6', INKS.amber, 0.7, ' stroke-dasharray="3 1.4"'),
  },

  'r-flexible': {
    world: 'phobos',
    caption: "a repair arm on its floor mount welding at a Tactician's hip joint",
    draw: (s) => {
      const joint = (x: number, y: number, r: number) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${s.key}"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="${s.plate}"/>`;
      return (
        outdoors(s, 34, { planet: { x: 12, y: 8, r: 8 } }) +
        mech(s, 'tactician', 22, 40, 0.11, { yaw: 24 }) +
        // the arm: a floor mount, two booms with their hydraulics, a welding head at the hip
        plated(s, (ink) => rect(48, 36.4, 12, 3.6, ink) + rect(51, 32, 6, 4.6, ink)) +
        stroke('M54,32 L49,14', s.key, 3) +
        stroke('M56,31 L51.6,17', s.ink.rod, 0.6) +
        stroke('M49,14 L36,24', s.key, 2.4) +
        stroke('M47,17 L38.6,23', s.ink.rod, 0.5) +
        joint(54, 32, 2.4) +
        joint(49, 14, 2) +
        `<g transform="rotate(38 36 24)">${rect(32, 22.8, 5, 2.4, s.key)}${rect(30.4, 23.4, 1.8, 1.2, INKS.amber)}</g>`
      );
    },
  },

  'r-hostile': {
    world: 'mars',
    caption: 'a Chameleon striding on past a smoking wreck, already turning to the next target',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 54, y: 8, r: 7 } }) +
      smoke(s, 9, 37, 30, GROUND.mars.shade) +
      wreck(s, 'tactician', 8, 39, 0.07, 84, false) +
      mech(s, 'chameleon', 34, 40, 0.115, { yaw: 34, legs: { plus: [-26, 36], minus: [24, 6] }, arms: { plus: [-60, -24] }, lean: -4 }),
  },
  'r-industrious': {
    world: 'deimos',
    caption: 'two mechs coming down side by side on their booster flames',
    draw: (s) =>
      outdoors(s, 37, { planet: { x: 54, y: 8, r: 7 } }) +
      // face on, standing straight
      dropping(s, 'breacher', 19, 24, 0.075, 18, {}) +
      dropping(s, 'chameleon', 44, 19, 0.075, -18, {}),
  },
  'r-intelligent': {
    world: 'mars',
    caption: "a hand terminal spliced into an objective's panel, its 8 flickering to 7 and 9",
    draw: (s) =>
      paperGround(s) +
      rect(6, 4, 40, 34, s.key) +
      rect(10, 8, 32, 20, s.ink.recess) +
      stencil('7', 18, 24, 15, INKS.oxide) +
      stencil('9', 34, 24, 15, INKS.ice) +
      stencil('8', 26.4, 24.6, 16, INKS.amber) +
      rect(10, 8, 32, 20, ht(s, 'key'), ' opacity="0.4"') +
      [12, 18, 24, 30].map((x) => rect(x, 31, 4, 3, s.ink.seam)).join('') +
      stroke('M44,30 C52,30 50,38 56,36', INKS.oxide, 1) +
      stroke('M44,33 C50,34 48,40 56,38', INKS.amber, 0.8) +
      `<g transform="rotate(-14 57 30)">${rect(52, 22, 11, 17, s.key)}${rect(53.5, 24, 8, 7, INKS.ice)}${label('ACCESS', 57.5, 28.2, 1.2, s.key)}${[33, 35.5].map((y) => rect(53.5, y, 8, 1.4, s.ink.seam)).join('')}</g>` +
      glove(60, 44, 9, -20, s.key),
  },
  'r-patient': {
    world: 'phobos',
    caption: 'a battle plan: mechs drawn on a hex map, little lines joining them to where they go next',
    draw: (s) => {
      // the sheet: a flat-topped hex grid (odd columns half a row down), our mechs in key, theirs in oxide, the moves drawn between cells
      const R = 5.2;
      const SQ = 0.88;
      const ROW = Math.sqrt(3) * R * SQ;
      const cell = (col: number, row: number): [number, number] => [4 + col * 1.5 * R, 4 + row * ROW + (col % 2) * (ROW / 2)];
      let grid = '';
      for (let row = -1; row < 6; row++) for (let col = 0; col < 10; col++) grid += hexOnGround(...cell(col, row), R, SQ, s.ink.seam, 0.3);
      const dot = ([x, y]: [number, number], ink: string) =>
        `<circle cx="${n(x)}" cy="${n(y)}" r="1.1" fill="none" stroke="${ink}" stroke-width="0.5"/>`;
      // a dashed move from one cell to another, bowed by `bow`, its tip stopping short of the dot
      const arrow = (from: [number, number], to: [number, number], bow: number, ink: string) => {
        const [x1, y1] = [from[0], from[1] - 1.6];
        const [mx, my] = [(x1 + to[0]) / 2, (y1 + to[1]) / 2];
        const len = Math.hypot(to[0] - x1, to[1] - y1);
        const [cx, cy] = [mx + ((to[1] - y1) / len) * bow, my - ((to[0] - x1) / len) * bow];
        const dl = Math.hypot(to[0] - cx, to[1] - cy);
        const [ux, uy] = [(to[0] - cx) / dl, (to[1] - cy) / dl];
        const [ex, ey] = [to[0] - ux * 1.5, to[1] - uy * 1.5];
        const [bx, by] = [ex - ux * 2.2, ey - uy * 2.2];
        return (
          stroke(
            `M${n(x1 + ux * 2.5)},${n(y1 + uy * 2.5)} Q${n(cx)},${n(cy)} ${n(bx)},${n(by)}`,
            ink,
            0.55,
            ' stroke-dasharray="1.2 0.8"',
          ) + path(`M${n(ex)},${n(ey)} L${n(bx - uy * 1.2)},${n(by + ux * 1.2)} L${n(bx + uy * 1.2)},${n(by - ux * 1.2)} Z`, ink)
        );
      };
      const at = (kind: Parameters<typeof mech>[1], [x, y]: [number, number], size: number, o: Parameters<typeof mech>[6] = {}) =>
        mech(s, kind, x, y + 2.6, size, {}, o);
      return (
        rect(-4, -4, 72, 50, INKS.bone) +
        grid +
        arrow(cell(1, 2), cell(3, 2), -3, s.key) +
        arrow(cell(2, 4), cell(5, 3), 3, s.key) +
        arrow(cell(3, 1), cell(5, 1), 0, s.key) +
        stroke(`M${n(cell(7, 1)[0] - 4)},${n(cell(7, 1)[1] - 1)} L${n(cell(5, 1)[0] + 2)},${n(cell(5, 1)[1] + 1)}`, INKS.oxide, 0.4) +
        stroke(`M${n(cell(7, 3)[0] - 4)},${n(cell(7, 3)[1] - 1)} L${n(cell(5, 3)[0] + 2)},${n(cell(5, 3)[1])}`, INKS.oxide, 0.4) +
        dot(cell(3, 2), s.key) +
        dot(cell(5, 3), s.key) +
        dot(cell(5, 1), s.key) +
        at('breacher', cell(1, 2), 0.032) +
        at('sniper', cell(2, 4), 0.03) +
        at('tactician', cell(3, 1), 0.03) +
        at('behemoth', cell(7, 1), 0.03, { ink: mono(INKS.oxide) }) +
        at('chameleon', cell(7, 3), 0.03, { ink: mono(INKS.oxide) }) +
        label('PLAN B', 8, 6, 1.6, s.key, 'start')
      );
    },
  },
  'r-pioneering': {
    world: 'mars',
    caption: 'a survey flag with the research flask on it flying over a refinery',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 12, y: 8, r: 8 } }) +
      print(s, 'refinery', 42, 33, { size: 0.16 }) +
      print(s, 'tanks', 18, 33, { size: 0.12 }) +
      flag(s, 26, 42, 28, s.plate) +
      icon('research', 30.6, 19, 6.5, s.key, 2.6) +
      person(20, 42, 0.22, { facing: 1, arms: [120, 20], elbows: [-10, 10] }, s.key, s.paper),
  },
  'r-plundering': {
    world: 'deimos',
    caption: 'a salvage drone hovering over a wreck, scanning it in amber lines',
    draw: (s) => {
      const drone = `<g transform="translate(38,10)"><ellipse cx="0" cy="0" rx="4.4" ry="2" fill="${s.key}"/><path d="M-4,-1 L-9,-3 M4,-1 L9,-3" stroke="${s.key}" stroke-width="0.6"/><ellipse cx="-9" cy="-3.4" rx="3.6" ry="0.6" fill="${s.key}"/><ellipse cx="9" cy="-3.4" rx="3.6" ry="0.6" fill="${s.key}"/><circle cx="0" cy="1.6" r="1" fill="${INKS.amber}"/></g>`;
      return (
        outdoors(s, 32, { planet: { x: 12, y: 9, r: 8 } }) +
        `<path d="M38,11.6 L22,35 L52,35 Z" fill="${INKS.amber}" opacity="0.25"/>` +
        [24, 30, 36, 42, 48].map((x) => stroke(`M38,11.6 L${x},35`, INKS.amber, 0.25)).join('') +
        wreck(s, 'sniper', 36, 37, 0.06, 80) +
        smoke(s, 44, 34, 10, GROUND.deimos.shade) +
        drone
      );
    },
  },
  'r-precocious': {
    world: 'phobos',
    caption: 'two surveyors running back to camp with a sample case',
    draw: (s) =>
      outdoors(s, 31, { planet: { x: 14, y: 9, r: 8 } }) +
      print(s, 'habitat', 52, 31, { size: 0.12 }) +
      print(s, 'beacon', 6, 40, { size: 0.12 }) +
      person(22, 41, 0.27, { facing: 1, arms: [60, -50], elbows: [-60, 40], legs: [40, -40], knees: [-50, 30], lean: 18 }, s.key, s.paper) +
      person(34, 40, 0.27, { facing: 1, arms: [-20, -60], elbows: [30, 40], legs: [36, -36], knees: [-40, 30], lean: 18 }, s.key, s.paper) +
      `<g transform="rotate(4 28 31)">${rect(25, 30, 7, 4, INKS.amber)}${rect(27.4, 29.2, 2.2, 1, s.key)}</g>`,
  },
  'r-prideful': {
    world: 'deimos',
    caption: 'a victorious Chameleon holding up a flag over a downed mech',
    draw: (s) =>
      outdoors(s, 34, { planet: { x: 52, y: 9, r: 9 } }) +
      smoke(s, 17, 36, 22, GROUND.deimos.shade) +
      wreck(s, 'tactician', 24, 40, 0.07, -82, false) +
      mech(s, 'chameleon', 40, 41, 0.1, { yaw: -20, arms: { plus: [-100, -40] } }) +
      flag(s, 57.6, 17, 12.5, INKS.ice, '', -1),
  },
  'r-profiteering': {
    world: 'mars',
    caption: 'a strike beacon on its tripod, the atomic it bought landing on the horizon',
    draw: (s) =>
      outdoors(s, 26, { planet: false }) +
      // the strike: a beam from orbit, its flash and smoke on the horizon
      rect(46, -4, 3, 30, INKS.amber) +
      rect(47, -4, 1, 30, INKS.bone) +
      smoke(s, 47.5, 26, 10, GROUND.mars.shade) +
      flash(47.5, 25, 5, 12) +
      // the beacon on its tripod, calling it down
      stroke('M20,40 L23,28 M26,40 L23,28 M23,40 L23,28', s.key, 0.7) +
      rect(20.6, 22, 4.8, 7, s.key) +
      rect(21.4, 23.2, 3.2, 1.6, INKS.oxide) +
      stroke('M23,22 L23,12', s.key, 0.5) +
      `<circle cx="23" cy="11.4" r="1.4" fill="${INKS.amber}"/>` +
      rings(23, 11.4, 2.6, 2.4, 4, INKS.amber, 0.45, 290, 360),
  },
  'r-rational': {
    world: 'phobos',
    caption: 'three Snipers lined up in step on a marked drill ground',
    draw: (s) =>
      outdoors(s, 24, { planet: { x: 54, y: 8, r: 6 } }) +
      // the drill ground: painted lines running back to the horizon
      stroke('M-4,33 L68,33 M-4,39.5 L68,39.5', INKS.bone, 0.5) +
      stroke('M4,44 L17,25 M28,44 L28,25 M52,44 L39,25', INKS.bone, 0.35, ' stroke-dasharray="1.2 0.8"') +
      [10, 28, 46].map((x) => mech(s, 'sniper', x, 38, 0.07, { yaw: -25 })).join('') +
      flag(s, 62, 31, 12, INKS.oxide, '3', -1),
  },
  'r-ravenous': {
    world: 'mars',
    caption: "kill marks stencilled on a mech's hull, a painter adding one more",
    draw: (s) => {
      // the marks on the hull, laid out for the mech at (30, 90) and 0.4, then moved with it
      const [x, y, size] = [24, 66, 0.26];
      let marks = '';
      for (let i = 0; i < 9; i++) marks += rect(16 + (i % 5) * 3 + (i >= 5 ? 1.5 : 0), 14 + Math.floor(i / 5) * 7, 1.2, 5, INKS.bone);
      const hull =
        stroke('M14,21 L32,14', INKS.bone, 0.9) +
        marks +
        rect(31, 21, 1.2, 5, INKS.oxide) +
        `<circle cx="34" cy="23" r="2.4" fill="${INKS.oxide}" opacity="0.4"/>`;
      return (
        outdoors(s, 40, { planet: false }) +
        mech(s, 'chameleon', x, y, size, { yaw: -20 }) +
        `<g transform="translate(${x},${y}) scale(${n(size / 0.4)}) translate(-30,-90)">${hull}</g>` +
        stroke('M44,42 L50,4 M54,42 L56,4 M45,34 L54,34 M46,26 L55,26 M47,18 L55,18', s.key, 0.8) +
        person(50, 26, 0.18, { facing: -1, arms: [100, 20], elbows: [-10, 10] }, s.key, s.paper)
      );
    },
  },
  'r-resourceful': {
    world: 'phobos',
    caption: 'a stripped mech kneeling, one arm off, a crew member carrying its glowing core away',
    draw: (s) =>
      outdoors(s, 34, { planet: { x: 12, y: 8, r: 8 } }) +
      mech(
        s,
        'chameleon',
        22,
        41,
        0.12,
        { lean: 18, legs: { plus: [-60, 110], minus: [60, -110] }, arms: { minus: [10, 0] }, detach: { arm: 'plus', show: 'mech' } },
        { ink: sideInk(s), plate: false },
      ) +
      person(44, 41, 0.26, { facing: 1, arms: [40, 30], elbows: [60, 70], legs: [26, -26], lean: -6 }, s.key, s.paper) +
      `<circle cx="50" cy="30" r="5" fill="${INKS.amber}" opacity="0.3"/>` +
      `<rect x="47.4" y="27.4" width="5.2" height="5.2" rx="0.8" fill="${s.key}"/><rect x="48.4" y="28.4" width="3.2" height="3.2" fill="${INKS.amber}"/>`,
  },
  'r-righteous': {
    world: 'mars',
    caption: 'a wall stencilled NO RETREAT, its flag on the roof, a Breacher standing in front of it',
    draw: (s) =>
      outdoors(s, 34, { planet: false }) +
      print({ ...s, key: '#4A4440' }, 'wall', 30, 34, { size: 0.36 }) +
      stencil('NO RETREAT', 21, 25, 4.8, INKS.bone) +
      mech(s, 'breacher', 51, 41, 0.085) +
      flag(s, 6, 14.4, 11, INKS.oxide),
  },

  'r-ruthless': {
    world: 'deimos',
    caption: "a jammer pod on a Tactician's shoulder, static rings going out",
    draw: (s) =>
      outdoors(s, 38, { planet: false }) +
      rings(22.5, 10, 4, 4.4, 8, INKS.oxide, 0.7) +
      mech(s, 'tactician', 28, 50, 0.16, { yaw: 22, arms: { plus: [-10, 0] } }) +
      `<g transform="translate(28,50) scale(0.16)"><rect x="-56" y="-262" width="44" height="26" fill="${s.key}" stroke="${s.ink.seam}" stroke-width="1.4"/><rect x="-50" y="-256" width="32" height="6" fill="${INKS.oxide}"/></g>`,
  },
  'r-steadfast': {
    world: 'mars',
    caption: 'a column of mechs trudging through a dust storm, heads down',
    draw: (s) => {
      const walk = (i: number) => ({ yaw: -30, lean: 10, legs: { plus: [i % 2 ? -14 : 14, 12], minus: [i % 2 ? 14 : -14, 6] } });
      return (
        outdoors(s, 30, { planet: false }) +
        mech(s, 'behemoth', 8, 30, 0.035, walk(0), { ink: sideInk(s), plate: false }) +
        mech(s, 'chameleon', 20, 32, 0.05, walk(1), { ink: sideInk(s) }) +
        mech(s, 'tactician', 34, 35, 0.07, walk(2)) +
        mech(s, 'chameleon', 52, 40, 0.1, walk(3)) +
        storm(s, 2, 40, 0.7)
      );
    },
  },
  'r-stealthy': {
    world: 'deimos',
    caption: 'a lone mech coming down on its boosters into a dust storm',
    draw: (s) => outdoors(s, 36, { planet: { x: 12, y: 9, r: 8 } }) + dropping(s, 'sniper', 38, 25, 0.068, -20) + storm(s, 14, 40, 0.85),
  },
  'r-strategic': {
    world: 'phobos',
    caption: 'three mechs back to back, guns out three ways',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 32, y: 8, r: 7 } }) +
      mech(s, 'sniper', 15, 39, 0.1, { aim: -48 }, { flip: true }) +
      mech(s, 'breacher', 48, 39, 0.1, { yaw: 30, arms: { plus: [-80, -10] } }) +
      mech(s, 'chameleon', 31, 41, 0.11, { yaw: 15 }),
  },
  'r-stubborn': {
    world: 'mars',
    caption: 'a Breacher dug into a trench behind a barricade of boulders',
    draw: (s) =>
      outdoors(s, 28, { planet: false }) +
      mech(s, 'breacher', 30, 44, 0.12) +
      rect(-4, 34, 72, 12, GROUND.mars.shade) +
      rect(-4, 34, 72, 2, ht(s, 'key')) +
      print(s, 'rocks', 30, 38, { size: 0.26 }) +
      print(s, 'barricade', 4, 38, { size: 0.12 }) +
      print(s, 'barricade', 60, 38, { size: 0.12, flip: true }),
  },
  'r-tactical': {
    world: 'deimos',
    caption: 'a Breacher lunging forward one hex, its fist level',
    draw: (s) =>
      outdoors(s, 30, { planet: { x: 12, y: 9, r: 8 } }) +
      hexOnGround(22, 38, 9, 0.32, s.key, 0.5, '1.2 0.8') +
      hexOnGround(44, 38, 9, 0.32, INKS.oxide, 0.7) +
      stroke('M26,36 L40,36', INKS.oxide, 0.6) +
      path('M40,34.8 L43,36 L40,37.2 Z', INKS.oxide) +
      mech(s, 'breacher', 36, 39, 0.11, {
        yaw: 40,
        lean: 16,
        legs: { plus: [-30, 30], minus: [30, 0] },
        arms: { plus: [-90, 0], minus: [30, 10] },
      }),
  },
  'r-talented': {
    world: 'phobos',
    caption: 'a crew photo: five people, each printed in a different ink',
    draw: (s) => {
      const inks = [INKS.oxide, INKS.ice, INKS.amber, INKS.green, INKS.violet];
      return (
        outdoors(s, 30, { planet: { x: 52, y: 8, r: 8 } }) +
        mech(s, 'behemoth', 32, 42, 0.12, {}, { ink: { ...sideInk(s), seam: s.ink.joint } }) +
        [8, 20, 32, 44, 56]
          .map((x, i) => person(x, i === 2 ? 42 : 41, 0.3, { facing: i < 2 ? 1 : i > 2 ? -1 : 1, arms: [8, -8] }, inks[i], s.paper))
          .join('')
      );
    },
  },
  'r-tyrannical': {
    world: 'mars',
    caption: 'a loudspeaker on a mast over a habitat, its sound going out in rings',
    draw: (s) =>
      outdoors(s, 34, { planet: false }) +
      print(s, 'habitat', 34, 35, { size: 0.2 }) +
      print(s, 'mast', 52, 37, { size: 0.24 }) +
      path('M51,9 L45,6 L45,12 Z', s.key) +
      rect(51, 8.2, 2, 1.6, s.key) +
      rings(45, 9, 3, 3, 6, INKS.oxide, 0.8, 140, 220),
  },
  // ---------------------------------------------------------------------------------------------- Tactics
  'r-aggression': {
    world: 'mars',
    caption: 'a two-ink recruitment poster: raised fists and a Chameleon standing on the red ground',
    draw: (s) => {
      const fist = (x: number, h: number, t: number) =>
        `<g transform="rotate(${t} ${x} 44)"><rect x="${x - 2.6}" y="${44 - h}" width="5.2" height="${h}" fill="${INKS.oxide}"/><rect x="${x - 3.6}" y="${44 - h - 5}" width="7.2" height="6" rx="1.6" fill="${INKS.oxide}"/></g>`;
      return (
        paperGround(s) +
        rays(32, 18, 28, INKS.oxide, 180, 360) +
        `<circle cx="32" cy="18" r="8" fill="${s.paper}"/>` +
        mech(s, 'chameleon', 32, 42, 0.12, { arms: { plus: [-140, 0] } }, { plate: INKS.oxide }) +
        [6, 14, 50, 58].map((x, i) => fist(x, 12 + (i % 2) * 6, (i < 2 ? -1 : 1) * 6)).join('')
      );
    },
  },
  'r-black-market': {
    world: 'mars',
    caption: 'two atomic rockets in an open crate, warning stencils on them',
    draw: (s) => {
      // An atomic: bone body, oxide nose and fins, an amber trefoil on a key band. Its foot (x, y) is in the crate.
      const atomic = (x: number, y: number, h: number) => {
        const top = y - h;
        const t = top + h * 0.38;
        const blade = (a: number) => {
          const p = (r: number, d: number) =>
            `${n(x + r * Math.cos(((a + d) * Math.PI) / 180))},${n(t + r * Math.sin(((a + d) * Math.PI) / 180))}`;
          return path(
            `M${p(0.45, -30)} L${p(1.5, -30)} A1.5,1.5 0 0 1 ${p(1.5, 30)} L${p(0.45, 30)} A0.45,0.45 0 0 0 ${p(0.45, -30)} Z`,
            INKS.key,
          );
        };
        return (
          path(`M${n(x - 2.4)},${n(y - 7)} L${n(x - 5)},${n(y - 1)} L${n(x - 2.4)},${n(y - 2)} Z`, INKS.oxide) +
          path(`M${n(x + 2.4)},${n(y - 7)} L${n(x + 5)},${n(y - 1)} L${n(x + 2.4)},${n(y - 2)} Z`, INKS.oxide) +
          rect(x - 2.4, top, 4.8, h, INKS.bone) +
          rect(x + 1.2, top, 1.2, h, s.ink.seam) +
          path(
            `M${n(x - 2.4)},${n(top)} Q${n(x - 2.4)},${n(top - 4)} ${n(x)},${n(top - 7.5)} Q${n(x + 2.4)},${n(top - 4)} ${n(x + 2.4)},${n(top)} Z`,
            INKS.oxide,
          ) +
          rect(x - 2.4, t - 2.2, 4.8, 4.4, INKS.amber) +
          blade(-90) +
          blade(30) +
          blade(150) +
          `<circle cx="${n(x)}" cy="${n(t)}" r="0.3" fill="${INKS.key}"/>`
        );
      };
      return (
        outdoors(s, 30, { planet: false }) +
        `<circle cx="31" cy="22" r="17" fill="${INKS.amber}" opacity="0.16"/>` +
        atomic(25, 34, 18) +
        atomic(37, 34, 18) +
        // the crate: its front, slats and a hazard band; the lid against its side
        `<g transform="rotate(14 50 39)">${rect(47, 22, 4, 17, INKS.key)}${rect(47, 22, 4, 1, ON_PAPER.recess)}</g>` +
        rect(17, 30, 28, 10, INKS.key) +
        rect(17, 30, 28, 1.2, ON_PAPER.recess) +
        [24, 31, 38].map((x) => rect(x, 31.2, 0.5, 8.8, ON_PAPER.recess)).join('') +
        `<clipPath id="${s.id}-band"><rect x="17" y="35" width="28" height="2.4"/></clipPath>` +
        `<g clip-path="url(#${s.id}-band)">${rect(17, 35, 28, 2.4, INKS.amber)}${[...Array(10)].map((_, i) => path(`M${17 + i * 3},37.4 l1.4,0 l2.4,-2.4 l-1.4,0 Z`, INKS.key)).join('')}</g>`
      );
    },
  },
  'r-change-of-heart': {
    world: 'phobos',
    caption: "a Sniper walking away from one side's flag to another's, where a Tactician waits for it",
    draw: (s) =>
      outdoors(s, 30, { planet: { x: 30, y: 9, r: 8 } }) +
      flag(s, 6, 38, 24, INKS.ice) +
      [10, 14, 18, 22]
        .map((x, i) => `<ellipse cx="${x}" cy="${39 + (i % 2) * 1.2}" rx="1.2" ry="0.5" fill="${GROUND.phobos.shade}"/>`)
        .join('') +
      mech(s, 'sniper', 30, 41, 0.085, { yaw: 20, legs: { plus: [-18, 14], minus: [18, 4] } }, { plate: INKS.ice }) +
      mech(s, 'tactician', 52, 36, 0.06, { yaw: -24 }, { plate: INKS.oxide }) +
      flag(s, 60, 36, 22, INKS.oxide, '', -1),
  },
  'r-momentum': {
    world: 'deimos',
    caption: 'mechs advancing at dawn, long shadows ahead of them',
    draw: (s) => {
      const walk = (i: number) => ({ yaw: 30, legs: { plus: [i % 2 ? -18 : 18, 10], minus: [i % 2 ? 18 : -18, 6] } });
      const shadow = (x: number, y: number, len: number) =>
        `<path d="M${n(x - 1)},${n(y)} L${n(x + len)},${n(y + 1)} L${n(x + len)},${n(y + 2.4)} L${n(x + 1)},${n(y + 0.5)} Z" fill="${s.key}" opacity="0.5"/>`;
      return (
        paperGround(s) +
        sky(s, { planet: false }) +
        `<circle cx="4" cy="30" r="9" fill="${INKS.amber}"/>` +
        rings(4, 30, 11, 3, 3, INKS.amber, 0.5) +
        land(s, 30) +
        shadow(18, 34, 40) +
        shadow(34, 38, 32) +
        mech(s, 'chameleon', 18, 34, 0.08, walk(0)) +
        mech(s, 'sniper', 34, 38, 0.1, walk(1)) +
        mech(s, 'tactician', 52, 31, 0.05, walk(2))
      );
    },
  },
  'r-plan-ahead': {
    world: 'deimos',
    caption: 'a huge Behemoth caught in a marked kill zone, crossfire coming in from both sides',
    draw: (s) =>
      outdoors(s, 22, { planet: { x: 52, y: 8, r: 7 } }) +
      // the kill zone: three hexes painted on the ground, hatched in the plate
      hexOnGround(26, 31, 6, 0.42, INKS.amber, 0.7) +
      hexOnGround(38, 31, 6, 0.42, INKS.amber, 0.7) +
      hexOnGround(32, 35.4, 6, 0.42, INKS.amber, 0.7) +
      `<ellipse cx="32" cy="34" rx="14" ry="4.5" fill="${ht(s, 'plate')}"/>` +
      mech(s, 'behemoth', 32, 43.5, 0.13, {}, { plate: INKS.oxide }) +
      // crossfire tracers converging from both sides
      stroke('M-4,18 L26,22.5 M-4,30 L29.5,28', INKS.amber, 0.6) +
      stroke('M68,17 L38,22 M68,29 L34.5,28', INKS.amber, 0.6) +
      // explosions on the mech and the center
      `<circle cx="32" cy="22.5" r="8" fill="${INKS.oxide}" opacity="0.55"/>` +
      `<circle cx="32" cy="22.5" r="5" fill="${INKS.amber}" opacity="0.65"/>` +
      `<ellipse cx="32" cy="30" rx="6.5" ry="2.4" fill="${INKS.oxide}" opacity="0.5"/>` +
      flash(32, 22, 7.5, 12, 10) +
      flash(26, 23.5, 4.5, 9, 24) +
      flash(38, 23, 4.6, 9, 36) +
      flash(32, 29.5, 4.2, 8, 15) +
      sparks(s.r, 32, 22.5, 28, 16) +
      sparks(s.r, 32, 29.5, 14, 10),
  },
  'r-sabotage': {
    world: 'deimos',
    caption: 'a hand pouring regolith into an open gearbox',
    draw: (s) => {
      const gear = (x: number, y: number, r: number, teeth: number, ink: string) => {
        let d = '';
        for (let i = 0; i < teeth; i++) {
          const a = (i / teeth) * Math.PI * 2;
          d += `<rect x="${n(x - 1)}" y="${n(y - r - 1.6)}" width="2" height="2.4" fill="${ink}" transform="rotate(${n((a * 180) / Math.PI)} ${n(x)} ${n(y)})"/>`;
        }
        return d + `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${x}" cy="${y}" r="${n(r * 0.3)}" fill="${s.paper}"/>`;
      };
      let grit = '';
      for (let i = 0; i < 80; i++)
        grit += `<circle cx="${n(36 + s.r.range(-1.4, 1.4) + i * 0.02)}" cy="${n(10 + i * 0.36)}" r="${n(s.r.range(0.2, 0.5))}" fill="${INKS.dust}"/>`;
      return (
        paperGround(s) +
        rect(6, 22, 52, 20, '#2c2a27') +
        rect(4, 20, 56, 3, s.key) +
        gear(22, 32, 7, 12, s.key) +
        gear(36, 30, 5, 9, s.ink.joint) +
        gear(48, 34, 6, 10, s.key) +
        grit +
        // the sand piled up in the bottom of the box
        path('M10,42 Q16,37 24,37.6 Q32,34.6 38,35.4 Q46,35.6 52,38.4 Q56,40 58,42 Z', INKS.dust) +
        glove(39, 9, 8, 160, INKS.bone) +
        stroke('M40,4 L52,-4', INKS.bone, 4.4)
      );
    },
  },
  'r-show-of-force': {
    world: 'mars',
    caption: 'an enemy mech hit from above by an amber column of light',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 12, y: 9, r: 9 } }) +
      rect(36, -4, 8, 38, INKS.amber, ' opacity="0.35"') +
      rect(38.4, -4, 3.2, 38, INKS.amber) +
      rect(39.4, -4, 1.2, 38, INKS.bone) +
      mech(s, 'chameleon', 40, 37, 0.1, { yaw: -24, lean: 12 }, { plate: INKS.oxide }) +
      flash(40, 22, 6, 12),
  },
  'r-unveil-the-fleet': {
    world: 'deimos',
    caption: 'mechs coming down on their boosters all over the map',
    draw: (s) =>
      outdoors(s, 34, { planet: { x: 52, y: 26, r: 8 } }) +
      dropping(s, 'wisp', 9, 12, 0.035) +
      dropping(s, 'sniper', 24, 6, 0.03) +
      dropping(s, 'chameleon', 52, 8, 0.035) +
      dropping(s, 'breacher', 40, 18, 0.05) +
      dropping(s, 'tactician', 20, 26, 0.06) +
      mech(s, 'behemoth', 54, 39, 0.05) +
      rings(20, 38, 3, 3, 3, s.key, 0.35, 180, 360),
  },
  'r-warp-gate': {
    world: 'phobos',
    caption: 'a cut-away of the ground: an ice tunnel joining two hexes underneath',
    draw: (s) => {
      const g = GROUND.phobos;
      return (
        paperGround(s) +
        sky(s, { planet: { x: 32, y: 4, r: 7 } }) +
        land(s, 14, { marks: false }) +
        [20, 26, 32].map((y) => stroke(`M-4,${y} q16,-2 34,0 t36,0`, g.shade, 0.4)).join('') +
        `<path d="M8,15 C8,40 56,40 56,15 L50,15 C50,32 14,32 14,15 Z" fill="${INKS.ice}"/>` +
        `<path d="M11,15 C11,36 53,36 53,15" fill="none" stroke="${s.key}" stroke-width="0.5" stroke-dasharray="1 0.8"/>` +
        hexOnGround(11, 14.6, 6, 0.3, s.key, 0.7) +
        hexOnGround(53, 14.6, 6, 0.3, s.key, 0.7) +
        `<ellipse cx="11" cy="14.6" rx="3" ry="0.9" fill="${s.key}"/><ellipse cx="53" cy="14.6" rx="3" ry="0.9" fill="${s.key}"/>` +
        mech(s, 'wisp', 32, 31.8, 0.032, { yaw: 30 }) +
        mech(s, 'chameleon', 52, 14, 0.035, { yaw: -30 })
      );
    },
  },
  'r-expansion': {
    world: 'mars',
    caption: "a new Chameleon walking out of a workshop's doors",
    draw: (s) =>
      outdoors(s, 34, { planet: { x: 10, y: 8, r: 8 } }) +
      print({ ...s, key: '#4A4440' }, 'workshop', 32, 36, { size: 0.3 }) +
      rect(22, 20.4, 20, 15.6, INKS.amber, ' opacity="0.4"') +
      rays(32, 28, 16, INKS.amber, 30, 150) +
      mech(s, 'chameleon', 33, 40, 0.1, { legs: { plus: [-20, 20], minus: [16, 6] } }),
  },
};
