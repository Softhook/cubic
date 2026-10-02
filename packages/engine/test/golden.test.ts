/**
 * Golden master: seeded AI-vs-AI games in every mode, recorded as a hash of every action taken
 * and of the final state. Any engine change that alters behaviour — rules, RNG use, legal-action
 * order, log text — changes a hash. When a change is intended, review it and update with
 * `npx vitest run -u`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { apply, createGame, type Action, type GameMode } from '../src';
import { chooseAction, chooseMissile } from '../../ai/src';

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

function play(mode: GameMode, players: number, seed: number) {
  let s = createGame({ players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, color: '#fff', ai: true })), seed, mode });
  let rng = seed * 7919;
  const random = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
  const actions: Action[] = [];
  while (s.phase !== 'over' && actions.length < 3000) {
    let action: Action | null = null;
    if (s.pending[0]?.kind === 'combat') for (const p of s.players) action ??= chooseMissile(s, p.id);
    action ??= chooseAction(s, { samples: 1, random });
    if (!action) throw new Error(`stuck after ${actions.length} actions`);
    actions.push(action);
    s = apply(s, action);
  }
  return { steps: actions.length, winner: s.winner, actions: hash(actions), state: hash(s) };
}

describe('golden master', () => {
  for (const mode of ['basic', 'original', 'community'] as const)
    for (const [players, seed] of [[2, 11], [3, 12], [4, 13]])
      it(`${mode}, ${players} players, seed ${seed}`, () => {
        expect(play(mode, players, seed)).toMatchSnapshot();
      }, 60_000);
});
