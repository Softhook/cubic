import { CARD, TILE } from '@quantum/art';

/**
 * The printed pieces, and the one convention every print file follows: size, bleed, sheet layout and
 * file names are the same whichever piece it is. See docs/GRAPHICS.md §4.
 */

export interface Piece {
  id: 'card' | 'tile';
  /** For file names: `cubic-cards-…`. */
  plural: string;
  /** Trim size, mm. */
  w: number;
  h: number;
  /** Extra art past the trim on every side, for print services, mm. */
  bleed: number;
  /** How many fit across and down a print sheet (A4 and US Letter both). */
  cols: number;
  rows: number;
}

export const PIECES = {
  card: { id: 'card', plural: 'cards', w: CARD.w, h: CARD.h, bleed: CARD.bleed, cols: 3, rows: 3 },
  tile: { id: 'tile', plural: 'tiles', w: TILE.size, h: TILE.size, bleed: TILE.bleed, cols: 2, rows: 2 },
} as const satisfies Record<string, Piece>;

/** One printable face: a card front, a deck's back, a tile. */
export interface Printable {
  /** Unique within its piece, and the file's name: `skill/07-agile`, `p7-01`. A folder part groups it in the ZIP. */
  name: string;
  /** The face as an SVG document, at trim size or with the bleed. */
  svg: (bleed: boolean) => string;
}

/** The DPI for sets and sheets; single exports offer 600 too. */
export const PRINT_DPI = 300;

/** A piece's size with or without its bleed, mm. */
export const pieceSize = (p: Piece, bleed: boolean) => ({ w: p.w + (bleed ? 2 * p.bleed : 0), h: p.h + (bleed ? 2 * p.bleed : 0) });

/** How a piece's size reads in notes and READMEs: "63.5 × 88.9 mm, with 3 mm bleed 69.5 × 94.9 mm". */
export function sizeNote(p: Piece, bleed: boolean): string {
  const b = pieceSize(p, true);
  return `${p.w} × ${p.h} mm` + (bleed ? `, with ${p.bleed} mm bleed ${b.w} × ${b.h} mm` : ' (trim, no bleed)');
}

/** A single export's file name: `cubic-card-skill-07-agile-bleed-300dpi.png`, `cubic-tile-p7-01.svg`. */
export function fileName(p: Piece, item: Printable, o: { bleed: boolean; dpi?: number; ext: string }): string {
  return `cubic-${p.id}-${item.name.replaceAll('/', '-')}${o.bleed ? '-bleed' : ''}${o.dpi ? `-${o.dpi}dpi` : ''}.${o.ext}`;
}

/** A whole set's file name: `cubic-cards-community-bleed.zip`. */
export const setName = (p: Piece, o: { bleed: boolean; part?: string }) => `cubic-${p.plural}${o.part ? `-${o.part}` : ''}${o.bleed ? '-bleed' : ''}.zip`;
