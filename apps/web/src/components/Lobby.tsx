import { useState, type CSSProperties } from 'react';
import { AI_LEVELS, DEFAULT_AI_LEVEL } from '@quantum/ai';
import { defaultMap, MAPS, MODES, RULESETS, type GameMode, type MapDef, type PlayerConfig } from '@quantum/engine';
import { Die3D } from './Die3D';

export const PLAYER_COLORS = ['#4cc9f0', '#f72585', '#ffb703', '#80ed99'];
const AI_NAMES = ['Nova', 'Vex', 'Orion', 'Lyra'];

export interface LobbyResult {
  players: PlayerConfig[];
  mapId: string;
  mode: GameMode;
}

function storedAiLevel(): number {
  try {
    const n = Number(localStorage.getItem('quantum.aiLevel'));
    if (AI_LEVELS.some((l) => l.level === n)) return n;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_AI_LEVEL;
}

function storedMode(): GameMode {
  try {
    const m = localStorage.getItem('quantum.mode');
    if (m === 'basic' || m === 'original' || m === 'community') return m;
  } catch {
    /* storage unavailable */
  }
  return 'community';
}

const MAP_GROUPS: { id: string; name: string }[] = [
  { id: 'basic', name: 'Basic' },
  { id: 'advanced', name: 'Advanced' },
  { id: 'addon', name: 'Add-on pack' },
  { id: 'bga', name: 'Board Game Arena' },
];

function storedMap(players: number): string {
  try {
    const id = localStorage.getItem(`quantum.map.${players}`);
    if (MAPS.some((m) => m.id === id && m.players === players)) return id!;
  } catch {
    /* storage unavailable */
  }
  return defaultMap(players)!.id;
}

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

export function Lobby({ onStart, onRules }: { onStart: (r: LobbyResult) => void; onRules: () => void }) {
  const [count, setCount] = useState(2);
  const [mode, setMode] = useState<GameMode>(storedMode);
  const [seats, setSeats] = useState<PlayerConfig[]>(() =>
    PLAYER_COLORS.map((color, i) => ({ name: i === 0 ? 'Commander' : AI_NAMES[i], color, ai: i !== 0, aiLevel: storedAiLevel() })),
  );
  const [mapIds, setMapIds] = useState<Record<number, string>>(() => ({ 2: storedMap(2), 3: storedMap(3), 4: storedMap(4) }));
  const choices = MAPS.filter((m) => m.players === count && RULESETS[mode].mapGroups.includes(m.group));
  // A remembered map the chosen rules don't use falls back to the basic map (it stays remembered).
  const map = choices.find((m) => m.id === mapIds[count]) ?? defaultMap(count)!;

  const chooseMap = (id: string) => {
    setMapIds((ids) => ({ ...ids, [count]: id }));
    try {
      localStorage.setItem(`quantum.map.${count}`, id);
    } catch {
      /* ignore */
    }
  };

  const update = (i: number, patch: Partial<PlayerConfig>) =>
    setSeats((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

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

      <div className="lobby-card">
        <h2>New game</h2>
        <div className="modes" role="radiogroup" aria-label="Rules">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={m.id === mode}
              className={`mode ${m.id === mode ? 'on' : ''}`}
              onClick={() => {
                setMode(m.id);
                try {
                  localStorage.setItem('quantum.mode', m.id);
                } catch {
                  /* ignore */
                }
              }}
            >
              <strong>{m.name}</strong>
              <span>{m.summary}</span>
            </button>
          ))}
        </div>

        <label className="field">
          <span>Players</span>
          <div className="segmented">
            {[2, 3, 4].map((n) => (
              <button key={n} className={n === count ? 'on' : ''} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </label>

        <div className="seats">
          {seats.slice(0, count).map((s, i) => (
            <div className="seat" key={i} style={{ '--pc': s.color } as CSSProperties}>
              <span className="player-swatch" />
              <input value={s.name} maxLength={14} onChange={(e) => update(i, { name: e.target.value })} aria-label={`Player ${i + 1} name`} />
              <div className="segmented small">
                <button className={!s.ai ? 'on' : ''} onClick={() => update(i, { ai: false })}>Human</button>
                <button className={s.ai ? 'on' : ''} onClick={() => update(i, { ai: true })}>AI</button>
              </div>
              {s.ai && (
                <select
                  className="ai-level"
                  value={s.aiLevel ?? DEFAULT_AI_LEVEL}
                  aria-label={`Player ${i + 1} AI level`}
                  title={AI_LEVELS.find((l) => l.level === (s.aiLevel ?? DEFAULT_AI_LEVEL))?.summary}
                  onChange={(e) => {
                    const aiLevel = Number(e.target.value);
                    update(i, { aiLevel });
                    try {
                      localStorage.setItem('quantum.aiLevel', String(aiLevel));
                    } catch {
                      /* ignore */
                    }
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
          ))}
        </div>

        <div className="map-preview">
          <div className="map-info">
            <small>Map</small>
            <div className="map-select">
              <select value={map.id} aria-label="Map" onChange={(e) => chooseMap(e.target.value)}>
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
              <button
                className="btn btn-icon"
                title="Random map"
                aria-label="Random map"
                onClick={() => {
                  const others = choices.filter((m) => m.id !== map.id);
                  chooseMap(others[Math.floor(Math.random() * others.length)].id);
                }}
              >
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

        <div className="modal-actions">
          <button className="btn" onClick={onRules}>How to play</button>
          <button
            className="btn btn-primary btn-lg"
            onClick={() =>
              onStart({
                players: seats.slice(0, count).map((s, i) => ({ ...s, name: s.name.trim() || `Player ${i + 1}` })),
                mapId: map.id,
                mode,
              })
            }
          >
            Launch fleet
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
