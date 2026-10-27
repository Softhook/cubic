// The parts of the lobby's new-game form.

import { type CSSProperties, type ReactNode } from 'react';
import { AI_LEVELS, DEFAULT_AI_LEVEL } from '@cubic/ai';
import { parseToken, type MapDef, type PlayerConfig } from '@cubic/engine';
import { Segmented } from '../Segmented';
import { remember } from '../../storage';
import { pick } from '../../random';
import { AI_LEVEL_KEY, isFriendSeat } from './choices';

const MAP_GROUPS: { id: string; name: string }[] = [
  { id: 'basic', name: 'Basic' },
  { id: 'advanced', name: 'Advanced' },
  { id: 'addon', name: 'Add-on pack' },
  { id: 'bga', name: 'Board Game Arena' },
  { id: 'ce', name: 'Community Edition' },
];

/** A tile of the preview: its number, a start's ring, or nothing for a gap. */
function MiniTile({ token }: { token: string }) {
  if (token === '.') return <span className="mini-tile gap" />;
  const { number: n, start } = parseToken(token);
  return <span className={`mini-tile n${n} ${start ? 'start' : ''}`}>{n === 0 ? '' : n}</span>;
}

function MiniMap({ map }: { map: MapDef }) {
  const cols = Math.max(...map.layout.map((r) => r.length));
  const size = Math.min(26, Math.floor(150 / Math.max(cols, map.layout.length)));
  return (
    <div className="mini-map" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)`, '--tile': `${size}px` } as CSSProperties}>
      {map.layout.flatMap((row, r) => Array.from({ length: cols }, (_, c) => <MiniTile key={`${r},${c}`} token={row[c] ?? '.'} />))}
    </div>
  );
}

/** A labelled row of the new-game form, with an optional line of explanation under it. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
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

/** One player seat: name, who plays it, and the AI level when an AI does. */
export function SeatRow({
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
export function MapPicker({ map, choices, onChoose }: { map: MapDef; choices: MapDef[]; onChoose: (id: string) => void }) {
  const chooseRandom = () => {
    const others = choices.filter((m) => m.id !== map.id);
    if (others.length) onChoose(pick(others).id);
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
