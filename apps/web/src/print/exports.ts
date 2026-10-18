import { download, drawBands } from '../files';
import { cmykPdf, deflate, fullPage, type PdfImage, type PdfOptions } from './pdf';
import { cmykName, fileName, pieceSize, setName, sheetName, sizeNote, type Format, type Piece, type Printable } from './pieces';
import { PRESS, encodePng, toCmyk } from './press';
import { A4, pressPages, printDocument, sheetsHtml, type Paper } from './sheets';
import { zip } from './zip';

/** Print exports: one face as PNG, a whole set as PNGs, print sheets, and CMYK PDFs for a press (a file per card, or press sheets). */

export type Progress = (message: string) => void;

/** A file in a ZIP. */
type ZipFile = { name: string; blob: Blob };

/** A text file for a ZIP: a README, an order list. */
const textFile = (name: string, text: string, type = 'text/plain'): ZipFile => ({ name, blob: new Blob([text], { type }) });

const px = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

/**
 * Draws an SVG document of `w` × `h` mm at a print resolution, opaque. A page too big for one canvas (the
 * A4 press test at 600 dpi, in iOS Safari) draws in bands overlapping by 17 mm, as far as the art's filters reach (files.ts `drawBands`).
 */
const drawForPrint = (svg: string, w: number, h: number, dpi: number) => drawBands(svg, px(w, dpi), px(h, dpi), '#fff', px(17, dpi));

/** Rasterises an SVG document of `w` × `h` mm at a print resolution: an opaque PNG, tagged sRGB and with its dpi. */
export async function svgToPng(svg: string, w: number, h: number, dpi: number): Promise<Blob> {
  return encodePng(drawForPrint(svg, w, h, dpi), px(w, dpi), px(h, dpi), dpi);
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
  const files: ZipFile[] = [];
  for (const [k, item] of items.entries()) {
    progress(`Rendering ${k + 1}/${items.length}`);
    files.push({ name: `${item.name}.png`, blob: await svgToPng(item.svg(o.bleed), w, h, piece.dpi) });
  }
  const readme =
    `Cubic ${piece.plural}, ${sizeNote(piece, o.bleed)}.\n` +
    `PNG at ${piece.dpi} dpi, one file per face. RGB, tagged sRGB: please convert with your press profile.\n` +
    (o.notes ?? '');
  files.push(textFile('README.txt', readme));
  progress('Packing…');
  download(setName(piece, { part: o.part, tag: o.bleed ? 'bleed' : undefined }), await zip(files));
}

/** Opens the print dialog on sheets of these faces at trim size; each distinct face is drawn once. */
export async function printSheets(
  piece: Piece,
  faces: { front: Printable; back?: Printable }[],
  o: { withBacks: boolean; paper: Paper },
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
  await printDocument(sheetsHtml(piece, images, o), () => urls.forEach((u) => URL.revokeObjectURL(u)));
}

/** A face drawn with its bleed at the format's dpi and converted to the press's CMYK, ready for a PDF page. */
async function cmykImage(f: Format, item: Printable): Promise<PdfImage> {
  const { w, h } = pieceSize(f, true);
  const bands = drawForPrint(item.svg(true), w, h, f.dpi);
  const data = await deflate(
    (async function* () {
      for await (const rgba of bands) yield toCmyk(rgba);
    })(),
  );
  return { width: px(w, f.dpi), height: px(h, f.dpi), data };
}

/** A CMYK PDF for the press (pdf.ts), its output intent the press's printing condition. */
const pressPdf = (o: Omit<PdfOptions, 'condition' | 'conditionInfo'>) =>
  cmykPdf({ ...o, condition: PRESS.condition, conditionInfo: PRESS.profile });

/** A CMYK PDF of these images, one per page with the format's bleed. */
function cmykFile(f: Format, title: string, images: PdfImage[]): Blob {
  const { w, h } = pieceSize(f, true);
  return pressPdf({ title, w, h, bleed: f.bleed, images, pages: images.map((_, k) => fullPage(k, w, h)) });
}

