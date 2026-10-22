import {
  TILE_SET,
  playerAidSvg,
  regolithTileSvg,
  tileSvg,
  type AidEdition,
  type TileOptions,
  type TileShape,
  type TileSpec,
  type World,
} from '@quantum/art';
import type { PressSheets } from '../print/exports';
import { PIECES, type Piece, type Printable } from '../print/pieces';
import { cardFontCss, measure, tileFontCss } from './cards';

/** How a tile looks: square, hex in space, or hex on the moon or Mars (the Regolith look, `regolithTileSvg`). */
export type TileLook = 'square' | 'hex' | 'moon' | 'mars';

/** The shape of a look's spaces. */
export const lookShape = (look: TileLook): TileShape => (look === 'square' ? 'square' : 'hex');

/** The world a look's ground is on, if it's on one. */
export const worldOf = (look: TileLook | undefined): World | undefined => (look === 'moon' || look === 'mars' ? look : undefined);

/** How a tile is shown and printed: its look, and where its planet sits (art `TileOptions`). */
export interface TileView {
  look?: TileLook;
  planetAt?: string;
}

/** A tile as an SVG document in a look, square by default: in space (`tileSvg`) or on a world's ground. */
export function tileFaceSvg(t: TileSpec, { look = 'square', planetAt }: TileView, o: Omit<TileOptions, 'shape' | 'planetAt'>) {
  const world = worldOf(look);
  return world ? regolithTileSvg(t, world, { ...o, planetAt }) : tileSvg(t, { ...o, planetAt, shape: lookShape(look) });
}

/**
 * A tile as a printable face, named for where its planet sits when that's not the middle, and for the
 * world when it's on one: `p7-01`, `p7-01-ne`, `p7-01-moon` (a Void has no spot).
 */
export const printableTile = (t: TileSpec, fontCss: string, markings = true, view: TileView = {}): Printable => ({
  name: (view.planetAt && t.number > 0 ? `${t.id}-${view.planetAt}` : t.id) + (worldOf(view.look) ? `-${view.look}` : ''),
  svg: (bleed) => tileFaceSvg(t, view, { markings, bleed, fontCss }),
});

/** A player aid as a printable face. */
export const printableAid = (edition: AidEdition, fontCss: string): Printable => ({
  name: edition,
  svg: (bleed) => playerAidSvg({ edition, bleed, measure, fontCss }),
});

/** The player aids on the sheets: two of each edition. */
const AIDS: AidEdition[] = ['community', 'community', 'classic', 'classic'];

/**
 * The tiles and the player aids print together, on the same stock, from the tile and the aid page alike:
 * the set as it ships (not seeds being explored), with print markings.
 */
export const TILES_AND_AIDS: PressSheets = {
  name: 'tiles-aids',
  label: 'Tiles + aids',
  contents:
    `all ${TILE_SET.length} tiles (${PIECES.tile.cols * PIECES.tile.rows} a page) and ${AIDS.length} player aids, ` +
    `2 Community and 2 Classic (${PIECES.aid.cols * PIECES.aid.rows} a page)`,
  async groups() {
    const [tile, card] = await Promise.all([tileFontCss(), cardFontCss()]);
    if (!tile || !card) throw new Error('the fonts didn’t load');
    return [
      { piece: PIECES.tile, faces: TILE_SET.map((t) => printableTile(t, tile)) },
      { piece: PIECES.aid, faces: AIDS.map((edition) => printableAid(edition, card)) },
    ];
  },
};

/** The set as hex tiles, in space or on the moon or Mars, planets in the middle, on press sheets of their own with each tile's die-cut line. */
const hexTiles = (look: 'hex' | 'moon' | 'mars'): PressSheets => {
  const on = { hex: '', moon: ' on the moon', mars: ' on Mars' }[look];
  return {
    name: look === 'hex' ? 'hex-tiles' : `hex-tiles-${look}`,
    label: { hex: 'Hex tiles', moon: 'Moon hex tiles', mars: 'Mars hex tiles' }[look],
    contents: `all ${TILE_SET.length} tiles as hex tiles${on} (${PIECES.hexTile.cols * PIECES.hexTile.rows} a page), each with its die-cut line in a CutContour spot colour`,
    async groups() {
      const tile = await tileFontCss();
      if (!tile) throw new Error('the fonts didn’t load');
      return [{ piece: PIECES.hexTile, faces: TILE_SET.map((t) => printableTile(t, tile, true, { look })) }];
    },
  };
};

/** How each look of tile prints: its piece, and the press sheets its set goes on. */
export const TILE_PRINT: Record<TileLook, { piece: Piece; cmyk: PressSheets }> = {
  square: { piece: PIECES.tile, cmyk: TILES_AND_AIDS },
  hex: { piece: PIECES.hexTile, cmyk: hexTiles('hex') },
  moon: { piece: PIECES.hexTile, cmyk: hexTiles('moon') },
  mars: { piece: PIECES.hexTile, cmyk: hexTiles('mars') },
};
