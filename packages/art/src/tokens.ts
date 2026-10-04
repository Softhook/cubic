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

/**
 * Printed planet diameter per planet number: bigger numbers hold more cubes. Steps are large so the
 * number reads from size alone. Limits: 9 and 10 need > 33.2 mm for their cube pads; 10 stays under
 * 45 mm so it clears a die in the next space (docs/GRAPHICS.md §2a).
 */
export const PLANET_DIAMETER: Record<number, number> = { 7: 22, 8: 28, 9: 35, 10: 42 };

/** Cube pads printed on planets (physical cubes up to 10 mm). The on-screen cubes are smaller. */
export const CUBE_PAD = { size: 11, gap: 1.5 } as const;

/** The shared base colour every tile's background fades to at its edge, so any two tiles sit together. */
export const SPACE_BASE: [number, number, number] = [228, 52, 6];

export type PlanetType = 'gas' | 'rocky' | 'ice' | 'lava' | 'ocean';

export interface PlanetFamily {
  /** Signature hue: atmosphere, glow and the number's outline. Each planet varies it a little. */
  hue: number;
  /** Planet types this number comes in; a full set cycles through them. */
  types: PlanetType[];
}

/**
 * Planet number → look. The planet carries the number's identity, so each number has its own kind of
 * world and its own colours, far apart in hue *and* lightness so they also differ for colour-blind
 * players: 7 small green-and-blue Earth-like worlds, 8 white ice worlds and pale ice giants (the
 * lightest), 9 golden banded gas giants, 10 big black-and-red molten worlds (the darkest). None is
 * blue-violet, so no planet blends into the nebula.
 */
export const PLANET_FAMILY: Record<number, PlanetFamily> = {
  7: { hue: 150, types: ['ocean'] },
  8: { hue: 195, types: ['ice', 'gas'] },
  9: { hue: 38, types: ['gas'] },
  10: { hue: 6, types: ['lava'] },
};

/** Nebula hues stay between blue and pink-purple, so every tile's sky belongs to one set. */
export const NEBULA_HUES: [number, number] = [215, 330];

/** The Void tile's nebula colours (planet tiles get random, subtle ones). */
export const VOID_NEBULA_HUES: [number, number] = [316, 336];

/** The printed planet number (font size, mm), drawn where the spaces meet at the planet's bottom right. */
export const NUMBER_TEXT = { size: 14, sizeTwoDigits: 12.5 } as const;

/** The flavour label at the planet's top left (font sizes, mm): tiny, like a star atlas. */
export const LABEL_TEXT = { name: 1.7, line: 1.2, font: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace" } as const;

/** Display and text faces for cards and illustrations (the game UI loads the same two, index.html). */
export const FONTS = {
  title: "Orbitron, 'Arial Black', sans-serif",
  body: "Inter, 'Helvetica Neue', Arial, sans-serif",
} as const;

/** Near-black ink: dark card paper, outlines behind big numerals, glyphs on lit chips. */
export const INK = 'hsl(228 45% 8%)';

/** Hues of the two tracks every player has: research violet, dominance red-orange. */
export const RESEARCH = 268;
export const DOMINANCE = 12;

/** Player hues for ships in the card illustrations, close to the game's default player colours (Lobby). */
export const PLAYER_HUES = [196, 328, 42, 140];

/**
 * Card categories (data/cards.yaml `category`): accent hue and label, in the game and in print. Hues are
 * far apart so cards sort by colour at a glance. Each has an icon of the same name (icons.ts).
 */
export const CARD_CATEGORIES: Record<string, { hue: number; label: string }> = {
  movement: { hue: 192, label: 'Movement' },
  action: { hue: 42, label: 'Action' },
  combat: { hue: 352, label: 'Combat' },
  conquer: { hue: 138, label: 'Conquer' },
  research: { hue: RESEARCH, label: 'Research' },
  ship: { hue: 218, label: 'Ship' },
  card: { hue: 24, label: 'Cards' },
  expansion: { hue: 172, label: 'Expansion' },
};
