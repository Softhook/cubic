/** Shared test helpers: players, a finished setup, and seeded AI-vs-AI games. */
import { chooseAction, chooseMissile } from '../../ai/src';
import { apply, createGame, legalActions, type Action, type GameMode, type GameState } from '../src';

export const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, color: '#fff', ai: true }));

/** A game with setup done, taking the first legal choice for every setup decision. */
export function quickStart(n = 2, seed = 1, mode: GameMode = 'community'): GameState {
  let s = createGame({ players: players(n), seed, mode });
  while (s.phase === 'setup') s = apply(s, legalActions(s)[0]);
  return s;
}

/** A seeded random number generator in [0, 1), independent of the game's own RNG. */
export function seededRandom(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
}

export interface AiGame {
  mode: GameMode;
  players: number;
  /** Seed of the game itself. */
  seed: number;
  /** Seed of the AI's own randomness. */
  aiSeed: number;
  /** Called with the state before each action, and the action about to be applied. */
  before?: (s: GameState, step: number) => void;
  /** Called with the state after each action. */
  after?: (s: GameState, action: Action, step: number) => void;
}

/** Plays AI against AI to the end (any missile first, as the web app does), or throws if it gets stuck. */
export function playAiGame(game: AiGame): { state: GameState; actions: Action[] } {
  let s = createGame({ players: players(game.players), seed: game.seed, mode: game.mode });
  const random = seededRandom(game.aiSeed);
  const actions: Action[] = [];
  while (s.phase !== 'over') {
    const step = actions.length;
    if (step >= 3000) throw new Error('no winner after 3000 actions');
    game.before?.(s, step);
    let action: Action | null = null;
    if (s.pending[0]?.kind === 'combat') for (const p of s.players) action ??= chooseMissile(s, p.id);
    action ??= chooseAction(s, { samples: 1, random });
    if (!action) throw new Error(`no action at step ${step}`);
    actions.push(action);
    s = apply(s, action);
    game.after?.(s, action, step);
  }
  return { state: s, actions };
}
