import { memo } from 'react';
import { cellAt, type Board } from '@quantum/engine';
import { HATCH, HEX_WELL, SPACE_BASE_CSS, TILE, WELL, hexWell, tileLabel, tileSpec, voidFlask, well } from '@quantum/art';
import { useGroundMaps } from '../../art/mapLook';
import { layerScale, useTileImages } from '../../art/tileImages';
import type { TileArt } from '../../art/boardTiles';
import { SQUARE_TILE_GAP, hexCorners, hexFlower, hexSeams, placement } from './geometry';
import { labelFits, spaceRoles } from './layers';

const points = (list: number[][]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const line = (list: number[][]) => `M${list.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L')}`;

/** The hatch lines' gap across them (mm): print's (tile.ts `hatch`) is along a pad's side, at 45°. */
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
 * Hatching for the spaces in a planet's orbit on a square map, as printed: faint diagonal lines. A space in two orbits
 * (orbits that overlap) is cross-hatched, a little stronger, as it counts for both planets.
 */
const PATTERNS = `<defs>${pattern('map-orbit', 0.14, 0.25)}${pattern('map-shared', 0.24, 0.3, true)}</defs>`;

/**
 * The spaces as wells etched into the map, in millimetres: on a square map, hatched where they orbit a planet,
 * cross-hatched where they orbit two, with a faint flask on a Void's (ships there gain Research). Worked out from the
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
      out += hexWell(x, y, HEX_WELL * TILE.cell, style);
    } else {
      out += well(x, y, TILE.pad, 4, style);
      const h = TILE.pad / 2 - HATCH.inset;
      if (orbits) out += `<rect x="${x - h}" y="${y - h}" width="${2 * h}" height="${2 * h}" fill="url(#${fill})"/>`;
    }
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

const NO_TILES: TileArt[] = [];

/**
 * A map's tiles in SVG, square or hex, in layers: each tile's sky, its body (planet and moons, or a Void's
 * heart) wherever the planet sits, cut off at the tile's edge, then the seams between hex tiles, the spaces
 * and the labels. The planets' numbers and cubes go on top (BoardArt). A hex map may be on its world's
 * ground instead (mapLook): each tile's building already standing on its planet's space, and drawn again over
 * the spaces, so the wells are etched into the ground and not across the buildings.
 */
export const MapTiles = memo(function MapTiles({ board, tiles, cell }: { board: Board; tiles: TileArt[]; cell: number }) {
  const ground = useGroundMaps() && !!board.hex;
  const skyLayer = ground ? 'ground' : board.hex ? 'sky-hex' : 'sky-square';
  const skies = useTileImages(tiles, skyLayer);
  // On the ground each tile already has its building, so there are no bodies to load.
  const bodies = useTileImages(ground ? NO_TILES : tiles, 'body');
  const standing = useTileImages(ground ? tiles : NO_TILES, 'standing');
  const { mid } = placement(board, cell);
  const mm = cell / TILE.cell;
  // A tile's artwork is a whole printed tile, 3 spaces wide, centred on what it draws.
  const size = 3 * cell;
  // The ground reaches past its tile, by the bleed, so the clip a touch past the hexes is on ground.
  const art = (url: string | undefined, at: { x: number; y: number }, scale = 1) =>
    url && <image href={url} x={at.x - (size * scale) / 2} y={at.y - (size * scale) / 2} width={size * scale} height={size * scale} />;
  // Square tiles stand a little apart, with the printed rounded corners; hex tiles meet at a seam.
  const inset = cell * SQUARE_TILE_GAP;
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
  const marks = marksOf(board, tiles);
  return (
    <>
      <defs>
        {tiles.map((t) => (
          <clipPath key={t.tile} id={`map-tile-${t.tile}`}>
            {outline(t)}
          </clipPath>
        ))}
      </defs>
      {tiles.map((t) => (
        <g key={t.tile} clipPath={`url(#map-tile-${t.tile})`}>
          <rect x={mid(t).x - size / 2} y={mid(t).y - size / 2} width={size} height={size} fill={SPACE_BASE_CSS} />
          {art(skies[t.id], mid(t), layerScale(skyLayer))}
          {!ground && art(bodies[t.id], mid(t.body))}
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
      <g transform={`scale(${mm})`} dangerouslySetInnerHTML={{ __html: marks.wells }} />
      {ground &&
        tiles.map((t) => (
          <g key={t.tile} clipPath={`url(#map-tile-${t.tile})`}>
            {art(standing[t.id], mid(t), layerScale('standing'))}
          </g>
        ))}
      <g transform={`scale(${mm})`} dangerouslySetInnerHTML={{ __html: marks.labels }} />
    </>
  );
});
