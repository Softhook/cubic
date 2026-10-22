import { TILE } from '../tokens';
import { document, dieCut, join, n, type Box, type Fragment } from '../svg';
import { groundArt, regolithGroundSvg } from '../regolith';
import { BLED, HEX_TILE_CUT, MID, dieLine, flowerPath, numberCorner, planetSpot } from './geometry';
import { lookShape, lookWorld, type TileLook } from './look';
import { markings } from './markings';
import { inLabel, label, tileLabelFits } from './label';
import { bodyArt, inGutter, skyArt } from './space';
import type { TileSpec } from './set';

/**
 * One map tile, trim 96 × 96 mm, in any look (look.ts): in space, its sky and planet (space.ts) or a Void's
 * heart (voids.ts), or on a world's ground (regolith/); with its flavour label (label.ts) and print markings
 * (markings.ts), all laid out by its shape and where its planet sits (geometry.ts). The tile set is set.ts.
 */

export interface TileOptions {
  /** Include the 3 mm print bleed around the trim. */
  bleed?: boolean;
  /**
   * Print markings: space pads, number badge and cube pads. `'spaces'` draws only the space pads and
   * their hatching, for the game, which draws the number and cube pads itself (they change in play).
   */
  markings?: boolean | 'spaces';
  /** Round the corners (for on-screen use; print uses the die-cut). */
  rounded?: boolean;
  /** Prefix for ids; defaults to the tile id. */
  idPrefix?: string;
  /**
   * Draw only the painted art (no markings) or only the markings (no art), or only what goes `'beneath'`
   * the vectors of an editable tile (`editableTileSvg`): in space, the art; on a world's ground, everything but
   * the planet's cube pads and number, as what stands on the ground goes over the spaces' wells. Default: everything.
   */
  only?: 'art' | 'markings' | 'beneath';
  /** `@font-face` rules to embed, so print files set the number and label in their own fonts, not the system's. */
  fontCss?: string;
  /**
   * How the tile looks (look.ts): 3 × 3 squares (the default) or a 7-hex flower in space, or a hex tile on a
   * world's ground. A hex tile's art is knocked out past its flower (at its outline when `rounded`, otherwise
   * past it by the bleed, if any).
   */
  look?: TileLook;
  /** Where the planet sits, as a map's layout token says it (`TILE_SPOTS`): the middle when absent. */
  planetAt?: string;
  /**
   * On a world's ground, a bitmap of its lit ground (a data URL of `tileGroundSvg`, drawn at
   * `REGOLITH_GROUND_PX`) in place of its lighting filter: print draws it so, as its light falls into contour
   * lines at a print's resolution (regolith/core.ts `LIT`).
   */
  ground?: string;
}

/** Moves a fragment's drawing (not its defs) by (dx, dy) mm. */
const moved = (f: Fragment, dx: number, dy: number): Fragment =>
  dx || dy ? { defs: f.defs, body: `<g transform="translate(${n(dx)} ${n(dy)})">${f.body}</g>` } : f;

/**
 * How a tile is laid out for its look and where its planet sits (`TileOptions`): the planet's spot and
 * its middle in mm, whether it has its label, moving a fragment drawn round the tile's middle onto the
 * planet, and the markings.
 */
function tileLayout(spec: TileSpec, o: Pick<TileOptions, 'look' | 'planetAt' | 'markings'>) {
  const shape = lookShape(o.look);
  const at = planetSpot(shape, o.planetAt);
  const p = { x: MID + at.x * TILE.cell, y: MID + at.y * TILE.cell };
  return {
    shape,
    world: lookWorld(o.look),
    at,
    p,
    labelled: spec.number > 0 && tileLabelFits(shape, at),
    shift: (f: Fragment) => moved(f, p.x - MID, p.y - MID),
    marks: (part: 'all' | 'spaces' | 'planet' = o.markings === 'spaces' ? 'spaces' : 'all') => markings(spec, part, shape, at),
  };
}

/**
 * One map tile (trim 96 × 96 mm) as a standalone SVG document: its sky, planet (or Void heart), label and
 * markings, or its world's ground with what stands on it. A square tile with its planet in the middle as
 * printed, or one in another look, or with its planet elsewhere (`look`, `planetAt`).
 */
