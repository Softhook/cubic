import type { GameState } from '@quantum/engine';

/**
 * When a card's blow lands, in ms (CardEffects' CSS): Show of Force's lance reaches the ship (.cfx-lance),
 * Dangerous's arc joins the two (.cfx-arc). The ships it destroys stay until then, and blow up then: seen
 * (staging, Explosions) and heard (sounds).
 */
const STRIKE_MS: Partial<Record<string, number>> = { showOfForce: 300, dangerous: 200 };

/** The step from `before`'s card blow, in ms; 0 when it isn't one. */
export const strikeOf = (before: GameState) => STRIKE_MS[before.pending[0]?.kind ?? ''] ?? 0;
