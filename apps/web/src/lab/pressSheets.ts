import { TILE_SET, playerAidSvg, tileSvg, type AidEdition } from '@quantum/art';
import type { PressSheets } from '../print/exports';
import { PIECES } from '../print/pieces';
import { cardFontCss, measure, tileFontCss } from './cards';

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
      {
        piece: PIECES.tile,
        faces: TILE_SET.map((t) => ({ name: t.id, svg: (bleed: boolean) => tileSvg(t, { markings: true, bleed, fontCss: tile }) })),
      },
      {
        piece: PIECES.aid,
        faces: AIDS.map((edition) => ({
          name: edition,
          svg: (bleed: boolean) => playerAidSvg({ edition, bleed, measure, fontCss: card }),
        })),
      },
    ];
  },
};
