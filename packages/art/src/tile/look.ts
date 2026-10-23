import type { TileShape } from './geometry';

/** Which world a hex map is on: grey Phobos, smooth reddish Deimos, or Mars. */
export type World = 'phobos' | 'deimos' | 'mars';

/** Each world's name, as players read it. */
export const WORLD_NAMES: Record<World, string> = { phobos: 'Phobos', deimos: 'Deimos', mars: 'Mars' };

/**
 * How a tile looks: 3 × 3 squares or a 7-hex flower in space (its sky, and its planet or a Void's heart), or
 * a hex tile on a world's ground (the Regolith look, regolith/), with a building on its planet's space.
 */
export type TileLook = TileShape | World;

/** The shape of a look's spaces: a world's ground is always a hex tile. */
export const lookShape = (look: TileLook = 'square'): TileShape => (look === 'square' ? 'square' : 'hex');

/** The world a look's ground is on, if it's on one. */
export const lookWorld = (look: TileLook = 'square'): World | undefined => (look === 'square' || look === 'hex' ? undefined : look);
