import type { Piece } from './pieces';

/** Print sheets: pieces laid out on paper with crop marks, and printing them from the browser. */

export type Paper = 'a4' | 'letter';

export const PAPER: Record<Paper, { w: number; h: number; name: string }> = {
  a4: { w: 210, h: 297, name: 'A4' },
  letter: { w: 215.9, h: 279.4, name: 'US Letter' },
};

/**
 * Print sheets: faces (image URLs) at trim size in the piece's grid, butted together so one cut serves
 * two pieces, with crop marks in the margin. With backs, each page of fronts is followed by its backs,
 * columns mirrored so they land behind their fronts when printed double-sided on the long edge.
 */
export function sheetsHtml(piece: Piece, faces: { front: string; back?: string }[], paper: Paper, withBacks = false): string {
  const size = PAPER[paper];
  const { w, h, cols, rows } = piece;
  const x0 = (size.w - cols * w) / 2;
  const y0 = (size.h - rows * h) / 2;
  const markV = Math.min(5, y0 - 1.5);
  const markH = Math.min(5, x0 - 1.5);
  let marks = '';
  for (let i = 0; i <= cols; i++) {
    // Less half the 0.2 mm line, so each mark is centred on its cut.
    const x = x0 + i * w - 0.1;
    marks += `<i style="left:${x}mm;top:${y0 - markV - 1}mm;height:${markV}mm" class="v"></i><i style="left:${x}mm;top:${y0 + rows * h + 1}mm;height:${markV}mm" class="v"></i>`;
  }
  for (let i = 0; i <= rows; i++) {
    const y = y0 + i * h - 0.1;
    marks += `<i style="top:${y}mm;left:${x0 - markH - 1}mm;width:${markH}mm" class="h"></i><i style="top:${y}mm;left:${x0 + cols * w + 1}mm;width:${markH}mm" class="h"></i>`;
  }
  const page = (cells: { src: string; col: number; row: number }[]) =>
    `<section class="sheet">${cells.map((c) => `<img src="${c.src}" style="left:${x0 + c.col * w}mm;top:${y0 + c.row * h}mm">`).join('')}${marks}</section>`;
  const perPage = cols * rows;
  let html = '';
  for (let p = 0; p < faces.length; p += perPage) {
    const chunk = faces.slice(p, p + perPage);
    html += page(chunk.map((c, k) => ({ src: c.front, col: k % cols, row: Math.floor(k / cols) })));
    if (withBacks) html += page(chunk.flatMap((c, k) => (c.back ? [{ src: c.back, col: cols - 1 - (k % cols), row: Math.floor(k / cols) }] : [])));
  }
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Cubic ${piece.plural}</title><style>` +
    `@page{size:${size.w}mm ${size.h}mm;margin:0}html,body{margin:0}` +
    `.sheet{position:relative;width:${size.w}mm;height:${size.h}mm;overflow:hidden;break-after:page}` +
    `.sheet img{position:absolute;width:${w}mm;height:${h}mm}.sheet i{position:absolute;width:0;height:0}` +
    // Borders, not backgrounds: browsers drop background colours when printing unless "Background graphics" is on.
    `.sheet i.v{border-left:.2mm solid #000}.sheet i.h{border-top:.2mm solid #000}` +
    `</style></head><body>${html}</body></html>`
  );
}

/** Prints an HTML document from a hidden frame, once its images have loaded. */
export async function printDocument(html: string, cleanup: () => void): Promise<void> {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  // print() blocks until the dialog closes in most browsers; keep the frame a while for those where it doesn't.
  setTimeout(() => {
    frame.remove();
    cleanup();
  }, 60_000);
}
