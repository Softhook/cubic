/** Physical sizes (mm) and colours shared by the game and print. See docs/GRAPHICS.md §2a. */

export const TILE = {
  /** One space; fits a 19 mm die with 6.5 mm around it. */
  cell: 32,
  /** Tile trim size: 3 × 3 spaces. */
  size: 96,
  bleed: 3,
  /** Die-cut corner radius. */
  corner: 2,
  /** The rounded square marking where a die sits. */
  pad: 24,
} as const;

/** Printed planet diameter per planet number: bigger numbers hold more cubes. */
export const PLANET_DIAMETER: Record<number, number> = { 7: 30, 8: 33, 9: 36, 10: 38 };

/** Cube pads printed on planets (physical cubes up to 10 mm). The on-screen cubes are smaller. */
export const CUBE_PAD = { size: 11, gap: 1.5 } as const;

/** The shared base colour every tile's background fades to at its edge, so any two tiles sit together. */
export const SPACE_BASE: [number, number, number] = [228, 52, 6];

export type PlanetType = 'gas' | 'rocky' | 'ice' | 'lava' | 'ocean';

export interface PlanetFamily {
  /** Base hue; each planet varies it a little. */
  hue: number;
  /** Planet types this number comes in; a full set cycles through them. */
  types: PlanetType[];
}

/** Planet number → colour family. Keeps the current game's colours: 7 teal, 8 blue, 9 violet, 10 ember. */
export const PLANET_FAMILY: Record<number, PlanetFamily> = {
  7: { hue: 168, types: ['ocean', 'rocky', 'ice', 'gas'] },
  8: { hue: 218, types: ['gas', 'ocean', 'ice', 'rocky'] },
  9: { hue: 272, types: ['gas', 'ice', 'rocky'] },
  10: { hue: 20, types: ['lava', 'gas', 'rocky'] },
};
