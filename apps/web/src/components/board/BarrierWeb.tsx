import { REGOLITH_SHADOW } from '@quantum/art';
import { PIECE_SHADOW_LENGTH, PIECE_SHADOW_OPACITY, pieceShadowTint } from './shadows';

/**
 * A barrier, as the Wisp makes it: the drone's spinneret round sprays molten regolith across a space, which
 * cools in threads of glass (as a volcano's Pele's hair), anchored to the ground in lumps and webbed between them
 * over a patch of fused, darkened ground. It belongs to no one once it's spun, so it's drawn in the ground's
 * own glass and shadow, not a player's colour, and it lies low, so its shadow is short.
 */

/** The glass threads, their dark edge (so they read on pale ground) and the fused ground under them. */
const WEB = { glass: 'rgba(244, 236, 222, .82)', edge: 'rgba(30, 20, 12, .45)', fused: 'rgba(40, 24, 14, .3)' };

/** How high the web stands, as a share of a space: a cube is as tall as it is wide, the web barely off the ground. */
const HEIGHT = 0.06;

/** The same few random numbers each time for a space, so its web keeps its shape from one render to the next. */
function seeded(r: number, c: number) {
  let t = (r * 7919 + c * 104729 + 1) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A web's shape about its space's centre: the fused patch, the threads (one path) and the anchoring lumps. */
function web(r: number, c: number, cell: number) {
  const rand = seeded(r, c);
  const jitter = (n: number) => (rand() - 0.5) * 2 * n;
  const R = cell * 0.37;
  const n = 6 + Math.floor(rand() * 2);
  const turn = rand() * Math.PI * 2;
  const spokes = Array.from({ length: n }, (_, i) => {
    const a = turn + ((i + jitter(0.3)) * 2 * Math.PI) / n;
    return { a, len: R * (0.78 + rand() * 0.24) };
  });
  const at = (s: (typeof spokes)[number], k: number): [number, number] => [Math.cos(s.a) * s.len * k, Math.sin(s.a) * s.len * k];
  const hub: [number, number] = [jitter(R * 0.12), jitter(R * 0.12)];
  const f = (p: [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

  // The spokes, each bowed a little, from the hub out to an anchor.
  let d = spokes
    .map((s) => {
      const end = at(s, 1);
      const bow = jitter(R * 0.12);
      const ctrl: [number, number] = [(hub[0] + end[0]) / 2 - Math.sin(s.a) * bow, (hub[1] + end[1]) / 2 + Math.cos(s.a) * bow];
      return `M${f(hub)} Q${f(ctrl)} ${f(end)}`;
    })
    .join('');
  // Rings of thread between neighbouring spokes, sagging in towards the hub, some broken.
  for (const k of [0.38, 0.66, 0.9]) {
    spokes.forEach((s, i) => {
      if (rand() < 0.15) return;
      const t = spokes[(i + 1) % n];
      const [p, q] = [at(s, k + jitter(0.05)), at(t, k + jitter(0.05))];
      const sag = 0.66 + rand() * 0.2;
      d += `M${f(p)} Q${f([((p[0] + q[0]) / 2) * sag, ((p[1] + q[1]) / 2) * sag])} ${f(q)}`;
    });
  }
  // The fused ground: a smooth blob through points round the web's rim, curved through their midpoints.
  const rim = spokes.map((s): [number, number] => at(s, 1.08 + jitter(0.08)));
  const midOf = (i: number): [number, number] => {
    const [p, q] = [rim[i], rim[(i + 1) % n]];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const patch = `M${f(midOf(n - 1))}` + rim.map((p, i) => `Q${f(p)} ${f(midOf(i))}`).join('') + 'Z';
  const lumps = spokes.map((s) => ({ p: at(s, 1), r: cell * (0.016 + rand() * 0.016) }));
  return { patch, d, lumps, hub };
}

/** A barrier's web on the space centred on (x, y). `cast`: on a world's ground, its threads cast a short shadow. */
export function BarrierWeb({
  r,
  c,
  x,
  y,
  cell,
  mm,
  cast,
}: {
  r: number;
  c: number;
  x: number;
  y: number;
  cell: number;
  mm: number;
  cast: boolean;
}) {
  const { patch, d, lumps, hub } = web(r, c, cell);
  const far = cell * HEIGHT * PIECE_SHADOW_LENGTH;
  const thread = cell * 0.016;
  return (
    <g className="barrier" transform={`translate(${x} ${y})`}>
      <path d={patch} fill={WEB.fused} style={{ filter: `blur(${cell * 0.025}px)` }} />
      {cast && (
        <path
          d={d}
          transform={`translate(${far} ${far})`}
          fill="none"
          stroke={pieceShadowTint(WEB.glass)}
          strokeWidth={thread * 1.6}
          strokeLinecap="round"
          opacity={PIECE_SHADOW_OPACITY}
          style={{ filter: `blur(${REGOLITH_SHADOW.blur * mm * 0.5}px)` }}
        />
      )}
      <path d={d} fill="none" stroke={WEB.edge} strokeWidth={thread * 2} strokeLinecap="round" />
      <path d={d} fill="none" stroke={WEB.glass} strokeWidth={thread} strokeLinecap="round" />
      {[...lumps, { p: hub, r: cell * 0.026 }].map(({ p, r: lr }, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={lr} fill={WEB.glass} stroke={WEB.edge} strokeWidth={thread * 0.6} />
      ))}
      <title>A barrier: nothing moves, drops or shoots through it</title>
    </g>
  );
}
