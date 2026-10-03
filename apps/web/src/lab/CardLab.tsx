import { useEffect, useMemo, useState } from 'react';
import { CARD, CARD_CATEGORIES, cardBackSvg, cardCategory, cardMotif, cardSvg, deckInfo, type CardDeck, type CardFace } from '@quantum/art';
import { DECKS, cardFontCss, measure, type Deck } from './cards';
import { download, svgToPng, zip } from './export';
import { LabHeader } from './LabHeader';

/**
 * Art Lab, cards page (#lab/cards): every advance card at poker size (63.5 × 88.9 mm) with its
 * deck's back, and exports for print: single cards, a ZIP of the whole set, and print sheets.
 */

type Edition = 'all' | 'community' | 'original';
type Paper = 'a4' | 'letter';

/** One printable thing: a card front, or a deck's back. */
interface Item {
  key: string;
  deck: CardDeck;
  face?: CardFace;
}

const itemsOf = (d: Deck): Item[] => [{ key: `${d.id}:back`, deck: d.id }, ...d.cards.map((c) => ({ key: `${d.id}:${c.id}`, deck: d.id, face: c }))];

const PAPER: Record<Paper, { w: number; h: number; name: string }> = {
  a4: { w: 210, h: 297, name: 'A4' },
  letter: { w: 215.9, h: 279.4, name: 'US Letter' },
};

