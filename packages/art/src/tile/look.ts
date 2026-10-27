import type { TileShape } from './geometry';

/** How a tile looks: 3 × 3 squares or a 7-hex flower in space (its sky, and its planet or a Void's heart). */
export type TileLook = TileShape;

/** The shape of a look's spaces. */
export const lookShape = (look: TileLook = 'square'): TileShape => look;
