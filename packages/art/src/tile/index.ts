import { TILE } from '../tokens';
import { document, dieCut, join, n, type Box, type Fragment } from '../svg';
import { BLED, HEX_TILE_CUT, MID, TRIM, betweenSpaces, dieLine, flowerPath, numberCorner, planetSpot } from './geometry';
import { lookShape, type TileLook } from './look';
import { markings } from './markings';
import { inLabel, label, tileLabelFits } from './label';
import { bodyArt, bodySvg, inGutter, skyArt, skySvg } from './space';
import { BLANK, type TileSpec } from './set';

/**
 * One map tile, trim 96 × 96 mm, in any look (look.ts), as layers (`tileLayers`): in space, its sky and planet
 * (space.ts) or a Void's heart (voids.ts); its flavour label (label.ts) and print markings (markings.ts), all laid out by its shape and where its planet sits (geometry.ts). Print draws
 * them in one piece (`tileSvg`), an editor as a bitmap and vectors (`editableTileSvg`), and the map in the same
 * order, some as images (the game's MapTiles). The tile set is set.ts.
 */

export interface TileOptions {
  /** Include the 3 mm print bleed around the trim. */
  bleed?: boolean;
  /**
   * Print markings: the spaces' wells and the planet's cube pads and number. `'spaces'` draws only the
   * spaces, for the game's rulebook, which draws the number and cube pads itself.
   */
  markings?: boolean | 'spaces';
  /** Round the corners (for on-screen use; print uses the die-cut). */
  rounded?: boolean;
  /** Prefix for ids; defaults to the tile id. */
  idPrefix?: string;
  /**
   * Draw only the layers an editor can't keep as vectors (`isRaster`): those up to the last of them, which
   * `editableTileSvg` takes as its bitmap and draws the rest over as vectors.
   */
  raster?: boolean;
  /** `@font-face` rules to embed, so print files set the number and label in their own fonts, not the system's. */
  fontCss?: string;
  /**
   * How the tile looks (look.ts): 3 × 3 squares (the default) or a 7-hex flower. A hex tile's art is knocked out past its flower (at its outline when `rounded`, otherwise
   * past it by the bleed, if any).
   */
  look?: TileLook;
  /** Where the planet sits, as a map's layout token says it (`TILE_SPOTS`): the middle when absent. */
  planetAt?: string;
}

/** A tile's layers: what each look draws, one on another (`tileLayerNames`). */
export type TileLayerName = 'sky' | 'body' | 'label' | 'spaces' | 'planet';

/**
 * Each look's layers, bottom first, as print, the Art Lab and the map all draw them. In space: the sky, the
 * body (the planet and its moons, or a Void's heart, on the planet's space), the planet's label (only a square
 * tile has room), the spaces' wells, and the planet's cube pads and number.
 */
const LAYERS: Record<TileLook, readonly TileLayerName[]> = {
  square: ['sky', 'body', 'label', 'spaces', 'planet'],
  hex: ['sky', 'body', 'spaces', 'planet'],
};

/** A look's layers, bottom first (`LAYERS`). */
export const tileLayerNames = (look: TileLook = 'square'): readonly TileLayerName[] => LAYERS[look];

/**
 * The layers drawn with filters, and the area each covers in trim mm when drawn alone for the map
 * (`rasterLayerSvg`): the tile. An editor that can't render filters takes them as a bitmap (`editableTileSvg`); the others are plain vectors.
 */
export const RASTER_AREA = { sky: TRIM, body: TRIM } as const;

export type RasterLayer = keyof typeof RASTER_AREA;

export const isRaster = (layer: TileLayerName): layer is RasterLayer => layer in RASTER_AREA;

/** One of a tile's layers, in trim mm. */
export interface TileLayer {
  name: TileLayerName;
  art: Fragment;
}

/** Moves a fragment's drawing (not its defs) by (dx, dy) mm. */
const moved = (f: Fragment, dx: number, dy: number): Fragment =>
  dx || dy ? { defs: f.defs, body: `<g transform="translate(${n(dx)} ${n(dy)})">${f.body}</g>` } : f;

/**
 * How a tile is laid out for its look and where its planet sits (`TileOptions`): the planet's spot and
 * its middle in mm, whether it has its label, moving a fragment drawn round the tile's middle onto the
 * planet, and its markings, the spaces' or the planet's.
 */
function tileLayout(spec: TileSpec, o: Pick<TileOptions, 'look' | 'planetAt'>) {
  const shape = lookShape(o.look);
  const at = planetSpot(shape, o.planetAt);
  const p = { x: MID + at.x * TILE.cell, y: MID + at.y * TILE.cell };
  return {
    shape,
    at,
    p,
    labelled: spec.number > 0 && tileLabelFits(shape, at),
    shift: (f: Fragment) => moved(f, p.x - MID, p.y - MID),
    marks: (part: 'spaces' | 'planet') => markings(spec, part, shape, at),
  };
}

