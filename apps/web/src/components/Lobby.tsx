import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { AI_LEVELS, DEFAULT_AI_LEVEL } from '@quantum/ai';
import {
  defaultMap,
  MAPS,
  MODES,
  playerCounts,
  rulesOf,
  RULESETS,
  type GameMode,
  type GameState,
  type MapDef,
  type PlayerConfig,
} from '@quantum/engine';
import { LobbyBackdrop } from './LobbyBackdrop';
import { Segmented } from './Segmented';
import { Confirm } from './Dialog';
import { FullscreenButton } from './FullscreenButton';
import { holdForTitle } from '../ambience';
import { OPENS_FULLSCREEN, fullscreenWaiting, resumeFullscreen } from '../fullscreen';
import { forgetFinishedGames, forgetGame, onlineGames } from '../online/games';
import { defaultSeat } from '../game/seats';
import { clearSavedGame, loadSavedGame } from '../game/savedGame';
import { remember, stored } from '../storage';
import { APPLE_TOUCH, FROM_HOME_SCREEN } from '../platform';
import { BUILD, checkForUpdate, useUpdateStatus, type UpdateStatus } from '../pwa';
import { PLAYER_COLORS } from '../theme';
import { COARSE, reducedMotion } from '../game/useMediaQuery';

const PLAYER_COUNTS = [...new Set(MAPS.map((m) => m.players))];

/** What the lobby remembers between visits: the last choices, and a dismissed hint. */
const AI_LEVEL_KEY = 'quantum.aiLevel';
const MODE_KEY = 'quantum.mode';
const mapKey = (players: number) => `quantum.map.${players}`;
const HOME_HINT_KEY = 'quantum.homeScreenHint';

/**
 * The opening, once per page load: how long the title holds in the middle (unless it waits for a click), and how long
 * it takes to rise.
 */
const INTRO_HOLD_MS = 2600;
const INTRO_RISE_MS = 1300;
let introPlayed = false;

/**
 * The lobby's opening: the title alone over the backdrop, in the middle of the screen, then rising to its place
 * as the rest fades in. Only on the first visit of a page load (not back from a game), never under reduced
 * motion; a click (or tap) or key skips it. Where that click goes full screen (a phone, the app installed on a
 * computer), the title waits for it, asking after a while, and holds, centred in the new size, until the window
 * has settled: the lobby then comes in full screen. The app installed on Android, already full screen, waits for
 * it too, so it opens the same way. Returns the phase (null once done), whether it waits for a click and has had
 * it, and the offset that centres the title.
 */
function useIntro(title: RefObject<HTMLHeadingElement | null>) {
  const [phase, setPhase] = useState<'title' | 'rise' | null>(() => (introPlayed || reducedMotion() ? null : 'title'));
  const [waits] = useState(() => OPENS_FULLSCREEN || fullscreenWaiting());
  const [started, setStarted] = useState(false);
  const [offset, setOffset] = useState(0);
  const shown = useRef(0);
  useLayoutEffect(() => {
    shown.current = offset;
  }, [offset]);
  useLayoutEffect(() => {
    if (phase !== 'title' || !title.current) return;
    const h1 = title.current;
    // Measured with the offset on screen (the scale is about its centre), so a new window size re-centres it.
    const centre = () => {
      const r = h1.getBoundingClientRect();
      setOffset(shown.current + innerHeight / 2 - (r.top + r.height / 2));
    };
    centre();
    addEventListener('resize', centre);
    return () => removeEventListener('resize', centre);
  }, [phase, title]);
  useEffect(() => {
    if (!phase) return;
    introPlayed = true;
    // The music waits under the title and opens as it rises.
    const titleGone = phase === 'title' ? holdForTitle() : undefined;
    const next = phase === 'title' ? 'rise' : null;
    let live = true;
    const t = phase === 'title' && waits ? undefined : setTimeout(() => setPhase(next), phase === 'title' ? INTRO_HOLD_MS : INTRO_RISE_MS);
    const unlisten = () => {
      removeEventListener('click', skip);
      removeEventListener('keydown', skip);
    };
    const skip = (e: Event) => {
      setStarted(true);
      // Where this goes full screen, the title waits for the window to settle.
      const settling = phase === 'title' ? resumeFullscreen(e) : null;
      if (!settling) return setPhase(next);
      clearTimeout(t);
      unlisten();
      void settling.then(() => live && setPhase('rise'));
    };
    // On a click rather than a press: a phone only allows full screen once the finger lifts.
    addEventListener('click', skip);
    addEventListener('keydown', skip);
    return () => {
      live = false;
      clearTimeout(t);
      unlisten();
      titleGone?.();
    };
  }, [phase, waits]);
  return { phase, waits, started, offset };
}

