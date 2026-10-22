import { blur, gradientMap, greyFromRed, hsl, n, stretch, turbulence, type Hsl } from '../svg';
import { spot, type Ctx, type Surface } from './core';

/** Gas giant palettes (8): all gold to amber, from pale cream to deep rust, so every 8 reads golden. */
const GIANTS: Record<string, (h: number, light: number) => Hsl[]> = {
  jupiter: (h, light) => [
    [h - 12, 62, 30],
    [h, 78, 46],
    [h + 8, 85, light],
    [h + 10, 70, 86],
    [h - 6, 80, 52],
    [h - 16, 60, 36],
    [h + 4, 75, light + 6],
  ],
  saturn: (h) => [
    [h + 8, 45, 60],
    [h + 12, 60, 72],
    [h + 14, 70, 82],
    [h + 16, 55, 91],
    [h + 10, 55, 68],
    [h + 14, 45, 78],
    [h + 16, 65, 88],
  ],
  rust: (h) => [
    [h - 22, 55, 28],
    [h - 16, 65, 40],
    [h + 6, 60, 82],
    [h - 12, 70, 48],
    [h + 10, 55, 88],
    [h - 20, 60, 34],
    [h + 2, 70, 66],
  ],
  amber: (h, light) => [
    [h - 18, 70, 22],
    [h - 10, 82, 36],
    [h - 4, 90, 50],
    [h + 6, 80, light],
    [h - 14, 75, 30],
    [h, 85, 44],
    [h + 8, 70, 76],
  ],
  // Copper and peach belts.
  copper: (h) => [
    [h - 20, 60, 34],
    [h - 14, 72, 52],
    [h - 8, 80, 70],
    [h - 4, 60, 84],
    [h - 18, 66, 44],
    [h - 10, 75, 62],
    [h - 2, 55, 90],
  ],
  // Sharp chocolate and cream stripes.
  striped: (h) => [
    [h - 14, 55, 20],
    [h + 12, 50, 90],
    [h - 8, 70, 38],
    [h + 14, 60, 84],
    [h - 16, 50, 26],
    [h + 6, 75, 66],
    [h + 16, 45, 93],
  ],
  // Olive-gold, muted.
  khaki: (h) => [
    [h + 6, 35, 34],
    [h + 10, 45, 50],
    [h + 14, 50, 66],
    [h + 12, 40, 80],
    [h + 4, 40, 42],
    [h + 12, 50, 58],
    [h + 16, 35, 88],
  ],
};

/** Ice giant palettes (9): pale and tinted, turquoise to blue. */
function iceGiant(c: Ctx): Hsl[] {
  const h = c.hue + c.rng.pick([-22, -10, 0, 10, 18]);
  const sat = c.rng.range(38, 64);
  return [
    [h - 6, sat, 58],
    [h, sat, 68],
    [h + 8, sat * 0.8, 79],
    [h + 4, sat * 0.5, 90],
    [h - 4, sat, 62],
    [h + 10, sat * 0.7, 74],
    [h, sat * 0.55, 86],
  ];
}

