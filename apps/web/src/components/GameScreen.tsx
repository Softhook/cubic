import { useState, type CSSProperties, type ReactNode } from 'react';
import { rulesOf } from '@quantum/engine';
import { useController } from '../game/controller';
import type { GameView } from '../game/view';
import { SHEET, useMediaQuery } from '../game/useMediaQuery';
import { BottomSheet } from './BottomSheet';
import { Board } from './Board';
import { Market } from './Market';
import { Log } from './Log';
import { PlayerList } from './PlayerList';
import { TurnPanel } from './TurnPanel';
import { CombatOverlay } from './CombatOverlay';
import { DecisionOverlay, GameOver } from './Overlays';
import { ErrorToast, Toasts } from './Toasts';
import { FullscreenButton, useFullscreenOnFirstTap } from './FullscreenButton';

/**
 * The game screen, for a game on this device or online. `side` goes at the top of the sidebar,
 * `overlay` over everything; online, leaving doesn't end the game. `onLobby` (the title) goes back to
 * the lobby without ending it. On a phone held upright the sidebar and market are a bottom sheet over
 * the map instead, with the turn panel showing at rest and the market first under it.
 */
export function Game({
  view,
  onQuit,
  onLobby,
  onRules,
  online,
  side,
  overlay,
}: {
  view: GameView;
  onQuit: () => void;
  onLobby: () => void;
  onRules: () => void;
  online?: boolean;
  side?: ReactNode;
  overlay?: ReactNode;
}) {
  const { game, dispatch, error, toasts, undo } = view;
  const ctl = useController(game, dispatch, view.mine);
  const [hideGameOver, setHideGameOver] = useState(false);
  useFullscreenOnFirstTap();
  const head = game.pending[0];
  const sheet = useMediaQuery(SHEET);
  const cards = rulesOf(game).cards;
  // The same panels in both layouts, in a different order.
  const turnPanel = <TurnPanel game={game} ctl={ctl} dispatch={dispatch} undo={undo} />;
  const market = cards && <Market game={game} dispatch={dispatch} legal={ctl.legal} />;
  const players = <PlayerList game={game} ctl={ctl} dispatch={dispatch} />;
  const log = <Log game={game} />;

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" title="Back to the lobby" onClick={onLobby}>Cubic</button>
        <div className="topbar-map">
          <span className={`mode-badge mode-${game.mode}`}>{rulesOf(game).name}</span>
          {game.board.mapName}
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={onLobby}>Lobby</button>
          <button className="btn btn-ghost" onClick={onRules}>Rules</button>
          <FullscreenButton />
        </div>
      </header>

      <main className={`layout ${sheet ? 'sheet-layout' : ''}`}>
        {/* First in both layouts, so turning the phone keeps the board (and its zoom). */}
        <div className="stage" style={{ '--map-ratio': game.board.rows / game.board.cols } as CSSProperties}>
          {/* Choosing a starting planet is the first moment the map is yours to look at: show it zooms then. */}
          <Board game={game} ctl={ctl} introduce={game.phase === 'setup' && ctl.highlights.planets.size > 0} />
          <Toasts toasts={toasts} game={game} />
          <ErrorToast error={error} />
        </div>
        {sheet ? (
          <BottomSheet peek={turnPanel} wantOpen={!!cards && (ctl.legal.can('takeCard') || ctl.legal.can('patientTactic'))}>
            {side}
            {market}
            {players}
            {log}
          </BottomSheet>
        ) : (
          <>
            <aside className="sidebar">
              {side}
              {turnPanel}
              {players}
              {log}
            </aside>
            {market}
          </>
        )}
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
