import { useEffect, useState } from 'react';
import { TILE_SET, bodySvg, dataUrl, hash, regolithSvg, skySvg, tileSpec, type Spot } from '@quantum/art';
import { rasterise } from '../files';
import { idle, storeImage, storedImage } from './imageStore';

/**
 * Tile artwork as ready-drawn images. Drawing a tile's SVG (its noise filters) takes ~45 ms, so each
 * layer of a tile is drawn once to a bitmap and kept in IndexedDB (imageStore); later games and window
 * resizes reuse it. The stored image carries a hash of the SVG, so changing the artwork redraws it.
 */

/** Pixel size of a stored tile: the largest on-screen tile (3 × 92 px cells) at 2× device pixels. */
const SIZE = 576;

const images = new Map<string, Promise<string>>();
const decoded = new Map<string, Promise<string>>();

// WebP keeps the stored tiles small; browsers that can't encode it give PNG instead.
const draw = (svg: string) => rasterise(svg, SIZE, SIZE, 'image/webp', 0.92);

async function load(id: string, svg: string): Promise<string> {
  const key = `${hash(svg)}:${SIZE}`;
  const stored = await storedImage('tiles', id, key).catch(() => undefined);
  if (stored) return URL.createObjectURL(stored);
  const blob = await draw(svg);
  storeImage('tiles', id, key, blob).catch(() => {});
  return URL.createObjectURL(blob);
}

/**
 * The layers of a tile the map is drawn from (MapTiles): its sky for square or hex spaces, and its body, the
 * planet and moons or a Void tile's heart, which the map places wherever the planet sits. The spaces,
 * labels and markings are drawn live over them. A hex map in a game is on the moon instead (the Regolith
 * look): each tile is one `ground` layer, with the planet's building standing where the planet sits.
 */
export type TileLayer = 'sky-square' | 'sky-hex' | 'body' | 'ground';

/** A tile to draw: its physical id, and for `ground` where its planet sits, in spaces from its middle. */
interface TileRef {
  id: string;
  at?: Spot;
}

function layerSvg({ id, at }: TileRef, layer: TileLayer): string {
  switch (layer) {
    case 'body':
      return bodySvg(tileSpec(id));
    case 'ground':
      return regolithSvg(tileSpec(id), at);
    case 'sky-hex':
      return skySvg(tileSpec(id), 'hex');
    case 'sky-square':
      return skySvg(tileSpec(id), 'square');
  }
}

const nameOf = ({ id, at }: TileRef, layer: TileLayer) =>
  layer === 'ground' && at ? `${id}:${layer}@${at.x.toFixed(3)},${at.y.toFixed(3)}` : `${id}:${layer}`;

/** The image URL for a layer of a tile (`p7-01`…), drawing and storing it the first time. */
function tileImage(tile: TileRef, layer: TileLayer): Promise<string> {
  const name = nameOf(tile, layer);
  let image = images.get(name);
  if (!image) {
    const svg = layerSvg(tile, layer);
    // If drawing or storage fails, fall back to the SVG itself (slower to show, same look).
    image = load(name, svg).catch(() => dataUrl(svg));
    images.set(name, image);
  }
  return image;
}

/**
 * A tile's image URL once the image is decoded at full size, for the map. Drawn as large as it gets
 * (zoomed in), the browser would otherwise decode each tile then, on the first zoom, and drop frames.
 */
export function decodedTileImage(tile: TileRef, layer: TileLayer): Promise<string> {
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
    for (const layer of ['body', 'sky-square'] as const) {
      await idle();
      await tileImage(t, layer);
    }
}

/** A layer of each tile of the map by physical tile id, filled in as each image is ready (`decodedTileImage`). */
export function useTileImages(tiles: readonly TileRef[], layer: TileLayer): Record<string, string> {
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    for (const t of tiles)
      decodedTileImage(t, layer).then((url) => live && setImages((m) => (m[t.id] === url ? m : { ...m, [t.id]: url })));
    return () => {
      live = false;
    };
  }, [tiles, layer]);
  return images;
}
