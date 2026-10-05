/**
 * Advance cards: the market (taking, peeking, refilling), one-shot Tactic / Gambit effects and
 * the decisions they open, and the skill limit.
 *
 * To add a Tactic: list its effect in TACTIC_EFFECT_IDS (effects.ts); the compiler then asks for
 * its entry in TACTIC_EFFECTS. Skills are listed in SKILL_EFFECTS (effects.ts).
 */
import { same } from './board';
import { destroyedEnemyShip, destroyShip, fail, gainDominance, headOf, log, name, requireActionPhase, rollShip, shipName, type Handlers, type PendingOf } from './core';
import { card, cardKind, effectOf } from './data';
import type { TacticEffect } from './effects';
import { die, reserve, shipsOnBoard } from './lookups';
import { canPlayStoredTactic, canProfiteer, canRefreshMarket, canRelocate, canTakeCard, deployTargets, relocationOptions, skillLimit } from './queries';
import { shuffle } from './rng';
import { rulesOf } from './rules';
import { anySkill, ruleOf } from './skillRules';
import type { DeckKind, GameState, PlayerId, PlayerState } from './types';

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
    const m = s.market;
    // Like a draw: an empty deck is first refilled from its discards.
    if (!m.skillDeck.length && m.skillDiscard.length) {
      m.skillDeck.push(...shuffle(s, m.skillDiscard));
      m.skillDiscard.length = 0;
    }
    if (m.skillDeck.length) s.pending.unshift({ kind: 'changeOfHeart', player: p });
  },
  momentum: (s, p) => {
    s.players[p].bonusTurns.push(2);
    // Gambits resolve at once (designer, BGG thread 1068669): the bonus turn comes before any
    // picks still owed, which are taken in its card phase (as on Board Game Arena).
    // On the player's own turn, other players' off-turn picks still come after all of theirs
    // (designer, BGG thread 1087563), so they move to the bonus turn's card phase too. Taken on
    // someone else's turn, the bonus turn follows this one (see finishTurn) and only the player's
    // own picks move; the others go on as before.
    const ownTurn = p === s.turn.player;
    s.pending = s.pending.filter((x) => {
      if (x.kind !== 'takeCard' || (!ownTurn && x.player !== p)) return true;
      carryPicks(s.players[x.player], x);
      return false;
    });
  },
  'plan-ahead': (s, p) => {
    // "Until the end of your next turn": taken off-turn, that is the player's coming turn.
    s.players[p].planAhead = p === s.turn.player ? 2 : 1;
  },
  sabotage: (s, p) => {
    for (const o of s.players) if (o.id !== p) o.actionPenalty++;
  },
  'show-of-force': (s, p) => {
    if (shipsOnBoard(s).length) s.pending.unshift({ kind: 'showOfForce', player: p });
  },
  'unveil-the-fleet': (s, p) => {
    s.pending.unshift({ kind: 'unveil', player: p, rerolled: [] });
    for (const d of shipsOnBoard(s, p)) destroyShip(s, d);
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
    // Placed after the roll is final (a Clever choice comes first).
    s.pending.unshift({ kind: 'placeExpansion', player: p, die: res[0].id });
    rollShip(s, res[0]);
  },
  relocation: (s, p) => {
    if (relocationOptions(s, p).length) s.pending.unshift({ kind: 'relocation', player: p });
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
    // Resolved before any discard, so a Tactic stored now is lost if Patient itself is then discarded.
    if (ruleOf(id).storeTactics) s.pending.unshift({ kind: 'patientTactic', player: p });
  } else {
    playTactic(s, p, id, `${pl.name} plays ${def.name}.`);
  }
}

/** A Tactic is discarded and its effect resolves. */
function playTactic(s: GameState, p: PlayerId, id: string, message: string) {
  log(s, message, p, 'cardPlayed');
  s.market.tacticDiscard.push(id);
  const effect = TACTIC_EFFECTS[effectOf(id) as TacticEffect] as TacticEffectFn | undefined;
  if (!effect) throw new Error(`Unhandled tactic ${id}`);
  effect(s, p);
}

/** Gains a card just taken, or with Patient stores the Tactic instead of playing it. */
function takeOrStore(s: GameState, p: PlayerId, id: string, store: boolean | undefined) {
  if (!store) return gainCard(s, p, id);
  const pl = s.players[p];
  (pl.storedTactics ??= []).push(id);
  log(s, `${pl.name} stores ${card(id).name} (Patient).`, p, 'cardTaken');
}

/** Moves a player's remaining picks to the Momentum turn's card phase. */
function carryPicks(pl: PlayerState, x: PendingOf<'takeCard'>) {
  pl.carriedPicks = (pl.carriedPicks ?? 0) + x.count;
  if (x.conquer) pl.carriedConquerPicks = (pl.carriedConquerPicks ?? 0) + x.conquer;
}

