import { CARD } from '@quantum/art';

/** Print sheets for the Art Lab's cards page: cards laid out on paper with crop marks, and printing them. */

export type Paper = 'a4' | 'letter';

export const PAPER: Record<Paper, { w: number; h: number; name: string }> = {
  a4: { w: 210, h: 297, name: 'A4' },
  letter: { w: 215.9, h: 279.4, name: 'US Letter' },
};

/**
 * Print sheets: 3 × 3 cards at trim size, butted together so one cut serves two cards, with crop
 * marks in the margin. With backs, each page of fronts is followed by its backs, columns mirrored
 * so they land behind their fronts when printed double-sided on the long edge.
 */
export function sheetsHtml(cards: { front: string; back: string }[], paper: Paper, withBacks: boolean): string {
  const size = PAPER[paper];
  const { w, h } = CARD;
  const x0 = (size.w - 3 * w) / 2;
  const y0 = (size.h - 3 * h) / 2;
  const mark = Math.min(5, y0 - 1.5);
  let marks = '';
  for (let i = 0; i <= 3; i++) {
    const x = x0 + i * w;
    const y = y0 + i * h;
    marks += `<i style="left:${x}mm;top:${y0 - mark - 1}mm;width:.2mm;height:${mark}mm"></i><i style="left:${x}mm;top:${y0 + 3 * h + 1}mm;width:.2mm;height:${mark}mm"></i>`;
    marks += `<i style="top:${y}mm;left:${x0 - 6}mm;height:.2mm;width:5mm"></i><i style="top:${y}mm;left:${x0 + 3 * w + 1}mm;height:.2mm;width:5mm"></i>`;
  }
  const page = (cells: { src: string; col: number; row: number }[]) =>
    `<section class="sheet">${cells.map((c) => `<img src="${c.src}" style="left:${x0 + c.col * w}mm;top:${y0 + c.row * h}mm">`).join('')}${marks}</section>`;
  let html = '';
  for (let p = 0; p < cards.length; p += 9) {
    const chunk = cards.slice(p, p + 9);
    html += page(chunk.map((c, k) => ({ src: c.front, col: k % 3, row: Math.floor(k / 3) })));
    if (withBacks) html += page(chunk.map((c, k) => ({ src: c.back, col: 2 - (k % 3), row: Math.floor(k / 3) })));
  }
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Cubic cards</title><style>` +
    `@page{size:${size.w}mm ${size.h}mm;margin:0}html,body{margin:0}` +
    `.sheet{position:relative;width:${size.w}mm;height:${size.h}mm;overflow:hidden;break-after:page}` +
    `.sheet img{position:absolute;width:${w}mm;height:${h}mm}.sheet i{position:absolute;background:#000}` +
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
