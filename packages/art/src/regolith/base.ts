import type { Rng } from '../rng';
import { n } from '../svg';
import { cubePadCentres, numberCorner, type Spot } from '../tile';
import { SPACE, SCALE, SIZE, inside, toward } from './core';
import { H, biohazard, type Part, placed, type Drawn, merged, disc, graded, glow, run } from './parts';
import {
  hub,
  dome,
  greenhouses,
  domelets,
  solar,
  tankFarm,
  flares,
  stack,
  columns,
  pit,
  rig,
  silos,
  coolingTower,
  radiators,
  conduit,
  containers,
  dish,
  crystals,
  fissures,
} from './buildings';
import { landingPad, rover, crates, beacon, probe, tyreTracks } from './craft';

/** How a base is laid out round its planet's space: its hub, outbuildings out along the ways to the next hexes, and small things round them. */

/**
 * The ways a base may spread from its planet's space, best first in a random order: towards the neighbouring
 * hexes (flat-topped, so they meet it at 30° + k·60°) that are on the tile, and not past the number's corner.
 */
function exits(r: Rng, at: Spot, numbered: boolean): number[] {
  const k = numberCorner(at, 'hex');
  const corner = (Math.atan2(k.y * 0.5, (k.x * 0.5) / Math.sqrt(3)) * 180) / Math.PI;
  return [-90, -30, 30, 90, 150, 210]
    .filter((a) => {
      const { x, y } = toward(a, 1);
      const off = Math.abs(((((a - corner) % 360) + 540) % 360) - 180);
      return Math.hypot(at.x + x / SPACE, at.y + y / SPACE) < 1.01 && (!numbered || off > 50);
    })
    .map((a) => ({ a, k: r.next() }))
    .sort((p, q) => p.k - q.k)
    .map((p) => p.a);
}

/** A clear circle where something stands. */
type Taken = Spot & { r: number };

/** The clear ground kept between a base's buildings, in board units. */
const GAP = 3;

/** How far p is from the line from a to b. */
function gap(p: Spot, a: Spot, b: Spot): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/**
 * Small things round a base, and out past it: a rover or two with their tracks, crates by the buildings,
 * survey beacons, now and then an old probe. Each placed on the tile (the planet's space at `centre`),
 * clear of what's `taken` and the `links`, or left out.
 */
function incidentals(r: Rng, centre: Spot, taken: Taken[], links: [Spot, Spot][], hub: number, light: string): Part[] {
  const spot = (reach: number, near?: [number, number]): Spot | undefined => {
    for (let i = 0; i < 60; i++) {
      const p = near
        ? toward(r.range(0, 360), r.range(...near) / SPACE)
        : { x: r.range(0, SIZE) - centre.x, y: r.range(0, SIZE) - centre.y };
      if (inside(centre.x + p.x, centre.y + p.y) < reach + 2) continue;
      if (taken.some((f) => Math.hypot(p.x - f.x, p.y - f.y) < reach + f.r + GAP)) continue;
      if (links.some(([s, t]) => gap(p, s, t) < reach + GAP + 2)) continue;
      taken.push({ ...p, r: reach });
      return p;
    }
    return undefined;
  };
  const tracks: Part[] = [];
  const out: Part[] = [];
  const add = (p: Spot | undefined, part: Part, turn = 0, scale = 1) => p && out.push(placed(p.x, p.y, part, turn, scale));
  // A rover or two: one near the base, one anywhere.
  const roving: ([number, number] | undefined)[] = [];
  if (r.chance(0.5)) roving.push([hub + 8, hub + 30]);
  if (r.chance(0.25)) roving.push(undefined);
  for (const near of roving) {
    const p = spot(8.5, near);
    if (!p) continue;
    const turn = r.range(0, 360);
    tracks.push(tyreTracks(r, p, turn, centre));
    add(p, rover(), turn, 1.4);
  }
  for (let i = r.int(1, 3); i > 0; i--) add(spot(7, [hub + 5, hub + 18]), crates(r), 0, 1.4);
  for (let i = r.int(0, 3); i > 0; i--) add(spot(4), beacon(r, light), 0, 1.3);
  if (r.chance(0.2)) add(spot(23), probe(r), r.range(0, 360), 1.25);
  return [...tracks, ...out];
}

