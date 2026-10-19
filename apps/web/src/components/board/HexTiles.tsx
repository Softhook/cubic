import { cellAt, type Board, type Cell } from '@quantum/engine';
import { SPACE_BASE_CSS, TILE, WELL } from '@quantum/art';
import { useTileImages } from '../../art/tileImages';
import type { TileArt } from '../../art/boardTiles';
import { hexCorners, hexFlower, hexSeams, placement } from './geometry';

/** A space's well, as a part of its hex (a square's pad is 24 of its 32 mm). */
const WELL_SCALE = 0.8;

const points = (list: number[][]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const line = (list: number[][]) => `M${list.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L')}`;

/**
 * A hex map's tiles in SVG: each 7-hex flower cut from its tile's painting (centred on the planet, as
 * printed), a dark seam where tiles meet, and a well etched for each space, as the square tiles have.
 * `tiles` are the tiles' planets (or a void tile's middle hex).
 */
export function HexTiles({ board, tiles, cell }: { board: Board; tiles: TileArt[]; cell: number }) {
  // Only the painting: the flower is cut from it and draws its own spaces (a plain tile shows until it is ready).
  const images = useTileImages(tiles, 'art');
  const { mid } = placement(board, cell);
  const mm = cell / TILE.cell;
  const hexOf = (p: Cell, scale = 1) => {
    const { x, y } = mid(p);
    return hexCorners(x, y, cell * scale);
  };
  const hexes = tiles.flatMap((t) => hexFlower(board, t));
  const style = WELL.conquer;
  return (
    <>
      <defs>
        {tiles.map((t) => (
          <clipPath key={t.id} id={`hex-tile-${t.r}-${t.c}`}>
            {hexFlower(board, t).map((p) => (
              // A touch larger, so no hairline shows between a tile's own hexes.
              <polygon key={`${p.r},${p.c}`} points={points(hexOf(p, 1.01))} />
            ))}
          </clipPath>
        ))}
      </defs>
      {tiles.map((t) => {
        const { x, y } = mid(t);
        const size = 3 * cell;
        return (
          <g key={t.id} clipPath={`url(#hex-tile-${t.r}-${t.c})`}>
            <rect x={x - size / 2} y={y - size / 2} width={size} height={size} fill={SPACE_BASE_CSS} />
            {images[t.id] && <image href={images[t.id]} x={x - size / 2} y={y - size / 2} width={size} height={size} />}
          </g>
        );
      })}
      {/* Seams: a hex side where the next hex is another tile's, or off the map. */}
      <path
        d={hexSeams(board, cell, tiles).map(line).join(' ')}
        fill="none"
        stroke="#000"
        strokeOpacity={0.55}
        strokeWidth={Math.max(1, cell * 0.03)}
        strokeLinecap="round"
      />
      {hexes.flatMap((p) => {
        if (cellAt(board, p)?.kind !== 'space') return [];
        const well = hexOf(p, WELL_SCALE);
        // Etched in: shaded along its top sides, lit along its bottom ones (corners 3 to 0 are the top, as y is down).
        const top = [well[3], well[4], well[5], well[0]];
        const bottom = [well[0], well[1], well[2], well[3]];
        return [
          <g key={`w${p.r},${p.c}`}>
            <polygon points={points(well)} fill="#000" fillOpacity={style.fill} />
            <path d={line(top)} fill="none" stroke="#000" strokeOpacity={style.shade} strokeWidth={style.shadeWidth * mm} />
            <path d={line(bottom)} fill="none" stroke="#fff" strokeOpacity={style.lit} strokeWidth={style.litWidth * mm} />
          </g>,
        ];
      })}
    </>
  );
}
