/**
 * Advance cards: the market (taking, peeking, refilling), one-shot Tactic / Gambit effects and
 * the decisions they open, and the skill limit.
 *
 * To add a Tactic: list its effect in TACTIC_EFFECT_IDS (effects.ts); the compiler then asks for
 * its entry in TACTIC_EFFECTS. Skills are listed in SKILL_EFFECTS (effects.ts).
 */
import { same } from './board';
import { destroyShip, fail, gainDominance, headOf, log, name, roll, shipName, type Handlers } from './core';
import { card, cardKind, effectOf } from './data';
import type { TacticEffect } from './effects';
import { die, reserve, shipsOnBoard } from './lookups';
import { canRefreshMarket, canTakeCard, deployTargets, skillLimit } from './queries';
import { shuffle } from './rng';
import { rulesOf } from './rules';
import type { DeckKind, GameState, PlayerId } from './types';

// ---------------------------------------------------------------------------
// Tactic effects

type TacticEffectFn = (s: GameState, p: PlayerId) => void;

/** What each Tactic / Gambit does when taken. Effects that need a choice push a pending decision. */
const TACTIC_EFFECTS: Record<TacticEffect, TacticEffectFn> = {
  aggression: (s, p) => gainDominance(s, p, 2),
  'black-market': (s, p) => {
    s.players[p].missiles += 2;
  },
  'change-of-heart': (s, p) => {
    if (s.market.skillDeck.length) s.pending.unshift({ kind: 'changeOfHeart', player: p });
  },
  momentum: (s, p) => {
    s.players[p].bonusTurns.push(2);
  },
  'plan-ahead': (s, p) => {
    s.players[p].planAhead = 2;
  },
  sabotage: (s, p) => {
    for (const o of s.players) if (o.id !== p) o.actionPenalty++;
  },
  'show-of-force': (s, p) => {
    if (shipsOnBoard(s).length) s.pending.unshift({ kind: 'showOfForce', player: p });
  },
  'unveil-the-fleet': (s, p) => {
    for (const d of shipsOnBoard(s, p)) destroyShip(s, d);
    s.pending.unshift({ kind: 'unveil', player: p, rerolled: [] });
  },
  'warp-gate': (s, p) => {
    s.pending.unshift({ kind: 'warpGate', player: p, placed: [] });
  },
  expansion: (s, p) => {
    const res = reserve(s, p);
    if (!res.length) {
      log(s, `${s.players[p].name} has no reserve ships left.`, p);
      return;
    }
    roll(s, res[0]);
    s.pending.unshift({ kind: 'placeExpansion', player: p, die: res[0].id });
  },
  reorganization: (s, p) => {
    s.pending.unshift({ kind: 'unveil', player: p, rerolled: [], reorganize: true });
  },
  'sabotage-original': (s, p) => {
    for (const o of s.players) {
      if (o.id !== p && o.skills.length) s.pending.unshift({ kind: 'discardSkill', player: o.id, reason: 'sabotage' });
    }
  },
};

// ---------------------------------------------------------------------------
// Market

/** Draws from a deck, reshuffling its discards when it runs out. */
function draw(s: GameState, deck: DeckKind): string | undefined {
  const m = s.market;
  const d = deck === 'skill' ? m.skillDeck : m.tacticDeck;
  const discard = deck === 'skill' ? m.skillDiscard : m.tacticDiscard;
  if (!d.length && discard.length) {
    d.push(...shuffle(s, discard));
    discard.length = 0;
  }
  return d.shift();
}

/** Takes a face-up card; the row slides away from the deck and a new card enters next to it. */
function takeFromRow(s: GameState, deck: DeckKind, index: number): string {
  const row = deck === 'skill' ? s.market.skillRow : s.market.tacticRow;
  if (index < 0 || index >= row.length) fail('No card there');
  const [taken] = row.splice(index, 1);
  const next = draw(s, deck);
  if (next) row.unshift(next);
  return taken;
}

function gainCard(s: GameState, p: PlayerId, id: string) {
  const def = card(id);
  const pl = s.players[p];
  if (cardKind(id) === 'skill') {
    pl.skills.push({ id, active: false });
    log(s, `${pl.name} takes the ${def.name} ${rulesOf(s).cards?.terms.skill ?? 'skill'}.`, p, 'cardTaken');
    if (pl.skills.length > skillLimit(s, p)) s.pending.unshift({ kind: 'discardSkill', player: p, reason: 'limit' });
  } else {
    log(s, `${pl.name} plays ${def.name}.`, p, 'cardPlayed');
    s.market.tacticDiscard.push(id);
    const effect = TACTIC_EFFECTS[effectOf(id) as TacticEffect] as TacticEffectFn | undefined;
    if (!effect) throw new Error(`Unhandled tactic ${id}`);
    effect(s, p);
  }
}

/** Counts one card taken from the current takeCard decision. */
function consumeCardPick(s: GameState) {
  const head = s.pending[0];
  if (head?.kind !== 'takeCard') return;
  head.count--;
  if (head.count <= 0) s.pending.shift();
}

