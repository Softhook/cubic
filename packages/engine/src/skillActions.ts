/** Skills / Command cards used as an action of their own. What every skill does is in skillRules.ts. */
import { transport } from './abilities';
import { same } from './board';
import { startCombat } from './combat';
import {
  destroyShip,
  fail,
  gainDominance,
  gainResearch,
  headOf,
  log,
  note,
  logTo,
  loseDominance,
  markAbility,
  markMoved,
  markSeen,
  name,
  oncePerTurn,
  ownShip,
  requireActionPhase,
  requireSkill,
  roll,
  aShip,
  shipName,
  spend,
  type Handlers,
} from './core';
import { boardLoc, cellOf, die } from './lookups';
import { canGainResearch, canMoveDie, canScrappy, combatReroll, nomadicTargets, tacticalOptions } from './queries';
import { hasPower } from './rules';
import { hasSkill, ruleOf, skillCard, type SkillRule } from './skillRules';
import type { Action, GameState, PlayerId } from './types';

export const skillHandlers = {
  composed(s) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'composed');
    if (s.players[t.player].dominance <= 1) fail('No dominance to lose');
    // Under Righteous both halves would do nothing (RULE-SUGGESTIONS #33).
    if (!canGainResearch(s, t.player)) fail('You cannot gain research');
    oncePerTurn(s, 'composed');
    loseDominance(s, t.player, 1);
    gainResearch(s, t.player, 3);
  },
  ambitious(s) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'ambitious');
    oncePerTurn(s, 'ambitious');
    const pl = s.players[t.player];
    t.actionsLeft++;
    pl.ambitionTokens++;
    if (pl.ambitionTokens >= 3) {
      pl.skills = pl.skills.filter((x) => x.id !== 'ambitious');
      pl.ambitionTokens = 0;
      s.market.skillDiscard.push('ambitious');
      log(s, `${pl.name}'s Ambitious skill is exhausted.`, t.player);
    }
  },
  flexible(s, a) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'flexible');
    const d = ownShip(s, a.die, 'board');
    const v = d.value + a.delta;
    if (v < 1 || v > 6) fail('Ship numbers range from 1 to 6');
    oncePerTurn(s, 'flexible');
    const was = shipName(d);
    d.value = v;
    markSeen(s, d);
    note(s, `${name(s, d.owner)} adjusts their ${was} to ${aShip(d)} (Flexible).`, d.owner);
  },
  tyrannical(s) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'tyrannical-original');
    const pl = s.players[t.player];
    if (pl.research <= 1) fail('No research to convert');
    oncePerTurn(s, 'tyrannical');
    pl.research--;
    gainDominance(s, t.player, 1);
  },
  tactical(s, a) {
    const t = requireActionPhase(s);
    const original = hasSkill(s, t.player, 'tactical-original');
    if (!original) requireSkill(s, t.player, 'tactical');
    const d = ownShip(s, a.die, 'board');
    if (original && !canMoveDie(s, d)) fail('This ship already moved this turn');
    // Tactical moves the ship; the Original card counts it as the ship's one move for the turn.
    const use = () => {
      oncePerTurn(s, 'tactical');
      if (original) markMoved(s, d);
    };
    if (a.passenger) {
      // Flagship Transport over the 1 space (forum consensus, BGG thread 1093051).
      if (!hasPower(s, d, 'transport')) fail('Only a Flagship can transport');
      if (!a.to || !a.drop) fail('Invalid carry');
      const fly = transport(s, d, a.passenger, a.to, a.drop, 1);
      use();
      markAbility(s, d);
      fly();
      logTo(
        s,
        d.owner,
        `${name(s, d.owner)}'s ${shipName(d)} carries their ${shipName(die(s, a.passenger))} one space`,
        a.to,
        ' (Tactical)',
      );
      return;
    }
    const opts = tacticalOptions(s, d.id);
    if (a.target) {
      const opt = opts.attacks.find((x) => x.die.id === a.target);
      if (!opt) fail('Target must be adjacent');
      use();
      if (opt.diagonal) markAbility(s, d); // Interceptor manoeuvre
      startCombat(s, d, opt.die, cellOf(d)!);
      return;
    }
    const opt = a.to && opts.moves.find((x) => same(x.cell, a.to!));
    if (!opt) fail('Move one space to an empty space');
    use();
    if (opt.diagonal) markAbility(s, d);
    d.loc = boardLoc(opt.cell);
    logTo(s, d.owner, `${name(s, d.owner)} moves their ${shipName(d)} one space`, opt.cell, ' (Tactical)');
  },
  nomadic(s, a) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'nomadic');
    const d = ownShip(s, a.die, 'board');
    if (!nomadicTargets(s, d.id).some((p) => same(p, a.to))) fail('Relocate to an empty orbital position of a neighbouring planet');
    oncePerTurn(s, 'nomadic');
    spend(s, 1);
    // A relocation, not a move: the ship may still move this turn (forum consensus, BGG thread 1636855).
    d.loc = boardLoc(a.to);
    logTo(s, d.owner, `${name(s, d.owner)} relocates their ${shipName(d)}`, a.to, ' (Nomadic)');
  },
  scrappy(s) {
    if (!canScrappy(s)) fail('Nothing to re-roll');
    const { die: id, avoid } = s.turn.scrappy!;
    delete s.turn.scrappy;
    const d = die(s, id);
    roll(s, d, avoid);
    markSeen(s, d);
    log(s, `${name(s, d.owner)} re-rolls their ship (Scrappy): ${d.value}.`, d.owner);
  },
  clever(s, a) {
    const head = headOf(s, 'clever', 'No ship number to choose');
    if (a.value < 1 || a.value > 6) fail('Ship numbers range from 1 to 6');
    if (head.options && !head.options.includes(a.value)) fail('Clever changes the number by at most 1');
    if (a.value === head.avoid) fail('A reconfigured ship must change its number');
    s.pending.shift();
    const d = die(s, head.die);
    d.value = a.value;
    markSeen(s, d);
    const skill = head.source === 'calculating' ? 'Calculating' : 'Clever';
    note(s, `${name(s, head.player)} makes ${d.loc.zone === 'board' ? 'it' : 'their scrapped ship'} ${aShip(d)} (${skill}).`, head.player);
  },
  brilliant(s, a) {
    const head = headOf(s, 'brilliant', 'No Brilliant research to take');
    s.pending.shift();
    if (a.gain) gainResearch(s, head.player, 2);
    else log(s, `${name(s, head.player)} declines Brilliant's research.`, head.player);
  },
  resourceful(s, a) {
    const t = requireActionPhase(s);
    requireSkill(s, t.player, 'resourceful');
    const d = ownShip(s, a.die, 'board');
    oncePerTurn(s, 'resourceful');
    note(s, `${name(s, d.owner)} scraps their ${shipName(d)} for an extra action (Resourceful).`, d.owner);
    destroyShip(s, d);
    t.actionsLeft++;
  },
} satisfies Partial<Handlers>;

