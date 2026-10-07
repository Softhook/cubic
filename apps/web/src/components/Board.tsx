import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { SHIP_ABILITIES, SHIP_NAMES, die, key, type GameState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import { BoardArt } from './board/BoardArt';
import { Explosions } from './board/Explosions';
import { shipSpots } from './board/geometry';
import { ZOOM_LEARNED, useBoardZoom, type BoardZoom } from './board/useBoardZoom';
import { stored } from '../storage';
import { Die3D } from './Die3D';
import { planetNames } from '../art/boardTiles';
import { InfoPop, useAnchorName } from './InfoPop';

/** A ship or planet whose info is showing, after a tap that had nothing else to do. */
type Inspect = { ship: string } | { planet: number };
const inspectKey = (i: Inspect) => ('ship' in i ? `ship:${i.ship}` : `planet:${i.planet}`);

/**
 * The map: artwork underneath (SVG), then clickable layers for highlighted spaces, planets and
 * ships, then explosions. What is clickable comes from the controller's highlights; a tap on a ship
 * or planet that isn't shows its info instead. It fits its box, and zooms and pans (useBoardZoom).
 * `children` float over the map (positioned in percent of its size). `introduce` (the start of a game)
 * shows that it zooms, until the player has zoomed once.
 */
export function Board({ game, ctl, introduce, children }: { game: GameState; ctl: Controller; introduce?: boolean; children?: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { rows, cols, planets } = game.board;
  const zoom = useBoardZoom(wrap, boardRef, rows, cols);
  const { cell, resizing } = zoom;
  const tip = useZoomIntro(game, ctl, zoom, !!introduce);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  // The info closes itself on a tap elsewhere; a tap on the same thing again closes it too.
  const show = (what: Inspect) => setInspect((cur) => (cur && inspectKey(cur) === inspectKey(what) ? null : what));

  // A click on empty board (no highlight there) still reaches the controller, to clear a selection.
  const onBoardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    ctl.onCell({ r: Math.floor((e.clientY - rect.top) / cell), c: Math.floor((e.clientX - rect.left) / cell) });
  };

  return (
    <div className={`board-wrap ${zoom.zoomed ? 'zoomed' : ''}`} ref={wrap}>
      <div
        ref={boardRef}
        className={`board ${resizing ? 'resizing' : ''}`}
        style={{ left: zoom.x, top: zoom.y, width: cols * cell, height: rows * cell, '--cell': `${cell}px` } as CSSProperties}
      >
        <BoardArt game={game} cell={cell} />

        <div className="board-layer" onClick={onBoardClick}>
          {[...ctl.highlights.cells.values()].map(({ cell: c, tone }) => (
            <button
              key={key(c)}
              className={`hl hl-${tone}`}
              style={{ left: c.c * cell, top: c.r * cell, width: cell, height: cell }}
              onClick={() => ctl.onCell(c)}
              aria-label={`${tone} ${c.r},${c.c}`}
            >
              <span />
            </button>
          ))}

          {planets.map((p) => {
            const hl = ctl.highlights.planets.get(p.id);
            const free = p.capacity - p.cubes.length;
            return (
              <button
                key={p.id}
                className={`planet-hit ${hl ? `planet-${hl.tone}` : ''}`}
                style={{ left: p.c * cell, top: p.r * cell, width: cell, height: cell }}
                onClick={() => ctl.onPlanet(p.id) === false && show({ planet: p.id })}
                title={`${planetLabel(game, p.id)} · ${free} of ${p.capacity} cube location${p.capacity > 1 ? 's' : ''} free`}
              >
                {hl && <span className="planet-label">{hl.label}</span>}
              </button>
            );
          })}

          {/* Mouse users also get `title=` on ships and planets; touch screens get the tap. */}
          <Ships game={game} ctl={ctl} cell={cell} onInfo={(id) => show({ ship: id })} />
          <Explosions game={game} cell={cell} />
          {inspect && <BoardInfo key={inspectKey(inspect)} game={game} what={inspect} cell={cell} onClose={() => setInspect(null)} />}
        </div>
        {children}
      </div>
      {zoom.canZoom && <ZoomControls zoom={zoom} />}
      {zoom.zoomed && <OffscreenHints game={game} ctl={ctl} zoom={zoom} />}
      {tip && <div className="zoom-tip" role="status">{tip}</div>}
    </div>
  );
}

/**
 * Zoom in and out, and back to the whole map. On touch screens (where you pinch) only the last, and only
 * while zoomed, so the buttons don't cover the corner space of the whole map.
 */
function ZoomControls({ zoom }: { zoom: BoardZoom }) {
  return (
    <div className="zoom-controls">
      <button type="button" className="zoom-step" title="Zoom in" aria-label="Zoom in" onClick={() => zoom.zoomBy(1.5)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" className="zoom-step" title="Zoom out" aria-label="Zoom out" disabled={!zoom.zoomed} onClick={() => zoom.zoomBy(1 / 1.5)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      {zoom.zoomed && (
        <button type="button" title="Whole map" aria-label="Whole map" onClick={zoom.fit}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
      )}
    </div>
  );
}

