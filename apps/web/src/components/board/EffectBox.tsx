import type { CSSProperties, ReactNode } from 'react';
import type { Cell } from '@quantum/engine';

/** A short effect on the map: on the space `at`, or from `at` to `to`, in a player's colour. */
export interface MapEffect {
  id: string;
  at: Cell;
  to?: Cell;
  color: string;
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
