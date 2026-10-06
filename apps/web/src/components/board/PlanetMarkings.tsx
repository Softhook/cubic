import { CUBE_PAD, PLANET_FAMILY, cubePadCentres, numberPlacement } from '@quantum/art';
import { CUBE_SLOT } from '../../theme';

/** A planet's number as the tile prints it: white, outlined in a dark shade of the planet's hue. `y` is the baseline. */
export function PlanetNumber({ n, x, y, size, className }: { n: number; x: number; y: number; size: number; className?: string }) {
  return (
    <text
      className={className}
      x={x}
      y={y}
      fontSize={size}
      fontWeight={800}
      fill="#fff"
      letterSpacing="-.03em"
      paintOrder="stroke"
      strokeLinejoin="round"
      stroke={`hsl(${PLANET_FAMILY[n].hue} 50% 7%)`}
      strokeWidth={size * 0.13}
      textAnchor="middle"
    >
      {n}
    </text>
  );
}

/**
 * A planet's live markings over its tile art, placed and sized as on the printed tile: its number and
 * cube spaces. `cubes[i]` is the colour of the cube in space i. Used by the board and the manual alike.
 */
export function PlanetMarkings({ cx, cy, mm, n, capacity, cubes, numberClass, cubeClass }: {
  cx: number;
  cy: number;
  /** SVG units per printed millimetre. */
  mm: number;
  n: number;
  capacity: number;
  cubes: readonly (string | undefined)[];
  numberClass?: string;
  cubeClass?: string;
}) {
  const at = numberPlacement(n);
  const slot = CUBE_PAD.size * mm;
  return (
    <>
      <PlanetNumber n={n} x={cx + at.x * mm} y={cy + (at.y + at.size * 0.4) * mm} size={at.size * mm} className={numberClass} />
      {cubePadCentres(capacity, 0, 0).map((q, i) => {
        const colour = cubes[i];
        return (
          <rect
            key={i}
            x={cx + q.x * mm - slot / 2}
            y={cy + q.y * mm - slot / 2}
            width={slot}
            height={slot}
            rx={1.6 * mm}
            fill={colour ?? CUBE_SLOT.fill}
            stroke={colour ? '#fff' : CUBE_SLOT.stroke}
            strokeWidth={colour ? 1.2 : 1}
            className={colour ? cubeClass : undefined}
            style={colour ? { filter: 'drop-shadow(0 0 3px rgba(255,255,255,.6))' } : undefined}
          />
        );
      })}
    </>
  );
}
