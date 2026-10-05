/**
 * The card audit (audit.ts) on the quick games of its matrix: every card mode, several maps and
 * player counts, with every skill dealt to someone. A failure lists each anomaly with the action
 * and the game log leading up to it.
 *
 * The whole matrix, with a card coverage report, is `npm run audit:cards` (`-- --deep` for more).
 */
import { describe, expect, it } from 'vitest';
import { AUDIT_GAMES, auditGame, gameName } from './audit';

describe('card audit', () => {
  for (const g of AUDIT_GAMES.filter((x) => x.quick))
    it(gameName(g), () => {
      const r = auditGame(g);
      expect(r.anomalies.map((a) => [`step ${a.step} [${a.card ?? '-'}] ${a.message}`, ...a.context].join('\n'))).toEqual([]);
      expect(r.finished).toBe(true);
    }, 60_000);
});
