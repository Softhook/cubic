import { useEffect, useRef, useState } from 'react';
import { actor, canRespondToCombat, type GameState, type PlayerId } from '@quantum/engine';
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
/** Pause before a battle resolves in a game with no humans (otherwise a human dismisses it). */
export const COMBAT_RESOLVE_MS = 2600;

/**
 * Plays for the AI players: whenever it is an AI's turn or decision, asks it for an action and
 * dispatches it after a short delay. During combat, gives every AI that may respond (missile,
 * re-roll) its chance; a human then resolves the battle (CombatOverlay), unless there is none.
 *
 * Returns the AI that is about to respond to the battle on screen, if any, so a human doesn't
 * resolve it first.
 */
export function useAiDriver(game: GameState, dispatch: Dispatch): PlayerId | null {
  // Combat stages at which an AI has already been asked to respond.
  const asked = useRef(new Set<string>());
  // The AI about to respond, and to which combat stage.
  const [responding, setResponding] = useState<{ stage: string; player: PlayerId } | null>(null);
  const head = game.pending[0];
  const stage = head?.kind === 'combat' ? `${head.id}:${head.rerolls.length}:${+head.attacker.missile}${+head.defender.missile}` : null;

  useEffect(() => {
    if (game.phase === 'over') return;
    let timer: number | undefined;

    if (head?.kind === 'combat' && stage) {
      // Asked again after anything changes the battle (a re-roll or a missile).
      for (const p of game.players) {
        const k = `${stage}:${p.id}`;
        if (!p.ai || !canRespondToCombat(game, head, p.id) || asked.current.has(k)) continue;
        const m = chooseCombatResponse(game, p.id, { level: aiLevelOf(p) });
        if (!m) {
          asked.current.add(k);
          continue;
        }
        setResponding({ stage, player: p.id });
        timer = window.setTimeout(() => {
          asked.current.add(k);
          // Cleared even if the move is refused, so the battle can't wait on it for ever.
          setResponding(null);
          dispatch(m);
        }, COMBAT_RESPONSE_MS);
        return () => window.clearTimeout(timer);
      }
      // No AI responds (any more): asked again, one may have changed its mind.
      setResponding(null);
      if (game.players.every((p) => p.ai)) timer = window.setTimeout(() => dispatch({ type: 'resolveCombat' }), COMBAT_RESOLVE_MS);
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

  return stage && responding?.stage === stage ? responding.player : null;
}
