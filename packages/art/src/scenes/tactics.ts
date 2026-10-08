import { hsl, n } from '../svg';
import {
  arrowPath, at, burst, chips, combatDie, crest, cube, die, DOMINANCE, f, glow, glyph, grid, icon, iso, line, loop, miniCard, missile,
  panel, scrapyard, ship, shipOn, space, sparkles, trails, world, wreck,
  orbit, rings,
  crate,
} from '../kit';
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
    caption: 'a dominance emblem roars out shockwaves: +2, at once',
    draw: ({ id, r, box }) => {
      const [cx, cy] = at(box, 0.42, 0.5);
      return [
        glow(`${id}-g`, cx, cy, 16, 16, DOMINANCE, 0.5),
        f(rings(cx, cy, 9, 4, 4, DOMINANCE, 1, 0.6)),
        f(crest(cx, cy, 7.5)),
        f(glyph(...at(box, 0.82, 0.42), '+2', 7, hsl(DOMINANCE, 100, 78))),
        f(sparkles(r.fork('sp'), cx, cy, 10, 20, 6)),
      ];
    },
  },

  'black-market': {
    caption: 'a smuggled crate cracked open: two missiles inside',
    draw: ({ id, r, hue, box }) => {
      const [cx, cy] = at(box, 0.45, 0.62);
      const s = 8;
      return [
        glow(`${id}-g`, cx, cy - s / 2, 14, 7, 42, 0.6, 60),
        f(crate(cx, cy, s)),
        glow(`${id}-m`, cx + 2, cy - s - 6, 12, 8, hue, 0.4),
        f(missile(cx + 9, cy - s - 9, -35, 1.6) + missile(cx + 12, cy - s - 2, -15, 1.6)),
        f(glyph(...at(box, 0.84, 0.3), '+2', 6, hsl(hue, 100, 80))),
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
      out.push(loop(`${id}-l`, ...at(box, 0.12, 0.72), 4, hsl(hue, 90, 80), 0.45));
      out.push(f(sparkles(r.fork('sp'), cx + Math.sin(0.91) * 40, cy - Math.cos(0.91) * 40, 5, 9, 4)));
      return out;
    },
  },

  momentum: {
    caption: 'a ship whips round a world and comes back for a second, shorter turn',
    draw: ({ id, r, hue, box, p1 }) => {
      const [px, py] = at(box, 0.56, 0.52);
      return [
        world(`${id}-w`, r.fork('w'), px, py, 8),
        arrowPath(`${id}-path`, `M${n(box.x - 2)} ${n(py + 12)}Q${n(px - 6)} ${n(py + 14)} ${n(px + 12)} ${n(py + 2)}Q${n(px + 16)} ${n(py - 10)} ${n(px)} ${n(py - 12)}Q${n(px - 14)} ${n(py - 13)} ${n(px - 24)} ${n(py - 6)}`, hsl(hue, 90, 80), { w: 0.45, dash: true }),
        ...trails(`${id}-t`, r.fork('t'), px - 25, py - 6, -1, 0.4, 10, 1.4, hsl(hue, 90, 75), 4),
        ship(`${id}-s`, px - 26, py - 5, 4, 2, p1),
        f(panel(...at(box, 0.68, 0.14), 13, 7, hue) + chips(at(box, 0.68, 0.14)[0] + 6.5, at(box, 0.68, 0.14)[1] + 3.5, 2.2, ['new', 'new'])),
      ];
    },
  },

  'plan-ahead': {
    caption: 'a holographic plan of the next two turns: every attack marked with a 1',
    draw: ({ id, r, hue, box, p1, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.56);
      const g = iso(cx, cy, 6);
      const targets: [number, number][] = [[1, -2], [2, 1], [-2, 0]];
      return [
        grid(`${id}-g`, g, -3, 3, -3, 3, hue, 0.45),
        shipOn(`${id}-s`, g, 0, 0, 3.6, 3, p1),
        ...targets.map(([i, j], k) => shipOn(`${id}-e${k}`, g, i, j, 3, [5, 2, 6][k], p2, { opacity: 0.75 })),
        ...targets.map(([i, j], k) => arrowPath(`${id}-a${k}`, `M${n(g.x(0, 0))} ${n(g.y(0, 0) - 3)}L${n(g.x(i, j) * 0.85 + g.x(0, 0) * 0.15)} ${n(g.y(i, j) * 0.85 + g.y(0, 0) * 0.15 - 3)}`, hsl(hue, 90, 80), { w: 0.35, dash: true })),
        f(targets.map(([i, j]) => combatDie(g.x(i, j) + 4, g.y(i, j) - 7, 3.4, 1, 'attack', { glow: true })).join('')),
        f(sparkles(r.fork('sp'), cx, cy, 6, 18, 4)),
      ];
    },
  },

  sabotage: {
    caption: "a wire snips in an opponent's console and the third action goes dark",
    draw: ({ id, r, hue, box, p2 }) => {
      const [cx, cy] = at(box, 0.5, 0.36);
      return [
        f(panel(cx - 14, cy - 5, 28, 10, p2, 0.85) + chips(cx, cy, 3.4, ['lit', 'lit', 'dim'])),
        f(`<path d="M${n(cx + 7.5)} ${n(cy + 5)}C${n(cx + 7.5)} ${n(cy + 10)} ${n(cx + 2)} ${n(cy + 11)} ${n(cx + 1)} ${n(cy + 14)}" fill="none" stroke="${hsl(0, 80, 60)}" stroke-width=".5"/><path d="M${n(cx + 1)} ${n(cy + 17)}C${n(cx)} ${n(cy + 20)} ${n(cx - 4)} ${n(cy + 21)} ${n(cx - 6)} ${n(cy + 23)}" fill="none" stroke="${hsl(0, 80, 60)}" stroke-width=".5"/>`),
        burst(`${id}-x`, cx + 1, cy + 15.5, 3.4, hue, 7, r),
        f(sparkles(r.fork('sp'), cx + 1, cy + 15.5, 2, 5, 4, hsl(hue, 100, 80))),
        f(glyph(cx + 18, cy + 14, '−1', 4.6, hsl(hue, 100, 80))),
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
    caption: 'a reserve die thrown in from off the map, tumbling into orbit',
    draw: ({ id, r, hue, box, p1 }) => {
      const [px, py] = at(box, 0.66, 0.56);
      const pts = [[-36, -14, 2.2, 0.3, -40, 2], [-28, -9, 2.7, 0.55, 30, 6], [-20, -4, 3.1, 0.8, -15, 1]] as const;
      return [
        f(orbit(px, py, 15, 7.5, hue)),
        world(`${id}-w`, r.fork('w'), px, py, 8.5),
        f(cube(px + 3, py - 6.5, 2.2, p1)),
        f(`<path d="M${n(px - 40)} ${n(py - 16)}Q${n(px - 24)} ${n(py - 14)} ${n(px - 14)} ${n(py + 1)}" fill="none" stroke="${hsl(hue, 90, 75)}" stroke-width=".35" stroke-dasharray="1 1"/>`),
        f(pts.map(([dx, dy, s, o, rot, v]) => die(px + dx, py + dy, s, v, p1, { opacity: o, rotate: rot })).join('')),
        ship(`${id}-s`, px - 13, py + 3, 3.6, 4, p1),
        f(icon('expansion', ...at(box, 0.14, 0.72), 4, hsl(hue, 100, 80), 3)),
      ];
    },
  },
};
