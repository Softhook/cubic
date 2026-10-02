/** Basic lookups on a state: where dice are, what is on a space. No rules, no skills. */
import { cellAt } from './board';
import { RuleError, type Cell, type Die, type GameState, type PlayerId } from './types';

/** The die with this id. An unknown id is an illegal action (it can only come from outside). */
export function die(state: GameState, id: string): Die {
  const d = state.dice.find((x) => x.id === id);
  if (!d) throw new RuleError(`Unknown ship ${id}`);
  return d;
}

export function dieAt(state: GameState, p: Cell): Die | undefined {
  return state.dice.find((d) => d.loc.zone === 'board' && d.loc.r === p.r && d.loc.c === p.c);
}

export function cellOf(d: Die): Cell | null {
  return d.loc.zone === 'board' ? { r: d.loc.r, c: d.loc.c } : null;
}

export function shipsOnBoard(state: GameState, player?: PlayerId): Die[] {
  return state.dice.filter((d) => d.loc.zone === 'board' && (player === undefined || d.owner === player));
}

export function scrapyard(state: GameState, player: PlayerId): Die[] {
  return state.dice.filter((d) => d.owner === player && d.loc.zone === 'scrapyard');
}

export function reserve(state: GameState, player: PlayerId): Die[] {
  return state.dice.filter((d) => d.owner === player && d.loc.zone === 'reserve');
}

export function isEmptySpace(state: GameState, p: Cell): boolean {
  const cell = cellAt(state.board, p);
  return !!cell && cell.kind === 'space' && !dieAt(state, p);
}
