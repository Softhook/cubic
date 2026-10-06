import { useState } from 'react';
import { createGame, rulesOf, type GameState } from '@quantum/engine';
import { useGame } from './game/useGame';
import { clearSavedGame, loadSavedGame } from './game/savedGame';
import { useController } from './game/controller';
import { Board } from './components/Board';
import { Market } from './components/Market';
import { Log } from './components/Log';
import { PlayerList } from './components/PlayerList';
import { TurnPanel } from './components/TurnPanel';
import { CombatOverlay } from './components/CombatOverlay';
import { AdvancePrompt, DecisionOverlay, GameOver } from './components/Overlays';
import { ErrorToast, Toasts } from './components/Toasts';
import { Lobby, type LobbyResult } from './components/Lobby';
import { Rules } from './components/Rules';
import { FullscreenButton } from './components/FullscreenButton';
import { setSoundEnabled, soundEnabled } from './sound';

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [saved, setSaved] = useState(loadSavedGame);
  const [rules, setRules] = useState(false);

  const start = (r: LobbyResult) => setGame(createGame({ players: r.players, mapId: r.mapId, mode: r.mode }));
  const discard = () => {
    clearSavedGame();
    setSaved(null);
  };
  const quit = () => {
    discard();
    setGame(null);
  };

  return (
    <>
      {game ? (
        <Game key={game.seed} initial={game} onQuit={quit} onRules={() => setRules(true)} />
      ) : (
        <Lobby onStart={start} onRules={() => setRules(true)} saved={saved} onResume={() => setGame(saved)} onDiscard={discard} />
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
    </>
  );
}

function Game({ initial, onQuit, onRules }: { initial: GameState; onQuit: () => void; onRules: () => void }) {
  const { game, dispatch, error, toasts, undo, canUndo } = useGame(initial);
  const ctl = useController(game, dispatch);
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
          <button className="btn btn-ghost" onClick={() => { if (game.phase === 'over' || confirm('Abandon this game?')) onQuit(); }}>
            New game
          </button>
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
          <TurnPanel game={game} ctl={ctl} dispatch={dispatch} undo={canUndo ? undo : undefined} />
          <PlayerList game={game} ctl={ctl} dispatch={dispatch} />
          <Log game={game} />
        </aside>
        {rulesOf(game).cards && <Market game={game} dispatch={dispatch} legal={ctl.legal} />}
      </main>

      {head?.kind === 'combat' && <CombatOverlay key={head.id} game={game} combat={head} dispatch={dispatch} />}
      <DecisionOverlay game={game} dispatch={dispatch} human={ctl.human} />
      {game.phase === 'over' && !hideGameOver && <GameOver game={game} onNew={onQuit} onClose={() => setHideGameOver(true)} />}
    </div>
  );
}
