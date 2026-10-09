/** Asks the AI worker for a move; falls back to thinking on the main thread if workers fail. */
import { chooseAction, DEFAULT_AI_LEVEL, type AiLevel } from '@quantum/ai';
import type { Action, GameState, PlayerConfig } from '@quantum/engine';
import type { AiRequest, AiResponse } from './aiWorker';

let worker: Worker | null | undefined;
const waiting = new Map<number, (r: AiResponse) => void>();
let nextId = 0;

export function aiLevelOf(p: PlayerConfig): AiLevel {
  const level = p.aiLevel ?? DEFAULT_AI_LEVEL;
  return (level >= 1 && level <= 5 ? level : DEFAULT_AI_LEVEL) as AiLevel;
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<AiResponse>) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
    worker.onerror = (e) => {
      console.error('[quantum] AI worker failed; thinking on the main thread from now on', e);
      worker = null;
      for (const [id, resolve] of waiting) resolve({ id, action: null, error: 'worker failed' });
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

const onMainThread = (state: GameState, level: AiLevel) => chooseAction(state, { level, samples: 3 });

export function think(state: GameState, level: AiLevel): Promise<Action | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(onMainThread(state, level));
  const id = ++nextId;
  return new Promise((resolve) => {
    waiting.set(id, (r) => {
      // An error in the worker is retried here, where it surfaces with a full stack trace.
      if (r.error) resolve(onMainThread(state, level));
      else resolve(r.action);
    });
    w.postMessage({ id, state, level } satisfies AiRequest);
  });
}
