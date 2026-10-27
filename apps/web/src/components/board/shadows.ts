/**
 * The shadows the dice and cubes cast on a world's ground: hard-edged and blurred as the buildings' are (art
 * `REGOLITH_SHADOW`), but shorter and lighter, as pieces on the map rather than part of it, and with a hint of the
 * piece's colour.
 */

/** How far a piece's shadow reaches, down and to the right along each axis, for its height. */
export const PIECE_SHADOW_LENGTH = 0.55;

/** How dark the pieces' shadows are: each is drawn opaque, in a layer this opaque, so where two meet it's no darker. */
export const PIECE_SHADOW_OPACITY = 0.7;

/** A shadow's colour, for a piece of colour `color`: nearly black. */
const pieceShadowTint = (color: string) => `color-mix(in srgb, ${color} 14%, #000)`;

/**
 * A rounded square's cast shadow, as SVG polygon points: the sweep of its corners' centres (the inner square, `w`
 * across, from (`x`, `y`)) `far` down and to the right. Stroke it round by the corners' radius to get the shadow.
 */
function sweptSquare(x: number, y: number, w: number, far: number): string {
  return [
    [x, y],
    [x + w, y],
    [x + w + far, y + far],
    [x + w + far, y + w + far],
    [x + far, y + w + far],
    [x, y + w],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

/**
 * A cast shadow's SVG polygon props, for a rounded square `size` across with its top left at (`x`, `y`), its corners
 * rounded by `corner`, reaching `far` down and to the right, tinted by its piece's `color`: the sweep of its corners'
 * centres, stroked round by their radius. The tint goes in `style`, as `color-mix()` is CSS.
 */
export function castShadow(x: number, y: number, size: number, corner: number, far: number, color: string) {
  const tint = pieceShadowTint(color);
  return {
    points: sweptSquare(x + corner, y + corner, size - 2 * corner, far),
    strokeWidth: 2 * corner,
    strokeLinejoin: 'round' as const,
    style: { fill: tint, stroke: tint },
  };
}