/**
 * A tile's layers in its look, bottom first (`tileLayerNames`): those it has, so a label only where it fits,
 * and markings only when asked for.
 */
export function tileLayers(spec: TileSpec, o: TileOptions = {}): TileLayer[] {
  const id = o.idPrefix ?? spec.id;
  const t = tileLayout(spec, o);
  const art: Record<TileLayerName, () => Fragment | undefined> = {
    sky: () =>
      skyArt(
        spec,
        id,
        BLED,
        // A Void keeps the planet's strips clear too, as printed; a blank, with nothing to keep them for, only the spaces.
        (x, y) =>
          spec.number === BLANK
            ? betweenSpaces(t.shape, x, y)
            : inGutter(t.shape, t.p, numberCorner(t.at, t.shape), tileLabelFits(t.shape, t.at), x, y),
        t.labelled ? (x: number, y: number) => !inLabel(t.p, x, y) : undefined,
      ),
    body: () => t.shift(bodyArt(spec, id)),
    label: () => (t.labelled ? t.shift(label(spec)) : undefined),
    spaces: () => (o.markings ? t.marks('spaces') : undefined),
    planet: () => (o.markings === true ? t.marks('planet') : undefined),
  };
  return tileLayerNames(o.look).flatMap((name) => {
    const f = art[name]();
    return f ? [{ name, art: f }] : [];
  });
}

/** Where a tile's raster layers end (`isRaster`): the index of the last of them, or -1. */
const rasterEnd = (layers: TileLayer[]) => layers.reduce((end, l, i) => (isRaster(l.name) ? i : end), -1);

/**
 * One map tile (trim 96 × 96 mm) as a standalone SVG document: its layers (`tileLayers`) in one piece. A square
 * tile with its planet in the middle as printed, or one in another look, or with its planet elsewhere
 * (`look`, `planetAt`); or only its raster layers (`raster`).
 */
export function tileSvg(spec: TileSpec, o: TileOptions = {}): string {
  const id = o.idPrefix ?? spec.id;
  const b = o.bleed ? TILE.bleed : 0;
  const area: Box = { x: -b, y: -b, w: TILE.size + 2 * b, h: TILE.size + 2 * b };
  const layers = tileLayers(spec, o);
  const all = join(...(o.raster ? layers.slice(0, rasterEnd(layers) + 1) : layers).map((l) => l.art));
  // A hex tile's art is knocked out past its flower, so the paper shows its shape: at the cut on screen
  // (`rounded`), and with its bleed past the cut in print files.
  if (lookShape(o.look) === 'hex')
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
 * One of a tile's raster layers in a look alone, over its `RASTER_AREA`, as the map draws it to an image and keeps
 * it. Unlike a printed tile's, each does for its tile wherever the map puts its planet: the `sky` keeps its bright
 * stars in the gutters between all the spaces, and the `body` is centred on the tile, for the map to move onto
 * the planet's space.
 */
export function rasterLayerSvg(spec: TileSpec, look: TileLook, layer: RasterLayer): string {
  return layer === 'sky' ? skySvg(spec, lookShape(look)) : bodySvg(spec);
}

/**
 * A tile for Illustrator and other editors that can't render SVG filters: its raster layers as an embedded
 * bitmap (pass a PNG data URL of `tileSvg(spec, { raster: true, … })`), with the label and the markings over
 * it as vectors. Each sits in its own named group, which Illustrator opens as layers.
 */
export function editableTileSvg(
  spec: TileSpec,
  artPng: string,
  o: Pick<TileOptions, 'bleed' | 'markings' | 'look' | 'planetAt'> = {},
): string {
  const b = o.bleed ? TILE.bleed : 0;
  const w = TILE.size + 2 * b;
  const area: Box = { x: -b, y: -b, w, h: w };
  const layers = tileLayers(spec, o);
  const vectors = layers.slice(rasterEnd(layers) + 1);
  const group = (...names: TileLayerName[]) => join(...vectors.filter((l) => names.includes(l.name)).map((l) => l.art));
  const [flavour, marks] = [group('label'), group('spaces', 'planet')];
  // A hex tile's die-cut line on a layer of its own, for the print service (a square tile is cut at the trim).
  const cut = lookShape(o.look) === 'hex' ? `<g id="cut">${dieLine(HEX_TILE_CUT)}</g>` : '';
  return document(
    {
      defs: flavour.defs + marks.defs,
      body:
        `<g id="art"><image x="${n(-b)}" y="${n(-b)}" width="${n(w)}" height="${n(w)}" preserveAspectRatio="none" href="${artPng}" xlink:href="${artPng}"/></g>` +
        `<g id="label">${flavour.body}</g>` +
        `<g id="markings">${marks.body}</g>` +
        cut,
    },
    area,
  ).replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
}
