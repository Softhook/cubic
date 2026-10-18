/** Print files: every piece fits its sheets with room for crop marks, backs land behind their fronts, press sheets bleed only round each block, names follow one pattern. */
import { describe, expect, it } from 'vitest';
import { PIECES, fileName, pieceSize, setName, sheetName, type Piece } from '../src/print/pieces';
import { A4, pressPages, sheetsHtml } from '../src/print/sheets';

const pieces = Object.values(PIECES) as Piece[];

/** Each sheet's images as [src, left, top] in mm. */
function sheets(html: string) {
  return html
    .split('<section class="sheet">')
    .slice(1)
    .map((s) =>
      [...s.matchAll(/<img src="([^"]*)" style="left:([\d.]+)mm;top:([\d.]+)mm">/g)].map(
        (m) => [m[1], Number(m[2]), Number(m[3])] as const,
      ),
    );
}

describe('print sheets', () => {
  it.each(pieces)('fit $id on A4 with a margin for crop marks', (p) => {
    expect((A4.w - p.cols * p.w) / 2).toBeGreaterThan(5);
    expect((A4.h - p.rows * p.h) / 2).toBeGreaterThan(5);
  });

  it.each(pieces)('put a crop mark at both ends of every cut ($id)', (p) => {
    const html = sheetsHtml(p, [{ front: 'a' }]);
    expect(html.match(/class="v"/g)).toHaveLength(2 * (p.cols + 1));
    expect(html.match(/class="h"/g)).toHaveLength(2 * (p.rows + 1));
  });

  it.each(pieces)('keep the crop marks 4 mm inside the paper, where home printers print ($id)', (p) => {
    const html = sheetsHtml(p, [{ front: 'a' }]);
    expect(html.match(/class="[vh]" style/g)).toHaveLength(2 * (p.cols + p.rows + 2));
    for (const [, left, top, len] of html.matchAll(/class="v" style="left:([\d.-]+)mm;top:([\d.-]+)mm;height:([\d.-]+)mm"/g)) {
      expect(Number(len)).toBeGreaterThan(2);
      expect(Number(top)).toBeGreaterThanOrEqual(4 - 1e-9);
      expect(Number(top) + Number(len)).toBeLessThanOrEqual(A4.h - 4 + 1e-9);
      expect(Number(left)).toBeGreaterThan(0);
    }
    for (const [, top, left, len] of html.matchAll(/class="h" style="top:([\d.-]+)mm;left:([\d.-]+)mm;width:([\d.-]+)mm"/g)) {
      expect(Number(len)).toBeGreaterThan(2);
      expect(Number(left)).toBeGreaterThanOrEqual(4 - 1e-9);
      expect(Number(left) + Number(len)).toBeLessThanOrEqual(A4.w - 4 + 1e-9);
      expect(Number(top)).toBeGreaterThan(0);
    }
    expect([
      ...html.matchAll(/class="[vh]" style="(?:left|top):[\d.-]+mm;(?:top|left):[\d.-]+mm;(?:height|width):[\d.-]+mm"/g),
    ]).toHaveLength(2 * (p.cols + p.rows + 2));
  });

  it('fills pages in reading order, then starts a new page', () => {
    const p = PIECES.card;
    const pages = sheets(
      sheetsHtml(
        p,
        Array.from({ length: 10 }, (_, i) => ({ front: `f${i}` })),
      ),
    );
    expect(pages.map((s) => s.length)).toEqual([9, 1]);
    const [, x0, y0] = pages[0][0];
    expect(pages[0][4]).toEqual(['f4', x0 + p.w, y0 + p.h]);
    expect(pages[1][0]).toEqual(['f9', x0, y0]);
  });

  it('mirrors the backs left to right, so each lands behind its front on a long-edge duplex', () => {
    const p = PIECES.card;
    const faces = Array.from({ length: 4 }, (_, i) => ({ front: `f${i}`, back: `b${i}` }));
    const [fronts, backs] = sheets(sheetsHtml(p, faces, true));
    const width = A4.w;
    for (const [i, [, x, y]] of fronts.entries()) {
      const back = backs.find(([src]) => src === `b${i}`)!;
      expect(back[1] + p.w).toBeCloseTo(width - x);
      expect(back[2]).toBe(y);
    }
  });

  it('draws the marks as borders, which print without "Background graphics"', () => {
    expect(sheetsHtml(PIECES.tile, [{ front: 'a' }])).not.toMatch(/background:#000/);
  });
});

describe('press sheets', () => {
  const { w, h, bleed: b } = PIECES.tile;
  const pages = pressPages(PIECES.tile, [0, 1, 2, 3, 4]);

  it('fills each page of the grid and starts a new one when it is full', () => {
    expect(pages.map((p) => p.images.length)).toEqual([4, 1]);
  });

  it('draws each face with its bleed, cut at its left and top where the piece before it is, so it covers that piece’s bleed', () => {
    const [topLeft, topRight, , bottomRight] = pages[0].images;
    const x0 = (A4.w - 2 * w) / 2;
    const y0 = (A4.h - 2 * h) / 2;
    expect(topLeft.at).toEqual({ x: x0 - b, y: y0 - b, w: w + 2 * b, h: h + 2 * b });
    // Its right and bottom bleed run under the pieces drawn after it: no seam between them.
    expect(topLeft.clip).toEqual(topLeft.at);
    expect(topRight.clip).toEqual({ x: x0 + w, y: y0 - b, w: w + b, h: h + 2 * b });
    expect(bottomRight.clip).toEqual({ x: x0 + w, y: y0 + h, w: w + b, h: h + b });
    // Alone on its page: bleed all round.
    expect(pages[1].images[0].clip).toEqual(pages[1].images[0].at);
  });

  it.each([PIECES.tile, PIECES.aid])('keeps the crop marks on the paper and clear of the bleed: $id', (piece) => {
    const { w, h, cols, rows, bleed } = piece;
    const x0 = (A4.w - cols * w) / 2;
    const y0 = (A4.h - rows * h) / 2;
    const [page] = pressPages(piece, [0]);
    for (const [x1, y1, x2, y2] of page.marks!) {
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(A4.w);
        expect(y).toBeLessThanOrEqual(A4.h);
        const inside = x > x0 - bleed && x < x0 + cols * w + bleed && y > y0 - bleed && y < y0 + rows * h + bleed;
        expect(inside).toBe(false);
      }
    }
  });
});

describe('print file names', () => {
  it('follow cubic-<piece>-<name>[-bleed][-<dpi>dpi] cubic-<pieces>[-<part>][-<tag>] and cubic-<name>-a4-<condition>', () => {
    const card = { name: 'skill/07-agile', svg: () => '' };
    expect(fileName(PIECES.card, card, { bleed: true, dpi: 300, ext: 'png' })).toBe('cubic-card-skill-07-agile-bleed-300dpi.png');
    expect(fileName(PIECES.tile, { name: 'p7-01', svg: () => '' }, { bleed: false, ext: 'svg' })).toBe('cubic-tile-p7-01.svg');
    expect(setName(PIECES.card, { part: 'community', tag: 'bleed' })).toBe('cubic-cards-community-bleed.zip');
    expect(setName(PIECES.tile, {})).toBe('cubic-tiles.zip');
    expect(sheetName('tiles-aids')).toBe('cubic-tiles-aids-a4-fogra39.pdf');
  });

  it('size pieces with their bleed on every side', () => {
    expect(pieceSize(PIECES.card, true)).toEqual({ w: 69.5, h: 94.9 });
    expect(pieceSize(PIECES.tile, false)).toEqual({ w: 96, h: 96 });
  });
});
