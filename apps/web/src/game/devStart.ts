import { createGame, defaultMap, MAPS, MODES, type GameState } from '@quantum/engine';
import { DEFAULT_AI_LEVEL } from '@quantum/ai';
import { AI_NAMES } from '../components/Lobby';
import { PLAYER_COLORS } from '../theme';

/**
 * Dev server only: a link that skips the lobby, for checking a layout on a phone and for
 * scripts/mobile-shots.ts. `?play=classic&players=4&map=tesseract&seed=7` starts that game with
 * one human (Commander) and AI opponents. `play` is a mode's id or name; `map` defaults to the
 * basic map for the player count; `seed` makes the dice the same every time. Reloading starts the
 * game again. Like any game on this device, it replaces the saved game.
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
  return createGame({
    players: Array.from({ length: players }, (_, i) => ({
      name: i === 0 ? 'Commander' : AI_NAMES[i],
      color: PLAYER_COLORS[i],
      ai: i !== 0,
      aiLevel: DEFAULT_AI_LEVEL,
    })),
    mapId: map.id,
    mode: rules.id,
    seed: Number.isFinite(seed) && q.has('seed') ? seed : undefined,
  });
}
