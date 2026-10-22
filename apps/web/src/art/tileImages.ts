import { useEffect, useState } from 'react';
import {
  BLED,
  TILE,
  TILE_SET,
  bodySvg,
  dataUrl,
  hash,
  lookShape,
  lookWorld,
  regolithMaskSvg,
  regolithSvg,
  skySvg,
  tileSpec,
  type Spot,
  type TileLook,
  type World,
} from '@quantum/art';
import { rasterise, rasteriseWithCutout } from '../files';
import { idle, storeImage, storedImage } from './imageStore';

/**
 * Tile artwork as ready-drawn images. Drawing a tile's SVG (its noise filters) takes ~45 ms, so each
 * layer of a tile is drawn once to a bitmap and kept in IndexedDB (imageStore); later games and window
 * resizes reuse it. The stored image carries a hash of the SVG, so changing the artwork redraws it.
 */

/** Pixel size of a stored tile: the largest on-screen tile (3 × 92 px cells) at 2× device pixels. */
const SIZE = 576;

/**
 * The layers of a tile the map is drawn from (MapTiles), in its look (art `TileLook`). Its `back`: in space,
 * its sky for square or hex spaces; on a world's ground (the Regolith look, mapLook), the ground with the
 * planet's building standing where the planet sits. In space, its `body`, the planet and moons or a Void
 * tile's heart, which the map places wherever the planet sits. On the ground, what's `standing`: the back cut
 * down to the buildings (and ships and rovers), to go over the spaces' wells. The spaces, labels and markings
 * are drawn live over them.
 */
export type TileLayer = 'back' | 'body' | 'standing';

/** How much bigger than its tile a layer's image is: the ground has the print bleed round it (`regolithSvg`). */
export const layerScale = (look: TileLook, layer: TileLayer) => (layer !== 'body' && lookWorld(look) ? BLED.w / TILE.size : 1);

const images = new Map<string, Promise<string>>();
const grounds = new Map<string, Promise<Record<GroundLayer, string>>>();
const decoded = new Map<string, Promise<string>>();

// WebP keeps the stored tiles small; browsers that can't encode it give PNG instead.
const draw = (svg: string, size: number) => rasterise(svg, size, size, 'image/webp', 0.92);

async function load(id: string, svg: string, size: number): Promise<string> {
  const key = `${hash(svg)}:${size}`;
  const stored = await storedImage('tiles', id, key).catch(() => undefined);
  if (stored) return URL.createObjectURL(stored);
  const blob = await draw(svg, size);
  storeImage('tiles', id, key, blob).catch(() => {});
  return URL.createObjectURL(blob);
}

/** A ground tile's two layers, drawn together (`groundImages`). */
type GroundLayer = Exclude<TileLayer, 'body'>;

/** A tile to draw: its physical id, and where its planet sits, in spaces from its middle (the ground's building stands there). */
interface TileRef {
  id: string;
  at?: Spot;
}

const nameOf = ({ id, at }: TileRef, look: TileLook, layer: TileLayer) => {
  const world = layer !== 'body' && lookWorld(look);
  if (world) return `${id}:${layer}:${world}` + (at ? `@${at.x.toFixed(3)},${at.y.toFixed(3)}` : '');
  return layer === 'body' ? `${id}:body` : `${id}:sky-${look}`;
};

/**
 * A ground tile's `back` and `standing` images: the ground drawn once, and cut down by its cheap mask
 * (`regolithMaskSvg`) for what stands, so the two match to the pixel. Stored as a pair, under one key.
 */
function groundImages(tile: TileRef, world: World): Promise<Record<GroundLayer, string>> {
  const name = nameOf(tile, world, 'back');
  let pair = grounds.get(name);
  if (!pair) {
    const svg = regolithSvg(tileSpec(tile.id), world, tile.at);
    const mask = regolithMaskSvg(tileSpec(tile.id), tile.at);
    const size = Math.round(SIZE * layerScale(world, 'back'));
    const key = `${hash(svg + mask)}:${size}`;
    const ids = [name, nameOf(tile, world, 'standing')];
    pair = (async () => {
      const [back, standing] = await Promise.all(ids.map((id) => storedImage('tiles', id, key).catch(() => undefined)));
      if (back && standing) return { back: URL.createObjectURL(back), standing: URL.createObjectURL(standing) };
      const blobs = await rasteriseWithCutout(svg, mask, size, size, 'image/webp', 0.92);
      blobs.forEach((blob, i) => storeImage('tiles', ids[i], key, blob).catch(() => {}));
      return { back: URL.createObjectURL(blobs[0]), standing: URL.createObjectURL(blobs[1]) };
    })()
      // If drawing fails, the ground as SVG (slower to show, same look), and nothing over the wells.
      .catch(() => ({ back: dataUrl(svg), standing: '' }));
    grounds.set(name, pair);
  }
  return pair;
}

/** The image URL for a layer of a tile (`p7-01`…) in a look, drawing and storing it the first time. In space nothing stands. */
function tileImage(tile: TileRef, look: TileLook, layer: TileLayer): Promise<string> {
  const world = lookWorld(look);
  if (world && layer !== 'body') return groundImages(tile, world).then((pair) => pair[layer]);
  if (layer === 'standing') return Promise.resolve('');
  const name = nameOf(tile, look, layer);
  let image = images.get(name);
  if (!image) {
    const spec = tileSpec(tile.id);
    const svg = layer === 'body' ? bodySvg(spec) : skySvg(spec, lookShape(look));
    // If drawing or storage fails, fall back to the SVG itself (slower to show, same look).
    image = load(name, svg, SIZE).catch(() => dataUrl(svg));
    images.set(name, image);
  }
  return image;
}

/**
 * A tile's image URL once the image is decoded at full size, for the map. Drawn as large as it gets
 * (zoomed in), the browser would otherwise decode each tile then, on the first zoom, and drop frames.
 */
export function decodedTileImage(tile: TileRef, look: TileLook, layer: TileLayer): Promise<string> {
  const name = nameOf(tile, look, layer);
  let image = decoded.get(name);
  if (!image) {
    image = tileImage(tile, look, layer).then(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      return url;
    });
    decoded.set(name, image);
  }
  return image;
}

/**
 * Prepares every tile in the set in the background (one layer per idle moment), so the first game starts
 * at once: the bodies and the square skies (most maps are square).
 */
export async function warmTileImages(): Promise<void> {
  for (const t of TILE_SET)
    for (const layer of ['body', 'back'] as const) {
      await idle();
      await tileImage(t, 'square', layer);
    }
}

const NONE: Record<string, string> = {};

/**
 * A layer of each tile of the map in a look, by physical tile id, filled in as each image is ready
 * (`decodedTileImage`). Only that look's: when the look changes (the map switched to its ground, or back),
 * none of the last one's, which is drawn at a different size.
 */
export function useTileImages(tiles: readonly TileRef[], look: TileLook, layer: TileLayer): Record<string, string> {
  const of = `${look}:${layer}`;
  const [shown, setShown] = useState({ of, images: NONE });
  useEffect(() => {
    let live = true;
    for (const t of tiles)
      decodedTileImage(t, look, layer).then(
        (url) =>
          live &&
          setShown((s) => {
            const images = s.of === of ? s.images : NONE;
            return images[t.id] === url ? s : { of, images: { ...images, [t.id]: url } };
          }),
      );
    return () => {
      live = false;
    };
  }, [tiles, look, layer, of]);
  return shown.of === of ? shown.images : NONE;
}
