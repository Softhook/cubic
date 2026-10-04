import { icon } from '../icons';
import { DOMINANCE, FONTS, INK, RESEARCH } from '../tokens';
import { esc, hsl, n, type Fragment } from '../svg';
import { f, line } from './core';
import { glow } from './effects';
import { die, PIPS } from './ships';

/** Big numerals and signs over the art ("+1", "×2", "3"): numbers only, so the art needs no translation. */
export const glyph = (x: number, y: number, text: string, size: number, fill: string, anchor = 'middle') =>
  `<text x="${n(x)}" y="${n(y)}" font-family="${FONTS.title}" font-weight="900" font-size="${n(size)}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="central" stroke="${INK}" stroke-width="${n(size * 0.16)}" stroke-linejoin="round" paint-order="stroke">${esc(text)}</text>`;

/** A HUD panel: the dark glass every readout sits on. */
export const panel = (x: number, y: number, w: number, h: number, hue: number, a = 0.72) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(Math.min(w, h) * 0.22)}" fill="${hsl(228, 50, 7, a)}" stroke="${hsl(hue, 80, 68)}" stroke-width=".25"/>`;

export interface TrackOptions {
  /** Slot size. */
  cell?: number;
  /** Slots lit before this card acts. */
  from?: number;
  /** Slots marked as special (e.g. where the track resets). */
  hot?: number[];
  /** Draw on a HUD panel. */
  panel?: boolean;
  /** Show the slot numbers. */
  numbers?: boolean;
  /** Dim the whole track (it can't change). */
  dim?: boolean;
}

/**
 * A player's research or dominance track, 1–6. Slots up to `value` are lit; slots between `from` and
 * `value` glow white as just gained; slots above `value` but at or above `from` are shown as lost.
 */
export function track(x: number, y: number, kind: 'research' | 'dominance', value: number, o: TrackOptions = {}): string {
  const c = o.cell ?? 3.2;
  const gap = c * 0.3;
  const hue = kind === 'research' ? RESEARCH : DOMINANCE;
  const from = o.from ?? value;
  const w = c * 1.5 + 6 * (c + gap);
  let out = o.panel === false ? '' : panel(x - c * 0.45, y - c * 0.95, w + c * 0.5, c * 1.9, hue);
  out += icon(kind === 'research' ? 'research' : 'dominance', x + c * 0.5, y, c * 1.05, hsl(hue, 90, 75), 2.4);
  for (let i = 1; i <= 6; i++) {
    const sx = x + c * 1.4 + (i - 1) * (c + gap);
    const gained = i > from && i <= value;
    const lost = i <= from && i > value;
    const lit = i <= value;
    const fill = gained ? hsl(hue, 100, 88) : lit ? hsl(hue, 85, 60) : lost ? hsl(hue, 60, 40, 0.35) : 'none';
    out += `<rect x="${n(sx)}" y="${n(y - c / 2)}" width="${n(c)}" height="${n(c)}" rx="${n(c * 0.22)}" fill="${fill}" stroke="${hsl(hue, 85, gained ? 92 : 70)}" stroke-width="${gained ? 0.35 : 0.22}"${lost ? ' stroke-dasharray=".5 .4"' : ''}/>`;
    if (gained) out += `<rect x="${n(sx - 0.5)}" y="${n(y - c / 2 - 0.5)}" width="${n(c + 1)}" height="${n(c + 1)}" rx="${n(c * 0.3)}" fill="none" stroke="${hsl(hue, 100, 80)}" stroke-width=".18" opacity=".7"/>`;
    if (o.hot?.includes(i)) out += `<rect x="${n(sx - 0.55)}" y="${n(y - c / 2 - 0.55)}" width="${n(c + 1.1)}" height="${n(c + 1.1)}" rx="${n(c * 0.32)}" fill="none" stroke="#fff" stroke-width=".3" stroke-dasharray=".7 .45"/>`;
    if (o.numbers) out += `<text x="${n(sx + c / 2)}" y="${n(y + c * 0.08)}" font-family="${FONTS.title}" font-weight="900" font-size="${n(c * 0.52)}" fill="${lit ? INK : hsl(hue, 70, 75)}" text-anchor="middle" dominant-baseline="central">${i}</text>`;
  }
  return o.dim ? `<g opacity=".45">${out}</g>` : out;
}

