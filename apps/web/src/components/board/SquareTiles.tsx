import type { Board } from '@quantum/engine';
import { SPACE_BASE_CSS, TILE } from '@quantum/art';
import { useTileImages } from '../../art/tileImages';
import type { TileArt } from '../../art/boardTiles';

/**
 * A square map's 3×3 tiles in SVG, each its printed artwork with the space pads (a plain tile with plain
 * pads shows until the image is ready). `tiles` are centred on their middle space.
 */
export function SquareTiles({ board, tiles, cell }: { board: Board; tiles: TileArt[]; cell: number }) {
  const images = useTileImages(tiles);
  // Print millimetres to screen pixels.
  const mm = cell / TILE.cell;
  // Gap between neighbouring tiles, scaled with the cell so zooming doesn't change the look.
  const inset = cell * 0.015;
  const tileBox = (t: TileArt) => ({
    x: (t.c - 1) * cell + inset,
    y: (t.r - 1) * cell + inset,
    width: cell * 3 - 2 * inset,
    height: cell * 3 - 2 * inset,
  });
  return (
    <>
      {tiles.map((t) => (
        <g key={`${t.r},${t.c}`}>
          {images[t.id] ? (
            <image href={images[t.id]} {...tileBox(t)} />
          ) : (
            <rect {...tileBox(t)} rx={(cell * 3 * TILE.corner) / TILE.size} fill={SPACE_BASE_CSS} />
          )}
        </g>
      ))}

      {/* The space pads are part of the tile art; until a tile's image is ready, plain ones stand in. */}
      {tiles
        .filter((t) => !images[t.id])
        .flatMap((t) => [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => ({ r: t.r + dr, c: t.c + dc }))))
        .filter(({ r, c }) => board.cells[r]?.[c]?.kind === 'space')
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
    </>
  );
}
