import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import { SHIP_ABILITIES, SHIP_NAMES, key, type GameState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import { BoardArt } from './board/BoardArt';
import { Explosions } from './board/Explosions';
import { shipSpots } from './board/geometry';
import { Die3D } from './Die3D';

/** The size of a board space in pixels: as large as fits the container, within limits. */
function useCellSize(wrap: RefObject<HTMLDivElement>, rows: number, cols: number): number {
  const [cell, setCell] = useState(64);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const size = Math.floor(Math.min(width / cols, height / rows));
      setCell(Math.max(34, Math.min(92, size)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrap, rows, cols]);
  return cell;
}

/**
 * The map: artwork underneath (SVG), then clickable layers for highlighted spaces, planets and
 * ships, then explosions. What is clickable comes from the controller's highlights.
 */
export function Board({ game, ctl }: { game: GameState; ctl: Controller }) {
  const wrap = useRef<HTMLDivElement>(null);
  const { rows, cols, planets } = game.board;
  const cell = useCellSize(wrap, rows, cols);

  // A click on empty board (no highlight there) still reaches the controller, to clear a selection.
  const onBoardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    ctl.onCell({ r: Math.floor((e.clientY - rect.top) / cell), c: Math.floor((e.clientX - rect.left) / cell) });
  };

  return (
    <div className="board-wrap" ref={wrap}>
      <div className="board" style={{ width: cols * cell, height: rows * cell, '--cell': `${cell}px` } as CSSProperties}>
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
                onClick={() => ctl.onPlanet(p.id)}
                title={`Planet ${p.number} · ${free} of ${p.capacity} cube location${p.capacity > 1 ? 's' : ''} free`}
              >
                {hl && <span className="planet-label">{hl.label}</span>}
              </button>
            );
          })}

          <Ships game={game} ctl={ctl} cell={cell} />
          <Explosions game={game} cell={cell} />
        </div>
      </div>
    </div>
  );
}

/** Every ship on the map, as a die; selected, highlighted, spent or in combat. */
function Ships({ game, ctl, cell }: { game: GameState; ctl: Controller; cell: number }) {
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
        onClick={() => ctl.onDie(d.id)}
        title={`${game.players[d.owner].name} · ${SHIP_NAMES[d.value]} (${d.value})\n${SHIP_ABILITIES[d.value].name}: ${SHIP_ABILITIES[d.value].text}`}
      >
        <div className="ship-ring" />
        <Die3D value={d.value} rolls={d.rolls} size={cell * 0.56} color={game.players[d.owner].color} />
        {abilityUsed && <span className="ship-badge" title="Ability used this turn">✦</span>}
      </div>
    );
  });
}
