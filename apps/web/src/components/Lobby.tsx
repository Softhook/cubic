import { useState, type CSSProperties } from 'react';
import { AI_LEVELS, DEFAULT_AI_LEVEL } from '@quantum/ai';
import { defaultMap, MAPS, MODES, playerCounts, rulesOf, RULESETS, type GameMode, type GameState, type MapDef, type PlayerConfig } from '@quantum/engine';
import { Die3D } from './Die3D';
import { OnlineGames } from '../online/OnlineGames';
import { remember, stored } from '../storage';

export const PLAYER_COLORS = ['#4cc9f0', '#f72585', '#ffb703', '#80ed99', '#b388ff'];
const AI_NAMES = ['Nova', 'Vex', 'Orion', 'Lyra', 'Kepler'];
const PLAYER_COUNTS = [...new Set(MAPS.map((m) => m.players))];

export interface LobbyResult {
  players: PlayerConfig[];
  mapId: string;
  mode: GameMode;
  /** Played online: the human seats other than the first are for friends to claim. */
  online?: boolean;
}

function storedAiLevel(): number {
  const n = Number(stored('quantum.aiLevel'));
  return AI_LEVELS.some((l) => l.level === n) ? n : DEFAULT_AI_LEVEL;
}

function storedMode(): GameMode {
  return MODES.find((m) => m.id === stored('quantum.mode'))?.id ?? 'community';
}

function storedMap(players: number): string {
  const id = stored(`quantum.map.${players}`);
  return MAPS.find((m) => m.id === id && m.players === players)?.id ?? defaultMap(players)!.id;
}

const MAP_GROUPS: { id: string; name: string }[] = [
  { id: 'basic', name: 'Basic' },
  { id: 'advanced', name: 'Advanced' },
  { id: 'addon', name: 'Add-on pack' },
  { id: 'bga', name: 'Board Game Arena' },
  { id: 'ce', name: 'Community Edition' },
];

