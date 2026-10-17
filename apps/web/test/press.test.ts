/** Files for a press: the CMYK conversion follows its table, and the CMYK PDF is well formed with the boxes and intent PDF/X wants. */
import { describe, expect, it } from 'vitest';
import { CMYK_TABLE } from '../src/print/cmykTable';
import { cmykPdf, deflate } from '../src/print/pdf';
import { tagPng, toCmyk } from '../src/print/press';
import { crc32, zip } from '../src/print/zip';

const table = Uint8Array.from(atob(CMYK_TABLE.data), (c) => c.charCodeAt(0));
const N = CMYK_TABLE.grid;
const px = (...rgb: number[]) => toCmyk(Uint8ClampedArray.from([...rgb, 255]));

describe('CMYK conversion', () => {
  it('gives the table exactly at its grid points', () => {
    for (const [i, j, k] of [
      [0, 0, 0],
      [N - 1, N - 1, N - 1],
      [3, 9, 14],
      [17, 0, 8],
    ]) {
      const v = (g: number) => Math.round((g * 255) / (N - 1));
      const at = ((i * N + j) * N + k) * 4;
      expect([...px(v(i), v(j), v(k))]).toEqual([...table.subarray(at, at + 4)]);
    }
  });

  it('prints white as no ink and black as a rich black within the press limit', () => {
    expect([...px(255, 255, 255)]).toEqual([0, 0, 0, 0]);
    const black = [...px(0, 0, 0)];
    const total = black.reduce((a, b) => a + b, 0) / 2.55;
    expect(black[3]).toBeGreaterThan(200);
    expect(total).toBeGreaterThan(280);
    expect(total).toBeLessThanOrEqual(340);
  });

  it('keeps the darkest tones of the art apart (black point compensation)', () => {
    const ink = (v: number) => px(v, v, v).reduce((a, b) => a + b, 0);
    expect(ink(0)).toBeGreaterThan(ink(8));
    expect(ink(8)).toBeGreaterThan(ink(16));
  });
});

describe('CMYK PDF', () => {
  const image = async (w: number, h: number) => ({ width: w, height: h, data: await deflate(new Uint8Array(w * h * 4).fill(100)) });

  it('has an xref pointing at every object, page boxes and the output intent', async () => {
    const pdf = cmykPdf({
      title: 'Test (cards)',
      w: 69.5,
      h: 94.9,
      bleed: 3,
      condition: 'FOGRA39',
      conditionInfo: 'Coated FOGRA39',
      profile: await deflate(new Uint8Array(128).fill(7)),
      images: [await image(4, 6), await image(4, 6)],
      pages: [0, 1, 0, 1],
    });
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.3')).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const entries = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5 + 2 + 2 * 4);
    entries.forEach((offset, i) => expect(text.slice(offset, offset + 10)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
    expect(text).toContain('/Count 4');
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(text).toContain('/MediaBox [0 0 197.008 269.008]');
    expect(text).toContain('/TrimBox [8.504 8.504 188.504 260.504]');
    expect(text).toContain('/OutputConditionIdentifier (FOGRA39)');
    expect(text).toContain('/DestOutputProfile 5 0 R');
    expect(text).toMatch(/5 0 obj\n<< \/N 4 \/Filter \/FlateDecode/);
    expect(text).toContain('/GTS_PDFXVersion (PDF/X-1:2001)');
    expect(text).toContain('/Title (Test \\(cards\\))');
    expect(text).not.toMatch(/DeviceRGB|\/Font|\/SMask/);
  });
});

describe('PNG tagging', () => {
  it('adds an sRGB profile and the resolution before the image data', async () => {
    // A 1 × 1 PNG: signature, IHDR, IDAT, IEND.
    const png = Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
      (c) => c.charCodeAt(0),
    );
    const out = new Uint8Array(await (await tagPng(new Blob([png]), 300)).arrayBuffer());
    const types: string[] = [];
    for (let at = 8; at < out.length;) {
      const len = new DataView(out.buffer).getUint32(at);
      types.push(new TextDecoder().decode(out.subarray(at + 4, at + 8)));
      if (types.at(-1) === 'pHYs') expect(new DataView(out.buffer).getUint32(at + 8)).toBe(11811);
      at += 12 + len;
    }
    expect(types).toEqual(['IHDR', 'iCCP', 'pHYs', 'IDAT', 'IEND']);
  });
});

describe('ZIP', () => {
  it('stores each file whole, with its name, size and checksum, readable by unzip tools', async () => {
    const files = [
      { name: 'skill/01-agile.pdf', blob: new Blob([new Uint8Array(3000).fill(9)]) },
      { name: 'order.csv', blob: new Blob(['file,quantity\n']) },
    ];
    const bytes = new Uint8Array(await (await zip(files)).arrayBuffer());
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    let at = 0;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer());
      expect(view.getUint32(at, true)).toBe(0x04034b50);
      expect(view.getUint32(at + 14, true)).toBe(crc32(data));
      expect(view.getUint32(at + 18, true)).toBe(data.length);
      const nameLength = view.getUint16(at + 26, true);
      expect(new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength))).toBe(f.name);
      expect(bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + data.length)).toEqual(data);
      at += 30 + nameLength + data.length;
    }
    expect(view.getUint32(at, true)).toBe(0x02014b50);
  });
});
