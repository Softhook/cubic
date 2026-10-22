import { rng } from '../rng';
import { LABEL_TEXT, PLANET_DIAMETER } from '../tokens';
import { planetFlavour, type PlanetFlavour } from '../flavour';
import { n, type Fragment } from '../svg';
import { CORNER, MID, numberCorner, type Spot, type TileShape } from './geometry';
import { planetType, type TileSpec } from './set';

/** A planet's flavour label: the made-up name and survey data printed in tiny type at its top left. */

/** The flavour label's area for a planet at `p` (mm), with a little margin: right aligned at its top-left corner, 8 mm tall. */
export const inLabel = (p: Spot, x: number, y: number) => x < p.x - CORNER - 1 && x > p.x - MID + 4 && Math.abs(y - (p.y - CORNER)) < 4.2;

/** The made-up name and survey data printed beside a tile's planet. */
export function tileFlavour(spec: TileSpec): PlanetFlavour {
  return planetFlavour(rng(spec.seed).fork('name'), planetType(spec), spec.number);
}

/**
 * The planet's flavour label: a made-up name, catalogue number and survey data in tiny type, right
 * aligned where the spaces meet at the planet's top left, with a thin leader line to the planet. In tile
 * millimetres with the planet in the middle; the game moves it with its planet (`tileLabel`).
 */
export function label(spec: TileSpec): Fragment {
  const fl = tileFlavour(spec);
  const r = PLANET_DIAMETER[spec.number] / 2;
  // The four lines fit the 8 mm strip between the space pads above and below (pads end 4 mm from
  // the corner), with 0.5 mm to spare: name caps from -3.5, last baseline at +3.2.
  const top = MID - CORNER;
  // Right aligned at the corner, or further left where a big planet (with its atmosphere) reaches the
  // strip: its edge is nearest at the last line, 3.2 mm below the corner.
  const glow = r * 1.08;
  const dy = MID - (top + 3.2);
  const right = Math.min(MID - CORNER - 1.6, glow > dy ? MID - Math.sqrt(glow * glow - dy * dy) - 1.2 : Infinity);
  const line = (y: number, size: number, text: string, extra: string) =>
    `<text x="${n(right)}" y="${n(y)}" font-family="${LABEL_TEXT.font}" font-size="${size}" text-anchor="end" ${extra}>${text}</text>`;
  const tip = MID - (r + 0.8) / Math.SQRT2;
  const start = MID - CORNER - 0.9;
  return {
    defs: '',
    body:
      line(top - 2.25, LABEL_TEXT.name, fl.name.toUpperCase(), `font-weight="700" letter-spacing=".35" fill="#e6eeff" fill-opacity=".75"`) +
      [fl.designation, fl.cls, fl.data]
        .map((t, i) => line(top - 0.3 + i * 1.75, LABEL_TEXT.line, t, `letter-spacing=".04" fill="#c7d6ff" fill-opacity=".55"`))
        .join('') +
      (tip > start
        ? `<line x1="${n(start)}" y1="${n(start)}" x2="${n(tip)}" y2="${n(tip)}" stroke="#c7d6ff" stroke-opacity=".45" stroke-width=".15"/>` +
          `<circle cx="${n(tip)}" cy="${n(tip)}" r=".35" fill="#c7d6ff" fill-opacity=".7"/>`
        : ''),
  };
}

/**
 * Whether a planet at `at` on a tile has its flavour label, as printed: on a square tile, where the spaces
 * meet at its top left, so only with spaces up and left of it on the tile, and not where its number went.
 */
export function tileLabelFits(shape: TileShape, at: Spot): boolean {
  const k = numberCorner(at);
  return shape === 'square' && at.x >= 0 && at.y >= 0 && !(k.x === -1 && k.y === -1);
}

/** A planet's flavour label as SVG, in millimetres from the planet's centre (the game draws it beside the planet). */
export function tileLabel(spec: TileSpec): string {
  return `<g transform="translate(${-MID} ${-MID})">${label(spec).body}</g>`;
}
