import { hsl, n } from '../svg';
import {
  arrowPath, at, beam, burst, chip, chips, combatDie, cube, die, DOMINANCE, f, glow, glyph, grid, icon, iso, line, loop, miniCard,
  reticle, RESEARCH, route, scrapyard, shield, ship, shipOn, slash, space, sparkles, track, trackSlot, trails, world, worldOn, wreck, missile,
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
        world(`${id}-w`, r.fork('w'), box.x + 10, box.y + 12, 5.5),
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
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.34, 0.52);
      const card = miniCard(`${id}-c`, cx, cy, 15, hue, { rot: -8, icon: 'action' });
      const pads = [-4.4, 0, 4.4].map((dx) => [cx + dx * 0.99 + 0.8, cy + 8 - dx * 0.14] as const);
      let tokens = pads.map(([x, y]) => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="2" ry="1.2" fill="none" stroke="${hsl(hue, 80, 45)}" stroke-width=".25" stroke-dasharray=".6 .4"/>`).join('');
      tokens += cube(pads[0][0], pads[0][1] - 1.4, 1.6, p1) + cube(pads[1][0], pads[1][1] - 1.4, 1.6, p1);
      const [tx, ty] = at(box, 0.78, 0.42);
      return [
        card,
        f(tokens),
        f(cube(pads[2][0] + 1, pads[2][1] - 7, 1.6, p1, { opacity: 0.85 })),
        arrowPath(`${id}-drop`, `M${n(pads[2][0] + 1)} ${n(pads[2][1] - 4.5)}V${n(pads[2][1] - 2.2)}`, hsl(hue, 90, 80), { w: 0.3 }),
        glow(`${id}-glow`, tx, ty, 11, 11, hue, 0.45),
        f(chip(tx, ty, 6, hue, 'new') + glyph(tx, ty + 11, '+1', 4.4, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), tx, ty, 9, 12, 4)),
      ];
    },
  },

  brilliant: {
    caption: 'dawn over a world, the start of the turn: the research track jumps two slots',
    draw: ({ id, r, box }) => {
      const [x, y] = at(box, 0.5, 1.02);
      const [tx, ty] = at(box, 0.17, 0.33);
      return [
        glow(`${id}-sun`, x + 14, y - 15, 26, 13, 38, 0.75, 70),
        world(`${id}-w`, r.fork('w'), x - 4, y + 30, 44, 8),
        f(`<path d="M${n(x - 40)} ${n(y - 13)}Q${n(x + 4)} ${n(y - 17.5)} ${n(x + 50)} ${n(y - 8)}" fill="none" stroke="${hsl(42, 100, 85)}" stroke-width=".35" opacity=".7"/>`),
        f(track(tx, ty, 'research', 4, { from: 2, numbers: true, cell: 4 })),
        f(glyph(trackSlot(tx, 4, 4) + 7, ty - 6.5, '+2', 4.8, hsl(RESEARCH, 100, 85))),
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
        f(combatDie(dx - 5, dy + 1, 7, 5, hue, { rot: -14, struck: true }) + combatDie(dx + 5, dy + 3, 7, 2, hue, { rot: 9, glow: true })),
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
        f(die(cx - 6.5, cy + 2, 2.6, 2, p1, { opacity: 0.7 }) + die(cx + 7, cy + 3.5, 2.6, 5, p1, { opacity: 0.7 })),
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
    caption: 'one point of dominance traded for three of research',
    draw: ({ id, r, box }) => {
      const [x, y1] = at(box, 0.14, 0.3);
      const y2 = y1 + 12;
      const lost = trackSlot(x, 4, 3.6);
      const gain = trackSlot(x, 4, 3.6);
      return [
        world(`${id}-w`, r.fork('w'), box.x + box.w - 6, box.y + box.h - 4, 9),
        f(track(x, y1, 'dominance', 3, { from: 4, cell: 3.6 })),
        f(track(x, y2, 'research', 5, { from: 2, cell: 3.6 })),
        arrowPath(`${id}-ar`, `M${n(lost)} ${n(y1 + 2.6)}Q${n(lost + 5)} ${n((y1 + y2) / 2)} ${n(gain + 2)} ${n(y2 - 2.8)}`, hsl(RESEARCH, 90, 82), { w: 0.4 }),
        f(glyph(lost - 6, (y1 + y2) / 2, '−1', 3.6, hsl(DOMINANCE, 100, 75)) + glyph(gain + 11, (y1 + y2) / 2 + 0.4, '+3', 3.6, hsl(RESEARCH, 100, 85))),
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
        loop(`${id}-l`, cx, cy - 2, 12, hsl(hue, 90, 80), 0.45, -150, 280),
        f(glyph(...at(box, 0.8, 0.4), '×2', 6.5, hsl(hue, 100, 85))),
        f(sparkles(r.fork('sp'), cx, cy - 10, 6, 11, 4)),
      ];
    },
  },

  curious: {
    caption: 'weapons cold, scanners on: a ship surveys a world and earns an extra Move or Research',
    draw: ({ id, r, hue, box, p1 }) => {
      const [sx, sy] = at(box, 0.24, 0.62);
      const [px, py] = at(box, 0.7, 0.45);
      return [
        f(`<path d="M${n(sx + 3)} ${n(sy - 2)}L${n(px - 7)} ${n(py - 11)}L${n(px - 4)} ${n(py + 10)}Z" fill="${hsl(hue, 90, 70, 0.14)}"/>` + [0.3, 0.55, 0.8].map((t) => `<path d="M${n(sx + 3 + (px - 7 - sx - 3) * t)} ${n(sy - 2 + (py - 11 - sy + 2) * t)}L${n(sx + 3 + (px - 4 - sx - 3) * t)} ${n(sy - 2 + (py + 10 - sy + 2) * t)}" stroke="${hsl(hue, 90, 80)}" stroke-width=".2" opacity=".6"/>`).join('')),
        world(`${id}-w`, r.fork('w'), px + 2, py, 10, 7),
        ship(`${id}-s`, sx, sy, 4.6, 2, p1),
        f(`<g opacity=".9">${reticle(sx - 1, sy + 9, 2, hsl(0, 70, 70))}${slash(sx - 1, sy + 9, 3)}</g>`),
        f(chips(...at(box, 0.24, 0.28), 2.8, hue, ['new']) + icon('movement', at(box, 0.24, 0.28)[0] - 7, at(box, 0.24, 0.28)[1], 3.4, hsl(hue, 90, 80)) + icon('research', at(box, 0.24, 0.28)[0] + 7, at(box, 0.24, 0.28)[1], 3.4, hsl(RESEARCH, 90, 80))),
      ];
    },
  },

  dangerous: {
    caption: 'the defender detonates as the attacker closes in: both ships are lost',
    draw: ({ id, r, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.3, 0.55);
      const [dx, dy] = at(box, 0.58, 0.45);
      let rings = '';
      for (let i = 1; i <= 3; i++) rings += `<circle cx="${n(dx)}" cy="${n(dy)}" r="${n(5 + i * 4.5)}" fill="none" stroke="${hsl(28, 100, 70)}" stroke-width="${n(0.7 - i * 0.15)}" opacity="${n(1 - i * 0.25)}"/>`;
      return [
        ...trails(`${id}-t`, r.fork('t'), ax, ay, 1, -0.3, 14, 2, hsl(p2, 80, 70), 4),
        f(rings),
        ...wreck(`${id}-a`, ax, ay, 6, p2, 20, r.fork('a')),
        ...wreck(`${id}-d`, dx, dy, 11, p1, 34, r.fork('d')),
        f(die(ax, ay, 3.6, 6, p2, { opacity: 0.55, rotate: -25 }) + die(dx + 1.5, dy - 1, 4, 2, p1, { opacity: 0.4, rotate: 30 })),
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
    caption: 'a combat roll of 4 knocked down to 3',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.15, 0.68);
      const [bx, by] = at(box, 0.88, 0.22);
      const [dx, dy] = at(box, 0.5, 0.5);
      return [
        ship(`${id}-a`, ax, ay, 3.8, 6, p1),
        ...beam(`${id}-b`, ax + 2, ay - 2, bx - 2, by + 1.5, hue, 0.9),
        ship(`${id}-e`, bx, by, 3.6, 1, p2),
        burst(`${id}-x`, bx - 2, by + 1.5, 5, hue, 8, r),
        f(combatDie(dx - 8, dy + 1, 6.5, 4, hue, { ghost: true, rot: -8 })),
        arrowPath(`${id}-ar`, `M${n(dx - 3.5)} ${n(dy + 1)}H${n(dx + 2)}`, hsl(hue, 90, 80), { w: 0.45 }),
        f(combatDie(dx + 7, dy + 1, 7.5, 3, hue, { glow: true, rot: 6 })),
        f(glyph(dx + 0, dy - 6.5, '−1', 5, hsl(hue, 100, 80))),
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
        f(chip(cx, cy, 4.6, hue, 'new') + glyph(cx, cy + 9, '+1', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  industrious: {
    caption: 'two ships beamed down in one turn: a second deployment',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      const g = iso(cx, cy + 3, 6.2);
      const cells: [number, number][] = [[-1, 1], [1, -1]];
      const out = [grid(`${id}-g`, g, -2, 2, -2, 2, hue), f(cells.map(([i, j]) => space(g, i, j, hue, { a: 0.4 })).join(''))];
      cells.forEach(([i, j], k) => {
        const x = g.x(i, j);
        const y = g.y(i, j);
        out.push({
          defs: `<linearGradient id="${id}-col${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 90, 75)}" stop-opacity="0"/><stop offset="1" stop-color="${hsl(hue, 90, 80)}" stop-opacity=".55"/></linearGradient>`,
          body: `<path d="M${n(x - 3)} ${n(box.y - 2)}H${n(x + 3)}L${n(x + 5)} ${n(y)}H${n(x - 5)}Z" fill="url(#${id}-col${k})"/>`,
        });
        out.push(shipOn(`${id}-s${k}`, g, i, j, 3.8, k ? 4 : 1, p1, k ? { opacity: 0.75 } : {}));
        out.push(f(sparkles(r.fork(`sp${k}`), x, y - 5, 3, 7, 3)));
      });
      out.push(f(glyph(...at(box, 0.5, 0.2), '×2', 5, hsl(hue, 100, 85))));
      return out;
    },
  },

  ingenious: {
    caption: 'ships on the corners of a planet count toward conquering it',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.5, 0.52);
      const g = iso(cx, cy, 7);
      const diag: [number, number][] = [[-1, 1], [1, -1]];
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue),
        f(diag.map(([i, j]) => space(g, i, j, hue, { a: 0.45, light: 70 })).join('') + [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([i, j]) => space(g, i, j, hue, { a: 0.06, dash: true })).join('')),
        ...worldOn(`${id}-w`, r.fork('w'), g, 0, 0, 4.8, hue, 9),
        f(diag.map(([i, j]) => line(g.x(i, j) * 0.6 + g.x(0, 0) * 0.4, g.y(i, j) * 0.6 + g.y(0, 0) * 0.4 - 3, g.x(0, 0) * 0.85 + g.x(i, j) * 0.15, g.y(0, 0) - 3.5, hsl(hue, 100, 82), 0.4, ' stroke-dasharray="1 .7"')).join('')),
        shipOn(`${id}-s0`, g, -1, 1, 3.6, 3, p1),
        shipOn(`${id}-s1`, g, 1, -1, 3.6, 4, p1),
      ];
    },
  },

  intelligent: {
    caption: 'a 9 world taken with an orbit adding up to 10: off by one is close enough',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.42, 0.5);
      const pts = [[-15, 2], [13, -6]] as const;
      return [
        f(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="16" ry="10" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2"/>`),
        world(`${id}-w`, r.fork('w'), cx, cy, 9, 9),
        ship(`${id}-a`, cx + pts[0][0], cy + pts[0][1], 4, 4, p1),
        ship(`${id}-b`, cx + pts[1][0], cy + pts[1][1], 4, 6, p1),
        f(glyph(cx, cy + 0.5, '9', 6, '#fff')),
        f(`<g>${glyph(...at(box, 0.84, 0.36), '±1', 7, hsl(hue, 100, 80))}</g>`),
        f(glyph(...at(box, 0.84, 0.62), '4+6', 3, hsl(hue, 80, 85))),
      ];
    },
  },

  patient: {
    caption: 'a Tactic held in stasis, waiting for the end of the turn',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      let ticks = '';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r0 = i % 6 ? 15.5 : 14.5;
        ticks += line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 16.5, cy + Math.sin(a) * 16.5, hsl(hue, 80, 75), i % 6 ? 0.2 : 0.4);
      }
      let hex = '';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        hex += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * 12.5)} ${n(cy + Math.sin(a) * 12.5)}`;
      }
      return [
        glow(`${id}-g`, cx, cy, 15, 15, hue, 0.35),
        f(`<path d="${hex}Z" fill="${hsl(hue, 90, 60, 0.08)}" stroke="${hsl(hue, 90, 75)}" stroke-width=".3"/>` + ticks),
        f(`<path d="M${n(cx)} ${n(cy - 16)}A16 16 0 0 1 ${n(cx + 16)} ${n(cy)}" fill="none" stroke="#fff" stroke-width=".6" stroke-linecap="round"/>`),
        miniCard(`${id}-c`, cx, cy, 11, 352, { dark: true, icon: 'combat', rot: 6 }),
        f(sparkles(r.fork('sp'), cx, cy, 16, 19, 4)),
      ];
    },
  },

  pioneering: {
    caption: 'the research track stands in for a ship in orbit around a world',
    draw: ({ id, r, hue, box, p1 }) => {
      const [cx, cy] = at(box, 0.62, 0.62);
      const [tx, ty] = at(box, 0.08, 0.3);
      const gx = cx - 13;
      const gy = cy - 5;
      return [
        f(track(tx, ty, 'research', 3, { numbers: true })),
        arrowPath(`${id}-b`, `M${n(trackSlot(tx, 3))} ${n(ty + 2.2)}Q${n(trackSlot(tx, 3))} ${n(gy - 2)} ${n(gx - 4.5)} ${n(gy)}`, hsl(RESEARCH, 90, 80), { w: 0.35, dash: true }),
        f(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="14" ry="8" fill="none" stroke="${hsl(hue, 80, 70)}" stroke-width=".25" stroke-dasharray="1 1.2"/>`),
        world(`${id}-w`, r.fork('w'), cx, cy, 8, 8),
        glow(`${id}-gg`, gx, gy, 6, 6, RESEARCH, 0.5),
        f(die(gx, gy, 3.6, 3, RESEARCH, { opacity: 0.85 })),
        ship(`${id}-s`, cx + 13, cy + 2, 3.8, 5, p1),
        f(sparkles(r.fork('sp'), gx, gy, 4, 6, 3)),
      ];
    },
  },

  plundering: {
    caption: "a destroyed enemy's wreck salvaged as three research",
    draw: ({ id, r, box, p2 }) => {
      const [wx, wy] = at(box, 0.25, 0.58);
      const [tx, ty] = at(box, 0.38, 0.3);
      let motes = '';
      const rr = r.fork('m');
      for (let i = 0; i < 14; i++) {
        const t = rr.range(0.1, 0.95);
        const ex = trackSlot(tx, 5);
        const x = wx + (ex - wx) * t + Math.sin(t * 6) * 2;
        const y = wy + (ty + 3 - wy) * t;
        motes += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rr.range(0.25, 0.6))}" fill="${hsl(RESEARCH, 100, 82)}" opacity="${n(0.4 + t * 0.6)}"/>`;
      }
      return [
        ...wreck(`${id}-w`, wx, wy, 9, p2, 280, r.fork('w')),
        f(die(wx, wy, 3.6, 4, p2, { opacity: 0.45, rotate: 25 })),
        f(motes),
        f(track(tx, ty, 'research', 5, { from: 2 })),
        f(glyph(trackSlot(tx, 5) + 1, ty + 7, '+3', 4.6, hsl(RESEARCH, 100, 85))),
      ];
    },
  },

  precocious: {
    caption: 'the research track breaks through early, at 4, 5 or 6',
    draw: ({ id, r, box }) => {
      const [tx, ty] = at(box, 0.1, 0.45);
      const c = 4.6;
      const x4 = trackSlot(tx, 4, c);
      return [
        burst(`${id}-b`, x4, ty, 13, RESEARCH, 10, r),
        f(track(tx, ty, 'research', 4, { numbers: true, cell: c, hot: [4, 5, 6] })),
        arrowPath(`${id}-l`, `M${n(x4)} ${n(ty - 4.5)}C${n(x4)} ${n(ty - 13)} ${n(trackSlot(tx, 1, c))} ${n(ty - 13)} ${n(trackSlot(tx, 1, c))} ${n(ty - 5)}`, hsl(RESEARCH, 90, 82), { w: 0.45 }),
        f(sparkles(r.fork('sp'), x4, ty, 6, 11, 5)),
      ];
    },
  },

  prideful: {
    caption: 'dominance breaks through early, but an enemy can haul the card away',
    draw: ({ id, r, hue, box, p2 }) => {
      const [tx, ty] = at(box, 0.12, 0.3);
      const [cx, cy] = at(box, 0.26, 0.68);
      const [ex, ey] = at(box, 0.82, 0.62);
      return [
        burst(`${id}-b`, trackSlot(tx, 4), ty, 9, DOMINANCE, 8, r),
        f(track(tx, ty, 'dominance', 4, { numbers: true, hot: [4, 5, 6] })),
        f(`<path d="M${n(cx + 5)} ${n(cy - 3)}L${n(ex - 3)} ${n(ey - 2)}L${n(ex - 3)} ${n(ey + 2)}L${n(cx + 5)} ${n(cy + 5)}Z" fill="${hsl(p2, 90, 65, 0.16)}"/>`),
        miniCard(`${id}-c`, cx, cy, 10, hue, { rot: 14, icon: 'conquer' }),
        ship(`${id}-e`, ex, ey, 4.4, 6, p2),
      ];
    },
  },

  profiteering: {
    caption: 'a conquest pays out in a missile instead of a card',
    draw: ({ id, r, hue, box, p1 }) => {
      const [px, py] = at(box, 0.25, 0.55);
      const [cx, cy] = at(box, 0.56, 0.35);
      const [mx, my] = at(box, 0.84, 0.6);
      return [
        world(`${id}-w`, r.fork('w'), px, py, 9, 10),
        f(cube(px + 3, py - 5, 2.4, p1)),
        miniCard(`${id}-c`, cx, cy, 8, 24, { state: 'ghost', rot: -10 }),
        arrowPath(`${id}-ar`, `M${n(cx + 4)} ${n(cy + 4)}Q${n(mx - 4)} ${n(cy + 1)} ${n(mx - 3)} ${n(my - 5)}`, hsl(hue, 90, 80), { w: 0.4, dash: true }),
        glow(`${id}-g`, mx, my, 9, 7, hue, 0.45),
        f(missile(mx + 4, my - 2, -30, hue, 1.9)),
        f(sparkles(r.fork('sp'), mx, my, 5, 9, 4)),
      ];
    },
  },

  rational: {
    caption: 'dice tumble everywhere, but this combat roll is always 3',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      const rr = r.fork('d');
      let ghosts = '';
      [[-20, -8], [-17, 9], [18, -9], [20, 8], [-7, -14], [9, 14]].forEach(([dx, dy]) => (ghosts += combatDie(cx + dx, cy + dy, 4.5, rr.int(1, 6), hue, { ghost: true, rot: rr.range(-40, 40) })));
      const br = (sx: number, sy: number) => `<path d="M${n(cx + sx * 8)} ${n(cy + sy * 4)}V${n(cy + sy * 8)}H${n(cx + sx * 4)}" fill="none" stroke="${hsl(hue, 90, 80)}" stroke-width=".5"/>`;
      return [
        f(ghosts),
        glow(`${id}-g`, cx, cy, 11, 11, hue, 0.4),
        f(combatDie(cx, cy, 9, 3, hue) + br(-1, -1) + br(1, -1) + br(-1, 1) + br(1, 1)),
        f(icon('lock', cx + 9, cy - 9, 3.4, hsl(hue, 90, 85))),
      ];
    },
  },

  ravenous: {
    caption: 'a kill feeds dominance twice: the usual point, and one more',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [ax, ay] = at(box, 0.14, 0.7);
      const [wx, wy] = at(box, 0.42, 0.62);
      const [tx, ty] = at(box, 0.36, 0.3);
      return [
        ship(`${id}-a`, ax, ay, 4, 6, p1),
        ...beam(`${id}-b`, ax + 2, ay - 1.5, wx - 1, wy, hue, 1),
        ...wreck(`${id}-w`, wx, wy, 7, p2, DOMINANCE, r.fork('w')),
        f(track(tx, ty, 'dominance', 5, { from: 3 })),
        arrowPath(`${id}-ar`, `M${n(wx + 4)} ${n(wy - 4)}Q${n(trackSlot(tx, 5))} ${n(wy - 4)} ${n(trackSlot(tx, 5))} ${n(ty + 3)}`, hsl(DOMINANCE, 90, 78), { w: 0.4, dash: true }),
        f(glyph(trackSlot(tx, 5) + 7, wy - 2, '+1', 4.6, hsl(DOMINANCE, 100, 80))),
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
        f(chip(cx, cy, 5, hue, 'new') + glyph(cx + 8, cy + 6, '+1', 4, hsl(hue, 100, 85))),
      ];
    },
  },

  righteous: {
    caption: 'dominance behind a shield that nothing gets through, research locked away',
    draw: ({ id, r, box }) => {
      const [tx, ty] = at(box, 0.14, 0.42);
      const [rx, ry] = at(box, 0.14, 0.76);
      const mid = trackSlot(tx, 3.5);
      return [
        shield(`${id}-sh`, mid + 1, ty, 21, 7, 200),
        f(track(tx, ty, 'dominance', 4)),
        f(track(rx, ry, 'research', 2, { dim: true }) + slash(trackSlot(rx, 3.5) + 13, ry, 2.6)),
        f(icon('shield', mid + 1, ty - 9.5, 3.6, hsl(200, 100, 80))),
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
      stops.slice(1).forEach(([i, j]) => out.push(f(chip(g.x(i, j) + 5, g.y(i, j) + 1.5, 1.8, hue, 'lit'))));
      return out;
    },
  },

  stealthy: {
    caption: 'a ship decloaks deep in empty space, far from anyone',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      const g = iso(cx, cy + 1, 5.2);
      const others: [number, number, number][] = [[1, 2, p2], [2, 1, p2], [-2, 1, p1]];
      let zones = '';
      for (const [i, j] of others) for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (di || dj) zones += space(g, i + di, j + dj, 0, { a: 0.12, light: 55, dash: true });
      return [
        grid(`${id}-g`, g, -3, 3, -3, 3, hue),
        f(zones + space(g, -1, -2, hue, { a: 0.45, light: 70 })),
        ...others.map(([i, j, h], k) => shipOn(`${id}-o${k}`, g, i, j, 3, k + 2, h)),
        glow(`${id}-sg`, g.x(-1, -2), g.y(-1, -2) - 2, 8, 6, hue, 0.45),
        shipOn(`${id}-s`, g, -1, -2, 3.6, 6, p1, { opacity: 0.7 }),
        f(sparkles(r.fork('sp'), g.x(-1, -2), g.y(-1, -2) - 3, 3, 7, 5)),
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
        f(combatDie(...at(box, 0.82, 0.68), 6.4, 2, hue, { glow: true, rot: 8 }) + glyph(at(box, 0.82, 0.68)[0] - 9, at(box, 0.82, 0.68)[1], '−2', 4.4, hsl(hue, 100, 80))),
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
        f(combatDie(cx - 4, cy, 5.5, 4, hue, { rot: -8 }) + glyph(cx + 1, cy + 0.4, '=', 3.6, '#fff') + combatDie(cx + 6, cy, 5.5, 4, p1, { rot: 6, glow: true })),
      ];
    },
  },

  tactical: {
    caption: 'a ship that already moved makes one more short hop, straight into an attack',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.5);
      const g = iso(cx, cy + 1, 6.4);
      return [
        grid(`${id}-g`, g, -2, 2, -2, 2, hue),
        f([[2, 1], [1, 1], [0, 1]].map(([i, j]) => space(g, i, j, hue, { a: 0.1, dash: true })).join('')),
        route(`${id}-old`, g, [[2, 1], [1, 1], [0, 1], [0, 0]], hsl(hue, 60, 70), { dash: true, head: false, lift: 1, w: 0.4 }),
        f(space(g, 0, -1, hue, { a: 0.4 })),
        shipOn(`${id}-e`, g, 0, -1, 3.6, 5, p2),
        burst(`${id}-x`, g.x(0, -1), g.y(0, -1) - 2.5, 7.5, 352, 8, r),
        shipOn(`${id}-s`, g, 0, 0, 3.6, 2, p1),
        arrowPath(`${id}-hop`, `M${n(g.x(0, 0) + 1)} ${n(g.y(0, 0) - 8)}Q${n((g.x(0, 0) + g.x(0, -1)) / 2)} ${n(g.y(0, 0) - 13)} ${n(g.x(0, -1) - 1)} ${n(g.y(0, -1) - 7)}`, hsl(hue, 100, 82), { w: 0.55 }),
        f(glyph(g.x(0, -1) + 8, g.y(0, -1) - 9, '+1', 4.4, hsl(hue, 100, 85))),
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
    caption: 'the dominance track joins the orbit as one more ship number',
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
        f(die(gx, gy, 3.6, 4, DOMINANCE, { opacity: 0.9 })),
        ship(`${id}-s1`, cx + 13, cy + 1, 3.6, 3, p1),
        ship(`${id}-s2`, cx + 2, cy - 11, 3.2, 3, p1),
      ];
    },
  },
};
