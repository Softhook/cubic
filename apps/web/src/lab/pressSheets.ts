import { TILE_SET, playerAidSvg, tileSvg, type AidEdition, type TileSpec } from '@quantum/art';
import type { PressSheets } from '../print/exports';
import { PIECES, type Printable } from '../print/pieces';
import { cardFontCss, measure, tileFontCss } from './cards';

/** A tile as a printable face. */
export const printableTile = (t: TileSpec, fontCss: string, markings = true): Printable => ({
  name: t.id,
  svg: (bleed) => tileSvg(t, { markings, bleed, fontCss }),
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
