import { useState, type ReactNode } from 'react';
import { rulesOf } from '@quantum/engine';
import { useController } from '../game/controller';
import type { GameView } from '../game/view';
import { setSoundEnabled, soundEnabled } from '../sound';
import { Board } from './Board';
import { Market } from './Market';
import { Log } from './Log';
import { PlayerList } from './PlayerList';
import { TurnPanel } from './TurnPanel';
import { CombatOverlay } from './CombatOverlay';
import { AdvancePrompt, DecisionOverlay, GameOver } from './Overlays';
import { ErrorToast, Toasts } from './Toasts';
import { FullscreenButton } from './FullscreenButton';

/**
 * The game screen, for a game on this device or online. `side` goes at the top of the sidebar,
 * `overlay` over everything; online, leaving doesn't end the game.
 */
export function Game({
  view,
  onQuit,
  onRules,
  online,
  side,
  overlay,
}: {
  view: GameView;
  onQuit: () => void;
  onRules: () => void;
  online?: boolean;
  side?: ReactNode;
  overlay?: ReactNode;
}) {
  const { game, dispatch, error, toasts, undo } = view;
  const ctl = useController(game, dispatch, view.mine);
  const [sound, setSound] = useState(soundEnabled());
  const [hideGameOver, setHideGameOver] = useState(false);
  const head = game.pending[0];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Cubic</div>
        <div className="topbar-map">
          <span className={`mode-badge mode-${game.mode}`}>{rulesOf(game).name}</span>
          {game.board.mapName}
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" title={sound ? 'Mute' : 'Unmute'} onClick={() => { setSoundEnabled(!sound); setSound(!sound); }}>
            {sound ? '🔊' : '🔈'}
          </button>
          <button className="btn btn-ghost" onClick={onRules}>Rules</button>
          {online ? (
            <button className="btn btn-ghost" title="Back to the lobby. The game goes on; open it again from there or with its link." onClick={onQuit}>
              Lobby
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => { if (game.phase === 'over' || confirm('Abandon this game?')) onQuit(); }}>
              New game
            </button>
          )}
          <FullscreenButton />
        </div>
      </header>

      <main className="layout">
        <div className="stage">
          <Board game={game} ctl={ctl}>
            {head?.kind === 'advance' && ctl.human && <AdvancePrompt game={game} advance={head} dispatch={dispatch} />}
          </Board>
          <Toasts toasts={toasts} game={game} />
          <ErrorToast error={error} />
        </div>
        <aside className="sidebar">
          {side}
          <TurnPanel game={game} ctl={ctl} dispatch={dispatch} undo={undo} />
          <PlayerList game={game} ctl={ctl} dispatch={dispatch} />
          <Log game={game} />
        </aside>
        {rulesOf(game).cards && <Market game={game} dispatch={dispatch} legal={ctl.legal} />}
      </main>

      {head?.kind === 'combat' && <CombatOverlay key={head.id} game={game} combat={head} dispatch={dispatch} mine={view.mine} online={online ? (view.combat ?? NO_RESPONSE) : undefined} />}
      <DecisionOverlay game={game} dispatch={dispatch} human={ctl.human} />
      {game.phase === 'over' && !hideGameOver && <GameOver game={game} onNew={onQuit} onClose={() => setHideGameOver(true)} newLabel={online ? 'Back to lobby' : undefined} />}
      {overlay}
    </div>
  );
}

/** Online, a battle on screen that waits for nobody (it is being replayed, or resolves by itself). */
const NO_RESPONSE: NonNullable<GameView['combat']> = { responders: [], mustAnswer: false, waitingOn: [], pass: () => {} };
