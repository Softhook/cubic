import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { buildBoard, type Board, type MapDef } from '@quantum/engine';
import { TILE } from '@quantum/art';
import { decodedTileImage } from '../art/tileImages';
import { tileArt } from '../art/boardTiles';
import { PIPS } from './Die3D';
import { PIP, PLAYER_COLORS } from '../theme';
import { PHONE, REDUCED_MOTION, useMediaQuery } from '../game/useMediaQuery';

/**
 * Behind the lobby: the chosen map with its real tile art, laid on a slowly turning plane, and a few fleets
 * drifting between spaces as if in a quiet game. Purely decoration: hidden from screen readers, and still
 * (no turning, no moves) under reduced motion.
 *
 * Kept light for phones, where every composited layer costs GPU memory and the turning plane recomposites all
 * of them each frame: the map is one canvas at a capped resolution (not a layer per tile), and each die is a
 * plain cube (Die3D's tumble and flattening machinery is for dice in play), whose bottom face carries its light.
 */

/** Dice per player on the backdrop: fewer on a phone. */
const FLEET = 3;
const PHONE_FLEET = 2;
/** The map canvas's pixels per CSS pixel at most: it sits far back, dimmed, and needn't be sharp. */
const CANVAS_SCALE = 1.5;
const CANVAS_MAX = 2048;
/** Milliseconds between moves, and how long a glide takes. */
const STEP_MS = 1100;
const GLIDE_MS = 1600;

interface Ship {
  id: number;
  color: string;
  value: number;
  r: number;
  c: number;
  rolls: number;
}

/** Spaces a ship can stand on: not off the map, not a planet. */
function openSpaces(board: Board) {
  const out: { r: number; c: number }[] = [];
  board.cells.forEach((row, r) => row.forEach((x, c) => x.kind === 'space' && out.push({ r, c })));
  return out;
}

/** Each player's fleet around a starting planet (or any planet, on maps without marked starts). */
function launch(board: Board, players: number, fleet: number): Ship[] {
  const starts = board.planets.filter((p) => p.start);
  const homes = (starts.length >= players ? starts : board.planets).slice(0, players);
  const ships: Ship[] = [];
  homes.forEach((home, i) => {
    const around = openSpaces(board)
      .filter((s) => Math.max(Math.abs(s.r - home.r), Math.abs(s.c - home.c)) === 1)
      .sort(() => Math.random() - 0.5);
    for (const s of around.slice(0, fleet)) {
      ships.push({ id: ships.length, color: PLAYER_COLORS[i], value: 1 + Math.floor(Math.random() * 6), ...s, rolls: 0 });
    }
  });
  return ships;
}

/** One ship moves to a free space within its value (a short hop), now and then re-rolling instead. */
function step(ships: Ship[], spaces: { r: number; c: number }[]): Ship[] {
  const i = Math.floor(Math.random() * ships.length);
  const ship = ships[i];
  if (Math.random() < 0.15)
    return ships.map((s, j) => (j === i ? { ...s, value: 1 + Math.floor(Math.random() * 6), rolls: s.rolls + 1 } : s));
  const range = Math.min(ship.value, 3);
  const occupied = new Set(ships.map((s) => `${s.r},${s.c}`));
  const reach = spaces.filter((s) => {
    const d = Math.abs(s.r - ship.r) + Math.abs(s.c - ship.c);
    return d > 0 && d <= range && !occupied.has(`${s.r},${s.c}`);
  });
  if (!reach.length) return ships;
  const to = reach[Math.floor(Math.random() * reach.length)];
  return ships.map((s, j) => (j === i ? { ...s, ...to } : s));
}

/** The plane's cell size in pixels: the whole map fits in about the screen's longer side, re-measured on resize. */
function useCell(board: Board): number {
  const measure = () => Math.min(1.05 * Math.max(innerWidth, innerHeight), 1250) / Math.max(board.cols, board.rows);
  const [cell, setCell] = useState(measure);
  useEffect(() => {
    const resize = () => setCell(measure());
    resize();
    addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure only reads the board
  }, [board]);
  return cell;
}

