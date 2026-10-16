import type { CombatPending, GameState } from '@quantum/engine';

/**
 * When a card's blow lands, in ms (CardEffects' CSS): Show of Force's lance reaches the ship (.cfx-lance),
 * Dangerous's arc joins the two (.cfx-arc). The ships it destroys stay until then, and blow up then: seen
 * (staging, Explosions) and heard (sounds).
 */
const STRIKE_MS: Partial<Record<string, number>> = { showOfForce: 300, dangerous: 200 };

/** The step from `before`'s card blow, in ms; 0 when it isn't one. */
export const strikeOf = (before: GameState) => STRIKE_MS[before.pending[0]?.kind ?? ''] ?? 0;

/**
 * A shot's flight in ms (Shoot, a prototype power: the shooter stays put): a missile crosses the map
 * (board/Shots' CSS, heard as sounds' missile) and the battle opens as it lands (see `shotWait`).
 */
export const SHOT_MS = 600;

/**
 * How much longer a battle's stage takes for its shot: SHOT_MS while a ranged battle is as it opened
 * (no re-roll or missile yet), else 0. Its overlay opens that late (CombatOverlay), so whatever waits on
 * the battle being seen waits that much more: the AI (useAiDriver) and online playback.
 */
export const shotWait = (c: CombatPending) => (c.ranged && !c.rerolls.length && !c.attacker.missile && !c.defender.missile ? SHOT_MS : 0);

/** The battle the step from `before` to `game` opened with a shot, if any (after a Dangerous choice too). */
export function shotOf(before: GameState, game: GameState) {
  const head = game.pending[0];
  if (head?.kind !== 'combat' || !head.ranged) return null;
  const was = before.pending[0];
  return was?.kind === 'combat' && was.id === head.id ? null : head;
}
