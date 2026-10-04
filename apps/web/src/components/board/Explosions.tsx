import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameState } from '@quantum/engine';
import { shipSpots } from './geometry';

interface Explosion {
  id: string;
  r: number;
  c: number;
  color: string;
}

const EXPLOSION_MS = 1100;
const SPARKS = 10;

/** Ships knocked off the map by a battle or a card blow up where they stood. */
function useExplosions(game: GameState): Explosion[] {
  const [booms, setBooms] = useState<Explosion[]>([]);
  const prev = useRef(game);
  useEffect(() => {
    const before = prev.current;
    prev.current = game;
    const lastId = before.log.at(-1)?.id ?? 0;
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
    if (!fresh.length) return;
    setBooms((b) => [...b, ...fresh]);
    window.setTimeout(() => setBooms((b) => b.filter((x) => !fresh.includes(x))), EXPLOSION_MS);
  }, [game]);
  return booms;
}

export function Explosions({ game, cell }: { game: GameState; cell: number }) {
  const booms = useExplosions(game);
  return booms.map((b) => (
    <div
      key={b.id}
      className="explosion"
      style={{ transform: `translate(${b.c * cell}px, ${b.r * cell}px)`, width: cell, height: cell, '--pc': b.color } as CSSProperties}
      aria-hidden
    >
      <span className="boom-flash" />
      <span className="boom-wave" />
      <span className="boom-wave late" />
      {Array.from({ length: SPARKS }, (_, i) => (
        <span key={i} className="boom-spark" style={{ '--a': `${(360 / SPARKS) * i + (i % 2) * 14}deg`, '--d': `${0.55 + (i % 3) * 0.18}` } as CSSProperties} />
      ))}
    </div>
  ));
}
