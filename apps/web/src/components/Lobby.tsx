import { useState, type CSSProperties } from 'react';
import { AI_LEVELS, DEFAULT_AI_LEVEL } from '@quantum/ai';
import { defaultMap, MODES, type GameMode, type PlayerConfig } from '@quantum/engine';
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

export function Lobby({ onStart, onRules }: { onStart: (r: LobbyResult) => void; onRules: () => void }) {
  const [count, setCount] = useState(2);
  const [mode, setMode] = useState<GameMode>(storedMode);
  const [seats, setSeats] = useState<PlayerConfig[]>(() =>
    PLAYER_COLORS.map((color, i) => ({ name: i === 0 ? 'Commander' : AI_NAMES[i], color, ai: i !== 0, aiLevel: storedAiLevel() })),
  );
  const map = defaultMap(count)!;

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
        <h1>Quantum</h1>
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
          <div>
            <small>Map</small>
            <strong>{map.name}</strong>
            <span className="muted">{map.cubes} cubes each · {map.stats.shared}/{map.stats.planets} planets shared</span>
          </div>
          <div className="mini-map" style={{ gridTemplateColumns: `repeat(${map.layout[0].length}, 1fr)` } as CSSProperties}>
            {map.layout.flat().map((t, i) => (
              <span key={i} className={`mini-tile n${t.replace('*', '')} ${t.endsWith('*') ? 'start' : ''}`}>
                {t.replace('*', '')}
              </span>
            ))}
          </div>
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
      <p className="credits">
        Based on Quantum by Eric Zimmerman and the fan-made Community Edition. Non-commercial fan project.
      </p>
    </div>
  );
}
