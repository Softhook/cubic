import type { World } from '../tile/look';
import type { Stage } from './kit';
import { SKILL_SCENES } from './scenes/skills';
import { TACTIC_SCENES } from './scenes/tactics';

/**
 * One scene per Regolith card, keyed by card id, drawn from the art brief picked for it (data/regolith.yaml
 * `art`): the mechs posed from their rigs, the buildings and ground the tiles have. The art window is 63.5 wide
 * and 42 tall, in mm; scenes may draw past it into the bleed.
 */
export interface SpScene {
  world: World;
  /** What it shows, for the Art Lab. */
  caption: string;
  draw: (s: Stage) => string;
}

export const SCENES: Record<string, SpScene> = { ...SKILL_SCENES, ...TACTIC_SCENES };
