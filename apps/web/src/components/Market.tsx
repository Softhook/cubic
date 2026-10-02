import { EXPANSION, reserve, type Action, type DeckKind, type GameState } from '@quantum/engine';
import { CardView } from './Card';

export function Market({ game, dispatch, human }: { game: GameState; dispatch: (a: Action) => boolean; human: boolean }) {
  const head = game.pending[0];
  const picking = human && head?.kind === 'takeCard';
  const m = game.market;
  const canExpand = picking && m.expansions > 0 && reserve(game, head.player).length > 0;
  const original = game.mode === 'original';
  const peek = game.mode === 'community';

  const row = (deck: DeckKind, cards: string[], deckSize: number) => (
    <div className={`market-row market-${deck}`}>
      <div className={`deck deck-${deck}`} title={`${deckSize} cards left in the ${deck} deck`}>
        <div className="deck-stack" />
        <span className="deck-label">{deck === 'skill' ? (original ? 'Command' : 'Skills') : original ? 'Gambit' : 'Tactics'}</span>
        <span className="deck-count">{deckSize}</span>
      </div>
      {cards.map((id, index) => (
        <CardView
          key={`${id}#${cards.slice(0, index).filter((x) => x === id).length}`}
          id={id}
          size="sm"
          className="market-card"
          badge={peek && index === cards.length - 1 && cards.length === 3 && deckSize > 0 ? 'Peek' : undefined}
          onClick={picking ? () => dispatch({ type: 'takeCard', deck, index }) : undefined}
        />
      ))}
    </div>
  );

  return (
    <section className={`market ${picking ? 'picking' : ''}`}>
      {row('skill', m.skillRow, m.skillDeck.length)}
      {row('tactic', m.tacticRow, m.tacticDeck.length)}
      {!original && (
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
    </section>
  );
}
