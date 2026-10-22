import {
  TILE_SET,
  playerAidSvg,
  regolithTileSvg,
  tileSvg,
  type AidEdition,
  type TileOptions,
  type TileShape,
  type TileSpec,
} from '@quantum/art';
import type { PressSheets } from '../print/exports';
import { PIECES, type Piece, type Printable } from '../print/pieces';
import { cardFontCss, measure, tileFontCss } from './cards';

/** How a tile looks: square, hex in space, or hex on the moon (the Regolith look, `regolithTileSvg`). */
export type TileLook = 'square' | 'hex' | 'moon';

/** The shape of a look's spaces. */
export const lookShape = (look: TileLook): TileShape => (look === 'square' ? 'square' : 'hex');

/** How a tile is shown and printed: its look, and where its planet sits (art `TileOptions`). */
export interface TileView {
  look?: TileLook;
  planetAt?: string;
}

/** A tile as an SVG document in a look, square by default: in space (`tileSvg`) or on the moon. */
export const tileFaceSvg = (t: TileSpec, { look = 'square', planetAt }: TileView, o: Omit<TileOptions, 'shape' | 'planetAt'>) =>
  look === 'moon' ? regolithTileSvg(t, { ...o, planetAt }) : tileSvg(t, { ...o, planetAt, shape: lookShape(look) });

/**
 * A tile as a printable face, named for where its planet sits when that's not the middle, and for the
 * moon when it's on it: `p7-01`, `p7-01-ne`, `p7-01-moon` (a Void has no spot).
 */
export const printableTile = (t: TileSpec, fontCss: string, markings = true, view: TileView = {}): Printable => ({
  name: (view.planetAt && t.number > 0 ? `${t.id}-${view.planetAt}` : t.id) + (view.look === 'moon' ? '-moon' : ''),
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

/** The set as hex tiles, in space or on the moon, planets in the middle, on press sheets of their own with each tile's die-cut line. */
const hexTiles = (look: 'hex' | 'moon'): PressSheets => {
  const moon = look === 'moon';
  return {
    name: moon ? 'hex-tiles-moon' : 'hex-tiles',
    label: moon ? 'Moon hex tiles' : 'Hex tiles',
    contents: `all ${TILE_SET.length} tiles as hex tiles${moon ? ' on the moon' : ''} (${PIECES.hexTile.cols * PIECES.hexTile.rows} a page), each with its die-cut line in a CutContour spot colour`,
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
};