/** Where slot `i` (1–6) of a track drawn at (x, y) sits. */
export const trackSlot = (x: number, i: number, cell = 3.2) => x + cell * 1.4 + (i - 1) * (cell * 1.3) + cell / 2;

/** One action: a hexagonal chip with the action bolt. */
export function chip(cx: number, cy: number, r: number, hue: number, state: 'lit' | 'dim' | 'new' | 'broken' | 'spent' = 'lit'): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
  }
  d += 'Z';
  if (state === 'dim' || state === 'spent')
    return `<path d="${d}" fill="${hsl(228, 50, 8, 0.6)}" stroke="${hsl(hue, 60, 60)}" stroke-width=".25" stroke-dasharray="${state === 'spent' ? '.7 .5' : 'none'}" opacity=".7"/>` + icon('action', cx, cy, r * 1.1, hsl(hue, 50, 60), 2);
  if (state === 'broken') {
    const crack = `M${n(cx - r * 0.2)} ${n(cy - r)}L${n(cx + r * 0.15)} ${n(cy - r * 0.3)}L${n(cx - r * 0.25)} ${n(cy + r * 0.1)}L${n(cx + r * 0.2)} ${n(cy + r)}`;
    return (
      `<g opacity=".85"><path d="${d}" fill="${hsl(228, 50, 8, 0.7)}" stroke="${hsl(0, 85, 60)}" stroke-width=".3"/>` +
      icon('action', cx, cy, r * 1.1, hsl(0, 40, 45), 2) +
      `<path d="${crack}" fill="none" stroke="${hsl(0, 100, 70)}" stroke-width=".35" stroke-linejoin="round"/></g>`
    );
  }
  const halo = state === 'new' ? `<path d="${d}" fill="none" stroke="#fff" stroke-width=".25" opacity=".6" transform="translate(${n(cx)} ${n(cy)}) scale(1.25) translate(${n(-cx)} ${n(-cy)})"/>` : '';
  return (
    halo +
    `<path d="${d}" fill="${hsl(hue, 90, state === 'new' ? 62 : 52)}" stroke="${hsl(hue, 100, 85)}" stroke-width=".3"/>` +
    `<path d="M${n(cx - r * 0.6)} ${n(cy - r * 0.62)}L${n(cx + r * 0.2)} ${n(cy - r * 0.92)}" stroke="#fff" stroke-width=".25" opacity=".5" stroke-linecap="round"/>` +
    icon('action', cx, cy, r * 1.15, INK, 2.4)
  );
}

/** A row of action chips centred on (cx, cy). */
export function chips(cx: number, cy: number, r: number, hue: number, states: Parameters<typeof chip>[4][]): string {
  const step = r * 2.2;
  return states.map((st, i) => chip(cx + (i - (states.length - 1) / 2) * step, cy, r, hue, st)).join('');
}

/** A combat die: flat and white, to tell it from the ships. */
export function combatDie(cx: number, cy: number, s: number, value: number, hue: number, o: { rot?: number; ghost?: boolean; struck?: boolean; glow?: boolean } = {}): string {
  const h = s / 2;
  const tr = o.rot ? ` transform="rotate(${n(o.rot)} ${n(cx)} ${n(cy)})"` : '';
  if (o.ghost) return `<g${tr} opacity=".5"><rect x="${n(cx - h)}" y="${n(cy - h)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.2)}" fill="none" stroke="${hsl(hue, 70, 80)}" stroke-width=".25" stroke-dasharray=".8 .6"/>${PIPS[value].map(([x, y]) => `<circle cx="${n(cx - h + x * s)}" cy="${n(cy - h + y * s)}" r="${n(s * 0.075)}" fill="${hsl(hue, 70, 80)}"/>`).join('')}</g>`;
  const halo = o.glow ? `<rect x="${n(cx - h - 0.7)}" y="${n(cy - h - 0.7)}" width="${n(s + 1.4)}" height="${n(s + 1.4)}" rx="${n(s * 0.26)}" fill="none" stroke="${hsl(hue, 100, 70)}" stroke-width=".4"/>` : '';
  return (
    `<g${tr}>${halo}` +
    `<rect x="${n(cx - h)}" y="${n(cy - h + s * 0.08)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.2)}" fill="${hsl(228, 40, 30)}"/>` +
    `<rect x="${n(cx - h)}" y="${n(cy - h)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.2)}" fill="${hsl(220, 25, 96)}" stroke="${hsl(hue, 80, 55)}" stroke-width=".25"/>` +
    PIPS[value].map(([x, y]) => `<circle cx="${n(cx - h + x * s)}" cy="${n(cy - h + y * s)}" r="${n(s * 0.08)}" fill="${hsl(hue, 70, 30)}"/>`).join('') +
    (o.struck ? line(cx - h * 1.1, cy + h * 1.1, cx + h * 1.1, cy - h * 1.1, hsl(0, 95, 62), 0.45) : '') +
    `</g>`
  );
}

