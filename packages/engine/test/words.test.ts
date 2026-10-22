import { describe, expect, it } from 'vitest';
import { RULESETS, reword, say } from '../src';
import { quickStart } from './helpers';

describe("a mode's words", () => {
  const words = RULESETS.prototyping.words;

  it('reads as Quantum in the official modes', () => {
    for (const mode of ['basic', 'original', 'community'] as const) expect(RULESETS[mode].words).toBeUndefined();
    expect(say(quickStart(2, 1, 'community'), 'Deploy a ship in orbit of a planet.')).toBe('Deploy a ship in orbit of a planet.');
  });

  it("says Regolith's words, in the case and with the article they were written with", () => {
    expect(reword(words, 'Place your ships in orbit of your starting planet, from your scrapyard.')).toBe(
      'Place your mechs on the perimeter of your starting objective, from your salvage yard.',
    );
    expect(reword(words, 'A reconfigured ship must change its number')).toBe('A refitted mech must change its number');
    expect(reword(words, 'Take a missile instead of a card earned by conquering.')).toBe(
      'Take an orbital strike instead of a card earned by claiming.',
    );
    expect(reword(words, 'Missiles: 1. Dominance: 2. Free Reconfigure. Place Warp Gate 1 of 2.')).toBe(
      'Orbital strikes: 1. Power: 2. Free Refit. Place Ice Tunnel 1 of 2.',
    );
    expect(reword(words, 'an orbital position; Conquer planet 3; deployed')).toBe('a perimeter space; Claim objective 3; dropped');
  });

  it('leaves words inside other words, and the names it keeps, as they are', () => {
    expect(reword(words, "The Flagship's shipyard")).toBe("The Flagship's shipyard");
    expect(reword(words, 'Planet Express deploys a ship.', ['Planet Express'])).toBe('Planet Express drops a mech.');
  });

  it("keeps the players' names in a game's text", () => {
    const s = quickStart(2, 1, 'prototyping', 'alpha-hex');
    s.players[0].name = 'Ship Shape';
    expect(say(s, 'Ship Shape destroys a ship.')).toBe('Ship Shape destroys a mech.');
  });

  it('describes Regolith in its own words in the lobby', () => {
    expect(RULESETS.prototyping.summary).not.toMatch(/\b(ships?|planets?|orbits?|conquer\w*|deploy\w*)\b/i);
  });
});