/** The map drawn once into a canvas, each tile as its image is ready, with a soft light on each planet. */
function MapCanvas({ board, cell }: { board: Board; cell: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tiles = useMemo(() => tileArt(board), [board]);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    let live = true;
    for (const t of tiles)
      decodedTileImage(t.id).then((url) => {
        const img = new Image();
        img.src = url;
        img.decode().then(
          () => live && setImages((m) => ({ ...m, [t.id]: img })),
          () => {},
        );
      });
    return () => {
      live = false;
    };
  }, [tiles]);

  const W = board.cols * cell;
  const H = board.rows * cell;
  const k = Math.min(devicePixelRatio || 1, CANVAS_SCALE, CANVAS_MAX / Math.max(W, H));
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const inset = cell * 0.02;
    const size = cell * 3 - 2 * inset;
    const radius = (cell * 3 * TILE.corner) / TILE.size;
    for (const t of tiles) {
      const x = t.c * cell + inset;
      const y = t.r * cell + inset;
      ctx.beginPath();
      // Square corners where canvas can't round them (Safari before 16).
      if (ctx.roundRect) ctx.roundRect(x, y, size, size, radius);
      else ctx.rect(x, y, size, size);
      const img = images[t.id];
      if (img) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();
      } else {
        ctx.fillStyle = '#0b1124';
        ctx.fill();
      }
      ctx.strokeStyle = t.void ? 'rgba(197,155,255,.35)' : 'rgba(127,178,255,.16)';
      ctx.lineWidth = 1 / k;
      ctx.stroke();
    }
    for (const p of board.planets) {
      const x = (p.c + 0.5) * cell;
      const y = (p.r + 0.5) * cell;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.9);
      glow.addColorStop(0, 'rgba(143,211,255,.22)');
      glow.addColorStop(1, 'rgba(143,211,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - cell, y - cell, cell * 2, cell * 2);
    }
  }, [board, tiles, images, cell, W, H, k]);

  return <canvas ref={canvas} className="backdrop-map" width={Math.round(W * k)} height={Math.round(H * k)} />;
}

/** The faces around a die showing `top`, as on a real die: opposite faces add up to 7. */
function aroundFaces(top: number): number[] {
  const rest = [1, 2, 3, 4, 5, 6].filter((n) => n !== top && n !== 7 - top);
  const a = rest[0];
  const b = rest.find((n) => n !== a && n !== 7 - a)!;
  return [7 - top, a, b, 7 - a, 7 - b];
}

const SIDES = ['bottom', 'north', 'east', 'south', 'west'];
/** A bevel along each edge that shows (not the bottom four, on the board): top north, east, south and west,
 * then the upright ones at the north-east, south-east, south-west and north-west corners. */
const EDGES = ['tn', 'te', 'ts', 'tw', 'ne', 'se', 'sw', 'nw'];
/** Tumble directions, so dice rolling together don't turn alike. */
const TUMBLES = [
  ['540deg', '-360deg'],
  ['-360deg', '540deg'],
  ['720deg', '180deg'],
  ['-540deg', '-720deg'],
];

function Face({ n, side }: { n: number; side: string }) {
  return (
    <span className={`backdrop-face ${side}`}>
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} className={PIPS[n].includes(k) ? 'pip on' : 'pip'} />
      ))}
    </span>
  );
}

/** A die standing on the board, value face up, that tumbles down onto it when shown (and so on each re-roll). */
const Cube = memo(function Cube({ value, color, turn, delay }: { value: number; color: string; turn: number; delay: number }) {
  const [tx, ty] = TUMBLES[turn % TUMBLES.length];
  return (
    <span
      className="backdrop-cube"
      style={{ '--die-color': color, '--die-pip': PIP, '--tx': tx, '--ty': ty, '--delay': `${delay}s` } as CSSProperties}
    >
      <span className="backdrop-cube-spin">
        <Face n={value} side="top" />
        {aroundFaces(value).map((n, i) => (
          <Face key={SIDES[i]} n={n} side={SIDES[i]} />
        ))}
        {/* Under the top face, filling the tips of its corners where the bevels meet. */}
        <span className="backdrop-core" />
        {EDGES.map((edge) => (
          <span key={edge} className={`backdrop-edge ${edge}`} />
        ))}
      </span>
    </span>
  );
});

function Plane({ map, fleet, still }: { map: MapDef; fleet: number; still: boolean }) {
  const board = useMemo(() => buildBoard(map), [map]);
  const spaces = useMemo(() => openSpaces(board), [board]);
  const cell = useCell(board);
  const [ships, setShips] = useState(() => launch(board, map.players, fleet));

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => {
      if (!document.hidden) setShips((s) => step(s, spaces));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [spaces, still]);

  return (
    <div
      className="backdrop-plane"
      style={{ '--cols': board.cols, '--rows': board.rows, '--cell': `${cell}px`, '--glide': `${GLIDE_MS}ms` } as CSSProperties}
    >
      <MapCanvas board={board} cell={cell} />
      {ships.map((s) => (
        <span key={s.id} className="backdrop-die" style={{ '--r': s.r, '--c': s.c, '--pc': s.color } as CSSProperties}>
          {/* Keyed by roll: a re-rolled die drops and tumbles in afresh. */}
          <Cube key={s.rolls} value={s.value} color={s.color} turn={s.id + s.rolls} delay={s.rolls ? 0 : s.id * 0.08} />
        </span>
      ))}
    </div>
  );
}

export function LobbyBackdrop({ map }: { map: MapDef }) {
  const still = useMediaQuery(REDUCED_MOTION);
  const fleet = useMediaQuery(PHONE) ? PHONE_FLEET : FLEET;
  return (
    <div className={`lobby-backdrop${still ? ' still' : ''}`} aria-hidden="true">
      <div className="backdrop-spin">
        {/* Keyed by map: a new map fades in with fresh fleets. */}
        <Plane key={`${map.id}:${fleet}`} map={map} fleet={fleet} still={still} />
      </div>
      <div className="backdrop-shade" />
    </div>
  );
}
