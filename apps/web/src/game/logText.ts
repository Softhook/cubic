import type { GameState, LogEntry } from '@quantum/engine';
import { planetNames } from '../art/boardTiles';

/** A log entry's text with each `planet N` it names shown by that planet's name: "Thalassa Prime (9)". */
export function logText(game: GameState, e: LogEntry): string {
  const ids = e.planets;
  if (!ids?.length) return e.text;
  const names = planetNames(game.board);
  let i = 0;
  return e.text.replace(/planet (\d+)/g, (m, n) => {
    const name = names.get(ids[i++]);
    return name ? `${name} (${n})` : m;
  });
}
