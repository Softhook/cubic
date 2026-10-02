import { describe, expect, it } from 'vitest';
import { IMPLEMENTED_EFFECTS, ORIGINAL_COMMAND, ORIGINAL_GAMBIT, SKILLS, TACTICS, EXPANSION, type CardDef } from '../src';

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

  it('uses every implemented effect (catches a misspelt effect name)', () => {
    const used = new Set(ALL.map(effect));
    expect([...IMPLEMENTED_EFFECTS].filter((e) => !used.has(e))).toEqual([]);
  });
});
