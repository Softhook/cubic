import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { SHIP_ABILITIES, SHIP_NAMES, cellOf, key, type Board as BoardModel, type GameState } from '@quantum/engine';
import { CUBE_PAD, PLANET_DIAMETER, PLANET_FAMILY, TILE, assignTiles, cubePadCentres } from '@quantum/art';
import { tileImage } from '../art/tileImages';
import type { Controller } from '../game/controller';
import { Die3D } from './Die3D';

interface TileArt {
  r: number;
  c: number;
  void: boolean;
  /** The physical tile whose artwork (starfield and planet) goes here. */
  id: string;
}

/** Each 3×3 tile of the map, with the physical tile it uses (packages/art). */
function tileArt(board: BoardModel): TileArt[] {
  const tiles = new Map<number, { r: number; c: number; void: boolean; number: number }>();
  board.cells.forEach((row, r) =>
    row.forEach((x, c) => {
      if (x.kind === 'off' || tiles.has(x.tile)) return;
      tiles.set(x.tile, { r, c, void: !!x.void, number: 0 });
    }),
  );
  for (const p of board.planets) tiles.get(board.cells[p.r][p.c].tile)!.number = p.number;
  const ids = assignTiles([...tiles].map(([index, t]) => ({ index, number: t.number })));
  return [...tiles].map(([index, t]) => ({ ...t, id: ids.get(index)! }));
}

/** Where each ship on the map is drawn, in cell units (an attacker sits part-way into its target). */
function shipSpots(game: GameState): Map<string, { r: number; c: number }> {
  const head = game.pending[0];
  const combat = head?.kind === 'combat' ? head : null;
  const spots = new Map<string, { r: number; c: number }>();
  for (const d of game.dice) {
    const at = cellOf(d);
    if (!at) continue;
    let { r, c } = at;
    if (combat && combat.attacker.die === d.id) {
      r += (combat.at.r - combat.from.r) * 0.42;
      c += (combat.at.c - combat.from.c) * 0.42;
    }
    spots.set(d.id, { r, c });
  }
  return spots;
}

interface Explosion {
  id: string;
  r: number;
  c: number;
  color: string;
}

const EXPLOSION_MS = 1100;
const SPARKS = 10;

/** Ships knocked off the map by a battle or a card blow up where they stood. */
function useExplosions(game: GameState): Explosion[] {
  const [booms, setBooms] = useState<Explosion[]>([]);
  const prev = useRef(game);
  useEffect(() => {
    const before = prev.current;
    prev.current = game;
    const lastId = before.log.at(-1)?.id ?? 0;
    // Only fresh destruction events count: undo and reset also move ships, but never add log entries.
    const destroyed = game.log.some((e) => e.id > lastId && (e.event === 'battleWon' || e.event === 'shipDestroyed'));
    if (!destroyed) return;
    const spots = shipSpots(before);
    const fresh: Explosion[] = [];
    for (const d of game.dice) {
      const was = spots.get(d.id);
      if (!was || d.loc.zone !== 'scrapyard') continue;
      fresh.push({ id: `${d.id}:${d.rolls}`, ...was, color: game.players[d.owner].color });
    }
    if (!fresh.length) return;
    setBooms((b) => [...b, ...fresh]);
    window.setTimeout(() => setBooms((b) => b.filter((x) => !fresh.includes(x))), EXPLOSION_MS);
  }, [game]);
  return booms;
}

