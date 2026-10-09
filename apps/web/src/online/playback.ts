import type { GameState } from '@quantum/engine';
import type { Post, Step } from '@quantum/online';

/** How long a move by someone else stays on screen before the next one is shown. */
export const STEP_MS = 1500;
/** How long each stage of a battle (before a missile or re-roll changes it) stays on screen. */
export const COMBAT_MS = 3500;
/** Further behind than this, the screen jumps to the present instead of replaying the moves. */
export const MAX_BEHIND = 12;

export interface NextStep {
  step: Step;
  /** Wait this long before showing it. */
  delay: number;
  /** Whether to announce what it changed (toasts, sounds); not when jumping ahead. */
  announce: boolean;
}

/**
 * What the screen shows next, as it catches up with the game: the step after `shown`, after a
 * pause long enough to follow (none for this browser's own moves); or the last step at once if
 * `shown` is far behind or no longer in the game (a replay from scratch made new steps).
 *
 * Steps are matched by identity, not by their state: an undo makes a new step whose state is an
 * earlier step's.
 *
 * A battle that ends after `shown` stays on screen until the player has dismissed it (`dismissed`
 * is the `battleStage` they dismissed), so they can see how it went.
 *
 * `elapsed`: how long `shown` has been on screen already.
 */
export function nextStep(steps: readonly Step[], shown: Step | null, own: (p: Post) => boolean, elapsed: number, dismissed: string | null = null): NextStep | null {
  const last = steps.length - 1;
  const i = shown ? steps.indexOf(shown) : -1;
  if (i < 0 || last - i > MAX_BEHIND) return steps[last] === shown ? null : { step: steps[last], delay: 0, announce: false };
  if (i === last) return null;
  const next = steps[i + 1];
  const battle = battleStage(shown!.state);
  if (battle && battleId(next.state) !== battleId(shown!.state)) return dismissed === battle ? { step: next, delay: 0, announce: true } : null;
  const min = battle ? COMBAT_MS : next.post && own(next.post) ? 0 : STEP_MS;
  return { step: next, delay: Math.max(0, min - elapsed), announce: true };
}

/** The battle on screen and how far it has got (each missile and re-roll changes it), if any. */
export function battleStage(s: GameState): string | null {
  const head = s.pending[0];
  return head?.kind === 'combat' ? `${head.id}:${head.rerolls.length}:${+head.attacker.missile}${+head.defender.missile}` : null;
}

function battleId(s: GameState): number | null {
  const head = s.pending[0];
  return head?.kind === 'combat' ? head.id : null;
}
