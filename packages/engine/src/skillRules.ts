/**
 * What every Skill / Command card does, in one table.
 *
 * A skill is a set of hooks: plain values or pure functions that the rules read at fixed points
 * (movement, the conquer check, combat, start of turn, destroying a ship…). A rule asks
 * `skillRules(state, player)` for the player's active skills and combines their hooks; it never
 * names a skill. Skills that are an action of their own say so with `activated` and have a
 * handler in skillActions.ts.
 *
 * To add a skill: list its effect in SKILL_EFFECTS (effects.ts), then add its entry here (the
 * compiler asks for it). If no hook fits, add one to SkillRule and read it where the rule lives.
 */
import { linked } from './board';
import { effectOf } from './data';
import { SKILL_EFFECTS, type SkillEffect } from './effects';
import { dieAt, shipsOnBoard } from './lookups';
import type { Action, Cell, CombatPending, CombatRole, Die, GameState, PlayerId } from './types';

export interface CombatPart {
  label: string;
  value: number;
}

export interface ConquerContext {
  /** Sum of the player's ships in orbit. */
  sum: number;
  ships: Die[];
  dominance: number;
  research: number;
}

export interface CombatContext {
  state: GameState;
  combat: CombatPending;
  side: CombatRole;
}

export interface TurnBonus {
  actions?: number;
  freeDeploys?: number;
  freeMoves?: number;
  research?: number;
}

export interface DestroyContext {
  /** The first enemy ship this player destroyed this turn. */
  first: boolean;
  /** It is this player's turn. */
  ownTurn: boolean;
  /** It is this player's turn, in the action phase. */
  ownActionPhase: boolean;
}

export interface DestroyBonus {
  research?: number;
  actions?: number;
  dominance?: number;
}

export interface SkillRule {
  /** Extra movement for every ship. */
  movement?: number;
  /** Ships may move more than once per turn. */
  moveRepeatedly?: boolean;
  /** One ship ability may be used a second time each turn. */
  abilityTwice?: boolean;
  /** How many skills the player may hold. */
  skillLimit?: number;
  /** Research needed for a breakthrough. */
  breakthroughAt?: number;
  /** Dominance needed for an Infamy cube (Prideful). */
  infamyAt?: number;
  /** Whenever one of the player's ships is rolled, they choose its number instead. */
  chooseShipNumbers?: boolean;
  /** When a ship is placed in your scrapyard, choose its number instead (Calculating). */
  chooseScrapyardNumber?: boolean;
  /** One more Move or Research once the actions are spent, on a turn without Attack or Conquer. */
  peacefulExtraAction?: boolean;
  /** Tactics may be stored when taken and one played at the end of the turn; taking the card stores one. */
  storeTactics?: boolean;
  /** On the first destroy of a turn, one of the victim's active skills is disabled. */
  disableSkillOnDestroy?: boolean;
  /** Whoever destroys a ship of the holder may take this card, even while it is not in effect. */
  stolenOnDestroy?: boolean;
  /** After reconfiguring, the player may raise or lower the ship's number by 1. */
  adjustReconfigure?: boolean;
  /** Normal moves may pass through enemy ships; those spaces cost no movement. */
  moveThroughEnemies?: boolean;
  /** A card pick earned by a Conquer action may be taken as 1 missile instead. */
  missileForConquest?: boolean;
  /** On their own turn, the player may re-roll each roll of one of their ships once. */
  rerollShips?: boolean;
  /** Deploying costs no action. */
  freeDeploy?: boolean;
  /** Ships may also deploy to any empty space with no ship next to it. */
  deployIsolated?: boolean;
  /** The player never gains research. */
  noResearch?: boolean;
  /** The player never loses dominance: always, or only when one of their ships is destroyed. */
  keepDominance?: 'always' | 'destroyed';
  /** Dominance gained or lost when a ship is destroyed (default 1). */
  dominanceStakes?: number;
  conquer?: {
    /** Diagonal spaces count as orbit. */
    diagonals?: boolean;
    /** The total may miss the target by this much. */
    tolerance?: number;
    /** Other totals the player may use instead of the plain sum. */
    sums?: (ctx: ConquerContext) => number[];
  };
  combat?: {
    /** Roll this many dice and keep the lowest. */
    dice?: number;
    /** The combat roll is always this value. */
    roll?: number;
    /** A modifier added to the total, if it applies. */
    modifier?: (ctx: CombatContext) => number;
    /** When defending, ties go to the player, and winning destroys the attacker. */
    stubborn?: boolean;
    /** When defending, before the dice are rolled, the player may destroy both ships. */
    destroyBoth?: boolean;
    /** Once per battle, re-roll the player's own dice or make the opponent re-roll theirs. */
    reroll?: { whose: 'own' | 'opponent'; ownTurnOnly?: boolean };
  };
  /** Bonuses at the start of each of the player's turns. */
  startOfTurn?: (state: GameState, player: PlayerId) => TurnBonus;
  /** Bonuses when the player destroys an enemy ship in combat (on top of the dominance stakes). */
  onDestroy?: (ctx: DestroyContext) => DestroyBonus;
  /** Used with an action of its own (handler in skillActions.ts). */
  activated?: Action['type'];
}

