import { MAPS, type CardDef, type GameMode, type ShipDef, type ShipPower, type ShipTable } from './data';
import type { ShipHooks } from './prototype';
import type { Die, GameState } from './types';

/**
 * Everything that differs between rule sets lives here. The engine and the UI ask the rule set
 * ("does this mode have missiles?") instead of checking the mode's name, so adding a new
 * edition means adding one entry to RULESETS (rulesets.ts).
 */
export interface RuleSet {
  id: GameMode;
  /** Short name for menus. */
  name: string;
  /** Full name for the game log. */
  title: string;
  summary: string;
  /** Advance cards; null means the mode has no cards, and so no research either. */
  cards: CardRules | null;
  /** Actions available on each regular turn. */
  actionsPerTurn: number;
  /** Maximum value on the research track. */
  researchLimit: number;
  /** Missiles each player starts with; 0 means the mode has no missiles. */
  startingMissiles: number;
  /**
   * Reconfigure re-rolls until the die shows `different` — any number other than its current one
   * (official rules) — or `unseen` — a number it has not shown this turn (Community Edition).
   */
  reconfigure: 'different' | 'unseen';
  /** Map groups (data/maps.yaml) this mode can be played on. */
  mapGroups: string[];
  /** Each die value's ship: its name and power (built in, or prototype hooks). */
  ships: ShipTable;
  /** The most a ship's die value counts for movement; skill bonuses add to it (PROTOTYPING.md §2). */
  maxMovement?: number;
  /** A fully occupied planet can still be conquered by an orbit summing to 12, displacing an opponent's cube (PROTOTYPING.md §6.10). */
  overConquest?: boolean;
  /** A rule set we're still testing: playable from the lobby, but left out of the rulebook. */
  experimental?: boolean;
}

export interface CardRules {
  /** Permanent cards (Skill / Command). */
  skills: CardDef[];
  /** One-shot cards (Tactic / Gambit). */
  tactics: CardDef[];
  /** Each player drafts a starting skill: draw 2, keep 1. */
  startingSkillDraft: boolean;
  /** Taking the oldest face-up card lets you peek at the top of its deck instead. */
  peek: boolean;
  /** Expansion cards form a separate face-up pile of players + 1 (otherwise they are Gambit cards). */
  expansionPile: boolean;
  /** A card pick may be spent to discard every face-up card and deal new ones (2013 rulebook p.9). */
  refresh: boolean;
  terms: {
    skill: string;
    skills: string;
    skillDeck: string;
    tacticDeck: string;
  };
}

/**
 * The rule sets by mode: rulesets.ts builds them (it needs the modes, which use the whole engine) and sets
 * them here. Importing rulesets.ts from this file would bring back the import cycle (CODE-REVIEW #3), so
 * each module that takes a state from outside (setup, engine, legal through engine, invariants) loads
 * rulesets.ts itself; load-order.test.ts checks each one alone.
 */
let ruleSets: Record<GameMode, RuleSet> | undefined;

export function defineRuleSets(table: Record<GameMode, RuleSet>) {
  ruleSets = table;
}

/** The rule set a game is played with. */
export function rulesOf(state: GameState): RuleSet {
  if (!ruleSets) throw new Error('No rule sets yet: load the engine through src/index.ts');
  if (!Object.hasOwn(ruleSets, state.mode)) throw new Error(`Unknown mode ${state.mode}`);
  return ruleSets[state.mode];
}

/** The ship a die value is in this game's rules. */
export function shipOf(state: GameState, value: number): ShipDef {
  return rulesOf(state).ships[value];
}

/** Whether a ship has this power in this game's rules. */
export function hasPower(state: GameState, d: Die, power: ShipPower): boolean {
  return rulesOf(state).ships[d.value]?.power === power;
}

/** A ship's prototype power hooks in this game's rules (none for the official ships). */
export function hooksOf(state: GameState, d: Die): ShipHooks | undefined {
  return rulesOf(state).ships[d.value]?.hooks;
}

/** modeHooks' answers, worked out once per ship table: the engine asks on every move and legal-action search. */
const HOOKS = new WeakMap<ShipTable, Map<keyof ShipHooks, unknown[]>>();

/** Each different power in this game's rules that has this hook (none in the official modes). */
export function modeHooks<K extends keyof ShipHooks>(state: GameState, hook: K): readonly NonNullable<ShipHooks[K]>[] {
  const ships = rulesOf(state).ships;
  let byHook = HOOKS.get(ships);
  if (!byHook) HOOKS.set(ships, (byHook = new Map()));
  let found = byHook.get(hook);
  if (!found) {
    const out = new Set<unknown>();
    for (const s of Object.values(ships)) if (s.hooks?.[hook]) out.add(s.hooks[hook]);
    byHook.set(hook, (found = [...out]));
  }
  return found as NonNullable<ShipHooks[K]>[];
}

/** Whether any ship in this game's rules has this hook, so searches can skip it otherwise. */
export function modeHasHook(state: GameState, hook: keyof ShipHooks): boolean {
  return modeHooks(state, hook).length > 0;
}

/** Player counts a rule set has maps for. */
export function playerCounts(rules: RuleSet): number[] {
  return [...new Set(MAPS.filter((m) => rules.mapGroups.includes(m.group)).map((m) => m.players))].sort((a, b) => a - b);
}
