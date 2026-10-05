import { hash } from './rng';
import { PLANET_FAMILY, type PlanetType } from './tokens';

/** One physical tile: which planet it carries and the seed its look comes from. */
export interface TileSpec {
  /** `p7-01` … `p10-05`, or `void`. */
  id: string;
  /** Planet number, or 0 for the Void tile. */
  number: number;
  seed: number;
  type?: PlanetType;
  rings?: boolean;
}

/**
 * How many of each tile a set needs: the most any map in data/maps.yaml uses at once
 * (docs/GRAPHICS.md §2a). Start planets use a separate token, so they need no tiles of their own.
 */
export const SET_COUNTS: Record<number, number> = { 7: 8, 8: 8, 9: 6, 10: 5, 0: 1 };

/** The look of one tile, from its id. Ids past the set's count (a map larger than the set) still work. */
export function tileSpec(id: string): TileSpec {
  if (id === 'void' || id.startsWith('void-')) return { id, number: 0, seed: hash(id) };
  const m = /^p(\d+)-(\d+)$/.exec(id);
  if (!m) throw new Error(`Unknown tile id: ${id}`);
  const number = Number(m[1]);
  const index = Number(m[2]) - 1;
  const types = PLANET_FAMILY[number].types;
  return { id, number, seed: hash(id), type: types[index % types.length] };
}

const tileId = (number: number, i: number) =>
  number === 0 ? (i === 0 ? 'void' : `void-${i + 1}`) : `p${number}-${String(i + 1).padStart(2, '0')}`;

/** Every tile in a full set, in order. */
export const TILE_SET: TileSpec[] = [7, 8, 9, 10, 0].flatMap((num) =>
  Array.from({ length: SET_COUNTS[num] }, (_, i) => tileSpec(tileId(num, i))),
);

/**
 * Which physical tile goes where on a map: the k-th planet of a number gets that number's k-th tile.
 * The same map always gets the same tiles, so the screen matches a table set up from the same list.
 */
export function assignTiles(tiles: { index: number; number: number }[]): Map<number, string> {
  const used: Record<number, number> = {};
  const out = new Map<number, string>();
  for (const t of tiles) {
    const k = used[t.number] ?? 0;
    used[t.number] = k + 1;
    out.set(t.index, tileId(t.number, k));
  }
  return out;
}
