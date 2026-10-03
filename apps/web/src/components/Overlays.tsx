import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { SHIP_NAMES, die, rulesOf, scrapyard, type GameState } from '@quantum/engine';
import type { Dispatch, Toast } from '../game/useGame';
import { CardView } from './Card';
import { Die3D } from './Die3D';

/** Modal decisions for human players. Board-based decisions are handled by highlights instead. */
export function DecisionOverlay({ game, dispatch, human }: { game: GameState; dispatch: Dispatch; human: boolean }) {
  const head = game.pending[0];
  if (!head || !human) return null;
  switch (head.kind) {
    case 'setupRoll':
      return <SetupRoll game={game} dispatch={dispatch} player={head.player} rerolled={head.rerolled} />;
    case 'skillDraft':
      return (
        <Modal title="Choose your starting skill" subtitle={`${game.players[head.player].name}, keep one. The other returns to the bottom of the deck.`} pc={game.players[head.player].color}>
          <div className="card-choice">
            {head.options.map((id) => (
              <CardView key={id} id={id} size="lg" onClick={() => dispatch({ type: 'draftSkill', skill: id })} />
            ))}
          </div>
        </Modal>
      );
    case 'peek':
      return (
        <Modal title="Peek" subtitle="You chose the oldest card. Take it, or the top card of the deck instead." pc={game.players[head.player].color}>
          <div className="card-choice">
            <div className="choice-col">
              <small>Face-up</small>
              <CardView
                id={(head.deck === 'skill' ? game.market.skillRow : game.market.tacticRow)[2]}
                size="lg"
                onClick={() => dispatch({ type: 'peekChoice', takeTop: false })}
              />
            </div>
            <div className="choice-col">
              <small>Top of deck</small>
              <CardView id={head.top} size="lg" className="flip-in" onClick={() => dispatch({ type: 'peekChoice', takeTop: true })} />
            </div>
          </div>
        </Modal>
      );
    case 'discardSkill': {
      const p = game.players[head.player];
      return (
        <Modal
          title={head.reason === 'sabotage' ? 'Sabotage!' : `Too many ${rulesOf(game).cards?.terms.skills ?? 'skills'}`}
          subtitle={`${p.name}, choose a card to discard.`}
          pc={p.color}
        >
          <div className="card-choice wrap">
            {p.skills.map((s, i) => (
              <CardView key={`${s.id}${i}`} id={s.id} size="md" onClick={() => dispatch({ type: 'discardSkill', skill: s.id })} />
            ))}
          </div>
        </Modal>
      );
    }
    case 'changeOfHeart':
      return (
        <Modal title="Change of Heart" subtitle="Search the Skill deck and take any skill." pc={game.players[head.player].color} wide>
          <div className="card-choice wrap">
            {[...new Set(game.market.skillDeck)].sort().map((id) => (
              <CardView key={id} id={id} size="sm" onClick={() => dispatch({ type: 'changeOfHeart', skill: id })} />
            ))}
          </div>
        </Modal>
      );
    case 'dangerous': {
      const p = game.players[head.player];
      const att = die(game, head.attacker);
      const def = die(game, head.defender);
      return (
        <Modal
          title="Dangerous"
          subtitle={`${game.players[att.owner].name}'s ${SHIP_NAMES[att.value]} attacks your ${SHIP_NAMES[def.value]}. Before the dice are rolled, you may destroy both ships (no dominance change).`}
          pc={p.color}
        >
          <div className="modal-actions">
            <button className="btn" onClick={() => dispatch({ type: 'dangerous', destroy: false })}>Fight</button>
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'dangerous', destroy: true })}>Destroy both ships</button>
          </div>
        </Modal>
      );
    }
    case 'brilliant': {
      const p = game.players[head.player];
      return (
        <Modal
          title="Brilliant"
          subtitle={`${p.name}, you may gain 2 Research (now ${p.research}). With Pioneering you may want to keep the number you have.`}
          pc={p.color}
        >
          <div className="modal-actions">
            <button className="btn" onClick={() => dispatch({ type: 'brilliant', gain: false })}>Keep {p.research}</button>
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'brilliant', gain: true })}>
              Gain 2 → {Math.min(6, p.research + 2)}
            </button>
          </div>
        </Modal>
      );
    }
    case 'clever': {
      const p = game.players[head.player];
      const d = die(game, head.die);
      const subtitle = head.options
        ? `${p.name}, keep this ship’s number or change it by 1.`
        : `${p.name}, choose this ship’s number instead of rolling it.`;
      return (
        <Modal title="Clever" subtitle={subtitle} pc={p.color}>
          <div className="fleet-roll clever-row">
            {(head.options ?? [1, 2, 3, 4, 5, 6]).map((value) => (
              <button
                key={value}
                className="fleet-die clever-choice"
                disabled={value === head.avoid}
                title={value === head.avoid ? 'A reconfigured ship must change its number' : undefined}
                onClick={() => dispatch({ type: 'clever', value })}
              >
                <Die3D value={value} size={54} color={p.color} sound={false} />
                <span className="show">{SHIP_NAMES[value]}</span>
              </button>
            ))}
          </div>
          {d.loc.zone === 'scrapyard' && <p className="modal-sub">The ship goes to your scrapyard.</p>}
        </Modal>
      );
    }
    default:
      return null;
  }
}

