import { hsl, n } from '../svg';
import {
  arrowPath, at, beam, burst, chip, chips, combatDie, cube, die, DOMINANCE, f, glow, glyph, grid, icon, iso, line, loop, miniCard,
  RESEARCH, route, scrapyard, shield, ship, shipOn, slash, space, sparkles, track, trackSlot, trails, world, wreck, missile,
  badge, bolt, crest, dial, orbit, pillar, token,
} from '../kit';
import type { Illustration } from '../illustrations';

/** Community Edition Skills: one scene per card, showing what the card does. */
export const SKILL_SCENES: Record<string, Illustration> = {
  agile: {
    caption: 'a ship flies one space further than its three: the fourth space glows +1',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      const g = iso(cx, cy + 1, 6.4);
      const path: [number, number][] = [[0, 2], [0, 1], [0, 0], [0, -1], [0, -2]];
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue),
        f(path.slice(1, 4).map(([i, j]) => space(g, i, j, hue, { a: 0.22 })).join('') + space(g, 0, -2, hue, { a: 0.5, light: 72 })),
        shipOn(`${id}-a`, g, 0, 2, 3.4, 4, p1, { ghost: true }),
        route(`${id}-r`, g, path, hsl(hue, 90, 80), { dash: true, lift: 1 }),
        ...trails(`${id}-t`, r.fork('t'), g.x(0, -2) - 2, g.y(0, -2) + 0.5, 1, -0.58, 14, 2.2, hsl(hue, 90, 75), 5),
        shipOn(`${id}-s`, g, 0, -2, 3.8, 4, p1),
        f(glyph(g.x(0, -2) + 7.5, g.y(0, -2) - 5, '+1', 5, hsl(hue, 100, 85))),
      ];
    },
  },

  ambitious: {
    caption: 'an extra action, paid for with a token on the card: two tokens down, the third is the last',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.34, 0.52);
      const card = miniCard(`${id}-c`, cx, cy, 15, hue, { rot: -8, icon: 'action' });
      const pads = [-4.4, 0, 4.4].map((dx) => [cx + dx * 0.99 + 0.8, cy + 8 - dx * 0.14] as const);
      let tokens = pads.map(([x, y]) => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="2" ry="1.2" fill="none" stroke="${hsl(hue, 80, 45)}" stroke-width=".25" stroke-dasharray=".6 .4"/>`).join('');
      tokens += token(pads[0][0], pads[0][1] - 0.3, 1.8) + token(pads[1][0], pads[1][1] - 0.3, 1.8);
      const [tx, ty] = at(box, 0.78, 0.42);
      return [
        card,
        f(tokens),
        f(token(pads[2][0] + 1, pads[2][1] - 6, 1.8, { opacity: 0.85 })),
        arrowPath(`${id}-drop`, `M${n(pads[2][0] + 1)} ${n(pads[2][1] - 4.5)}V${n(pads[2][1] - 2.2)}`, hsl(hue, 90, 80), { w: 0.3 }),
        glow(`${id}-glow`, tx, ty, 11, 11, hue, 0.45),
        f(chip(tx, ty, 6, 'new') + glyph(tx, ty + 11, '+1', 4.4, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), tx, ty, 9, 12, 4)),
      ];
    },
  },

  brilliant: {
    caption: 'the research flask lights up at the start of the turn: +2',
    draw: ({ id, r, box }) => {
      const [ix, iy] = at(box, 0.34, 0.48);
      const [gx, gy] = at(box, 0.66, 0.48);
      let rays = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        rays += line(ix + Math.cos(a) * 7, iy + Math.sin(a) * 7, ix + Math.cos(a) * 10, iy + Math.sin(a) * 10, hsl(RESEARCH, 100, 80), 0.3, ' opacity=".7"');
      }
      return [
        glow(`${id}-g`, ix, iy, 11, 11, RESEARCH, 0.6, 66),
        f(rays + icon('research', ix, iy, 9, hsl(RESEARCH, 100, 90), 2)),
        f(glyph(gx, gy, '+2', 11, hsl(RESEARCH, 100, 85))),
        f(sparkles(r.fork('sp'), gx, gy, 7, 11, 4)),
      ];
    },
  },

  brutal: {
    caption: 'two combat dice rolled: the higher is struck out, the lower one counts',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.2, 0.7);
      const [bx, by] = at(box, 0.82, 0.3);
      const [dx, dy] = at(box, 0.5, 0.5);
      return [
        ship(`${id}-a`, ax, ay, 4.6, 5, p1),
        ...beam(`${id}-b`, ax + 2, ay - 2, bx - 3, by + 1.5, hue, 1.2),
        ship(`${id}-e`, bx, by, 4.6, 3, p2),
        burst(`${id}-x`, bx - 3, by + 1.5, 6, hue, 8, r),
        f(combatDie(dx - 5, dy + 1, 7, 5, 'attack', { rot: -14, struck: true }) + combatDie(dx + 5, dy + 3, 7, 2, 'attack', { rot: 9, glow: true })),
      ];
    },
  },

  calculating: {
    caption: 'a ship falls into the scrapyard and its number is dialled in, not rolled',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.72);
      const [sx, sy] = at(box, 0.5, 0.36);
      let dial = '';
      for (let v = 1; v <= 6; v++) {
        const a = ((v - 1) / 6) * Math.PI * 2 - Math.PI / 2 - Math.PI / 6;
        const x = sx + Math.cos(a) * 10.5;
        const y = sy + Math.sin(a) * 8.5;
        dial += v === 6 ? `<circle cx="${n(x)}" cy="${n(y)}" r="2.3" fill="${hsl(hue, 90, 60)}" stroke="#fff" stroke-width=".3"/>` : '';
        dial += `<text x="${n(x)}" y="${n(y + 0.1)}" font-family="Orbitron, sans-serif" font-weight="900" font-size="2.6" fill="${v === 6 ? hsl(228, 45, 8) : hsl(hue, 80, 80)}" text-anchor="middle" dominant-baseline="central">${v}</text>`;
      }
      return [
        f(scrapyard(cx, cy + 2, 18, 9, hue)),
        f(`<ellipse cx="${n(sx)}" cy="${n(sy)}" rx="10.5" ry="8.5" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 .8"/>` + dial),
        arrowPath(`${id}-dn`, `M${n(sx)} ${n(sy + 5.8)}V${n(cy - 2)}`, hsl(hue, 90, 80), { w: 0.35, dash: true }),
        ship(`${id}-s`, sx, sy, 4.2, 6, p1),
        f(sparkles(r.fork('sp'), sx, sy, 5, 7, 3)),
      ];
    },
  },

  clever: {
    caption: 'a ship tumbles as it reconfigures, lands on 4, then nudges up or down by one',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.55, 0.5);
      let tumble = '';
      [[-24, 6, 2.6, 0.25, -40, 1], [-17, 1, 3.2, 0.4, 25, 6], [-9, -2, 3.8, 0.6, -15, 2]].forEach(([dx, dy, s, o, rot, v]) => (tumble += die(cx + dx, cy + dy, s, v, p1, { opacity: o, rotate: rot })));
      const [ux, uy] = [cx + 12, cy - 7];
      const [lx, ly] = [cx + 12, cy + 7];
      return [
        arrowPath(`${id}-arc`, `M${n(cx - 27)} ${n(cy + 9)}Q${n(cx - 16)} ${n(cy - 10)} ${n(cx - 5)} ${n(cy - 4)}`, hsl(hue, 80, 75), { w: 0.35, dash: true }),
        f(tumble),
        ship(`${id}-s`, cx, cy, 5, 4, p1),
        f(die(ux, uy, 2.6, 5, p1, { ghost: true }) + die(lx, ly, 2.6, 3, p1, { ghost: true })),
        arrowPath(`${id}-up`, `M${n(cx + 5.5)} ${n(cy - 2.5)}L${n(ux - 3)} ${n(uy + 1.5)}`, hsl(hue, 90, 80), { w: 0.35 }),
        arrowPath(`${id}-dn`, `M${n(cx + 5.5)} ${n(cy + 2.5)}L${n(lx - 3)} ${n(ly - 1)}`, hsl(hue, 90, 80), { w: 0.35 }),
        f(glyph(ux + 6, uy - 1, '+1', 3.2, hsl(hue, 100, 85), 'start') + glyph(lx + 6, ly + 1, '−1', 3.2, hsl(hue, 100, 85), 'start')),
        f(sparkles(r.fork('sp'), cx, cy, 7, 9, 3)),
      ];
    },
  },

  composed: {
    caption: 'two emblems and a trade between them: one dominance out, three research in',
    draw: ({ id, r, box }) => {
      const [ax, ay] = at(box, 0.26, 0.45);
      const [bx, by] = at(box, 0.74, 0.45);
      return [
        glow(`${id}-a`, ax, ay, 10, 10, DOMINANCE, 0.4),
        glow(`${id}-b`, bx, by, 10, 10, RESEARCH, 0.55),
        f(crest(ax, ay, 7, true)),
        f(`<circle cx="${n(bx)}" cy="${n(by)}" r="7.36" fill="${hsl(RESEARCH, 60, 14, 0.7)}" stroke="${hsl(RESEARCH, 90, 75)}" stroke-width=".35"/>` + icon('research', bx, by, 7, hsl(RESEARCH, 100, 85))),
        arrowPath(`${id}-t`, `M${n(ax + 9)} ${n(ay - 3)}Q${n((ax + bx) / 2)} ${n(ay - 10)} ${n(bx - 9)} ${n(by - 3)}`, hsl(RESEARCH, 90, 82), { w: 0.45 }),
        f(glyph(ax, ay + 12, '−1', 4.2, hsl(DOMINANCE, 100, 75)) + glyph(bx, by + 12, '+3', 4.2, hsl(RESEARCH, 100, 85))),
        f(sparkles(r.fork('sp'), bx, by, 9, 12, 3)),
      ];
    },
  },

  cunning: {
    caption: "a ship's ability fires, and fires again: its face echoed twice, ×2",
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.42, 0.55);
      let echo = '';
      [1, 2].forEach((k) => {
        const s = 5 + k * 1.6;
        echo += `<path d="M${n(cx)} ${n(cy - 5 - k * 3.4)}l${n(s * 0.866)} ${n(s / 2)}l${n(-s * 0.866)} ${n(s / 2)}l${n(-s * 0.866)} ${n(-s / 2)}z" fill="${hsl(hue, 90, 60, 0.1)}" stroke="${hsl(hue, 90, 75)}" stroke-width=".3" opacity="${n(1 - k * 0.25)}" transform="translate(0 ${n(-s / 2)})"/>`;
      });
      return [
        glow(`${id}-g`, cx, cy - 6, 14, 12, hue, 0.4),
        f(echo),
        ship(`${id}-s`, cx, cy, 5.2, 5, p1),
        f(glyph(...at(box, 0.8, 0.4), '×2', 6.5, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), cx, cy - 10, 6, 11, 4)),
      ];
    },
  },

  curious: {
    caption: 'weapons cold, a lone ship turns its sensors to a world and learns from it',
    draw: ({ id, r, hue, box, p1 }) => {
      const [sx, sy] = at(box, 0.24, 0.66);
      const [nx, ny] = at(box, 0.7, 0.36);
      let arcs = '';
      for (let i = 1; i <= 4; i++) arcs += `<path d="M${n(sx + 3 + i * 4)} ${n(sy - 2 - i * 3.5)}a${n(i * 3)} ${n(i * 3)} 0 0 1 ${n(i * 2.5)} ${n(i * 3)}" fill="none" stroke="${hsl(hue, 90, 80)}" stroke-width=".3" opacity="${n(1 - i * 0.18)}"/>`;
      return [
        world(`${id}-w`, r.fork('w'), nx + 2, ny + 2, 10, 7),
        f(arcs),
        ship(`${id}-s`, sx, sy, 4.4, 2, p1),
        f(`<g opacity=".9">${icon('combat', ...at(box, 0.12, 0.26), 3.4, hsl(0, 50, 65))}${slash(...at(box, 0.12, 0.26), 2.8)}</g>`),
        f(`<g opacity=".9">${icon('conquer', ...at(box, 0.24, 0.26), 3.4, hsl(0, 50, 65))}${slash(...at(box, 0.24, 0.26), 2.8)}</g>`),
        f(chip(...at(box, 0.86, 0.7), 3.4, 'new')),
      ];
    },
  },

  dangerous: {
    caption: 'two ships break apart together, before any dice are thrown',
    draw: ({ id, r, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.3, 0.5);
      const [bx, by] = at(box, 0.62, 0.42);
      return [
        f(bolt(r.fork('b'), ax + 3, ay - 1, bx - 3, by + 1, 30, 5, 1.6)),
        ...wreck(`${id}-a`, ax, ay, 6.5, p2, 24, r.fork('a')),
        ...wreck(`${id}-b`, bx, by, 6.5, p1, 24, r.fork('bb')),
        f(die(ax, ay, 3.2, 4, p2, { opacity: 0.5, rotate: -25 }) + die(bx, by, 3.2, 2, p1, { opacity: 0.5, rotate: 20 })),
      ];
    },
  },

  devious: {
    caption: 'a ship weaves through two enemy ships; the spaces they hold cost nothing',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.48);
      const g = iso(cx, cy + 1, 6.2);
      const P = (i: number, j: number, lift = 0) => `${n(g.x(i, j))} ${n(g.y(i, j) - lift)}`;
      const d = `M${P(0, 2, 1)}Q${P(0, 1, 16)} ${P(0, 0, 1)}Q${P(0, -1, 16)} ${P(0, -2, 1)}`;
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue),
        f(space(g, 0, 0, hue, { a: 0.35 }) + space(g, 0, -2, hue, { a: 0.35 }) + space(g, 0, 1, p2, { a: 0.1, dash: true }) + space(g, 0, -1, p2, { a: 0.1, dash: true })),
        shipOn(`${id}-a`, g, 0, 2, 3.4, 3, p1, { ghost: true }),
        shipOn(`${id}-e1`, g, 0, 1, 3.6, 5, p2),
        shipOn(`${id}-e2`, g, 0, -1, 3.6, 2, p2),
        arrowPath(`${id}-r`, d, hsl(hue, 90, 82), { w: 0.5 }),
        shipOn(`${id}-s`, g, 0, -2, 3.8, 3, p1),
        f(glyph(g.x(0, 0) + 0.8, g.y(0, 0) + 1.6, '1', 2.6, hsl(hue, 100, 85)) + glyph(g.x(0, -2) + 6, g.y(0, -2) + 1.5, '2', 2.6, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), g.x(0, 0), g.y(0, 0) - 8, 1, 3, 2)),
      ];
    },
  },

  ferocious: {
    caption: 'a ship in a red rage, its shot carrying a −1 on every roll',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.26, 0.58);
      const [bx, by] = at(box, 0.82, 0.32);
      return [
        glow(`${id}-aura`, ax, ay, 12, 10, hue, 0.55),
        f(sparkles(r.fork('emb'), ax, ay, 5, 10, 6, hsl(hue, 100, 75))),
        ...beam(`${id}-b`, ax, ay, bx - 2, by + 1.5, hue, 1.4),
        ship(`${id}-a`, ax, ay, 6, 6, p1),
        ship(`${id}-e`, bx, by, 3.6, 2, p2),
        burst(`${id}-x`, bx - 2, by + 1.5, 5.5, hue, 8, r),
        f(badge((ax + bx) / 2 + 2, (ay + by) / 2 - 6, 3, '−1', hue)),
      ];
    },
  },

  flexible: {
    caption: 'a ship number turned like a dial: one up, or one down',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.52);
      const col = `<rect x="${n(cx - 6)}" y="${n(cy - 16)}" width="12" height="31" rx="3" fill="${hsl(228, 50, 7, 0.55)}" stroke="${hsl(hue, 80, 70)}" stroke-width=".25"/>`;
      return [
        f(col),
        f(die(cx, cy - 10.5, 2.6, 4, p1, { ghost: true }) + die(cx, cy + 10, 2.6, 2, p1, { ghost: true })),
        ship(`${id}-s`, cx, cy, 4.4, 3, p1),
        f(`<path d="M${n(cx - 11)} ${n(cy - 7)}l3 -3 3 3M${n(cx - 11)} ${n(cy + 7)}l3 3 3 -3" fill="none" stroke="${hsl(hue, 90, 80)}" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round"/>`),
        f(glyph(cx + 13, cy - 9.5, '+1', 3.6, hsl(hue, 100, 85)) + glyph(cx + 13, cy + 10, '−1', 3.6, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), cx, cy, 14, 22, 4)),
      ];
    },
  },

  hostile: {
    caption: 'the first kill of the turn sparks an extra action',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.2, 0.62);
      const [wx, wy] = at(box, 0.55, 0.5);
      const [cx, cy] = at(box, 0.82, 0.28);
      return [
        ship(`${id}-a`, ax, ay, 4.8, 6, p1),
        ...beam(`${id}-b`, ax + 2.5, ay - 2, wx - 1, wy, hue, 1.1),
        ...wreck(`${id}-w`, wx, wy, 8, p2, 24, r.fork('w')),
        arrowPath(`${id}-up`, `M${n(wx + 4)} ${n(wy - 4)}Q${n(wx + 8)} ${n(cy + 2)} ${n(cx - 5)} ${n(cy + 1)}`, hsl(hue, 90, 80), { w: 0.4, dash: true }),
        glow(`${id}-g`, cx, cy, 9, 9, hue, 0.5),
        f(chip(cx, cy, 4.6, 'new') + glyph(cx, cy + 9, '+1', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  industrious: {
    caption: 'two drop pods streak down onto the board at once',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.64);
      const g = iso(cx, cy, 6);
      const spots: [number, number][] = [[-1, 1], [1, 0]];
      const out = [grid(`${id}-g`, g, -2, 2, -2, 2, hue, 0.4)];
      spots.forEach(([i, j], k) => {
        const x = g.x(i, j);
        const y = g.y(i, j) - 2;
        out.push(f(space(g, i, j, hue, { a: 0.4 })));
        out.push(...trails(`${id}-t${k}`, r.fork(`t${k}`), x + 0.6, y - 1, -0.3, 1, 22, 1.2, hsl(30, 100, 70), 5));
        out.push(glow(`${id}-h${k}`, x, y + 2, 6, 3, 30, 0.6, 62));
        out.push(shipOn(`${id}-s${k}`, g, i, j, 3.6, [1, 4][k], p1));
      });
      out.push(f(glyph(...at(box, 0.84, 0.26), '×2', 5, hsl(hue, 100, 85))));
      return out;
    },
  },

  ingenious: {
    caption: 'seen from above, a planet and its eight neighbours: ships on the corners now count',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.48);
      const c = 9.5;
      let cells = '';
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const corner = i && j;
          cells += `<rect x="${n(cx + i * c - c / 2 + 0.4)}" y="${n(cy + j * c - c / 2 + 0.4)}" width="${n(c - 0.8)}" height="${n(c - 0.8)}" rx="1" fill="${corner ? hsl(hue, 90, 62, 0.28) : hsl(hue, 80, 50, 0.06)}" stroke="${hsl(hue, 80, corner ? 78 : 60)}" stroke-width="${corner ? 0.3 : 0.18}"${corner ? '' : ' stroke-dasharray=".6 .5"'}/>`;
        }
      const shipAt = (i: number, j: number, v: number) => die(cx + i * c, cy + j * c, 2.4, v, p1);
      return [
        f(cells),
        world(`${id}-w`, r.fork('w'), cx, cy, 4.2, 9),
        f(shipAt(-1, -1, 2) + shipAt(1, -1, 3) + shipAt(1, 1, 4)),
        f([[-1, -1], [1, -1], [1, 1]].map(([i, j]) => line(cx + i * c * 0.72, cy + j * c * 0.72, cx + i * c * 0.38, cy + j * c * 0.38, hsl(hue, 100, 82), 0.4, ' stroke-dasharray=".8 .6"')).join('')),
      ];
    },
  },

  intelligent: {
    caption: 'an 8-world taken with an orbit of 9: one off, and it still counts',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.46, 0.52);
      return [
        f(orbit(cx, cy, 17, 10, hue)),
        world(`${id}-w`, r.fork('w'), cx, cy, 9, 8),
        ship(`${id}-a`, cx - 16, cy + 3, 3.8, 4, p1),
        ship(`${id}-b`, cx + 14, cy - 6, 3.8, 5, p1),
        f(glyph(cx, cy + 0.4, '8', 6, '#fff')),
        f(badge(cx + 24, cy + 6, 3.4, '9', hue)),
        f(glyph(cx + 24, cy - 2, '≈', 4.4, hsl(hue, 100, 85))),
      ];
    },
  },

  patient: {
    caption: 'the turn loop comes round, and at the very end a held Tactic is played',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.36, 0.5);
      const [kx, ky] = at(box, 0.78, 0.46);
      return [
        f(dial(cx, cy, 11, hue, 24, 8)),
        loop(`${id}-l`, cx, cy, 8, hsl(hue, 100, 80), 0.6, -90, 330),
        f(chips(cx, cy, 1.6, ['spent', 'spent', 'spent'])),
        arrowPath(`${id}-ar`, `M${n(cx + 12)} ${n(cy - 4)}Q${n(kx - 6)} ${n(cy - 10)} ${n(kx - 7)} ${n(ky - 3)}`, hsl(hue, 90, 82), { w: 0.4, dash: true }),
        miniCard(`${id}-c`, kx, ky, 11, 352, { dark: true, icon: 'combat', rot: 8, state: 'glow' }),
        f(sparkles(r.fork('sp'), kx, ky, 8, 12, 3)),
      ];
    },
  },

  pioneering: {
    caption: 'a ship plus your research add up to the planet: 5 + 3 = 8',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.48);
      return [
        ship(`${id}-s`, cx - 21, cy, 4.2, 5, p1),
        f(glyph(cx - 13, cy, '+', 4.4, hsl(hue, 100, 85))),
        glow(`${id}-g`, cx - 4, cy, 6, 6, RESEARCH, 0.5),
        f(`<circle cx="${n(cx - 4)}" cy="${n(cy)}" r="4.42" fill="${hsl(RESEARCH, 60, 16)}" stroke="${hsl(RESEARCH, 100, 80)}" stroke-width=".35"/>` + icon('research', cx - 4, cy - 1.2, 3.2, hsl(RESEARCH, 100, 85)) + glyph(cx - 4, cy + 2.2, '3', 2.4, hsl(RESEARCH, 100, 90))),
        f(glyph(cx + 5, cy, '=', 4.4, hsl(hue, 100, 85))),
        world(`${id}-w`, r.fork('w'), cx + 17, cy, 7.5, 8),
        f(glyph(cx + 17, cy + 0.3, '8', 5.4, '#fff')),
      ];
    },
  },

  plundering: {
    caption: 'three data cores burst out of the wreck and fly into the research flask',
    draw: ({ id, r, box, p2 }) => {
      const [wx, wy] = at(box, 0.3, 0.62);
      const [ix, iy] = at(box, 0.72, 0.32);
      const cores = [[-8, -8], [0, -10], [8, -7]];
      return [
        ...wreck(`${id}-w`, wx, wy, 9, p2, 280, r.fork('w')),
        f(die(wx, wy, 3.4, 5, p2, { opacity: 0.45, rotate: -15 })),
        ...cores.map(([dx, dy], k) => arrowPath(`${id}-a${k}`, `M${n(wx + dx * 0.4)} ${n(wy + dy * 0.4)}Q${n(wx + dx)} ${n(wy + dy - 6)} ${n(ix - 5 + k * 2)} ${n(iy + 3)}`, hsl(RESEARCH, 90, 80), { w: 0.3, dash: true })),
        ...cores.map(([dx, dy], k) => glow(`${id}-c${k}`, wx + dx, wy + dy, 2.6, 2.6, RESEARCH, 0.95, 72)),
        glow(`${id}-i`, ix, iy, 9, 9, RESEARCH, 0.45),
        f(icon('research', ix, iy, 8, hsl(RESEARCH, 100, 88), 2)),
        f(glyph(ix + 11, iy + 1, '+3', 4.4, hsl(RESEARCH, 100, 85))),
      ];
    },
  },

  precocious: {
    caption: 'a flask marked 4, 5 and 6 bubbles over at the first line',
    draw: ({ id, r, box }) => {
      const [cx, cy] = at(box, 0.46, 0.6);
      const s = 0.85;
      const body = `M${n(cx - 3 * s)} ${n(cy - 14 * s)}V${n(cy - 6 * s)}L${n(cx - 10 * s)} ${n(cy + 8 * s)}Q${n(cx - 11 * s)} ${n(cy + 11 * s)} ${n(cx - 8 * s)} ${n(cy + 11 * s)}H${n(cx + 8 * s)}Q${n(cx + 11 * s)} ${n(cy + 11 * s)} ${n(cx + 10 * s)} ${n(cy + 8 * s)}L${n(cx + 3 * s)} ${n(cy - 6 * s)}V${n(cy - 14 * s)}`;
      const marks = [4, 5, 6].map((v, k) => {
        const y = cy + 6 * s - k * 4.5 * s - 1;
        return line(cx + 3, y, cx + 7, y, hsl(RESEARCH, 100, 85), 0.3) + `<text x="${n(cx + 9)}" y="${n(y)}" font-family="Orbitron, sans-serif" font-weight="900" font-size="2.4" fill="${hsl(RESEARCH, 100, 85)}" dominant-baseline="central">${v}</text>`;
      }).join('');
      let bubbles = '';
      const rr = r.fork('b');
      for (let i = 0; i < 9; i++) bubbles += `<circle cx="${n(cx + rr.range(-4, 4))}" cy="${n(cy - 14 * s - rr.range(1, 10))}" r="${n(rr.range(0.4, 1.1))}" fill="none" stroke="${hsl(RESEARCH, 100, 85)}" stroke-width=".25"/>`;
      return [
        glow(`${id}-g`, cx, cy + 4, 14, 12, RESEARCH, 0.5),
        {
          defs: `<clipPath id="${id}-cl"><path d="${body}Z"/></clipPath>`,
          body: `<g clip-path="url(#${id}-cl)"><rect x="${n(cx - 15)}" y="${n(cy + 6 * s - 0.5)}" width="30" height="20" fill="${hsl(RESEARCH, 90, 55, 0.75)}"/></g>`,
        },
        f(`<path d="${body}" fill="none" stroke="${hsl(RESEARCH, 60, 88)}" stroke-width=".45" stroke-linejoin="round"/>` + marks + bubbles),
        f(sparkles(r.fork('sp'), cx, cy - 18, 2, 6, 4, hsl(RESEARCH, 100, 88))),
      ];
    },
  },

  prideful: {
    caption: 'dominance blazing early at 4, while an enemy tractor beam reaches for the card',
    draw: ({ id, r, hue, box, p2 }) => {
      const [tx, ty] = at(box, 0.1, 0.28);
      const [cx, cy] = at(box, 0.3, 0.68);
      const [ex, ey] = at(box, 0.82, 0.66);
      return [
        burst(`${id}-b`, trackSlot(tx, 4), ty, 9, DOMINANCE, 8, r),
        f(track(tx, ty, 'dominance', 4, { numbers: true, hot: [4, 5, 6] })),
        f(`<path d="M${n(ex - 3)} ${n(ey - 1)}L${n(cx + 6)} ${n(cy - 7)}L${n(cx + 6)} ${n(cy + 7)}Z" fill="${hsl(p2, 90, 65, 0.18)}"/>` + [0.3, 0.6].map((t) => line(ex - 3 + (cx + 6 - ex + 3) * t, ey - 1 + (cy - 7 - ey + 1) * t, ex - 3 + (cx + 6 - ex + 3) * t, ey - 1 + (cy + 7 - ey + 1) * t, hsl(p2, 90, 80), 0.2, ' opacity=".6"')).join('')),
        miniCard(`${id}-c`, cx, cy, 10, hue, { rot: -10, icon: 'conquer' }),
        ship(`${id}-e`, ex, ey, 4.4, 6, p2),
      ];
    },
  },

  profiteering: {
    caption: 'a world you take launches a missile into your arsenal',
    draw: ({ id, r, hue, box, p1 }) => {
      const [px, py] = at(box, 0.3, 0.66);
      const [mx, my] = at(box, 0.78, 0.26);
      return [
        world(`${id}-w`, r.fork('w'), px, py, 10, 9),
        f(cube(px - 3, py - 9.5, 2.4, p1)),
        f(`<path d="M${n(px + 6)} ${n(py - 6)}Q${n(px + 16)} ${n(py - 22)} ${n(mx - 4)} ${n(my + 2)}" fill="none" stroke="${hsl(30, 100, 70)}" stroke-width=".5" stroke-dasharray=".6 .6" opacity=".8"/>`),
        glow(`${id}-g`, mx, my, 9, 6, hue, 0.5),
        f(missile(mx, my, -25, 2)),
        f(sparkles(r.fork('sp'), mx, my, 4, 8, 4)),
      ];
    },
  },

  rational: {
    caption: 'a 3 held still at the centre of spinning rings',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      return [
        glow(`${id}-g`, cx, cy, 15, 15, hue, 0.35),
        f([0, 60, 120].map((rot, k) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(16 - k)}" ry="${n(5.5 - k * 0.5)}" fill="none" stroke="${hsl(hue, 90, 70 + k * 6)}" stroke-width=".35" transform="rotate(${rot} ${n(cx)} ${n(cy)})"/>`).join('')),
        f(combatDie(cx, cy, 8, 3, 'attack')),
        f(sparkles(r.fork('sp'), cx, cy, 13, 17, 5)),
      ];
    },
  },

  ravenous: {
    caption: 'a ship with a fresh kill: two dominance crests rise, not one',
    draw: ({ id, r, box, p1, p2 }) => {
      const [sx, sy] = at(box, 0.36, 0.56);
      return [
        glow(`${id}-g`, sx, sy, 10, 9, DOMINANCE, 0.45),
        ship(`${id}-s`, sx, sy, 6, 6, p1),
        f(crest(sx + 11, sy - 6, 3.2) + crest(sx + 18.5, sy - 3, 3.2)),
        f(glyph(sx + 13.5, sy - 13, '+1+1', 3.6, hsl(DOMINANCE, 100, 80))),
        ...wreck(`${id}-w`, ...at(box, 0.86, 0.3), 5, p2, 24, r.fork('w')),
      ];
    },
  },

  resourceful: {
    caption: 'a ship scuttled on purpose, its energy recovered as an action',
    draw: ({ id, r, hue, box, p1 }) => {
      const [wx, wy] = at(box, 0.36, 0.56);
      const [cx, cy] = at(box, 0.76, 0.32);
      return [
        ...wreck(`${id}-w`, wx, wy, 10, p1, p1, r.fork('w')),
        f(die(wx, wy, 3.6, 2, p1, { opacity: 0.4, rotate: -20 })),
        arrowPath(`${id}-ar`, `M${n(wx + 6)} ${n(wy - 5)}Q${n(cx - 6)} ${n(wy - 6)} ${n(cx - 5)} ${n(cy + 3)}`, hsl(hue, 90, 80), { w: 0.4, dash: true }),
        glow(`${id}-g`, cx, cy, 9, 9, hue, 0.5),
        f(chip(cx, cy, 5, 'new') + glyph(cx + 8, cy + 6, '+1', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  righteous: {
    caption: 'dominance behind a shield that nothing gets through, research locked away',
    draw: ({ id, r, box }) => {
      // Both tracks centred across the art; a track is about 30 mm wide, its middle 13.7 mm in.
      const mid = box.x + box.w / 2;
      const tx = mid - 13.7;
      const [, ty] = at(box, 0, 0.42);
      const [, ry] = at(box, 0, 0.76);
      return [
        shield(`${id}-sh`, mid, ty, 21, 7, 200),
        f(track(tx, ty, 'dominance', 4)),
        f(track(tx, ry, 'research', 2, { dim: true }) + slash(trackSlot(tx, 6) + 5.5, ry, 2.6)),
        f(icon('shield', mid, ty - 9.5, 3.6, hsl(200, 100, 80))),
        f(sparkles(r.fork('sp'), mid, ty, 22, 27, 3)),
      ];
    },
  },

  ruthless: {
    caption: "a kill shuts down one of the enemy's Skills until your next turn",
    draw: ({ id, r, hue, box, p2 }) => {
      const [wx, wy] = at(box, 0.25, 0.6);
      const [cx, cy] = at(box, 0.68, 0.48);
      let glitch = '';
      const rr = r.fork('gl');
      for (let i = 0; i < 6; i++) glitch += `<rect x="${n(cx - 7 + rr.range(-1, 2))}" y="${n(cy - 9 + rr.range(0, 18))}" width="${n(rr.range(4, 11))}" height="${n(rr.range(0.3, 0.9))}" fill="${hsl(rr.pick([0, 190]), 100, 65)}" opacity=".7"/>`;
      return [
        ...wreck(`${id}-w`, wx, wy, 8, p2, 0, r.fork('w')),
        f(die(wx, wy, 3.4, 5, p2, { opacity: 0.45, rotate: 15 })),
        miniCard(`${id}-c`, cx, cy, 13, p2, { rot: 8, icon: 'combat' }),
        f(`<g opacity=".88">${glitch}</g>`),
        f(`<circle cx="${n(cx + 1)}" cy="${n(cy)}" r="7" fill="${hsl(228, 50, 7, 0.6)}"/>` + icon('lock', cx + 1, cy, 7, hsl(0, 95, 66))),
        f(`<g transform="translate(${n(cx + 11)} ${n(cy - 10)})">${loop(`${id}-l`, 0, 0, 3, hsl(hue, 80, 80), 0.35).body}</g>`, loop(`${id}-l`, 0, 0, 3, hsl(hue, 80, 80), 0.35).defs),
      ];
    },
  },

  steadfast: {
    caption: 'the same ship moves again and again, one action for each leg',
    draw: ({ id, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.48, 0.5);
      const g = iso(cx, cy + 3, 5.2);
      const stops: [number, number][] = [[1, 2], [1, -1], [-2, -1], [-2, -3]];
      const legs = [
        [[1, 2], [1, 1], [1, 0], [1, -1]],
        [[1, -1], [0, -1], [-1, -1], [-2, -1]],
        [[-2, -1], [-2, -2], [-2, -3]],
      ] as [number, number][][];
      const out = [grid(`${id}-g`, g, -3, 2, -3, 3, hue)];
      legs.forEach((leg, k) => out.push(route(`${id}-r${k}`, g, leg, hsl(hue, 90, 70 + k * 6), { lift: 1, w: 0.45 })));
      stops.slice(0, 3).forEach(([i, j], k) => out.push(shipOn(`${id}-g${k}`, g, i, j, 3.2, 5, p1, { ghost: true })));
      out.push(shipOn(`${id}-s`, g, -2, -3, 3.6, 5, p1));
      stops.slice(1).forEach(([i, j]) => out.push(f(chip(g.x(i, j) + 5, g.y(i, j) + 1.5, 1.8, 'lit'))));
      return out;
    },
  },

  stealthy: {
    caption: 'every ship has a ring of forbidden spaces; one open space far away takes the deployment',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      const c = 4.6;
      let cells = '';
      const ships: [number, number, number][] = [[-3, -1, p2], [-2, 1, p2], [2, 1, p1], [3, -1, p2]];
      const blocked = (i: number, j: number) => ships.some(([a, b]) => Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1);
      for (let i = -5; i <= 5; i++)
        for (let j = -2; j <= 2; j++) {
          const target = i === 0 && j === -2;
          const b = blocked(i, j);
          cells += `<rect x="${n(cx + i * c - c / 2 + 0.3)}" y="${n(cy + j * c - c / 2 + 0.3)}" width="${n(c - 0.6)}" height="${n(c - 0.6)}" rx=".6" fill="${target ? hsl(hue, 90, 62, 0.5) : b ? hsl(0, 80, 50, 0.16) : hsl(hue, 60, 50, 0.05)}" stroke="${target ? hsl(hue, 100, 85) : b ? hsl(0, 80, 65, 0.5) : hsl(hue, 60, 60, 0.3)}" stroke-width=".18"/>`;
        }
      return [
        f(cells),
        f(ships.map(([i, j, h]) => die(cx + i * c, cy + j * c, 1.8, 3, h)).join('')),
        pillar(`${id}-p`, cx, box.y - 2, cy - 2 * c, hue, 1.4, 0.6),
        f(die(cx, cy - 2 * c, 2, 6, p1)),
        f(sparkles(r.fork('sp'), cx, cy - 2 * c, 2, 5, 4)),
      ];
    },
  },

  strategic: {
    caption: 'a ship backed by its neighbour fights with −2',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.4, 0.55);
      const g = iso(cx, cy, 6.4);
      const [ex, ey] = at(box, 0.86, 0.3);
      return [
        grid(`${id}-g`, g, -2, 1, -1, 2, hue, 0.4),
        f(space(g, 0, 0, hue, { a: 0.3 }) + space(g, 0, 1, hue, { a: 0.3 })),
        f(line(g.x(0, 0), g.y(0, 0) - 2, g.x(0, 1), g.y(0, 1) - 2, hsl(hue, 100, 80), 0.6, ' stroke-dasharray=".6 .6"')),
        shipOn(`${id}-b`, g, 0, 0, 3.8, 3, p1),
        shipOn(`${id}-a`, g, 0, 1, 3.8, 5, p1),
        ...beam(`${id}-bm`, g.x(0, 0) + 2, g.y(0, 0) - 4, ex - 2.5, ey + 1.5, hue, 1),
        ship(`${id}-e`, ex, ey, 3.6, 4, p2),
        burst(`${id}-x`, ex - 2.5, ey + 1.5, 5, hue, 7, r),
        f(combatDie(...at(box, 0.82, 0.68), 6.4, 2, 'defence', { glow: true, rot: 8 }) + glyph(at(box, 0.82, 0.68)[0] - 9, at(box, 0.82, 0.68)[1], '−2', 4.4, hsl(hue, 100, 80))),
      ];
    },
  },

  stubborn: {
    caption: 'a tie goes to the defender: its shield holds and the attacker burns',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [dx, dy] = at(box, 0.68, 0.42);
      const [ax, ay] = at(box, 0.2, 0.62);
      const [cx, cy] = at(box, 0.38, 0.24);
      return [
        ...beam(`${id}-b`, ax + 2, ay - 1.5, dx - 7, dy + 2, hue, 1),
        ...wreck(`${id}-w`, ax, ay, 6, p2, 22, r.fork('w')),
        f(die(ax, ay, 3.4, 4, p2, { opacity: 0.5, rotate: -20 })),
        ship(`${id}-d`, dx, dy, 4.8, 4, p1),
        shield(`${id}-sh`, dx, dy, 9, 9.5, p1),
        burst(`${id}-x`, dx - 7.5, dy + 2, 4, p1, 6, r),
        f(combatDie(cx - 4, cy, 5.5, 4, 'attack', { rot: -8 }) + glyph(cx + 1, cy + 0.4, '=', 3.6, '#fff') + combatDie(cx + 6, cy, 5.5, 4, 'defence', { rot: 6, glow: true })),
      ];
    },
  },

  tactical: {
    caption: 'three spaces already flown, then one more step straight into an attack',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const g = iso(...at(box, 0.18, 0.4), 6.2);
      return [
        grid(`${id}-g`, g, -1, 5, -1, 1, hue, 0.4),
        f([0, 1, 2].map((k) => space(g, k, 0, hue, { a: 0.08, dash: true })).join('') + space(g, 4, 0, hue, { a: 0.4 })),
        route(`${id}-old`, g, [[0, 0], [1, 0], [2, 0], [3, 0]], hsl(hue, 50, 65), { lift: 1, dash: true, head: false, w: 0.4 }),
        shipOn(`${id}-e`, g, 4, 0, 3.6, 5, p2),
        burst(`${id}-x`, g.x(4, 0), g.y(4, 0) - 2.5, 7, 352, 8, r),
        shipOn(`${id}-s`, g, 3, 0, 3.6, 2, p1),
        arrowPath(`${id}-hop`, `M${n(g.x(3, 0) + 1)} ${n(g.y(3, 0) - 8)}Q${n((g.x(3, 0) + g.x(4, 0)) / 2)} ${n(g.y(3, 0) - 12)} ${n(g.x(4, 0) - 1)} ${n(g.y(4, 0) - 7)}`, hsl(hue, 100, 82), { w: 0.55 }),
        f(glyph(g.x(4, 0) + 7, g.y(4, 0) - 9, '1', 4.2, hsl(hue, 100, 85))),
      ];
    },
  },

  talented: {
    caption: 'room for five Skills, not three',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.5, 1.15);
      const out = [];
      const hues = [192, 352, 138, hue, hue];
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 16;
        const t = (a * Math.PI) / 180;
        const x = cx + Math.sin(t) * 30;
        const y = cy - Math.cos(t) * 30;
        out.push(miniCard(`${id}-c${i}`, x, y, 11, hues[i], { rot: a, icon: ['movement', 'combat', 'conquer', 'card', 'card'][i], state: i >= 3 ? 'glow' : 'normal' }));
      }
      out.push(f(glyph(...at(box, 0.88, 0.2), '5', 7, hsl(hue, 100, 85))));
      out.push(f(sparkles(r.fork('sp'), ...at(box, 0.75, 0.35), 2, 8, 4)));
      return out;
    },
  },

  tyrannical: {
    caption: 'the dominance crest joins the orbit as one more ship number',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.62, 0.62);
      const [tx, ty] = at(box, 0.06, 0.3);
      const gx = cx - 13;
      const gy = cy - 5;
      return [
        f(track(tx, ty, 'dominance', 4, { numbers: true })),
        arrowPath(`${id}-b`, `M${n(trackSlot(tx, 4))} ${n(ty + 2.2)}Q${n(trackSlot(tx, 4) - 2)} ${n(gy - 2)} ${n(gx - 4.5)} ${n(gy)}`, hsl(DOMINANCE, 90, 78), { w: 0.35, dash: true }),
        f(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="14" ry="8" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2"/>`),
        world(`${id}-w`, r.fork('w'), cx, cy, 8, 10),
        glow(`${id}-gg`, gx, gy, 6, 6, DOMINANCE, 0.5),
        f(crest(gx, gy, 3.6) + glyph(gx, gy + 6.4, '4', 3.6, hsl(DOMINANCE, 100, 78))),
        ship(`${id}-s1`, cx + 13, cy + 1, 3.6, 3, p1),
        ship(`${id}-s2`, cx + 2, cy - 11, 3.2, 3, p1),
      ];
    },
  },
};
