import { useState } from 'react';
import { cellOf, type Die, type GameState } from '@quantum/engine';
import { isPlayStep } from '../../game/useTransient';
import { reducedMotion } from '../../game/useMediaQuery';
import { strikeOf } from '../../game/strike';
import { cardEffectsOf } from './CardEffects';
import { shipSpots } from './geometry';

/** When a card's effect brings a ship or cube: Expansion's lance lands, Nomadic's rings open, a relocated cube's spark arrives (less the cube's own drop). */
const EXPANSION_MS = 270;
const NOMADIC_MS = 300;
const RELOCATION_MS = 360;

/** How a step's results wait on its card's effect, so the effect comes first. */
export interface Staging {
  /** Ships that appear only once their card's effect gets there (ms in); Nomadic's don't glide there either. */
  late: Map<string, number>;
  /** Ships a card destroyed, as they were, still shown where they were until its blow lands (ms in). */
  struck: { die: Die; r: number; c: number; ms: number }[];
  /** The planet whose new cube drops in late (a relocated one, once the beam brings it), and when. */
  cube?: { planet: number; ms: number };
}

const NONE: Staging = { late: new Map(), struck: [] };

function stagingOf(before: GameState, game: GameState): Staging {
  const out: Staging = { late: new Map(), struck: [] };
  for (const e of cardEffectsOf(before, game)) {
    if (e.kind === 'expansion' && e.replaces) out.late.set(e.replaces, EXPANSION_MS);
    else if (e.kind === 'blink' && e.replaces) out.late.set(e.replaces, NOMADIC_MS);
    else if (e.kind === 'beam' && e.replaces?.startsWith('planet:')) out.cube = { planet: Number(e.replaces.slice(7)), ms: RELOCATION_MS };
  }
  const ms = strikeOf(before);
  if (ms) {
    const spots = shipSpots(before);
    for (const d of before.dice) {
      const at = spots.get(d.id);
      if (at && !cellOf(game.dice.find((x) => x.id === d.id)!)) out.struck.push({ die: d, ...at, ms });
    }
  }
  return out;
}

/**
 * The staging of the step that brought `game`, until the next one. Worked out as it renders (derived
 * state), so the very first frame of the new position is already staged. None for undo, a jump to
 * another position (`scene`) or under reduced motion.
 */
export function useStaging(game: GameState, scene?: string): Staging {
  const [st, setSt] = useState({ game, scene, staging: NONE });
  if (st.game !== game || st.scene !== scene) {
    const play = st.scene === scene && isPlayStep(st.game, game) && !reducedMotion();
    const staging = play ? stagingOf(st.game, game) : NONE;
    setSt({ game, scene, staging });
    return staging;
  }
  return st.staging;
}
