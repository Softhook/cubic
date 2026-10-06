import type { CSSProperties } from 'react';
import { canCurious, SHIP_NAMES, card, die, rulesOf, skillCard, type GameState, type SkillEffect } from '@quantum/engine';
import type { Controller } from '../game/controller';
import { hintFor } from '../game/hints';
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
  // Whose decision the table waits for (battles have their own overlay).
  const waitingFor = waitingOn ?? (!head && game.phase !== 'over' ? p : null);

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
            {canAct && t.actionsLeft === 0 && canCurious(game, t.player) && <em title="Curious: peaceful Move or Research available">+1 curious</em>}
            {legal.can('playStoredTactic') && <em title="Patient: you may play a stored tactic from your player card">+stored tactic</em>}
          </div>
        )}
      </div>

      {waitingFor && !ctl.mine(waitingFor.id) && (
        <p className="hint thinking">
          <span className="spinner" /> {waitingFor.ai ? `${waitingFor.name} is thinking…` : `Waiting for ${waitingFor.name}…`}
        </p>
      )}
      {hint && <p className="hint">{hint}</p>}

      {game.phase === 'play' && ctl.mine(p.id) && (
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
            <SkillButton game={game} effect="scrappy" label={`Re-roll ${SHIP_NAMES[die(game, game.turn.scrappy!.die).value]} (Scrappy)`} disabled={false} onClick={() => dispatch({ type: 'scrappy' })} />
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
            className={`btn btn-primary ${canAct && t.actionsLeft === 0 && !canCurious(game, t.player) && !legal.can('playStoredTactic') ? 'pulse' : ''}`}
            disabled={!legal.can('endTurn')}
            onClick={() => dispatch({ type: 'endTurn' })}
          >
            End turn
          </button>
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