/** How much larger than drawn a base's outbuildings stand, reaching well into the hexes round it. */
const BIG = 1.35;

/** An outbuilding a base may have: how likely it is, how far out it stands (in spaces), how it's linked to the hub along `a`, what it is, how much larger than drawn, and whether it's turned with the way out. */
interface Annex {
  weight: number;
  reach: [number, number];
  link: (a: number, p: Spot) => Part;
  part: (r: Rng) => Part;
  scale: number;
  turned: boolean;
}

const annex = (
  weight: number,
  reach: [number, number],
  link: (a: number, p: Spot) => Part,
  part: (r: Rng) => Part,
  scale = BIG,
  turned = false,
): Annex => ({ weight, reach, link, part, scale, turned });

/**
 * A base's outbuildings, one each way out (`ways`) for as many as it has: picked by weight, none twice
 * until each has stood once, each a little nearer or further out and larger or smaller. Each stands
 * clear of the hub (`hub` across from the planet's space), of the others and their links, and on the
 * tile (the planet's space at `centre` on it): moved further out, or made smaller, until it is, or left
 * out if it can't be. Where each stands, and its link, go in `taken` and `links`.
 */
function outskirts(
  r: Rng,
  ways: readonly number[],
  count: number,
  pool: readonly Annex[],
  centre: Spot,
  hub: number,
  taken: Taken[],
  links: [Spot, Spot][],
): Part[] {
  const out: Part[] = [];
  let left = [...pool];
  for (const a of ways.slice(0, count)) {
    if (!left.length) left = [...pool];
    let pick = r.next() * left.reduce((s, x) => s + x.weight, 0);
    const chosen = left.find((x) => (pick -= x.weight) < 0) ?? left[0];
    left = left.filter((x) => x !== chosen);
    const part = chosen.part(r);
    const turn = chosen.turned ? a + 90 : r.range(-15, 15);
    const grow = chosen.scale * r.range(0.88, 1.1);
    const near = r.range(...chosen.reach);
    const from = toward(a, 0.3);
    const fit = (() => {
      for (const k of [1, 0.9, 0.8, 0.7])
        for (let d = near; d <= near + 0.35; d += 0.025) {
          const p = toward(a, d);
          const e = (part.extent ?? 15) * grow * k;
          if (Math.hypot(p.x, p.y) < hub + e + GAP) continue;
          // Further out is only nearer the tile's edge.
          if (inside(centre.x + p.x, centre.y + p.y) < e + 1) break;
          if (taken.some((f) => Math.hypot(p.x - f.x, p.y - f.y) < e + f.r + GAP)) continue;
          if (links.some(([s, t]) => gap(p, s, t) < e + GAP)) continue;
          if (taken.some((f) => gap(f, from, p) < f.r + GAP)) continue;
          return { p, e, scale: grow * k };
        }
      return undefined;
    })();
    if (!fit) continue;
    taken.push({ ...fit.p, r: fit.e });
    links.push([from, fit.p]);
    out.push(chosen.link(a, fit.p), placed(fit.p.x, fit.p.y, part, turn, fit.scale));
  }
  return out;
}

/** How many outbuildings a base has: one to four, two or three most often. */
const SPREAD = [1, 1, 2, 2, 2, 3, 3, 3, 4];