/** Whether a friendly ship (other than `self`) is next to any of `spaces`. */
function supported(state: GameState, player: PlayerId, self: string, spaces: Cell[]): boolean {
  return spaces.some((sp) =>
    linked(state, sp).some((q) => {
      const d = dieAt(state, q);
      return !!d && d.owner === player && d.id !== self;
    }),
  );
}

export const SKILL_RULES: Record<SkillEffect, SkillRule> = {
  // shared / community skills
  agile: { movement: 1 },
  ambitious: { activated: 'ambitious' },
  brilliant: { startOfTurn: (s, p) => (askBrilliant(s, p) ? {} : { research: 2 }) },
  brutal: { combat: { dice: 2 } },
  clever: { adjustReconfigure: true },
  composed: { activated: 'composed' },
  devious: { moveThroughEnemies: true },
  ferocious: { combat: { modifier: () => -1 } },
  flexible: { activated: 'flexible' },
  hostile: { onDestroy: (c) => (c.first && c.ownActionPhase ? { actions: 1 } : {}) },
  industrious: { startOfTurn: () => ({ freeDeploys: 1 }) },
  ingenious: { conquer: { diagonals: true } },
  intelligent: { conquer: { tolerance: 1 } },
  pioneering: { conquer: { sums: (c) => c.ships.map((d) => c.sum - d.value + c.research) } },
  plundering: { onDestroy: (c) => (c.first ? { research: 3 } : {}) },
  precocious: { breakthroughAt: 4 },
  profiteering: { missileForConquest: true },
  rational: { combat: { roll: 3 } },
  ravenous: { onDestroy: (c) => (c.first ? { dominance: 1 } : {}) },
  resourceful: { activated: 'resourceful' },
  righteous: { noResearch: true, keepDominance: 'always' },
  steadfast: { moveRepeatedly: true },
  stealthy: { deployIsolated: true },
  strategic: {
    combat: {
      // Supported by a friendly ship next to the battle (for the attacker: next to either space).
      modifier: ({ state, combat, side }) => {
        const s = combat[side];
        const spaces = side === 'attacker' ? [combat.from, combat.at] : [combat.at];
        return supported(state, s.player, s.die, spaces) ? -2 : 0;
      },
    },
  },
  // Revised-edition card: the attacker counts from the square it attacked from, never the
  // defender's (Board Game Arena, BGG thread 2774280). The 1st printing's "you can consider an
  // attacker to be in either square" was dropped in the revision.
  'strategic-original': {
    combat: {
      modifier: ({ state, combat, side }) => {
        const s = combat[side];
        return supported(state, s.player, s.die, [side === 'attacker' ? combat.from : combat.at]) ? -2 : 0;
      },
    },
  },
  stubborn: { combat: { stubborn: true } },
  talented: { skillLimit: 5 },
  tyrannical: { conquer: { sums: (c) => [c.sum + c.dominance] } },
  cunning: { abilityTwice: true },
  tactical: { activated: 'tactical' },
  calculating: { chooseScrapyardNumber: true },
  curious: { peacefulExtraAction: true },
  patient: { storeTactics: true },
  prideful: { infamyAt: 4, stolenOnDestroy: true },
  ruthless: { disableSkillOnDestroy: true },
  // original command cards
  arrogant: {
    // More ships on the map than every other player.
    startOfTurn: (s, p) => {
      const mine = shipsOnBoard(s, p).length;
      return s.players.every((o) => o.id === p || shipsOnBoard(s, o.id).length < mine) ? { actions: 1 } : {};
    },
  },
  conformist: {
    // Two or more of your ships on the map show the same number.
    startOfTurn: (s, p) => {
      const mine = shipsOnBoard(s, p);
      return new Set(mine.map((d) => d.value)).size < mine.length ? { actions: 1 } : {};
    },
  },
  'clever-original': { chooseShipNumbers: true },
  cruel: { combat: { reroll: { whose: 'opponent' } } },
  'curious-original': { startOfTurn: () => ({ freeMoves: 1 }) },
  dangerous: { combat: { destroyBoth: true } },
  eager: { freeDeploy: true },
  nomadic: { activated: 'nomadic' },
  'plundering-original': { onDestroy: (c) => (c.first && c.ownTurn ? { research: 3 } : {}) },
  'ravenous-original': { dominanceStakes: 2 },
  relentless: { combat: { reroll: { whose: 'own' } } },
  'righteous-original': { keepDominance: 'destroyed' },
  // Scrappy re-rolls ship rolls (core.ts rollShip) and, as here, combat rolls on the player's turn.
  scrappy: { rerollShips: true, combat: { reroll: { whose: 'own', ownTurnOnly: true } } },
  'tactical-original': { activated: 'tactical' },
  'tyrannical-original': { activated: 'tyrannical' },
};

