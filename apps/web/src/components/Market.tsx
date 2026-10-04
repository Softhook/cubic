import { useEffect, useState } from 'react';
import { EXPANSION, card, cardKind, rulesOf, type DeckKind, type GameState } from '@quantum/engine';
import type { Legal } from '../game/legal';
import type { Dispatch } from '../game/useGame';
import { CardView, categoryStyle } from './Card';
import { CardViewer } from './CardViewer';

export function Market({ game, dispatch, legal }: { game: GameState; dispatch: Dispatch; legal: Legal }) {
  const picking = legal.can('takeCard');
  const m = game.market;
  const canTake = (deck: DeckKind | 'expansion', index: number) => legal.can('takeCard', (a) => a.deck === deck && a.index === index);
  const canExpand = canTake('expansion', 0);
  const cardRules = rulesOf(game).cards!;
  const peek = cardRules.peek;
  const [viewing, setViewing] = useState<DeckKind | null>(null);
  const { open, toggle } = useCollapse(picking);
  const decks: Record<DeckKind, { name: string; cards: string[] }> = {
    skill: { name: cardRules.terms.skillDeck, cards: m.skillDeck },
    tactic: { name: cardRules.terms.tacticDeck, cards: m.tacticDeck },
  };

  const row = (deck: DeckKind, cards: string[]) => (
    <div className={`market-row market-${deck}`}>
      <button type="button" className={`deck deck-${deck}`} title={`${cardsLeft(decks[deck].cards.length)} in the ${decks[deck].name} deck — click to view them`} onClick={() => setViewing(deck)}>
        <div className="deck-stack" />
        <span className="deck-label">{decks[deck].name}</span>
        <span className="deck-count">{decks[deck].cards.length}</span>
      </button>
      {cards.map((id, index) => (
        <CardView
          key={`${id}#${cards.slice(0, index).filter((x) => x === id).length}`}
          id={id}
          size="sm"
          className="market-card"
          badge={peek && index === cards.length - 1 && cards.length === 3 && decks[deck].cards.length > 0 ? 'Peek' : undefined}
          onClick={canTake(deck, index) ? () => dispatch({ type: 'takeCard', deck, index }) : undefined}
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

  // Collapsed: one slim strip of card-name chips, so the board gets the space back.
  const chips = (deck: DeckKind, cards: string[]) => (
    <div className={`market-strip-group market-${deck}`}>
      <button type="button" className="market-strip-deck" title={`${cardsLeft(decks[deck].cards.length)} in the ${decks[deck].name} deck — click to view them`} onClick={() => setViewing(deck)}>
        {decks[deck].name} <b>{decks[deck].cards.length}</b>
      </button>
      {cards.map((id, index) => (
        <button
          type="button"
          key={`${id}#${index}`}
          className={`market-chip market-chip-${cardKind(id)} ${canTake(deck, index) ? 'takeable' : ''}`}
          style={categoryStyle(card(id).category, cardKind(id) === 'skill')}
          title={`${card(id).name} — ${card(id).text}`}
          onClick={toggle}
        >
          {card(id).name}
        </button>
      ))}
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

  if (!open) {
    return (
      <section id="market-cards" className={`market collapsed ${picking ? 'picking' : ''}`}>
        {toggleButton}
        {chips('skill', m.skillRow)}
        {chips('tactic', m.tacticRow)}
        {cardRules.expansionPile && (
          <div className="market-strip-group">
            <button type="button" className="market-chip market-chip-expansion" title={`${m.expansions} Expansion cards left`} onClick={toggle}>
              {EXPANSION.name} ×{m.expansions}
            </button>
          </div>
        )}
        {viewer}
      </section>
    );
  }

  return (
    <section id="market-cards" className={`market ${picking ? 'picking' : ''}`}>
      {toggleButton}
      {row('skill', m.skillRow)}
      {row('tactic', m.tacticRow)}
      {cardRules.expansionPile && (
      <div className="market-row market-expansion">
        <CardView
          id={EXPANSION.id}
          size="sm"
          badge={`×${m.expansions}`}
          disabled={!canExpand}
          onClick={canExpand ? () => dispatch({ type: 'takeCard', deck: 'expansion', index: 0 }) : undefined}
          className={m.expansions ? 'market-card' : 'market-card empty'}
        />
      </div>
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
      {viewer}
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
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [autoOpen, setAutoOpen] = useState(false);
  useEffect(() => setAutoOpen(picking), [picking]);
  const open = !collapsed || autoOpen;

  const toggle = () => {
    const next = open;
    setAutoOpen(false);
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'c') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return { open, toggle };
}
