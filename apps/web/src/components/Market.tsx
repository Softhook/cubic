import { EXPANSION, rulesOf, type DeckKind, type GameState } from '@quantum/engine';
import type { Legal } from '../game/legal';
import type { Dispatch } from '../game/useGame';
import { CardView } from './Card';

export function Market({ game, dispatch, legal }: { game: GameState; dispatch: Dispatch; legal: Legal }) {
  const picking = legal.can('takeCard');
  const m = game.market;
  const canTake = (deck: DeckKind | 'expansion', index: number) => legal.can('takeCard', (a) => a.deck === deck && a.index === index);
  const canExpand = canTake('expansion', 0);
  const cardRules = rulesOf(game).cards!;
  const peek = cardRules.peek;

  const row = (deck: DeckKind, cards: string[], deckSize: number) => (
    <div className={`market-row market-${deck}`}>
      <div className={`deck deck-${deck}`} title={`${deckSize} cards left in the ${deck} deck`}>
        <div className="deck-stack" />
        <span className="deck-label">{deck === 'skill' ? cardRules.terms.skillDeck : cardRules.terms.tacticDeck}</span>
        <span className="deck-count">{deckSize}</span>
      </div>
      {cards.map((id, index) => (
        <CardView
          key={`${id}#${cards.slice(0, index).filter((x) => x === id).length}`}
          id={id}
          size="sm"
          className="market-card"
          badge={peek && index === cards.length - 1 && cards.length === 3 && deckSize > 0 ? 'Peek' : undefined}
          onClick={canTake(deck, index) ? () => dispatch({ type: 'takeCard', deck, index }) : undefined}
        />
      ))}
    </div>
  );

  return (
    <section className={`market ${picking ? 'picking' : ''}`}>
      {row('skill', m.skillRow, m.skillDeck.length)}
      {row('tactic', m.tacticRow, m.tacticDeck.length)}
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
      {legal.can('refreshMarket') && (
        <button className="btn btn-ghost market-refresh" title="Costs one of this turn's card picks" onClick={() => dispatch({ type: 'refreshMarket' })}>
          Discard all face-up cards and deal new ones
        </button>
      )}
    </section>
  );
}
