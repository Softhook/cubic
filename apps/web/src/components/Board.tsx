import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { SHIP_NAMES, die, key, moveOptions, shipOf, type GameState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import { BoardArt } from './board/BoardArt';
import { Explosions } from './board/Explosions';
import { shipSpots, type ShipSpots } from './board/geometry';
import { useBoardZoom } from './board/useBoardZoom';
import { OffscreenHints, ZoomControls, useFollowMoves, useZoomIntro } from './board/ZoomUi';
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
 * shows that it zooms.
 */
export function Board({ game, ctl, introduce, children }: { game: GameState; ctl: Controller; introduce?: boolean; children?: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { rows, cols, planets } = game.board;
  const zoom = useBoardZoom(wrap, boardRef, rows, cols);
  const { cell } = zoom;
  const spots = shipSpots(game);
  const tip = useZoomIntro(game, ctl, zoom, !!introduce);
  useFollowMoves(game, ctl, spots, zoom);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  // The info closes itself on a tap elsewhere; a tap on the same thing again closes it too.
  const show = (what: Inspect) => setInspect((cur) => (cur && inspectKey(cur) === inspectKey(what) ? null : what));
  // Another player's ship shows how far it can move: while a finger is on it, or while a mouse click's info is open.
  const [held, setHeld] = useState<string | null>(null);
  const viaMouse = useRef(false);
  useEffect(() => {
    if (!held) return;
    const off = () => setHeld(null);
    window.addEventListener('pointerup', off);
    window.addEventListener('pointercancel', off);
    return () => {
      window.removeEventListener('pointerup', off);
      window.removeEventListener('pointercancel', off);
    };
  }, [held]);
  const reachOf = held ?? (inspect && 'ship' in inspect && viaMouse.current && !yoursOf(game, ctl)(die(game, inspect.ship).owner) ? inspect.ship : null);

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
        className="board"
        style={{ left: zoom.x, top: zoom.y, width: cols * cell, height: rows * cell, '--cell': `${cell}px` } as CSSProperties}
      >
        <BoardArt game={game} cell={cell} />

        <div className="board-layer" onClick={onBoardClick}>
          {[...ctl.highlights.cells.values()].map(({ cell: c, tone }) => (
            <button
              key={key(c)}
              className={`hl hl-${tone}`}
              data-r={c.r}
              data-c={c.c}
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
                data-r={p.r}
                data-c={p.c}
                style={{ left: p.c * cell, top: p.r * cell, width: cell, height: cell }}
                onClick={() => ctl.onPlanet(p.id) === false && show({ planet: p.id })}
                title={`${planetLabel(game, p.id)} · ${free} of ${p.capacity} cube location${p.capacity > 1 ? 's' : ''} free`}
              >
                {hl && <span className="planet-label">{hl.label}</span>}
              </button>
            );
          })}

          {reachOf && <Reach game={game} id={reachOf} cell={cell} spots={spots} />}

          {/* Mouse users also get `title=` on ships and planets; touch screens get the tap. */}
          <Ships
            game={game}
            ctl={ctl}
            zoomed={zoom.zoomed}
            spots={spots}
            cell={cell}
            onInfo={(id) => show({ ship: id })}
            onPress={(id, touch) => {
              viaMouse.current = !touch;
              if (touch) setHeld(id);
            }}
          />
          <Explosions game={game} cell={cell} />
          {inspect && <BoardInfo key={inspectKey(inspect)} game={game} spots={spots} what={inspect} cell={cell} onClose={() => setInspect(null)} />}
        </div>
        {children}
      </div>
      {zoom.canZoom && <ZoomControls zoom={zoom} />}
      {zoom.zoomed && <OffscreenHints game={game} ctl={ctl} spots={spots} zoom={zoom} />}
      {tip && <div className="zoom-tip" role="status">{tip}</div>}
    </div>
  );
}

/** Your ships: those of the seats this screen plays; sharing a screen, those of whoever's turn it is. */
const yoursOf = (game: GameState, ctl: Controller) => (owner: number) => ctl.mine(owner) && (owner === game.turn.player || !ctl.mine(game.turn.player));

/**
 * The spaces another player's ship could move to with a plain move: its movement (with its owner's
 * skills), diagonally too for an Interceptor with its ability. Every ship it could reach to attack
 * gets a ring, above the ships. Only shown, not clickable.
 */
function Reach({ game, id, cell, spots }: { game: GameState; id: string; cell: number; spots: ShipSpots }) {
  const d = game.dice.find((x) => x.id === id);
  if (d?.loc.zone !== 'board') return null;
  const { moves, attacks } = moveOptions(game, id);
  const threatened = [...attacks.keys()].flatMap((t) => (spots.get(t) ? [{ id: t, at: spots.get(t)! }] : []));
  const style = { '--pc': game.players[d.owner].color } as CSSProperties;
  return (
    <>
      <div className="reach" style={style}>
        {[...moves.values()].map(({ cell: c }) => (
          <span key={key(c)} style={{ left: c.c * cell, top: c.r * cell, width: cell, height: cell }}>
            <span />
          </span>
        ))}
      </div>
      <div className="reach reach-attack" style={style}>
        {threatened.map(({ id: t, at }) => (
          <span key={t} style={{ left: at.c * cell, top: at.r * cell, width: cell, height: cell }}>
            <span />
          </span>
        ))}
      </div>
    </>
  );
}

