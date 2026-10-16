/**
 * Skills that fire by themselves name their card on a log entry, with what they really gave (`gains`),
 * so the web app can show the card and point at just that.
 */
import { describe, expect, it } from 'vitest';
import { apply, rulesOf, type GameState } from '../src';
import { arrange, originalGame, quickStart } from './helpers';

function game(skills: string[]): GameState {
  let s = quickStart(2, 42, 'community');
  const me = s.turn.player;
  s = arrange(s, { [`p${me}d0`]: [0, 0, 6], [`p${1 - me}d0`]: [0, 1, 3] });
  s.players[me].skills = skills.map((id) => ({ id, active: true }));
  s.players[me].dominance = 3;
  s.players[me].research = 2;
  s.turn.actionsLeft = 3;
  return s;
}

const fresh = (before: GameState, after: GameState) => after.log.filter((e) => e.id > before.logCounter);

describe('skills firing by themselves', () => {
  it('Show of Force names its own entry; Plundering adds one of its own, with its gains', () => {
    const s = game(['plundering']);
    const me = s.turn.player;
    s.pending.unshift({ kind: 'showOfForce', player: me });
    const after = apply(s, { type: 'showOfForce', die: `p${1 - me}d0` });
    const plunder = fresh(s, after).filter((e) => e.card);
    expect(plunder).toEqual([expect.objectContaining({ card: 'plundering', player: me, gains: { research: 3 } })]);
    expect(after.players[me].research).toBe(5);
  });

  it('logs what a bonus really gives at a track’s limit, and nothing once full', () => {
    const s = game(['plundering']);
    const me = s.turn.player;
    const limit = rulesOf(s).researchLimit;
    s.players[me].research = limit - 1;
    s.pending.unshift({ kind: 'showOfForce', player: me });
    const near = apply(s, { type: 'showOfForce', die: `p${1 - me}d0` });
    expect(fresh(s, near).find((e) => e.card)?.gains).toEqual({ research: 1 });

    s.players[me].research = limit;
    const full = apply(s, { type: 'showOfForce', die: `p${1 - me}d0` });
    expect(fresh(s, full).some((e) => e.card)).toBe(false);
  });

  it('Arrogant names its card after the turn heading when it gives an action', () => {
    let s = originalGame({ me: ['o-arrogant'] });
    const me = s.turn.player;
    s = arrange(s, { [`p${me}d0`]: [0, 0, 6], [`p${me}d1`]: [8, 8, 4], [`p${1 - me}d0`]: [0, 1, 3] });
    s.players[1 - me].ai = false;
    s = apply(s, { type: 'endTurn' });
    const before = s;
    s = apply(s, { type: 'endTurn' });
    expect(s.turn.player).toBe(me);
    const entries = fresh(before, s);
    const heading = entries.findIndex((e) => e.turn && e.player === me);
    expect(entries[heading + 1]).toEqual(expect.objectContaining({ card: 'o-arrogant', gains: { actions: 1 } }));
  });

  it('Curious names its card on the Move or Research it pays for', () => {
    let s = game(['curious']);
    const me = s.turn.player;
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'reconfigure', die: `p${me}d0` });
    const after = apply(s, { type: 'research' });
    expect(fresh(s, after).find((e) => e.card)).toEqual(expect.objectContaining({ card: 'curious', player: me }));
    // An action paid the usual way doesn't.
    const usual = game(['curious']);
    expect(fresh(usual, apply(usual, { type: 'research' })).some((e) => e.card)).toBe(false);
  });
});
