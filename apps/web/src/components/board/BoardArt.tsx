import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '@quantum/engine';
import { CUBE_PAD, PLANET_DIAMETER, PLANET_FAMILY, TILE, cubePadCentres } from '@quantum/art';
import { tileImage } from '../../art/tileImages';
import { tileArt, wrapMarks, type WrapMark } from './geometry';

/** Which way each board edge faces, for the wrap chevrons. */
const WRAP_SIDE: Record<WrapMark['side'], { angle: number; r: number; c: number }> = {
  right: { angle: 0, r: 0, c: 1 },
  bottom: { angle: 90, r: 1, c: 0 },
  left: { angle: 180, r: 0, c: -1 },
  top: { angle: 270, r: -1, c: 0 },
};

/** Tile artwork by physical tile id, filled in as each image is ready (a plain tile shows meanwhile). */
function useTileImages(game: GameState) {
  const tiles = useMemo(() => tileArt(game.board), [game.board.mapId]);
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    for (const t of tiles) tileImage(t.id).then((url) => live && setImages((m) => (m[t.id] === url ? m : { ...m, [t.id]: url })));
    return () => {
      live = false;
    };
  }, [tiles]);
  return { tiles, images };
}

/** The map drawn in SVG: tile art, spaces, warp gates, and each planet's number and cube slots. */
export function BoardArt({ game, cell }: { game: GameState; cell: number }) {
  const { rows, cols, cells, planets } = game.board;
  const { tiles, images } = useTileImages(game);
  const W = cols * cell;
  const H = rows * cell;
  return (
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

      {/* Chevrons on edges that join the opposite edge, pointing off the board. */}
      {wrapMarks(game.board).map((m) => {
        const { angle, r, c } = WRAP_SIDE[m.side];
        const x = (m.c + 0.5 + c * 0.42) * cell;
        const y = (m.r + 0.5 + r * 0.42) * cell;
        const s = cell * 0.09;
        return (
          <path
            key={`w${m.side}${m.r},${m.c}`}
            className="wrap-mark"
            d={`M${-s} ${-s * 1.6} L${s} 0 L${-s} ${s * 1.6}`}
            transform={`translate(${x} ${y}) rotate(${angle})`}
            fill="none"
            stroke="#7fb2ff"
            strokeOpacity={0.7}
            strokeWidth={Math.max(1.5, cell * 0.04)}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>This edge joins the opposite edge</title>
          </path>
        );
      })}

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
  );
}
