import { ORIGINAL_COMMAND, ORIGINAL_GAMBIT, SKILLS, TACTICS, type CardDef, type GameMode } from './data';
import type { GameState } from './types';

/**
 * Everything that differs between rule sets lives here. The engine and the UI ask the rule set
 * ("does this mode have missiles?") instead of checking the mode's name, so adding a new
 * edition means adding one entry to RULESETS.
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
  /** Missiles each player starts with; 0 means the mode has no missiles. */
  startingMissiles: number;
  /**
   * Reconfigure re-rolls until the die shows `different` — any number other than its current one
   * (official rules) — or `unseen` — a number it has not shown this turn (Community Edition).
   */
  reconfigure: 'different' | 'unseen';
  /** Map groups (data/maps.yaml) this mode can be played on. */
  mapGroups: string[];
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

/** Maps published for the boxed game: the box, the 2013 rulebook, and the add-on pack. */
const OFFICIAL_MAPS = ['basic', 'advanced', 'addon'];

export const RULESETS: Record<GameMode, RuleSet> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    title: 'Basic',
    summary: 'The official rules without cards. Learn movement, combat and conquering.',
    cards: null,
    startingMissiles: 0,
    reconfigure: 'different',
    mapGroups: OFFICIAL_MAPS,
  },
  original: {
    id: 'original',
    name: 'Classic',
    title: 'Classic',
    summary: 'The 2013 rules with Command and Gambit cards.',
    cards: {
      skills: ORIGINAL_COMMAND,
      tactics: ORIGINAL_GAMBIT,
      startingSkillDraft: false,
      peek: false,
      expansionPile: false,
      refresh: true,
      terms: { skill: 'Command card', skills: 'Command cards', skillDeck: 'Command', tacticDeck: 'Gambit' },
    },
    startingMissiles: 0,
    reconfigure: 'different',
    mapGroups: OFFICIAL_MAPS,
  },
  community: {
    id: 'community',
    name: 'Community',
    title: 'Community Edition',
    summary: 'Rebalanced cards, missiles, a starting skill and card peeking.',
    cards: {
      skills: SKILLS,
      tactics: TACTICS,
      startingSkillDraft: true,
      peek: true,
      expansionPile: true,
      refresh: false,
      terms: { skill: 'skill', skills: 'skills', skillDeck: 'Skills', tacticDeck: 'Tactics' },
    },
    startingMissiles: 1,
    reconfigure: 'unseen',
    mapGroups: [...OFFICIAL_MAPS, 'bga'],
  },
};

/** The rule set a game is played with. */
export function rulesOf(state: GameState): RuleSet {
  return RULESETS[state.mode];
}

/** Rule sets in menu order. */
export const MODES: RuleSet[] = [RULESETS.basic, RULESETS.original, RULESETS.community];