export interface ActiveSkill {
  effect: SkillEffect;
  /** The card that provides it, for naming it. */
  card: string;
  rule: SkillRule;
}

/** The player's active skills, in SKILL_EFFECTS order (so results don't depend on draw order). */
export function activeSkills(state: GameState, player: PlayerId): ActiveSkill[] {
  const owned = new Map<string, string>();
  for (const s of state.players[player].skills) if (s.active && !owned.has(effectOf(s.id))) owned.set(effectOf(s.id), s.id);
  return SKILL_EFFECTS.filter((e) => owned.has(e)).map((effect) => ({ effect, card: owned.get(effect)!, rule: SKILL_RULES[effect] }));
}

/** The rules of the player's active skills. */
export function skillRules(state: GameState, player: PlayerId): SkillRule[] {
  return activeSkills(state, player).map((a) => a.rule);
}

/** The rule of a skill card, whether or not it is active yet. */
export function ruleOf(skillId: string): SkillRule {
  return SKILL_RULES[effectOf(skillId) as SkillEffect] ?? {};
}

/** Whether any of the player's active skills has this property. */
export function anySkill(state: GameState, player: PlayerId, test: (r: SkillRule) => unknown): boolean {
  // Called on hot paths (every roll, attack and combat total): no list is built.
  return state.players[player].skills.some((s) => s.active && test(ruleOf(s.id)));
}

/** The index in the player's skills of a card someone who destroys their ship may take (Prideful), active or not. */
export function stealableSkill(state: GameState, player: PlayerId): number {
  return state.players[player].skills.findIndex((s) => ruleOf(s.id).stolenOnDestroy);
}

/** True when the player owns an active skill with this effect (e.g. Cerebral has the 'composed' effect). */
export function hasSkill(state: GameState, player: PlayerId, effect: SkillEffect): boolean {
  return state.players[player].skills.some((s) => s.active && effectOf(s.id) === effect);
}

/**
 * CE Brilliant reads "you may gain 2 Research" (the Original card: "automatically"). Research only
 * matters as an exact number with Pioneering, so the player is asked then (see startTurn) and
 * otherwise simply gains it.
 */
export function askBrilliant(state: GameState, player: PlayerId): boolean {
  return (
    skillCard(state, player, 'brilliant') === 'brilliant' &&
    hasSkill(state, player, 'pioneering') &&
    state.players[player].research < 6 &&
    !anySkill(state, player, (r) => r.noResearch)
  );
}

/** The id of the player's card that provides an effect, for showing its name. */
export function skillCard(state: GameState, player: PlayerId, effect: SkillEffect): string | undefined {
  return state.players[player].skills.find((s) => s.active && effectOf(s.id) === effect)?.id;
}
