import { hsl, n, type Fragment } from '../svg';
import { ACTION_HUE } from '../tokens';
import {
  arrowPath, at, beam, burst, chip, chips, combatDie, cube, die, DOMINANCE, f, glow, glyph, grid, icon, iso, line, loop, miniCard,
  panel, RESEARCH, scrapyard, shield, ship, shipOn, slash, space, sparkles, trails, world, worldOn, wreck,
  crest, dial, motes, orbit, pillar, } from '../kit';
import type { Illustration } from '../illustrations';
import { SKILL_SCENES } from './skills';
import { TACTIC_SCENES } from './tactics';

/** A spent chip with a 0 under it: "this costs no action". */
const freeChip = (x: number, y: number, r: number) => chip(x, y, r, 'spent') + glyph(x, y + r * 2, '0', r * 1.1, hsl(ACTION_HUE, 100, 85));

/**
 * The original (2013) Command and Gambit cards. Where one is the same card as in the Community
 * Edition, it uses the CE picture; otherwise every card has its own picture.
 */
export const ORIGINAL_SCENES: Record<string, Illustration> = {
  'o-agile': {
    caption: "a ship's reach drawn on the board: three spaces, and a fourth ring beyond",
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.52);
      const g = iso(cx, cy, 3.4);
      let rings = '';
      for (let i = -4; i <= 4; i++)
        for (let j = -4; j <= 4; j++) {
          const d = Math.abs(i) + Math.abs(j);
          if (d === 0 || d > 4) continue;
          rings += space(g, i, j, hue, d === 4 ? { a: 0.55, light: 74 } : { a: 0.08 + (3 - d) * 0.04, stroke: false });
        }
      return [
        grid(`${id}-g`, g, -5, 5, -5, 5, hue, 0.3),
        f(rings),
        shipOn(`${id}-s`, g, 0, 0, 3.6, 5, p1),
        f(glyph(g.x(4, -4) - 1, g.y(4, -4) - 6, '+1', 4.6, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), cx, cy, 15, 20, 4)),
      ];
    },
  },

  'o-arrogant': {
    caption: 'your fleet sweeps past in formation, dwarfing a lonely pair of enemy ships',
    draw: ({ id, r, box, p1, p2 }) => {
      const out = [];
      const pos = [[0.14, 0.5], [0.26, 0.38], [0.26, 0.62], [0.38, 0.26], [0.38, 0.5], [0.38, 0.74]];
      pos.forEach(([a, b], k) => {
        const [x, y] = at(box, a, b);
        out.push(...trails(`${id}-t${k}`, r.fork(`t${k}`), x - 2, y, 1, 0, 8, 0.6, hsl(p1, 80, 70), 2));
        out.push(ship(`${id}-s${k}`, x, y, 3, [6, 4, 5, 3, 2, 1][k], p1));
      });
      out.push(ship(`${id}-e0`, ...at(box, 0.82, 0.66), 2.6, 2, p2, { opacity: 0.7 }), ship(`${id}-e1`, ...at(box, 0.9, 0.78), 2.6, 5, p2, { opacity: 0.7 }));
      out.push(f(chip(...at(box, 0.82, 0.24), 3.8, 'new')));
      return out;
    },
  },

  'o-brilliant': SKILL_SCENES.brilliant,

  'o-cerebral': {
    caption: 'the trade costs no action: an unlit chip marked 0 beside the swap',
    draw: ({ id, r, box }) => {
      const [ax, ay] = at(box, 0.24, 0.42);
      const [bx, by] = at(box, 0.62, 0.42);
      return [
        f(icon('dominance', ax, ay, 8, hsl(DOMINANCE, 100, 72), 2)),
        arrowPath(`${id}-ar`, `M${n(ax + 6)} ${n(ay)}H${n(bx - 7)}`, hsl(RESEARCH, 90, 82), { w: 0.5 }),
        glow(`${id}-g`, bx, by, 8, 8, RESEARCH, 0.5),
        f(icon('research', bx, by, 8, hsl(RESEARCH, 100, 88), 2)),
        f(glyph(ax, ay + 9, '−1', 3.6, hsl(DOMINANCE, 100, 75)) + glyph(bx, by + 9, '+3', 3.6, hsl(RESEARCH, 100, 85))),
        f(freeChip(...at(box, 0.86, 0.36), 3.2)),
        f(sparkles(r.fork('sp'), bx, by, 6, 9, 3)),
      ];
    },
  },

  'o-clever': {
    caption: 'no roll: the ship picks its number from all six',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.66);
      const out = [];
      for (let v = 1; v <= 6; v++) {
        const a = Math.PI + (v - 0.5) * (Math.PI / 6);
        const x = cx + Math.cos(a) * 20;
        const y = cy + Math.sin(a) * 17 + 2;
        out.push(f(v === 5 ? `<circle cx="${n(x)}" cy="${n(y)}" r="4" fill="${hsl(hue, 90, 60, 0.25)}" stroke="#fff" stroke-width=".3"/>` : ''));
        out.push(f(die(x, y, 2.2, v, p1, v === 5 ? {} : { opacity: 0.4 })));
      }
      const a5 = Math.PI + 4.5 * (Math.PI / 6);
      out.push(arrowPath(`${id}-pick`, `M${n(cx + Math.cos(a5) * 15)} ${n(cy + Math.sin(a5) * 12.5 + 2)}L${n(cx + 2.5)} ${n(cy - 4)}`, hsl(hue, 100, 85), { w: 0.4 }));
      out.push(ship(`${id}-s`, cx, cy, 4.6, 5, p1));
      return out;
    },
  },

  'o-conformist': {
    caption: 'two ships showing the same number resonate: an extra action',
    draw: ({ id, r, hue, box, p1 }) => {
      const [ax, ay] = at(box, 0.24, 0.6);
      const [bx, by] = at(box, 0.62, 0.6);
      const [kx, ky] = at(box, 0.86, 0.3);
      let waves = '';
      for (let i = 0; i < 4; i++) waves += `<path d="M${n(ax + 5)} ${n(ay - 3 - i * 1.5)}Q${n((ax + bx) / 2)} ${n(ay - 9 - i * 2.5)} ${n(bx - 5)} ${n(by - 3 - i * 1.5)}" fill="none" stroke="${hsl(hue, 90, 75)}" stroke-width=".3" opacity="${n(0.9 - i * 0.2)}"/>`;
      return [
        f(waves),
        ship(`${id}-a`, ax, ay, 4.6, 4, p1),
        ship(`${id}-b`, bx, by, 4.6, 4, p1),
        f(glyph((ax + bx) / 2, ay + 1, '=', 6, hsl(hue, 100, 85))),
        glow(`${id}-cg`, kx, ky, 8, 8, hue, 0.5),
        f(chip(kx, ky, 4, 'new')),
        f(sparkles(r.fork('sp'), (ax + bx) / 2, ay - 9, 2, 6, 3)),
      ];
    },
  },

  'o-cruel': {
    caption: "the opponent's good roll is thrown back: roll again",
    draw: ({ id, hue, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.15, 0.68);
      const [ex, ey] = at(box, 0.86, 0.66);
      const [dx, dy] = at(box, 0.52, 0.45);
      return [
        ship(`${id}-a`, ax, ay, 4, 6, p1),
        ship(`${id}-e`, ex, ey, 4, 2, p2),
        glow(`${id}-g`, dx, dy, 11, 11, 0, 0.35),
        f(combatDie(dx, dy, 8, 1, 'defence', { rot: 14 })),
        loop(`${id}-l`, dx, dy, 9, hsl(0, 100, 70), 0.6, -100, 300),
        f(line(ax + 3, ay - 4, dx - 9, dy + 3, hsl(hue, 90, 70), 0.3, ' stroke-dasharray=".6 .9"')),
      ];
    },
  },

  'o-cunning': {
    caption: 'a ship with a spare power cell clipped on: one more use of its ability',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.42, 0.56);
      const cell = (x: number, y: number, full: boolean) =>
        `<rect x="${n(x - 2)}" y="${n(y - 4)}" width="4" height="8" rx=".8" fill="${full ? hsl(hue, 90, 58) : hsl(228, 50, 8, 0.6)}" stroke="${hsl(hue, 100, 80)}" stroke-width=".3"/><rect x="${n(x - 1)}" y="${n(y - 5)}" width="2" height="1" fill="${hsl(hue, 100, 80)}"/>`;
      return [
        ship(`${id}-s`, cx, cy, 5.2, 3, p1),
        f(cell(cx + 13, cy - 4, false) + cell(cx + 19, cy - 4, true)),
        glow(`${id}-g`, cx + 19, cy - 4, 5, 6, hue, 0.5),
        f(icon('action', cx + 19, cy - 4, 3, hsl(228, 45, 8), 2.6)),
        f(sparkles(r.fork('sp'), cx + 19, cy - 4, 4, 7, 3)),
      ];
    },
  },

  'o-curious': {
    caption: 'a long, peaceful route past world after world, and not one shot fired',
    draw: ({ id, r, hue, box, p1 }) => {
      const pts = [[0.08, 0.76], [0.3, 0.36], [0.56, 0.7], [0.82, 0.3]].map(([a, b]) => at(box, a, b));
      return [
        world(`${id}-w1`, r.fork('w1'), ...at(box, 0.3, 0.6), 4, 7),
        world(`${id}-w2`, r.fork('w2'), ...at(box, 0.6, 0.38), 5, 8),
        arrowPath(`${id}-p`, `M${n(pts[0][0])} ${n(pts[0][1])}C${n(pts[1][0] - 10)} ${n(pts[1][1])} ${n(pts[1][0] + 8)} ${n(pts[1][1] - 6)} ${n(pts[2][0] - 4)} ${n(pts[2][1])}S${n(pts[3][0] - 8)} ${n(pts[3][1] + 4)} ${n(pts[3][0] - 3)} ${n(pts[3][1] + 1)}`, hsl(hue, 90, 80), { w: 0.4, dash: true }),
        ship(`${id}-s`, ...pts[3], 3.6, 1, p1),
        f(`<g opacity=".85">${icon('combat', ...at(box, 0.12, 0.26), 3.4, hsl(0, 50, 65))}${slash(...at(box, 0.12, 0.26), 2.8)}</g>`),
        f(chip(...at(box, 0.84, 0.72), 3, 'new')),
      ];
    },
  },

  'o-dangerous': {
    caption: 'the defender turns and fires into the attacker at point blank: both go up',
    draw: ({ id, r, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.38, 0.52);
      const [dx, dy] = at(box, 0.6, 0.46);
      return [
        glow(`${id}-g`, (ax + dx) / 2, (ay + dy) / 2, 20, 14, 28, 0.5),
        f(die(ax, ay, 4, 5, p2, { rotate: -15 }) + die(dx, dy, 4, 2, p1, { rotate: 15 })),
        burst(`${id}-b`, (ax + dx) / 2, (ay + dy) / 2, 10, 32, 10, r),
        f(`<circle cx="${n((ax + dx) / 2)}" cy="${n((ay + dy) / 2)}" r="16" fill="none" stroke="${hsl(30, 100, 70)}" stroke-width=".4" stroke-dasharray="2 1"/>`),
        f(sparkles(r.fork('sp'), (ax + dx) / 2, (ay + dy) / 2, 10, 17, 6, hsl(40, 100, 85))),
      ];
    },
  },

  'o-eager': {
    caption: 'a ship deploys and every action chip stays lit: deploying is free',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.36, 0.62);
      const g = iso(cx, cy, 6);
      const [kx, ky] = at(box, 0.76, 0.3);
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.45),
        f(space(g, 0, 0, hue, { a: 0.45 })),
        {
          defs: `<linearGradient id="${id}-col" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 90, 75)}" stop-opacity="0"/><stop offset="1" stop-color="${hsl(hue, 90, 80)}" stop-opacity=".55"/></linearGradient>`,
          body: `<path d="M${n(cx - 3)} ${n(box.y - 2)}H${n(cx + 3)}L${n(cx + 5)} ${n(cy)}H${n(cx - 5)}Z" fill="url(#${id}-col)"/>`,
        },
        shipOn(`${id}-s`, g, 0, 0, 3.8, 6, p1),
        f(sparkles(r.fork('sp'), cx, cy - 5, 3, 7, 3)),
        f(panel(kx - 9.5, ky - 4.5, 19, 9, hue) + chips(kx, ky, 2.9, ['lit', 'lit', 'lit'])),
        f(glyph(kx, ky + 9, '0', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  'o-energetic': {
    caption: "one ship's trail runs through two wrecks and keeps going",
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const pts = [[0.06, 0.8], [0.34, 0.5], [0.62, 0.62], [0.86, 0.3]].map(([a, b]) => at(box, a, b));
      const d = `M${n(pts[0][0])} ${n(pts[0][1])}Q${n(pts[1][0] - 8)} ${n(pts[1][1] + 2)} ${n(pts[1][0])} ${n(pts[1][1])}T${n(pts[2][0])} ${n(pts[2][1])}T${n(pts[3][0] - 3)} ${n(pts[3][1] + 2)}`;
      return [
        arrowPath(`${id}-p`, d, hsl(hue, 90, 80), { w: 0.5 }),
        ...wreck(`${id}-w1`, ...pts[1], 5.5, p2, 24, r.fork('w1')),
        ...wreck(`${id}-w2`, ...pts[2], 5.5, p2, 24, r.fork('w2')),
        ship(`${id}-s`, ...pts[3], 4, 2, p1),
        f(chip(pts[1][0], pts[1][1] - 8, 1.8) + chip(pts[2][0], pts[2][1] - 8, 1.8)),
      ];
    },
  },

  'o-ferocious': {
    caption: 'a ship with weapons hot and shields up, both marked −1',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.54);
      return [
        shield(`${id}-sh`, cx, cy, 11, 11, p1),
        ship(`${id}-s`, cx, cy, 5.2, 6, p1),
        f(`<circle cx="${n(cx - 18)}" cy="${n(cy - 4)}" r="4.6" fill="${hsl(hue, 70, 22)}" stroke="${hsl(hue, 100, 75)}" stroke-width=".35"/>` + icon('combat', cx - 18, cy - 5, 4, hsl(hue, 100, 82)) + glyph(cx - 18, cy + 4, '−1', 2.8, hsl(hue, 100, 85))),
        f(`<circle cx="${n(cx + 18)}" cy="${n(cy - 4)}" r="4.6" fill="${hsl(hue, 70, 22)}" stroke="${hsl(hue, 100, 75)}" stroke-width=".35"/>` + icon('shield', cx + 18, cy - 5, 4, hsl(hue, 100, 82)) + glyph(cx + 18, cy + 4, '−1', 2.8, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), cx, cy, 11, 14, 3)),
      ];
    },
  },

  'o-flexible': {
    caption: 'a ship turned one face round, and the action panel untouched',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.38, 0.52);
      return [
        f(dial(cx, cy, 10, hue, 24, 4)),
        arrowPath(`${id}-tw`, `M${n(cx - 8)} ${n(cy - 9)}A12 12 0 0 1 ${n(cx + 9)} ${n(cy - 8)}`, hsl(hue, 100, 82), { w: 0.6 }),
        ship(`${id}-s`, cx, cy, 4.4, 3, p1),
        f(glyph(cx + 14, cy - 11, '±1', 3.6, hsl(hue, 100, 85))),
        f(freeChip(...at(box, 0.82, 0.38), 3.4)),
        f(sparkles(r.fork('sp'), cx, cy, 11, 14, 3)),
      ];
    },
  },

  'o-ingenious': {
    caption: 'ships on all four corners of a planet beam in to build',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.56);
      const g = iso(cx, cy, 6.4);
      const corners: [number, number][] = [[-1, -1], [-1, 1], [1, -1]];
      const top = g.y(0, 0) - 7;
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.4),
        f(corners.map(([i, j]) => space(g, i, j, hue, { a: 0.4 })).join('')),
        shipOn(`${id}-s0`, g, -1, -1, 3.2, 3, p1),
        ...worldOn(`${id}-w`, r.fork('w'), g, 0, 0, 5, hue, 10),
        ...corners.slice(1).flatMap(([i, j], k) => beam(`${id}-b${k}`, g.x(i, j), g.y(i, j) - 4, g.x(0, 0) + (i - j) * 0.6, top + 2, hue, 0.6)),
        shipOn(`${id}-s1`, g, -1, 1, 3.2, 2, p1),
        shipOn(`${id}-s2`, g, 1, -1, 3.2, 5, p1),
        f(cube(g.x(0, 0), top, 2.2, p1)),
        f(sparkles(r.fork('sp'), g.x(0, 0), top, 2, 5, 3)),
      ];
    },
  },

  'o-intelligent': {
    caption: 'a 9 on the planet ruler, with a bracket spanning 8 to 10',
    draw: ({ id, r, hue, box }) => {
      const [x0, y] = at(box, 0.14, 0.72);
      let ruler = line(x0, y, x0 + 44, y, hsl(hue, 70, 60), 0.35);
      [6, 7, 8, 9, 10, 11].forEach((v, k) => {
        const x = x0 + 2 + k * 8;
        ruler += line(x, y, x, y - (v === 9 ? 3 : 2), hsl(hue, 80, 70), 0.3) + glyph(x, y + 3.2, String(v), 2.4, hsl(hue, 100, v >= 8 && v <= 10 ? 85 : 55));
      });
      const x8 = x0 + 2 + 2 * 8;
      const x10 = x0 + 2 + 4 * 8;
      return [
        world(`${id}-w`, r.fork('w'), x0 + 26, y - 17, 8, 9),
        f(glyph(x0 + 26, y - 16.6, '9', 5, '#fff')),
        f(ruler),
        f(`<path d="M${n(x8)} ${n(y - 4)}V${n(y - 6)}H${n(x10)}V${n(y - 4)}" fill="none" stroke="${hsl(hue, 100, 82)}" stroke-width=".5"/>`),
        f(`<rect x="${n(x8 - 2)}" y="${n(y - 1)}" width="${n(x10 - x8 + 4)}" height="6" rx="1" fill="${hsl(hue, 90, 60, 0.18)}"/>`),
      ];
    },
  },

  'o-nomadic': {
    caption: 'two orbits touching, and a ship sliding along the figure-eight between them',
    draw: ({ id, r, hue, box, p1 }) => {
      const [ax, ay] = at(box, 0.3, 0.54);
      const [bx, by] = at(box, 0.72, 0.54);
      const eight = `M${n(ax)} ${n(ay - 9)}C${n(ax + 18)} ${n(ay - 9)} ${n(bx - 18)} ${n(by + 9)} ${n(bx)} ${n(by + 9)}C${n(bx + 14)} ${n(by + 9)} ${n(bx + 14)} ${n(by - 9)} ${n(bx)} ${n(by - 9)}`;
      return [
        f(orbit(ax, ay, 11, 9, hue, 0.5) + orbit(bx, by, 11, 9, hue, 0.5)),
        world(`${id}-a`, r.fork('a'), ax, ay, 6, 8),
        world(`${id}-b`, r.fork('b'), bx, by, 6.5, 9),
        arrowPath(`${id}-p`, eight, hsl(hue, 100, 82), { w: 0.45 }),
        ship(`${id}-s`, bx + 11, by - 1, 3.2, 1, p1),
      ];
    },
  },

  'o-plundering': {
    caption: 'a wreck pours its glow into a research flask, three marks up',
    draw: ({ id, r, box, p2 }) => {
      const [wx, wy] = at(box, 0.24, 0.42);
      const [fx, fy] = at(box, 0.66, 0.56);
      const s = 0.75;
      const body = `M${n(fx - 3 * s)} ${n(fy - 14 * s)}V${n(fy - 6 * s)}L${n(fx - 10 * s)} ${n(fy + 8 * s)}Q${n(fx - 11 * s)} ${n(fy + 11 * s)} ${n(fx - 8 * s)} ${n(fy + 11 * s)}H${n(fx + 8 * s)}Q${n(fx + 11 * s)} ${n(fy + 11 * s)} ${n(fx + 10 * s)} ${n(fy + 8 * s)}L${n(fx + 3 * s)} ${n(fy - 6 * s)}V${n(fy - 14 * s)}`;
      return [
        ...wreck(`${id}-w`, wx, wy, 7, p2, RESEARCH, r.fork('w')),
        f(die(wx, wy, 2.8, 4, p2, { opacity: 0.45, rotate: 20 })),
        f(motes(r.fork('m'), wx + 4, wy, fx, fy - 11, 14, RESEARCH, 2)),
        {
          defs: `<clipPath id="${id}-cl"><path d="${body}Z"/></clipPath>`,
          body: `<g clip-path="url(#${id}-cl)"><rect x="${n(fx - 10)}" y="${n(fy)}" width="20" height="12" fill="${hsl(RESEARCH, 90, 55, 0.75)}"/></g>`,
        },
        f(`<path d="${body}" fill="none" stroke="${hsl(RESEARCH, 60, 88)}" stroke-width=".45" stroke-linejoin="round"/>`),
        f(glyph(fx + 12, fy + 2, '+3', 4.4, hsl(RESEARCH, 100, 85))),
      ];
    },
  },

  'o-precocious': {
    caption: 'a ladder of research rungs: the card hangs at rung 4, not at the top',
    draw: ({ id, r, hue, box }) => {
      const [x, base] = at(box, 0.3, 0.9);
      let ladder = line(x - 5, base, x - 5, base - 29, hsl(RESEARCH, 60, 65), 0.4) + line(x + 5, base, x + 5, base - 29, hsl(RESEARCH, 60, 65), 0.4);
      for (let k = 1; k <= 6; k++) {
        const y = base - k * 4.5;
        ladder += line(x - 5, y, x + 5, y, hsl(RESEARCH, 100, k <= 4 ? 80 : 50), k <= 4 ? 0.5 : 0.3) + glyph(x - 9, y, String(k), 2.4, hsl(RESEARCH, 100, k === 4 ? 88 : 60));
      }
      const y4 = base - 4 * 4.5;
      return [
        f(ladder),
        glow(`${id}-g`, x, y4, 7, 3, RESEARCH, 0.7),
        arrowPath(`${id}-ar`, `M${n(x + 6)} ${n(y4)}H${n(x + 15)}`, hsl(RESEARCH, 100, 85), { w: 0.4 }),
        miniCard(`${id}-c`, x + 22, y4, 10, hue, { icon: 'card', state: 'glow', rot: 6 }),
        f(sparkles(r.fork('sp'), x + 22, y4, 7, 10, 3)),
      ];
    },
  },

  'o-rational': {
    caption: 'every combat die comes up 3',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      return [
        glow(`${id}-g`, cx, cy, 24, 10, hue, 0.3),
        f([-14, 0, 14].map((dx, i) => combatDie(cx + dx, cy + (i === 1 ? -2 : 1), 8, 3, i === 1 ? 'defence' : 'attack', { rot: [-8, 0, 8][i] })).join('')),
        f(line(cx - 22, cy + 8, cx + 22, cy + 8, hsl(hue, 80, 70), 0.3, ' stroke-dasharray="1 1"')),
        ship(`${id}-s`, cx, cy + 13, 2.4, 3, p1, { opacity: 0.7 }),
      ];
    },
  },

  'o-ravenous': {
    caption: 'the double edge: +2 dominance for a kill, −2 for a loss',
    draw: ({ id, r, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.25, 0.55);
      const [bx, by] = at(box, 0.75, 0.55);
      return [
        f(line(...at(box, 0.5, 0.15), ...at(box, 0.5, 0.85), hsl(DOMINANCE, 60, 70), 0.25, ' stroke-dasharray="1 1"')),
        ...wreck(`${id}-a`, ax, ay, 7, p2, DOMINANCE, r.fork('a')),
        f(die(ax, ay, 3.2, 4, p2, { opacity: 0.45 })),
        ...wreck(`${id}-b`, bx, by, 7, p1, 0, r.fork('b')),
        f(die(bx, by, 3.2, 2, p1, { opacity: 0.45 })),
        f(glyph(ax, ay - 12, '+2', 5.2, hsl(DOMINANCE, 100, 75)) + glyph(bx, by - 12, '−2', 5.2, hsl(0, 70, 70))),
        f(icon('dominance', ax, ay + 10, 3.6, hsl(DOMINANCE, 100, 75)) + icon('dominance', bx, by + 10, 3.6, hsl(0, 50, 60))),
      ];
    },
  },

  'o-relentless': {
    caption: "the enemy's shot lands, and your ship fires once more in answer",
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.2, 0.62);
      const [ex, ey] = at(box, 0.8, 0.36);
      return [
        ...beam(`${id}-in`, ex - 2, ey + 2, ax + 3, ay - 1, p2, 0.7),
        burst(`${id}-h`, ax + 3, ay - 1, 3.4, p2, 6, r),
        ship(`${id}-a`, ax, ay, 4.4, 4, p1),
        ...beam(`${id}-out`, ax + 3, ay - 4, ex - 2, ey - 1, hue, 1.3),
        ship(`${id}-e`, ex, ey, 4, 3, p2),
        burst(`${id}-x`, ex - 2, ey - 1, 6, hue, 8, r),
        loop(`${id}-l`, ...at(box, 0.5, 0.2), 3.6, hsl(hue, 100, 82), 0.45),
      ];
    },
  },

  'o-resourceful': {
    caption: 'a loop of three arrows: ship to scrapyard, reroll, and an action back',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      const R = 13;
      const nodes = [-90, 30, 150].map((a) => [cx + Math.cos((a * Math.PI) / 180) * R * 1.2, cy + Math.sin((a * Math.PI) / 180) * R] as const);
      return [
        ...[0, 1, 2].map((k) => {
          const a0 = (-90 + k * 120 + 22) * (Math.PI / 180);
          const a1 = (-90 + (k + 1) * 120 - 22) * (Math.PI / 180);
          return arrowPath(`${id}-a${k}`, `M${n(cx + Math.cos(a0) * R * 1.2)} ${n(cy + Math.sin(a0) * R)}A${n(R * 1.2)} ${R} 0 0 1 ${n(cx + Math.cos(a1) * R * 1.2)} ${n(cy + Math.sin(a1) * R)}`, hsl(hue, 90, 80), { w: 0.5 });
        }),
        ship(`${id}-s`, ...nodes[0], 3.4, 4, p1),
        f(scrapyard(nodes[1][0], nodes[1][1] + 1, 9, 5, hue) + die(nodes[1][0], nodes[1][1] - 1, 1.8, 2, p1, { rotate: 20 })),
        f(chip(...nodes[2], 3.4, 'new')),
        f(sparkles(r.fork('sp'), cx, cy, 2, 6, 3)),
      ];
    },
  },

  'o-righteous': {
    caption: 'the dominance crest chained to an anchor: losses cannot drag it down',
    draw: ({ id, box }) => {
      const [cx, cy] = at(box, 0.5, 0.3);
      const ay = cy + 17;
      let chain = '';
      for (let k = 0; k < 6; k++) chain += `<ellipse cx="${n(cx)}" cy="${n(cy + 4 + k * 2.2)}" rx="${k % 2 ? 0.5 : 0.9}" ry="1.2" fill="none" stroke="${hsl(220, 15, 75)}" stroke-width=".35"/>`;
      return [
        glow(`${id}-g`, cx, cy, 8, 8, DOMINANCE, 0.5),
        f(crest(cx, cy, 4.4)),
        f(chain),
        f(`<path d="M${n(cx)} ${n(ay - 3)}V${n(ay + 5)}M${n(cx - 3)} ${n(ay - 1)}H${n(cx + 3)}M${n(cx - 6)} ${n(ay + 1)}Q${n(cx - 5)} ${n(ay + 6)} ${n(cx)} ${n(ay + 6)}Q${n(cx + 5)} ${n(ay + 6)} ${n(cx + 6)} ${n(ay + 1)}" fill="none" stroke="${hsl(220, 20, 80)}" stroke-width=".8" stroke-linecap="round"/><circle cx="${n(cx)}" cy="${n(ay - 4.2)}" r="1.2" fill="none" stroke="${hsl(220, 20, 80)}" stroke-width=".5"/>`),
        f(glyph(cx + 14, cy, '−0', 4.4, hsl(DOMINANCE, 100, 78))),
      ];
    },
  },

  'o-scrappy': {
    caption: 'every roll of your turn gets a second chance: ships and weapons alike',
    draw: ({ id, hue, box, p1 }) => {
      const out: Fragment[] = [];
      const spots = [[0.2, 0.42, 'ship', 2], [0.5, 0.6, 'combat', 4], [0.8, 0.4, 'ship', 5], [0.36, 0.78, 'combat', 1], [0.68, 0.82, 'ship', 3]] as const;
      spots.forEach(([fx, fy, kind, v], k) => {
        const [x, y] = at(box, fx, fy);
        out.push(kind === 'ship' ? ship(`${id}-s${k}`, x, y, 3.4, v, p1) : f(combatDie(x, y, 5.5, v, 'attack', { rot: (k - 2) * 8 })));
        out.push(loop(`${id}-l${k}`, x, y, kind === 'ship' ? 6.5 : 5.5, hsl(hue, 90, 80), 0.35, k * 40, 270));
      });
      return out;
    },
  },

  'o-stealthy': {
    caption: 'the board crowded on one side, and a lone ship landing in the empty half',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.56);
      const g = iso(cx, cy, 5);
      const crowd: [number, number, number][] = [[2, -2, p2], [3, -1, p2], [2, 0, p1], [3, 1, p2], [1, -3, p2]];
      return [
        grid(`${id}-g`, g, -3, 3, -3, 3, hue, 0.4),
        ...crowd.map(([i, j, h], k) => shipOn(`${id}-c${k}`, g, i, j, 2.6, k + 1, h, { opacity: 0.7 })),
        f(space(g, -2, 2, hue, { a: 0.5, light: 72 })),
        pillar(`${id}-p`, g.x(-2, 2), box.y - 2, g.y(-2, 2), hue, 1.6, 0.5),
        shipOn(`${id}-s`, g, -2, 2, 3.2, 6, p1),
        f(sparkles(r.fork('sp'), g.x(-2, 2), g.y(-2, 2) - 3, 2, 6, 4)),
      ];
    },
  },

  'o-strategic': {
    caption: 'ships packed side by side, each one carrying a −2',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.54);
      const g = iso(cx, cy, 6.2);
      const cells: [number, number][] = [[0, 0], [1, 0], [0, 1], [-1, 0]];
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.35),
        f(cells.map(([i, j]) => space(g, i, j, hue, { a: 0.3 })).join('')),
        ...cells.map(([i, j], k) => shipOn(`${id}-s${k}`, g, i, j, 3.2, [4, 2, 6, 3][k], p1)),
        f(cells.map(([i, j]) => glyph(g.x(i, j) + 4, g.y(i, j) - 7, '−2', 2.4, hsl(hue, 100, 82))).join('')),
      ];
    },
  },

  'o-stubborn': {
    caption: "the defender's shield turns the shot back on the attacker",
    draw: ({ id, r, box, p1, p2 }) => {
      const [dx, dy] = at(box, 0.7, 0.52);
      const [ax, ay] = at(box, 0.2, 0.36);
      const hx = dx - 8.5;
      const hy = dy - 1.5;
      return [
        ...beam(`${id}-in`, ax + 2, ay + 1, hx, hy, p2, 0.9),
        ...beam(`${id}-out`, hx, hy, ax + 1.5, ay + 1.5, p1, 0.9),
        shield(`${id}-sh`, dx, dy, 9.5, 10, p1),
        ship(`${id}-d`, dx, dy, 4.6, 4, p1),
        burst(`${id}-hit`, hx, hy, 4.5, p1, 6, r),
        ...wreck(`${id}-w`, ax, ay, 6, p2, 20, r.fork('w')),
        f(die(ax, ay, 3.2, 4, p2, { opacity: 0.5, rotate: -10 })),
      ];
    },
  },

  'o-tactical': {
    caption: 'a free nudge: any ship slides one space, even into an enemy',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.54);
      const g = iso(cx, cy, 7);
      const nbrs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.4),
        f(nbrs.map(([i, j]) => space(g, i, j, hue, { a: i === 1 ? 0.45 : 0.14, dash: i !== 1 })).join('')),
        shipOn(`${id}-e`, g, 1, 0, 3.6, 3, p2),
        burst(`${id}-x`, g.x(1, 0), g.y(1, 0) - 2.5, 6, 352, 7, r),
        shipOn(`${id}-s`, g, 0, 0, 3.8, 6, p1),
        arrowPath(`${id}-a`, `M${n(g.x(0, 0) + 2)} ${n(g.y(0, 0) - 8)}Q${n((g.x(0, 0) + g.x(1, 0)) / 2 + 1)} ${n(g.y(0, 0) - 11)} ${n(g.x(1, 0))} ${n(g.y(1, 0) - 7)}`, hsl(hue, 100, 85), { w: 0.55 }),
        f(freeChip(...at(box, 0.15, 0.3), 3.2)),
      ];
    },
  },

  'o-tyrannical': {
    caption: 'a drop of research poured from the flask hardens into a dominance crest',
    draw: ({ id, r, box }) => {
      const [fx, fy] = at(box, 0.28, 0.4);
      const [cx, cy] = at(box, 0.66, 0.66);
      return [
        glow(`${id}-fg`, fx, fy, 8, 8, RESEARCH, 0.5),
        f(`<g transform="rotate(50 ${n(fx)} ${n(fy)})">${icon('research', fx, fy, 10, hsl(RESEARCH, 100, 85), 2)}</g>`),
        f(`<path d="M${n(fx + 6)} ${n(fy + 1)}Q${n(cx - 4)} ${n(fy)} ${n(cx)} ${n(cy - 6)}" fill="none" stroke="${hsl(RESEARCH, 100, 75)}" stroke-width=".8" stroke-linecap="round"/>`),
        glow(`${id}-cg`, cx, cy, 7, 7, DOMINANCE, 0.6),
        f(crest(cx, cy, 4.2)),
        f(glyph(fx, fy + 11, '−1', 3.8, hsl(RESEARCH, 100, 85)) + glyph(cx + 10, cy, '+1', 4, hsl(DOMINANCE, 100, 78))),
        f(sparkles(r.fork('sp'), cx, cy, 4, 7, 3)),
      ];
    },
  },

  'o-warlike': {
    caption: 'standing over the wreckage, a ship powers up for another action',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [wx, wy] = at(box, 0.36, 0.68);
      const [sx, sy] = at(box, 0.62, 0.5);
      return [
        ...wreck(`${id}-w`, wx, wy, 7, p2, 20, r.fork('w')),
        f(die(wx, wy, 3, 1, p2, { opacity: 0.4, rotate: 40 })),
        glow(`${id}-aura`, sx, sy, 10, 10, hue, 0.45),
        ship(`${id}-s`, sx, sy, 5, 6, p1),
        f(chip(sx, sy - 13, 3.6, 'new')),
        arrowPath(`${id}-up`, `M${n(sx)} ${n(sy - 6.5)}V${n(sy - 8.6)}`, hsl(hue, 100, 85), { w: 0.4 }),
        f(sparkles(r.fork('sp'), sx, sy - 6, 6, 12, 4)),
      ];
    },
  },

  // Gambits

  'o-aggression': {
    caption: 'a fleet raises the dominance crest before a world: dominance +2',
    draw: ({ id, r, box, p1 }) => {
      const [px, py] = at(box, 0.7, 0.8);
      const fleet = [[0.14, 0.7], [0.3, 0.8], [0.26, 0.56]];
      const fx = px - 4;
      const fy = py - 8;
      return [
        world(`${id}-w`, r.fork('w'), px, py, 10, 10),
        ...fleet.map(([a, b], k) => ship(`${id}-s${k}`, ...at(box, a, b), 3.6, [5, 3, 6][k], p1)),
        glow(`${id}-fg`, fx + 5, fy - 7, 10, 9, DOMINANCE, 0.55),
        f(crest(fx + 5, fy - 7, 5.5)),
        f(glyph(...at(box, 0.3, 0.34), '+2', 7, hsl(DOMINANCE, 100, 75))),
        f(sparkles(r.fork('sp'), fx + 5, fy - 7, 6, 12, 4)),
      ];
    },
  },

  'o-expansion': TACTIC_SCENES.expansion,

  'o-momentum': {
    caption: 'a ship slingshots through a time ring into a second, shorter turn',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.46, 0.5);
      let ring = '';
      for (let i = 0; i < 3; i++) ring += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(8 - i * 1.4)}" ry="${n(15 - i * 2.4)}" fill="none" stroke="${hsl(hue + i * 10, 95, 65 + i * 8)}" stroke-width="${n(0.8 - i * 0.2)}" transform="rotate(-18 ${n(cx)} ${n(cy)})"/>`;
      const [kx, ky] = at(box, 0.82, 0.78);
      return [
        glow(`${id}-g`, cx, cy, 12, 17, hue, 0.4),
        ...trails(`${id}-t`, r.fork('t'), cx + 9, cy - 1, 1, -0.1, 24, 2, hsl(hue, 90, 75), 6),
        f(ring),
        ship(`${id}-s`, cx + 11, cy - 1.5, 4.4, 2, p1),
        f(chips(kx, ky, 2.4, ['lit', 'lit'])),
        f(sparkles(r.fork('sp'), cx, cy, 10, 16, 5)),
      ];
    },
  },

  'o-reorganization': {
    caption: 'rerolled ships sorted into two bins: orbit at your worlds, or the scrapyard',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.26);
      const [px, py] = at(box, 0.22, 0.7);
      const [yx, yy] = at(box, 0.78, 0.74);
      return [
        loop(`${id}-l`, cx, cy, 7, hsl(hue, 90, 80), 0.4),
        f(die(cx - 3, cy, 2, 4, p1, { rotate: 20 }) + die(cx + 3, cy + 1, 2, 1, p1, { rotate: -15 }) + die(cx, cy - 3, 2, 6, p1)),
        f(orbit(px, py, 11, 5.5, hue)),
        world(`${id}-w`, r.fork('w'), px, py, 6.5),
        f(cube(px + 2, py - 5.5, 1.8, p1)),
        ship(`${id}-a`, px + 11, py, 2.8, 4, p1),
        ship(`${id}-b`, px - 10, py + 2, 2.8, 6, p1),
        f(scrapyard(yx, yy, 14, 7, hue) + die(yx, yy - 2, 2.2, 1, p1)),
        arrowPath(`${id}-a1`, `M${n(cx - 8)} ${n(cy + 3)}Q${n(px + 4)} ${n(cy + 2)} ${n(px + 4)} ${n(py - 8)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }),
        arrowPath(`${id}-a2`, `M${n(cx + 8)} ${n(cy + 3)}Q${n(yx)} ${n(cy + 2)} ${n(yx)} ${n(yy - 5)}`, hsl(hue, 70, 70), { w: 0.3, dash: true }),
      ];
    },
  },

  'o-relocation': {
    caption: "a ghost cube where it used to stand, and the cube planted on a world they didn't hold",
    draw: ({ id, r, hue, box, p2 }) => {
      const [ax, ay] = at(box, 0.28, 0.6);
      const [bx, by] = at(box, 0.74, 0.5);
      return [
        world(`${id}-a`, r.fork('a'), ax, ay, 8, 8),
        world(`${id}-b`, r.fork('b'), bx, by, 8, 10),
        f(cube(ax + 1, ay - 8, 2.4, p2, { ghost: true })),
        arrowPath(`${id}-ar`, `M${n(ax + 6)} ${n(ay - 9)}Q${n((ax + bx) / 2)} ${n(ay - 18)} ${n(bx - 4)} ${n(by - 9)}`, hsl(hue, 90, 82), { w: 0.4 }),
        glow(`${id}-g`, bx + 1, by - 8, 4, 4, p2, 0.7),
        f(cube(bx + 1, by - 8, 2.4, p2)),
      ];
    },
  },

  'o-sabotage': {
    caption: "an opponent's Command card torn in half",
    draw: ({ id, r, hue, box, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.52);
      const left = miniCard(`${id}-l`, cx - 2, cy, 14, p2, { icon: 'action' });
      const right = miniCard(`${id}-r`, cx + 2, cy, 14, p2, { icon: 'action' });
      const tear = `M${n(cx)} ${n(cy - 11)}L${n(cx - 1.2)} ${n(cy - 6)}L${n(cx + 1)} ${n(cy - 2)}L${n(cx - 1)} ${n(cy + 3)}L${n(cx + 1.2)} ${n(cy + 7)}L${n(cx)} ${n(cy + 11)}`;
      return [
        {
          defs: left.defs + right.defs + `<clipPath id="${id}-cl"><path d="${tear}L${n(cx - 20)} ${n(cy + 11)}L${n(cx - 20)} ${n(cy - 11)}Z"/></clipPath><clipPath id="${id}-cr"><path d="${tear}L${n(cx + 20)} ${n(cy + 11)}L${n(cx + 20)} ${n(cy - 11)}Z"/></clipPath>`,
          body:
            `<g transform="rotate(-12 ${n(cx - 2)} ${n(cy + 10)}) translate(-3 1)"><g clip-path="url(#${id}-cl)">${left.body}</g></g>` +
            `<g transform="rotate(11 ${n(cx + 2)} ${n(cy + 10)}) translate(3 -1)"><g clip-path="url(#${id}-cr)">${right.body}</g></g>`,
        },
        burst(`${id}-x`, cx, cy - 2, 7, hue, 8, r),
        f(sparkles(r.fork('sp'), cx, cy, 3, 12, 7, hsl(hue, 100, 80))),
      ];
    },
  },
};
