import { useState } from 'react';
import { EXPANSION, card, cardKind, rulesOf, type DeckKind, type GameState } from '@quantum/engine';
import type { Legal } from '../game/legal';
import type { Dispatch } from '../game/useGame';
import { useShortcut } from '../game/useShortcut';
import { remember, stored } from '../storage';
import { CardView, categoryStyle } from './Card';
import { CardViewer } from './CardViewer';
import { Dialog } from './Dialog';

export function Market({ game, dispatch, legal }: { game: GameState; dispatch: Dispatch; legal: Legal }) {
  const patientPick = legal.can('patientTactic');
  const picking = legal.can('takeCard') || patientPick;
  const m = game.market;
  const canPatientStore = (deck: DeckKind | 'expansion', index: number) => deck === 'tactic' && legal.can('patientTactic', (a) => a.index === index);
  const canTake = (deck: DeckKind | 'expansion', index: number) =>
    canPatientStore(deck, index) || legal.can('takeCard', (a) => a.deck === deck && a.index === index);
  const canStore = (deck: DeckKind | 'expansion', index: number) => legal.can('takeCard', (a) => a.deck === deck && a.index === index && !!a.store);
  /** Takes the card (Patient: stores it, or asks whether to), or else shows it. */
  const clickCard = (deck: DeckKind, index: number, id: string) => {
    if (canPatientStore(deck, index)) dispatch({ type: 'patientTactic', index });
    else if (canStore(deck, index)) setPatientChoice({ id, index });
    else if (canTake(deck, index)) dispatch({ type: 'takeCard', deck, index });
    else setViewingCard(id);
  };
  const canExpand = canTake('expansion', 0);
  const cardRules = rulesOf(game).cards!;
  const peek = cardRules.peek;
  const [viewing, setViewing] = useState<DeckKind | null>(null);
  const [viewingCard, setViewingCard] = useState<string | null>(null);
  const [patientChoice, setPatientChoice] = useState<{ id: string; index: number } | null>(null);
  const { open, toggle } = useCollapse(picking);
  const decks: Record<DeckKind, { name: string; cards: string[] }> = {
    skill: { name: cardRules.terms.skillDeck, cards: m.skillDeck },
    tactic: { name: cardRules.terms.tacticDeck, cards: m.tacticDeck },
  };
  const deckTitle = (deck: DeckKind) => `${cardsLeft(decks[deck].cards.length)} in the ${decks[deck].name} deck — click to view them`;

  const row = (deck: DeckKind, cards: string[]) => (
    <div className={`market-row market-${deck}`}>
      <button type="button" className={`deck deck-${deck}`} title={deckTitle(deck)} onClick={() => setViewing(deck)}>
        <div className="deck-stack" />
        <span className="deck-label">{decks[deck].name}</span>
        <span className="deck-count">{decks[deck].cards.length}</span>
      </button>
      {cards.map((id, index) => (
        <CardView
          key={`${id}#${cards.slice(0, index).filter((x) => x === id).length}`}
          id={id}
          size="sm"
          className={`market-card ${canTake(deck, index) ? 'takeable' : ''}`}
          badge={peek && index === cards.length - 1 && cards.length === 3 && decks[deck].cards.length > 0 ? 'Peek' : undefined}
          onClick={() => clickCard(deck, index, id)}
        />
      ))}
    </div>
  );

  const viewer = viewing && (
    <CardViewer
      title={`${decks[viewing].name} deck`}
      subtitle={decks[viewing].cards.length ? `${cardsLeft(decks[viewing].cards.length)}, shown alphabetically (draw order stays hidden).` : 'The deck is empty.'}
      cards={decks[viewing].cards}
      onClose={() => setViewing(null)}
    />
  );

  const cardViewer = viewingCard && (
    <CardViewer title={card(viewingCard).name} subtitle={card(viewingCard).subtitle} cards={[viewingCard]} single onClose={() => setViewingCard(null)} />
  );

  const patientDialog = patientChoice && (
    <Dialog
      title="Patient"
      subtitle={`Do you want to play ${card(patientChoice.id).name} immediately, or store it to play at the end of a turn?`}
      onClose={() => setPatientChoice(null)}
    >
      <div className="card-choice">
        <CardView id={patientChoice.id} size="md" />
      </div>
      <div className="modal-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            dispatch({ type: 'takeCard', deck: 'tactic', index: patientChoice.index });
            setPatientChoice(null);
          }}
        >
          Play immediately
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            dispatch({ type: 'takeCard', deck: 'tactic', index: patientChoice.index, store: true });
            setPatientChoice(null);
          }}
        >
          Store tactic
        </button>
      </div>
    </Dialog>
  );

  const chips = (deck: DeckKind, cards: string[]) => (
    <div className={`market-strip-group market-${deck}`}>
      <button type="button" className="market-strip-deck" title={deckTitle(deck)} onClick={() => setViewing(deck)}>
        {decks[deck].name}
      </button>
      {cards.map((id, index) => {
        const def = card(id);
        const kind = cardKind(id);
        return (
          <button
            type="button"
            key={`${id}#${index}`}
            className={`market-chip market-chip-${kind} ${canTake(deck, index) ? 'takeable' : ''}`}
            style={categoryStyle(def.category, kind === 'skill')}
            title={`${def.name} — ${def.text}`}
            onClick={() => setViewingCard(id)}
          >
            {def.name}
          </button>
        );
      })}
    </div>
  );

  const toggleButton = (
    <button
      type="button"
      className="market-toggle"
      aria-expanded={open}
      aria-controls="market-cards"
      title={`${open ? 'Hide' : 'Show'} the card market (C)`}
      onClick={toggle}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 15 6-6 6 6" />
      </svg>
      <span>Cards</span>
    </button>
  );

  // Open: the face-up rows as cards, ready to take.
  const rows = (
    <>
      {row('skill', m.skillRow)}
      {row('tactic', m.tacticRow)}
      {cardRules.expansionPile && (
        <div className="market-row market-expansion">
          <CardView
            id={EXPANSION.id}
            size="sm"
            badge={`×${m.expansions}`}
            onClick={canExpand ? () => dispatch({ type: 'takeCard', deck: 'expansion', index: 0 }) : () => setViewingCard(EXPANSION.id)}
            className={`market-card ${m.expansions ? '' : 'empty'} ${canExpand ? 'takeable' : ''}`}
          />
        </div>
      )}
      {patientPick && (
        <button className="btn btn-ghost market-refresh" title="Patient: you may take and store a face-up tactic" onClick={() => dispatch({ type: 'patientTactic' })}>
          Don't store a tactic
        </button>
      )}
      {legal.can('profiteer') && (
        <button className="btn btn-ghost market-refresh" title="Profiteering: a card earned by a Conquer action" onClick={() => dispatch({ type: 'profiteer' })}>
          Take 1 missile instead of a card
        </button>
      )}
      {legal.can('refreshMarket') && (
        <button className="btn btn-ghost market-refresh" title="Costs one of this turn's card picks" onClick={() => dispatch({ type: 'refreshMarket' })}>
          Discard all face-up cards and deal new ones
        </button>
      )}
    </>
  );

  // Collapsed: one slim strip of card-name chips, so the board gets the space back. A chip shows its card.
  const strip = (
    <>
      {chips('skill', m.skillRow)}
      {chips('tactic', m.tacticRow)}
      {cardRules.expansionPile && (
        <div className="market-strip-group">
          <button type="button" className="market-chip market-chip-expansion" title={`${m.expansions} Expansion cards left`} onClick={() => setViewingCard(EXPANSION.id)}>
            {EXPANSION.name} ×{m.expansions}
          </button>
        </div>
      )}
    </>
  );

  return (
    <section id="market-cards" className={`market ${open ? '' : 'collapsed'} ${picking ? 'picking' : ''}`}>
      {toggleButton}
      {open ? rows : strip}
      {viewer}
      {cardViewer}
      {patientDialog}
    </section>
  );
}

const cardsLeft = (n: number) => `${n} card${n === 1 ? '' : 's'} left`;

const STORAGE_KEY = 'quantum.marketCollapsed';

/**
 * The market's open/collapsed state. The player's choice is remembered across games, but a collapsed
 * market opens by itself while they have a card to pick (and can be collapsed again for that pick).
 * C toggles it.
 */
function useCollapse(picking: boolean) {
  const [collapsed, setCollapsed] = useState(() => stored(STORAGE_KEY) === '1');
  // Follows `picking` during render (not in an effect), so the market never flashes collapsed first.
  const [autoOpen, setAutoOpen] = useState(picking);
  const [wasPicking, setWasPicking] = useState(picking);
  if (picking !== wasPicking) {
    setWasPicking(picking);
    setAutoOpen(picking);
  }
  const open = !collapsed || autoOpen;

  const toggle = () => {
    const next = open;
    setAutoOpen(false);
    setCollapsed(next);
    remember(STORAGE_KEY, next ? '1' : '0');
  };

  useShortcut((e) => !(e.metaKey || e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'c', toggle);

  return { open, toggle };
}
