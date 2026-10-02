/**
 * The card effects the engine implements. A card's effect is its `effect` field in
 * data/cards.yaml, or its id. Cards whose effect is not listed here are left out of the decks.
 *
 * Effect names are types, so `hasSkill(s, p, 'rightous')` is a compile error rather than a
 * skill that silently never applies.
 */

/** Skill / Command effects. Their rules live where they apply: search for `hasSkill(…, '<effect>')`. */
export const SKILL_EFFECTS = [
  // shared / community skills
  'agile',
  'ambitious',
  'brilliant',
  'brutal',
  'composed',
  'ferocious',
  'flexible',
  'hostile',
  'industrious',
  'ingenious',
  'intelligent',
  'pioneering',
  'plundering',
  'precocious',
  'rational',
  'ravenous',
  'resourceful',
  'righteous',
  'steadfast',
  'stealthy',
  'strategic',
  'stubborn',
  'talented',
  'tyrannical',
  'cunning',
  'tactical',
  // original command cards
  'arrogant',
  'conformist',
  'curious-original',
  'eager',
  'plundering-original',
  'ravenous-original',
  'righteous-original',
  'tactical-original',
  'tyrannical-original',
] as const;

export type SkillEffect = (typeof SKILL_EFFECTS)[number];

/** Tactic / Gambit effects. Each has an entry in TACTIC_EFFECTS (cards.ts). */
export const TACTIC_EFFECT_IDS = [
  'aggression',
  'black-market',
  'change-of-heart',
  'momentum',
  'plan-ahead',
  'sabotage',
  'show-of-force',
  'unveil-the-fleet',
  'warp-gate',
  'expansion',
  'reorganization',
  'sabotage-original',
] as const;

export type TacticEffect = (typeof TACTIC_EFFECT_IDS)[number];

/** Card effects the engine implements. Only cards with these effects are shuffled into the decks. */
export const IMPLEMENTED_EFFECTS: ReadonlySet<string> = new Set<string>([...SKILL_EFFECTS, ...TACTIC_EFFECT_IDS]);

export function isImplemented(effect: string): boolean {
  return IMPLEMENTED_EFFECTS.has(effect);
}
