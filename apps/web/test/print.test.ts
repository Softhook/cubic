/** Print files: every piece fits its sheets with room for crop marks, backs land behind their fronts, press sheets bleed only round each block, names follow one pattern. */
import { describe, expect, it } from 'vitest';
import { PIECES, fileName, pieceSize, setName, sheetName, type Piece } from '../src/print/pieces';
import { PAPER, pressPages, sheetsHtml, type Paper } from '../src/print/sheets';

const pieces = Object.values(PIECES) as Piece[];
const papers = Object.keys(PAPER) as Paper[];

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
  it.each(pieces.flatMap((p) => papers.map((paper) => [p.id, paper, p] as const)))(
    'fit %s on %s with a margin for crop marks',
    (_, paper, p) => {
      const { w, h } = PAPER[paper];
      expect((w - p.cols * p.w) / 2).toBeGreaterThan(5);
      expect((h - p.rows * p.h) / 2).toBeGreaterThan(5);
    },
  );

  it.each(pieces)('put a crop mark at both ends of every cut ($id)', (p) => {
    const html = sheetsHtml(p, [{ front: 'a' }], 'a4');
    expect(html.match(/class="v"/g)).toHaveLength(2 * (p.cols + 1));
    expect(html.match(/class="h"/g)).toHaveLength(2 * (p.rows + 1));
  });

  it('fills pages in reading order, then starts a new page', () => {
    const p = PIECES.card;
    const pages = sheets(
      sheetsHtml(
        p,
        Array.from({ length: 10 }, (_, i) => ({ front: `f${i}` })),
        'a4',
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
    const [fronts, backs] = sheets(sheetsHtml(p, faces, 'letter', true));
    const width = PAPER.letter.w;
    for (const [i, [, x, y]] of fronts.entries()) {
      const back = backs.find(([src]) => src === `b${i}`)!;
      expect(back[1] + p.w).toBeCloseTo(width - x);
      expect(back[2]).toBe(y);
    }
  });

  it('draws the marks as borders, which print without "Background graphics"', () => {
    expect(sheetsHtml(PIECES.tile, [{ front: 'a' }], 'a4')).not.toMatch(/background:#000/);
  });
});

describe('press sheets', () => {
  const { w, h, bleed: b } = PIECES.tile;
  const pages = pressPages(PIECES.tile, [0, 1, 2, 3, 4], 'a4');

  it('fills each page of the grid and starts a new one when it is full', () => {
    expect(pages.map((p) => p.images.length)).toEqual([4, 1]);
  });

  it('draws each face with its bleed, showing the bleed only where no piece is next to it', () => {
    const [topLeft, , , bottomRight] = pages[0].images;
    const x0 = (PAPER.a4.w - 2 * w) / 2;
    const y0 = (PAPER.a4.h - 2 * h) / 2;
    expect(topLeft.at).toEqual({ x: x0 - b, y: y0 - b, w: w + 2 * b, h: h + 2 * b });
    expect(topLeft.clip).toEqual({ x: x0 - b, y: y0 - b, w: w + b, h: h + b });
    expect(bottomRight.clip).toEqual({ x: x0 + w, y: y0 + h, w: w + b, h: h + b });
    // Alone on its page: bleed all round.
    expect(pages[1].images[0].clip).toEqual(pages[1].images[0].at);
  });

  it.each([PIECES.tile, PIECES.aid])('keeps the crop marks on the paper and clear of the bleed: $id', (piece) => {
    const { w, h, cols, rows, bleed } = piece;
    const x0 = (PAPER.a4.w - cols * w) / 2;
    const y0 = (PAPER.a4.h - rows * h) / 2;
    const [page] = pressPages(piece, [0], 'a4');
    for (const [x1, y1, x2, y2] of page.marks!) {
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(PAPER.a4.w);
        expect(y).toBeLessThanOrEqual(PAPER.a4.h);
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
