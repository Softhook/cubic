import { download, rasterise } from '../files';
import { PRINT_DPI, fileName, pieceSize, setName, sizeNote, type Piece, type Printable } from './pieces';
import { printDocument, sheetsHtml, type Paper } from './sheets';
import { zip } from './zip';

/** Print exports, the same for every piece: one face as PNG or SVG, a whole set as a ZIP, print sheets. */

export type Progress = (message: string) => void;

/** Rasterises an SVG document of `w` × `h` mm at a print resolution. */
export function svgToPng(svg: string, w: number, h: number, dpi: number): Promise<Blob> {
  const px = (mm: number) => Math.round((mm / 25.4) * dpi);
  return rasterise(svg, px(w), px(h));
}

export async function exportPng(piece: Piece, item: Printable, bleed: boolean, dpi: number): Promise<void> {
  const { w, h } = pieceSize(piece, bleed);
  download(fileName(piece, item, { bleed, dpi, ext: 'png' }), await svgToPng(item.svg(bleed), w, h, dpi));
}

/** The live SVG, filters and all: renders in browsers only. */
export function exportSvg(piece: Piece, item: Printable, bleed: boolean): void {
  download(fileName(piece, item, { bleed, ext: 'svg' }), new Blob([item.svg(bleed)], { type: 'image/svg+xml' }));
}

/** A set as a ZIP: one PNG per face, named and foldered by the face's name, and a README. */
export async function exportZip(piece: Piece, items: Printable[], o: { bleed: boolean; part?: string; notes?: string }, progress: Progress): Promise<void> {
  const { w, h } = pieceSize(piece, o.bleed);
  const files: { name: string; blob: Blob }[] = [];
  for (const [k, item] of items.entries()) {
    progress(`Rendering ${k + 1}/${items.length}`);
    files.push({ name: `${item.name}.png`, blob: await svgToPng(item.svg(o.bleed), w, h, PRINT_DPI) });
  }
  const readme = `Cubic ${piece.plural}, ${sizeNote(piece, o.bleed)}.\nPNG at ${PRINT_DPI} dpi, one file per face.\n${o.notes ?? ''}`;
  files.push({ name: 'README.txt', blob: new Blob([readme], { type: 'text/plain' }) });
  progress('Packing…');
  download(setName(piece, o), await zip(files));
}

/** Opens the print dialog on sheets of these faces at trim size; each distinct face is drawn once. */
export async function printSheets(piece: Piece, faces: { front: Printable; back?: Printable }[], paper: Paper, withBacks: boolean, progress: Progress): Promise<void> {
  const unique = new Map<string, Printable>();
  for (const f of faces) {
    unique.set(f.front.name, f.front);
    if (withBacks && f.back) unique.set(f.back.name, f.back);
  }
  const { w, h } = pieceSize(piece, false);
  const urls = new Map<string, string>();
  for (const [name, item] of unique) {
    progress(`Rendering ${urls.size + 1}/${unique.size}`);
    urls.set(name, URL.createObjectURL(await svgToPng(item.svg(false), w, h, PRINT_DPI)));
  }
  progress('Opening print dialog…');
  const images = faces.map((f) => ({ front: urls.get(f.front.name)!, back: f.back && urls.get(f.back.name) }));
  await printDocument(sheetsHtml(piece, images, paper, withBacks), () => urls.forEach((u) => URL.revokeObjectURL(u)));
}
