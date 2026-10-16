import type { ReactNode } from 'react';
import { cellOf, effectOf, type Cell, type GameState } from '@quantum/engine';
import { lastLogId } from '../../game/useTransient';
import { GATE_COLOR } from './BoardArt';
import { EffectBox, useStepEffects, type MapEffect } from './stepEffects';

/**
 * A card's mark on the map, over the plain action effects (ActionEffects): Show of Force striking a ship,
 * Warp Gates linked (the board draws the gates themselves), a cube relocated, an expansion ship arriving,
 * a fleet cloaked and unveiled, a ship number nudged (Flexible, Clever) or a ship scrapped (Resourceful).
 */
type CardEffect = MapEffect &
  ({ kind: 'strike' | 'expansion' | 'cloak' | 'decloak' | 'implode' | 'raise' | 'lower' } | { kind: 'beam'; to: Cell });

/** Longer than a plain action's effect: cards are rare, and worth a moment. */
const CARD_EFFECT_MS = 900;

const gatesKey = (g: GameState) => g.gates.map((c) => `${c.r},${c.c}`).join(' ');
const cubesOf = (g: GameState, planet: number, owner: number) => g.board.planets[planet].cubes.filter((x) => x === owner).length;

/** What a card did on the map in the step from `before` to `game`, as effects. */
function cardEffectsOf(before: GameState, game: GameState): CardEffect[] {
  const step = lastLogId(game);
  const out: CardEffect[] = [];
  const head = before.pending[0];
  // Unveil the Fleet takes the player's ships off the map as it is played; Reorganization each one it re-rolls.
  const unveiling = (head?.kind === 'unveil' && head.reorganize) || (head?.kind !== 'unveil' && game.pending[0]?.kind === 'unveil');
  const colorOf = (p: number) => game.players[p].color;
  const was = new Map(before.dice.map((d) => [d.id, d]));
  // The skill cards this step used (the engine names each on the entry its owner logged).
  const used = new Set(game.log.filter((e) => e.id > lastLogId(before) && e.card).map((e) => effectOf(e.card!)));

  for (const d of game.dice) {
    const p = was.get(d.id);
    if (!p) continue;
    const from = cellOf(p);
    const to = cellOf(d);
    const fx = { id: `${d.id}:${step}`, color: colorOf(d.owner) };
    if (from && !to) {
      if (head?.kind === 'showOfForce') out.push({ kind: 'strike', ...fx, at: from, color: colorOf(head.player) });
      else if (used.has('resourceful')) out.push({ kind: 'implode', ...fx, at: from });
      else if (unveiling) out.push({ kind: 'cloak', ...fx, at: from });
    } else if (!from && to) {
      if (head?.kind === 'placeExpansion') out.push({ kind: 'expansion', ...fx, at: to });
      else if (head?.kind === 'unveil') out.push({ kind: 'decloak', ...fx, at: to });
    } else if (from && to && d.value !== p.value && d.rolls === p.rolls && (head?.kind === 'clever' || used.has('flexible'))) {
      out.push({ kind: d.value > p.value ? 'raise' : 'lower', ...fx, at: to });
    }
  }

  if (head?.kind === 'relocation') {
    // The cube left one planet and landed on another.
    for (let o = 0; o < game.players.length; o++) {
      const src = game.board.planets.find((pl) => cubesOf(game, pl.id, o) < cubesOf(before, pl.id, o));
      const dst = game.board.planets.find((pl) => cubesOf(game, pl.id, o) > cubesOf(before, pl.id, o));
      if (src && dst) {
        out.push({ kind: 'implode', id: `uproot:${step}`, at: src, color: colorOf(o) });
        out.push({ kind: 'beam', id: `relocate:${step}`, at: src, to: dst, color: colorOf(o) });
      }
    }
  }

  if (game.gates.length === 2 && gatesKey(game) !== gatesKey(before)) {
    const [a, b] = game.gates;
    out.push({ kind: 'beam', id: `gates:${step}`, at: a, to: b, color: GATE_COLOR });
  }
  return out;
}

/** A chevron pointing up (turned over to point down). */
const chevron = (
  <svg viewBox="0 0 20 12">
    <polyline points="2,10 10,2 18,10" />
  </svg>
);
const chevrons = (
  <span className="cfx-chevrons">
    {chevron}
    {chevron}
  </span>
);
const shimmer = (
  <>
    <span className="cfx-shimmer" />
    <span className="cfx-veil" />
  </>
);

/** Each effect's parts. A part's class never names an effect's kind, so the box (`cfx-<kind>`) can't take its styles. */
const PARTS: Record<CardEffect['kind'], ReactNode> = {
  strike: (
    <>
      <span className="cfx-reticle" />
      <span className="cfx-lance" />
    </>
  ),
  expansion: (
    <>
      <span className="cfx-lance" />
      <span className="cfx-halo" />
      <span className="cfx-halo late" />
    </>
  ),
  cloak: shimmer,
  decloak: shimmer,
  implode: (
    <>
      <span className="cfx-collapse" />
      <span className="cfx-collapse late" />
      <span className="cfx-core" />
    </>
  ),
  raise: chevrons,
  lower: chevrons,
  beam: (
    <span className="cfx-ray">
      <i />
    </span>
  ),
};

/** Over the ships and explosions. Remounted for a jump to another position (`key`), so that shows none. */
export function CardEffects({ game, cell }: { game: GameState; cell: number }) {
  return useStepEffects(game, CARD_EFFECT_MS, cardEffectsOf).map((e) => (
    <EffectBox key={e.id} e={e} cell={cell} className={`cfx cfx-${e.kind}`}>
      {PARTS[e.kind]}
    </EffectBox>
  ));
}
