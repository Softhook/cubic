import { useEffect, useRef } from 'react';
import { actor, canRespondToCombat, type GameState } from '@quantum/engine';
import { chooseCombatResponse } from '@quantum/ai';
import { aiLevelOf, think } from './aiClient';
import type { Dispatch } from './useGame';

/** How long the AI waits before acting (thinking time included), so humans can follow along. */
function aiDelay(s: GameState): number {
  const head = s.pending[0];
  if (s.phase === 'setup') return 650;
  if (!head) return s.turn.actionsLeft === 3 && !Object.keys(s.turn.moved).length ? 1100 : 850;
  if (head.kind === 'takeCard' || head.kind === 'peek' || head.kind === 'patientTactic') return 1100;
  if (head.kind === 'advance') return 700;
  return 800;
}

/** Pause before an AI fires a missile or re-rolls in combat. */
const COMBAT_RESPONSE_MS = 1700;
/** Pause before an all-AI combat (no human may respond) resolves. */
const COMBAT_RESOLVE_MS = 2600;

/**
 * Plays for the AI players: whenever it is an AI's turn or decision, asks it for an action and
 * dispatches it after a short delay. During combat, gives every AI that may respond (missile,
 * re-roll) its chance, then resolves the battle unless a human may still respond.
 */
export function useAiDriver(game: GameState, dispatch: Dispatch) {
  // Combat stages at which an AI has already been asked to respond.
  const asked = useRef(new Set<string>());

  useEffect(() => {
    if (game.phase === 'over') return;
    const head = game.pending[0];
    let timer: number | undefined;

    if (head?.kind === 'combat') {
      // Asked again after anything changes the battle (a re-roll or a missile).
      const stage = `${head.id}:${head.rerolls.length}:${+head.attacker.missile}${+head.defender.missile}`;
      for (const p of game.players) {
        const k = `${stage}:${p.id}`;
        if (!p.ai || !canRespondToCombat(game, head, p.id) || asked.current.has(k)) continue;
        const m = chooseCombatResponse(game, p.id, { level: aiLevelOf(p) });
        if (!m) {
          asked.current.add(k);
          continue;
        }
        timer = window.setTimeout(() => {
          asked.current.add(k);
          dispatch(m);
        }, COMBAT_RESPONSE_MS);
        return () => window.clearTimeout(timer);
      }
      const humanMayRespond = game.players.some((p) => !p.ai && canRespondToCombat(game, head, p.id));
      if (!humanMayRespond) timer = window.setTimeout(() => dispatch({ type: 'resolveCombat' }), COMBAT_RESOLVE_MS);
      return () => window.clearTimeout(timer);
    }

    const player = game.players[actor(game)];
    if (!player.ai) return;
    let cancelled = false;
    const started = performance.now();
    void think(game, aiLevelOf(player)).then((a) => {
      if (cancelled || !a) return;
      const wait = Math.max(0, aiDelay(game) - (performance.now() - started));
      timer = window.setTimeout(() => dispatch(a), wait);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [game, dispatch]);
}