export function gas(c: Ctx): Surface {
  const { o, hue, rng, s, f } = c;
  const { id, cx, cy, r } = o;
  // An ice giant (pale, soft bands) on the light planets; otherwise a vivid banded giant.
  const pale = o.number === 9;
  const stops = pale ? iceGiant(c) : GIANTS[rng.pick(Object.keys(GIANTS))](hue, rng.range(62, 74));
  if (rng.chance(0.5)) stops.reverse();
  // The pattern: belts in one of several flows, or no belts at all (seen from a pole, marbled, cells).
  const style = rng.pick(
    pale
      ? (['smooth', 'smooth', 'banded', 'banded', 'fine', 'wavy', 'vortex', 'marbled'] as const)
      : (['smooth', 'banded', 'banded', 'fine', 'turbulent', 'wavy', 'zoned', 'vortex', 'vortex', 'marbled', 'marbled', 'cells'] as const),
  );
  let extra = '';
  let extraDefs = '';
  let hasOval = false;
  const oval = (x: number, y: number, rx: number, ry: number, fill: string, op: number) => {
    hasOval = true;
    return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" opacity="${op}" filter="url(#${id}-storm-blur)"/>`;
  };
  const belted = style !== 'vortex' && style !== 'marbled' && style !== 'cells';
  if (style !== 'vortex' && rng.chance(pale ? 0.4 : 0.6)) {
    // A great storm: a soft oval in a band, sometimes large.
    const sx = cx + rng.range(-0.4, 0.35) * r;
    const sy = cy + rng.range(-0.1, 0.45) * r;
    const k = rng.chance(0.25) ? 1.5 : 1;
    extra +=
      oval(sx, sy, r * 0.2 * k, r * 0.09 * k, pale ? hsl(hue + 20, 65, 38) : hsl(hue - 22, 70, 32), 0.75) +
      oval(sx, sy, r * 0.13 * k, r * 0.05 * k, pale ? hsl(hue, 40, 94) : hsl(hue - 18, 75, 62), 0.7);
  }
  if (belted && rng.chance(0.35)) {
    // A string of small white storms along one band.
    const y = cy + rng.range(-0.5, 0.5) * r;
    const count = rng.int(3, 6);
    const x0 = cx - rng.range(0.3, 0.6) * r;
    for (let i = 0; i < count; i++)
      extra += oval(x0 + i * r * rng.range(0.14, 0.2), y + rng.range(-0.03, 0.03) * r, r * 0.05, r * 0.03, '#fff', 0.7);
  }
  if (pale && style !== 'vortex' && rng.chance(0.45)) {
    // A bright polar hood.
    extraDefs += blur(`${id}-hood-blur`, 1.6 * s);
    extra += `<ellipse cx="${n(cx)}" cy="${n(cy - r)}" rx="${n(r * 0.9)}" ry="${n(r * rng.range(0.3, 0.45))}" fill="${hsl(hue, 40, 95)}" opacity=".55" filter="url(#${id}-hood-blur)"/>`;
  }
  if (pale && style !== 'vortex' && rng.chance(0.4)) {
    // Thin bright cloud streaks.
    for (let i = rng.int(2, 4); i > 0; i--) {
      const p = spot(c, 0.7);
      extra += oval(p.x, p.y, r * rng.range(0.12, 0.28), r * 0.02, '#fff', 0.65);
    }
  }
  const warp = (input: string, swirl: number, scale: number) =>
    turbulence(f(swirl), 2, rng.noiseSeed(), 'swirl') +
    `<feDisplacementMap in="${input}" in2="swirl" scale="${n(scale * s)}" xChannelSelector="R" yChannelSelector="G" result="d"/>`;
  const colour = (contrast: number, ramp = stops) => greyFromRed('d') + stretch(contrast) + gradientMap(ramp);

  /** The palette's colours at these fractions of the way from darkest to lightest. */
  const byLight = (at: number[]) => {
    const sorted = [...stops].sort((x, y) => x[2] - y[2]);
    return at.map((k) => sorted[Math.round(k * (sorted.length - 1))]);
  };

  if (style === 'vortex') {
    // Seen from near a pole: soft belts of uneven width and shade around it, foreshortened (the pole is
    // tipped towards us, not facing us) and torn into eddies, with a hexagon round the pole as on Saturn,
    // or a cluster of cyclones on it as on Jupiter.
    const px = cx + rng.range(-0.3, 0.3) * r;
    const py = cy + rng.range(-0.3, 0.3) * r;
    const squash = rng.range(0.6, 0.85);
    /** A point `d` from the pole at angle `a`, foreshortened. */
    const around = (a: number, d: number) => ({ x: px + Math.cos(a) * d, y: py + Math.sin(a) * d * squash });
    const fill = `${id}-rings`;
    // One stop per belt, so each blends into the next rather than meeting it at an edge.
    let belts = '';
    for (let at = 0, i = 0; at <= 1; at += rng.range(0.1, 0.22), i++) {
      const grey = Math.round((i % 2 ? rng.range(0.55, 0.85) : rng.range(0.15, 0.45)) * 255);
      belts += `<stop offset="${n(at)}" stop-color="rgb(${grey} ${grey} ${grey})"/>`;
    }
    extraDefs +=
      `<radialGradient id="${fill}" gradientUnits="userSpaceOnUse" cx="${n(px)}" cy="${n(py)}" r="${n(r * rng.range(1.4, 1.8))}" ` +
      `gradientTransform="translate(${n(px)} ${n(py)}) scale(1 ${n(squash)}) translate(${n(-px)} ${n(-py)})">${belts}</radialGradient>`;
    const dark = pale ? hsl(hue + 20, 55, 42) : hsl(hue - 20, 65, 26);
    const light = pale ? hsl(hue, 35, 92) : hsl(hue + 8, 70, 74);
    const spin = rng.range(0, Math.PI * 2);
    if (rng.chance(0.5)) {
      // The hexagon: a dark jet stream with straight sides, a little paler inside.
      const size = r * rng.range(0.3, 0.42);
      const corners = Array.from({ length: 6 }, (_, i) => around(spin + (i * Math.PI) / 3, size));
      const points = corners.map((p) => `${n(p.x)},${n(p.y)}`).join(' ');
      extraDefs += blur(`${id}-hex-blur`, 0.5 * s);
      extra +=
        `<polygon points="${points}" fill="${light}" fill-opacity=".22" stroke="${dark}" stroke-width="${n(0.07 * r)}" stroke-opacity=".6" stroke-linejoin="round" filter="url(#${id}-hex-blur)"/>` +
        oval(px, py, r * 0.07, r * 0.07 * squash, dark, 0.7);
    } else {
      // The cyclones: one on the pole and a ring of them around it, each a dark swirl with a pale core.
      const cyclone = (x: number, y: number, size: number) =>
        oval(x, y, size, size * squash, dark, 0.5) +
        oval(x - size * 0.2, y - size * 0.2 * squash, size * 0.5, size * 0.5 * squash, light, 0.45);
      extra += cyclone(px, py, r * rng.range(0.06, 0.08));
      const count = rng.int(5, 8);
      const reach = r * rng.range(0.15, 0.2);
      for (let i = 0; i < count; i++) {
        const p = around(spin + (i / count) * Math.PI * 2 + rng.range(-0.15, 0.15), reach);
        extra += cyclone(p.x, p.y, r * rng.range(0.035, 0.055));
      }
    }
    return {
      fill: `url(#${fill})`,
      filter:
        turbulence(f(0.1), 3, rng.noiseSeed(), 'grain') +
        `<feComposite in="SourceGraphic" in2="grain" operator="arithmetic" k2=".7" k3=".4" k4="-.1" result="mix"/>` +
        // A broad wobble, then fine eddies along the belts' edges.
        warp('mix', rng.range(0.025, 0.04), rng.range(6, 9)) +
        warp('d', rng.range(0.12, 0.16), rng.range(2.5, 4)) +
        // Each belt keeps its own shade (the belts' palette would stripe every belt several times).
        colour(pale ? 1.25 : 1.5, byLight([0, 0.25, 0.5, 0.75, 1])),
      extra,
      extraDefs: (hasOval ? blur(`${id}-storm-blur`, 0.35 * s) : '') + extraDefs,
    };
  }

  // Every other pattern starts from noise: [x, y] frequency, how hard and how finely it is swirled, and contrast.
  const flow = {
    smooth: { freq: [0.012, rng.range(0.08, 0.16)], swirl: 0.06, warp: rng.range(1.5, 3), contrast: 1.4 },
    banded: { freq: [0.012, rng.range(0.18, 0.4)], swirl: 0.09, warp: rng.range(2.5, 5.5), contrast: pale ? 2 : 2.6 },
    fine: { freq: [0.012, rng.range(0.45, 0.7)], swirl: 0.11, warp: rng.range(1.5, 3.5), contrast: 2.2 },
    turbulent: { freq: [0.012, rng.range(0.2, 0.34)], swirl: 0.13, warp: rng.range(7, 11), contrast: 2.8 },
    // Belts bent into big slow waves.
    wavy: { freq: [0.01, rng.range(0.2, 0.32)], swirl: 0.035, warp: rng.range(9, 14), contrast: 2.4 },
    // A few broad zones with crisp edges (stepped colours, below).
    zoned: { freq: [0.008, rng.range(0.1, 0.16)], swirl: 0.08, warp: rng.range(1, 2.5), contrast: 1.8 },
    // No belts: the whole face churned into swirls.
    marbled: { freq: [rng.range(0.03, 0.06), rng.range(0.04, 0.08)], swirl: rng.range(0.05, 0.09), warp: rng.range(10, 16), contrast: 2.4 },
    // Mottled convection cells, as on a brown dwarf.
    cells: { freq: [rng.range(0.12, 0.18), rng.range(0.12, 0.18)], swirl: 0.1, warp: rng.range(2, 4), contrast: 2.6 },
  }[style];
  const filter =
    turbulence(`${f(flow.freq[0])} ${f(flow.freq[1])}`, 3, rng.noiseSeed(), 'bands') +
    warp('bands', flow.swirl, flow.warp) +
    // Zones hold each colour, then turn quickly to the next.
    colour(flow.contrast, style === 'zoned' ? stops.flatMap((c) => [c, c, c]) : stops);
  return { filter, extra, extraDefs: (hasOval ? blur(`${id}-storm-blur`, 0.35 * s) : '') + extraDefs };
}
