import { useEffect, useMemo, useState } from 'react';
import { CARD_CATEGORIES, cardBackSvg, cardIllustration, cardSvg, deckInfo, type CardDeck, type CardFace } from '@quantum/art';
import { DECKS, LINEAGE, cardFontCss, lineageNote, measure, type Deck, type Redesign } from './cards';
import { PIECES, type Printable } from '../print/pieces';
import { PrintPanel } from '../print/PrintPanel';
import { LabHeader } from './LabHeader';

/**
 * Art Lab, cards page (#lab/cards): every advance card at poker size (63.5 × 88.9 mm) with its
 * deck's back, and exports for print: single cards, a ZIP of the whole set, and print sheets.
 * Cards show by lineage (Community redesigns beside the 2013 card they redesign, then each
 * edition's own designs); the print set is chosen by edition.
 */

type Edition = Deck['edition'];
/** By lineage, or one edition whole, deck by deck. */
type View = 'all' | 'redesigns' | 'community-only' | 'classic-only' | Edition;
type Sort = 'deck' | 'name' | 'category';

const EDITION_LABEL: Record<Edition, string> = { community: 'Community', original: 'Classic' };
const VIEWS: [View, string][] = [['all', 'All'], ['redesigns', 'Redesigns'], ['community-only', 'Community originals'], ['classic-only', 'Classic only']];
const EDITION_VIEWS = Object.entries(EDITION_LABEL) as [Edition, string][];
const EDITIONS: ['all' | Edition, string][] = [['all', 'All'], ...EDITION_VIEWS];
const SORTS: [Sort, string][] = [['deck', 'Deck order'], ['name', 'Name'], ['category', 'Category']];

/** One printable thing: a card front, or a deck's back. */
interface Item {
  key: string;
  deck: CardDeck;
  face?: CardFace;
}

const itemOf = (c: CardFace): Item => ({ key: `${c.deck}:${c.id}`, deck: c.deck, face: c });
const backOf = (d: CardDeck): Item => ({ key: `${d}:back`, deck: d });
const itemsOf = (d: Deck): Item[] => [backOf(d.id), ...d.cards.map(itemOf)];

/** Cards split by deck, in deck order, for one heading each. */
const byDeck = (cards: CardFace[]) => DECKS.map((d) => ({ deck: d, cards: cards.filter((c) => c.deck === d.id) })).filter((g) => g.cards.length > 0);

const CATEGORY_ORDER = Object.keys(CARD_CATEGORIES);
const categoryRank = (c: CardFace) => {
  const i = CATEGORY_ORDER.indexOf(c.category);
  return i < 0 ? Infinity : i;
};
const byName = (a: CardFace, b: CardFace) => a.name.localeCompare(b.name);
const SORTERS: Record<Sort, (a: CardFace, b: CardFace) => number> = {
  deck: (a, b) => (a.index ?? 0) - (b.index ?? 0),
  name: byName,
  category: (a, b) => categoryRank(a) - categoryRank(b) || byName(a, b),
};

const copiesOf = (cards: CardFace[]) => cards.reduce((s, c) => s + (c.copies ?? 1), 0);
const countNote = (cards: CardFace[]) => {
  const n = copiesOf(cards);
  return `${cards.length} cards${n > cards.length ? `, ${n} with copies` : ''}`;
};

/** A segmented control over `[value, label]` options. */
function Segmented<T extends string>({ options, value, onPick, label }: { options: [T, string][]; value: T; onPick: (v: T) => void; label?: string }) {
  return (
    <div className="segmented small" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>{l}</button>
      ))}
    </div>
  );
}