export function CardLab() {
  const [edition, setEdition] = useState<Edition>('all');
  const [selected, setSelected] = useState('skill:agile');
  const [bleed, setBleed] = useState(true);
  const [paper, setPaper] = useState<Paper>('a4');
  const [copies, setCopies] = useState(true);
  const [backs, setBacks] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [fonts, setFonts] = useState<string | null>(null);

  useEffect(() => {
    void cardFontCss().then(setFonts);
  }, []);

  const decks = DECKS.filter((d) => edition === 'all' || d.edition === edition);
  const all = useMemo(() => DECKS.flatMap(itemsOf), []);
  const item = all.find((i) => i.key === selected) ?? all[0];

  const svgOf = (i: Item, o: { bleed?: boolean; rounded?: boolean } = {}) =>
    i.face ? cardSvg(i.face, { ...o, measure, fontCss: fonts ?? '' }) : cardBackSvg(i.deck, { ...o, fontCss: fonts ?? '' });

  // Thumbnails as blob URLs: cheaper than data URLs for documents carrying their fonts.
  const thumbs = useMemo(() => {
    if (fonts === null) return new Map<string, string>();
    return new Map(all.map((i) => [i.key, URL.createObjectURL(new Blob([svgOf(i, { rounded: true })], { type: 'image/svg+xml' }))]));
  }, [fonts]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const detail = useMemo(() => (fonts === null ? '' : URL.createObjectURL(new Blob([svgOf(item, { bleed })], { type: 'image/svg+xml' }))), [item, bleed, fonts]);
  useEffect(() => () => URL.revokeObjectURL(detail), [detail]);

  const size = (b: boolean) => ({ w: CARD.w + (b ? 2 * CARD.bleed : 0), h: CARD.h + (b ? 2 * CARD.bleed : 0) });
  const fileName = (i: Item) => (i.face ? `${String(i.face.index).padStart(2, '0')}-${i.face.id}` : 'back');

  const run = async (task: () => Promise<void>) => {
    try {
      await task();
    } finally {
      setProgress(null);
    }
  };

  const exportOne = (dpi: number) =>
    run(async () => {
      setProgress('Rendering…');
      const { w, h } = size(bleed);
      download(`${item.deck}-${fileName(item)}${bleed ? '-bleed' : ''}-${dpi}dpi.png`, await svgToPng(svgOf(item, { bleed }), w, h, dpi));
    });

  const exportZip = () =>
    run(async () => {
      const items = decks.flatMap(itemsOf);
      const { w, h } = size(bleed);
      const files: { name: string; blob: Blob }[] = [];
      for (const [k, i] of items.entries()) {
        setProgress(`Rendering ${k + 1}/${items.length}`);
        files.push({ name: `${i.deck}/${fileName(i)}.png`, blob: await svgToPng(svgOf(i, { bleed }), w, h, 300) });
      }
      const readme =
        `Cubic cards, poker size ${CARD.w} × ${CARD.h} mm` +
        (bleed ? `, with ${CARD.bleed} mm bleed on every side (${w} × ${h} mm).` : ' (trim size, no bleed).') +
        `\nPNG at 300 dpi. Copies per card: the ×N mark on the card, or the deck list in the rulebook.\n` +
        `Each folder's back.png is the back for every card in it.\n`;
      files.push({ name: 'README.txt', blob: new Blob([readme], { type: 'text/plain' }) });
      setProgress('Packing…');
      download(`cubic-cards-${edition}${bleed ? '-bleed' : ''}.zip`, await zip(files));
    });

  const printSheets = () =>
    run(async () => {
      const fronts = decks.flatMap((d) => d.cards.flatMap((c) => Array<Item>(copies ? c.copies ?? 1 : 1).fill({ key: `${d.id}:${c.id}`, deck: d.id, face: c })));
      const unique = [...new Map(fronts.map((i) => [i.key, i])).values()];
      if (backs) unique.push(...decks.map((d) => ({ key: `${d.id}:back`, deck: d.id })));
      const images = new Map<string, string>();
      for (const [k, i] of unique.entries()) {
        setProgress(`Rendering ${k + 1}/${unique.length}`);
        images.set(i.key, URL.createObjectURL(await svgToPng(svgOf(i), CARD.w, CARD.h, 300)));
      }
      setProgress('Opening print dialog…');
      await printDocument(sheetsHtml(fronts, images, PAPER[paper], backs), () => images.forEach((u) => URL.revokeObjectURL(u)));
    });

  const info = deckInfo(item.deck);
  const ready = progress === null && fonts !== null;

  return (
    <div className="lab">
      <LabHeader page="cards">
        <div className="segmented small">
          {(['all', 'community', 'original'] as Edition[]).map((e) => (
            <button key={e} className={e === edition ? 'on' : ''} onClick={() => setEdition(e)}>
              {e === 'all' ? 'All' : e === 'community' ? 'Community' : 'Original'}
            </button>
          ))}
        </div>
      </LabHeader>
      <div className="lab-body">
        <div>
          {fonts === null && <p className="lab-note">Loading fonts…</p>}
          {decks.map((d) => (
            <section key={d.id} className="lab-deck">
              <h2>
                {d.name} <span className="muted">· {d.edition === 'community' ? 'Community Edition' : 'Original 2013'} · {d.cards.length} cards
                {d.cards.some((c) => (c.copies ?? 1) > 1) && `, ${d.cards.reduce((s, c) => s + (c.copies ?? 1), 0)} with copies`}</span>
              </h2>
              <div className="lab-grid cards">
                {itemsOf(d).map((i) => (
                  <button key={i.key} className={`lab-thumb ${i.key === item.key ? 'on' : ''}`} onClick={() => setSelected(i.key)}>
                    {thumbs.get(i.key) ? <img src={thumbs.get(i.key)} alt={i.face?.name ?? 'Back'} loading="lazy" /> : <span className="lab-card-ph" />}
                    <span>{i.face ? i.face.name : 'Back'}{i.face?.copies && i.face.copies > 1 ? ` ×${i.face.copies}` : ''}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="lab-detail">
          {detail ? <img className="lab-card" src={detail} alt={item.face?.name ?? 'Back'} /> : <span className="lab-card lab-card-ph" />}
          <p className="lab-note">
            {item.face ? (
              <>
                {info.label} ({info.kind.toLowerCase()}) · {CARD_CATEGORIES[cardCategory(item.face)]?.label} · illustration: {cardMotif(item.face)}
                {item.face.copies && item.face.copies > 1 ? ` · ${item.face.copies} copies` : ''}
              </>
            ) : (
              <>Back of every {info.label} card</>
            )}
          </p>
          <div className="lab-controls">
            <label><input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} /> Bleed</label>
            <button className="btn" disabled={!ready} onClick={() => exportOne(300)}>PNG 300 dpi</button>
            <button className="btn" disabled={!ready} onClick={() => exportOne(600)}>PNG 600 dpi</button>
            <button className="btn btn-ghost" onClick={() => download(`${item.deck}-${fileName(item)}${bleed ? '-bleed' : ''}.svg`, new Blob([svgOf(item, { bleed })], { type: 'image/svg+xml' }))} title="Live SVG filters: renders in browsers only">
              SVG
            </button>
          </div>
          <p className="lab-note">
            Poker size, {CARD.w} × {CARD.h} mm{bleed ? `; with ${CARD.bleed} mm bleed ${size(true).w} × ${size(true).h} mm, as print services want it` : ' (trim)'}.
          </p>

          <h3 className="lab-sub">Whole set{edition !== 'all' && ` (${edition === 'community' ? 'Community' : 'Original'})`}</h3>
          <div className="lab-controls">
            <button className="btn btn-primary" disabled={!ready} onClick={exportZip}>All cards · ZIP</button>
            <span className="lab-note">PNG 300 dpi, one folder per deck with its back{bleed ? ', with bleed' : ''}.</span>
          </div>
          <div className="lab-controls">
            <button className="btn btn-primary" disabled={!ready} onClick={printSheets}>Print sheets · PDF</button>
            <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} aria-label="Paper">
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
            </select>
            <label><input type="checkbox" checked={copies} onChange={(e) => setCopies(e.target.checked)} /> All copies</label>
            <label><input type="checkbox" checked={backs} onChange={(e) => setBacks(e.target.checked)} /> Backs (duplex)</label>
          </div>
          <p className="lab-note">
            9 cards per page with crop marks; choose “Save as PDF” in the print dialog and print at 100 % (no fit to page). Backs follow each page, mirrored for
            long-edge duplex.
          </p>
          {progress && <p className="lab-progress">{progress}</p>}
        </aside>
      </div>
    </div>
  );
}

/**
 * Print sheets: 3 × 3 cards at trim size, butted together so one cut serves two cards, with crop
 * marks in the margin. With backs, each page of fronts is followed by its backs, columns mirrored
 * so they land behind their fronts when printed double-sided on the long edge.
 */
function sheetsHtml(fronts: Item[], images: Map<string, string>, paper: { w: number; h: number }, withBacks: boolean): string {
  const { w, h } = CARD;
  const x0 = (paper.w - 3 * w) / 2;
  const y0 = (paper.h - 3 * h) / 2;
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
  for (let p = 0; p < fronts.length; p += 9) {
    const chunk = fronts.slice(p, p + 9);
    html += page(chunk.map((i, k) => ({ src: images.get(i.key)!, col: k % 3, row: Math.floor(k / 3) })));
    if (withBacks) html += page(chunk.map((i, k) => ({ src: images.get(`${i.deck}:back`)!, col: 2 - (k % 3), row: Math.floor(k / 3) })));
  }
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Cubic cards</title><style>` +
    `@page{size:${paper.w}mm ${paper.h}mm;margin:0}html,body{margin:0}` +
    `.sheet{position:relative;width:${paper.w}mm;height:${paper.h}mm;overflow:hidden;break-after:page}` +
    `.sheet img{position:absolute;width:${w}mm;height:${h}mm}.sheet i{position:absolute;background:#000}` +
    `</style></head><body>${html}</body></html>`
  );
}

/** Prints an HTML document from a hidden frame, once its images have loaded. */
async function printDocument(html: string, cleanup: () => void): Promise<void> {
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
