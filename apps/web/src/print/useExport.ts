import { useEffect, useRef, useState } from 'react';
import type { Progress } from './exports';

/** Runs an export with progress messages; busy until it ends. */
export type Run = (task: (progress: Progress) => Promise<void>) => void;

/** An export runner for a lab page: the current progress message (null when idle) and the last error. */
export function useExport(): { run: Run; progress: string | null; error: string | null } {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // An export keeps running when the page closes; it then finishes without updating it.
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run: Run = (task) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setProgress('Rendering…');
    // Yield a macrotask so the browser paints "Rendering…" before synchronous SVG / CMYK work begins.
    setTimeout(() => {
      void task((m) => mounted.current && setProgress(m))
        .catch((e: unknown) => mounted.current && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => {
          busy.current = false;
          if (mounted.current) setProgress(null);
        });
    }, 0);
  };
  return { run, progress, error };
}
