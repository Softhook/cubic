import { CAPACITY } from './board';
import type { MapDef } from './data';

export interface MapStats {
  /** Cube locations left over if every player placed all their cubes. */
  slack: number;
  /** Planets with an empty cube location after setup. */
  planets: number;
  /** The fewest of those planets that must end up shared if every player placed all their cubes. */
  shared: number;
}

/**
 * Computes a map's stats (the CE booklet's definitions) from its layout, assuming each player
 * starts on a different starting planet in order. `shared` is found by exhaustive search, which is
 * fast for the published maps.
 */
export function mapStats(map: MapDef): MapStats {
  const planets = map.layout.flat().filter((t) => t !== '.' && t !== '0').map((t) => ({ cap: CAPACITY[Number(t.replace('*', ''))], start: t.endsWith('*') }));
  const owners: number[][] = planets.map(() => []);
  planets.map((p, i) => (p.start ? i : -1)).filter((i) => i >= 0).slice(0, map.players).forEach((i, player) => owners[i].push(player));
  const slack = planets.reduce((a, p) => a + p.cap, 0) - map.players * map.cubes;
  const open = planets.filter((p, i) => p.cap > owners[i].length).length;

  let best = Infinity;
  const sharedCount = (o: number[][]) => o.filter((x) => x.length >= 2).length;
  const place = (player: number, o: number[][]) => {
    if (player === map.players) {
      best = Math.min(best, sharedCount(o));
      return;
    }
    const options = planets.map((_, i) => i).filter((i) => !o[i].includes(player) && o[i].length < planets[i].cap);
    const choose = (from: number, left: number, picked: number[]) => {
      if (left === 0) {
        const next = o.map((x, i) => (picked.includes(i) ? [...x, player] : x));
        if (sharedCount(next) < best) place(player + 1, next);
        return;
      }
      for (let j = from; j <= options.length - left; j++) choose(j + 1, left - 1, [...picked, options[j]]);
    };
    choose(0, map.cubes - 1, []);
  };
  place(0, owners);
  return { slack, planets: open, shared: best };
}
