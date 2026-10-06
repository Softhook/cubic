import { apply, canRespondToCombat, createGame, defaultMap, isEmptySpace, legalActions, MAPS, MODES, tryApply, type GameState } from '@quantum/engine';
import { DEFAULT_AI_LEVEL } from '@quantum/ai';
import { defaultSeat } from './seats';

/**
 * Dev server only: a link that skips the lobby, for checking a layout on a phone and for
 * scripts/mobile-shots.ts. `?play=classic&players=4&map=tesseract&seed=7` starts that game with
 * one human (Commander) and AI opponents. `play` is a mode's id or name; `map` defaults to the
 * basic map for the player count; `seed` makes the dice the same every time. Reloading starts the
 * game again. Like any game on this device, it replaces the saved game.
 * `scene=combat|changeOfHeart|over` opens on that popup instead, `scene=turn` on your first turn (see `scene`).
 */
export function devStartGame(): GameState | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(location.search);
  const play = q.get('play')?.toLowerCase();
  if (!play) return null;
  const rules = MODES.find((m) => m.id === play || m.name.toLowerCase() === play);
  const map = q.get('map') ? MAPS.find((m) => m.id === q.get('map')) : defaultMap(Number(q.get('players') ?? 2));
  const players = Number(q.get('players') ?? map?.players);
  const seed = Number(q.get('seed'));
  if (!rules || !map || map.players !== players || !rules.mapGroups.includes(map.group)) {
    console.warn(`?play: ${rules?.name ?? play} has no ${players}-player map "${q.get('map') ?? 'default'}"`);
    return null;
  }
  const game = createGame({
    players: Array.from({ length: players }, (_, i) => defaultSeat(i, i !== 0, DEFAULT_AI_LEVEL)),
    mapId: map.id,
    mode: rules.id,
    seed: Number.isFinite(seed) && q.has('seed') ? seed : undefined,
  });
  return q.get('scene') ? scene(game, q.get('scene')!) : game;
}

/**
 * Plays every seat's first choice through setup and on to the human's (player 0's) first turn, then
 * opens a popup: `combat` (the human's ship attacks and may answer, e.g. with a missile in Community), `changeOfHeart` (needs a mode with cards) or
 * `over` (the human has won). `turn`, or a scene that can't be set up, stops at that turn.
 */
function scene(game: GameState, name: string): GameState {
  let s = game;
  for (let i = 0; i < 500 && (s.phase === 'setup' || s.turn.player !== 0 || s.pending.length); i++) {
    const options = legalActions(s);
    s = apply(s, options.find((a) => a.type === 'endTurn') ?? options[0]);
  }
  s = structuredClone(s);
  if (name === 'over') return { ...s, phase: 'over', winner: 0 };
  if (name === 'changeOfHeart') {
    if (s.market.skillDeck.length) s.pending.unshift({ kind: 'changeOfHeart', player: 0 });
    return s;
  }
  if (name !== 'combat') return s;
  // Two empty spaces side by side: one of the human's ships attacks one of the next player's, trying
  // ship values until the human can answer the roll (so the battle waits, with its buttons).
  const free = [...Array(s.board.rows * s.board.cols).keys()]
    .map((i) => ({ r: Math.floor(i / s.board.cols), c: i % s.board.cols }))
    .find(({ r, c }) => isEmptySpace(s, { r, c }) && isEmptySpace(s, { r, c: c + 1 }));
  if (!free) return s;
  let fallback: GameState | null = null;
  for (const a of [6, 5, 4, 3, 2, 1]) {
    for (const d of [1, 2, 3, 4, 5, 6]) {
      const t = structuredClone(s);
      const [mine, theirs] = [t.dice.find((x) => x.owner === 0)!, t.dice.find((x) => x.owner === 1)!];
      Object.assign(mine, { loc: { zone: 'board', ...free }, value: a });
      Object.assign(theirs, { loc: { zone: 'board', r: free.r, c: free.c + 1 }, value: d });
      t.turn.seen[mine.id] = [a];
      t.turn.seen[theirs.id] = [d];
      const attacked = tryApply(t, { type: 'attack', die: mine.id, target: theirs.id });
      const head = attacked?.pending[0];
      if (head?.kind !== 'combat') continue;
      if (canRespondToCombat(attacked!, head, 0)) return attacked!;
      fallback ??= attacked;
    }
  }
  return fallback ?? s;
}
