import { useEffect, useState } from 'react';
import { createGame, type GameState } from '@quantum/engine';
import { useGame } from './game/useGame';
import { clearSavedGame, loadSavedGame } from './game/savedGame';
import { Lobby, type LobbyResult } from './components/Lobby';
import { Rules } from './components/Rules';
import { Game } from './components/GameScreen';
import { OnlineScreen, onlineSecret } from './online/OnlineScreen';
import { createOnlineGame } from './online/create';

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [saved, setSaved] = useState(loadSavedGame);
  const [rules, setRules] = useState(false);
  // An online game is opened by its link: #online/<secret>.
  const [online, setOnline] = useState(onlineSecret);
  useEffect(() => {
    const follow = () => {
      const secret = onlineSecret();
      setOnline(secret);
      // Leaving a game on this device (Back, or an invite link): it lives on as the saved game, to
      // resume from the lobby. Its screen would otherwise come back at the state it started from.
      if (secret) {
        setGame(null);
        setSaved(loadSavedGame());
      }
    };
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  const start = (r: LobbyResult) => {
    if (r.online) location.hash = `#online/${createOnlineGame(r)}`;
    else setGame(createGame({ players: r.players, mapId: r.mapId, mode: r.mode }));
  };
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
      {online ? (
        <OnlineScreen key={online} secret={online} onLeave={() => (location.hash = '')} onRules={() => setRules(true)} />
      ) : game ? (
        <LocalGame key={game.seed} initial={game} onQuit={quit} onRules={() => setRules(true)} />
      ) : (
        <Lobby onStart={start} onRules={() => setRules(true)} saved={saved} onResume={() => setGame(saved)} onDiscard={discard} />
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
    </>
  );
}

function LocalGame({ initial, onQuit, onRules }: { initial: GameState; onQuit: () => void; onRules: () => void }) {
  const view = useGame(initial);
  return <Game view={view} onQuit={onQuit} onRules={onRules} />;
}
