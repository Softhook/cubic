import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Cell, GameState } from '@quantum/engine';
import { reducedMotion } from '../../game/useMediaQuery';
import { isPlayStep, useTransient } from '../../game/useTransient';

/** A short effect on the map: on the space `at`, or from `at` to `to`, in a player's colour. */
export interface MapEffect {
  id: string;
  at: Cell;
  to?: Cell;
  color: string;
}

/**
 * The effects `effectsOf` finds in each step of play, each gone after `ms`. None under reduced motion,
 * and none for undo (no new log entries).
 */
export function useStepEffects<T extends MapEffect>(
  game: GameState,
  ms: number,
  effectsOf: (before: GameState, game: GameState) => T[],
): T[] {
  const [effects, show] = useTransient<T>(ms);
  const prev = useRef(game);
  useEffect(() => {
    const before = prev.current;
    prev.current = game;
    if (isPlayStep(before, game) && !reducedMotion()) show(effectsOf(before, game));
  }, [game, show, effectsOf]);
  return effects;
}

/**
 * One effect's box: a space's size, on `at`, with its colour as `--pc`. One that goes somewhere also
 * gets `--len` and `--angle`, for a part that reaches from the middle of `at` to the middle of `to`.
 */
export function EffectBox({ e, cell, className, children }: { e: MapEffect; cell: number; className: string; children: ReactNode }) {
  const style: Record<string, string | number> = {
    transform: `translate(${e.at.c * cell}px, ${e.at.r * cell}px)`,
    width: cell,
    height: cell,
    '--pc': e.color,
  };
  if (e.to) {
    const dx = e.to.c - e.at.c;
    const dy = e.to.r - e.at.r;
    style['--len'] = `${Math.hypot(dx, dy) * cell}px`;
    style['--angle'] = `${Math.atan2(dy, dx)}rad`;
  }
  return (
    <div className={className} style={style as CSSProperties} aria-hidden>
      {children}
    </div>
  );
}
