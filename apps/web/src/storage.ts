/*
 * localStorage that survives storage being unavailable (private windows, blocked site data, a full
 * quota): reads come back empty and writes are dropped, so nothing here ever throws.
 */

export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Parsed JSON, or null when the key is missing, unreadable or not valid JSON. */
export function storedJson<T>(key: string): T | null {
  const raw = stored(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Ways to free space when storage is full, tried in turn; each says whether it freed anything. */
const reclaimers: (() => boolean)[] = [];
let reclaiming = false;

/** Registers a way to free space (dropping something that can go) for when a write doesn't fit. */
export function onStorageFull(reclaim: () => boolean) {
  reclaimers.push(reclaim);
}

/** Whether the value was kept. A write that doesn't fit frees what space it can and tries again. */
export function remember(key: string, value: string): boolean {
  for (;;) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      /* full, or storage unavailable */
    }
    // A reclaimer's own writes don't reclaim in turn.
    if (reclaiming) return false;
    reclaiming = true;
    try {
      if (!reclaimers.some((r) => r())) return false;
    } finally {
      reclaiming = false;
    }
  }
}

export function forget(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
