import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { buildBoard, type Board, type MapDef } from '@quantum/engine';
import { PLANET_DIAMETER, TILE, TILE_SET, tileHasRings, tileSpec } from '@quantum/art';
import { decodedTileImage } from '../../art/tileImages';
import { tileArt, type TileArt } from '../../art/boardTiles';
import { PIPS } from '../Die3D';
import { Boom, EXPLOSION_MS } from '../board/Explosions';
import { PIP } from '../../theme';
import { PHONE, REDUCED_MOTION, useMediaQuery } from '../../game/useMediaQuery';
import { pick } from '../../random';
import { around, at, launch, openSpaces, roll, step, taken, type Ship, type Spot, type Travel } from './fleet';

/**
 * Behind the lobby: the chosen map with its real tile art, laid on a slowly turning plane, and a few fleets
 * drifting between spaces as if in a quiet game: now and then one attacks another and the loser blows up, to
 * drop back in at home a little later. The planets stand up off the map as spheres. Purely decoration: hidden from
 * screen readers, and still (no turning, no moves) under reduced motion.
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
/** Milliseconds between one ship acting and the next. */
const STEP_MS = 1100;
/** Milliseconds a ship takes to cross one space: it moves space by space, along rows and columns. */
const SPACE_MS = 340;
/** How often the attacker is the one destroyed. */
const ATTACKER_LOSES = 0.3;
/** How long a destroyed ship is gone before it drops back in near home. */
const RESPAWN_MS = 3500;

interface Blast extends Spot {
  key: string;
  color: string;
}

/** The plane's cell size in pixels: the whole map fits in about the screen's longer side, re-measured on resize. */
const cellSize = (board: Board) => Math.min(1.05 * Math.max(innerWidth, innerHeight), 1250) / Math.max(board.cols, board.rows);
function useCell(board: Board): number {
  const [cell, setCell] = useState(() => cellSize(board));
  useEffect(() => {
    const resize = () => setCell(cellSize(board));
    resize();
    addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, [board]);
  return cell;
}

/** Each tile's artwork, as a decoded image and its URL, filled in as each is ready. */
function useTileImages(tiles: TileArt[]) {
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
  return images;
}

/** The tiles in the set whose planet has no rings. */
const RINGLESS = TILE_SET.filter((spec) => !tileHasRings(spec));

/**
 * The map's tiles as the game lays them, but each planet without rings: every planet here stands up off the map
 * as a sphere, which can't carry rings around it. A ringed tile is swapped for a ringless one of its number the
 * map doesn't use yet (or, once those run out, for each in turn).
 */
function ringlessTiles(board: Board): TileArt[] {
  const tiles = tileArt(board);
  const used = new Set(tiles.map((t) => t.id));
  let reused = 0;
  return tiles.map((t) => {
    const spec = tileSpec(t.id);
    const choices = RINGLESS.filter((s) => s.number === spec.number);
    if (!choices.length || !tileHasRings(spec)) return t;
    const id = choices.find((s) => !used.has(s.id))?.id ?? choices[reused++ % choices.length].id;
    used.add(id);
    return { ...t, id };
  });
}

/** A planet's diameter in cells, as printed on its tile. */
const planetSize = (number: number) => (PLANET_DIAMETER[number] ?? PLANET_DIAMETER[7]) / TILE.cell;

/**
 * The map drawn once into a canvas, each tile as its image is ready. Each planet stands up off it as a sphere
 * (Planets), so where the tile has it painted flat goes a shadow instead.
 */
function MapCanvas({
  board,
  cell,
  tiles,
  images,
}: {
  board: Board;
  cell: number;
  tiles: TileArt[];
  images: Record<string, HTMLImageElement>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
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
      const radius = (planetSize(p.number) / 2) * cell;
      const shadow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.35);
      shadow.addColorStop(0, 'rgba(5,8,19,.95)');
      shadow.addColorStop(0.72, 'rgba(5,8,19,.9)');
      shadow.addColorStop(1, 'rgba(5,8,19,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(x - radius * 1.4, y - radius * 1.4, radius * 2.8, radius * 2.8);
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
        {/* Under the top face, filling the tips of its rounded corners. */}
        <span className="backdrop-core" />
      </span>
    </span>
  );
});

/**
 * Keeps an upright thing (a planet, an explosion's flash) facing the camera: its turn against the map's
 * (.backdrop-face) runs on the map's clock, whenever it was added. Added in the same frame as the map, the map's
 * turn hasn't started yet (no start time, and setting a null one would stop the face's turn for good), so it
 * waits for the turn to start.
 */
function faceCamera(el: HTMLElement | null) {
  const named = (target: Element | null | undefined, name: string) =>
    target?.getAnimations().find((a) => (a as CSSAnimation).animationName === name);
  const turn = named(el?.closest('.backdrop-plane'), 'backdrop-turn');
  const face = named(el, 'backdrop-face');
  if (turn && face)
    turn.ready.then(
      () => (face.startTime = turn.startTime),
      () => {},
    );
}

/**
 * Each planet as a sphere above the map: its disc cut from its tile's artwork (shaded as a sphere lit from the
 * top left), standing up off the board and turned against the map's turn so it always faces the camera.
 */