/** Counts one card taken from the current takeCard decision. */
function consumeCardPick(s: GameState) {
  const head = s.pending[0];
  if (head?.kind !== 'takeCard') return;
  head.count--;
  // A card can come from any pick, so the picks a Profiteering missile can replace are used last.
  if (head.conquer) head.conquer = Math.min(head.conquer, head.count);
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
      s.pending.unshift({ kind: 'placeExpansion', player: p, die: res[0].id });
      rollShip(s, res[0]);
      log(s, `${name(s, p)} expands their fleet.`, p, 'expansion');
      return;
    }
    if (a.store && (a.deck !== 'tactic' || !anySkill(s, p, (r) => r.storeTactics))) fail('Only a Tactic can be stored, with Patient');
    const deck = a.deck === 'skill' ? s.market.skillDeck : s.market.tacticDeck;
    const row = a.deck === 'skill' ? s.market.skillRow : s.market.tacticRow;
    if (row[a.index] !== undefined && !canTakeCard(s, p, row[a.index])) fail('Your reserve is empty');
    // Peek: taking the oldest card lets you look at the top of the deck first.
    if (rulesOf(s).cards?.peek && a.index === row.length - 1 && row.length === 3 && deck.length) {
      s.pending.unshift({ kind: 'peek', player: p, deck: a.deck, top: deck[0], store: a.store });
      return;
    }
    consumeCardPick(s);
    takeOrStore(s, p, takeFromRow(s, a.deck, a.index), a.store);
  },
  peekChoice(s, a) {
    const head = headOf(s, 'peek', 'Not peeking');
    s.pending.shift();
    consumeCardPick(s);
    const id = a.takeTop
      ? (head.deck === 'skill' ? s.market.skillDeck : s.market.tacticDeck).shift()!
      : takeFromRow(s, head.deck, 2);
    takeOrStore(s, head.player, id, head.store);
  },
  /** Profiteering: a pick earned by a Conquer action (not by Infamy; OPEN-QUESTIONS #64) becomes 1 missile. */
  profiteer(s) {
    const head = headOf(s, 'takeCard', 'Not taking a card');
    if (!canProfiteer(s)) fail('No card for conquering to trade');
    head.conquer!--;
    s.players[head.player].missiles++;
    log(s, `${name(s, head.player)} takes a missile instead of a card (Profiteering).`, head.player);
    consumeCardPick(s);
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
    if (a.skill === head.cannotDiscard) fail(`Cannot discard ${card(a.skill).name}`);
    const pl = s.players[head.player];
    const i = pl.skills.findIndex((x) => x.id === a.skill);
    if (i < 0) fail('You do not have that skill');
    pl.skills.splice(i, 1);
    if (effectOf(a.skill) === 'ambitious') pl.ambitionTokens = 0;
    if (ruleOf(a.skill).storeTactics && pl.storedTactics?.length) {
      s.market.tacticDiscard.push(...pl.storedTactics);
      pl.storedTactics.length = 0;
    }
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
    // The victim loses no dominance: only the attack protocol or card text changes it (RULE-SUGGESTIONS #26).
    if (d.owner === head.player) gainDominance(s, head.player, 1);
    else destroyedEnemyShip(s, head.player, 1, d.owner);
  },
  warpGate(s, a) {
    const head = headOf(s, 'warpGate', 'No Warp Gate to place');
    const cell = s.board.cells[a.cell.r]?.[a.cell.c];
    if (!cell || cell.kind !== 'space') fail('Gates go on spaces, not planets');
    if (head.placed.some((p) => same(p, a.cell))) fail('Choose a different space');
    head.placed.push(a.cell);
    if (head.placed.length === 2) {
      s.gates = head.placed;
      s.pending.shift();
    }
  },
  /** Patient: "When you take this Skill, you may take and store a Tactic." */
  patientTactic(s, a) {
    const head = headOf(s, 'patientTactic', 'Not storing a tactic');
    if (a.index === undefined) {
      s.pending.shift();
      log(s, `${name(s, head.player)} does not store a tactic.`, head.player);
      return;
    }
    const id = takeFromRow(s, 'tactic', a.index);
    s.pending.shift();
    takeOrStore(s, head.player, id, true);
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
  relocate(s, a) {
    const head = headOf(s, 'relocation', 'No Relocation to resolve');
    if (!canRelocate(s, head.player, a)) fail("Move another player's cube to a planet without one of their cubes");
    s.pending.shift();
    const from = s.board.planets[a.planet];
    const to = s.board.planets[a.to];
    from.cubes.splice(from.cubes.lastIndexOf(a.owner), 1);
    to.cubes.push(a.owner);
    log(s, `${name(s, head.player)} relocates ${name(s, a.owner)}'s cube from planet ${from.number} to planet ${to.number}.`, head.player);
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
    rollShip(s, d);
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
  /** Patient: ends the action phase by playing one stored Tactic; unused actions are forfeited (OPEN-QUESTIONS #37). */
  playStoredTactic(s, a) {
    const t = requireActionPhase(s, true);
    const p = t.player;
    if (!canPlayStoredTactic(s, p)) fail('Cannot play a stored tactic right now');
    const pl = s.players[p];
    const idx = pl.storedTactics?.indexOf(a.card) ?? -1;
    if (idx === -1) fail('Card not in stored tactics');
    pl.storedTactics!.splice(idx, 1);
    t.storedTacticPlayed = true;
    t.actionsLeft = 0;
    playTactic(s, p, a.card, `${pl.name} plays stored tactic ${card(a.card).name}.`);
  },
} satisfies Partial<Handlers>;