function SetupRoll({ game, dispatch, player, rerolled }: { game: GameState; dispatch: Dispatch; player: number; rerolled: boolean }) {
  const p = game.players[player];
  const dice = scrapyard(game, player);
  const sum = dice.reduce((a, d) => a + d.value, 0);
  const [landed, setLanded] = useState(false);
  const rollKey = dice.map((d) => d.rolls).join();
  useEffect(() => {
    setLanded(false);
    const t = window.setTimeout(() => setLanded(true), 1350);
    return () => window.clearTimeout(t);
  }, [rollKey]);

  return (
    <Modal title="Roll your fleet" subtitle={`${p.name}, these three dice are your starting ships. The lowest fleet total plays first.`} pc={p.color}>
      <div className="fleet-roll">
        {dice.map((d, i) => (
          <div key={d.id} className="fleet-die">
            <Die3D value={d.value} rolls={d.rolls} size={78} color={p.color} tumbleOnMount delay={i * 0.12} sound={i === 0} />
            <span className={landed ? 'show' : ''}>{SHIP_NAMES[d.value]}</span>
          </div>
        ))}
      </div>
      <p className={`fleet-sum ${landed ? 'show' : ''}`}>Fleet total <b>{sum}</b></p>
      <div className="modal-actions">
        <button className="btn" disabled={rerolled || !landed} onClick={() => dispatch({ type: 'setupReroll' })} title="You may re-roll once, but must re-roll all three.">
          {rerolled ? 'Re-roll used' : 'Re-roll all (once)'}
        </button>
        <button className="btn btn-primary" disabled={!landed} onClick={() => dispatch({ type: 'setupKeep' })}>
          Keep fleet
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, subtitle, pc, wide, children }: { title: string; subtitle?: string; pc?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className="overlay">
      <div className={`modal ${wide ? 'wide' : ''}`} style={{ '--pc': pc ?? 'var(--accent)' } as CSSProperties}>
        <h2>{title}</h2>
        {subtitle && <p className="modal-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function Toasts({ toasts, game }: { toasts: Toast[]; game: GameState }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} style={{ '--pc': t.player !== undefined ? game.players[t.player]?.color : 'var(--accent)' } as CSSProperties}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function ErrorToast({ error }: { error: { id: number; text: string } | null }) {
  const [visible, setVisible] = useState<typeof error>(null);
  useEffect(() => {
    if (!error) return;
    setVisible(error);
    const t = window.setTimeout(() => setVisible(null), 2600);
    return () => window.clearTimeout(t);
  }, [error]);
  if (!visible) return null;
  return <div className="error-toast" key={visible.id}>{visible.text}</div>;
}

export function GameOver({ game, onNew, onClose }: { game: GameState; onNew: () => void; onClose: () => void }) {
  if (game.winner === null) return null;
  const w = game.players[game.winner];
  return (
    <div className="overlay">
      <div className="modal gameover" style={{ '--pc': w.color } as CSSProperties}>
        <div className="gameover-burst" />
        <small>Victory</small>
        <h2>{w.name} conquers the sector</h2>
        <p className="modal-sub">All cubes placed after {game.turn.number} turns.</p>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>View board</button>
          <button className="btn btn-primary" onClick={onNew}>New game</button>
        </div>
      </div>
    </div>
  );
}
