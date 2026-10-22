import type { Rng } from '../rng';
import type { PlanetType } from '../tokens';
import { n } from '../svg';

/** What every planet's surface shares: its options, the context a surface is painted in, and the marks drawn on it (index.ts puts a planet together). */

export interface PlanetOptions {
  rng: Rng;
  /** Unique prefix for ids. */
  id: string;
  cx: number;
  cy: number;
  /** Radius in mm. */
  r: number;
  /** Planet number 7–10: sets the colour family. */
  number: number;
  type: PlanetType;
  /** Draw rings; picked from the seed when omitted. */
  rings?: boolean;
}

export interface Surface {
  /** Filter primitives that produce the surface colour. */
  filter: string;
  /** Extra marks drawn on the surface, inside the clip. */
  extra: string;
  extraDefs: string;
  /** Paint for the surface's square, for a filter that starts from it (`SourceGraphic`) rather than from noise. */
  fill?: string;
}

/** Shared by every surface: scale, ids and the seeded noise. */
export interface Ctx {
  o: PlanetOptions;
  hue: number;
  rng: Rng;
  /** mm per unit of the reference 17 mm planet. */
  s: number;
  /** A noise frequency for the reference planet, scaled to this one. */
  f: (x: number) => string;
}

/** A point on the disc, `k` of the radius from the centre at most, spread evenly. */
export function spot(c: Ctx, k: number): { x: number; y: number } {
  const a = c.rng.range(0, Math.PI * 2);
  const d = Math.sqrt(c.rng.next()) * c.o.r * k;
  return { x: c.o.cx + Math.cos(a) * d, y: c.o.cy + Math.sin(a) * d };
}

/** Shaded craters lit from the top left. */
export function craters(c: Ctx, count: number, size: [number, number], strength = 1): Pick<Surface, 'extra' | 'extraDefs'> {
  const id = `${c.o.id}-crater`;
  let extra = '';
  for (let i = 0; i < count; i++) {
    const p = spot(c, 0.85);
    const cr = c.rng.range(...size) * c.s * (c.rng.chance(0.15) ? 1.8 : 1);
    extra += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(cr)}" fill="url(#${id})"/>`;
  }
  const o = (x: number) => n(x * strength);
  return {
    extra,
    extraDefs:
      `<radialGradient id="${id}" fx=".38" fy=".38">` +
      `<stop offset="0" stop-color="#000" stop-opacity="${o(0.38)}"/><stop offset=".72" stop-color="#000" stop-opacity="${o(0.22)}"/>` +
      `<stop offset=".86" stop-color="#fff" stop-opacity="${o(0.2)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
  };
}