/** How long the "pinch to zoom" tip shows, from the start of the demo. */
const TIP_MS = 4200;

/**
 * Once per board, when `introduce` first holds and zooming does something here: zooms in on a glowing
 * planet (or the middle of the map) and back out, under a tip saying how to zoom. Not once the player
 * has zoomed (ZOOM_LEARNED); with reduced motion, only the tip. Returns the tip's text while it shows.
 */
function useZoomIntro(game: GameState, ctl: Controller, zoom: BoardZoom, introduce: boolean): string | null {
  const [tip, setTip] = useState<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !introduce || !zoom.canZoom || stored(ZOOM_LEARNED)) return;
    done.current = true;
    const glowing = game.board.planets.find((p) => ctl.highlights.planets.has(p.id));
    const spot = glowing ?? { r: (game.board.rows - 1) / 2, c: (game.board.cols - 1) / 2 };
    setTip(matchMedia('(pointer: coarse)').matches ? 'Pinch to zoom the map' : 'Scroll or press + to zoom the map');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) zoom.demo(spot.r, spot.c);
  });
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), TIP_MS);
    return () => clearTimeout(t);
  }, [tip]);
  return tip;
}

type Side = 'left' | 'right' | 'top' | 'bottom';
const ARROWS: Record<Side, string> = { left: 'm15 6-6 6 6 6', right: 'm9 6 6 6-6 6', top: 'm6 15 6-6 6 6', bottom: 'm6 9 6 6 6-6' };

/**
 * Zoomed in: an arrow at each edge beyond which something is highlighted (a space, planet or ship you
 * can pick), with how many; a tap brings the nearest into view.
 */
function OffscreenHints({ game, ctl, zoom }: { game: GameState; ctl: Controller; zoom: BoardZoom }) {
  const spots = shipSpots(game);
  const targets = [
    ...[...ctl.highlights.cells.values()].map((h) => h.cell),
    ...game.board.planets.filter((p) => ctl.highlights.planets.has(p.id)),
    ...[...ctl.highlights.dice.keys()].flatMap((id) => spots.get(id) ?? []),
  ];
  // What's on screen, in spaces.
  const left = -zoom.x / zoom.cell, right = (zoom.w - zoom.x) / zoom.cell;
  const top = -zoom.y / zoom.cell, bottom = (zoom.h - zoom.y) / zoom.cell;
  const midR = (top + bottom) / 2, midC = (left + right) / 2;
  const beyond = new Map<Side, { r: number; c: number; d: number }[]>();
  for (const { r, c } of targets) {
    const over: [Side, number][] = [
      ['left', left - (c + 0.5)],
      ['right', c + 0.5 - right],
      ['top', top - (r + 0.5)],
      ['bottom', r + 0.5 - bottom],
    ];
    const [side, by] = over.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (by <= 0) continue;
    beyond.set(side, [...(beyond.get(side) ?? []), { r, c, d: Math.hypot(r + 0.5 - midR, c + 0.5 - midC) }]);
  }
  return [...beyond].map(([side, list]) => {
    const near = list.reduce((a, b) => (b.d < a.d ? b : a));
    return (
      <button key={side} type="button" className={`zoom-hint zoom-hint-${side}`} aria-label={`${list.length} more ${side === 'top' ? 'above' : side === 'bottom' ? 'below' : `to the ${side}`}`} onClick={() => zoom.centreOn(near.r, near.c)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ARROWS[side]} /></svg>
        {list.length > 1 && <span>{list.length}</span>}
      </button>
    );
  });
}

