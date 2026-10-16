import { cellOf, same, type Cell, type GameState } from '@quantum/engine';
import { lastLogId } from '../../game/useTransient';
import { EffectBox, useStepEffects, type MapEffect } from './stepEffects';

/** A short effect on the map for one action: a ship warping in, flying (from `at` to `to`), or a planet conquered. */
type Effect = MapEffect & ({ kind: 'deploy' | 'conquer' } | { kind: 'trail'; to: Cell });

/** Every effect is over by then, so none slows play down. */
const EFFECT_MS = 500;

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
    else if (!same(from, to)) out.push({ kind: 'trail', ...fx, at: from, to });
  }
  for (const pl of game.board.planets) {
    const old = before.board.planets.find((x) => x.id === pl.id)?.cubes ?? [];
    const i = pl.cubes.findIndex((o, j) => o !== old[j]);
    if (i >= 0) out.push({ kind: 'conquer', id: `planet${pl.id}:${step}`, at: pl, color: game.players[pl.cubes[i]].color });
  }
  return out;
}

/** Over the ships, under explosions. Remounted for a jump to another position (`key`), so that shows none. */
export function ActionEffects({ game, cell }: { game: GameState; cell: number }) {
  return useStepEffects(game, EFFECT_MS, effectsOf).map((e) => (
    <EffectBox key={e.id} e={e} cell={cell} className={`fx fx-${e.kind}`}>
      <span />
      {/* Each effect but the trail is two parts (a flash and a ring, a shockwave and a glow). */}
      {e.kind !== 'trail' && <span />}
    </EffectBox>
  ));
}
