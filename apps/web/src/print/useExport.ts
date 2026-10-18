import { useState } from 'react';
import type { Progress } from './exports';

/** Runs an export with progress messages; busy until it ends. */
export type Run = (task: (progress: Progress) => Promise<void>) => void;

/** An export runner for a lab page: the current progress message (null when idle) and the last error. */
export function useExport(): { run: Run; progress: string | null; error: string | null } {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run: Run = (task) => {
    setError(null);
    setProgress('Rendering…');
    void task(setProgress)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setProgress(null));
  };
  return { run, progress, error };
}
