import { lazy, Suspense, useEffect, useState } from 'react';
import { createGame, type GameState } from '@quantum/engine';
import { useGame } from './game/useGame';
import { clearSavedGame, gameOnScreenBeforeReload, markGameOnScreen } from './game/savedGame';
import { devStartGame } from './game/devStart';
import { Lobby, type LobbyResult } from './components/Lobby';
import { Game } from './components/GameScreen';
import { onlineSecret } from './online/link';
import { fullscreenOnPhone } from './components/FullscreenButton';

// Loaded when first wanted, so the lobby and a game on this device start without them: the manual, and
// online play (with its cryptography).
const Rules = lazy(() => import('./components/Rules').then((m) => ({ default: m.Rules })));
const OnlineScreen = lazy(() => import('./online/OnlineScreen').then((m) => ({ default: m.OnlineScreen })));

export function App() {
  const [game, setGame] = useState<GameState | null>(() => devStartGame() ?? (onlineSecret() ? null : gameOnScreenBeforeReload()));
  const [rules, setRules] = useState(false);
  // An online game is opened by its link: #online/<secret>.
  const [online, setOnline] = useState(onlineSecret);
  useEffect(() => markGameOnScreen(!!game && !online), [game, online]);
  useEffect(() => {
    const follow = () => {
      const secret = onlineSecret();
      setOnline(secret);
      // Leaving a game on this device (Back, or an invite link): it lives on as the saved game, to
      // resume from the lobby. Its screen would otherwise come back at the state it started from.
      if (secret) setGame(null);
    };
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  const start = (r: LobbyResult) => {
    fullscreenOnPhone();
    if (r.online) void import('./online/create').then(({ createOnlineGame }) => (location.hash = `#online/${createOnlineGame(r)}`));
    else setGame(createGame({ players: r.players, mapId: r.mapId, mode: r.mode }));
  };
  /** Back to the lobby; the game lives on as the saved game, to resume from there. */
  const toLobby = () => setGame(null);
  const quit = () => {
    clearSavedGame();
    setGame(null);
  };

  return (
    <>
      {online ? (
        <Suspense fallback={null}>
          <OnlineScreen key={online} secret={online} onLeave={() => (location.hash = '')} onRules={() => setRules(true)} />
        </Suspense>
      ) : game ? (
        <LocalGame key={game.seed} initial={game} onQuit={quit} onLobby={toLobby} onRules={() => setRules(true)} />
      ) : (
        <Lobby onStart={start} onRules={() => setRules(true)} onResume={(saved) => { fullscreenOnPhone(); setGame(saved); }} />
      )}
      {/* Its own boundary: while the manual loads, the screen under it stays. */}
      {rules && (
        <Suspense fallback={null}>
          <Rules onClose={() => setRules(false)} />
        </Suspense>
      )}
    </>
  );
}

function LocalGame({ initial, onQuit, onLobby, onRules }: { initial: GameState; onQuit: () => void; onLobby: () => void; onRules: () => void }) {
  const view = useGame(initial);
  return <Game view={view} onQuit={onQuit} onLobby={onLobby} onRules={onRules} />;
}
