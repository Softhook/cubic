import { useState, type CSSProperties, type ReactNode } from 'react';
import { AI_LEVELS, DEFAULT_AI_LEVEL } from '@quantum/ai';
import { defaultMap, MAPS, MODES, playerCounts, rulesOf, RULESETS, type GameMode, type GameState, type MapDef, type PlayerConfig } from '@quantum/engine';
import { Die3D } from './Die3D';
import { Segmented } from './Segmented';
import { fullscreenOnPhone, useFullscreenOnFirstTap } from './FullscreenButton';
import { forgetFinishedGames, forgetGame, onlineGames } from '../online/games';
import { defaultSeat } from '../game/seats';
import { clearSavedGame, loadSavedGame } from '../game/savedGame';
import { remember, stored } from '../storage';
import { APPLE_TOUCH, FROM_HOME_SCREEN } from '../platform';
import { BUILD, checkForUpdate, useUpdateStatus, type UpdateStatus } from '../pwa';
import { PLAYER_COLORS } from '../theme';

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

/** One game to pick up: opened by its link (online) or a click (this device), and removable. */
function GameRow({
  title,
  meta,
  yourMove,
  href,
  onOpen,
  onRemove,
  removeLabel,
}: {
  title: string;
  meta: string;
  yourMove?: boolean;
  href?: string;
  onOpen?: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const body = (
    <>
      <strong>{title}</strong>
      <span className="muted">{meta}</span>
    </>
  );
  return (
    <li className={yourMove ? 'my-turn' : ''}>
      {href ? (
        <a className="game-row-open" href={href} onClick={fullscreenOnPhone}>{body}</a>
      ) : (
        <button className="game-row-open" onClick={onOpen}>{body}</button>
      )}
      {yourMove && <span className="tag your-turn">Your move</span>}
      <button className="icon-btn" title={removeLabel} aria-label={removeLabel} onClick={onRemove}>
        ×
      </button>
    </li>
  );
}

/** The games to pick up: the one on this device, then the online ones (those waiting on you first). */
function YourGames({ saved, onResume, onDiscard }: { saved: GameState | null; onResume: () => void; onDiscard: () => void }) {
  // Finished games are done with: they leave the list once the lobby shows again.
  const [games, setGames] = useState(forgetFinishedGames);
  if (!saved && !games.length) return null;
  const online = [...games].sort((a, b) => Number(!!b.myTurn) - Number(!!a.myTurn));
  return (
    <div className="lobby-card your-games">
      <h2>Your games</h2>
      <ul>
        {saved && (
          <GameRow
            title={saved.players.map((p) => p.name).join(', ')}
            meta={['On this device', rulesOf(saved).name, saved.board.mapName, saved.phase === 'setup' ? 'Setting up' : `Turn ${saved.turn.number}`].join(' · ')}
            onOpen={onResume}
            removeLabel="Discard this game"
            onRemove={() => {
              if (confirm('Discard the game on this device?')) onDiscard();
            }}
          />
        )}
        {online.map((g) => (
          <GameRow
            key={g.secret}
            title={g.players?.join(', ') ?? 'New game'}
            meta={['Online', g.mode, g.map, g.status].filter(Boolean).join(' · ')}
            yourMove={g.myTurn}
            href={`#online/${g.secret}`}
            removeLabel="Remove from this browser"
            onRemove={() => {
              if (!g.over && !confirm('Remove this game from this browser? The others can go on playing; you can rejoin with the link.')) return;
              forgetGame(g.secret);
              setGames(onlineGames());
            }}
          />
        ))}
      </ul>
    </div>
  );
}

/** A labelled row of the new-game form, with an optional line of explanation under it. */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = `field-${label.toLowerCase()}`;
  return (
    <div className="field-row">
      <div className="field">
        <span id={id}>{label}</span>
        <div role="group" aria-labelledby={id}>{children}</div>
      </div>
      {hint && <p className="field-hint">{hint}</p>}
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
        <Segmented small options={[[false, online ? 'Friend' : 'Human'], [true, 'AI']]} value={!!seat.ai} onPick={(ai) => onChange({ ai })} />
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
  onResume,
}: {
  onStart: (r: LobbyResult) => void;
  onRules: () => void;
  onResume: (saved: GameState) => void;
}) {
  useFullscreenOnFirstTap();
  // Read on each visit: a game played since keeps saving itself.
  const [saved, setSaved] = useState(loadSavedGame);
  const discard = () => {
    clearSavedGame();
    setSaved(null);
  };
  const [wanted, setWanted] = useState(2);
  const [online, setOnline] = useState(false);
  const [mode, setMode] = useState<GameMode>(storedMode);
  // 5 players only has Community Edition maps; other rules fall back to their largest count.
  const counts = playerCounts(RULESETS[mode]);
  const count = counts.includes(wanted) ? wanted : counts[counts.length - 1];
  // Each way of playing keeps its own seats: AI opponents on this device, friends online.
  const [seatSets, setSeatSets] = useState<Record<'local' | 'online', PlayerConfig[]>>(() => {
    const aiLevel = storedAiLevel();
    return { local: PLAYER_COLORS.map((_, i) => defaultSeat(i, i !== 0, aiLevel)), online: PLAYER_COLORS.map((_, i) => defaultSeat(i, false, aiLevel)) };
  });
  const where = online ? 'online' : 'local';
  const seats = seatSets[where];
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
    setSeatSets((sets) => ({ ...sets, [where]: sets[where].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  // Online, the first seat is yours; human seats after it are for friends.
  const playing = seats.slice(0, count);
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
        <p className="tagline">Every die is a starship</p>
      </div>
      <HomeScreenHint />

      <YourGames saved={saved} onResume={() => saved && onResume(saved)} onDiscard={discard} />

      <div className="lobby-card">
        <h2>New game</h2>
        <div className="lobby-form">
          <Field
            label="Play"
            hint={
              online
                ? 'You get a link to send to your friends. Play together live or one move at a time over days. No account needed.'
                : 'Against the AI, or pass the device around.'
            }
          >
            <Segmented options={[[false, 'On this device'], [true, 'Online with friends']]} value={online} onPick={setOnline} />
          </Field>

          <Field label="Rules" hint={RULESETS[mode].summary}>
            <Segmented options={MODES.map((m) => [m.id, m.name] as const)} value={mode} onPick={chooseMode} />
          </Field>

          <Field label="Players">
            <Segmented options={counts.map((n) => [n, n] as const)} value={count} onPick={setWanted} />
          </Field>

          <div className="seats">
            {playing.map((s, i) => (
              <SeatRow key={i} seat={s} index={i} online={online} onChange={(patch) => updateSeat(i, patch)} />
            ))}
          </div>

          <MapPicker map={map} choices={choices} onChoose={chooseMap} />
        </div>

        {!canStart && <p className="field-hint">Make at least one seat a Friend to play online.</p>}
        <div className="modal-actions">
          <button className="btn btn-primary btn-lg" disabled={!canStart} onClick={start}>
            {online ? 'Create online game' : 'Launch fleet'}
          </button>
        </div>
      </div>
      <nav className="lobby-links">
        <button onClick={onRules}>How to play</button>
        <a href="#rulebook">Manual (PDF)</a>
        <a href="#lab/cards">Art Lab: cards &amp; tiles</a>
      </nav>
      <p className="credits">
        Cubic by Christian Nold is a reimagining of Quantum by Eric Zimmerman and its fan-made Community Edition. Non-commercial fan project.
      </p>
      <VersionLine />
    </div>
  );
}

/**
 * iPhone and iPad have no full screen for a page (FullscreenButton) and no install prompt, so the lobby says how
 * to get the next best thing: added to the Home Screen, the game opens without Safari's bars. Until dismissed.
 */
function HomeScreenHint() {
  const [shown, setShown] = useState(() => APPLE_TOUCH && !FROM_HOME_SCREEN && !stored('quantum.homeScreenHint'));
  if (!shown) return null;
  const dismiss = () => {
    remember('quantum.homeScreenHint', 'dismissed');
    setShown(false);
  };
  return (
    <div className="home-hint" role="note">
      <div className="home-hint-body">
        <strong>Play full screen</strong>
        <span className="home-hint-steps">
          <span className="home-hint-step">
            <svg width="13" height="15" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 1v9M4 4l3-3 3 3M4.5 7H2.5v8h9V7h-2" />
            </svg>
            Share
          </span>
          <span aria-hidden="true">→</span>
          <span className="home-hint-step">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <rect x="1" y="1" width="12" height="12" rx="3" />
              <path d="M7 4v6M4 7h6" />
            </svg>
            Add to Home Screen
          </span>
        </span>
      </div>
      <button className="icon-btn" aria-label="Dismiss" title="Dismiss" onClick={dismiss}>
        <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}

const UPDATE_LABEL: Record<UpdateStatus, string | null> = {
  off: null,
  idle: 'Check for updates',
  checking: 'Checking…',
  current: 'Up to date',
  updating: 'Updating…',
  ready: 'Update now',
  offline: 'Offline',
  failed: 'Couldn’t check',
};

/** Which build this is, so a phone can tell whether the latest deploy has arrived, and a way to fetch it. */
function VersionLine() {
  const status = useUpdateStatus();
  const label = UPDATE_LABEL[status];
  const when = BUILD.time.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <p className="version">
      Version {BUILD.id} · {when}
      {label && (
        <button disabled={status === 'checking' || status === 'updating'} onClick={checkForUpdate}>
          {label}
        </button>
      )}
    </p>
  );
}
