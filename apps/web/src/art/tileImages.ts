import { useEffect, useState } from 'react';
import {
  BLED,
  TILE,
  TILE_SET,
  bodySvg,
  dataUrl,
  hash,
  regolithMaskSvg,
  regolithSvg,
  skySvg,
  tileSpec,
  type Spot,
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

/** How much bigger than its tile a layer's image is: the ground has the print bleed round it (`regolithSvg`). */
export const layerScale = (layer: TileLayer) => (onGround(layer) ? BLED.w / TILE.size : 1);

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

/**
 * The layers of a tile the map is drawn from (MapTiles): its sky for square or hex spaces, and its body, the
 * planet and moons or a Void tile's heart, which the map places wherever the planet sits. The spaces,
 * labels and markings are drawn live over them. A hex map in a game may be on its world's ground instead
 * (the Regolith look, mapLook): each tile is a `ground` layer, with the planet's building standing where the
 * planet sits, and a `standing` one, the same image cut down to the buildings (and ships and rovers), to go
 * over the spaces' wells.
 */
export type TileLayer = 'sky-square' | 'sky-hex' | 'body' | GroundLayer;

/** A ground tile's two layers, drawn together (`groundImages`). */
type GroundLayer = 'ground' | 'standing';

const onGround = (layer: TileLayer): layer is GroundLayer => layer === 'ground' || layer === 'standing';

/** A tile to draw: its physical id, and for `ground` where its planet sits, in spaces from its middle, and on which world. */
interface TileRef {
  id: string;
  at?: Spot;
  world?: World;
}

/** The layers drawn from an SVG of their own. */
type OwnLayer = Exclude<TileLayer, GroundLayer>;

function layerSvg(id: string, layer: OwnLayer): string {
  switch (layer) {
    case 'body':
      return bodySvg(tileSpec(id));
    case 'sky-hex':
      return skySvg(tileSpec(id), 'hex');
    case 'sky-square':
      return skySvg(tileSpec(id), 'square');
  }
}

const nameOf = ({ id, at, world = 'mars' }: TileRef, layer: TileLayer) =>
  onGround(layer) ? `${id}:${layer}:${world}` + (at ? `@${at.x.toFixed(3)},${at.y.toFixed(3)}` : '') : `${id}:${layer}`;

/**
 * A ground tile's `ground` and `standing` images: the ground drawn once, and cut down by its cheap mask
 * (`regolithMaskSvg`) for what stands, so the two match to the pixel. Stored as a pair, under one key.
 */
function groundImages(tile: TileRef): Promise<Record<GroundLayer, string>> {
  const name = nameOf(tile, 'ground');
  let pair = grounds.get(name);
  if (!pair) {
    const svg = regolithSvg(tileSpec(tile.id), tile.at, tile.world);
    const mask = regolithMaskSvg(tileSpec(tile.id), tile.at);
    const size = Math.round(SIZE * layerScale('ground'));
    const key = `${hash(svg + mask)}:${size}`;
    const ids = { ground: name, standing: nameOf(tile, 'standing') };
    pair = (async () => {
      const [ground, standing] = await Promise.all(
        [ids.ground, ids.standing].map((id) => storedImage('tiles', id, key).catch(() => undefined)),
      );
      if (ground && standing) return { ground: URL.createObjectURL(ground), standing: URL.createObjectURL(standing) };
      const blobs = await rasteriseWithCutout(svg, mask, size, size, 'image/webp', 0.92);
      blobs.forEach((blob, i) => storeImage('tiles', [ids.ground, ids.standing][i], key, blob).catch(() => {}));
      return { ground: URL.createObjectURL(blobs[0]), standing: URL.createObjectURL(blobs[1]) };
    })()
      // If drawing fails, the ground as SVG (slower to show, same look), and nothing over the wells.
      .catch(() => ({ ground: dataUrl(svg), standing: '' }));
    grounds.set(name, pair);
  }
  return pair;
}

/** The image URL for a layer of a tile (`p7-01`…), drawing and storing it the first time. */
function tileImage(tile: TileRef, layer: TileLayer): Promise<string> {
  if (onGround(layer)) return groundImages(tile).then((pair) => pair[layer]);
  const name = nameOf(tile, layer);
  let image = images.get(name);
  if (!image) {
    const svg = layerSvg(tile.id, layer);
    // If drawing or storage fails, fall back to the SVG itself (slower to show, same look).
    image = load(name, svg, Math.round(SIZE * layerScale(layer))).catch(() => dataUrl(svg));
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