/**
 * The base on a planet's space, after the planets' own colours: a hub round its cube sockets (one per cube
 * the planet holds), and a few outbuildings out in the hexes round it, joined to it, a different few on
 * each tile: for a 7 a habitat under a great green dome, with violet greenhouses, blue domes and solar
 * panels; for an 8 a refinery, gold tanks and burning flare stacks; for a 9 an ice mine in a ring of frost,
 * its pit glowing blue; for a 10 a black reactor with red-hot cooling towers; any of them with a landing
 * pad, containers or a dish; and on a Void tile a sinkhole ringed by violet crystals, its cracks glowing.
 * Centred on the planet's space, in board units. `at` is where the planet sits on its tile (in spaces from
 * the middle).
 */
export function base(number: number, at: Spot, r: Rng): Drawn | undefined {
  const pads = cubePadCentres(number - 6, 0, 0).map((p) => ({ x: p.x / SCALE, y: p.y / SCALE }));
  const ways = exits(r, at, number > 0);
  const count = r.pick(SPREAD);
  const centre = { x: SIZE / 2 + at.x * SPACE, y: SIZE / 2 + at.y * SPACE };
  const taken: Taken[] = [];
  const links: [Spot, Spot][] = [];
  const outskirtsOf = (hubReach: number, pool: Annex[]) => outskirts(r, ways, count, pool, centre, hubReach, taken, links);
  // The hub (or the sinkhole) is taken, then the small things go round what stands.
  const around = (hubReach: number, light: string) => {
    taken.push({ x: 0, y: 0, r: hubReach });
    return incidentals(r.fork('incidentals'), centre, taken, links, hubReach, light);
  };
  // Links start at the hub's edge, so none crosses the cube sockets.
  const tube = (w: number, colour: string) => (a: number, p: Spot) => run(toward(a, 0.3), p, w * r.range(0.8, 1.2), colour);
  const road = (a: number, p: Spot): Part => {
    const d = `M${n(toward(a, 0.3).x)},${n(toward(a, 0.3).y)} L${n(p.x)},${n(p.y)}`;
    return {
      grade: `<path d="${d}" stroke="${H.graded}" stroke-width="14" filter="url(#rg-soft3)"/>`,
      paint: `<path d="${d}" stroke="#e6eef2" stroke-width="0.9" stroke-dasharray="2.5 2" opacity="0.6"/>`,
    };
  };
  const common = (light: string): Annex[] => [
    annex(1.2, [0.7, 0.8], tube(3, '#8d969c'), (r) => landingPad(r, light), 1.15),
    annex(0.8, [0.6, 0.78], tube(2.5, '#8d969c'), containers, 1.5),
    annex(0.6, [0.55, 0.72], tube(2, '#8d969c'), () => dish(light), 1.2),
  ];
  switch (number) {
    case 0:
      return merged([
        { grade: disc(0, 0, r.range(38, 48), 'url(#rg-sink)', ' filter="url(#rg-wx-m)"') },
        fissures(r, r.int(2, 6), 32, r.range(45, 66)),
        crystals(r, r.int(5, 11), 36),
        crystals(r, r.int(0, 4), 60),
        ...around(58, '#b07bff'),
        {
          paint:
            glow(0, 0, 24, '#6a2cff', 0.6, 'rg-soft6') +
            glow(0, 0, 8, '#d6b8ff', 0.75) +
            disc(0, 0, 14, '#000', ' opacity="0.35" filter="url(#rg-soft3)"'),
        },
      ]);
    case 7: {
      const great = r.range(25, 30);
      return merged([
        ...outskirtsOf(great + 2.5, [
          annex(2, [0.74, 0.84], tube(6, '#a7b0b6'), greenhouses, 1.15, true),
          annex(1.5, [0.64, 0.74], tube(6, '#a7b0b6'), domelets, BIG, true),
          annex(1.5, [0.7, 0.8], tube(2.5, '#8d969c'), solar, BIG, true),
          ...common('#7dffb0'),
        ]),
        // The great dome is the base's middle: its hatch, on top, holds the cube.
        dome(great, '#4a9c7a', '#6dff9e', 22),
        hub(pads, '#9aa3a8', 'rgb(246,160,205)', '#7dffb0'),
        ...around(great + 2.5, '#7dffb0'),
      ]);
    }
    case 8:
      return merged([
        ...outskirtsOf(32, [
          annex(2.5, [0.7, 0.8], tube(3, '#f2ad2c'), tankFarm, 1),
          annex(1.5, [0.6, 0.72], tube(3, '#c9c4bc'), flares, BIG, true),
          annex(1.5, [0.72, 0.8], tube(3.5, '#d4802a'), columns, BIG, true),
          ...common('#ffcf4a'),
        ]),
        hub(pads, '#a59c90'),
        ...around(32, '#ffcf4a'),
      ]);
    case 9: {
      const frost = r.range(45, 66);
      const tower = r.pick([-1, 1]) * 25;
      return merged([
        {
          grade: disc(0, 0, frost, 'url(#rg-frost)', ' style="mix-blend-mode: lighten"'),
          paint: glow(0, 0, frost, '#d6ecff', 0.28, 'rg-soft6'),
        },
        ...outskirtsOf(40, [
          annex(2.5, [0.74, 0.84], road, pit),
          annex(1.5, [0.6, 0.72], tube(3.5, '#e8eef2'), rig, 1.6),
          annex(1.5, [0.68, 0.78], tube(3.5, '#e8eef2'), silos, BIG, true),
          ...common('#7fe9ff'),
        ]),
        hub(pads, '#c4ced4', H.deck, '#ff3b2a'),
        // A biohazard sign on one of its sockets.
        { paint: biohazard(r.pick(pads)) },
        // Its tower, in a corner the three sockets leave, piped up to the deck.
        run({ x: tower, y: 15 }, { x: tower, y: -4 }, 2.5, '#c9c4bc'),
        placed(tower, 15, stack(), 0, 1.25),
        ...around(40, '#7fe9ff'),
      ]);
    }
    case 10: {
      const vents = [
        [37, 0],
        [-37, 0],
        [0, 37],
        [0, -37],
      ];
      const octagon = (s: number) =>
        [
          [1, 0.41],
          [0.41, 1],
          [-0.41, 1],
          [-1, 0.41],
          [-1, -0.41],
          [-0.41, -1],
          [0.41, -1],
          [1, -0.41],
        ]
          .map(([x, y]) => `${n(x * s)},${n(y * s)}`)
          .join(' ');
      // The conduits start at the reactor's edge.
      const power = (a: number, p: Spot) => conduit(toward(a, 0.6), p, '#ff5a14');
      return merged([
        ...outskirtsOf(49, [
          annex(2.5, [0.78, 0.86], power, coolingTower, 1.2),
          annex(1.2, [0.8, 0.88], power, coolingTower, 1),
          annex(2, [0.8, 0.88], power, radiators, 1.15, true),
          // A pad and containers, but no dish.
          ...common('#ff7a1a').slice(0, 2),
        ]),
        {
          grade: graded(0, 0, 52),
          heights:
            `<polygon points="${octagon(45)}" fill="${H.apron}"/>` +
            `<polygon points="${octagon(44)}" fill="${H.dark}"/>` +
            `<g fill="rgb(150,40,90)">${vents.map(([x, y]) => `<rect x="-5" y="-5" width="10" height="10" transform="translate(${x},${y}) rotate(45)"/>`).join('')}</g>`,
          tint: `<polygon points="${octagon(45)}" fill="#2e2c30"/>`,
          paint:
            `<polygon points="${octagon(41)}" fill="none" stroke="#ff5a14" stroke-width="0.8" opacity="0.6"/>` +
            vents.map(([x, y]) => glow(x, y, 5, '#ff4a0a', 0.8) + glow(x, y, 2, '#ffd27a', 1, 'rg-soft1')).join(''),
        },
        hub(pads, '#3a383c', H.dark, '#ff7a1a'),
        ...around(49, '#ff7a1a'),
      ]);
    }
    default:
      return undefined;
  }
}