/** CE Curious, when the step from `prev` to `s` spent its extra Move or Research. */
export function curiousUsed(prev: GameState, s: GameState): { player: PlayerId; card: string } | undefined {
  if (prev.turn.curiousUsed || !s.turn.curiousUsed) return undefined;
  const card = skillCard(prev, prev.turn.player, 'curious');
  return card ? { player: prev.turn.player, card } : undefined;
}

/**
 * The skill card `action` uses, and its owner, judged before the action (Ambitious may be gone after).
 * None for an action that declines a skill's offer, or that isn't a skill's at all.
 */
export function skillUsed(s: GameState, a: Action): { player: PlayerId; card: string } | undefined {
  const head = s.pending[0];
  const find = (player: PlayerId, test: (r: SkillRule) => unknown) => {
    const card = s.players[player].skills.find((sk) => sk.active && test(ruleOf(sk.id)))?.id;
    return card ? { player, card } : undefined;
  };
  switch (a.type) {
    case 'reroll': {
      const skill = head?.kind === 'combat' ? combatReroll(s, head, a.by, a.side) : undefined;
      return skill && { player: a.by, card: skill.card };
    }
    case 'scrappy':
      return s.turn.scrappy && find(die(s, s.turn.scrappy.die).owner, (r) => r.rerollShips);
    case 'clever':
      return head?.kind === 'clever'
        ? find(head.player, (r) => (head.source === 'calculating' ? r.chooseScrapyardNumber : r.adjustReconfigure || r.chooseShipNumbers))
        : undefined;
    case 'brilliant':
      if (!a.gain || head?.kind !== 'brilliant') return undefined;
      return { player: head.player, card: skillCard(s, head.player, 'brilliant') ?? 'brilliant' };
    case 'dangerous':
      return a.destroy && head?.kind === 'dangerous' ? find(head.player, (r) => r.combat?.destroyBoth) : undefined;
    case 'ruthless':
      return a.skill && head?.kind === 'ruthless' ? find(head.player, (r) => r.disableSkillOnDestroy) : undefined;
    case 'profiteer':
      return head?.kind === 'takeCard' ? find(head.player, (r) => r.missileForConquest) : undefined;
    default:
      // Activated skills are actions of the player's own turn.
      return find(s.turn.player, (r) => r.activated === a.type);
  }
}