/** Every ship on the map, as a die; selected, highlighted, spent or in combat. `onPress`: a pointer went down on another player's ship. */
function Ships({
  game,
  ctl,
  zoomed,
  spots,
  cell,
  onInfo,
  onPress,
}: {
  game: GameState;
  ctl: Controller;
  zoomed: boolean;
  spots: ShipSpots;
  cell: number;
  onInfo: (id: string) => void;
  onPress: (id: string, touch: boolean) => void;
}) {
  const head = game.pending[0];
  const combat = head?.kind === 'combat' ? head : null;
  const me = game.turn.player;
  const yours = yoursOf(game, ctl);
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
    // An attack target shows the chance to win on the map itself: no hover on a touch screen, and
    // a tap attacks. The cards behind it are in the title and the ship panel.
    const attack = ctl.attacks.get(d.id);
    const { ability } = shipOf(game, d.value);
    const who = `${game.players[d.owner].name} · ${SHIP_NAMES[d.value]} (${d.value})`;
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
          yours(d.owner) && 'yours',
        ]
          .filter(Boolean)
          .join(' ')}
        data-r={r}
        data-c={c}
        // In percent of its own size (one space), so a zoom or resize doesn't count as a move and glide.
        style={{ transform: `translate(${c * 100}%, ${r * 100}%)`, width: cell, height: cell, '--pc': game.players[d.owner].color } as CSSProperties}
        onClick={() => ctl.onDie(d.id) === false && onInfo(d.id)}
        onPointerDown={yours(d.owner) ? undefined : (e) => onPress(d.id, e.pointerType !== 'mouse')}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`${game.players[d.owner].name}'s ${SHIP_NAMES[d.value]} (${d.value})${attack ? `, ${percent(attack.chance)} chance to win an attack` : ''}`}
        title={
          attack
            ? [`Attack ${who}: ${percent(attack.chance)} to win`, ...attack.factors.attacker.map((f) => `You: ${f}`), ...attack.factors.defender.map((f) => `Them: ${f}`)].join('\n')
            : `${who}\n${ability.name}: ${ability.text}`
        }
      >
        <div className="ship-ring" />
        <Die3D value={d.value} rolls={d.rolls} size={cell * 0.56} color={game.players[d.owner].color} />
        {abilityUsed && <span className="ship-badge" aria-label="Ability used this turn">✦</span>}
        {attack && <OddsBadge chance={attack.chance} cell={cell} zoomed={zoomed} />}
      </div>
    );
  });
}

/** The info bubble for a ship or planet, anchored to its space on the map. */
function BoardInfo({ game, spots, what, cell, onClose }: { game: GameState; spots: ShipSpots; what: Inspect; cell: number; onClose: () => void }) {
  const anchor = useAnchorName();
  const spot = 'ship' in what ? spots.get(what.ship) : game.board.planets.find((p) => p.id === what.planet);
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
  const ability = shipOf(game, d.value).ability;
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

/**
 * An attack target's chance to win, on its space's top-right corner, sticking out of it (above the
 * map's edge too). Zoomed in, the map is clipped to its area: where that would cut the badge off,
 * it moves inside, below or to the left.
 */
function OddsBadge({ chance, cell, zoomed }: { chance: number; cell: number; zoomed: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [flip, setFlip] = useState({ below: false, left: false });
  useEffect(() => {
    const badge = ref.current!;
    const ship = badge.parentElement!;
    // Not zoomed in, only the screen's edge can cut it off.
    const root = zoomed ? ship.closest('.board-wrap') : null;
    // How far the badge sticks out of the space (see .ship-odds): the ship must be this far inside.
    const { width, height } = badge.getBoundingClientRect();
    const up = Math.ceil(height * 0.3);
    const right = Math.ceil(width * 0.3);
    const io = new IntersectionObserver(
      ([e]) => {
        const b = e.rootBounds;
        if (b) setFlip({ below: e.boundingClientRect.top < b.top, left: e.boundingClientRect.right > b.right });
      },
      { root, rootMargin: `-${up}px -${right}px 0px 0px`, threshold: 1 },
    );
    io.observe(ship);
    return () => io.disconnect();
  }, [cell, zoomed]);
  const tone = chance >= 0.6 ? 'good' : chance <= 0.4 ? 'bad' : '';
  return (
    <span ref={ref} className={['ship-odds', tone, flip.below && 'below', flip.left && 'left'].filter(Boolean).join(' ')} aria-hidden>
      {/* The % sign smaller: a narrower badge. */}
      {percent(chance).replace('%', '')}
      <small>%</small>
    </span>
  );
}

/** A chance as a whole percentage; never 0% or 100% unless it is certain. */
function percent(p: number): string {
  const n = Math.round(p * 100);
  return p > 0 && n === 0 ? '<1%' : p < 1 && n === 100 ? '>99%' : `${n}%`;
}
