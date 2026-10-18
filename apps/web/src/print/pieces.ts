import { AID, CARD, TILE } from '@quantum/art';
import { pressTag } from './press';

/**
 * The printed pieces, and the one convention every print file follows: size, bleed, sheet layout and
 * file names are the same whichever piece it is. See docs/GRAPHICS.md §4.
 */

/** What a single-face export needs: a name for files, the size and the resolution. */
export interface Format {
  /** For file names: `cubic-card-…`. */
  id: string;
  /** Trim size, mm. */
  w: number;
  h: number;
  /** Extra art past the trim on every side, for print services, mm. */
  bleed: number;
  /** Resolution of the PNGs, PDFs and print sheets: 600 for pieces with small text, so it prints crisp. */
  dpi: number;
}

/** A piece printed as a set: in ZIPs and on sheets. */
export interface Piece extends Format {
  id: 'card' | 'tile' | 'aid';
  /** For file names: `cubic-cards-…`. */
  plural: string;
  /** How many fit across and down a print sheet (A4). */
  cols: number;
  rows: number;
}

export const PIECES = {
  card: { id: 'card', plural: 'cards', w: CARD.w, h: CARD.h, bleed: CARD.bleed, cols: 3, rows: 3, dpi: 600 },
  tile: { id: 'tile', plural: 'tiles', w: TILE.size, h: TILE.size, bleed: TILE.bleed, cols: 2, rows: 2, dpi: 300 },
  aid: { id: 'aid', plural: 'aids', w: AID.w, h: AID.h, bleed: AID.bleed, cols: 1, rows: 2, dpi: 600 },
} as const satisfies Record<string, Piece>;

/** One printable face: a card front, a deck's back, a tile. */
export interface Printable {
  /** Unique within its piece, and the file's name: `skill/07-agile`, `p7-01`. A folder part groups it in the ZIP. */
  name: string;
  /** The face as an SVG document, at trim size or with the bleed. */
  svg: (bleed: boolean) => string;
}

/** A piece's size with or without its bleed, mm. */
export const pieceSize = (p: Format, bleed: boolean) => ({ w: p.w + (bleed ? 2 * p.bleed : 0), h: p.h + (bleed ? 2 * p.bleed : 0) });

/** How a piece's size reads in notes and READMEs: "63.5 × 88.9 mm, with 3 mm bleed 69.5 × 94.9 mm". */
export function sizeNote(p: Format, bleed: boolean): string {
  const b = pieceSize(p, true);
  return `${p.w} × ${p.h} mm` + (bleed ? `, with ${p.bleed} mm bleed ${b.w} × ${b.h} mm` : ' (trim, no bleed)');
}

/** A face's name in a file name: `skill/07-agile` → `skill-07-agile`. */
const slug = (item: Printable) => item.name.replaceAll('/', '-');

/** A single export's file name: `cubic-card-skill-07-agile-bleed-300dpi.png`, `cubic-tile-p7-01.svg`. */
export function fileName(p: Format, item: Printable, o: { bleed: boolean; dpi?: number; ext: string }): string {
  return `cubic-${p.id}-${slug(item)}${o.bleed ? '-bleed' : ''}${o.dpi ? `-${o.dpi}dpi` : ''}.${o.ext}`;
}

/** One face's CMYK PDF: `cubic-proof-a4-fogra39.pdf`, `…-fogra39-deep.pdf` with the deep black (always with the bleed). */
export const cmykName = (p: Format, item: Printable, deep: boolean) => `cubic-${p.id}-${slug(item)}-${pressTag(deep)}.pdf`;

/** A whole set's ZIP: `cubic-cards-community-bleed.zip`, `cubic-cards-community-fogra39.zip`. */
export const setName = (p: Piece, o: { part?: string; tag?: string }) =>
  `cubic-${p.plural}${o.part ? `-${o.part}` : ''}${o.tag ? `-${o.tag}` : ''}.zip`;

/** Press sheets of pieces printed together: `cubic-tiles-aids-a4-fogra39.pdf`, `…-fogra39-deep.pdf` with the deep black. */
export const sheetName = (name: string, deep: boolean) => `cubic-${name}-a4-${pressTag(deep)}.pdf`;