export function tileSvg(spec: TileSpec, o: TileOptions = {}): string {
  const id = o.idPrefix ?? spec.id;
  const b = o.bleed ? TILE.bleed : 0;
  const area: Box = { x: -b, y: -b, w: TILE.size + 2 * b, h: TILE.size + 2 * b };
  const t = tileLayout(spec, o);

  if (o.only === 'markings') return document(t.marks(), area);
  const ground = t.world && groundArt(spec, t.at, t.world, o.ground);
  // In space, all that's beneath an editable tile's vectors is its art.
  const only = o.only === 'beneath' && !ground ? 'art' : o.only;
  const parts: Fragment[] = ground
    ? [ground]
    : [
        skyArt(
          spec,
          id,
          BLED,
          // A Void keeps the planet's strips clear too, as printed.
          (x, y) => inGutter(t.shape, t.p, numberCorner(t.at, t.shape), tileLabelFits(t.shape, t.at), x, y),
          t.labelled ? (x: number, y: number) => !inLabel(t.p, x, y) : undefined,
        ),
        t.shift(bodyArt(spec, id)),
      ];
  if (t.labelled && only !== 'art') parts.push(t.shift(label(spec)));
  if (o.markings && only !== 'art') {
    // What stands on the ground goes over the spaces' wells, and the planet's cube pads and number over it.
    const planet = o.markings === 'spaces' || only === 'beneath' ? [] : [t.marks('planet')];
    if (ground?.standing) parts.push(t.marks('spaces'), ground.standing, ...planet);
    else parts.push(planet.length ? t.marks() : t.marks('spaces'));
  }

  const all = join(...parts);
  // A hex tile's art is knocked out past its flower, so the paper shows its shape: at the cut on screen
  // (`rounded`), and with its bleed past the cut in print files.
  if (t.shape === 'hex')
    return document(
      {
        defs: all.defs + `<clipPath id="${id}-flower"><path d="${flowerPath(o.rounded ? 0 : b)}"/></clipPath>`,
        body: `<g clip-path="url(#${id}-flower)">${all.body}</g>`,
      },
      area,
      true,
      o.fontCss,
    );
  return document(o.rounded ? dieCut(all, id, TILE.size, TILE.size, TILE.corner) : all, area, true, o.fontCss);
}

/**
 * On a world's ground, the tile's lit ground alone, to draw as a bitmap at `REGOLITH_GROUND_PX` and pass back
 * to `tileSvg` as its `ground`; nothing in space, where there's no ground to light.
 */
export function tileGroundSvg(spec: TileSpec, o: Pick<TileOptions, 'look' | 'planetAt'>): string | undefined {
  const world = lookWorld(o.look);
  return world && regolithGroundSvg(spec, world, planetSpot('hex', o.planetAt));
}

/**
 * A tile for Illustrator and other editors that can't render SVG filters: the painted art as an embedded
 * bitmap (pass a PNG data URL of `tileSvg(spec, { only: 'beneath', … })`), with the label and markings on top
 * as vectors. Each sits in its own named group, which Illustrator opens as layers. On a world's ground,
 * whose buildings stand over the spaces' wells, the bitmap holds those wells and only the planet's cube pads
 * and number go over it.
 */
export function editableTileSvg(
  spec: TileSpec,
  artPng: string,
  o: Pick<TileOptions, 'bleed' | 'markings' | 'look' | 'planetAt'> = {},
): string {
  const b = o.bleed ? TILE.bleed : 0;
  const w = TILE.size + 2 * b;
  const area: Box = { x: -b, y: -b, w, h: w };
  const t = tileLayout(spec, o);
  const beneath = !!t.world;
  const marks = o.markings ? t.marks(beneath ? 'planet' : undefined) : { defs: '', body: '' };
  const flavour = t.labelled && !beneath ? t.shift(label(spec)).body : '';
  // A hex tile's die-cut line on a layer of its own, for the print service (a square tile is cut at the trim).
  const cut = t.shape === 'hex' ? `<g id="cut">${dieLine(HEX_TILE_CUT)}</g>` : '';
  return document(
    {
      defs: marks.defs,
      body:
        `<g id="art"><image x="${n(-b)}" y="${n(-b)}" width="${n(w)}" height="${n(w)}" preserveAspectRatio="none" href="${artPng}" xlink:href="${artPng}"/></g>` +
        `<g id="label">${flavour}</g>` +
        `<g id="markings">${marks.body}</g>` +
        cut,
    },
    area,
  ).replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
}
