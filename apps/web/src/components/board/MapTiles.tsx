import { memo, useMemo } from 'react';
import { cellAt, type Board } from '@quantum/engine';
import { HEX_WELL, SPACE_BASE_CSS, TILE, WELL, icon, tileLabel, tileSpec, well } from '@quantum/art';
import { useTileImages } from '../../art/tileImages';
import type { TileArt } from '../../art/boardTiles';
import { hexCorners, hexFlower, hexSeams, placement } from './geometry';
import { labelFits, spaceRoles } from './layers';

const points = (list: number[][]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const line = (list: number[][]) => `M${list.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L')}`;

/** The hatching's colour, and the lines' gap across them (mm): as printed (tile.ts `hatch`). */
const HATCH_INK = 'hsl(222 80% 82%)';
const HATCH_GAP = 3 / Math.SQRT2;
/** How far the hatching keeps inside a space's well (mm). */
const HATCH_INSET = 1.5;

/**
 * Hatching for the spaces in a planet's orbit, as printed: faint diagonal lines. A space in two orbits
 * (orbits that overlap) is cross-hatched, a little stronger, as it counts for both planets. In millimetres.
 */
const PATTERNS =
  `<pattern id="map-orbit" patternUnits="userSpaceOnUse" width="${HATCH_GAP}" height="${HATCH_GAP}" patternTransform="rotate(45)">` +
  `<line x1="${HATCH_GAP / 2}" y1="0" x2="${HATCH_GAP / 2}" y2="${HATCH_GAP}" stroke="${HATCH_INK}" stroke-opacity=".14" stroke-width=".25"/></pattern>` +
  `<pattern id="map-shared" patternUnits="userSpaceOnUse" width="${HATCH_GAP}" height="${HATCH_GAP}" patternTransform="rotate(45)">` +
  `<line x1="${HATCH_GAP / 2}" y1="0" x2="${HATCH_GAP / 2}" y2="${HATCH_GAP}" stroke="${HATCH_INK}" stroke-opacity=".24" stroke-width=".3"/>` +
  `<line x1="0" y1="${HATCH_GAP / 2}" x2="${HATCH_GAP}" y2="${HATCH_GAP / 2}" stroke="${HATCH_INK}" stroke-opacity=".24" stroke-width=".3"/></pattern>`;

/**
 * The spaces as wells etched into the map, in millimetres: hatched where they orbit a planet, cross-hatched
 * where they orbit two, with a faint flask on a Void's (ships there gain Research). Worked out from the
 * board, so an orbit reaching onto another tile is marked there too.
 */
function wells(board: Board): string {
  const { mid } = placement(board, TILE.cell);
  let out = '';
  for (const { p, orbits, void: isVoid } of spaceRoles(board)) {
    const { x, y } = mid(p);
    const style = orbits ? WELL.conquer : WELL.space;
    const fill = orbits > 1 ? 'map-shared' : 'map-orbit';
    const role = orbits > 1 ? 'shared' : orbits ? 'orbit' : 'space';
    out += `<g class="well" data-r="${p.r}" data-c="${p.c}" data-role="${role}${isVoid ? ' void' : ''}">`;
    if (board.hex) {
      const size = TILE.cell * HEX_WELL;
      const w = hexCorners(x, y, size);
      // Etched in: shaded along its top sides, lit along its bottom ones (corners 3 to 0 are the top, as y is down).
      out +=
        `<polygon points="${points(w)}" fill="#000" fill-opacity="${style.fill}"/>` +
        `<path d="${line([w[3], w[4], w[5], w[0]])}" fill="none" stroke="#000" stroke-opacity="${style.shade}" stroke-width="${style.shadeWidth}"/>` +
        `<path d="${line([w[0], w[1], w[2], w[3]])}" fill="none" stroke="#fff" stroke-opacity="${style.lit}" stroke-width="${style.litWidth}"/>`;
      if (orbits) out += `<polygon points="${points(hexCorners(x, y, size - 2 * HATCH_INSET))}" fill="url(#${fill})"/>`;
    } else {
      out += well(x, y, TILE.pad, 4, style);
      const h = TILE.pad / 2 - HATCH_INSET;
      if (orbits) out += `<rect x="${x - h}" y="${y - h}" width="${2 * h}" height="${2 * h}" fill="url(#${fill})"/>`;
    }
    if (isVoid) out += `<g stroke-opacity=".15">${icon('research', x, y, 8, HATCH_INK, 0.9)}</g>`;
    out += '</g>';
  }
  return out;
}

/** The planets' flavour labels beside them, as printed, where there's room (layers.ts `labelFits`), in millimetres. */
function labels(board: Board, tiles: readonly TileArt[]): string {
  const { mid } = placement(board, TILE.cell);
  return board.planets
    .filter((p) => labelFits(board, p))
    .map((p) => {
      const tile = tiles.find((t) => t.tile === cellAt(board, p)!.tile)!;
      const { x, y } = mid(p);
      return `<g transform="translate(${x} ${y})">${tileLabel(tileSpec(tile.id))}</g>`;
    })
    .join('');
}

/**
 * A map's tiles in SVG, square or hex, in layers: each tile's sky, its body (planet and moons, or a Void's
 * heart) wherever the planet sits, cut off at the tile's edge, then the seams between hex tiles, the spaces
 * and the labels. The planets' numbers and cubes go on top (BoardArt).
 */
export const MapTiles = memo(function MapTiles({ board, tiles, cell }: { board: Board; tiles: TileArt[]; cell: number }) {
  const skies = useTileImages(tiles, board.hex ? 'sky-hex' : 'sky-square');
  const bodies = useTileImages(tiles, 'body');
  const marks = useMemo(() => ({ wells: wells(board), labels: labels(board, tiles) }), [board, tiles]);
  const { mid } = placement(board, cell);
  const mm = cell / TILE.cell;
  // A tile's artwork is a whole printed tile, 3 spaces wide, centred on what it draws.
  const size = 3 * cell;
  const art = (url: string | undefined, at: { x: number; y: number }) =>
    url && <image href={url} x={at.x - size / 2} y={at.y - size / 2} width={size} height={size} />;
  // Square tiles stand a little apart, with the printed rounded corners; hex tiles meet at a seam.
  const inset = cell * 0.015;
  const outline = (t: TileArt) => {
    if (board.hex)
      return hexFlower(board, t).map((p) => {
        const { x, y } = mid(p);
        // A touch larger, so no hairline shows between a tile's own hexes.
        return <polygon key={`${p.r},${p.c}`} points={points(hexCorners(x, y, cell * 1.01))} />;
      });
    const { x, y } = mid(t);
    return (
      <rect
        x={x - size / 2 + inset}
        y={y - size / 2 + inset}
        width={size - 2 * inset}
        height={size - 2 * inset}
        rx={(size * TILE.corner) / TILE.size}
      />
    );
  };
  return (
    <>
      <defs>
        {tiles.map((t) => (
          <clipPath key={t.tile} id={`map-tile-${t.tile}`}>
            {outline(t)}
          </clipPath>
        ))}
      </defs>
      <g dangerouslySetInnerHTML={{ __html: `<defs>${PATTERNS}</defs>` }} transform={`scale(${mm})`} />
      {tiles.map((t) => (
        <g key={t.tile} clipPath={`url(#map-tile-${t.tile})`}>
          <rect x={mid(t).x - size / 2} y={mid(t).y - size / 2} width={size} height={size} fill={SPACE_BASE_CSS} />
          {art(skies[t.id], mid(t))}
          {art(bodies[t.id], mid(t.body))}
        </g>
      ))}
      {board.hex && (
        <path
          d={hexSeams(board, cell, tiles).map(line).join(' ')}
          fill="none"
          stroke="#000"
          strokeOpacity={0.55}
          strokeWidth={Math.max(1, cell * 0.03)}
          strokeLinecap="round"
        />
      )}
      <g transform={`scale(${mm})`} dangerouslySetInnerHTML={{ __html: marks.wells + marks.labels }} />
    </>
  );
});