export function Board({ game, ctl }: { game: GameState; ctl: Controller }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(64);
  const booms = useExplosions(game);
  const { rows, cols, cells, planets } = game.board;
  const tiles = useMemo(() => tileArt(game.board), [game.board.mapId]);
  // Tile images arrive as they're ready (at once, once they've been drawn before); a plain tile shows meanwhile.
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    for (const t of tiles) tileImage(t.id).then((url) => live && setImages((m) => (m[t.id] === url ? m : { ...m, [t.id]: url })));
    return () => {
      live = false;
    };
  }, [tiles]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const size = Math.floor(Math.min(width / cols, height / rows));
      setCell(Math.max(34, Math.min(92, size)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows, cols]);

  const W = cols * cell;
  const H = rows * cell;
  const head = game.pending[0];
  const combat = head?.kind === 'combat' ? head : null;
  const me = game.turn.player;
  const spots = shipSpots(game);

  const onBoardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    ctl.onCell({ r: Math.floor((e.clientY - rect.top) / cell), c: Math.floor((e.clientX - rect.left) / cell) });
  };

  return (
    <div className="board-wrap" ref={wrap}>
      <div className="board" style={{ width: W, height: H, '--cell': `${cell}px` } as CSSProperties}>
        <svg className="board-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={cell * 0.08} />
            </filter>
          </defs>

          {tiles.map((t) => (
            <g key={`${t.r},${t.c}`}>
              {images[t.id] && <image href={images[t.id]} x={t.c * cell + 1} y={t.r * cell + 1} width={cell * 3 - 2} height={cell * 3 - 2} />}
              <rect
                x={t.c * cell + 1}
                y={t.r * cell + 1}
                width={cell * 3 - 2}
                height={cell * 3 - 2}
                rx={(cell * 3 * 4) / TILE.size}
                fill={images[t.id] ? 'none' : '#0b1124'}
                stroke={t.void ? 'rgba(197,155,255,.35)' : 'rgba(127,178,255,.16)'}
              />
            </g>
          ))}

          {cells.flatMap((row, r) =>
            row.map((x, c) =>
              x.kind === 'space' ? (
                <rect
                  key={`s${r},${c}`}
                  x={c * cell + cell * 0.12}
                  y={r * cell + cell * 0.12}
                  width={cell * 0.76}
                  height={cell * 0.76}
                  rx={cell * 0.16}
                  fill="rgba(255,255,255,.018)"
                  stroke="rgba(160,190,255,.07)"
                />
              ) : null,
            ),
          )}

          {game.gates.map((g, i) => (
            <g key={i} transform={`translate(${(g.c + 0.5) * cell} ${(g.r + 0.5) * cell})`}>
              <circle r={cell * 0.4} fill="none" stroke="#5ef0b0" strokeWidth={3} filter="url(#glow)" />
              <circle r={cell * 0.36} fill="none" stroke="#5ef0b0" strokeWidth={1.5} strokeDasharray="4 4" className="gate-spin" />
            </g>
          ))}

          {planets.map((p) => {
            const cx = (p.c + 0.5) * cell;
            const cy = (p.r + 0.5) * cell;
            // The planet itself is part of the tile art; this layer adds the live number and cubes.
            const R = (PLANET_DIAMETER[p.number] / 2 / TILE.cell) * cell;
            // Cube slots in the printed pads' pattern, centred, but sized for the screen.
            const slot = cell * 0.15;
            const step = (slot + cell * 0.035) / (CUBE_PAD.size + CUBE_PAD.gap);
            const slots = cubePadCentres(p.capacity, 0, 0).map((q) => ({ x: cx + q.x * step, y: cy + q.y * step }));
            // The number is drawn on the planet towards its bottom right, as on the printed tile, clear of the cubes.
            const off = R * 0.55;
            const hue = PLANET_FAMILY[p.number].hue;
            return (
              <g key={p.id}>
                {p.start && game.phase === 'setup' && (
                  <circle cx={cx} cy={cy} r={R * 1.12} fill="none" stroke="#fff" strokeOpacity={0.5} strokeDasharray="3 4" />
                )}
                <text
                  x={cx + off}
                  y={cy + off + cell * 0.015}
                  className="planet-num"
                  fontSize={cell * (p.number === 10 ? 0.32 : 0.38)}
                  stroke={`hsl(${hue} 50% 7%)`}
                  strokeWidth={cell * 0.045}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {p.number}
                </text>
                {slots.map((q, i) => {
                  const owner = p.cubes[i];
                  return (
                    <rect
                      key={i}
                      x={q.x - slot / 2}
                      y={q.y - slot / 2}
                      width={slot}
                      height={slot}
                      rx={slot * 0.2}
                      fill={owner === undefined ? 'rgba(0,0,0,.35)' : game.players[owner].color}
                      stroke={owner === undefined ? 'rgba(255,255,255,.45)' : '#fff'}
                      strokeWidth={owner === undefined ? 1 : 1.2}
                      className={owner === undefined ? '' : 'cube'}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        <div className="board-layer" onClick={onBoardClick}>
          {[...ctl.highlights.cells.values()].map(({ cell: c, tone }) => (
            <button
              key={key(c)}
              className={`hl hl-${tone}`}
              style={{ left: c.c * cell, top: c.r * cell, width: cell, height: cell }}
              onClick={() => ctl.onCell(c)}
              aria-label={`${tone} ${c.r},${c.c}`}
            >
              <span />
            </button>
          ))}

          {planets.map((p) => {
            const hl = ctl.highlights.planets.get(p.id);
            const free = p.capacity - p.cubes.length;
            return (
              <button
                key={p.id}
                className={`planet-hit ${hl ? `planet-${hl.tone}` : ''}`}
                style={{ left: p.c * cell, top: p.r * cell, width: cell, height: cell }}
                onClick={() => ctl.onPlanet(p.id)}
                title={`Planet ${p.number} · ${free} of ${p.capacity} cube location${p.capacity > 1 ? 's' : ''} free`}
              >
                {hl && <span className="planet-label">{hl.label}</span>}
              </button>
            );
          })}

          {game.dice.map((d) => {
            const at = spots.get(d.id);
            if (!at) return null;
            const { r, c } = at;
            const tone = ctl.highlights.dice.get(d.id);
            const selected = 'die' in ctl.sel && ctl.sel.die === d.id;
            const mine = d.owner === me && game.phase === 'play' && !head;
            const spent = mine && (game.turn.moved[d.id] ?? 0) > 0;
            const abilityUsed = mine && game.turn.abilityUsed[d.id];
            const fighting = combat && (combat.attacker.die === d.id || combat.defender.die === d.id);
            return (
              <div
                key={d.id}
                className={[
                  'ship',
                  selected && 'selected',
                  tone && `ship-${tone}`,
                  spent && 'spent',
                  fighting && 'fighting',
                  ctl.actionPhase && d.owner === me && 'own',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ transform: `translate(${c * cell}px, ${r * cell}px)`, width: cell, height: cell, '--pc': game.players[d.owner].color } as CSSProperties}
                onClick={() => ctl.onDie(d.id)}
                title={`${game.players[d.owner].name} · ${SHIP_NAMES[d.value]} (${d.value})\n${SHIP_ABILITIES[d.value].name}: ${SHIP_ABILITIES[d.value].text}`}
              >
                <div className="ship-ring" />
                <Die3D value={d.value} rolls={d.rolls} size={cell * 0.56} color={game.players[d.owner].color} />
                {abilityUsed && <span className="ship-badge" title="Ability used this turn">✦</span>}
              </div>
            );
          })}

          {booms.map((b) => (
            <div
              key={b.id}
              className="explosion"
              style={{ transform: `translate(${b.c * cell}px, ${b.r * cell}px)`, width: cell, height: cell, '--pc': b.color } as CSSProperties}
              aria-hidden
            >
              <span className="boom-flash" />
              <span className="boom-wave" />
              <span className="boom-wave late" />
              {Array.from({ length: SPARKS }, (_, i) => (
                <span key={i} className="boom-spark" style={{ '--a': `${(360 / SPARKS) * i + (i % 2) * 14}deg`, '--d': `${0.55 + (i % 3) * 0.18}` } as CSSProperties} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
