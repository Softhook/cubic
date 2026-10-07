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
  database ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      for (const name of ['tiles', 'cards']) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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

/** Resolves when the page is idle (or after `timeout` ms regardless), for drawing in the background. */
export const idle = (timeout = 500) =>
  new Promise<void>((resolve) => ('requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout }) : setTimeout(resolve, 16)));