function MiniMap({ map }: { map: MapDef }) {
  const cols = Math.max(...map.layout.map((r) => r.length));
  const size = Math.min(26, Math.floor(150 / Math.max(cols, map.layout.length)));
  return (
    <div className="mini-map" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)`, '--tile': `${size}px` } as CSSProperties}>
      {map.layout.flatMap((row, r) =>
        Array.from({ length: cols }, (_, c) => {
          const t = row[c] ?? '.';
          const n = t.replace('*', '');
          if (t === '.') return <span key={`${r},${c}`} className="mini-tile gap" />;
          return (
            <span key={`${r},${c}`} className={`mini-tile n${n} ${t.endsWith('*') ? 'start' : ''}`}>
              {n === '0' ? '' : n}
            </span>
          );
        }),
      )}
    </div>
  );
}

/** The unfinished game from a previous visit, offered for resuming. */
function SavedGame({ game, onResume, onDiscard }: { game: GameState; onResume: () => void; onDiscard: () => void }) {
  return (
    <div className="lobby-card saved-game">
      <h2>Game in progress</h2>
      <div className="saved-game-info">
        <span className={`mode-badge mode-${game.mode}`}>{rulesOf(game).name}</span>
        <strong>{game.board.mapName}</strong>
        <span className="muted">{game.phase === 'setup' ? 'Setting up' : `Turn ${game.turn.number}`}</span>
      </div>
      <div className="saved-game-players">
        {game.players.map((p, i) => (
          <span key={i} className="saved-game-player" style={{ '--pc': p.color } as CSSProperties}>
            <span className="player-swatch" />
            {p.name}
            {p.ai && <span className="muted"> · AI</span>}
          </span>
        ))}
      </div>
      <div className="modal-actions">
        <button
          className="btn"
          onClick={() => {
            if (confirm('Discard the game in progress?')) onDiscard();
          }}
        >
          Discard
        </button>
        <button className="btn btn-primary btn-lg" onClick={onResume}>
          Resume
        </button>
      </div>
    </div>
  );
}

/** Online, human seats after the first are left open for friends to claim. */
const isFriendSeat = (seat: PlayerConfig, index: number, online: boolean) => online && index > 0 && !seat.ai;

/** One player seat: name, who plays it, and the AI level when an AI does. */
function SeatRow({
  seat,
  index,
  online,
  onChange,
}: {
  seat: PlayerConfig;
  index: number;
  online: boolean;
  onChange: (patch: Partial<PlayerConfig>) => void;
}) {
  const label = `Player ${index + 1}`;
  const aiLevel = seat.aiLevel ?? DEFAULT_AI_LEVEL;
  return (
    <div className="seat" style={{ '--pc': seat.color } as CSSProperties}>
      <span className="player-swatch" />
      {isFriendSeat(seat, index, online) ? (
        <input value="" placeholder="A friend joins here" disabled aria-label={`${label}: a friend`} />
      ) : (
        <input value={seat.name} maxLength={14} onChange={(e) => onChange({ name: e.target.value })} aria-label={`${label} name`} />
      )}
      {online && index === 0 ? (
        <span className="seat-you">You</span>
      ) : (
        <div className="segmented small">
          <button className={!seat.ai ? 'on' : ''} onClick={() => onChange({ ai: false })}>{online ? 'Friend' : 'Human'}</button>
          <button className={seat.ai ? 'on' : ''} onClick={() => onChange({ ai: true })}>AI</button>
        </div>
      )}
      {seat.ai && (
        <select
          className="ai-level"
          value={aiLevel}
          aria-label={`${label} AI level`}
          title={AI_LEVELS.find((l) => l.level === aiLevel)?.summary}
          onChange={(e) => {
            onChange({ aiLevel: Number(e.target.value) });
            remember('quantum.aiLevel', e.target.value);
          }}
        >
          {AI_LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              {l.level} · {l.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Map dropdown grouped by origin, a random pick, and a preview of the chosen map. */
function MapPicker({ map, choices, onChoose }: { map: MapDef; choices: MapDef[]; onChoose: (id: string) => void }) {
  const chooseRandom = () => {
    const others = choices.filter((m) => m.id !== map.id);
    onChoose(others[Math.floor(Math.random() * others.length)].id);
  };
  return (
    <div className="map-preview">
      <div className="map-info">
        <small>Map</small>
        <div className="map-select">
          <select value={map.id} aria-label="Map" onChange={(e) => onChoose(e.target.value)}>
            {MAP_GROUPS.map((g) => {
              const maps = choices.filter((m) => m.group === g.id);
              return (
                maps.length > 0 && (
                  <optgroup key={g.id} label={g.name}>
                    {maps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                )
              );
            })}
          </select>
          <button className="btn btn-icon" title="Random map" aria-label="Random map" onClick={chooseRandom}>
            ⚄
          </button>
        </div>
        <span className="muted">
          {map.cubes} cubes each ·{' '}
          {map.stats.shared === null ? 'too few spaces for every cube' : `${map.stats.shared}/${map.stats.planets} planets shared`}
          {map.layout.flat().includes('0') && ' · void'}
        </span>
      </div>
      <MiniMap map={map} />
    </div>
  );
}

export function Lobby({
  onStart,
  onRules,
  saved,
  onResume,
  onDiscard,
}: {
  onStart: (r: LobbyResult) => void;
  onRules: () => void;
  saved: GameState | null;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const [wanted, setWanted] = useState(2);
  const [online, setOnline] = useState(false);
  const [mode, setMode] = useState<GameMode>(storedMode);
  // 5 players only has Community Edition maps; other rules fall back to their largest count.
  const counts = playerCounts(RULESETS[mode]);
  const count = counts.includes(wanted) ? wanted : counts[counts.length - 1];
  const [seats, setSeats] = useState<PlayerConfig[]>(() =>
    PLAYER_COLORS.map((color, i) => ({ name: i === 0 ? 'Commander' : AI_NAMES[i], color, ai: i !== 0, aiLevel: storedAiLevel() })),
  );
  const [mapIds, setMapIds] = useState<Record<number, string>>(() => Object.fromEntries(PLAYER_COUNTS.map((n) => [n, storedMap(n)])));
  const choices = MAPS.filter((m) => m.players === count && RULESETS[mode].mapGroups.includes(m.group));
  // A remembered map the chosen rules don't use falls back to the basic map (it stays remembered).
  const map = choices.find((m) => m.id === mapIds[count]) ?? defaultMap(count)!;

  const chooseMode = (id: GameMode) => {
    setMode(id);
    remember('quantum.mode', id);
  };
  const chooseMap = (id: string) => {
    setMapIds((ids) => ({ ...ids, [count]: id }));
    remember(`quantum.map.${count}`, id);
  };
  const updateSeat = (i: number, patch: Partial<PlayerConfig>) =>
    setSeats((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Online, the first seat is yours, whatever it was set to; human seats after it are for friends.
  const playing = seats.slice(0, count).map((s, i) => (online && i === 0 ? { ...s, ai: false } : s));
  const friendSeats = playing.filter((s, i) => isFriendSeat(s, i, online)).length;
  const canStart = !online || friendSeats > 0;

  const start = () => {
    if (!online && saved && !confirm('Starting a new game discards the game in progress. Continue?')) return;
    onStart({
      players: playing.map((s, i) => ({
        ...s,
        name: isFriendSeat(s, i, online) ? `Player ${i + 1}` : s.name.trim() || `Player ${i + 1}`,
      })),
      mapId: map.id,
      mode,
      online,
    });
  };

  return (
    <div className="lobby">
      <div className="lobby-hero">
        <div className="lobby-dice">
          {[1, 3, 6].map((v, i) => (
            <Die3D key={v} value={v} size={46} color={PLAYER_COLORS[i]} tumbleOnMount delay={i * 0.15} sound={false} />
          ))}
        </div>
        <h1>Cubic</h1>
        <p className="tagline">Every die is a starship. Low numbers hit hard, high numbers fly fast. Place all your cubes to conquer the sector.</p>
      </div>

      {saved && <SavedGame game={saved} onResume={onResume} onDiscard={onDiscard} />}
      <OnlineGames />

      <div className="lobby-card">
        <h2>New game</h2>
        <label className="field">
          <span>Play</span>
          <div className="segmented">
            <button className={!online ? 'on' : ''} onClick={() => setOnline(false)}>On this device</button>
            <button className={online ? 'on' : ''} onClick={() => setOnline(true)}>Online with friends</button>
          </div>
        </label>
        {online && (
          <p className="muted lobby-note">
            You get a link to send to your friends. Every browser keeps the game, so you can play together live or one move at a time over days. No account needed.
          </p>
        )}
        <div className="modes" role="radiogroup" aria-label="Rules">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={m.id === mode} className={`mode ${m.id === mode ? 'on' : ''}`} onClick={() => chooseMode(m.id)}>
              <strong>{m.name}</strong>
              <span>{m.summary}</span>
            </button>
          ))}
        </div>

        <label className="field">
          <span>Players</span>
          <div className="segmented">
            {counts.map((n) => (
              <button key={n} className={n === count ? 'on' : ''} onClick={() => setWanted(n)}>
                {n}
              </button>
            ))}
          </div>
        </label>

        <div className="seats">
          {playing.map((s, i) => (
            <SeatRow key={i} seat={s} index={i} online={online} onChange={(patch) => updateSeat(i, patch)} />
          ))}
        </div>

        <MapPicker map={map} choices={choices} onChoose={chooseMap} />

        {!canStart && <p className="muted lobby-note">Make at least one seat a Friend to play online.</p>}
        <div className="modal-actions">
          <button className="btn" onClick={onRules}>How to play</button>
          <button className="btn btn-primary btn-lg" disabled={!canStart} onClick={start}>
            {online ? 'Create online game' : 'Launch fleet'}
          </button>
        </div>
      </div>
      <nav className="lobby-links">
        <a href="#rulebook">Rulebook (PDF)</a>
        <a href="#lab/cards">Art Lab: cards &amp; tiles</a>
      </nav>
      <p className="credits">
        Cubic is a reimagining of Quantum by Eric Zimmerman and its fan-made Community Edition. Non-commercial fan project.
      </p>
    </div>
  );
}
