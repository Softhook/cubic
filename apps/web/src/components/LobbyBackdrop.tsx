import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { buildBoard, type Board, type MapDef } from '@quantum/engine';
import { decodedTileImage } from '../art/tileImages';
import { tileArt } from '../art/boardTiles';
import { Die3D } from './Die3D';
import { PLAYER_COLORS } from '../theme';
import { REDUCED_MOTION, useMediaQuery } from '../game/useMediaQuery';

/**
 * Behind the lobby: the chosen map with its real tile art, laid on a slowly turning plane, and a few fleets
 * drifting between spaces as if in a quiet game. Purely decoration: hidden from screen readers, and still
 * (no turning, no moves) under reduced motion.
 */

/** Dice per player on the backdrop. */
const FLEET = 3;
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
function launch(board: Board, players: number): Ship[] {
  const starts = board.planets.filter((p) => p.start);
  const homes = (starts.length >= players ? starts : board.planets).slice(0, players);
  const ships: Ship[] = [];
  homes.forEach((home, i) => {
    const around = openSpaces(board)
      .filter((s) => Math.max(Math.abs(s.r - home.r), Math.abs(s.c - home.c)) === 1)
      .sort(() => Math.random() - 0.5);
    for (const s of around.slice(0, FLEET)) {
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

function Plane({ map, still }: { map: MapDef; still: boolean }) {
  const board = useMemo(() => buildBoard(map), [map]);
  const tiles = useMemo(() => tileArt(board), [board]);
  const spaces = useMemo(() => openSpaces(board), [board]);
  const cell = useCell(board);
  const [images, setImages] = useState<Record<string, string>>({});
  const [ships, setShips] = useState(() => launch(board, map.players));

  useEffect(() => {
    let live = true;
    for (const t of tiles) decodedTileImage(t.id).then((url) => live && setImages((m) => (m[t.id] === url ? m : { ...m, [t.id]: url })));
    return () => {
      live = false;
    };
  }, [tiles]);

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => {
      if (!document.hidden) setShips((s) => step(s, spaces));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [board, spaces, still]);

  return (
    <div
      className="backdrop-plane"
      style={{ '--cols': board.cols, '--rows': board.rows, '--cell': `${cell}px`, '--glide': `${GLIDE_MS}ms` } as CSSProperties}
    >
      {tiles.map((t) => (
        <div key={`${t.r},${t.c}`} className={`backdrop-tile${t.void ? ' void' : ''}`} style={{ '--r': t.r, '--c': t.c } as CSSProperties}>
          {images[t.id] && <img src={images[t.id]} alt="" draggable={false} />}
        </div>
      ))}
      {board.planets.map((p) => (
        <span key={p.id} className="backdrop-glow" style={{ '--r': p.r, '--c': p.c, '--delay': `${-p.id * 1.7}s` } as CSSProperties} />
      ))}
      {ships.map((s) => (
        <span key={s.id} className="backdrop-die" style={{ '--r': s.r, '--c': s.c, '--pc': s.color } as CSSProperties}>
          <span className="backdrop-die-pool" />
          <span key={s.rolls} className={s.rolls ? 'backdrop-die-lift' : undefined}>
            <Die3D value={s.value} size={cell * 0.56} color={s.color} tumbleOnMount delay={s.id * 0.08} sound={false} />
          </span>
        </span>
      ))}
    </div>
  );
}

export function LobbyBackdrop({ map }: { map: MapDef }) {
  const still = useMediaQuery(REDUCED_MOTION);
  return (
    <div className={`lobby-backdrop${still ? ' still' : ''}`} aria-hidden="true">
      <div className="backdrop-spin">
        {/* Keyed by map: a new map fades in with fresh fleets. */}
        <Plane key={map.id} map={map} still={still} />
      </div>
      <div className="backdrop-shade" />
    </div>
  );
}
