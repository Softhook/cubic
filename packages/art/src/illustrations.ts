import type { Draw } from './kit';
import { ORIGINAL_SCENES } from './scenes/original';
import { SKILL_SCENES } from './scenes/skills';
import { TACTIC_SCENES } from './scenes/tactics';

/** A card's illustration: what it shows (for art direction), and how to draw it. */
export interface Illustration {
  caption: string;
  draw: Draw;
}

/**
 * One illustration per card, keyed by card id, each showing what that card does. An original card
 * that is the same card as in the Community Edition shares its picture.
 */
export const ILLUSTRATIONS: Record<string, Illustration> = {
  ...SKILL_SCENES,
  ...TACTIC_SCENES,
  ...ORIGINAL_SCENES,
};