/** One face as a CMYK PDF: the press test. */
export async function exportCmykPdf(f: Format, item: Printable): Promise<void> {
  download(cmykName(f, item), cmykFile(f, `Cubic ${f.id} ${item.name}`, [await cmykImage(f, item)]));
}

/**
 * A set as CMYK PDFs for a print service that takes one file per piece (cards, Doxzoo): a ZIP with a
 * PDF per front, its back as page 2 when it has one (double-sided printing takes pages front, back),
 * every page with its bleed and no crop marks, converted for the press (press.ts `toCmyk`). `faces` has
 * every copy; how many of each to order goes in `order.csv`, not as repeated pages. Each back is drawn once.
 */
export async function exportCmykFiles(
  piece: Piece,
  faces: { front: Printable; back?: Printable }[],
  o: { part?: string },
  progress: Progress,
): Promise<void> {
  const fronts = new Map<string, { face: (typeof faces)[number]; copies: number }>();
  for (const f of faces) {
    const seen = fronts.get(f.front.name);
    if (seen) seen.copies++;
    else fronts.set(f.front.name, { face: f, copies: 1 });
  }
  const backs = new Map<string, PdfImage>();
  const files: ZipFile[] = [];
  const order = ['file,quantity,pages'];
  for (const [k, { face, copies }] of [...fronts.values()].entries()) {
    progress(`Converting ${k + 1}/${fronts.size}`);
    const images = [await cmykImage(piece, face.front)];
    if (face.back) {
      if (!backs.has(face.back.name)) backs.set(face.back.name, await cmykImage(piece, face.back));
      images.push(backs.get(face.back.name)!);
    }
    const name = `${face.front.name}.pdf`;
    files.push({ name, blob: cmykFile(piece, `Cubic ${piece.id} ${face.front.name}`, images) });
    order.push(`${name},${copies},${images.length}`);
  }
  const readme =
    `Cubic ${piece.plural}, ${sizeNote(piece, true)}.\n` +
    `One CMYK PDF per ${piece.id}, converted for ${PRESS.described}, ${piece.dpi} dpi, no crop marks` +
    (faces.some((f) => f.back) ? ': page 1 the front, page 2 the back, for double-sided printing' : '') +
    `.\nHow many of each to order: order.csv. Upload with "Do not scale".\n`;
  files.push(textFile('order.csv', order.join('\n') + '\n', 'text/csv'));
  files.push(textFile('README.txt', readme));
  progress('Packing…');
  download(setName(piece, { part: o.part, tag: PRESS.tag }), await zip(files));
}

/** Pieces that print together on one stock, as one CMYK PDF of A4 press sheets (`exportCmykSheets`). */
export interface PressSheets {
  /** For the file name and the panel: `tiles-aids`, "Tiles + aids". */
  name: string;
  label: string;
  /** What's on the sheets, for the panel's note. */
  contents: string;
  /** Each piece and every copy of its faces, in page order; rejects if the fonts didn't load. */
  groups: () => Promise<{ piece: Piece; faces: Printable[] }[]>;
}

/**
 * Press sheets as one CMYK PDF: each piece in its sheet grid (sheets.ts `pressPages`), butted with crop
 * marks, single-sided, a new page for each piece. Every copy is placed; each distinct face is converted once.
 */
export async function exportCmykSheets(sheets: PressSheets, progress: Progress): Promise<void> {
  const groups = await sheets.groups();
  const images: PdfImage[] = [];
  const index = new Map<string, number>();
  const total = new Set(groups.flatMap((g) => g.faces.map((f) => `${g.piece.id}/${f.name}`))).size;
  const pages = [];
  for (const { piece, faces } of groups) {
    const placed: number[] = [];
    for (const f of faces) {
      const key = `${piece.id}/${f.name}`;
      if (!index.has(key)) {
        progress(`Converting ${index.size + 1}/${total}`);
        index.set(key, images.push(await cmykImage(piece, f)) - 1);
      }
      placed.push(index.get(key)!);
    }
    pages.push(...pressPages(piece, placed));
  }
  progress('Writing PDF…');
  download(sheetName(sheets.name), pressPdf({ title: `Cubic ${sheets.label}`, ...A4, bleed: 0, images, pages }));
}
