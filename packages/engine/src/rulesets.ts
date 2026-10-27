/**
 * The rule sets, by mode. Kept apart from rules.ts, which never imports a mode, so engine modules can ask
 * rulesOf and the engine loads the same whichever of its modules is imported first.
 */
import { CLASSIC_SHIPS, ORIGINAL_COMMAND, ORIGINAL_GAMBIT, SKILLS, TACTICS, type GameMode } from './data';
import { defineRuleSets, type RuleSet } from './rules';

/** Maps published for the boxed game: the box, the 2013 rulebook, and the add-on pack. */
const OFFICIAL_MAPS = ['basic', 'advanced', 'addon'];

const COMMUNITY: RuleSet = {
  id: 'community',
  name: 'Community',
  title: 'Community Edition',
  summary: 'Rebalanced cards, missiles, a starting skill and card peeking.',
  actionsPerTurn: 3,
  researchLimit: 6,
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
  mapGroups: [...OFFICIAL_MAPS, 'bga', 'ce'],
  ships: CLASSIC_SHIPS,
};

export const RULESETS: Record<GameMode, RuleSet> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    title: 'Basic',
    summary: 'The official rules without cards. Learn movement, combat and conquering.',
    cards: null,
    actionsPerTurn: 3,
    researchLimit: 6,
    startingMissiles: 0,
    reconfigure: 'different',
    mapGroups: OFFICIAL_MAPS,
    ships: CLASSIC_SHIPS,
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
    actionsPerTurn: 3,
    researchLimit: 6,
    startingMissiles: 0,
    reconfigure: 'different',
    mapGroups: OFFICIAL_MAPS,
    ships: CLASSIC_SHIPS,
  },
  community: COMMUNITY,
};

defineRuleSets(RULESETS);

/** The mode the lobby offers first, before a player has picked one. */
export const DEFAULT_MODE: GameMode = 'community';

/** Rule sets in menu order. */
export const MODES: RuleSet[] = [RULESETS.basic, RULESETS.original, RULESETS.community];
