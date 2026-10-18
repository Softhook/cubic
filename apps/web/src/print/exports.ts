import { download, drawSvg, encode } from '../files';
import { cmykPdf, deflate, type PdfImage } from './pdf';
import { cmykName, cmykSetName, fileName, pieceSize, setName, sizeNote, type Format, type Piece, type Printable } from './pieces';
import { PRESS, tagPng, toCmyk } from './press';
import { printDocument, sheetsHtml, type Paper } from './sheets';
import { zip } from './zip';

/** Print exports, the same for every piece: one face as PNG, a whole set as PNGs or CMYK PDFs, print sheets. */

export type Progress = (message: string) => void;

/** Draws an SVG document of `w` × `h` mm at a print resolution, opaque. */
function drawForPrint(svg: string, w: number, h: number, dpi: number): Promise<HTMLCanvasElement> {
  const px = (mm: number) => Math.round((mm / 25.4) * dpi);
  return drawSvg(svg, px(w), px(h), '#fff');
}

/** Rasterises an SVG document of `w` × `h` mm at a print resolution: an opaque PNG, tagged sRGB and with its dpi. */
export async function svgToPng(svg: string, w: number, h: number, dpi: number): Promise<Blob> {
  return tagPng(await encode(await drawForPrint(svg, w, h, dpi)), dpi);
}

/** One face as a PNG at the format's dpi. */
export async function exportPng(f: Format, item: Printable, bleed: boolean): Promise<void> {
  const { w, h } = pieceSize(f, bleed);
  download(fileName(f, item, { bleed, dpi: f.dpi, ext: 'png' }), await svgToPng(item.svg(bleed), w, h, f.dpi));
}

/** A set as a ZIP: one PNG per face, named and foldered by the face's name, and a README. */
export async function exportZip(
  piece: Piece,
  items: Printable[],
  o: { bleed: boolean; part?: string; notes?: string },
  progress: Progress,
): Promise<void> {
  const { w, h } = pieceSize(piece, o.bleed);
  const files: { name: string; blob: Blob }[] = [];
  for (const [k, item] of items.entries()) {
    progress(`Rendering ${k + 1}/${items.length}`);
    files.push({ name: `${item.name}.png`, blob: await svgToPng(item.svg(o.bleed), w, h, piece.dpi) });
  }
  const readme =
    `Cubic ${piece.plural}, ${sizeNote(piece, o.bleed)}.\n` +
    `PNG at ${piece.dpi} dpi, one file per face. RGB, tagged sRGB: please convert with your press profile.\n` +
    (o.notes ?? '');
  files.push({ name: 'README.txt', blob: new Blob([readme], { type: 'text/plain' }) });
  progress('Packing…');
  download(setName(piece, o), await zip(files));
}

/** Opens the print dialog on sheets of these faces at trim size; each distinct face is drawn once. */
export async function printSheets(
  piece: Piece,
  faces: { front: Printable; back?: Printable }[],
  o: { paper: Paper; withBacks: boolean },
  progress: Progress,
): Promise<void> {
  const unique = new Map<string, Printable>();
  for (const f of faces) {
    unique.set(f.front.name, f.front);
    if (o.withBacks && f.back) unique.set(f.back.name, f.back);
  }
  const { w, h } = pieceSize(piece, false);
  const urls = new Map<string, string>();
  for (const [name, item] of unique) {
    progress(`Rendering ${urls.size + 1}/${unique.size}`);
    urls.set(name, URL.createObjectURL(await svgToPng(item.svg(false), w, h, piece.dpi)));
  }
  progress('Opening print dialog…');
  const images = faces.map((f) => ({ front: urls.get(f.front.name)!, back: f.back && urls.get(f.back.name) }));
  await printDocument(sheetsHtml(piece, images, o.paper, o.withBacks), () => urls.forEach((u) => URL.revokeObjectURL(u)));
}

/** A face drawn with its bleed at the format's dpi and converted to the press's CMYK, ready for a PDF page. */
async function cmykImage(f: Format, item: Printable): Promise<PdfImage> {
  const { w, h } = pieceSize(f, true);
  const canvas = await drawForPrint(item.svg(true), w, h, f.dpi);
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data: await deflate(toCmyk(rgba)) };
}

/** A CMYK PDF of these images, one per page with the format's bleed (pdf.ts). */
function cmykFile(f: Format, title: string, images: PdfImage[]): Blob {
  const { w, h } = pieceSize(f, true);
  const pages = images.map((_, k) => k);
  return cmykPdf({ title, w, h, bleed: f.bleed, condition: PRESS.condition, conditionInfo: PRESS.profile, images, pages });
}

/** One face as a CMYK PDF: the press test. */
export async function exportCmykPdf(f: Format, item: Printable): Promise<void> {
  download(cmykName(f, item), cmykFile(f, `Cubic ${f.id} ${item.name}`, [await cmykImage(f, item)]));
}

/**
 * A set as CMYK PDFs for a print service that takes one file per piece (Doxzoo): a ZIP with a PDF per
 * front, its back as page 2 when it has one (double-sided printing takes pages front, back), every page
 * with its bleed and no crop marks, converted for the press (press.ts `toCmyk`). How many of each to
 * order goes in `order.csv` (from `quantities`, by front name), not as repeated pages. Each back is drawn once.
 */
export async function exportCmykSet(
  piece: Piece,
  faces: { front: Printable; back?: Printable }[],
  quantities: Map<string, number>,
  o: { part?: string; notes?: string },
  progress: Progress,
): Promise<void> {
  const backs = new Map<string, PdfImage>();
  const files: { name: string; blob: Blob }[] = [];
  const order = ['file,quantity,pages'];
  for (const [k, f] of faces.entries()) {
    progress(`Converting ${k + 1}/${faces.length}`);
    const images = [await cmykImage(piece, f.front)];
    if (f.back) {
      if (!backs.has(f.back.name)) backs.set(f.back.name, await cmykImage(piece, f.back));
      images.push(backs.get(f.back.name)!);
    }
    const name = `${f.front.name}.pdf`;
    files.push({ name, blob: cmykFile(piece, `Cubic ${piece.id} ${f.front.name}`, images) });
    order.push(`${name},${quantities.get(f.front.name) ?? 1},${images.length}`);
  }
  const readme =
    `Cubic ${piece.plural}, ${sizeNote(piece, true)}.\n` +
    `One CMYK PDF per ${piece.id} (${PRESS.profile}), ${piece.dpi} dpi, no crop marks` +
    (faces.some((f) => f.back) ? ': page 1 the front, page 2 the back, for double-sided printing' : '') +
    `.\nHow many of each to order: order.csv. Upload with "Do not scale".\n` +
    (o.notes ?? '');
  files.push({ name: 'order.csv', blob: new Blob([order.join('\n') + '\n'], { type: 'text/csv' }) });
  files.push({ name: 'README.txt', blob: new Blob([readme], { type: 'text/plain' }) });
  progress('Packing…');
  download(cmykSetName(piece, o), await zip(files));
}
