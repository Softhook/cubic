import { useEffect, useState } from 'react';
import { RASTER_AREA, TILE, TILE_SET, dataUrl, hash, rasterLayerSvg, tileSpec, type RasterLayer } from '@quantum/art';
import { rasterise } from '../files';
import { COARSE } from '../game/useMediaQuery';
import { idle, storeImage, storedImage } from './imageStore';

/**
 * Tile artwork as ready-drawn images: the raster layers of a tile (art `rasterLayerSvg`), which the map
 * draws (MapTiles): its sky and its body, the planet and moons or a Void tile's heart, which the map places
 * wherever the planet sits.
 *
 * Drawing a tile's SVG (its noise filters) takes ~45 ms, so each layer of a tile is drawn once to a bitmap and kept
 * in IndexedDB (imageStore); later games and window resizes reuse it. The stored image carries a hash of the SVG,
 * so changing the artwork redraws it.
 */

/**
 * Pixel size of a stored tile: bigger on a computer, so a high-density screen zooms further in sharp, but not on
 * a touch screen (phones, tablets), where it would cost the memory of every tile on the map.
 */
const SIZE = typeof matchMedia === 'function' && !matchMedia(COARSE).matches ? 768 : 576;

/** Device pixels a space of a stored tile has, which sets how far the map zooms in (zoomGeometry `frame`). */
export const SHARP_CELL = (SIZE * TILE.cell) / TILE.size;

/** A layer's image size, px: its area (art `RASTER_AREA`) at the tile's. */
const pixels = (layer: RasterLayer) => Math.round((SIZE * RASTER_AREA[layer].w) / TILE.size);

const images = new Map<string, Promise<string>>();
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

/** A tile to draw: its physical id. */
interface TileRef {
  id: string;
}

const nameOf = ({ id }: TileRef, layer: RasterLayer) => `${id}:${layer}`;

/** The image URL for a layer of a tile (`p7-01`…), drawing and storing it the first time. */
async function tileImage(tile: TileRef, layer: RasterLayer): Promise<string> {
  const name = nameOf(tile, layer);
  let image = images.get(name);
  if (!image) {
    const svg = rasterLayerSvg(tileSpec(tile.id), layer);
    // If drawing or storage fails, fall back to the SVG itself (slower to show, same look).
    image = load(name, svg, pixels(layer)).catch(() => dataUrl(svg));
    images.set(name, image);
  }
  return image;
}

/**
 * A tile's image URL once the image is decoded at full size, for the map. Drawn as large as it gets
 * (zoomed in), the browser would otherwise decode each tile then, on the first zoom, and drop frames.
 */
export function decodedTileImage(tile: TileRef, layer: RasterLayer): Promise<string> {
  const name = nameOf(tile, layer);
  let image = decoded.get(name);
  if (!image) {
    image = tileImage(tile, layer).then(async (url) => {
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
    for (const layer of ['body', 'sky'] as const) {
      await idle();
      await tileImage(t, layer);
    }
}

const NONE: Record<string, string> = {};

/** A layer of each tile of the map, by physical tile id, filled in as each image is ready (`decodedTileImage`). */
export function useTileImages(tiles: readonly TileRef[], layer: RasterLayer): Record<string, string> {
  const of = layer;
  const [shown, setShown] = useState({ of, images: NONE });
  useEffect(() => {
    let live = true;
    for (const t of tiles)
      decodedTileImage(t, layer).then(
        (url) =>
          live &&
          setShown((s) => {
            const images = s.of === of ? s.images : NONE;
            return images[t.id] === url ? s : { of, images: { ...images, [t.id]: url } };
          }),
        (e: unknown) => console.error(e),
      );
    return () => {
      live = false;
    };
  }, [tiles, layer, of]);
  return shown.of === of ? shown.images : NONE;
}
