import { useEffect, useRef, type CSSProperties } from 'react';
import type { GameState } from '@quantum/engine';
import { lastLogId, useTransient } from '../../game/useTransient';
import { shipSpots } from './geometry';
import { strikeOf } from '../../game/strike';

interface Explosion {
  id: string;
  r: number;
  c: number;
  color: string;
}

export const EXPLOSION_MS = 1100;
const SPARKS = 10;

/** Ships knocked off the map by a battle or a card blow up where they stood. */
function useExplosions(game: GameState): Explosion[] {
  const [booms, show] = useTransient<Explosion>(EXPLOSION_MS);
  const prev = useRef(game);
  useEffect(() => {
    const before = prev.current;
    prev.current = game;
    const lastId = lastLogId(before);
    // Only fresh destruction events count: undo also moves ships, but never adds log entries.
    const destroyed = game.log.some((e) => e.id > lastId && (e.event === 'battleWon' || e.event === 'shipDestroyed'));
    if (!destroyed) return;
    const spots = shipSpots(before);
    const fresh: Explosion[] = [];
    for (const d of game.dice) {
      const was = spots.get(d.id);
      if (!was || d.loc.zone !== 'scrapyard') continue;
      fresh.push({ id: `${d.id}:${d.rolls}`, ...was, color: game.players[d.owner].color });
    }
    // A card's blow (Show of Force, Dangerous) lands a moment in: they blow up then.
    show(fresh, strikeOf(before));
  }, [game, show]);
  return booms;
}

/** One ship blowing up: a flash, two shock waves and sparks, filling the box `style` places (a space's size). */
export function Boom({ color, style }: { color: string; style: CSSProperties }) {
  return (
    <div className="explosion" style={{ ...style, '--pc': color } as CSSProperties} aria-hidden>
      <span className="boom-flash" />
      <span className="boom-wave" />
      <span className="boom-wave late" />
      {Array.from({ length: SPARKS }, (_, i) => (
        <span
          key={i}
          className="boom-spark"
          style={{ '--a': `${(360 / SPARKS) * i + (i % 2) * 14}deg`, '--d': `${0.55 + (i % 3) * 0.18}` } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function Explosions({ game, cell }: { game: GameState; cell: number }) {
  const booms = useExplosions(game);
  return booms.map((b) => (
    <Boom key={b.id} color={b.color} style={{ transform: `translate(${b.c * cell}px, ${b.r * cell}px)`, width: cell, height: cell }} />
  ));
}
