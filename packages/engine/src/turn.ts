/** Turn structure: start of turn, the end-of-turn card phase, and passing the turn on. */
import { ACTIONS_PER_TURN, emptyTurn, gainResearch, log, name, type PendingOf } from './core';
import { cellOf, scrapyard, shipsOnBoard } from './lookups';
import { breakthroughAt, canTakeAnyCard, infamyTargets, startSlots } from './queries';
import { rulesOf } from './rules';
import { skillRules, type TurnBonus } from './skillRules';
import type { GameState, Pending, PlayerId } from './types';

/** The start-of-turn bonuses of the player's skills, added up. */
function startOfTurnBonus(s: GameState, player: PlayerId): Required<TurnBonus> {
  const total = { actions: 0, freeDeploys: 0, freeMoves: 0, research: 0 };
  for (const r of skillRules(s, player)) {
    const b = r.startOfTurn?.(s, player) ?? {};
    total.actions += b.actions ?? 0;
    total.freeDeploys += b.freeDeploys ?? 0;
    total.freeMoves += b.freeMoves ?? 0;
    total.research += b.research ?? 0;
  }
  return total;
}

export function startTurn(s: GameState, player: PlayerId, actions: number, bonus: boolean) {
  const pl = s.players[player];
  s.turn = emptyTurn(player, s.turn.number + 1);
  s.turn.bonus = bonus;
  let n = actions;
  if (!bonus) {
    n -= pl.actionPenalty;
    pl.actionPenalty = 0;
  }
  const extra = startOfTurnBonus(s, player);
  s.turn.actionsLeft = Math.max(0, n) + extra.actions;
  s.turn.freeDeploys = extra.freeDeploys;
  s.turn.freeMoves = extra.freeMoves;
  for (const d of s.dice) if (d.owner === player) s.turn.seen[d.id] = [d.value];

  if (extra.research) gainResearch(s, player, extra.research);
  // Void tiles: +1 research per own ship on one.
  const onVoid = shipsOnBoard(s, player).filter((d) => {
    const c = cellOf(d)!;
    return s.board.cells[c.r][c.c].void;
  }).length;
  if (onVoid) gainResearch(s, player, onVoid);
  log(s, bonus ? `${pl.name} takes a bonus turn.` : `${pl.name}'s turn.`, player);
}

/** Setup is complete: the first player starts. */
export function beginPlay(s: GameState) {
  s.phase = 'play';
  s.turn.number = 0;
  startTurn(s, s.turn.player, ACTIONS_PER_TURN, false);
}

/** Phase 2: one card per cube placed this turn, plus one for a research breakthrough. */
export function endTurn(s: GameState) {
  const p = s.turn.player;
  const pl = s.players[p];
  s.turn.phase = 'cards';
  if (!rulesOf(s).cards) return;
  let cards = s.turn.conquests;
  if (pl.carriedPicks) {
    cards += pl.carriedPicks;
    delete pl.carriedPicks;
  }
  if (pl.research >= breakthroughAt(s, p)) {
    pl.research = 1;
    cards++;
    log(s, `${pl.name} makes a research breakthrough.`, p, 'breakthrough');
  }
  if (cards > 0) s.pending.push({ kind: 'takeCard', player: p, count: cards });
  // A cube placed on someone else's turn earns its card in this card phase, after the active
  // player, in turn order (designer, BGG thread 1087563).
  const off = s.turn.offTurnCubes ?? [];
  for (let i = 1; i < s.players.length; i++) {
    const o = (p + i) % s.players.length;
    const other = s.players[o];
    const count = off.filter((x) => x === o).length + (other.carriedPicks ?? 0);
    delete other.carriedPicks;
    if (count) s.pending.push({ kind: 'takeCard', player: o, count });
  }
}

function finishTurn(s: GameState) {
  const p = s.turn.player;
  const pl = s.players[p];
  for (const sk of pl.skills) sk.active = true;
  if (pl.planAhead > 0) pl.planAhead--;
  const bonus = pl.bonusTurns.shift();
  if (bonus !== undefined) startTurn(s, p, bonus, true);
  else startTurn(s, (p + 1) % s.players.length, ACTIONS_PER_TURN, false);
}

/**
 * Decisions that resolve themselves when they come up: each returns true if it removed the
 * decision from the queue (usually because there is no legal choice).
 */
const AUTO_RESOLVE: { [K in Pending['kind']]?: (s: GameState, head: PendingOf<K>) => boolean } = {
  placeShips(s, head) {
    if (scrapyard(s, head.player).length && startSlots(s, head.planet).length) return false;
    log(s, `${name(s, head.player)} deploys around planet ${s.board.planets[head.planet].number}.`, head.player, 'startPlanet');
    s.pending.shift();
    if (!s.pending.length) beginPlay(s);
    return true;
  },
  infamy(s, head) {
    if (infamyTargets(s, head.player).length) return false;
    log(s, `${name(s, head.player)} has nowhere to place an Infamy cube.`, head.player, 'infamy');
    s.pending.shift();
    return true;
  },
  showOfForce(s) {
    if (shipsOnBoard(s).length) return false;
    s.pending.shift();
    return true;
  },
  takeCard(s, head) {
    if (canTakeAnyCard(s, head.player)) return false;
    s.pending.shift();
    return true;
  },
};

/** Runs after every action: auto-resolves decisions and advances the turn when nothing is pending. */
export function settle(s: GameState) {
  for (let guard = 0; guard < 50; guard++) {
    if (s.phase === 'over') return;
    const head = s.pending[0];
    const auto = head && (AUTO_RESOLVE[head.kind] as ((s: GameState, h: Pending) => boolean) | undefined);
    if (auto?.(s, head)) continue;
    if (!head && s.phase === 'play' && s.turn.phase === 'cards') {
      finishTurn(s);
      continue;
    }
    return;
  }
}
