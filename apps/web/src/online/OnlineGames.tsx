import { useState } from 'react';
import { forgetGame, onlineGames } from './storage';

/** The lobby's list of online games in this browser, as they stood when last opened. */
export function OnlineGames() {
  const [games, setGames] = useState(onlineGames);
  if (!games.length) return null;
  return (
    <div className="lobby-card online-games">
      <h2>Online games</h2>
      <ul>
        {games.map((g) => (
          <li key={g.secret} className={g.myTurn ? 'my-turn' : ''}>
            <a href={`#online/${g.secret}`}>
              <strong>{g.players?.join(', ') ?? 'New game'}</strong>
              <span className="muted">
                {[g.mode, g.map, g.status].filter(Boolean).join(' · ')}
              </span>
            </a>
            {g.myTurn && <span className="tag your-turn">Your move</span>}
            <button
              className="icon-btn"
              title="Remove from this browser"
              aria-label="Remove from this browser"
              onClick={() => {
                if (!g.over && !confirm('Remove this game from this browser? The others can go on playing; you can rejoin with the link.')) return;
                forgetGame(g.secret);
                setGames(onlineGames());
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
