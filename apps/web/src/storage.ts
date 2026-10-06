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

/** Whether the value was kept. */
export function remember(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function forget(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