/** Every ship on the map, as a die; selected, highlighted, spent or in combat. */
function Ships({ game, ctl, cell, onInfo }: { game: GameState; ctl: Controller; cell: number; onInfo: (id: string) => void }) {
  const head = game.pending[0];
  const combat = head?.kind === 'combat' ? head : null;
  const me = game.turn.player;
  const spots = shipSpots(game);
  return game.dice.map((d) => {
    const at = spots.get(d.id);
    if (!at) return null;
    const { r, c } = at;
    const tone = ctl.highlights.dice.get(d.id);
    const selected = 'die' in ctl.sel && ctl.sel.die === d.id;
    const mine = d.owner === me && game.phase === 'play' && !head;
    const spent = mine && (game.turn.moved[d.id] ?? 0) > 0;
    const abilityUsed = mine && game.turn.abilityUsed[d.id];
    const fighting = combat && (combat.attacker.die === d.id || combat.defender.die === d.id);
    return (
      <div
        key={d.id}
        className={[
          'ship',
          selected && 'selected',
          tone && `ship-${tone}`,
          spent && 'spent',
          fighting && 'fighting',
          ctl.actionPhase && d.owner === me && 'own',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ transform: `translate(${c * cell}px, ${r * cell}px)`, width: cell, height: cell, '--pc': game.players[d.owner].color } as CSSProperties}
        onClick={() => ctl.onDie(d.id) === false && onInfo(d.id)}
        aria-label={`${game.players[d.owner].name}'s ${SHIP_NAMES[d.value]} (${d.value})`}
        title={`${game.players[d.owner].name} · ${SHIP_NAMES[d.value]} (${d.value})\n${SHIP_ABILITIES[d.value].name}: ${SHIP_ABILITIES[d.value].text}`}
      >
        <div className="ship-ring" />
        <Die3D value={d.value} rolls={d.rolls} size={cell * 0.56} color={game.players[d.owner].color} />
        {abilityUsed && <span className="ship-badge" aria-label="Ability used this turn">✦</span>}
      </div>
    );
  });
}

/** The info bubble for a ship or planet, anchored to its space on the map. */
function BoardInfo({ game, what, cell, onClose }: { game: GameState; what: Inspect; cell: number; onClose: () => void }) {
  const anchor = useAnchorName();
  const spot = 'ship' in what ? shipSpots(game).get(what.ship) : game.board.planets.find((p) => p.id === what.planet);
  if (!spot) return null; // the ship left the map
  return (
    <>
      <div className="info-anchor" style={{ left: spot.c * cell, top: spot.r * cell, width: cell, height: cell, '--anchor': anchor } as CSSProperties} />
      <InfoPop anchor={anchor} onClose={onClose}>
        {'ship' in what ? <ShipInfo game={game} id={what.ship} /> : <PlanetInfo game={game} id={what.planet} />}
      </InfoPop>
    </>
  );
}

/** What a ship is: whose, which, and its ability. */
function ShipInfo({ game, id }: { game: GameState; id: string }) {
  const d = die(game, id);
  const ability = SHIP_ABILITIES[d.value];
  const p = game.players[d.owner];
  return (
    <>
      <div className="info-title" style={{ '--pc': p.color } as CSSProperties}>
        <span className="info-swatch" /> {p.name}'s {SHIP_NAMES[d.value]} <span className="muted">({d.value})</span>
      </div>
      <div>
        <b>{ability.name}:</b> {ability.text}
      </div>
      {d.owner === game.turn.player && game.turn.abilityUsed[d.id] && <div className="muted">✦ Ability used this turn.</div>}
    </>
  );
}

/** A planet's name and number, as the log shows it: "Thalassa Prime (9)". */
function planetLabel(game: GameState, id: number): string {
  const p = game.board.planets.find((x) => x.id === id)!;
  const name = planetNames(game.board).get(id);
  return name ? `${name} (${p.number})` : `Planet ${p.number}`;
}

/** A planet's name, its free cube spaces and whose cubes are on it. */
function PlanetInfo({ game, id }: { game: GameState; id: number }) {
  const p = game.board.planets.find((x) => x.id === id)!;
  const free = p.capacity - p.cubes.length;
  return (
    <>
      <div className="info-title">{planetLabel(game, id)}</div>
      <div>
        {free} of {p.capacity} cube space{p.capacity > 1 ? 's' : ''} free.
      </div>
      {p.cubes.map((owner, i) => (
        <div key={i} className="info-title" style={{ '--pc': game.players[owner].color } as CSSProperties}>
          <span className="info-swatch" /> {game.players[owner].name}'s cube
        </div>
      ))}
    </>
  );
}
