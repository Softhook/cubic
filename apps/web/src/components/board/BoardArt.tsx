import { memo, useEffect, useMemo, useState } from 'react';
import type { GameState } from '@quantum/engine';
import { PLANET_DIAMETER, TILE } from '@quantum/art';
import { tileImage } from '../../art/tileImages';
import { tileArt } from '../../art/boardTiles';
import { wrapMarks, type WrapMark } from './geometry';
import { PlanetMarkings } from './PlanetMarkings';

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

/**
 * The map drawn in SVG: tile art, spaces, warp gates, and each planet's number and cube slots. Memoised:
 * a pan moves the board, not what's drawn on it.
 */
export const BoardArt = memo(function BoardArt({ game, cell }: { game: GameState; cell: number }) {
  const { rows, cols, cells, planets } = game.board;
  const { tiles, images } = useTileImages(game);
  const W = cols * cell;
  const H = rows * cell;
  // Print millimetres to screen pixels: the tile art and everything drawn over it use the printed geometry.
  const mm = cell / TILE.cell;
  return (
    <>
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
              rx={(cell * 3 * TILE.corner) / TILE.size}
              fill={images[t.id] ? 'none' : '#0b1124'}
              stroke={t.void ? 'rgba(197,155,255,.35)' : 'rgba(127,178,255,.16)'}
            />
          </g>
        ))}

        {/* The space pads are part of the tile art; until a tile's image is ready, plain ones stand in. */}
        {tiles
          .filter((t) => !images[t.id])
          .flatMap((t) => [0, 1, 2].flatMap((dr) => [0, 1, 2].map((dc) => ({ r: t.r + dr, c: t.c + dc }))))
          .filter(({ r, c }) => cells[r]?.[c]?.kind === 'space')
          .map(({ r, c }) => (
            <rect
              key={`s${r},${c}`}
              x={(c + 0.5) * cell - (TILE.pad / 2) * mm}
              y={(r + 0.5) * cell - (TILE.pad / 2) * mm}
              width={TILE.pad * mm}
              height={TILE.pad * mm}
              rx={4 * mm}
              fill="rgba(255,255,255,.03)"
              stroke="rgba(160,190,255,.2)"
            />
          ))}

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
          </g>
        ))}

        {planets.map((p) => {
          const cx = (p.c + 0.5) * cell;
          const cy = (p.r + 0.5) * cell;
          // The planet itself is part of the tile art; this layer adds the live number and cubes, placed
          // and sized as on the printed tile.
          const R = (PLANET_DIAMETER[p.number] / 2) * mm;
          return (
            <g key={p.id}>
              {p.start && game.phase === 'setup' && (
                <circle cx={cx} cy={cy} r={R * 1.12} fill="none" stroke="#fff" strokeOpacity={0.5} strokeDasharray="3 4" />
              )}
              <PlanetMarkings
                cx={cx}
                cy={cy}
                mm={mm}
                n={p.number}
                capacity={p.capacity}
                cubes={p.cubes.map((o) => game.players[o].color)}
                numberClass="planet-num"
                cubeClass="cube"
              />
            </g>
          );
        })}
      </svg>
      {/* Each gate's turning ring is its own element over the map, so turning it doesn't repaint the map. */}
      {game.gates.map((g, i) => (
        <svg key={i} className="gate-spin" style={{ left: g.c * cell, top: g.r * cell }} width={cell} height={cell} viewBox={`0 0 ${cell} ${cell}`}>
          <circle cx={cell / 2} cy={cell / 2} r={cell * 0.36} fill="none" stroke="#5ef0b0" strokeWidth={1.5} strokeDasharray="4 4" />
        </svg>
      ))}
    </>
  );
});
