import { useEffect, useRef, type CSSProperties } from 'react';
import { cellOf, type Cell, type GameState } from '@quantum/engine';
import { reducedMotion } from '../../game/useMediaQuery';
import { isPlayStep, lastLogId, useTransient } from '../../game/useTransient';

/** A short effect on the map for one action: a ship warping in, flying (from `at` to `to`), re-rolling, or a planet conquered. */
type Effect =
  | { kind: 'deploy' | 'reroll' | 'conquer'; id: string; at: Cell; color: string }
  | { kind: 'trail'; id: string; at: Cell; to: Cell; color: string };

/** Every effect is over by then, so none slows play down. */
const EFFECT_MS = 500;

const sameCell = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;

/** What the step from `before` to `game` did on the map, as effects. */
function effectsOf(before: GameState, game: GameState): Effect[] {
  const step = lastLogId(game);
  const out: Effect[] = [];
  const was = new Map(before.dice.map((d) => [d.id, d]));
  for (const d of game.dice) {
    const p = was.get(d.id);
    const to = cellOf(d);
    if (!p || !to) continue;
    const from = cellOf(p);
    const fx = { id: `${d.id}:${step}`, at: to, color: game.players[d.owner].color };
    if (!from) out.push({ kind: 'deploy', ...fx });
    else if (!sameCell(from, to)) out.push({ kind: 'trail', ...fx, at: from, to });
    else if (d.rolls !== p.rolls || d.value !== p.value) out.push({ kind: 'reroll', ...fx });
  }
  for (const pl of game.board.planets) {
    const old = before.board.planets.find((x) => x.id === pl.id)?.cubes ?? [];
    const i = pl.cubes.findIndex((o, j) => o !== old[j]);
    if (i >= 0) out.push({ kind: 'conquer', id: `planet${pl.id}:${step}`, at: pl, color: game.players[pl.cubes[i]].color });
  }
  return out;
}

/** The effects of each step of play, each gone after EFFECT_MS. None under reduced motion. */
function useActionEffects(game: GameState): Effect[] {
  const [effects, show] = useTransient<Effect>(EFFECT_MS);
  const prev = useRef(game);
  useEffect(() => {
    const before = prev.current;
    prev.current = game;
    if (isPlayStep(before, game) && !reducedMotion()) show(effectsOf(before, game));
  }, [game, show]);
  return effects;
}

/** Over the ships, under explosions. Remounted for a jump to another position (`key`), so that shows none. */
export function ActionEffects({ game, cell }: { game: GameState; cell: number }) {
  return useActionEffects(game).map((e) => {
    const style: Record<string, string | number> = {
      transform: `translate(${e.at.c * cell}px, ${e.at.r * cell}px)`,
      width: cell,
      height: cell,
      '--pc': e.color,
    };
    if (e.kind === 'trail') {
      // From the space it left to the one it flew to, fading towards where it came from.
      const dx = e.to.c - e.at.c;
      const dy = e.to.r - e.at.r;
      style['--len'] = `${Math.hypot(dx, dy) * cell}px`;
      style['--angle'] = `${Math.atan2(dy, dx)}rad`;
    }
    return (
      <div key={e.id} className={`fx fx-${e.kind}`} style={style as CSSProperties} aria-hidden>
        <span />
        {/* Each effect but the trail is two parts (a flash and a ring, two arcs…). */}
        {e.kind !== 'trail' && <span />}
      </div>
    );
  });
}