export const cardHandlers = {
  takeCard(s, a) {
    const head = headOf(s, 'takeCard', 'Not taking a card');
    const p = head.player;
    if (a.deck === 'expansion') {
      const res = reserve(s, p);
      if (s.market.expansions <= 0) fail('No Expansion cards left');
      if (!res.length) fail('Your reserve is empty');
      consumeCardPick(s);
      s.market.expansions--;
      roll(s, res[0]);
      s.pending.unshift({ kind: 'placeExpansion', player: p, die: res[0].id });
      log(s, `${name(s, p)} expands their fleet.`, p, 'expansion');
      return;
    }
    const deck = a.deck === 'skill' ? s.market.skillDeck : s.market.tacticDeck;
    const row = a.deck === 'skill' ? s.market.skillRow : s.market.tacticRow;
    if (row[a.index] !== undefined && !canTakeCard(s, p, row[a.index])) fail('Your reserve is empty');
    // Peek: taking the oldest card lets you look at the top of the deck first.
    if (rulesOf(s).cards?.peek && a.index === row.length - 1 && row.length === 3 && deck.length) {
      s.pending.unshift({ kind: 'peek', player: p, deck: a.deck, top: deck[0] });
      return;
    }
    consumeCardPick(s);
    gainCard(s, p, takeFromRow(s, a.deck, a.index));
  },
  peekChoice(s, a) {
    const head = headOf(s, 'peek', 'Not peeking');
    s.pending.shift();
    consumeCardPick(s);
    const id = a.takeTop
      ? (head.deck === 'skill' ? s.market.skillDeck : s.market.tacticDeck).shift()!
      : takeFromRow(s, head.deck, 2);
    gainCard(s, head.player, id);
  },
  /** Original (2013 rulebook p.9): spend a card pick to discard all face-up cards and deal new ones. */
  refreshMarket(s) {
    const head = headOf(s, 'takeCard', 'Not taking a card');
    if (!canRefreshMarket(s)) fail('You cannot deal new cards');
    const m = s.market;
    m.skillDiscard.push(...m.skillRow.splice(0));
    m.tacticDiscard.push(...m.tacticRow.splice(0));
    for (let i = 0; i < 3; i++) {
      const skill = draw(s, 'skill');
      if (skill) m.skillRow.push(skill);
      const tactic = draw(s, 'tactic');
      if (tactic) m.tacticRow.push(tactic);
    }
    consumeCardPick(s);
    log(s, `${name(s, head.player)} discards the face-up cards and deals new ones.`, head.player, 'discard');
  },
  discardSkill(s, a) {
    const head = headOf(s, 'discardSkill', 'Not discarding');
    const pl = s.players[head.player];
    const i = pl.skills.findIndex((x) => x.id === a.skill);
    if (i < 0) fail('You do not have that skill');
    pl.skills.splice(i, 1);
    s.market.skillDiscard.push(a.skill);
    s.pending.shift();
    log(s, `${pl.name} discards ${card(a.skill).name}.`, head.player, 'discard');
    if (pl.skills.length > skillLimit(s, head.player)) s.pending.unshift({ ...head, reason: 'limit' });
  },
  placeExpansion(s, a) {
    const head = headOf(s, 'placeExpansion', 'No expansion ship to place');
    const d = die(s, head.die);
    if (a.to) {
      if (!deployTargets(s, head.player).some((p) => same(p, a.to!))) fail('Place it in orbit of one of your planets');
      d.loc = { zone: 'board', ...a.to };
    } else d.loc = { zone: 'scrapyard' };
    s.turn.seen[d.id] = [d.value];
    s.pending.shift();
  },
  showOfForce(s, a) {
    const head = headOf(s, 'showOfForce', 'No Show of Force to resolve');
    const d = die(s, a.die);
    if (d.loc.zone !== 'board') fail('Choose a ship on the map');
    s.pending.shift();
    log(s, `${name(s, head.player)} destroys ${name(s, d.owner)}'s ${shipName(d)}.`, head.player, 'shipDestroyed');
    destroyShip(s, d);
    gainDominance(s, head.player, 1);
  },
  warpGate(s, a) {
    const head = headOf(s, 'warpGate', 'No Warp Gate to place');
    const cell = s.board.cells[a.cell.r]?.[a.cell.c];
    if (!cell || cell.kind !== 'space') fail('Gates go on empty spaces');
    if (head.placed.some((p) => same(p, a.cell))) fail('Choose a different space');
    head.placed.push(a.cell);
    if (head.placed.length === 2) {
      s.gates = head.placed;
      s.pending.shift();
    }
  },
  changeOfHeart(s, a) {
    const head = headOf(s, 'changeOfHeart', 'Not choosing a skill');
    const i = s.market.skillDeck.indexOf(a.skill);
    if (i < 0) fail('That skill is not in the deck');
    s.market.skillDeck.splice(i, 1);
    s.market.skillDeck = shuffle(s, s.market.skillDeck);
    s.pending.shift();
    gainCard(s, head.player, a.skill);
  },
  unveilReroll(s, a) {
    const head = headOf(s, 'unveil', 'Not unveiling');
    const d = die(s, a.die);
    const zones = head.reorganize ? ['board', 'scrapyard'] : ['scrapyard'];
    if (d.owner !== head.player || !zones.includes(d.loc.zone)) fail('Choose one of your ships');
    if (head.rerolled.includes(d.id)) fail('Already re-rolled');
    head.rerolled.push(d.id);
    // Reorganization: a re-rolled ship leaves the map and is placed again (or scrapped).
    if (head.reorganize) d.loc = { zone: 'scrapyard' };
    roll(s, d);
  },
  unveilDeploy(s, a) {
    const head = headOf(s, 'unveil', 'Not unveiling');
    const d = die(s, a.die);
    if (d.owner !== head.player || d.loc.zone !== 'scrapyard') fail('Choose a ship in your scrapyard');
    if (head.reorganize && !head.rerolled.includes(d.id)) fail('Only re-rolled ships can be placed');
    if (!deployTargets(s, head.player).some((p) => same(p, a.to))) fail('Not a deploy space');
    d.loc = { zone: 'board', ...a.to };
  },
  unveilDone(s) {
    headOf(s, 'unveil', 'Not unveiling');
    s.pending.shift();
  },
} satisfies Partial<Handlers>;
