/**
 * Drawn artwork kept in IndexedDB between visits (tiles, cards). Each image is stored with a key made
 * from what it was drawn from (a hash of its SVG and its size), so changed artwork is drawn again.
 */

const DB_NAME = 'quantum-art';
const VERSION = 2;
export type Store = 'tiles' | 'cards';

interface Stored {
  key: string;
  blob: Blob;
}

let database: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      for (const name of ['tiles', 'cards']) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => {
      // Let a newer version in another tab upgrade the database instead of waiting on this one.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    // An older tab still has the database open: draw without it rather than wait for that tab to close.
    req.onblocked = () => reject(new Error('art store blocked by another tab'));
  }).catch((e: unknown) => {
    database = null; // try again next time
    throw e;
  });
  return database;
}

/** The stored image for `id`, if it was drawn from the same `key`. */
export async function storedImage(store: Store, id: string, key: string): Promise<Blob | undefined> {
  const db = await openDb();
  const found = await new Promise<Stored | undefined>((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result as Stored | undefined);
    req.onerror = () => reject(req.error);
  });
  return found?.key === key ? found.blob : undefined;
}

export async function storeImage(store: Store, id: string, key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put({ key, blob } satisfies Stored, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const nextIdle = (timeout: number) =>
  new Promise<void>((resolve) => ('requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout }) : setTimeout(resolve, 16)));

/**
 * When the player last touched, dragged, scrolled or zoomed. A pinch leaves idle time between its frames,
 * but drawing one card or tile takes far longer than that: it would drop the gesture's frames.
 */
let lastInput = -Infinity;
const QUIET_MS = 1000;
const touched = () => void (lastInput = performance.now());
const listen = { capture: true, passive: true };
for (const type of ['pointerdown', 'wheel', 'touchmove']) addEventListener(type, touched, listen);
addEventListener('pointermove', (e) => e.buttons && touched(), listen);

/**
 * Resolves when the page is idle (or after `timeout` ms regardless) and the player has left the page
 * alone for a moment, for drawing in the background.
 */
export async function idle(timeout = 500): Promise<void> {
  for (;;) {
    const wait = lastInput + QUIET_MS - performance.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    else {
      await nextIdle(timeout);
      if (performance.now() - lastInput >= QUIET_MS) return;
    }
  }
}
