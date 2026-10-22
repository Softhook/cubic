import type { TileShape } from './geometry';

/** Which world a hex map is on: the grey moon, or Mars. */
export type World = 'moon' | 'mars';

/**
 * How a tile looks: 3 × 3 squares or a 7-hex flower in space (its sky, and its planet or a Void's heart), or
 * a hex tile on a world's ground (the Regolith look, regolith/), with a building on its planet's space.
 */
export type TileLook = TileShape | World;

/** The shape of a look's spaces: a world's ground is always a hex tile. */
export const lookShape = (look: TileLook = 'square'): TileShape => (look === 'square' ? 'square' : 'hex');

/** The world a look's ground is on, if it's on one. */
export const lookWorld = (look: TileLook = 'square'): World | undefined => (look === 'moon' || look === 'mars' ? look : undefined);
