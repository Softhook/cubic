import { drawing, type Board, type Cell } from '@quantum/engine';
import { SPACE_BASE_CSS, TILE, WELL } from '@quantum/art';
import { useTileImages } from '../../art/tileImages';
import type { TileArt } from '../../art/boardTiles';

/** A flat-topped hex one space tall has corners this far from its centre (1 / √3 spaces). */
const CORNER = 1 / Math.sqrt(3);
/** A space's well, as a part of its hex (a square's pad is 24 of its 32 mm). */
const WELL_SCALE = 0.8;

/** The corners of a flat-topped hex centred on (x, y) with corners `r` from it, from the right going clockwise (SVG's y is down). */
const corners = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => [x + r * Math.cos((Math.PI / 3) * i), y + r * Math.sin((Math.PI / 3) * i)]);
/** The hex beyond each side, corner i to corner i + 1 (the side facing 30° + 60° i), as a board step. */
const SIDE_STEPS: Cell[] = [
  { r: 0, c: 1 },
  { r: 1, c: 0 },
  { r: 1, c: -1 },
  { r: 0, c: -1 },
  { r: -1, c: 0 },
  { r: -1, c: 1 },
];
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
  const { at } = drawing(board);
  const mm = cell / TILE.cell;
  const centre = (p: Cell) => [(at(p).c + 0.5) * cell, (at(p).r + 0.5) * cell];
  const hexOf = (p: Cell, scale = 1) => {
    const [x, y] = centre(p);
    return corners(x, y, CORNER * cell * scale);
  };
  const byTile = new Map<number, Cell[]>();
  board.cells.forEach((row, r) =>
    row.forEach((x, c) => {
      if (x.kind !== 'off') byTile.set(x.tile, [...(byTile.get(x.tile) ?? []), { r, c }]);
    }),
  );
  const tileOf = (p: Cell) => board.cells[p.r]?.[p.c]?.tile;
  const style = WELL.conquer;
  return (
    <>
      <defs>
        {tiles.map((t) => (
          <clipPath key={t.id} id={`hex-tile-${t.r}-${t.c}`}>
            {(byTile.get(tileOf(t)!) ?? []).map((p) => (
              // A touch larger, so no hairline shows between a tile's own hexes.
              <polygon key={`${p.r},${p.c}`} points={points(hexOf(p, 1.01))} />
            ))}
          </clipPath>
        ))}
      </defs>
      {tiles.map((t) => {
        const [x, y] = centre(t);
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
        d={[...byTile.values()]
          .flat()
          .flatMap((p) => {
            const hex = hexOf(p);
            return hex.flatMap((a, i) => {
              const b = hex[(i + 1) % 6];
              const next = { r: p.r + SIDE_STEPS[i].r, c: p.c + SIDE_STEPS[i].c };
              return tileOf(next) === tileOf(p) ? [] : [line([a, b])];
            });
          })
          .join(' ')}
        fill="none"
        stroke="#000"
        strokeOpacity={0.55}
        strokeWidth={Math.max(1, cell * 0.03)}
        strokeLinecap="round"
      />
      {[...byTile.values()].flat().flatMap((p) => {
        if (board.cells[p.r][p.c].kind !== 'space') return [];
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
