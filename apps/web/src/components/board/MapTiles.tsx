import { Fragment, memo, type ReactNode } from 'react';
import { cellAt, type Board } from '@quantum/engine';
import {
  HATCH,
  RASTER_AREA,
  SPACE_BASE_CSS,
  TILE,
  WELL,
  tileLabel,
  TILE_LAYERS,
  tileSpec,
  voidFlask,
  well,
  type RasterLayer,
} from '@quantum/art';
import { useTileImages } from '../../art/tileImages';
import type { TileArt } from '../../art/boardTiles';
import { SQUARE_TILE_GAP, placement } from './geometry';
import { labelFits, mapStack, spaceRoles, type BoardLayer } from './layers';

/** The hatch lines' gap across them (mm): print's (art tile/markings.ts `hatch`) is along a pad's side, at 45°. */
const HATCH_GAP = HATCH.gap / Math.SQRT2;

/** One hatch pattern: faint diagonal lines, or crossed ones for `cross`. In millimetres. */
const pattern = (id: string, opacity: number, width: number, cross = false) => {
  const [g, h] = [HATCH_GAP, HATCH_GAP / 2];
  const stroke = `stroke="${HATCH.ink}" stroke-opacity="${opacity}" stroke-width="${width}"`;
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${g}" height="${g}" patternTransform="rotate(45)">` +
    `<line x1="${h}" y1="0" x2="${h}" y2="${g}" ${stroke}/>` +
    (cross ? `<line x1="0" y1="${h}" x2="${g}" y2="${h}" ${stroke}/>` : '') +
    '</pattern>'
  );
};

/**
 * Hatching for the spaces in a planet's orbit, as printed: faint diagonal lines. A space in two orbits
 * (orbits that overlap) is cross-hatched, a little stronger, as it counts for both planets.
 */
const PATTERNS = `<defs>${pattern('map-orbit', 0.14, 0.25)}${pattern('map-shared', 0.24, 0.3, true)}</defs>`;

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
    out += well(x, y, TILE.pad, 4, style);
    const h = TILE.pad / 2 - HATCH.inset;
    if (orbits) out += `<rect x="${x - h}" y="${y - h}" width="${2 * h}" height="${2 * h}" fill="url(#${fill})"/>`;
    if (isVoid) out += voidFlask(x, y);
    out += '</g>';
  }
  return out;
}

/** The planets' flavour labels beside them, as printed, where there's room (layers.ts `labelFits`), in millimetres. */
function labels(board: Board, tiles: readonly TileArt[]): string {
  const { mid } = placement(board, TILE.cell);
  const ids = new Map(tiles.map((t) => [t.tile, t.id]));
  return board.planets
    .filter((p) => labelFits(board, p))
    .map((p) => {
      const { x, y } = mid(p);
      return `<g transform="translate(${x} ${y})">${tileLabel(tileSpec(ids.get(cellAt(board, p)!.tile)!))}</g>`;
    })
    .join('');
}

/**
 * The spaces and labels of a map, in millimetres, by map: they follow from where its planets are, not from
 * the cubes on them, so a move (a new board) doesn't redraw them.
 */
const marksByMap = new Map<string, { wells: string; labels: string }>();
function marksOf(board: Board, tiles: readonly TileArt[]) {
  let marks = marksByMap.get(board.mapId);
  if (marks === undefined) marksByMap.set(board.mapId, (marks = { wells: PATTERNS + wells(board), labels: labels(board, tiles) }));
  return marks;
}

/**
 * A map's tiles in SVG, in a tile's layers (art `TILE_LAYERS`), as a printed tile has them: each tile's sky,
 * then its body (planet and moons, or a Void's heart) wherever the planet sits, cut off at the tile's edge.
 * The images are the layers drawn with filters (tileImages); the spaces and labels are drawn live, from the
 * board. The planets' numbers and cubes, their layer, go on top, with the gates and ships (BoardArt).
 */
export const MapTiles = memo(function MapTiles({ board, tiles, cell }: { board: Board; tiles: TileArt[]; cell: number }) {
  const images: Record<RasterLayer, Record<string, string>> = {
    sky: useTileImages(tiles, 'sky'),
    body: useTileImages(tiles, 'body'),
  };
  const { mid } = placement(board, cell);
  const mm = cell / TILE.cell;
  // A tile's artwork is a whole printed tile, 3 spaces wide, centred on what it draws.
  const size = 3 * cell;
  // Tiles stand a little apart, with the printed rounded corners.
  const inset = cell * SQUARE_TILE_GAP;
  const outline = (t: TileArt) => {
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
  /**
   * A tile's image of a layer over its area (art `RASTER_AREA`), the tile's middle on the tile's or, for its body,
   * on its planet.
   */
  const image = (t: TileArt, layer: RasterLayer) => {
    const url = images[layer][t.id];
    const at = mid(layer === 'body' ? t.body : t);
    const area = RASTER_AREA[layer];
    const px = (v: number) => (v * size) / TILE.size;
    return (
      url && (
        <image
          key={layer}
          href={url}
          x={at.x + px(area.x - TILE.size / 2)}
          y={at.y + px(area.y - TILE.size / 2)}
          width={px(area.w)}
          height={px(area.h)}
        />
      )
    );
  };
  const stack = mapStack(TILE_LAYERS);
  // The shared base colour goes under the bottom run of images, where a tile's images haven't come yet.
  const bottom = stack.find(Array.isArray);
  const marks = marksOf(board, tiles);
  const drawn: Record<BoardLayer, () => ReactNode> = {
    label: () => <g transform={`scale(${mm})`} dangerouslySetInnerHTML={{ __html: marks.labels }} />,
    spaces: () => <g transform={`scale(${mm})`} dangerouslySetInnerHTML={{ __html: marks.wells }} />,
    // Live: they change in play (BoardArt).
    planet: () => null,
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
      {stack.map((part) =>
        Array.isArray(part) ? (
          <Fragment key={part.join()}>
            {tiles.map((t) => (
              <g key={t.tile} clipPath={`url(#map-tile-${t.tile})`}>
                {part === bottom && (
                  <rect x={mid(t).x - size / 2} y={mid(t).y - size / 2} width={size} height={size} fill={SPACE_BASE_CSS} />
                )}
                {part.map((layer) => image(t, layer))}
              </g>
            ))}
          </Fragment>
        ) : (
          <Fragment key={part}>{drawn[part]()}</Fragment>
        ),
      )}
    </>
  );
});
