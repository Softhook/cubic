import { useCallback, useEffect, useMemo, useState } from 'react';
import { actor, cellOf, die as getDie, key, scrapyard, type Action, type Cell, type GameState, type PlayerId } from '@quantum/engine';
import { sfx } from '../sound';
import { highlightsFor, noHighlights } from './highlights';
import { legalFor, NO_LEGAL } from './legal';
import type { Dispatch } from './useGame';

export type Sel =
  | { kind: 'none' }
  | { kind: 'ship'; die: string }
  | { kind: 'scrap'; die: string }
  | { kind: 'swap'; die: string }
  | { kind: 'freeAttack'; die: string }
  | { kind: 'tactical'; die: string }
  | { kind: 'nomadic'; die: string }
  // Relocation: the cube chosen to move (planet it leaves, and its owner).
  | { kind: 'relocate'; planet: number; owner: number }
  // `tactical`: a 1-space transport using the Tactical skill instead of a Move action.
  | { kind: 'carryPassenger'; die: string; tactical?: boolean }
  | { kind: 'carryDest'; die: string; passenger: string; tactical?: boolean }
  | { kind: 'carryDrop'; die: string; passenger: string; to: Cell; tactical?: boolean };

const NONE: Sel = { kind: 'none' };

/** `mine`: whether this screen plays for a player (see GameView). */
export function useController(game: GameState, dispatch: Dispatch, mine: (p: PlayerId) => boolean) {
  const [sel, setSel] = useState<Sel>(NONE);
  const head = game.pending[0];
  const who = actor(game);
  const human = game.phase !== 'over' && mine(who);
  const actionPhase = game.phase === 'play' && !head && game.turn.phase === 'actions' && human;

  // Clear selection whenever the turn or the pending decision changes.
  const pendingSig = `${game.turn.number}:${head?.kind ?? ''}:${game.pending.length}`;
  useEffect(() => setSel(NONE), [pendingSig]);
  // Drop a selection that is no longer valid (ship destroyed, already moved…).
  useEffect(() => {
    if (sel.kind === 'none' || sel.kind === 'relocate') return;
    const d = game.dice.find((x) => x.id === sel.die);
    if (!d || d.loc.zone !== (sel.kind === 'scrap' ? 'scrapyard' : 'board')) setSel(NONE);
  }, [game, sel]);

  // Everything the human may do now. Highlights and buttons are derived from it, never from rules.
  const legal = useMemo(() => (human ? legalFor(game) : NO_LEGAL), [game, human]);
  const highlights = useMemo(
    () => (human ? highlightsFor(game, sel, legal, actionPhase) : noHighlights()),
    [game, sel, human, actionPhase, legal],
  );

  const select = useCallback((s: Sel) => {
    if (s.kind !== 'none') sfx.select();
    setSel(s);
  }, []);

  /** Sends a ship somewhere; on success, plays the move sound and clears the selection. */
  const place = useCallback(
    (a: Action) => {
      if (!dispatch(a)) return;
      sfx.move();
      setSel(NONE);
    },
    [dispatch],
  );

  /** A tap on a ship. Returns false when it had nothing to do, so the board can show the ship's info instead. */
  const onDie = useCallback(
    (id: string): false | void => {
      if (!human) return false;
      const tone = highlights.dice.get(id);
      if (head?.kind === 'showOfForce' && tone) return void dispatch({ type: 'showOfForce', die: id });
      if (head?.kind === 'unveil' && head.reorganize && tone === 'swap') return void dispatch({ type: 'unveilReroll', die: id });
      if (head) return false;
      if (sel.kind === 'swap' && tone === 'swap') return void (dispatch({ type: 'swap', die: sel.die, other: id }) && setSel(NONE));
      if (sel.kind === 'freeAttack' && tone === 'attack') return void dispatch({ type: 'freeAttack', die: sel.die, target: id });
      if (sel.kind === 'tactical' && tone === 'attack') return void dispatch({ type: 'tactical', die: sel.die, target: id });
      if (sel.kind === 'ship' && tone === 'attack') return void dispatch({ type: 'attack', die: sel.die, target: id });
      if (sel.kind === 'carryPassenger' && tone === 'passenger') return select({ kind: 'carryDest', die: sel.die, passenger: id, tactical: sel.tactical });
      if (sel.kind === 'carryDest' && id === sel.die) {
        // Out-and-back transport: the flagship ends where it started.
        const here = cellOf(getDie(game, id));
        if (here && highlights.cells.has(key(here))) return select({ kind: 'carryDrop', die: sel.die, passenger: sel.passenger, to: here });
      }
      const d = getDie(game, id);
      if (actionPhase && d.owner === game.turn.player) {
        return select(sel.kind === 'ship' && sel.die === id ? NONE : { kind: 'ship', die: id });
      }
      setSel(NONE);
      return false;
    },
    [human, highlights, head, sel, game, actionPhase, dispatch, select],
  );

  const onCell = useCallback(
    (cell: Cell) => {
      if (!human) return;
      if (!highlights.cells.has(key(cell))) return setSel(sel.kind === 'scrap' ? sel : NONE);
      if (head?.kind === 'advance') return void dispatch({ type: 'advance', move: true });
      if (head?.kind === 'warpGate') return void dispatch({ type: 'warpGate', cell });
      if (head?.kind === 'placeExpansion') return void dispatch({ type: 'placeExpansion', to: cell });
      if (head?.kind === 'placeShips') {
        // Place the selected ship, or the next one in the scrapyard.
        const d = sel.kind === 'scrap' ? sel.die : scrapyard(game, head.player)[0]?.id;
        if (d && dispatch({ type: 'placeShip', die: d, to: cell })) sfx.move();
        return setSel(NONE);
      }
      if (head?.kind === 'unveil' && sel.kind === 'scrap') {
        dispatch({ type: 'unveilDeploy', die: sel.die, to: cell });
        return setSel(NONE);
      }
      switch (sel.kind) {
        case 'ship':
          return place({ type: 'move', die: sel.die, to: cell });
        case 'scrap':
          return place({ type: 'deploy', die: sel.die, to: cell });
        case 'tactical':
        case 'nomadic':
          return place({ type: sel.kind, die: sel.die, to: cell });
        case 'carryDest':
          return select({ kind: 'carryDrop', die: sel.die, passenger: sel.passenger, to: cell, tactical: sel.tactical });
        case 'carryDrop':
          return place({ type: sel.tactical ? 'tactical' : 'carry', die: sel.die, passenger: sel.passenger, to: sel.to, drop: cell });
      }
    },
    [human, highlights, head, sel, game, dispatch, select, place],
  );

  /** A tap on a planet. Returns false when it had nothing to do, so the board can show the planet's info instead. */
  const onPlanet = useCallback(
    (id: number): false | void => {
      if (!human) return false;
      const hl = highlights.planets.get(id);
      if (!hl) return false;
      if (head?.kind === 'relocation') {
        if (sel.kind === 'relocate' && id !== sel.planet) return void dispatch({ type: 'relocate', planet: sel.planet, owner: sel.owner, to: id });
        // Choose the cube; clicking its planet again picks another player's cube there, if any.
        const owners = [...new Set(legal.of('relocate', (a) => a.planet === id).map((a) => a.owner))];
        const next = sel.kind === 'relocate' && sel.planet === id ? owners[(owners.indexOf(sel.owner) + 1) % owners.length] : owners[0];
        return select({ kind: 'relocate', planet: id, owner: next });
      }
      if (hl.tone === 'start') dispatch({ type: 'placeStart', planet: id });
      else if (hl.tone === 'infamy') dispatch({ type: 'infamy', planet: id });
      else if (hl.tone === 'conquer') dispatch({ type: 'conquer', planet: id });
    },
    [human, highlights, head, sel, legal, dispatch, select],
  );

  return { sel, select, highlights, legal, onDie, onCell, onPlanet, human, actionPhase, mine };
}

export type Controller = ReturnType<typeof useController>;
