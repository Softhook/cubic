import { n } from '../svg';
import type { World } from '../tile/look';
import { INKS } from './inks';
import {
  GROUND,
  flash,
  ht,
  label,
  land,
  mech,
  paperGround,
  person,
  print,
  rays,
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

const r2 = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`;
const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const stroke = (d: string, ink: string, w: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
/** A shape printed with its plate a little off register under it. */
const plated = (s: Stage, body: (ink: string) => string, plate = s.plate) =>
  `<g transform="translate(0.55,-0.35)">${body(plate)}</g>` + body(s.key);

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

/** Hatching lines of heat rising from a span: wavy strokes in `ink`. */
const heat = (x: number, y: number, w: number, h: number, ink: string, count = 5) =>
  Array.from({ length: count }, (_, i) => {
    const xx = x + (i / (count - 1)) * w;
    return stroke(`M${n(xx)},${n(y)} q1.2,${n(-h / 4)} 0,${n(-h / 2)} t0,${n(-h / 2)}`, ink, 0.45, ' opacity="0.85"');
  }).join('');

export const SCENES: Record<string, SpScene> = {
  // ---------------------------------------------------------------------------------------------- Skills
  'r-agile': {
    world: 'deimos',
    caption: "a mechanic on a step ladder, a wrench on a Wisp's knee joint, sparks flying",
    draw: (s) =>
      paperGround(s) +
      rays(s, 36, 16, 26, s.plate) +
      land(s, 36, { rims: false }) +
      mech(s, 'wisp', 24, 39, 0.19) +
      // the step ladder, the mechanic on it, the wrench on the knee
      stroke('M44,39 L48,22 M52,39 L48,22 M45.2,34 L50.8,34 M46.4,29 L49.6,29', s.key, 0.7) +
      `<g transform="rotate(16 37 15.6)">${r2(37, 14.4, 9, 2.4, s.key)}<circle cx="37" cy="15.6" r="2.6" fill="none" stroke="${s.key}" stroke-width="1.4"/></g>` +
      person(48, 29, 0.2, { facing: -1, arms: [124, 112], elbows: [-10, -6], lean: -6, legs: [6, -6] }, s.key, s.paper) +
      sparks(s.r, 37, 15.6, 16, 8) +
      flash(37, 15.6, 2, 8),
  },

  'r-ambitious': {
    world: 'mars',
    caption: 'a Breacher pushed past its limit, its motor glowing',
    draw: (s) =>
      paperGround(s) +
      rays(s, 30, 14, 30, s.plate, 180, 360) +
      land(s, 34) +
      heat(16, 8, 26, 10, INKS.oxide, 6) +
      mech(s, 'breacher', 30, 36, 0.12, {
        yaw: -32,
        lean: 10,
        legs: { plus: [-20, 26], minus: [18, 8] },
        arms: { plus: [-30, -20], minus: [26, 10] },
      }) +
      flash(25, 11.5, 2.4, 7) +
      sparks(s.r, 25, 12, 14, 8, 180, 330),
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
        r2(-3, 17.5, 70, 28, ht(s, 'shade'), ' opacity="0.6"') +
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
      rays(s, 32, 20, 32, s.plate) +
      land(s, 36, { rims: false }) +
      mech(s, 'breacher', 32, 40, 0.13, { arms: { plus: [-16, -10], minus: [16, 10] } }) +
      flash(14, 31.5, 4.2, 10) +
      flash(51, 32, 4.2, 10, 12) +
      sparks(s.r, 14, 31.5, 12, 10) +
      sparks(s.r, 51, 32, 12, 10),
  },
  'r-calculating': {
    world: 'phobos',
    caption: 'a foreman in the salvage yard pointing the crane at one chassis',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 14, y: 9, r: 7 } }) +
      print(s, 'rocks', 22, 36, { size: 0.16, plate: GROUND.phobos.shade }) +
      `<g transform="rotate(-78 44 34)">${mech(s, 'tactician', 44, 34, 0.08, {}, { ink: { ...s.ink, key: s.ink.side } })}</g>` +
      print(s, 'crane', 54, 34, { size: 0.16, flip: true }) +
      stroke('M41.2,14.8 L41.2,22', s.key, 0.4) +
      stroke('M40,22 q1.2,2 2.4,0', s.key, 0.6) +
      mech(s, 'chameleon', 41, 32, 0.045, {}, { plate: INKS.oxide }) +
      person(10, 41, 0.3, { facing: 1, arms: [128, -10], elbows: [0, 70] }, s.key, s.paper) +
      r2(9.4, 27.4, 3.4, 4.4, INKS.bone, ` stroke="${s.key}" stroke-width="0.3"`),
  },
  'r-clever': {
    world: 'mars',
    caption: 'a Chameleon in a gantry, one arm off and hanging from the hoist beside its open shoulder',
    draw: (s) =>
      outdoors(s, 36, { planet: { x: 54, y: 8, r: 8 } }) +
      print(s, 'gantry', 32, 38, { size: 0.24 }) +
      mech(s, 'chameleon', 28, 38, 0.115, { detach: { arm: 'plus', show: 'mech' } }) +
      stroke('M42.4,5.6 L42.4,13.4', s.key, 0.35, ' stroke-dasharray="0.6 0.4"') +
      mech(s, 'chameleon', 33.5, 39, 0.115, { detach: { arm: 'plus', show: 'arm' } }) +
      sparks(s.r, 35.2, 13.4, 10, 5),
  },
  'r-composed': {
    world: 'phobos',
    caption: 'a Chameleon powered down in a low crouch, venting heat',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 50, y: 9, r: 7 } }) +
      smoke(s, 30, 14, 10, GROUND.phobos.light) +
      mech(s, 'chameleon', 30, 40, 0.13, { legs: { plus: [-34, 62], minus: [34, -62] }, arms: { plus: [4, 0], minus: [-4, 0] } }),
  },
  'r-cunning': {
    world: 'deimos',
    caption: 'a hand flipping a guarded red switch on a cockpit panel',
    draw: (s) => {
      const gauge = (x: number, y: number, r: number, a: number) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${INKS.bone}" stroke="${s.key}" stroke-width="0.8"/>` +
        stroke(`M${x},${y} l${n(Math.cos(a) * r * 0.8)},${n(Math.sin(a) * r * 0.8)}`, INKS.oxide, 0.5) +
        stroke(`M${x - r * 0.7},${y + r * 0.2} A${r * 0.75},${r * 0.75} 0 0,1 ${x + r * 0.7},${y + r * 0.2}`, s.key, 0.25);
      return (
        paperGround(s) +
        r2(-4, -4, 72, 50, s.key) +
        r2(-4, -4, 72, 50, ht(s, 'plate'), ' opacity="0.35"') +
        [4, 60].flatMap((x) => [6, 22, 38].map((y) => `<circle cx="${x}" cy="${y}" r="0.7" fill="${s.ink.seam}"/>`)).join('') +
        gauge(12, 13, 5.5, -0.4) +
        gauge(12, 29, 4, -2.4) +
        r2(23, 9, 22, 26, s.ink.recess) +
        stencil('OVERRIDE', 34, 13.6, 3, INKS.amber) +
        `<g transform="translate(34,25)">${r2(-6, -6, 12, 12, INKS.amber)}${r2(-5, -5, 10, 10, ht(s, 'key'))}${r2(-2, -3, 4, 6, s.ink.recess)}${stroke('M0,0 L5,-9', INKS.oxide, 2.4)}<circle cx="5" cy="-9" r="1.8" fill="${INKS.oxide}"/>` +
        `<path d="M-7,-7 L-1,-14 L11,-14 L7,-7 Z" fill="none" stroke="${INKS.amber}" stroke-width="0.8"/></g>` +
        glove(44, -2, 12, 200, INKS.bone) +
        stroke('M45,-3 L58,-14', INKS.bone, 7) +
        label('CH 2', 54, 33, 1.6, INKS.amber) +
        r2(49, 10, 10, 4, INKS.oxide)
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
      r2(25.3, 14, 1.4, 24, s.key) +
      r2(22.6, 18, 6.8, 4.4, s.plate, ` stroke="${s.key}" stroke-width="0.5"`) +
      `<circle cx="26" cy="13.6" r="1.4" fill="${INKS.amber}"/>` +
      r2(9, 34.6, 8, 1.6, INKS.ice, ` stroke="${s.key}" stroke-width="0.35"`) +
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
      return (
        paperGround(s) +
        rays(s, 32, 22, 34, s.plate) +
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
      outdoors(s, 38, { planet: { x: 54, y: 9, r: 9 } }) +
      mech(s, 'behemoth', 30, 40, 0.11, { yaw: 12 }, { plate: INKS.oxide }) +
      mech(s, 'wisp', 30, 40, 0.075, { yaw: -40, legs: { plus: [20, -20], minus: [-20, 20] } }, { plate: INKS.ice }) +
      stroke('M14,36 l8,0 M12,38 l9,0', s.key, 0.4, ' opacity="0.6"'),
  },
  'r-ferocious': {
    world: 'mars',
    caption: 'a Chameleon firing its long gun level, the barrel red hot, a round leaving it',
    draw: (s) =>
      paperGround(s) +
      rays(s, 50, 18, 26, s.plate, 120, 240) +
      land(s, 34) +
      mech(s, 'chameleon', 18, 38, 0.12, { yaw: 18, arms: { plus: [-10, -80] } }) +
      heat(31, 15, 12, 9, INKS.oxide, 5) +
      r2(30, 18.2, 14, 2.6, ht(s, 'plate')) +
      flash(48, 19.4, 4, 11) +
      stroke('M52,19.4 L66,19.4', INKS.amber, 0.7, ' stroke-dasharray="3 1.4"'),
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
        plated(s, (ink) => r2(48, 36.4, 12, 3.6, ink) + r2(51, 32, 6, 4.6, ink)) +
        stroke('M54,32 L49,14', s.key, 3) +
        stroke('M56,31 L51.6,17', s.ink.rod, 0.6) +
        stroke('M49,14 L36,24', s.key, 2.4) +
        stroke('M47,17 L38.6,23', s.ink.rod, 0.5) +
        joint(54, 32, 2.4) +
        joint(49, 14, 2) +
        `<g transform="rotate(38 36 24)">${r2(32, 22.8, 5, 2.4, s.key)}${r2(30.4, 23.4, 1.8, 1.2, INKS.amber)}</g>` +
        flash(31, 26, 1.8, 8) +
        sparks(s.r, 31, 26, 14, 7, 60, 200)
      );
    },
  },

  'r-hostile': {
    world: 'mars',
    caption: 'a Chameleon stepping over a smoking wreck, already turning to the next target',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 12, y: 8, r: 7 } }) +
      smoke(s, 20, 34, 30, GROUND.mars.shade) +
      `<g transform="rotate(84 22 37)">${mech(s, 'tactician', 22, 37, 0.07, {}, { ink: { ...s.ink, key: s.ink.side }, plate: false })}</g>` +
      mech(s, 'chameleon', 34, 40, 0.115, { yaw: 34, legs: { plus: [-26, 36], minus: [24, 6] }, arms: { plus: [-60, -24] }, lean: -4 }),
  },
  'r-industrious': {
    world: 'deimos',
    caption: 'two drop pods coming down side by side, retro rockets firing',
    draw: (s) => {
      const pod = (x: number, y: number, tilt: number) =>
        `<g transform="rotate(${tilt} ${x} ${y})">${print(s, 'pod', x, y, { size: 0.24 })}<path d="M${x - 3},${y + 0.6} L${x},${y + 9} L${x + 3},${y + 0.6} Z" fill="${INKS.amber}"/><path d="M${x - 1.4},${y + 0.6} L${x},${y + 5} L${x + 1.4},${y + 0.6} Z" fill="${INKS.bone}"/></g>`;
      return (
        outdoors(s, 37, { planet: { x: 50, y: 8, r: 8 } }) +
        stroke('M20,-4 L20,6 M42,-4 L42,4', s.key, 0.3, ' stroke-dasharray="1 1"') +
        pod(20, 22, -6) +
        pod(42, 18, 4) +
        rings(31, 38, 3, 3, 3, s.key, 0.35, 180, 360)
      );
    },
  },
  'r-intelligent': {
    world: 'mars',
    caption: "a hand terminal spliced into an objective's panel, its 8 flickering to 7 and 9",
    draw: (s) =>
      paperGround(s) +
      r2(6, 4, 40, 34, s.key) +
      r2(10, 8, 32, 20, s.ink.recess) +
      stencil('7', 18, 24, 15, INKS.oxide) +
      stencil('9', 34, 24, 15, INKS.ice) +
      stencil('8', 26.4, 24.6, 16, INKS.amber) +
      r2(10, 8, 32, 20, ht(s, 'key'), ' opacity="0.4"') +
      [12, 18, 24, 30].map((x) => r2(x, 31, 4, 3, s.ink.seam)).join('') +
      stroke('M44,30 C52,30 50,38 56,36', INKS.oxide, 1) +
      stroke('M44,33 C50,34 48,40 56,38', INKS.amber, 0.8) +
      `<g transform="rotate(-14 57 30)">${r2(52, 22, 11, 17, s.key)}${r2(53.5, 24, 8, 7, INKS.ice)}${label('ACCESS', 57.5, 28.2, 1.2, s.key)}${[33, 35.5].map((y) => r2(53.5, y, 8, 1.4, s.ink.seam)).join('')}</g>` +
      glove(60, 44, 9, -20, s.key),
  },
  'r-patient': {
    world: 'phobos',
    caption: 'a battered strongbox, its lid open a crack, orders inside',
    draw: (s) =>
      outdoors(s, 30, { planet: { x: 52, y: 9, r: 8 } }) +
      plated(s, (ink) => r2(14, 22, 36, 16, ink) + `<g transform="rotate(-9 14 22)">${r2(14, 16.6, 36, 5.4, ink)}</g>`) +
      `<path d="M15,21.6 L49,16.4 L49,21.6 Z" fill="${INKS.amber}"/>` +
      `<g transform="rotate(-6 30 20)">${r2(22, 18, 10, 4, INKS.bone)}${r2(33, 18.6, 10, 4, INKS.bone)}</g>` +
      r2(29, 25, 6, 5, INKS.amber) +
      `<circle cx="32" cy="27" r="1" fill="${s.key}"/>` +
      stroke('M16,26 l4,1.6 M44,33 l3,-2 M20,35 l3,0', s.ink.seam, 0.4),
  },
  'r-pioneering': {
    world: 'mars',
    caption: 'a survey flag with a stencilled research number flying over a refinery',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 12, y: 8, r: 8 } }) +
      print(s, 'refinery', 42, 33, { size: 0.16 }) +
      print(s, 'tanks', 18, 33, { size: 0.12 }) +
      flag(s, 26, 42, 28, s.plate, '4') +
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
        `<g transform="rotate(80 36 37)">${mech(s, 'sniper', 36, 37, 0.06, {}, { ink: { ...s.ink, key: s.ink.side } })}</g>` +
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
      `<g transform="rotate(4 28 31)">${r2(25, 30, 7, 4, INKS.amber)}${r2(27.4, 29.2, 2.2, 1, s.key)}</g>`,
  },
  'r-prideful': {
    world: 'deimos',
    caption: 'a victorious Chameleon holding up a flag over a downed mech',
    draw: (s) =>
      outdoors(s, 34, { planet: { x: 52, y: 9, r: 9 } }) +
      smoke(s, 17, 36, 22, GROUND.deimos.shade) +
      `<g transform="rotate(-82 24 40)">${mech(s, 'tactician', 24, 40, 0.07, {}, { ink: { ...s.ink, key: s.ink.side }, plate: false })}</g>` +
      mech(s, 'chameleon', 40, 41, 0.1, { yaw: -20, arms: { plus: [-100, -40] } }) +
      flag(s, 57.6, 17, 12.5, INKS.ice, '', -1),
  },
  'r-profiteering': {
    world: 'mars',
    caption: 'a strike beacon planted by a claim flag, the orbital strike it bought landing on the horizon',
    draw: (s) =>
      outdoors(s, 26, { planet: false }) +
      // the strike: a beam from orbit, its flash and smoke on the horizon
      r2(46, -4, 3, 30, INKS.amber) +
      r2(47, -4, 1, 30, INKS.bone) +
      smoke(s, 47.5, 26, 10, GROUND.mars.shade) +
      flash(47.5, 25, 5, 12) +
      // the beacon on its tripod, calling it down, beside the claim flag
      stroke('M20,40 L23,28 M26,40 L23,28 M23,40 L23,28', s.key, 0.7) +
      r2(20.6, 22, 4.8, 7, s.key) +
      r2(21.4, 23.2, 3.2, 1.6, INKS.oxide) +
      stroke('M23,22 L23,12', s.key, 0.5) +
      `<circle cx="23" cy="11.4" r="1.4" fill="${INKS.amber}"/>` +
      rings(23, 11.4, 2.6, 2.4, 4, INKS.amber, 0.45, 290, 360) +
      flag(s, 10, 41, 18, INKS.ice),
  },
  'r-rational': {
    world: 'phobos',
    caption: 'three Snipers lined up in step on a marked drill ground',
    draw: (s) =>
      outdoors(s, 24, { planet: { x: 54, y: 8, r: 6 } }) +
      // the drill ground: painted lines running back to the horizon
      stroke('M-4,33 L68,33 M-4,39.5 L68,39.5', INKS.bone, 0.5) +
      stroke('M4,44 L17,25 M28,44 L28,25 M52,44 L39,25', INKS.bone, 0.35, ' stroke-dasharray="1.2 0.8"') +
      [10, 28, 46].map((x) => mech(s, 'sniper', x, 38, 0.07)).join('') +
      flag(s, 62, 31, 12, INKS.oxide, '3', -1),
  },
  'r-ravenous': {
    world: 'mars',
    caption: "kill marks stencilled on a mech's hull, a painter adding one more",
    draw: (s) => {
      let marks = '';
      for (let i = 0; i < 9; i++) marks += r2(16 + (i % 5) * 3 + (i >= 5 ? 1.5 : 0), 14 + Math.floor(i / 5) * 7, 1.2, 5, INKS.bone);
      return (
        outdoors(s, 40) +
        mech(s, 'chameleon', 30, 90, 0.4, { yaw: -20 }) +
        stroke('M14,21 L32,14', INKS.bone, 0.9) +
        marks +
        r2(31, 21, 1.2, 5, INKS.oxide) +
        stroke('M50,42 L56,4 M60,42 L62,4 M51,34 L60,34 M52,26 L61,26 M53,18 L61,18', s.key, 0.8) +
        person(56, 26, 0.18, { facing: -1, arms: [100, 20], elbows: [-10, 10] }, s.key, s.paper) +
        `<circle cx="34" cy="23" r="2.4" fill="${INKS.oxide}" opacity="0.4"/>`
      );
    },
  },
  'r-resourceful': {
    world: 'phobos',
    caption: "a crane lifting a mech's reactor out of its chest",
    draw: (s) =>
      outdoors(s, 34, { planet: { x: 12, y: 8, r: 8 } }) +
      mech(s, 'chameleon', 22, 40, 0.1, {
        yaw: 30,
        legs: { plus: [-20, 90], minus: [-20, 90] },
        lean: 14,
        arms: { plus: [20, 10], minus: [10, 0] },
      }) +
      print(s, 'crane', 50, 38, { size: 0.15, flip: true }) +
      stroke('M37.6,20 L37.6,12', s.key, 0.35) +
      `<rect x="34.4" y="12" width="6.4" height="6" rx="1" fill="${s.key}"/><rect x="35.4" y="13" width="4.4" height="4" fill="${INKS.amber}"/>` +
      `<circle cx="37.6" cy="15" r="4" fill="${INKS.amber}" opacity="0.25"/>` +
      sparks(s.r, 26, 22, 6, 4),
  },
  'r-righteous': {
    world: 'mars',
    caption: 'a wall stencilled NO RETREAT, its flag on the roof, a Breacher standing in front of it',
    draw: (s) =>
      outdoors(s, 34, { planet: false }) +
      print(s, 'wall', 30, 34, { size: 0.36 }) +
      stencil('NO RETREAT', 21, 25, 4.8, INKS.bone) +
      mech(s, 'breacher', 51, 41, 0.085, { yaw: -20 }) +
      flag(s, 6, 14.4, 11, INKS.oxide),
  },

  'r-ruthless': {
    world: 'deimos',
    caption: "a jammer pod on a Tactician's shoulder, static rings going out",
    draw: (s) =>
      outdoors(s, 38, { planet: false }) +
      rings(28, 11, 4, 3.4, 6, INKS.oxide, 0.7, 200, 340) +
      stroke('M44,8 l2,2 l-2,2 l2,2 l-2,2 M50,12 l2,2 l-2,2 l2,2', INKS.oxide, 0.45) +
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
        mech(s, 'behemoth', 8, 30, 0.035, walk(0), { ink: { ...s.ink, key: s.ink.side }, plate: false }) +
        mech(s, 'chameleon', 20, 32, 0.05, walk(1), { ink: { ...s.ink, key: s.ink.side } }) +
        mech(s, 'tactician', 34, 35, 0.07, walk(2)) +
        mech(s, 'chameleon', 52, 40, 0.1, walk(3)) +
        storm(s, 2, 40, 0.7)
      );
    },
  },
  'r-stealthy': {
    world: 'deimos',
    caption: 'a drop pod falling alone into a dust storm',
    draw: (s) =>
      outdoors(s, 36, { planet: { x: 12, y: 9, r: 8 } }) +
      stroke('M44,-4 L36,12', s.key, 0.35, ' stroke-dasharray="1 1"') +
      `<g transform="rotate(-24 36 22)">${print(s, 'pod', 36, 22, { size: 0.2 })}<path d="M34,22.6 L36,28 L38,22.6 Z" fill="${INKS.amber}"/></g>` +
      storm(s, 14, 40, 0.85),
  },
  'r-strategic': {
    world: 'phobos',
    caption: 'three mechs back to back, guns out three ways',
    draw: (s) =>
      outdoors(s, 32, { planet: { x: 32, y: 8, r: 7 } }) +
      mech(s, 'sniper', 15, 39, 0.1, { yaw: 30, aim: -48 }, { flip: true }) +
      mech(s, 'breacher', 48, 39, 0.1, { yaw: 30, arms: { plus: [-80, -10] } }) +
      mech(s, 'chameleon', 31, 41, 0.11, {}),
  },
  'r-stubborn': {
    world: 'mars',
    caption: 'a Breacher dug into a trench behind a barricade of boulders',
    draw: (s) =>
      outdoors(s, 28, { planet: { x: 52, y: 8, r: 8 } }) +
      mech(s, 'breacher', 30, 44, 0.12, { yaw: 14 }) +
      r2(-4, 34, 72, 12, GROUND.mars.shade) +
      r2(-4, 34, 72, 2, ht(s, 'key')) +
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
      }) +
      stroke('M8,16 L18,16 M6,20 L17,20 M9,24 L16,24', s.key, 0.5, ' opacity="0.7"'),
  },
  'r-talented': {
    world: 'phobos',
    caption: 'a crew photo: five people, each printed in a different ink',
    draw: (s) => {
      const inks = [INKS.oxide, INKS.ice, INKS.amber, INKS.green, INKS.violet];
      return (
        outdoors(s, 30, { planet: { x: 52, y: 8, r: 8 } }) +
        mech(s, 'behemoth', 32, 42, 0.12, {}, { ink: { ...s.ink, key: s.ink.side, seam: s.ink.joint } }) +
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
      outdoors(s, 34, { planet: { x: 10, y: 8, r: 8 } }) +
      print(s, 'habitat', 34, 35, { size: 0.2 }) +
      print(s, 'mast', 52, 37, { size: 0.24 }) +
      path('M51,9 L45,6 L45,12 Z', s.key) +
      r2(51, 8.2, 2, 1.6, s.key) +
      rings(45, 9, 3, 3, 6, INKS.oxide, 0.8, 140, 220),
  },
  // ---------------------------------------------------------------------------------------------- Tactics
  'r-aggression': {
    world: 'mars',
    caption: 'a two-ink recruitment poster: raised fists and a Chameleon',
    draw: (s) => {
      const fist = (x: number, h: number, t: number) =>
        `<g transform="rotate(${t} ${x} 44)"><rect x="${x - 2.6}" y="${44 - h}" width="5.2" height="${h}" fill="${INKS.oxide}"/><rect x="${x - 3.6}" y="${44 - h - 5}" width="7.2" height="6" rx="1.6" fill="${INKS.oxide}"/></g>`;
      return (
        paperGround(s) +
        rays(s, 32, 18, 28, INKS.oxide, 180, 360) +
        `<circle cx="32" cy="18" r="8" fill="${s.paper}"/>` +
        mech(s, 'chameleon', 32, 38, 0.13, { yaw: 0, arms: { plus: [-140, 0] } }, { plate: INKS.oxide }) +
        [6, 14, 50, 58].map((x, i) => fist(x, 12 + (i % 2) * 6, (i < 2 ? -1 : 1) * 6)).join('')
      );
    },
  },
  'r-black-market': {
    world: 'mars',
    caption: 'a trader lifting the lid on a case of strike beacons',
    draw: (s) =>
      paperGround(s) +
      sky(s, { planet: { x: 52, y: 8, r: 9 } }) +
      land(s, 30) +
      `<circle cx="34" cy="28" r="14" fill="${INKS.amber}" opacity="0.18"/>` +
      r2(22, 30, 26, 9, s.key) +
      `<g transform="rotate(-50 22 30)">${r2(22, 25, 26, 5, s.key)}</g>` +
      r2(23.4, 31, 23, 4, s.ink.recess) +
      [26, 30.5, 35, 39.5, 44]
        .map((x) => r2(x - 1, 27.6, 2, 6, INKS.bone) + `<circle cx="${x}" cy="27.4" r="0.9" fill="${INKS.amber}"/>`)
        .join('') +
      person(52, 41, 0.3, { facing: -1, arms: [110, 70], elbows: [-30, 20], lean: -14 }, s.key, s.paper),
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
      mech(s, 'sniper', 30, 41, 0.085, { yaw: 30, legs: { plus: [-18, 14], minus: [18, 4] } }, { plate: INKS.ice }) +
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
    caption: 'an enemy mech caught in a marked kill zone, crossfire coming in from both sides',
    draw: (s) =>
      outdoors(s, 22, { planet: { x: 52, y: 8, r: 7 } }) +
      // the kill zone: three hexes painted on the ground, hatched in the plate
      hexOnGround(26, 31, 6, 0.42, INKS.amber, 0.7) +
      hexOnGround(38, 31, 6, 0.42, INKS.amber, 0.7) +
      hexOnGround(32, 35.4, 6, 0.42, INKS.amber, 0.7) +
      `<ellipse cx="32" cy="32.6" rx="12" ry="4" fill="${ht(s, 'plate')}"/>` +
      mech(s, 'breacher', 32, 33.6, 0.052, { yaw: 20 }, { plate: INKS.oxide }) +
      // tracers from both sides, impacts on the target
      stroke('M-4,30 L29,25 M-4,34 L30,28.4', INKS.amber, 0.5) +
      stroke('M68,28 L35,24.6 M68,33 L34.6,28.6', INKS.amber, 0.5) +
      flash(29.4, 25.4, 2.4, 9) +
      flash(34.8, 28.4, 2, 8, 14) +
      sparks(s.r, 32, 26.6, 14, 8) +
      mech(s, 'chameleon', 2, 46, 0.12, { yaw: 40, arms: { plus: [-80, -10] } }, { plate: INKS.ice }) +
      mech(s, 'sniper', 63, 46, 0.12, { yaw: -40 }, { plate: INKS.ice, flip: true }),
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
      for (let i = 0; i < 60; i++)
        grit += `<circle cx="${n(36 + s.r.range(-1.4, 1.4) + i * 0.02)}" cy="${n(10 + i * 0.36)}" r="${n(s.r.range(0.2, 0.5))}" fill="${INKS.dust}"/>`;
      return (
        paperGround(s) +
        r2(6, 22, 52, 20, '#2c2a27') +
        r2(4, 20, 56, 3, s.key) +
        gear(22, 32, 7, 12, s.key) +
        gear(36, 30, 5, 9, s.ink.joint) +
        gear(48, 34, 6, 10, s.key) +
        grit +
        `<ellipse cx="38" cy="31" rx="5" ry="2" fill="${INKS.dust}"/>` +
        glove(39, 9, 8, 160, INKS.bone) +
        stroke('M40,4 L52,-4', INKS.bone, 4.4)
      );
    },
  },
  'r-show-of-force': {
    world: 'mars',
    caption: 'an enemy mech hit from above by an amber column of light',
    draw: (s) =>
      paperGround(s) +
      sky(s, { planet: { x: 12, y: 9, r: 9 } }) +
      land(s, 32) +
      r2(36, -4, 8, 38, INKS.amber, ' opacity="0.35"') +
      r2(38.4, -4, 3.2, 38, INKS.amber) +
      r2(39.4, -4, 1.2, 38, INKS.bone) +
      mech(s, 'chameleon', 40, 37, 0.1, { yaw: -24, lean: 12 }, { plate: INKS.oxide }) +
      flash(40, 22, 6, 12) +
      rings(40, 37, 6, 4, 4, INKS.amber, 0.6, 180, 360) +
      sparks(s.r, 40, 22, 18, 12),
  },
  'r-unveil-the-fleet': {
    world: 'deimos',
    caption: 'drop pods coming down all over the map',
    draw: (s) => {
      const pods = [
        [10, 10, 0.1, -10],
        [24, 4, 0.08, -6],
        [40, 14, 0.12, 8],
        [54, 6, 0.09, 12],
        [30, 22, 0.14, -4],
      ] as const;
      return (
        outdoors(s, 34, { planet: { x: 52, y: 26, r: 8 } }) +
        pods
          .map(
            ([x, y, z, t]) =>
              stroke(`M${x - t * 0.4},${y - 14} L${x},${y - 5}`, s.key, 0.25, ' stroke-dasharray="0.8 0.8"') +
              `<g transform="rotate(${t} ${x} ${y})">${print(s, 'pod', x, y, { size: z })}<path d="M${x - 1.6},${y + 0.4} L${x},${y + z * 30} L${x + 1.6},${y + 0.4} Z" fill="${INKS.amber}"/></g>`,
          )
          .join('') +
        print(s, 'pod', 8, 38, { size: 0.12 }) +
        print(s, 'pod', 58, 37, { size: 0.1 }) +
        rings(30, 38, 3, 3, 3, s.key, 0.35, 180, 360)
      );
    },
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
        mech(s, 'chameleon', 52, 14, 0.035, { yaw: -30 }) +
        label('ICE', 32, 24, 1.6, s.key)
      );
    },
  },
  'r-expansion': {
    world: 'mars',
    caption: "a new Chameleon walking out of a workshop's doors",
    draw: (s) =>
      outdoors(s, 34, { planet: { x: 10, y: 8, r: 8 } }) +
      print({ ...s, key: '#4A4440' }, 'workshop', 32, 36, { size: 0.3 }) +
      r2(22, 20.4, 20, 15.6, INKS.amber, ' opacity="0.4"') +
      rays(s, 32, 28, 16, INKS.amber, 30, 150) +
      mech(s, 'chameleon', 33, 40, 0.1, { yaw: 22, legs: { plus: [-20, 20], minus: [16, 6] } }),
  },
};
