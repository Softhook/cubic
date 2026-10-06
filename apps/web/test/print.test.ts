/** Print files: every piece fits its sheets with room for crop marks, backs land behind their fronts, names follow one pattern. */
import { describe, expect, it } from 'vitest';
import { PIECES, fileName, pieceSize, setName, type Piece } from '../src/print/pieces';
import { PAPER, sheetsHtml, type Paper } from '../src/print/sheets';

const pieces = Object.values(PIECES) as Piece[];
const papers = Object.keys(PAPER) as Paper[];

/** Each sheet's images as [src, left, top] in mm. */
function sheets(html: string) {
  return html
    .split('<section class="sheet">')
    .slice(1)
    .map((s) => [...s.matchAll(/<img src="([^"]*)" style="left:([\d.]+)mm;top:([\d.]+)mm">/g)].map((m) => [m[1], Number(m[2]), Number(m[3])] as const));
}

describe('print sheets', () => {
  it.each(pieces.flatMap((p) => papers.map((paper) => [p.id, paper, p] as const)))('fit %s on %s with a margin for crop marks', (_, paper, p) => {
    const { w, h } = PAPER[paper];
    expect((w - p.cols * p.w) / 2).toBeGreaterThan(5);
    expect((h - p.rows * p.h) / 2).toBeGreaterThan(5);
  });

  it.each(pieces)('put a crop mark at both ends of every cut ($id)', (p) => {
    const html = sheetsHtml(p, [{ front: 'a' }], 'a4');
    expect(html.match(/class="v"/g)).toHaveLength(2 * (p.cols + 1));
    expect(html.match(/class="h"/g)).toHaveLength(2 * (p.rows + 1));
  });

  it('fills pages in reading order, then starts a new page', () => {
    const p = PIECES.card;
    const pages = sheets(sheetsHtml(p, Array.from({ length: 10 }, (_, i) => ({ front: `f${i}` })), 'a4'));
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

describe('print file names', () => {
  it('follow cubic-<piece>-<name>[-bleed][-<dpi>dpi]', () => {
    const card = { name: 'skill/07-agile', svg: () => '' };
    expect(fileName(PIECES.card, card, { bleed: true, dpi: 300, ext: 'png' })).toBe('cubic-card-skill-07-agile-bleed-300dpi.png');
    expect(fileName(PIECES.tile, { name: 'p7-01', svg: () => '' }, { bleed: false, ext: 'svg' })).toBe('cubic-tile-p7-01.svg');
    expect(setName(PIECES.card, { bleed: true, part: 'community' })).toBe('cubic-cards-community-bleed.zip');
    expect(setName(PIECES.tile, { bleed: false })).toBe('cubic-tiles.zip');
  });

  it('size pieces with their bleed on every side', () => {
    expect(pieceSize(PIECES.card, true)).toEqual({ w: 69.5, h: 94.9 });
    expect(pieceSize(PIECES.tile, false)).toEqual({ w: 96, h: 96 });
  });
});
