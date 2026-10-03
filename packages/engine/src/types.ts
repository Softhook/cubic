import type { GameMode } from './data';

export type PlayerId = number;

export interface Cell {
  r: number;
  c: number;
}

export type CellKind = 'off' | 'space' | 'planet';

export interface BoardCell {
  kind: CellKind;
  /** Index of the tile this cell belongs to, -1 when off-board. */
  tile: number;
  planet?: number;
  void?: boolean;
}

export interface Planet {
  id: number;
  number: number;
  capacity: number;
  /** Owners of the cubes on this planet, in placement order. */
  cubes: PlayerId[];
  start: boolean;
  r: number;
  c: number;
}

export interface Board {
  mapId: string;
  mapName: string;
  rows: number;
  cols: number;
  cells: BoardCell[][];
  planets: Planet[];
}

export type DieLoc =
  | { zone: 'board'; r: number; c: number }
  | { zone: 'scrapyard' }
  | { zone: 'reserve' };

export interface Die {
  id: string;
  owner: PlayerId;
  value: number;
  loc: DieLoc;
  /** Increments every time the die is rolled; the UI animates a tumble on change. */
  rolls: number;
}

export interface OwnedSkill {
  id: string;
  /** Skills taken during your turn only take effect from the next player's turn. */
  active: boolean;
}

export interface PlayerConfig {
  name: string;
  color: string;
  ai: boolean;
  /** Strength of an AI player, 1 (weakest) to 4; see packages/ai. */
  aiLevel?: number;
}

export interface PlayerState extends PlayerConfig {
  id: PlayerId;
  dominance: number;
  research: number;
  missiles: number;
  cubesLeft: number;
  skills: OwnedSkill[];
  ambitionTokens: number;
  /** Actions lost on the next turn (Sabotage). */
  actionPenalty: number;
  /** Plan Ahead: counts down at the end of each of the owner's turns while > 0. */
  planAhead: number;
  /** Momentum: bonus turns queued (number of actions each). */
  bonusTurns: number[];
  /** Card picks still owed when Momentum interrupted the card phase; taken in the bonus turn's. */
  carriedPicks?: number;
  /** How many of the carried picks were earned by Conquer actions (Profiteering). */
  carriedConquerPicks?: number;
}

export type DeckKind = 'skill' | 'tactic';

export interface Market {
  skillDeck: string[];
  skillRow: string[];
  skillDiscard: string[];
  tacticDeck: string[];
  tacticRow: string[];
  tacticDiscard: string[];
  expansions: number;
}

export interface TurnState {
  player: PlayerId;
  number: number;
  phase: 'actions' | 'cards';
  actionsLeft: number;
  freeDeploys: number;
  /** Free moves left (original Curious: only on a turn without attacks). */
  freeMoves: number;
  /** Free moves taken so far; an attack later this turn must pay for them with actions. */
  freeMovesUsed: number;
  moved: Record<string, number>;
  abilityUsed: Record<string, boolean>;
  /** Values each die has shown this turn (for Reconfigure). */
  seen: Record<string, number[]>;
  conquests: number;
  /** Conquer actions taken this turn; unlike `conquests`, Infamy cubes don't count (Profiteering). */
  conquered?: number;
  attacked: boolean;
  /** Players who have already destroyed an enemy ship this turn ("first time each turn" triggers). */
  destroyedBy: PlayerId[];
  /** Once-per-turn effects already used. */
  oncePerTurn: OncePerTurn[];
  bonus: boolean;
  /**
   * Who plays the next regular turn, when this turn is a bonus turn that interrupted the turn
   * order (Momentum taken on someone else's turn).
   */
  resume?: PlayerId;
  /** Other players who placed a cube through Infamy during this turn (one entry per cube). */
  offTurnCubes?: PlayerId[];
  /**
   * Scrappy: the player's ship rolled by the last action, which they may re-roll once. `avoid` is
   * the number a Reconfigure started from (the re-roll must still show a new number).
   */
  scrappy?: { die: string; avoid?: number };
}

/** Effects limited to once per turn. 'cunning' is the second use of a ship ability. */
export type OncePerTurn = 'composed' | 'ambitious' | 'flexible' | 'resourceful' | 'tyrannical' | 'tactical' | 'cunning' | 'nomadic';

export interface CombatSide {
  player: PlayerId;
  die: string;
  ship: number;
  dice: number[];
  missile: boolean;
}

export interface CombatPending {
  kind: 'combat';
  id: number;
  attacker: CombatSide;
  defender: CombatSide;
  /** Where the attacker returns if repelled (the space it attacked from). */
  from: Cell;
  /** The defender's space. */
  at: Cell;
  /** Re-roll effects already used in this battle (Cruel, Relentless, Scrappy: once each). */
  rerolls: string[];
}

