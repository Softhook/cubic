import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { SHIP_ABILITIES, SHIP_NAMES, die, key, type GameState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import { BoardArt } from './board/BoardArt';
import { Explosions } from './board/Explosions';
import { shipSpots } from './board/geometry';
import { Die3D } from './Die3D';
import { planetNames } from '../art/boardTiles';
import { InfoPop, useAnchorName } from './InfoPop';

/**
 * The size of a board space in pixels: as large as fits the container, within limits. `resizing` stays
 * true until the size has settled, so ships jump to their new spots with the map instead of gliding there.
 */
function useCellSize(wrap: RefObject<HTMLDivElement>, rows: number, cols: number): { cell: number; resizing: boolean } {
  const [cell, setCell] = useState(64);
  const [resizing, setResizing] = useState(false);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const size = Math.floor(Math.min(width / cols, height / rows));
      setCell(Math.max(8, Math.min(140, size)));
      setResizing(true);
      clearTimeout(settle);
      settle = setTimeout(() => setResizing(false), 200);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(settle);
    };
  }, [wrap, rows, cols]);
  return { cell, resizing };
}

/** A ship or planet whose info is showing, after a tap that had nothing else to do. */
type Inspect = { ship: string } | { planet: number };
const inspectKey = (i: Inspect) => ('ship' in i ? `ship:${i.ship}` : `planet:${i.planet}`);

/**
 * The map: artwork underneath (SVG), then clickable layers for highlighted spaces, planets and
 * ships, then explosions. What is clickable comes from the controller's highlights; a tap on a ship
 * or planet that isn't shows its info instead. `children` float over the map (positioned in percent
 * of its size).
 */
export function Board({ game, ctl, children }: { game: GameState; ctl: Controller; children?: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const { rows, cols, planets } = game.board;
  const { cell, resizing } = useCellSize(wrap, rows, cols);
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
    <div className="board-wrap" ref={wrap}>
      <div className={`board ${resizing ? 'resizing' : ''}`} style={{ width: cols * cell, height: rows * cell, '--cell': `${cell}px` } as CSSProperties}>
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
    </div>
  );
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