/** A small card, flat: Skills, Tactics, Commands in the illustrations. `w` is its width; it's 1.4 × as tall. */
export function miniCard(id: string, cx: number, cy: number, w: number, hue: number, o: { rot?: number; icon?: string; dark?: boolean; state?: 'normal' | 'glow' | 'ghost' | 'back' } = {}): Fragment {
  const h = w * 1.4;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const tr = o.rot ? ` transform="rotate(${n(o.rot)} ${n(cx)} ${n(cy)})"` : '';
  const state = o.state ?? 'normal';
  if (state === 'ghost') return f(`<g${tr}><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.1)}" fill="${hsl(hue, 80, 60, 0.06)}" stroke="${hsl(hue, 80, 72)}" stroke-width=".25" stroke-dasharray=".9 .6"/></g>`);
  const paper = o.dark ? hsl(228, 45, 10) : hsl(225, 30, 93);
  const inner = o.dark ? hsl(hue, 70, 70) : hsl(hue, 70, 35);
  if (state === 'back') {
    return {
      defs: `<radialGradient id="${id}-b"><stop offset="0" stop-color="${hsl(hue, 80, 45)}"/><stop offset="1" stop-color="${hsl(228, 50, 10)}"/></radialGradient>`,
      body:
        `<g${tr}><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.1)}" fill="url(#${id}-b)" stroke="${hsl(hue, 80, 70)}" stroke-width=".25"/>` +
        `<rect x="${n(x + w * 0.1)}" y="${n(y + w * 0.1)}" width="${n(w * 0.8)}" height="${n(h - w * 0.2)}" rx="${n(w * 0.06)}" fill="none" stroke="${hsl(hue, 80, 75)}" stroke-width=".15" opacity=".6"/>` +
        die(cx, cy, w * 0.2, 6, hue, { pips: false }) +
        `</g>`,
    };
  }
  const halo = state === 'glow' ? `<rect x="${n(x - 0.8)}" y="${n(y - 0.8)}" width="${n(w + 1.6)}" height="${n(h + 1.6)}" rx="${n(w * 0.14)}" fill="none" stroke="${hsl(hue, 100, 80)}" stroke-width=".35"/>` : '';
  const g = glow(`${id}-g`, cx, cy, w * 1.1, h * 0.85, hue, state === 'glow' ? 0.5 : 0, 60);
  return {
    defs: g.defs + `<linearGradient id="${id}-art" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 70, 30)}"/><stop offset="1" stop-color="${hsl(hue + 40, 60, 14)}"/></linearGradient>`,
    body:
      (state === 'glow' ? g.body : '') +
      `<g${tr}>${halo}` +
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.1)}" fill="${paper}" stroke="${hsl(hue, 80, 60)}" stroke-width=".25"/>` +
      `<rect x="${n(x + w * 0.08)}" y="${n(y + w * 0.08)}" width="${n(w * 0.84)}" height="${n(h * 0.45)}" rx="${n(w * 0.06)}" fill="url(#${id}-art)"/>` +
      `<circle cx="${n(cx)}" cy="${n(y + h * 0.53)}" r="${n(w * 0.13)}" fill="${paper}" stroke="${hsl(hue, 80, 55)}" stroke-width=".18"/>` +
      icon(o.icon ?? 'action', cx, y + h * 0.53, w * 0.16, hsl(hue, 80, 50), 2.6) +
      [0.7, 0.78, 0.86].map((t, i) => line(x + w * 0.2, y + h * t, x + w * (i === 1 ? 0.7 : 0.8), y + h * t, inner, w * 0.035, ' opacity=".55"')).join('') +
      `</g>`,
  };
}
