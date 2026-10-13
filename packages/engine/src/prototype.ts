/**
 * The prototype kit: the engine APIs trusted experimental-mode code may use, in one file.
 * It holds the interface a prototype ship power plugs into (ShipHooks) and the engine helpers a power
 * may call. A prototype imports this file and nothing else from the engine (test/prototyping.test.ts checks
 * the import convention). This is an architectural boundary, not a sandbox: hooks can mutate GameState,
 * so prototype code is trusted engine code.
 *
 * It re-exports the engine's building blocks whole, so a power can use any of them. When a power needs a
 * new kind of hook, add it to ShipHooks and read it where it applies in the engine (docs/PROTOTYPING.md §9).
 */
import type { ShipDef } from './data';
import type { Cell, Die, GameState } from './types';

/** What a power action (ShipHooks.action) is aimed at: a ship, a space, or both. */
export interface PowerChoice {
  target?: string;
  to?: Cell;
}

/**
 * A prototype ship power, as hooks the engine reads, like SkillRule for skills. Experimental modes
 * define their powers this way, so the engine never names them. The official ships have none: every
 * hook is optional, and the engine skips ships without it.
 */
export interface ShipHooks {
  /**
   * Board cell indexes (r * cols + c) where an enemy ship that moves in must stop. It may still attack
   * from there, and one that starts its move on one may leave. Normal moves only.
   */
  stopsEnemies?(state: GameState, ship: Die, index: number): Iterable<number>;
  /** Extra spaces its owner may deploy into (the engine keeps only empty ones). */
  deployTargets?(state: GameState, ship: Die): Iterable<Cell>;
  /**
   * An action of its own: the `power` action. `options` are the legal choices now, cost included;
   * `apply` runs only for one of them, and pays for it.
   */
  action?: {
    options(state: GameState, ship: Die): PowerChoice[];
    apply(state: GameState, ship: Die, choice: PowerChoice): void;
  };
}

/** A whole prototype power: its rules text and its hooks. Give it to a ship with `{ name, ...power }`. */
export interface PrototypePower {
  ability: ShipDef['ability'];
  hooks: ShipHooks;
}

// ---------------------------------------------------------------------------
// The engine's building blocks a power may call: whole modules, so a new power rarely needs an edit
// here. Not the action handlers: a power acts through its hooks.

export * from './board';
export * from './core';
export * from './lookups';
export * from './queries';
export * from './types';
export { hasPower, hooksOf, rulesOf, shipOf, type RuleSet } from './rules';
export { startCombat } from './combat';
export { CLASSIC_SHIPS, SHIP_NAMES, type ShipDef, type ShipTable } from './data';
