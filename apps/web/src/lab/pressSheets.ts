import { TILE_SET, playerAidSvg, tileSvg, type AidEdition, type TileOptions, type TileShape, type TileSpec } from '@quantum/art';
import type { PressSheets } from '../print/exports';
import { PIECES, type Piece, type Printable } from '../print/pieces';
import { cardFontCss, measure, tileFontCss } from './cards';

/** How a tile is shown and printed: its shape, and where its planet sits (art `TileOptions`). */
export type TileView = Pick<TileOptions, 'shape' | 'planetAt'>;

/** A tile as a printable face, named for where its planet sits when that's not the middle: `p7-01`, `p7-01-ne` (a Void has none). */
export const printableTile = (t: TileSpec, fontCss: string, markings = true, view: TileView = {}): Printable => ({
  name: view.planetAt && t.number > 0 ? `${t.id}-${view.planetAt}` : t.id,
  svg: (bleed) => tileSvg(t, { markings, bleed, fontCss, ...view }),
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

/** The set as hex tiles, planets in the middle, on press sheets of their own with each tile's die-cut line. */
const HEX_TILES: PressSheets = {
  name: 'hex-tiles',
  label: 'Hex tiles',
  contents: `all ${TILE_SET.length} tiles as hex tiles (${PIECES.hexTile.cols * PIECES.hexTile.rows} a page), each with its die-cut line in a CutContour spot colour`,
  async groups() {
    const tile = await tileFontCss();
    if (!tile) throw new Error('the fonts didn’t load');
    return [{ piece: PIECES.hexTile, faces: TILE_SET.map((t) => printableTile(t, tile, true, { shape: 'hex' })) }];
  },
};

/** How each shape of tile prints: its piece, and the press sheets its set goes on. */
export const TILE_PRINT: Record<TileShape, { piece: Piece; cmyk: PressSheets }> = {
  square: { piece: PIECES.tile, cmyk: TILES_AND_AIDS },
  hex: { piece: PIECES.hexTile, cmyk: HEX_TILES },
};