export type Pending =
  | { kind: 'setupRoll'; player: PlayerId; rerolled: boolean }
  | { kind: 'skillDraft'; player: PlayerId; options: string[] }
  | { kind: 'placeStart'; player: PlayerId }
  /** Setup: place your starting ships, one at a time, in orbital positions of your starting planet. */
  | { kind: 'placeShips'; player: PlayerId; planet: number }
  | CombatPending
  /** Dangerous: before the dice are rolled, the defender may destroy both ships. */
  | { kind: 'dangerous'; player: PlayerId; attacker: string; defender: string; from: Cell }
  /**
   * Clever: the player chooses the number of a ship that was just rolled (Original: any but `avoid`,
   * for a Reconfigure; Community Edition: one of `options`, the reconfigured number ± 1).
   */
  | { kind: 'clever'; player: PlayerId; die: string; avoid?: number; options?: number[] }
  /** Relocation: move another player's cube. */
  | { kind: 'relocation'; player: PlayerId }
  | { kind: 'advance'; player: PlayerId; die: string; to: Cell }
  | { kind: 'infamy'; player: PlayerId }
  /** `conquer`: how many of the picks were earned by Conquer actions (Profiteering may take a missile instead). */
  | { kind: 'takeCard'; player: PlayerId; count: number; conquer?: number }
  | { kind: 'peek'; player: PlayerId; deck: DeckKind; top: string }
  | { kind: 'discardSkill'; player: PlayerId; reason?: 'limit' | 'sabotage' }
  | { kind: 'placeExpansion'; player: PlayerId; die: string }
  | { kind: 'showOfForce'; player: PlayerId }
  | { kind: 'warpGate'; player: PlayerId; placed: Cell[] }
  | { kind: 'changeOfHeart'; player: PlayerId }
  /** CE Brilliant, at the start of the turn: gain 2 research or not (asked only with Pioneering). */
  | { kind: 'brilliant'; player: PlayerId }
  /** Unveil the Fleet (CE) or, with `reorganize`, Reorganization (original). */
  | { kind: 'unveil'; player: PlayerId; rerolled: string[]; reorganize?: boolean };

/** What a log entry reports, so the UI can react (sounds, toasts) without parsing its text. */
export type LogEvent =
  | 'victory'
  | 'infamy'
  | 'seize'
  | 'conquer'
  | 'startPlanet'
  | 'battleWon'
  | 'repelled'
  | 'missile'
  | 'shipDestroyed'
  | 'cardTaken'
  | 'cardPlayed'
  | 'expansion'
  | 'discard'
  | 'breakthrough';

export interface LogEntry {
  id: number;
  player?: PlayerId;
  text: string;
  event?: LogEvent;
}

export interface GameState {
  version: 1;
  mode: GameMode;
  seed: number;
  rng: number;
  board: Board;
  players: PlayerState[];
  dice: Die[];
  market: Market;
  gates: Cell[];
  turn: TurnState;
  /** Decisions waiting to be made; the head is the current one. */
  pending: Pending[];
  phase: 'setup' | 'play' | 'over';
  winner: PlayerId | null;
  combatCounter: number;
  log: LogEntry[];
  logCounter: number;
}

export type ShipAbility = 'freeAttack' | 'carry' | 'swap' | 'change' | 'freeReconfigure';

export type Action =
  // setup
  | { type: 'setupKeep' }
  | { type: 'setupReroll' }
  | { type: 'draftSkill'; skill: string }
  | { type: 'placeStart'; planet: number }
  | { type: 'placeShip'; die: string; to: Cell }
  // phase 1 actions
  | { type: 'move'; die: string; to: Cell }
  | { type: 'attack'; die: string; target: string }
  | { type: 'deploy'; die: string; to: Cell }
  | { type: 'reconfigure'; die: string }
  | { type: 'research' }
  | { type: 'conquer'; planet: number }
  | { type: 'endTurn' }
  // ship abilities
  | { type: 'freeAttack'; die: string; target: string }
  | { type: 'carry'; die: string; passenger: string; to: Cell; drop: Cell }
  | { type: 'swap'; die: string; other: string }
  | { type: 'change'; die: string; value: 3 | 5 }
  | { type: 'freeReconfigure'; die: string }
  // activated skills
  | { type: 'composed' }
  | { type: 'ambitious' }
  | { type: 'flexible'; die: string; delta: 1 | -1 }
  | { type: 'resourceful'; die: string }
  | { type: 'tyrannical' }
  /** Nomadic: relocate a ship from one planet's orbit to an orbital position of a neighbouring planet. */
  | { type: 'nomadic'; die: string; to: Cell }
  /** Scrappy: re-roll the ship rolled by the last action. */
  | { type: 'scrappy' }
  /** Tactical's 1-space move (`to`) or attack (`target`); with `passenger` + `drop` it is a Flagship transport. */
  | { type: 'tactical'; die: string; to?: Cell; target?: string; passenger?: string; drop?: Cell }
  // combat & decisions
  | { type: 'missile'; by: PlayerId; side: 'attacker' | 'defender' }
  /** Cruel, Relentless or Scrappy: re-roll one side's combat dice. */
  | { type: 'reroll'; by: PlayerId; side: 'attacker' | 'defender' }
  | { type: 'dangerous'; destroy: boolean }
  | { type: 'clever'; value: number }
  | { type: 'brilliant'; gain: boolean }
  | { type: 'relocate'; planet: number; owner: PlayerId; to: number }
  | { type: 'resolveCombat' }
  | { type: 'advance'; move: boolean }
  | { type: 'infamy'; planet: number }
  | { type: 'takeCard'; deck: DeckKind | 'expansion'; index: number }
  | { type: 'peekChoice'; takeTop: boolean }
  | { type: 'refreshMarket' }
  /** Profiteering: take 1 missile instead of a card earned by conquering. */
  | { type: 'profiteer' }
  | { type: 'discardSkill'; skill: string }
  | { type: 'placeExpansion'; to: Cell | null }
  | { type: 'showOfForce'; die: string }
  | { type: 'warpGate'; cell: Cell }
  | { type: 'changeOfHeart'; skill: string }
  | { type: 'unveilReroll'; die: string }
  | { type: 'unveilDeploy'; die: string; to: Cell }
  | { type: 'unveilDone' };

export class RuleError extends Error {}
