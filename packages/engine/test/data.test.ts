import { describe, expect, it } from 'vitest';
import { IMPLEMENTED_EFFECTS, ORIGINAL_COMMAND, ORIGINAL_GAMBIT, SKILL_RULES, SKILLS, TACTICS, EXPANSION, type CardDef } from '../src';

const ALL: CardDef[] = [...SKILLS, ...TACTICS, EXPANSION, ...ORIGINAL_COMMAND, ...ORIGINAL_GAMBIT];
const effect = (c: CardDef) => c.effect ?? c.id;

/** Cards left out of the decks because their effect is not written yet. Shrink this list. */
const NOT_YET_IMPLEMENTED = [
  'calculating', 'clever', 'curious', 'dangerous', 'devious', 'patient', 'prideful', 'profiteering', 'ruthless',
  'clever-original', 'cruel', 'nomadic', 'relentless', 'scrappy', 'relocation',
];

describe('card data', () => {
  it('has unique card ids', () => {
    const ids = ALL.map((c) => c.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('implements every effect except the known missing ones', () => {
    const missing = [...new Set(ALL.map(effect).filter((e) => !IMPLEMENTED_EFFECTS.has(e)))].sort();
    expect(missing).toEqual([...NOT_YET_IMPLEMENTED].sort());
  });

  it('gives every skill at least one hook (an empty rule would do nothing)', () => {
    expect(Object.entries(SKILL_RULES).filter(([, rule]) => !Object.keys(rule).length).map(([e]) => e)).toEqual([]);
  });

  it('uses every implemented effect (catches a misspelt effect name)', () => {
    const used = new Set(ALL.map(effect));
    expect([...IMPLEMENTED_EFFECTS].filter((e) => !used.has(e))).toEqual([]);
  });

  it('has the 2013 Original deck: 22 black Gambits and 31 white Commands, 1 of each', () => {
    const counts = Object.fromEntries(ORIGINAL_GAMBIT.map((c) => [c.name, c.count]));
    expect(counts).toEqual({
      Expansion: 8, Momentum: 4, Aggression: 4, Relocation: 2, Reorganization: 2, Sabotage: 2,
    });
    expect(ORIGINAL_GAMBIT.reduce((n, c) => n + c.count, 0)).toBe(22);

    expect(ORIGINAL_COMMAND.every((c) => c.count === 1)).toBe(true);
    expect(ORIGINAL_COMMAND.map((c) => c.name).sort()).toEqual([
      'Agile', 'Arrogant', 'Brilliant', 'Cerebral', 'Clever', 'Conformist', 'Cruel', 'Cunning', 'Curious',
      'Dangerous', 'Eager', 'Energetic', 'Ferocious', 'Flexible', 'Ingenious', 'Intelligent', 'Nomadic',
      'Plundering', 'Precocious', 'Rational', 'Ravenous', 'Relentless', 'Resourceful', 'Righteous', 'Scrappy',
      'Stealthy', 'Strategic', 'Stubborn', 'Tactical', 'Tyrannical', 'Warlike',
    ]);
  });
});