export function CardLab() {
  const [view, setView] = useState<View>('all');
  const [edition, setEdition] = useState<'all' | Edition>('all');
  const [sort, setSort] = useState<Sort>('deck');
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
  const sheets = (copies: boolean) =>
    decks.flatMap((d) =>
      d.cards.flatMap((c) => Array<{ front: Printable; back: Printable }>(copies ? c.copies ?? 1 : 1).fill({ front: printable(itemOf(c)), back: printable(backOf(d.id)) })),
    );

  const info = deckInfo(item.deck);
  const lineage = item.face && lineageNote(item.face);
  const show = (v: View) => view === 'all' || view === v;
  const sorted = (cards: CardFace[]) => [...cards].sort(SORTERS[sort]);
  const shownEdition = view === 'community' || view === 'original' ? view : null;
  // Showing one edition whole makes it the print set too.
  const pickView = (v: View) => {
    setView(v);
    if (v === 'community' || v === 'original') setEdition(v);
  };

  const thumb = (i: Item) => (
    <button key={i.key} className={`lab-thumb ${i.key === item.key ? 'on' : ''}`} onClick={() => setSelected(i.key)}>
      {thumbs.get(i.key) ? <img src={thumbs.get(i.key)} alt={i.face?.name ?? 'Back'} loading="lazy" /> : <span className="lab-card-ph" />}
      <span>{i.face ? i.face.name : `${deckInfo(i.deck).label} back`}{i.face?.copies && i.face.copies > 1 ? ` ×${i.face.copies}` : ''}</span>
    </button>
  );
  const pairs = (title: string, about: string, list: Redesign[], rules = false) => (
    <section className="lab-deck">
      <h2>{title} <span className="muted">· {list.length} pairs · {about}</span></h2>
      <div className="lab-grid pairs">
        {[...list].sort((a, b) => SORTERS[sort](a.community, b.community)).map((r) => (
          <div key={r.community.id} className="lab-pair">
            {thumb(itemOf(r.classic))}
            <span className="lab-pair-arrow" aria-hidden>→</span>
            {thumb(itemOf(r.community))}
            {rules && <span className={`lab-pair-tag ${r.sameRules ? '' : 'changed'}`}>{r.sameRules ? 'Same rules' : 'Rules changed'}</span>}
          </div>
        ))}
      </div>
    </section>
  );
  const singles = (title: string, cards: CardFace[]) =>
    byDeck(cards).map(({ deck, cards }) => (
      <section key={`${title}:${deck.id}`} className="lab-deck">
        <h2>{title} <span className="muted">· {deck.name} · {countNote(cards)}</span></h2>
        <div className="lab-grid cards">{sorted(cards).map((c) => thumb(itemOf(c)))}</div>
      </section>
    ));

  return (
    <div className="lab">
      <LabHeader page="cards">
        <Segmented options={VIEWS} value={view} onPick={pickView} label="Cards by lineage" />
        <Segmented options={EDITION_VIEWS} value={view} onPick={pickView} label="Cards by edition" />
        <span className="lab-sort">
          Sort
          <Segmented options={SORTS} value={sort} onPick={setSort} />
        </span>
      </LabHeader>
      <div className="lab-body">
        <div>
          {fonts === null && <p className="lab-note">Loading fonts…</p>}
          {show('redesigns') && (
            <>
              {pairs('Reworded', 'Classic → Community, same name, same rules', LINEAGE.reworded)}
              {pairs('Reworked', 'Classic → Community, same name, rules changed', LINEAGE.reworked)}
              {pairs('Renamed', 'Classic → Community, same idea under a new name', LINEAGE.renamed, true)}
            </>
          )}
          {show('community-only') && singles('Community originals', LINEAGE.communityOnly)}
          {show('classic-only') && singles('Classic only', LINEAGE.classicOnly)}
          {shownEdition && singles(shownEdition === 'community' ? 'Community Edition' : 'Classic', DECKS.filter((d) => d.edition === shownEdition).flatMap((d) => d.cards))}
          {(view === 'all' || shownEdition) && (
            <section className="lab-deck">
              <h2>Backs <span className="muted">· one per deck</span></h2>
              <div className="lab-grid cards">{DECKS.filter((d) => !shownEdition || d.edition === shownEdition).map((d) => thumb(backOf(d.id)))}</div>
            </section>
          )}
        </div>
        <aside className="lab-detail">
          {detail ? <img className="lab-card" src={detail} alt={item.face?.name ?? 'Back'} /> : <span className="lab-card lab-card-ph" />}
          <p className="lab-note">
            {item.face ? (
              <>
                {info.label} ({info.kind.toLowerCase()}) · {CARD_CATEGORIES[item.face.category]?.label} · {cardIllustration(item.face)}
                {item.face.copies && item.face.copies > 1 ? ` · ${item.face.copies} copies` : ''}
                {lineage && <><br />{lineage}</>}
              </>
            ) : (
              <>Back of every {info.label} card</>
            )}
          </p>
          <div className="lab-controls">
            <span className="lab-note">Print set</span>
            <Segmented options={EDITIONS} value={edition} onPick={setEdition} />
          </div>
          <PrintPanel
            piece={PIECES.card}
            item={printable(item)}
            bleed={bleed}
            onBleed={setBleed}
            set={decks.flatMap(itemsOf).map(printable)}
            part={edition === 'all' ? undefined : EDITION_LABEL[edition]}
            notes={`Copies per card: the ×N mark on the card.\nEach folder's back.png is the back for every card in it.\n`}
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
