import { hsl, n, type Fragment } from '../svg';
import {
  arrowPath, at, beam, burst, chip, chips, combatDie, cube, die, DOMINANCE, f, glow, glyph, grid, icon, iso, line, loop, miniCard,
  panel, RESEARCH, route, scrapyard, shield, ship, shipOn, slash, space, sparkles, track, trackSlot, trails, world, worldOn, wreck,
} from '../cardkit';
import type { Illustration } from '../illustrations';

/**
 * The original (2013) Command and Gambit cards. Where one does the same as a Community Edition card,
 * it shows the same idea from another angle, so no two cards share a picture.
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
    caption: 'the bigger fleet on the map takes an extra action',
    draw: ({ id, hue, box, p1, p2 }) => {
      const mine = [[0.12, 0.56], [0.26, 0.48], [0.2, 0.72], [0.36, 0.66], [0.32, 0.86]];
      const theirs = [[0.8, 0.6], [0.9, 0.76]];
      const [kx, ky] = at(box, 0.6, 0.3);
      return [
        ...theirs.map(([a, b], k) => ship(`${id}-e${k}`, at(box, a, b)[0], at(box, a, b)[1], 3, k + 2, p2, { opacity: 0.75 })),
        ...mine.map(([a, b], k) => ship(`${id}-m${k}`, at(box, a, b)[0], at(box, a, b)[1], 3.4, [6, 4, 5, 3, 2][k], p1)),
        f(glyph(at(box, 0.48, 0.66)[0], at(box, 0.48, 0.66)[1], '>', 6, hsl(hue, 100, 85))),
        glow(`${id}-cg`, kx, ky, 9, 9, hue, 0.5),
        f(chip(kx, ky, 4.4, hue, 'new') + glyph(kx + 9, ky, '+1', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  'o-brilliant': {
    caption: 'a research station in orbit, adding two to research every turn',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.36, 0.55);
      let rings = '';
      [-22, 26, 62].forEach((t, i) => {
        rings += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(12.5 + i * 2)}" ry="${n(4 + i)}" fill="none" stroke="${hsl(hue, 85, 72)}" stroke-width=".3" opacity=".7" transform="rotate(${n(t)} ${n(cx)} ${n(cy)})"/>`;
      });
      const [tx, ty] = at(box, 0.6, 0.42);
      return [
        world(`${id}-w`, r.fork('w'), cx, cy, 7, 8),
        f(rings),
        f(sparkles(r.fork('sp'), cx, cy, 14, 18, 4)),
        f(`<g transform="translate(${n(cx + 12)} ${n(cy - 6)}) rotate(-20)"><rect x="-3.5" y="-.6" width="7" height="1.2" fill="${hsl(hue, 60, 70)}"/><rect x="-1" y="-1.4" width="2" height="2.8" rx=".4" fill="#fff"/></g>`),
        f(icon('research', tx + 6, ty, 8, hsl(RESEARCH, 100, 82), 2) + glyph(tx + 14, ty + 1, '+2', 5, hsl(RESEARCH, 100, 85), 'start')),
      ];
    },
  },

  'o-cerebral': {
    caption: 'a dominance cube dissolved into three sparks of research',
    draw: ({ id, r, box }) => {
      const [ax, ay] = at(box, 0.24, 0.48);
      const [bx, by] = at(box, 0.72, 0.44);
      const orbs = [[0, -7], [6, 4], [-6, 4]];
      let motes = '';
      const rr = r.fork('m');
      for (let i = 0; i < 16; i++) {
        const t = rr.range(0.15, 0.85);
        motes += `<circle cx="${n(ax + (bx - ax) * t)}" cy="${n(ay + (by - ay) * t + Math.sin(t * 9) * 3)}" r="${n(rr.range(0.2, 0.55))}" fill="${hsl(t > 0.5 ? RESEARCH : DOMINANCE, 100, 80)}" opacity="${n(0.4 + rr.next() * 0.6)}"/>`;
      }
      return [
        glow(`${id}-a`, ax, ay, 9, 9, DOMINANCE, 0.4),
        f(cube(ax, ay, 4.5, DOMINANCE, { opacity: 0.85 })),
        f(motes),
        ...orbs.map(([dx, dy], k) => glow(`${id}-o${k}`, bx + dx, by + dy, 4, 4, RESEARCH, 0.8, 70)),
        f(orbs.map(([dx, dy]) => `<circle cx="${n(bx + dx)}" cy="${n(by + dy)}" r="1.4" fill="${hsl(RESEARCH, 100, 88)}"/>`).join('') + icon('research', bx, by, 4.5, hsl(RESEARCH, 100, 85))),
        f(glyph(ax, ay + 10, '−1', 4, hsl(DOMINANCE, 100, 75)) + glyph(bx, by + 12, '+3', 4, hsl(RESEARCH, 100, 85))),
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
        f(chip(kx, ky, 4, hue, 'new')),
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
        f(combatDie(dx, dy, 8, 1, p2, { rot: 14 })),
        loop(`${id}-l`, dx, dy, 9, hsl(0, 100, 70), 0.6, -100, 300),
        f(line(ax + 3, ay - 4, dx - 9, dy + 3, hsl(hue, 90, 70), 0.3, ' stroke-dasharray=".6 .9"')),
      ];
    },
  },

  'o-cunning': {
    caption: "a ship and its holographic double: one ability, used twice",
    draw: ({ id, r, hue, box, p1 }) => {
      const [ax, ay] = at(box, 0.32, 0.58);
      const [bx, by] = at(box, 0.66, 0.46);
      return [
        ...trails(`${id}-t`, r.fork('t'), bx - 2, by + 1, 1, -0.35, 12, 1.5, hsl(hue, 90, 80), 4),
        ship(`${id}-a`, ax, ay, 5, 3, p1),
        glow(`${id}-gb`, bx, by, 8, 8, hue, 0.4),
        f(die(bx, by, 5, 3, hue, { opacity: 0.55 }) + die(bx, by, 5, 3, hue, { ghost: true })),
        f(`<path d="M${n(ax)} ${n(ay - 8)}l${n(4.33)} 2.5l${n(-4.33)} 2.5l${n(-4.33)} -2.5z" fill="${hsl(hue, 90, 70, 0.25)}" stroke="${hsl(hue, 90, 80)}" stroke-width=".25" transform="translate(0 -3)"/>`),
        f(`<path d="M${n(bx)} ${n(by - 8)}l${n(4.33)} 2.5l${n(-4.33)} 2.5l${n(-4.33)} -2.5z" fill="${hsl(hue, 90, 70, 0.25)}" stroke="${hsl(hue, 90, 80)}" stroke-width=".25" transform="translate(0 -3)"/>`),
        f(glyph(at(box, 0.85, 0.22)[0], at(box, 0.85, 0.22)[1], '×2', 5.6, hsl(hue, 100, 85))),
      ];
    },
  },

  'o-curious': {
    caption: 'weapons stowed, a ship takes a long free cruise across the map',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.54);
      const g = iso(cx, cy, 5);
      const path: [number, number][] = [[2, 2], [1, 2], [0, 2], [-1, 2], [-1, 1], [-1, 0], [-1, -1], [-1, -2]];
      return [
        grid(`${id}-g`, g, -3, 3, -3, 3, hue, 0.4),
        f(path.slice(1).map(([i, j]) => space(g, i, j, hue, { a: 0.18, stroke: false })).join('')),
        route(`${id}-r`, g, path, hsl(hue, 90, 80), { dash: true, lift: 0.8 }),
        shipOn(`${id}-s`, g, -1, -2, 3.6, 1, p1),
        f(chip(at(box, 0.8, 0.3)[0], at(box, 0.8, 0.3)[1], 3.6, hue, 'new') + slash(at(box, 0.2, 0.3)[0], at(box, 0.2, 0.3)[1], 3.6) + icon('combat', at(box, 0.2, 0.3)[0], at(box, 0.2, 0.3)[1], 3.6, hsl(0, 60, 70))),
      ];
    },
  },

  'o-dangerous': {
    caption: 'the defender rams its attacker head-on: both ships break apart',
    draw: ({ id, r, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      return [
        ...trails(`${id}-ta`, r.fork('ta'), cx - 8, cy + 2, 1, -0.2, 16, 1.6, hsl(p2, 90, 70), 4),
        ...trails(`${id}-tb`, r.fork('tb'), cx + 8, cy - 2, -1, 0.2, 16, 1.6, hsl(p1, 90, 70), 4),
        f(die(cx - 8.5, cy + 2.4, 3.8, 5, p2, { rotate: -30 }) + die(cx + 8.5, cy - 2.4, 3.8, 3, p1, { rotate: 25 })),
        ...wreck(`${id}-x`, cx, cy, 14, p1, 30, r.fork('x')),
        f(sparkles(r.fork('sp'), cx, cy, 10, 18, 6, hsl(40, 100, 85))),
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
        f(panel(kx - 9.5, ky - 4.5, 19, 9, hue) + chips(kx, ky, 2.9, hue, ['lit', 'lit', 'lit'])),
        f(glyph(kx, ky + 9, '0', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  'o-energetic': {
    caption: 'one ship strikes, moves on, and strikes again',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.52);
      const g = iso(cx, cy + 2, 5.6);
      return [
        grid(`${id}-g`, g, -3, 3, -3, 3, hue, 0.4),
        route(`${id}-r1`, g, [[2, 2], [1, 2], [0, 2], [0, 1]], hsl(hue, 90, 78), { lift: 1 }),
        route(`${id}-r2`, g, [[0, 1], [0, 0], [-1, 0], [-1, -1], [-1, -2]], hsl(hue, 90, 84), { lift: 1 }),
        ...wreck(`${id}-w1`, g.x(0, 1), g.y(0, 1) - 2, 5, p2, 20, r.fork('w1')),
        shipOn(`${id}-g1`, g, 0, 1, 3.2, 2, p1, { ghost: true }),
        ...wreck(`${id}-w2`, g.x(-1, -2), g.y(-1, -2) - 2, 6, p2, 20, r.fork('w2')),
        shipOn(`${id}-s`, g, -1, -2, 3.6, 2, p1),
        f(chip(g.x(0, 1) + 6, g.y(0, 1), 1.8, hue) + chip(g.x(-1, -2) + 7, g.y(-1, -2), 1.8, hue)),
      ];
    },
  },

  'o-ferocious': {
    caption: 'weapons and defences alike roll one lower',
    draw: ({ id, r, hue, box, p1 }) => {
      const [ax, ay] = at(box, 0.3, 0.5);
      const [bx, by] = at(box, 0.7, 0.5);
      return [
        glow(`${id}-g`, (ax + bx) / 2, ay, 22, 12, hue, 0.3),
        f(icon('combat', ax, ay - 10, 4, hsl(hue, 90, 80)) + icon('shield', bx, by - 10, 4, hsl(hue, 90, 80))),
        f(combatDie(ax, ay, 8, 3, hue, { rot: -8 }) + combatDie(bx, by, 8, 4, hue, { rot: 7 })),
        f(glyph(ax, ay + 9.5, '−1', 4.2, hsl(hue, 100, 80)) + glyph(bx, by + 9.5, '−1', 4.2, hsl(hue, 100, 80))),
        ship(`${id}-s`, (ax + bx) / 2, ay + 4, 2.6, 6, p1, { opacity: 0.6 }),
        f(sparkles(r.fork('sp'), (ax + bx) / 2, ay, 14, 20, 3)),
      ];
    },
  },

  'o-flexible': {
    caption: 'a ship number turned like a dial ring: plus one or minus one',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.52);
      let ticks = '';
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        ticks += line(cx + Math.cos(a) * 12, cy + Math.sin(a) * 9, cx + Math.cos(a) * (i % 6 ? 12.8 : 13.6), cy + Math.sin(a) * (i % 6 ? 9.6 : 10.2), hsl(hue, 80, 75), 0.2);
      }
      return [
        f(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="12" ry="9" fill="${hsl(hue, 80, 50, 0.08)}" stroke="${hsl(hue, 80, 70)}" stroke-width=".3"/>` + ticks),
        arrowPath(`${id}-cw`, `M${n(cx + 4)} ${n(cy - 11.5)}A13 10 0 0 1 ${n(cx + 13.5)} ${n(cy - 3)}`, hsl(hue, 100, 82), { w: 0.5 }),
        arrowPath(`${id}-ccw`, `M${n(cx - 4)} ${n(cy - 11.5)}A13 10 0 0 0 ${n(cx - 13.5)} ${n(cy - 3)}`, hsl(hue, 100, 82), { w: 0.5 }),
        ship(`${id}-s`, cx, cy, 4.6, 4, p1),
        f(glyph(cx + 18, cy - 9, '+', 5, hsl(hue, 100, 85)) + glyph(cx - 18, cy - 9, '−', 5, hsl(hue, 100, 85))),
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
    caption: 'a 9 world that also answers to 8 and 10',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.6);
      return [
        world(`${id}-w`, r.fork('w'), cx, cy, 8.5, 9),
        f(glyph(cx, cy + 0.4, '9', 6.5, '#fff')),
        f(`<path d="M${n(cx - 20)} ${n(cy - 5)}Q${n(cx)} ${n(cy - 20)} ${n(cx + 20)} ${n(cy - 5)}" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".3"/>`),
        f(glyph(cx - 20, cy - 9, '8', 4.5, hsl(hue, 100, 82)) + glyph(cx + 20, cy - 9, '10', 4.5, hsl(hue, 100, 82))),
        ship(`${id}-a`, cx - 15, cy + 5, 3.4, 5, p1),
        ship(`${id}-b`, cx + 15, cy + 4, 3.4, 5, p1),
      ];
    },
  },

  'o-nomadic': {
    caption: 'a ship hops from one orbit to the next planet over',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.6);
      const g = iso(cx, cy, 7);
      const A: [number, number] = [0, 1];
      const B: [number, number] = [0, -1];
      return [
        grid(`${id}-g`, g, -1, 1, -2, 2, hue, 0.35),
        ...worldOn(`${id}-a`, r.fork('a'), g, ...A, 4.6, hue, 7),
        ...worldOn(`${id}-b`, r.fork('b'), g, ...B, 5.4, hue, 9),
        f(space(g, -1, 1, hue, { a: 0.15, dash: true }) + space(g, 1, -1, hue, { a: 0.45 })),
        shipOn(`${id}-g`, g, -1, 1, 3.2, 4, p1, { ghost: true }),
        arrowPath(`${id}-hop`, `M${n(g.x(-1, 1))} ${n(g.y(-1, 1) - 6)}Q${n(cx)} ${n(cy - 24)} ${n(g.x(1, -1) - 1)} ${n(g.y(1, -1) - 7)}`, hsl(hue, 100, 82), { w: 0.45, dash: true }),
        shipOn(`${id}-s`, g, 1, -1, 3.4, 4, p1),
      ];
    },
  },

  'o-plundering': {
    caption: 'a tractor beam drags the wreckage in for study: research +3',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [sx, sy] = at(box, 0.75, 0.38);
      const [wx, wy] = at(box, 0.25, 0.62);
      return [
        f(`<path d="M${n(sx - 3)} ${n(sy + 1)}L${n(wx + 1)} ${n(wy - 7)}L${n(wx + 3)} ${n(wy + 6)}L${n(sx - 2)} ${n(sy + 4)}Z" fill="${hsl(RESEARCH, 90, 70, 0.18)}"/>`),
        ...wreck(`${id}-w`, wx, wy, 6, p2, RESEARCH, r.fork('w')),
        f(die(wx, wy, 3, 3, p2, { opacity: 0.5, rotate: 20 })),
        ship(`${id}-s`, sx, sy, 4.6, 5, p1),
        f(icon('research', sx - 2, sy + 10, 5, hsl(RESEARCH, 100, 82)) + glyph(sx + 4, sy + 10.4, '+3', 4.4, hsl(RESEARCH, 100, 85), 'start')),
        f(line(sx, sy + 4, wx, wy, hsl(hue, 80, 80), 0.15, ' opacity=".4"')),
      ];
    },
  },

  'o-precocious': {
    caption: 'research reaches 4 and an advance card is already on its way',
    draw: ({ id, r, hue, box }) => {
      const [tx, ty] = at(box, 0.06, 0.62);
      const x4 = trackSlot(tx, 4);
      return [
        f(track(tx, ty, 'research', 4, { numbers: true, hot: [4] })),
        glow(`${id}-g`, x4 + 4, ty - 13, 10, 10, hue, 0.5),
        arrowPath(`${id}-up`, `M${n(x4)} ${n(ty - 2.5)}Q${n(x4)} ${n(ty - 8)} ${n(x4 + 3)} ${n(ty - 9)}`, hsl(RESEARCH, 100, 85), { w: 0.4 }),
        miniCard(`${id}-c`, x4 + 9, ty - 15, 9, hue, { rot: 12, icon: 'card', state: 'glow' }),
        f(sparkles(r.fork('sp'), x4 + 9, ty - 15, 7, 11, 4)),
      ];
    },
  },

  'o-rational': {
    caption: 'every combat die comes up 3',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      return [
        glow(`${id}-g`, cx, cy, 24, 10, hue, 0.3),
        f([-14, 0, 14].map((dx, i) => combatDie(cx + dx, cy + (i === 1 ? -2 : 1), 8, 3, hue, { rot: [-8, 0, 8][i] })).join('')),
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
        f(line(at(box, 0.5, 0.15)[0], at(box, 0.5, 0.15)[1], at(box, 0.5, 0.85)[0], at(box, 0.5, 0.85)[1], hsl(DOMINANCE, 60, 70), 0.25, ' stroke-dasharray="1 1"')),
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
    caption: 'after the opponent rolls, you roll once more',
    draw: ({ id, hue, box, p2, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      return [
        f(combatDie(cx - 16, cy + 2, 6.5, 5, hue, { ghost: true, rot: -10 })),
        f(combatDie(cx, cy - 3, 6.5, 3, p2, { rot: 6 })),
        arrowPath(`${id}-a1`, `M${n(cx - 12)} ${n(cy - 2)}Q${n(cx - 8)} ${n(cy - 9)} ${n(cx - 4.5)} ${n(cy - 6)}`, hsl(hue, 80, 75), { w: 0.3 }),
        arrowPath(`${id}-a2`, `M${n(cx + 4)} ${n(cy - 2)}Q${n(cx + 9)} ${n(cy + 6)} ${n(cx + 12)} ${n(cy + 3)}`, hsl(hue, 100, 82), { w: 0.4 }),
        f(combatDie(cx + 16, cy + 3, 7.5, 2, p1, { glow: true, rot: -6 })),
        f(glyph(cx - 16, cy + 9.5, '1', 3, hsl(hue, 70, 75)) + glyph(cx, cy + 5, '2', 3, hsl(p2, 70, 75)) + glyph(cx + 16, cy + 11.5, '3', 3, hsl(hue, 100, 85))),
      ];
    },
  },

  'o-resourceful': {
    caption: 'a ship recalled to the scrapyard and rerolled, for one more action',
    draw: ({ id, hue, box, p1 }) => {
      const [sx, sy] = at(box, 0.26, 0.3);
      const [yx, yy] = at(box, 0.3, 0.74);
      const [kx, ky] = at(box, 0.76, 0.42);
      return [
        f(die(sx, sy, 3, 2, p1, { ghost: true })),
        arrowPath(`${id}-dn`, `M${n(sx)} ${n(sy + 4)}Q${n(sx - 5)} ${n((sy + yy) / 2)} ${n(yx - 1)} ${n(yy - 5)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }),
        f(scrapyard(yx, yy, 16, 9, hue)),
        f(die(yx, yy - 2.6, 2.8, 5, p1, { rotate: 20 })),
        loop(`${id}-l`, yx, yy - 3, 6, hsl(hue, 90, 80), 0.35),
        arrowPath(`${id}-ar`, `M${n(yx + 8)} ${n(yy - 5)}Q${n(kx - 6)} ${n(yy - 6)} ${n(kx - 4)} ${n(ky + 4)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }),
        glow(`${id}-g`, kx, ky, 9, 9, hue, 0.5),
        f(chip(kx, ky, 4.6, hue, 'new') + glyph(kx + 8, ky - 5, '+1', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  'o-righteous': {
    caption: 'a ship is lost, and the dominance track does not move',
    draw: ({ id, r, box, p1, p2 }) => {
      const [wx, wy] = at(box, 0.24, 0.62);
      const [tx, ty] = at(box, 0.36, 0.32);
      return [
        ...beam(`${id}-b`, at(box, 0.05, 0.9)[0], at(box, 0.05, 0.9)[1], wx, wy, p2, 0.9),
        ...wreck(`${id}-w`, wx, wy, 8, p1, 20, r.fork('w')),
        f(die(wx, wy, 3.2, 6, p1, { opacity: 0.45, rotate: -20 })),
        shield(`${id}-sh`, trackSlot(tx, 3.5), ty, 16, 5.5, 200),
        f(track(tx, ty, 'dominance', 4)),
        f(slash(trackSlot(tx, 4) + 2, ty + 9, 2.4) + glyph(trackSlot(tx, 4) + 2, ty + 9.2, '−1', 2.4, hsl(DOMINANCE, 60, 70))),
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
        out.push(kind === 'ship' ? ship(`${id}-s${k}`, x, y, 3.4, v, p1) : f(combatDie(x, y, 5.5, v, hue, { rot: (k - 2) * 8 })));
        out.push(loop(`${id}-l${k}`, x, y, kind === 'ship' ? 6.5 : 5.5, hsl(hue, 90, 80), 0.35, k * 40, 270));
      });
      return out;
    },
  },

  'o-stealthy': {
    caption: 'a ship shimmers out of nowhere, far from every other ship',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.6, 0.5);
      let ripples = '';
      for (let i = 1; i <= 4; i++) ripples += `<ellipse cx="${n(cx)}" cy="${n(cy + 2)}" rx="${n(4 + i * 3)}" ry="${n(2 + i * 1.6)}" fill="none" stroke="${hsl(hue, 90, 75)}" stroke-width="${n(0.4 - i * 0.07)}" opacity="${n(1 - i * 0.2)}" stroke-dasharray="${n(i * 1.5)} ${n(i)}"/>`;
      return [
        f(die(at(box, 0.12, 0.75)[0], at(box, 0.12, 0.75)[1], 2, 3, p2, { opacity: 0.55 }) + die(at(box, 0.2, 0.85)[0], at(box, 0.2, 0.85)[1], 2, 1, p2, { opacity: 0.55 })),
        glow(`${id}-g`, cx, cy, 12, 9, hue, 0.4),
        f(ripples),
        {
          defs: `<linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".3" stop-color="#fff"/><stop offset=".9" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}-m" maskContentUnits="userSpaceOnUse"><rect x="${n(cx - 6)}" y="${n(cy - 6)}" width="12" height="12" fill="url(#${id}-fade)"/></mask>`,
          body: `<g mask="url(#${id}-m)">${die(cx, cy, 4.6, 6, p1)}</g>` + die(cx, cy, 4.6, 6, p1, { ghost: true }),
        },
        f(sparkles(r.fork('sp'), cx, cy, 5, 12, 6)),
      ];
    },
  },

  'o-strategic': {
    caption: 'three ships in close formation, shields linked: −2 to every roll',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.42, 0.58);
      const g = iso(cx, cy, 6);
      const cells: [number, number][] = [[0, 0], [0, 1], [1, 0]];
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.35),
        f(cells.map(([i, j]) => space(g, i, j, hue, { a: 0.3 })).join('')),
        shield(`${id}-sh`, g.x(0.33, 0.33), g.y(0.33, 0.33) - 3, 13, 8, p1),
        ...cells.map(([i, j], k) => shipOn(`${id}-s${k}`, g, i, j, 3.4, [3, 5, 1][k], p1)),
        f(combatDie(at(box, 0.82, 0.32)[0], at(box, 0.82, 0.32)[1], 6.5, 1, hue, { glow: true, rot: 8 }) + glyph(at(box, 0.82, 0.32)[0], at(box, 0.82, 0.32)[1] + 8.5, '−2', 4.2, hsl(hue, 100, 80))),
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
        f(chip(at(box, 0.15, 0.3)[0], at(box, 0.15, 0.3)[1], 3.2, hue, 'spent') + glyph(at(box, 0.15, 0.3)[0], at(box, 0.15, 0.3)[1] + 6.5, '0', 3.2, hsl(hue, 100, 85))),
      ];
    },
  },

  'o-tyrannical': {
    caption: 'one research point hardened into dominance',
    draw: ({ id, box }) => {
      const [x, y1] = at(box, 0.14, 0.3);
      const y2 = y1 + 12;
      const a = trackSlot(x, 4, 3.6);
      const b = trackSlot(x, 4, 3.6);
      return [
        f(track(x, y1, 'research', 3, { from: 4, cell: 3.6 })),
        f(track(x, y2, 'dominance', 4, { from: 3, cell: 3.6 })),
        arrowPath(`${id}-ar`, `M${n(a)} ${n(y1 + 2.6)}Q${n(a + 5)} ${n((y1 + y2) / 2)} ${n(b + 2)} ${n(y2 - 2.8)}`, hsl(DOMINANCE, 90, 78), { w: 0.4 }),
        f(glyph(a - 6, (y1 + y2) / 2, '−1', 3.6, hsl(RESEARCH, 100, 82)) + glyph(b + 11, (y1 + y2) / 2 + 0.4, '+1', 3.6, hsl(DOMINANCE, 100, 75))),
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
        f(chip(sx, sy - 13, 3.6, hue, 'new')),
        arrowPath(`${id}-up`, `M${n(sx)} ${n(sy - 6.5)}V${n(sy - 8.6)}`, hsl(hue, 100, 85), { w: 0.4 }),
        f(sparkles(r.fork('sp'), sx, sy - 6, 6, 12, 4)),
      ];
    },
  },

  // Gambits

  'o-aggression': {
    caption: 'a fleet raises its banner before a world: dominance +2',
    draw: ({ id, r, box, p1 }) => {
      const [px, py] = at(box, 0.7, 0.8);
      const fleet = [[0.14, 0.7], [0.3, 0.8], [0.26, 0.56]];
      const fx = px - 4;
      const fy = py - 8;
      return [
        world(`${id}-w`, r.fork('w'), px, py, 10, 10),
        ...fleet.map(([a, b], k) => ship(`${id}-s${k}`, at(box, a, b)[0], at(box, a, b)[1], 3.6, [5, 3, 6][k], p1)),
        glow(`${id}-fg`, fx + 5, fy - 7, 10, 9, DOMINANCE, 0.55),
        f(line(fx, fy + 2, fx, fy - 13, hsl(DOMINANCE, 30, 90), 0.5) + `<path d="M${n(fx)} ${n(fy - 13)}h10l-2.5 3.5 2.5 3.5H${n(fx)}z" fill="${hsl(DOMINANCE, 95, 60)}" stroke="${hsl(DOMINANCE, 100, 82)}" stroke-width=".3"/>`),
        f(glyph(at(box, 0.3, 0.34)[0], at(box, 0.3, 0.34)[1], '+2', 7, hsl(DOMINANCE, 100, 75))),
        f(sparkles(r.fork('sp'), fx + 5, fy - 7, 6, 12, 4)),
      ];
    },
  },

  'o-expansion': {
    caption: 'a new ship drops out of hyperspace into orbit beside your cube',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.38, 0.58);
      const [sx, sy] = at(box, 0.68, 0.36);
      let spiral = '';
      for (let i = 0; i < 4; i++) spiral += `<ellipse cx="${n(sx)}" cy="${n(sy)}" rx="${n(3 + i * 2.6)}" ry="${n(1.6 + i * 1.3)}" fill="none" stroke="${hsl(hue + i * 10, 95, 70)}" stroke-width="${n(0.5 - i * 0.08)}" stroke-dasharray="${n(2 + i)} ${n(1 + i * 0.6)}" transform="rotate(${n(-20 + i * 7)} ${n(sx)} ${n(sy)})"/>`;
      return [
        f(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="15" ry="7.5" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2"/>`),
        world(`${id}-w`, r.fork('w'), cx, cy, 9),
        f(cube(cx - 3, cy - 6.5, 2.2, p1)),
        glow(`${id}-g`, sx, sy, 14, 9, hue, 0.5),
        f(spiral),
        ...trails(`${id}-t`, r.fork('t'), sx - 1, sy + 1, -1, 0.5, 12, 1.4, hsl(hue, 90, 80), 4),
        ship(`${id}-s`, sx - 4, sy + 3, 3.8, 3, p1),
        arrowPath(`${id}-ar`, `M${n(sx - 8)} ${n(sy + 7)}Q${n(cx + 14)} ${n(cy + 2)} ${n(cx + 12)} ${n(cy + 5)}`, hsl(hue, 90, 82), { w: 0.35, dash: true }),
      ];
    },
  },

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
        f(chips(kx, ky, 2.4, hue, ['lit', 'lit'])),
        f(sparkles(r.fork('sp'), cx, cy, 10, 16, 5)),
      ];
    },
  },

  'o-reorganization': {
    caption: 'rerolled ships sorted out: some into orbit at your worlds, one to the scrapyard',
    draw: ({ id, r, hue, box, p1 }) => {
      const [px, py] = at(box, 0.75, 0.42);
      const [yx, yy] = at(box, 0.24, 0.74);
      const [ox, oy] = at(box, 0.42, 0.3);
      const out = [
        f(`<ellipse cx="${n(px)}" cy="${n(py)}" rx="13" ry="6.5" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2"/>`),
        world(`${id}-w`, r.fork('w'), px, py, 7.5),
        f(cube(px + 2, py - 5.5, 2, p1)),
        f(scrapyard(yx, yy, 14, 8, hue)),
        loop(`${id}-l`, ox, oy, 7, hsl(hue, 90, 80), 0.4),
      ];
      [[-3, -1, 25, 2], [2, 2, -20, 6], [3, -3, 10, 4]].forEach(([dx, dy, rot, v]) => out.push(f(die(ox + dx, oy + dy, 2.2, v, p1, { rotate: rot, opacity: 0.85 }))));
      out.push(arrowPath(`${id}-a1`, `M${n(ox + 7)} ${n(oy + 1)}Q${n(px - 10)} ${n(oy - 2)} ${n(px - 12)} ${n(py + 1)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }));
      out.push(arrowPath(`${id}-a2`, `M${n(ox + 6)} ${n(oy + 5)}Q${n(px - 2)} ${n(py + 12)} ${n(px + 9)} ${n(py + 6)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }));
      out.push(arrowPath(`${id}-a3`, `M${n(ox - 4)} ${n(oy + 6)}Q${n(yx - 2)} ${n(oy + 12)} ${n(yx)} ${n(yy - 5)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }));
      out.push(ship(`${id}-s1`, px - 13, py + 2, 2.8, 5, p1), ship(`${id}-s2`, px + 11, py + 5, 2.8, 1, p1));
      out.push(f(die(yx, yy - 2.4, 2.4, 3, p1)));
      return out;
    },
  },

  'o-relocation': {
    caption: "an opponent's cube hauled off to a world they don't hold",
    draw: ({ id, r, hue, box, p2 }) => {
      const [ax, ay] = at(box, 0.2, 0.62);
      const [bx, by] = at(box, 0.78, 0.55);
      const [cx, cy] = at(box, 0.5, 0.3);
      return [
        world(`${id}-a`, r.fork('a'), ax, ay, 8, 8),
        world(`${id}-b`, r.fork('b'), bx, by, 7, 7),
        f(cube(ax + 2, ay - 7, 2.2, p2, { ghost: true })),
        arrowPath(`${id}-arc`, `M${n(ax + 3)} ${n(ay - 11)}Q${n(cx)} ${n(cy - 14)} ${n(bx - 1)} ${n(by - 10)}`, hsl(hue, 90, 82), { w: 0.4, dash: true }),
        f(`<path d="M${n(cx - 2)} ${n(box.y - 2)}H${n(cx + 2)}L${n(cx + 3.5)} ${n(cy - 2)}H${n(cx - 3.5)}Z" fill="${hsl(hue, 90, 70, 0.22)}"/>`),
        glow(`${id}-g`, cx, cy, 5, 5, p2, 0.5),
        f(cube(cx, cy, 2.6, p2, { rotate: 18 })),
        f(sparkles(r.fork('sp'), cx, cy, 3, 6, 3)),
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
