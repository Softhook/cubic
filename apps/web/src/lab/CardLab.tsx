import { useEffect, useMemo, useState } from 'react';
import { CARD_CATEGORIES, cardBackSvg, cardIllustration, cardSvg, deckInfo, type CardDeck, type CardFace } from '@quantum/art';
import { DECKS, cardFontCss, measure, type Deck } from './cards';
import { PIECES, type Printable } from '../print/pieces';
import { PrintPanel } from '../print/PrintPanel';
import { LabHeader } from './LabHeader';

/**
 * Art Lab, cards page (#lab/cards): every advance card at poker size (63.5 × 88.9 mm) with its
 * deck's back, and exports for print: single cards, a ZIP of the whole set, and print sheets.
 */

type Edition = 'all' | 'community' | 'original';

/** One printable thing: a card front, or a deck's back. */
interface Item {
  key: string;
  deck: CardDeck;
  face?: CardFace;
}

const itemsOf = (d: Deck): Item[] => [{ key: `${d.id}:back`, deck: d.id }, ...d.cards.map((c) => ({ key: `${d.id}:${c.id}`, deck: d.id, face: c }))];

export function CardLab() {
  const [edition, setEdition] = useState<Edition>('all');
  const [selected, setSelected] = useState('skill:agile');
  const [bleed, setBleed] = useState(true);
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

  const fileName = (i: Item) => (i.face ? `${String(i.face.index).padStart(2, '0')}-${i.face.id}` : 'back');
  const printable = (i: Item): Printable => ({ name: `${i.deck}/${fileName(i)}`, svg: (b) => svgOf(i, { bleed: b }) });
  const backOf = (d: CardDeck) => printable({ key: `${d}:back`, deck: d });
  const sheets = (copies: boolean) =>
    decks.flatMap((d) =>
      d.cards.flatMap((c) => Array<{ front: Printable; back: Printable }>(copies ? c.copies ?? 1 : 1).fill({ front: printable({ key: `${d.id}:${c.id}`, deck: d.id, face: c }), back: backOf(d.id) })),
    );

  const info = deckInfo(item.deck);

  return (
    <div className="lab">
      <LabHeader page="cards">
        <div className="segmented small">
          {(['all', 'community', 'original'] as Edition[]).map((e) => (
            <button key={e} className={e === edition ? 'on' : ''} onClick={() => setEdition(e)}>
              {e === 'all' ? 'All' : e === 'community' ? 'Community' : 'Classic'}
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
                {d.name} <span className="muted">· {d.edition === 'community' ? 'Community Edition' : 'Classic'} · {d.cards.length} cards
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
                {info.label} ({info.kind.toLowerCase()}) · {CARD_CATEGORIES[item.face.category]?.label} · {cardIllustration(item.face)}
                {item.face.copies && item.face.copies > 1 ? ` · ${item.face.copies} copies` : ''}
              </>
            ) : (
              <>Back of every {info.label} card</>
            )}
          </p>
          <PrintPanel
            piece={PIECES.card}
            item={printable(item)}
            bleed={bleed}
            onBleed={setBleed}
            set={decks.flatMap(itemsOf).map(printable)}
            part={edition === 'all' ? undefined : edition === 'community' ? 'Community' : 'Classic'}
            notes={`Copies per card: the ×N mark on the card, or the deck list in the rulebook.\nEach folder's back.png is the back for every card in it.\n`}
            sheets={sheets}
            copies
            backs
            ready={fonts !== null}
          />
        </aside>
      </div>
    </div>
  );
}
