import { download, drawSvg, encode } from '../files';
import { CMYK_TABLE } from './cmykTable';
import { cmykPdf, deflate, type PdfImage } from './pdf';
import pressProfileUrl from './press.icc?url';
import { cmykName, cmykSetName, fileName, pieceSize, setName, sizeNote, type Piece, type Printable } from './pieces';
import { tagPng, toCmyk } from './press';
import { printDocument, sheetsHtml, type Paper } from './sheets';
import { zip } from './zip';

/** Print exports, the same for every piece: one face as PNG or SVG, a whole set as a ZIP, print sheets. */

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

export async function exportPng(piece: Piece, item: Printable, bleed: boolean, dpi: number): Promise<void> {
  const { w, h } = pieceSize(piece, bleed);
  download(fileName(piece, item, { bleed, dpi, ext: 'png' }), await svgToPng(item.svg(bleed), w, h, dpi));
}

/** The live SVG, filters and all: renders in browsers only. */
export function exportSvg(piece: Piece, item: Printable, bleed: boolean): void {
  download(fileName(piece, item, { bleed, ext: 'svg' }), new Blob([item.svg(bleed)], { type: 'image/svg+xml' }));
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

/** A face drawn with its bleed at the piece's dpi and converted to the press's CMYK, ready for a PDF page. */
async function cmykImage(piece: Piece, item: Printable): Promise<PdfImage> {
  const { w, h } = pieceSize(piece, true);
  const canvas = await drawForPrint(item.svg(true), w, h, piece.dpi);
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data: await deflate(toCmyk(rgba)) };
}

let pressProfile: Promise<Uint8Array<ArrayBuffer>> | null = null;

/** The press profile the CMYK is made for (press.icc, from scripts/cmyk-table.ts), compressed for embedding. Fetched once. */
function loadPressProfile(): Promise<Uint8Array<ArrayBuffer>> {
  pressProfile ??= fetch(pressProfileUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`press profile: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((b) => deflate(new Uint8Array(b)));
  pressProfile.catch(() => (pressProfile = null));
  return pressProfile;
}

/** A CMYK PDF of these images, one per page with the piece's bleed, its press profile embedded (pdf.ts). */
async function piecePdf(piece: Piece, title: string, images: PdfImage[]): Promise<Blob> {
  const { w, h } = pieceSize(piece, true);
  const pages = images.map((_, k) => k);
  const profile = await loadPressProfile();
  return cmykPdf({
    title,
    w,
    h,
    bleed: piece.bleed,
    condition: CMYK_TABLE.condition,
    conditionInfo: CMYK_TABLE.profile,
    profile,
    images,
    pages,
  });
}

/** One face as a CMYK PDF, with its back as page 2 when given. */
export async function exportCmykPdf(piece: Piece, item: Printable, back?: Printable): Promise<void> {
  const images = [await cmykImage(piece, item), ...(back ? [await cmykImage(piece, back)] : [])];
  download(cmykName(piece, item), await piecePdf(piece, `Cubic ${piece.id} ${item.name}`, images));
}

/**
 * A set as CMYK PDFs for a print service that takes one file per piece (Doxzoo): a ZIP with a PDF per
 * front, its back as page 2 when `withBacks` (double-sided printing takes pages front, back), every page
 * with its bleed and no crop marks, converted for the press (press.ts `toCmyk`). How many of each to
 * order goes in `order.csv` (from `quantities`, by front name), not as repeated pages. Each back is drawn once.
 */
export async function exportCmykSet(
  piece: Piece,
  faces: { front: Printable; back?: Printable }[],
  quantities: Map<string, number>,
  o: { withBacks: boolean; part?: string; notes?: string },
  progress: Progress,
): Promise<void> {
  const backs = new Map<string, PdfImage>();
  const files: { name: string; blob: Blob }[] = [];
  const order = ['file,quantity,pages'];
  for (const [k, f] of faces.entries()) {
    progress(`Converting ${k + 1}/${faces.length}`);
    const images = [await cmykImage(piece, f.front)];
    if (o.withBacks && f.back) {
      if (!backs.has(f.back.name)) backs.set(f.back.name, await cmykImage(piece, f.back));
      images.push(backs.get(f.back.name)!);
    }
    const name = `${f.front.name}.pdf`;
    files.push({ name, blob: await piecePdf(piece, `Cubic ${piece.id} ${f.front.name}`, images) });
    order.push(`${name},${quantities.get(f.front.name) ?? 1},${images.length}`);
  }
  const readme =
    `Cubic ${piece.plural}, ${sizeNote(piece, true)}.\n` +
    `One CMYK PDF per ${piece.id} (${CMYK_TABLE.profile}), ${piece.dpi} dpi, no crop marks` +
    (o.withBacks ? ': page 1 the front, page 2 the back, for double-sided printing' : '') +
    `.\nHow many of each to order: order.csv. Upload with "Do not scale".\n` +
    (o.notes ?? '');
  files.push({ name: 'order.csv', blob: new Blob([order.join('\n') + '\n'], { type: 'text/csv' }) });
  files.push({ name: 'README.txt', blob: new Blob([readme], { type: 'text/plain' }) });
  progress('Packing…');
  download(cmykSetName(piece, o), await zip(files));
}
