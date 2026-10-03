import { hsl, n } from '../svg';
import {
  arrowPath, at, burst, chips, combatDie, cube, die, DOMINANCE, f, glow, glyph, grid, icon, iso, line, loop, miniCard, missile,
  panel, scrapyard, ship, shipOn, space, sparkles, streak, track, trackSlot, trails, world, wreck,
} from '../cardkit';
import type { Illustration } from '../illustrations';

/** Gate rings standing on the board: the Warp Gate tokens. */
function gate(id: string, x: number, y: number, s: number, hue: number, tilt: number) {
  let rings = '';
  for (let i = 0; i < 5; i++) {
    rings += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n((4.2 - i * 0.65) * s)}" ry="${n((9 - i * 1.5) * s)}" fill="none" stroke="${hsl(hue + i * 12, 95, 60 + i * 6)}" stroke-width="${n(0.5 - i * 0.06)}" stroke-dasharray="${n(3 + i)} ${n(1 + i * 0.5)}" transform="rotate(${n(tilt)} ${n(x)} ${n(y)})"/>`;
  }
  return [glow(id, x, y, 7 * s, 11 * s, hue, 0.55, 60), f(rings)];
}

/** Community Edition Tactics and the Expansion card. */
export const TACTIC_SCENES: Record<string, Illustration> = {
  aggression: {
    caption: 'a flag raised over a conquered world: dominance jumps by two',
    draw: ({ id, r, box, p1 }) => {
      const [px, py] = at(box, 0.26, 0.74);
      const [tx, ty] = at(box, 0.48, 0.4);
      const fx = px + 1;
      const fy = py - 9;
      return [
        world(`${id}-w`, r.fork('w'), px, py, 9, 9),
        f(cube(px - 4, py - 7.5, 2.2, p1)),
        glow(`${id}-fg`, fx + 4, fy - 6, 7, 7, DOMINANCE, 0.5),
        f(line(fx, fy + 1, fx, fy - 11, hsl(DOMINANCE, 30, 90), 0.5) + `<path d="M${n(fx)} ${n(fy - 11)}h8l-2 3 2 3H${n(fx)}z" fill="${hsl(DOMINANCE, 95, 60)}" stroke="${hsl(DOMINANCE, 100, 82)}" stroke-width=".3"/>`),
        f(track(tx, ty, 'dominance', 5, { from: 3, numbers: true })),
        f(glyph(trackSlot(tx, 5) + 1, ty + 7.5, '+2', 5, hsl(DOMINANCE, 100, 78))),
        f(sparkles(r.fork('sp'), fx + 4, fy - 6, 6, 11, 4)),
      ];
    },
  },

  'black-market': {
    caption: 'a smuggled crate cracked open: two missiles inside',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.45, 0.62);
      const s = 8;
      const k = 0.866 * s;
      const crate =
        `<path d="M${n(cx)} ${n(cy - s)}L${n(cx + k)} ${n(cy - s / 2)}L${n(cx + k)} ${n(cy + s / 2)}L${n(cx)} ${n(cy + s)}L${n(cx - k)} ${n(cy + s / 2)}L${n(cx - k)} ${n(cy - s / 2)}Z" fill="${hsl(30, 25, 22)}" stroke="${hsl(30, 40, 50)}" stroke-width=".3"/>` +
        `<path d="M${n(cx - k)} ${n(cy - s / 2)}L${n(cx)} ${n(cy)}L${n(cx + k)} ${n(cy - s / 2)}M${n(cx)} ${n(cy)}V${n(cy + s)}" fill="none" stroke="${hsl(30, 40, 50)}" stroke-width=".3"/>` +
        `<path d="M${n(cx)} ${n(cy)}L${n(cx + k)} ${n(cy - s / 2)}L${n(cx + k)} ${n(cy + s / 2)}L${n(cx)} ${n(cy + s)}Z" fill="${hsl(30, 25, 14)}"/>` +
        `<path d="M${n(cx - k)} ${n(cy - s / 2)}L${n(cx)} ${n(cy)}L${n(cx)} ${n(cy + s)}L${n(cx - k)} ${n(cy + s / 2)}Z" fill="${hsl(30, 25, 26)}"/>` +
        [0.3, 0.65].map((t) => line(cx - k, cy - s / 2 + s * t, cx, cy + s * t, hsl(42, 90, 55), 0.5, ' opacity=".8"')).join('') +
        `<path d="M${n(cx - k)} ${n(cy - s / 2)}L${n(cx - k - 3)} ${n(cy - s - 3)}L${n(cx - 3)} ${n(cy - s * 1.5)}L${n(cx)} ${n(cy - s)}Z" fill="${hsl(30, 25, 30)}" stroke="${hsl(30, 40, 50)}" stroke-width=".3"/>`;
      return [
        glow(`${id}-g`, cx, cy - s / 2, 14, 7, 42, 0.6, 60),
        f(crate),
        glow(`${id}-m`, cx + 2, cy - s - 6, 12, 8, hue, 0.4),
        f(missile(cx + 9, cy - s - 9, -35, hue, 1.6) + missile(cx + 12, cy - s - 2, -15, hue, 1.6)),
        f(glyph(at(box, 0.84, 0.3)[0], at(box, 0.84, 0.3)[1], '+2', 6, hsl(hue, 100, 80))),
        f(sparkles(r.fork('sp'), cx + 6, cy - s - 4, 8, 13, 4)),
      ];
    },
  },

  'change-of-heart': {
    caption: 'the Skill deck searched: one card lifted out of the spread',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.5, 1.3);
      const out = [];
      const hues = [192, 352, 138, 268, 42, 218, 24];
      for (let i = 0; i < 7; i++) {
        const a = (i - 3) * 13;
        const t = (a * Math.PI) / 180;
        const lift = i === 4 ? 6 : 0;
        out.push(miniCard(`${id}-c${i}`, cx + Math.sin(t) * (34 + lift), cy - Math.cos(t) * (34 + lift), 9, hues[i], { rot: a, icon: ['movement', 'combat', 'conquer', 'research', 'action', 'ship', 'card'][i], state: i === 4 ? 'glow' : 'normal' }));
      }
      out.push(loop(`${id}-l`, at(box, 0.12, 0.72)[0], at(box, 0.12, 0.72)[1], 4, hsl(hue, 90, 80), 0.45));
      out.push(f(sparkles(r.fork('sp'), cx + Math.sin(0.91) * 40, cy - Math.cos(0.91) * 40, 5, 9, 4)));
      return out;
    },
  },

  momentum: {
    caption: 'the turn comes round again, with two actions instead of three',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.42, 0.52);
      const [kx, ky] = at(box, 0.8, 0.32);
      return [
        glow(`${id}-g`, cx, cy, 15, 15, hue, 0.35),
        loop(`${id}-l`, cx, cy, 13, hsl(hue, 100, 75), 0.9, -40, 300),
        loop(`${id}-l2`, cx, cy, 15.5, hsl(hue, 90, 80), 0.25, 140, 200),
        ...trails(`${id}-t`, r.fork('t'), cx - 1, cy, 1, -0.15, 14, 2, hsl(hue, 90, 75), 5),
        ship(`${id}-s`, cx, cy, 5.2, 2, p1),
        f(panel(kx - 8.6, ky - 4, 17.2, 8, hue) + chips(kx, ky, 2.6, hue, ['lit', 'lit', 'spent'])),
      ];
    },
  },

  'plan-ahead': {
    caption: 'until your next turn ends, every combat roll is the perfect 1: the ship becomes the missile',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [sx, sy] = at(box, 0.55, 0.52);
      const [tx, ty] = at(box, 0.82, 0.34);
      const [dx, dy] = at(box, 0.22, 0.48);
      return [
        ...trails(`${id}-t`, r.fork('t'), sx - 2, sy + 1, 1, -0.45, 26, 2.6, hsl(28, 100, 70), 8),
        burst(`${id}-fl`, sx - 5, sy + 3.4, 4, 30, 6, r),
        ship(`${id}-e`, tx, ty, 3.6, 4, p2),
        f(`<circle cx="${n(tx)}" cy="${n(ty)}" r="6" fill="none" stroke="${hsl(hue, 100, 70)}" stroke-width=".35" stroke-dasharray="2.5 1.2"/>`),
        ship(`${id}-s`, sx, sy, 4.4, 1, p1, { rotate: -25 }),
        f(combatDie(dx, dy, 8, 1, hue, { glow: true, rot: -6 })),
        f(`<circle cx="${n(dx)}" cy="${n(dy)}" r="9" fill="none" stroke="${hsl(hue, 80, 75)}" stroke-width=".3" stroke-dasharray=".4 1.1"/>` + `<path d="M${n(dx)} ${n(dy - 9)}A9 9 0 1 1 ${n(dx - 9)} ${n(dy)}" fill="none" stroke="#fff" stroke-width=".45" stroke-linecap="round"/>`),
      ];
    },
  },

  sabotage: {
    caption: "an opponent's console shorts out: their next turn is one action short",
    draw: ({ id, r, hue, box, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.42);
      let bolt = '';
      const rr = r.fork('b');
      let x = cx + 1;
      let y = box.y - 2;
      let d = `M${n(x)} ${n(y)}`;
      while (y < cy - 4) {
        x += rr.range(-2.5, 2.5);
        y += rr.range(2, 3.5);
        d += `L${n(x)} ${n(y)}`;
      }
      bolt = `<path d="${d}" fill="none" stroke="${hsl(hue, 100, 82)}" stroke-width=".6" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width=".2"/>`;
      return [
        f(panel(cx - 15, cy - 6, 30, 12, p2, 0.85) + chips(cx, cy, 3.6, p2, ['lit', 'lit', 'broken'])),
        f(bolt),
        burst(`${id}-x`, cx + 8, cy - 1, 6, hue, 8, r),
        f(sparkles(r.fork('sp'), cx + 8, cy, 4, 9, 6, hsl(hue, 100, 80))),
        f(die(at(box, 0.2, 0.78)[0], at(box, 0.2, 0.78)[1], 3, 5, p2, { opacity: 0.6 }) + die(at(box, 0.82, 0.8)[0], at(box, 0.82, 0.8)[1], 3, 2, p2, { opacity: 0.6 })),
        f(glyph(cx, cy + 11, '−1', 4.6, hsl(hue, 100, 80))),
      ];
    },
  },

  'show-of-force': {
    caption: 'an orbital strike erases one ship anywhere on the map, for a point of dominance',
    draw: ({ id, r, hue, box, p2 }) => {
      const [cx, cy] = at(box, 0.48, 0.66);
      const g = iso(cx, cy, 6.4);
      const [tx, ty] = at(box, 0.82, 0.24);
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.45),
        f(space(g, 0, 0, hue, { a: 0.4 })),
        {
          defs: `<linearGradient id="${id}-col" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 100, 70)}" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient>`,
          body: `<path d="M${n(cx - 1.4)} ${n(box.y - 4)}H${n(cx + 1.4)}L${n(cx + 2.4)} ${n(cy - 2)}H${n(cx - 2.4)}Z" fill="url(#${id}-col)"/>` + line(cx, box.y - 4, cx, cy - 2, '#fff', 0.4),
        },
        ...wreck(`${id}-w`, cx, cy - 2.5, 9, p2, hue, r.fork('w')),
        f(die(cx, cy - 2.5, 3.2, 6, p2, { opacity: 0.45, rotate: -18 })),
        f(icon('dominance', tx - 4, ty, 5, hsl(DOMINANCE, 100, 75), 2.4) + glyph(tx + 3, ty + 0.4, '+1', 4.6, hsl(DOMINANCE, 100, 78))),
      ];
    },
  },

  'unveil-the-fleet': {
    caption: 'every ship pulled off the map and rerolled, then the whole fleet deployed anew',
    draw: ({ id, r, hue, box, p1 }) => {
      const [yx, yy] = at(box, 0.25, 0.72);
      const [cx, cy] = at(box, 0.7, 0.55);
      const g = iso(cx, cy, 5.4);
      const targets: [number, number][] = [[-1, -1], [1, -1], [1, 1]];
      const out = [grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.45), f(scrapyard(yx, yy, 16, 9, hue))];
      targets.forEach(([i, j], k) => {
        const x = g.x(i, j);
        const y = g.y(i, j) - 2;
        out.push(arrowPath(`${id}-a${k}`, `M${n(yx - 3 + k * 3)} ${n(yy - 3)}Q${n((yx + x) / 2)} ${n(Math.min(yy, y) - 14 + k * 3)} ${n(x - 1)} ${n(y - 3)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }));
      });
      targets.forEach(([i, j], k) => out.push(shipOn(`${id}-s${k}`, g, i, j, 3.2, [6, 3, 5][k], p1)));
      [[-4, 0, -30], [1, -2, 20], [4, 1, -10]].forEach(([dx, dy, rot], k) => out.push(f(die(yx + dx, yy + dy - 3, 2.4, [2, 4, 1][k], p1, { opacity: 0.8, rotate: rot }))));
      out.push(loop(`${id}-l`, yx, yy - 3, 7, hsl(hue, 90, 80), 0.35, 200, 280));
      out.push(f(sparkles(r.fork('sp'), cx, cy - 4, 4, 14, 5)));
      return out;
    },
  },

  'warp-gate': {
    caption: 'two gates on far-apart spaces: step into one, out of the other',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.58);
      const g = iso(cx, cy, 6);
      const a: [number, number] = [-1, 2];
      const b: [number, number] = [1, -2];
      return [
        grid(`${id}-g`, g, -2, 2, -3, 3, hue, 0.4),
        f(space(g, ...a, hue, { a: 0.4 }) + space(g, ...b, hue, { a: 0.4 })),
        ...gate(`${id}-ga`, g.x(...a), g.y(...a) - 7, 0.8, hue, -10),
        ...gate(`${id}-gb`, g.x(...b), g.y(...b) - 7, 0.8, hue, 10),
        arrowPath(`${id}-arc`, `M${n(g.x(...a) + 3)} ${n(g.y(...a) - 13)}Q${n(cx)} ${n(cy - 30)} ${n(g.x(...b) - 3)} ${n(g.y(...b) - 13)}`, hsl(hue, 90, 82), { w: 0.4, dash: '.6 1' }),
        shipOn(`${id}-s`, g, b[0], b[1] + 1, 3.6, 3, p1),
        f(sparkles(r.fork('sp'), g.x(...b), g.y(...b) - 7, 5, 9, 4)),
      ];
    },
  },

  expansion: {
    caption: 'a reserve ship rolled straight into orbit around a world you hold',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.6, 0.56);
      const tumble = [[-30, -8, 2.4, 0.3, -40, 2], [-24, -4, 2.8, 0.5, 30, 5], [-18, -1, 3.2, 0.75, -10, 3]] as const;
      return [
        f(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="16" ry="8" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2"/>`),
        world(`${id}-w`, r.fork('w'), cx, cy, 9),
        f(cube(cx + 3, cy - 6.5, 2.2, p1)),
        burst(`${id}-b`, cx - 34, cy - 10, 6, hue, 4, r),
        f(tumble.map(([dx, dy, s, o, rot, v]) => die(cx + dx, cy + dy, s, v, p1, { opacity: o, rotate: rot })).join('')),
        streak(`${id}-tr`, cx - 34, cy - 10, cx - 14, cy + 1, hsl(hue, 90, 75), 0.6),
        ship(`${id}-s`, cx - 12, cy + 2, 3.6, 4, p1),
        ship(`${id}-o`, cx + 15, cy - 1, 3.2, 6, p1, { opacity: 0.8 }),
        f(icon('expansion', cx - 12, cy - 6.5, 3, '#fff', 3)),
      ];
    },
  },
};
