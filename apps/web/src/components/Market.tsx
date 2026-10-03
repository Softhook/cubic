import { useState } from 'react';
import { EXPANSION, rulesOf, type DeckKind, type GameState } from '@quantum/engine';
import type { Legal } from '../game/legal';
import type { Dispatch } from '../game/useGame';
import { CardView } from './Card';
import { CardViewer } from './CardViewer';

export function Market({ game, dispatch, legal }: { game: GameState; dispatch: Dispatch; legal: Legal }) {
  const picking = legal.can('takeCard');
  const m = game.market;
  const canTake = (deck: DeckKind | 'expansion', index: number) => legal.can('takeCard', (a) => a.deck === deck && a.index === index);
  const canExpand = canTake('expansion', 0);
  const cardRules = rulesOf(game).cards!;
  const peek = cardRules.peek;
  const [viewing, setViewing] = useState<DeckKind | null>(null);
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

  return (
    <section className={`market ${picking ? 'picking' : ''}`}>
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
      {viewing && (
        <CardViewer
          title={`${decks[viewing].name} deck`}
          subtitle={decks[viewing].cards.length ? `${cardsLeft(decks[viewing].cards.length)}, shown alphabetically (draw order stays hidden).` : 'The deck is empty.'}
          cards={decks[viewing].cards}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

const cardsLeft = (n: number) => `${n} card${n === 1 ? '' : 's'} left`;
