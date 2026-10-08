/** Sounds heard from a step: worked out from what changed, so AI and online moves sound like local ones. */
import { describe, expect, it, vi } from 'vitest';
import type { GameState, LogEntry } from '@quantum/engine';
import { arrange, quickStart } from '../../../packages/engine/test/helpers';

vi.mock('../src/sound', () => ({ sfx: {} }));
const { soundsFor } = await import('../src/game/sounds');

const start = () => arrange(quickStart(2, 1, 'basic'), { p0d0: [0, 0, 6], p0d1: [4, 4, 2], p1d0: [0, 1, 3] });
const die = (s: GameState, id: string) => s.dice.find((d) => d.id === id)!;
const entry = (s: GameState, event: LogEntry['event']): LogEntry => ({ id: s.logCounter + 1, text: '', event });

/** `change` turns the step's start (after `setup`) into its end. */
function step(change: (s: GameState) => LogEntry[] | void, setup?: (s: GameState) => void) {
  const prev = start();
  setup?.(prev);
  const next = structuredClone(prev);
  const fresh = change(next) ?? [];
  return soundsFor(prev, next, fresh);
}

describe('soundsFor', () => {
  it('hears a ship fly', () => {
    expect(step((s) => void (die(s, 'p0d0').loc = { zone: 'board', r: 1, c: 0 })).first).toEqual(['fly']);
  });

  it('hears two ships trade places as a swap', () => {
    const { first } = step((s) => {
      die(s, 'p0d0').loc = { zone: 'board', r: 4, c: 4 };
      die(s, 'p0d1').loc = { zone: 'board', r: 0, c: 0 };
    });
    expect(first).toEqual(['swap']);
  });

  it('hears ships destroyed, counting them', () => {
    const { first, destroyed } = step((s) => {
      die(s, 'p0d0').loc = { zone: 'scrapyard' };
      die(s, 'p1d0').loc = { zone: 'scrapyard' };
    });
    expect(first).toEqual(['explode']);
    expect(destroyed).toBe(2);
  });

  it('hears no explosion for a ship Reorganization takes off the map', () => {
    const { first, destroyed } = step(
      (s) => void (die(s, 'p0d0').loc = { zone: 'scrapyard' }),
      (s) => void s.pending.unshift({ kind: 'unveil', player: 0, rerolled: [], reorganize: true }),
    );
    expect(first).toEqual([]);
    expect(destroyed).toBe(0);
  });

  it('still hears a card played when its discards were shuffled back into the deck', () => {
    expect(step((s) => [entry(s, 'cardPlayed')]).first).toEqual(['card']);
  });

  it('hears a ship renumbered without a roll', () => {
    expect(step((s) => void (die(s, 'p0d0').value = 5)).first).toEqual(['retune']);
  });

  it('plays a Tactic’s own sound first, then its effect', () => {
    const { first, then } = step((s) => {
      s.market.tacticDiscard.push('black-market');
      s.players[0].missiles += 2;
      return [entry(s, 'cardPlayed')];
    });
    expect(first).toEqual(['coins']);
    expect(then).toEqual(['missileLoad']);
  });
});
