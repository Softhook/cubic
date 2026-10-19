import { TILE_SET, dataUrl, hash, tileSpec, tileSvg } from '@quantum/art';
import { rasterise } from '../files';
import { idle, storeImage, storedImage } from './imageStore';

/**
 * Tile artwork as ready-drawn images. Drawing a tile's SVG (its noise filters) takes ~45 ms, so each
 * tile is drawn once to a bitmap and kept in IndexedDB (imageStore); later games and window resizes
 * reuse it. The stored image carries a hash of the SVG, so changing the artwork redraws it automatically.
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
 * How a tile is drawn for the map: `square` as printed, with its space pads and their hatching (the board
 * draws the number and cubes live); `art` only the painting, starfield and planet, which a hex map cuts
 * its 7-hex tiles from and draws its own spaces on.
 */
export type TileLook = 'square' | 'art';

/** The image URL for a tile (`p7-01`…), drawing and storing it the first time. */
function tileImage(id: string, look: TileLook = 'square'): Promise<string> {
  const name = look === 'square' ? id : `${id}:${look}`;
  let image = images.get(name);
  if (!image) {
    const svg = look === 'square' ? tileSvg(tileSpec(id), { rounded: true, markings: 'spaces' }) : tileSvg(tileSpec(id), { only: 'art' });
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
export function decodedTileImage(id: string, look: TileLook = 'square'): Promise<string> {
  const name = look === 'square' ? id : `${id}:${look}`;
  let image = decoded.get(name);
  if (!image) {
    image = tileImage(id, look).then(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      return url;
    });
    decoded.set(name, image);
  }
  return image;
}

/** Prepares every tile in the set in the background (one per idle moment), so the first game starts at once. */
export async function warmTileImages(): Promise<void> {
  for (const t of TILE_SET) {
    await idle();
    await tileImage(t.id);
  }
}