export interface LobbyResult {
  players: PlayerConfig[];
  mapId: string;
  mode: GameMode;
  /** Played online: the human seats other than the first are for friends to claim. */
  online?: boolean;
}

function storedAiLevel(): number {
  const n = Number(stored(AI_LEVEL_KEY));
  return AI_LEVELS.some((l) => l.level === n) ? n : DEFAULT_AI_LEVEL;
}

function storedMode(): GameMode {
  const saved = stored(MODE_KEY);
  return MODES.find((m) => m.id === saved || (saved === 'cubic' && m.id === 'prototyping'))?.id ?? 'community';
}

function storedMap(players: number): string {
  const id = stored(mapKey(players));
  return MAPS.find((m) => m.id === id && m.players === players)?.id ?? defaultMap(players)!.id;
}

/** A mode's name for the rules picker: the long one is cut short on a phone, so the four fit across. */
function modeLabel(id: GameMode, name: string): ReactNode {
  if (id !== 'prototyping') return name;
  return (
    <>
      <span className="wide-only">{name}</span>
      <span className="narrow-only">Proto</span>
    </>
  );
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

/** Where a game is played: on this device (a tablet) or online (a globe). */
function WhereIcon({ online }: { online: boolean }) {
  return (
    <svg
      className="where-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {online ? (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M1.5 8h13M8 1.5c-2.2 2.4-2.2 10.6 0 13M8 1.5c2.2 2.4 2.2 10.6 0 13" />
        </>
      ) : (
        <>
          <rect x="3" y="1.5" width="10" height="13" rx="2" />
          <path d="M7 12h2" />
        </>
      )}
    </svg>
  );
}