function Planets({ board, tiles, images }: { board: Board; tiles: TileArt[]; images: Record<string, HTMLImageElement> }) {
  return board.planets.map((p) => {
    // A planet sits in the middle of its tile.
    const tile = tiles.find((t) => t.r === p.r - 1 && t.c === p.c - 1);
    const img = tile && images[tile.id];
    return (
      img && (
        <span
          key={p.id}
          ref={faceCamera}
          className="backdrop-planet"
          style={{ '--r': p.r, '--c': p.c, '--size': planetSize(p.number), backgroundImage: `url(${img.src})` } as CSSProperties}
        />
      )
    );
  });
}

function Plane({ map, fleet, still }: { map: MapDef; fleet: number; still: boolean }) {
  const board = useMemo(() => buildBoard(map), [map]);
  const tiles = useMemo(() => ringlessTiles(board), [board]);
  const images = useTileImages(tiles);
  const spaces = useMemo(() => openSpaces(board), [board]);
  const open = useMemo(() => new Set(spaces.map(at)), [spaces]);
  const cell = useCell(board);
  const [ships, setShips] = useState(() => launch(board, map.players, fleet));
  const [blasts, setBlasts] = useState<Blast[]>([]);
  // The ships as last set, for the timers; and the ships moving or in a battle, which sit out moves until done.
  const current = useRef(ships);
  const busy = useRef(new Set<number>());

  useEffect(() => {
    if (still) return;
    const timers = new Set<number>();
    const later = (ms: number, go: () => void) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        go();
      }, ms);
      timers.add(t);
    };
    const commit = (next: Ship[]) => {
      current.current = next;
      setShips(next);
    };
    const patch = (id: number, change: Partial<Ship>) => commit(current.current.map((s) => (s.id === id ? { ...s, ...change } : s)));

    /** Back near home with a fresh roll, once there's a free space there. */
    const respawn = (id: number) => {
      const ship = current.current.find((s) => s.id === id)!;
      const occupied = taken(current.current);
      const free = around(spaces, ship.home).filter((s) => !occupied.has(at(s)));
      if (!free.length) return later(STEP_MS, () => respawn(id));
      patch(id, { ...pick(free), value: roll(), rolls: ship.rolls + 1, down: false });
      busy.current.delete(id);
    };

    /** Once the attacker has arrived: one of the two blows up there. */
    const battle = (attacker: number, defender: number) => {
      const loser = Math.random() < ATTACKER_LOSES ? attacker : defender;
      const ship = current.current.find((s) => s.id === loser)!;
      const blast = { key: `${loser}:${ship.rolls}`, r: ship.r, c: ship.c, color: ship.color };
      patch(loser, { down: true });
      setBlasts((b) => [...b, blast]);
      later(EXPLOSION_MS, () => setBlasts((b) => b.filter((x) => x !== blast)));
      busy.current.delete(loser === attacker ? defender : attacker);
      later(RESPAWN_MS, () => respawn(loser));
    };

    /** A ship follows its path a space at a time, easing in at the start and out at the end; then it fights, if attacking. */
    const travel = ({ id, path, attack }: Travel) => {
      busy.current.add(id);
      if (attack !== undefined) busy.current.add(attack);
      const last = path.length - 1;
      path.forEach((spot, i) =>
        later(i * SPACE_MS, () =>
          patch(id, { ...spot, ease: last === 0 ? 'ease-in-out' : i === 0 ? 'ease-in' : i === last ? 'ease-out' : 'linear' }),
        ),
      );
      // Just before it comes to rest on the enemy's space.
      later(path.length * SPACE_MS - 60, () => {
        patch(id, { to: undefined });
        if (attack === undefined) busy.current.delete(id);
        else battle(id, attack);
      });
    };

    const timer = setInterval(() => {
      if (document.hidden) return;
      const { ships: next, travel: move } = step(current.current, open, busy.current);
      commit(next);
      if (move) travel(move);
    }, STEP_MS);
    return () => {
      clearInterval(timer);
      timers.forEach(clearTimeout);
    };
  }, [spaces, open, still]);

  return (
    <div
      className="backdrop-plane"
      style={{ '--cols': board.cols, '--rows': board.rows, '--cell': `${cell}px`, '--glide': `${SPACE_MS}ms` } as CSSProperties}
    >
      <MapCanvas board={board} cell={cell} tiles={tiles} images={images} />
      {/* Each explosion twice: its shock waves across the board, and its flash and sparks upright at die height. */}
      {blasts.map((b) => (
        <Boom
          key={b.key}
          color={b.color}
          style={{ transform: `translate(${b.c * cell}px, ${b.r * cell}px) translateZ(1px)`, width: cell, height: cell }}
        />
      ))}
      {blasts.map((b) => (
        <span key={b.key} ref={faceCamera} className="backdrop-blast" style={{ '--r': b.r, '--c': b.c } as CSSProperties}>
          <Boom color={b.color} style={{ width: '100%', height: '100%' }} />
        </span>
      ))}
      <Planets board={board} tiles={tiles} images={images} />
      {ships
        .filter((s) => !s.down)
        .map((s) => (
          <span key={s.id} className="backdrop-die" style={{ '--r': s.r, '--c': s.c, '--pc': s.color, '--ease': s.ease } as CSSProperties}>
            {/* Keyed by roll: a re-rolled (or returning) die drops and tumbles in afresh. */}
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
        {/* Keyed by map: a new map fades in with fresh fleets. And by motion: stopping cuts moves and returns
            short, which would leave ships stranded mid-way or down for good. */}
        <Plane key={`${map.id}:${fleet}:${still}`} map={map} fleet={fleet} still={still} />
      </div>
      <div className="backdrop-shade" />
    </div>
  );
}
