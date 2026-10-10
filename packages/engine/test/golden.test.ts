/**
 * Golden master: seeded AI-vs-AI games in every mode, recorded as a hash of every action taken
 * and of the final state. Invariants are checked after every action. Any engine change that alters behaviour — rules, RNG use, legal-action
 * order, log text — changes a hash. When a change is intended, review it and update with
 * `npx vitest run -u`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkInvariants, type GameMode } from '../src';
import { playAiGame } from './helpers';

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

function play(mode: GameMode, players: number, seed: number) {
  const { state, actions } = playAiGame({
    mode,
    players,
    seed,
    aiSeed: seed * 7919,
    after: (s, action, step) => expect(checkInvariants(s), `after step ${step}: ${JSON.stringify(action)}`).toEqual([]),
  });
  return { steps: actions.length, winner: state.winner, actions: hash(actions), state: hash(state) };
}

describe('golden master', () => {
  for (const mode of ['basic', 'original', 'community', 'prototyping'] as const)
    for (const [players, seed] of [[2, 11], [3, 12], [4, 13]])
      it(`${mode}, ${players} players, seed ${seed}`, () => {
        expect(play(mode, players, seed)).toMatchSnapshot();
      }, 60_000);
});
