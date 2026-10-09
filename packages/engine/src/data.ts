import cardsJson from './data/cards.json';
import mapsJson from './data/maps.json';
import type { ShipHooks } from './prototype';

export interface CardDef {
  id: string;
  name: string;
  subtitle: string;
  text: string;
  /** Sets the card's accent colour and icon (data/cards.yaml). */
  category: string;
  ce_status: string;
  count: number;
  notes?: string;
  /** Rule implementation this card uses; defaults to its id. Shared when two editions' cards behave the same. */
  effect?: string;
  /** Community cards: the 2013 card this one redesigns (data/cards.yaml). */
  classic?: string;
}

export type GameMode = 'basic' | 'original' | 'community' | 'cubic';


export interface MapDef {
  id: string;
  name: string;
  players: number;
  group: string;
  cubes: number;
  stats: { slack: number; shared: number | null; planets: number };
  /** Edges that join: leaving one edge of a row or column re-enters at its opposite edge. */
  wrap?: 'horizontal' | 'vertical' | 'both';
  layout: string[][];
}

export const SKILLS: CardDef[] = cardsJson.skills;
export const TACTICS: CardDef[] = cardsJson.tactics;
export const EXPANSION: CardDef = cardsJson.expansion[0];
export const ORIGINAL_COMMAND: CardDef[] = cardsJson.original_command;
export const ORIGINAL_GAMBIT: CardDef[] = cardsJson.original_gambit;
// build-data.mjs checks `wrap` is one of the allowed values.
export const MAPS: MapDef[] = mapsJson as MapDef[];

/** The basic map for a player count. */
export function defaultMap(players: number): MapDef | undefined {
  return MAPS.find((m) => m.players === players && m.group === 'basic') ?? MAPS.find((m) => m.players === players);
}

const byId = new Map<string, CardDef>(
  [...SKILLS, ...TACTICS, EXPANSION, ...ORIGINAL_COMMAND, ...ORIGINAL_GAMBIT].map((c) => [c.id, c]),
);
const skillIds = new Set([...SKILLS, ...ORIGINAL_COMMAND].map((c) => c.id));
const originalIds = new Set([...ORIGINAL_COMMAND, ...ORIGINAL_GAMBIT].map((c) => c.id));

export function card(id: string): CardDef {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}

export function effectOf(id: string): string {
  return card(id).effect ?? id;
}

/** A card with this effect, for naming it (several editions' cards may share one effect). */
export function cardWithEffect(effect: string): CardDef | undefined {
  return byId.get(effect) ?? [...byId.values()].find((c) => c.effect === effect);
}

/** Skill (CE) / Command (original) cards are permanent; everything else is one-shot. */
export function cardKind(id: string): 'skill' | 'tactic' | 'expansion' {
  if (id === EXPANSION.id) return 'expansion';
  return skillIds.has(id) ? 'skill' : 'tactic';
}

export function isOriginalCard(id: string): boolean {
  return originalIds.has(id);
}


/**
 * The official ships' powers, built into the engine: ship identity is "has power X", not a die value,
 * so a mode can give a value a different power (RuleSet.ships).
 */
export type ShipPower = 'strike' | 'transport' | 'warp' | 'modify' | 'manoeuvre' | 'freeReconfigure';

export interface ShipDef {
  name: string;
  /** A built-in power (the official ships). */
  power?: ShipPower;
  /** A prototype power, as hooks (prototype.ts). A ship with hooks and no `power` has no once-per-turn ability. */
  hooks?: ShipHooks;
  /** The power's name and rules text for the UI; `hint` guides a player using its action. */
  ability: { name: string; text: string; hint?: string };
}

/** A mode's ships by die value, 1 to 6. */
export type ShipTable = Record<number, ShipDef>;

export const CLASSIC_SHIPS: ShipTable = {
  1: { name: 'Battlestation', power: 'strike', ability: { name: 'Free Attack', text: 'Attack an adjacent enemy without using this ship’s move.' } },
  2: { name: 'Flagship', power: 'transport', ability: { name: 'Carry & Move', text: 'Carry one of your nearby ships as part of a move, then drop it next to you.' } },
  3: { name: 'Destroyer', power: 'warp', ability: { name: 'Swap', text: 'Swap places with any of your other ships.' } },
  4: { name: 'Frigate', power: 'modify', ability: { name: 'Change to 3 or 5', text: 'Turn into a Destroyer or an Interceptor.' } },
  5: { name: 'Interceptor', power: 'manoeuvre', ability: { name: 'Move Diagonally', text: 'May move and attack diagonally (used automatically when needed).' } },
  6: { name: 'Scout', power: 'freeReconfigure', ability: { name: 'Free Reconfigure', text: 'Re-roll this ship for free.' } },
};

/** The ships' names in every mode. */
export const SHIP_NAMES: Record<number, string> = Object.fromEntries(Object.entries(CLASSIC_SHIPS).map(([v, s]) => [v, s.name]));

/** The classic ship powers; a mode's own are in rulesOf(state).ships (see shipOf). */
export const SHIP_ABILITIES: Record<number, { name: string; text: string }> = Object.fromEntries(
  Object.entries(CLASSIC_SHIPS).map(([v, s]) => [v, s.ability]),
);
