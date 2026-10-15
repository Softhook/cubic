import { AI_LEVELS, DEFAULT_AI_LEVEL } from '@quantum/ai';
import { defaultMap, MAPS, MODES, type GameMode, type PlayerConfig } from '@quantum/engine';
import { stored } from '../../storage';

/** Online, human seats after the first are left open for friends to claim. */
export const isFriendSeat = (seat: PlayerConfig, index: number, online: boolean) => online && index > 0 && !seat.ai;

export const PLAYER_COUNTS = [...new Set(MAPS.map((m) => m.players))];

/** What the lobby remembers between visits: the last choices. */
export const AI_LEVEL_KEY = 'quantum.aiLevel';
export const MODE_KEY = 'quantum.mode';
export const mapKey = (players: number) => `quantum.map.${players}`;

export function storedAiLevel(): number {
  const n = Number(stored(AI_LEVEL_KEY));
  return AI_LEVELS.some((l) => l.level === n) ? n : DEFAULT_AI_LEVEL;
}

export function storedMode(): GameMode {
  const saved = stored(MODE_KEY);
  return MODES.find((m) => m.id === saved || (saved === 'cubic' && m.id === 'prototyping'))?.id ?? 'community';
}

export function storedMap(players: number): string {
  const id = stored(mapKey(players));
  return MAPS.find((m) => m.id === id && m.players === players)?.id ?? defaultMap(players)!.id;
}
