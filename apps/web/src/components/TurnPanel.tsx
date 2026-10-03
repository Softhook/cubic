import type { CSSProperties } from 'react';
import { SHIP_NAMES, card, rulesOf, skillCard, type GameState, type SkillEffect } from '@quantum/engine';
import { hintFor, type Controller } from '../game/controller';
import type { Dispatch } from '../game/useGame';
import { CategoryIcon } from './Card';
import { ShipPanel } from './ShipPanel';

export function TurnPanel({ game, ctl, dispatch, undo }: { game: GameState; ctl: Controller; dispatch: Dispatch; undo?: () => void }) {
  const t = game.turn;
  const p = game.players[t.player];
  const head = game.pending[0];
  const { legal } = ctl;
  const canAct = ctl.actionPhase;
  const hint = ctl.human ? hintFor(game, ctl.sel) : '';
  const waitingOn = head && head.kind !== 'combat' ? game.players[head.player] : null;

  return (
    <section className="panel turn-panel" style={{ '--pc': p.color } as CSSProperties}>
      <div className="turn-head">
        <span className="turn-dot" />
        <div className="turn-title">
          <small>{game.phase === 'setup' ? 'Setup' : t.bonus ? 'Bonus turn' : `Turn ${t.number}`}</small>
          <strong>{game.phase === 'setup' && waitingOn ? waitingOn.name : p.name}</strong>
        </div>
        {game.phase === 'play' && (
          <div className="action-pips" title={`${t.actionsLeft} action${t.actionsLeft === 1 ? '' : 's'} left`}>
            {Array.from({ length: Math.max(3, t.actionsLeft) }, (_, i) => (
              <span key={i} className={i < t.actionsLeft ? 'on' : ''} />
            ))}
            {t.freeDeploys > 0 && <em title="Free deploy (Industrious)">+1 deploy</em>}
            {t.freeMoves > 0 && <em title="Free move (Curious) — only if you don't attack this turn; attacking afterwards costs an action for it">+1 move</em>}
          </div>
        )}
      </div>

      {(waitingOn?.ai || (!head && p.ai && game.phase === 'play')) && (
        <p className="hint thinking">
          <span className="spinner" /> {waitingOn?.name ?? p.name} is thinking…
        </p>
      )}
      {hint && <p className="hint">{hint}</p>}

      {game.phase === 'play' && !p.ai && (
        <div className="turn-actions">
          {rulesOf(game).cards && (
            <button
              className="btn"
              disabled={!legal.can('research')}
              onClick={() => dispatch({ type: 'research' })}
              title="+1 research. At 6 you gain a card at the end of your turn."
            >
              <CategoryIcon category="research" /> Research
            </button>
          )}
          <SkillButton game={game} effect="composed" disabled={!legal.can('composed')} onClick={() => dispatch({ type: 'composed' })} />
          <SkillButton game={game} effect="tyrannical-original" disabled={!legal.can('tyrannical')} onClick={() => dispatch({ type: 'tyrannical' })} />
          <SkillButton game={game} effect="ambitious" label="Ambitious +1" disabled={!legal.can('ambitious')} onClick={() => dispatch({ type: 'ambitious' })} />
          {legal.can('scrappy') && (
            <SkillButton game={game} effect="scrappy" label={`Re-roll ${scrappyShip(game)} (Scrappy)`} disabled={false} onClick={() => dispatch({ type: 'scrappy' })} />
          )}
          <button
            className="btn btn-ghost undo-btn"
            disabled={!canAct || !undo}
            onClick={() => {
              ctl.select({ kind: 'none' });
              undo?.();
            }}
            title="Take back your last move (Ctrl/⌘+Z). Dice rolls, battles and cards can’t be undone."
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
            Undo
          </button>
          <button
            className={`btn btn-primary ${canAct && t.actionsLeft === 0 ? 'pulse' : ''}`}
            disabled={!legal.can('endTurn')}
            onClick={() => dispatch({ type: 'endTurn' })}
          >
            End turn
          </button>
        </div>
      )}

      {head?.kind === 'advance' && ctl.human && (
        <div className="turn-actions">
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'advance', move: true })}>Advance</button>
          <button className="btn" onClick={() => dispatch({ type: 'advance', move: false })}>Hold position</button>
        </div>
      )}
      {head?.kind === 'placeExpansion' && ctl.human && (
        <div className="turn-actions">
          <button className="btn" onClick={() => dispatch({ type: 'placeExpansion', to: null })}>Send to scrapyard</button>
        </div>
      )}
      {head?.kind === 'unveil' && ctl.human && (
        <div className="turn-actions">
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'unveilDone' })}>Done</button>
        </div>
      )}

      <ShipPanel game={game} ctl={ctl} dispatch={dispatch} />
    </section>
  );
}

/** The ship Scrappy would re-roll, by name. */
function scrappyShip(game: GameState): string {
  const id = game.turn.scrappy?.die;
  const d = id ? game.dice.find((x) => x.id === id) : undefined;
  return d ? SHIP_NAMES[d.value] : 'ship';
}

/** A button for a skill the current player activates; hidden unless they have it. */
function SkillButton({ game, effect, label, disabled, onClick }: { game: GameState; effect: SkillEffect; label?: string; disabled: boolean; onClick: () => void }) {
  const id = skillCard(game, game.turn.player, effect);
  if (!id) return null;
  const def = card(id);
  return (
    <button className="btn" disabled={disabled} onClick={onClick} title={def.text}>
      {label ?? def.name}
    </button>
  );
}