/** One game to pick up: opened by its link (online) or a click (this device), and removable. */
function GameRow({
  title,
  meta,
  online,
  yourMove,
  checking,
  href,
  onOpen,
  onRemove,
  removeLabel,
}: {
  title: string;
  meta: string;
  online: boolean;
  yourMove?: boolean;
  /** Still asking the relays whether there have been moves since. */
  checking?: boolean;
  href?: string;
  onOpen?: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const body = (
    <>
      <WhereIcon online={online} />
      <span className="game-row-text">
        <strong>{title}</strong>
        <span className="muted">{meta}</span>
      </span>
    </>
  );
  return (
    <li className={yourMove ? 'my-turn' : ''}>
      {href ? (
        <a className="game-row-open" href={href}>
          {body}
        </a>
      ) : (
        <button className="game-row-open" onClick={onOpen}>
          {body}
        </button>
      )}
      {checking && <span className="spinner" role="status" aria-label="Checking for new moves" title="Checking for new moves" />}
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
  // The list holds how each game stood when this browser last had it open: follow the unfinished
  // ones on the relays, so a move made since then shows (the online code loads for it, if there are any).
  // Those listed when the lobby opens: games added later are opened from here anyway.
  const [watched] = useState(() => onlineGames().filter((g) => !g.over));
  // The games still being checked on the relays, each until one has answered.
  const [checking, setChecking] = useState(() => new Set(watched.map((g) => g.secret)));
  /** The game being asked about before it's removed: the one on this device, or an online one. */
  const [removing, setRemoving] = useState<{ saved: true } | { secret: string } | null>(null);
  const forget = (secret: string) => {
    setRemoving(null);
    forgetGame(secret);
    setGames(onlineGames());
  };
  useEffect(() => {
    if (!watched.length) return;
    let stop: (() => void) | undefined;
    let gone = false;
    const checked = (secret: string) =>
      setChecking((c) => {
        const next = new Set(c);
        next.delete(secret);
        return next;
      });
    import('../online/watch')
      .then(({ watchGames }) => {
        if (!gone) stop = watchGames(watched, () => setGames(onlineGames()), checked);
      })
      .catch(() => setChecking(new Set()));
    return () => {
      gone = true;
      stop?.();
    };
  }, [watched]);
  if (!saved && !games.length) return null;
  const online = [...games].sort((a, b) => Number(!!b.myTurn) - Number(!!a.myTurn));
  return (
    <div className="lobby-card your-games">
      <h2>Your games</h2>
      <ul>
        {saved && (
          <GameRow
            title={saved.players.map((p) => p.name).join(', ')}
            meta={[
              'On this device',
              rulesOf(saved).name,
              saved.board.mapName,
              saved.phase === 'setup' ? 'Setting up' : `Turn ${saved.turn.number}`,
            ].join(' · ')}
            online={false}
            onOpen={onResume}
            removeLabel="Discard this game"
            onRemove={() => setRemoving({ saved: true })}
          />
        )}
        {online.map((g) => (
          <GameRow
            key={g.secret}
            title={g.players?.join(', ') ?? 'New game'}
            meta={['Online', g.mode, g.map, g.status].filter(Boolean).join(' · ')}
            online
            yourMove={g.myTurn}
            checking={checking.has(g.secret)}
            href={`#online/${g.secret}`}
            removeLabel="Remove from this browser"
            onRemove={() => (g.over ? forget(g.secret) : setRemoving({ secret: g.secret }))}
          />
        ))}
      </ul>
      {removing && 'saved' in removing ? (
        <Confirm
          title="Discard this game?"
          message="The game on this device is gone for good."
          yes="Discard"
          onYes={() => {
            setRemoving(null);
            onDiscard();
          }}
          onNo={() => setRemoving(null)}
        />
      ) : removing ? (
        <Confirm
          title="Remove this game?"
          message="It goes from this browser. The others can go on playing; you can rejoin with the link."
          yes="Remove"
          onYes={() => forget(removing.secret)}
          onNo={() => setRemoving(null)}
        />
      ) : null}
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
        <div role="group" aria-labelledby={id}>
          {children}
        </div>
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
        <Segmented
          small
          options={[
            [false, online ? 'Friend' : 'Human'],
            [true, 'AI'],
          ]}
          value={!!seat.ai}
          onPick={(ai) => onChange({ ai })}
        />
      )}
      {seat.ai && (
        <select
          className="ai-level"
          value={aiLevel}
          aria-label={`${label} AI level`}
          title={AI_LEVELS.find((l) => l.level === aiLevel)?.summary}
          onChange={(e) => {
            onChange({ aiLevel: Number(e.target.value) });
            remember(AI_LEVEL_KEY, e.target.value);
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
    if (!others.length) return;
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
          <button className="btn btn-icon" title="Random map" aria-label="Random map" disabled={choices.length < 2} onClick={chooseRandom}>
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
  const title = useRef<HTMLHeadingElement>(null);
  const intro = useIntro(title);
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
    return {
      local: PLAYER_COLORS.map((_, i) => defaultSeat(i, i !== 0, aiLevel)),
      online: PLAYER_COLORS.map((_, i) => defaultSeat(i, false, aiLevel)),
    };
  });
  const where = online ? 'online' : 'local';
  const seats = seatSets[where];
  const [mapIds, setMapIds] = useState<Record<number, string>>(() => Object.fromEntries(PLAYER_COUNTS.map((n) => [n, storedMap(n)])));
  const choices = MAPS.filter((m) => m.players === count && RULESETS[mode].mapGroups.includes(m.group));
  // A remembered map the chosen rules don't use falls back to the basic map (it stays remembered).
  const map = choices.find((m) => m.id === mapIds[count]) ?? defaultMap(count)!;

  const chooseMode = (id: GameMode) => {
    setMode(id);
    remember(MODE_KEY, id);
  };
  const chooseMap = (id: string) => {
    setMapIds((ids) => ({ ...ids, [count]: id }));
    remember(mapKey(count), id);
  };
  const updateSeat = (i: number, patch: Partial<PlayerConfig>) =>
    setSeatSets((sets) => ({ ...sets, [where]: sets[where].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  // Online, the first seat is yours; human seats after it are for friends.
  const playing = seats.slice(0, count);
  const friendSeats = playing.filter((s, i) => isFriendSeat(s, i, online)).length;
  const canStart = !online || friendSeats > 0;

  // Starting a new game here discards the one in progress on this device: asked first.
  const [confirmingNew, setConfirmingNew] = useState(false);
  const start = () => {
    setConfirmingNew(false);
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
    <div
      className={`lobby${intro.phase ? ` intro-${intro.phase}` : ''}`}
      style={{ '--intro-y': `${intro.offset}px`, '--intro-rise': `${INTRO_RISE_MS}ms` } as CSSProperties}
    >
      <LobbyBackdrop map={map} />
      <div className="lobby-hero">
        <h1 ref={title}>Cubic</h1>
        {intro.phase && intro.waits && (
          <p className={`intro-prompt${intro.started ? ' gone' : ''}`}>{matchMedia(COARSE).matches ? 'Tap' : 'Click'} to start</p>
        )}
      </div>
      <div className="lobby-corner">
        <FullscreenButton />
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
            <Segmented
              options={[
                [
                  false,
                  <>
                    <WhereIcon online={false} />
                    On this device
                  </>,
                ],
                [
                  true,
                  <>
                    <WhereIcon online />
                    <span className="wide-only">Online with friends</span>
                    <span className="narrow-only">Online</span>
                  </>,
                ],
              ]}
              value={online}
              onPick={setOnline}
            />
          </Field>

          <Field label="Rules" hint={RULESETS[mode].summary}>
            <Segmented options={MODES.map((m) => [m.id, modeLabel(m.id, m.name)] as const)} value={mode} onPick={chooseMode} />
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
          <button
            className="btn btn-primary btn-lg"
            disabled={!canStart}
            onClick={() => (!online && saved ? setConfirmingNew(true) : start())}
          >
            {online ? 'Create online game' : 'Launch fleet'}
          </button>
        </div>
      </div>
      {confirmingNew && (
        <Confirm
          title="Start a new game?"
          message="The game in progress on this device is discarded."
          yes="Start new game"
          onYes={start}
          onNo={() => setConfirmingNew(false)}
        />
      )}
      <nav className="lobby-links">
        <button onClick={onRules}>How to play</button>
        <a href="#rulebook">Manual (PDF)</a>
        <a href="#lab/cards">Art Lab: cards &amp; tiles</a>
      </nav>
      <p className="credits">
        Cubic by Christian Nold is a reimagining of Quantum by Eric Zimmerman and its fan-made Community Edition. Non-commercial fan
        project.
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
  const [shown, setShown] = useState(() => APPLE_TOUCH && !FROM_HOME_SCREEN && !stored(HOME_HINT_KEY));
  if (!shown) return null;
  const dismiss = () => {
    remember(HOME_HINT_KEY, 'dismissed');
    setShown(false);
  };
  return (
    <div className="home-hint" role="note">
      <div className="home-hint-body">
        <strong>Play full screen</strong>
        <span className="home-hint-steps">
          <span className="home-hint-step">
            <svg
              width="13"
              height="15"
              viewBox="0 0 14 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 1v9M4 4l3-3 3 3M4.5 7H2.5v8h9V7h-2" />
            </svg>
            Share
          </span>
          <span aria-hidden="true">→</span>
          <span className="home-hint-step">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
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
