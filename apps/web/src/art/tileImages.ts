import { TILE_SET, dataUrl, hash, tileSpec, tileSvg } from '@quantum/art';
import { rasterise } from '../files';

/**
 * Tile artwork as ready-drawn images. Drawing a tile's SVG (its noise filters) takes ~45 ms, so each
 * tile is drawn once to a bitmap and kept in IndexedDB; later games and window resizes reuse it. The
 * stored image carries a hash of the SVG, so changing the artwork redraws it automatically.
 */

/** Pixel size of a stored tile: the largest on-screen tile (3 × 92 px cells) at 2× device pixels. */
const SIZE = 576;
const DB_NAME = 'quantum-art';
const STORE = 'tiles';

interface Stored {
  key: string;
  blob: Blob;
}

const images = new Map<string, Promise<string>>();
let database: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return database;
}

async function dbGet(id: string): Promise<Stored | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Stored | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(id: string, value: Stored): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// WebP keeps the stored tiles small; browsers that can't encode it give PNG instead.
const draw = (svg: string) => rasterise(svg, SIZE, SIZE, 'image/webp', 0.92);

async function load(id: string, svg: string): Promise<string> {
  const key = `${hash(svg)}:${SIZE}`;
  const stored = await dbGet(id).catch(() => undefined);
  if (stored?.key === key) return URL.createObjectURL(stored.blob);
  const blob = await draw(svg);
  dbPut(id, { key, blob }).catch(() => {});
  return URL.createObjectURL(blob);
}

/** The image URL for a tile (`p7-01`…), drawing and storing it the first time. */
export function tileImage(id: string): Promise<string> {
  let image = images.get(id);
  if (!image) {
    // The space pads and their hatching come with the art, as printed; the board draws the number and cubes live.
    const svg = tileSvg(tileSpec(id), { rounded: true, markings: 'spaces' });
    // If drawing or storage fails, fall back to the SVG itself (slower to show, same look).
    image = load(id, svg).catch(() => dataUrl(svg));
    images.set(id, image);
  }
  return image;
}

const idle = () =>
  new Promise<void>((resolve) => ('requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 500 }) : setTimeout(resolve, 16)));

/** Prepares every tile in the set in the background (one per idle moment), so the first game starts at once. */
export async function warmTileImages(): Promise<void> {
  for (const t of TILE_SET) {
    await idle();
    await tileImage(t.id);
  }
}
