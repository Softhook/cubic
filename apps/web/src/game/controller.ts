import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  actor,
  cellOf,
  die as getDie,
  key,
  moveOptions,
  same,
  scrapyard,
  tacticalOptions,
  type Action,
  type Cell,
  type GameState,
} from '@quantum/engine';
import { sfx } from '../sound';
import { legalFor, NO_LEGAL } from './legal';

export type Sel =
  | { kind: 'none' }
  | { kind: 'ship'; die: string }
  | { kind: 'scrap'; die: string }
  | { kind: 'swap'; die: string }
  | { kind: 'freeAttack'; die: string }
  | { kind: 'tactical'; die: string }
  // `tactical`: a 1-space transport using the Tactical skill instead of a Move action.
  | { kind: 'carryPassenger'; die: string; tactical?: boolean }
  | { kind: 'carryDest'; die: string; passenger: string; tactical?: boolean }
  | { kind: 'carryDrop'; die: string; passenger: string; to: Cell; tactical?: boolean };

export type CellTone = 'move' | 'diagonal' | 'deploy' | 'gate' | 'drop';
export type DieTone = 'attack' | 'swap' | 'target' | 'passenger';
export type PlanetTone = 'conquer' | 'infamy' | 'start' | 'blocked';

export interface Highlights {
  cells: Map<string, { cell: Cell; tone: CellTone }>;
  dice: Map<string, DieTone>;
  planets: Map<number, { tone: PlanetTone; label: string }>;
}

export function useController(game: GameState, dispatch: (a: Action) => boolean) {
  const [sel, setSel] = useState<Sel>({ kind: 'none' });
  const head = game.pending[0];
  const who = actor(game);
  const human = game.phase !== 'over' && !game.players[who].ai;
  const actionPhase = game.phase === 'play' && !head && game.turn.phase === 'actions' && human;

  // Clear selection whenever the turn or the pending decision changes.
  const pendingSig = `${game.turn.number}:${head?.kind ?? ''}:${game.pending.length}`;
  useEffect(() => setSel({ kind: 'none' }), [pendingSig]);
  // Drop a selection that is no longer valid (ship destroyed, already moved…).
  useEffect(() => {
    if (sel.kind === 'none') return;
    const d = game.dice.find((x) => x.id === sel.die);
    if (!d) setSel({ kind: 'none' });
    else if (sel.kind === 'scrap' && d.loc.zone !== 'scrapyard') setSel({ kind: 'none' });
    else if (sel.kind !== 'scrap' && d.loc.zone !== 'board') setSel({ kind: 'none' });
  }, [game, sel]);

  // Everything the human may do now. Highlights and buttons are derived from it, never from rules.
  const legal = useMemo(() => (human ? legalFor(game) : NO_LEGAL), [game, human]);

  const highlights = useMemo<Highlights>(() => {
    const h: Highlights = { cells: new Map(), dice: new Map(), planets: new Map() };
    const addCells = (cells: Cell[], tone: CellTone) => cells.forEach((c) => h.cells.set(key(c), { cell: c, tone }));
    if (!human) return h;

    if (head) {
      switch (head.kind) {
        case 'placeStart':
          for (const a of legal.of('placeStart')) h.planets.set(a.planet, { tone: 'start', label: 'Start here' });
          break;
        case 'placeShips': {
          const die = sel.kind === 'scrap' ? sel.die : scrapyard(game, head.player)[0]?.id;
          addCells(legal.of('placeShip', (a) => a.die === die).map((a) => a.to), 'deploy');
          break;
        }
        case 'infamy':
          for (const a of legal.of('infamy')) h.planets.set(a.planet, { tone: 'infamy', label: 'Seize' });
          break;
        case 'placeExpansion':
          addCells(legal.of('placeExpansion').flatMap((a) => (a.to ? [a.to] : [])), 'deploy');
          break;
        case 'showOfForce':
          for (const a of legal.of('showOfForce')) h.dice.set(a.die, 'target');
          break;
        case 'warpGate':
          addCells(legal.of('warpGate').map((a) => a.cell), 'gate');
          break;
        case 'unveil':
          if (sel.kind === 'scrap') addCells(legal.of('unveilDeploy', (a) => a.die === sel.die).map((a) => a.to), 'deploy');
          if (head.reorganize) {
            for (const a of legal.of('unveilReroll')) if (getDie(game, a.die).loc.zone === 'board') h.dice.set(a.die, 'swap');
          }
          break;
      }
      return h;
    }
    if (!actionPhase) return h;

    for (const a of legal.of('conquer')) h.planets.set(a.planet, { tone: 'conquer', label: 'Conquer' });
    const transports = (die: string, tactical?: boolean) =>
      tactical
        ? legal.of('tactical', (a) => a.die === die && !!a.passenger).map((a) => ({ passenger: a.passenger!, to: a.to!, drop: a.drop! }))
        : legal.of('carry', (a) => a.die === die);
    switch (sel.kind) {
      case 'ship': {
        const diagonal = moveOptions(game, sel.die).moves;
        for (const a of legal.of('move', (a) => a.die === sel.die)) {
          h.cells.set(key(a.to), { cell: a.to, tone: diagonal.get(key(a.to))?.diagonal ? 'diagonal' : 'move' });
        }
        for (const a of legal.of('attack', (a) => a.die === sel.die)) h.dice.set(a.target, 'attack');
        break;
      }
      case 'scrap':
        addCells(legal.of('deploy', (a) => a.die === sel.die).map((a) => a.to), 'deploy');
        break;
      case 'tactical': {
        const steps = tacticalOptions(game, sel.die).moves;
        for (const a of legal.of('tactical', (a) => a.die === sel.die && !a.passenger)) {
          if (a.target) h.dice.set(a.target, 'attack');
          else if (a.to) h.cells.set(key(a.to), { cell: a.to, tone: steps.find((m) => same(m.cell, a.to!))?.diagonal ? 'diagonal' : 'move' });
        }
        break;
      }
      case 'swap':
        for (const a of legal.of('swap', (a) => a.die === sel.die)) h.dice.set(a.other, 'swap');
        break;
      case 'freeAttack':
        for (const a of legal.of('freeAttack', (a) => a.die === sel.die)) h.dice.set(a.target, 'attack');
        break;
      case 'carryPassenger':
        for (const t of transports(sel.die, sel.tactical)) h.dice.set(t.passenger, 'passenger');
        break;
      case 'carryDest':
        addCells(transports(sel.die, sel.tactical).filter((t) => t.passenger === sel.passenger).map((t) => t.to), 'move');
        break;
      case 'carryDrop':
        addCells(
          transports(sel.die, sel.tactical)
            .filter((t) => t.passenger === sel.passenger && same(t.to, sel.to))
            .map((t) => t.drop),
          'drop',
        );
        break;
    }
    return h;
  }, [game, sel, human, head, actionPhase, legal]);

  const select = useCallback((s: Sel) => {
    if (s.kind !== 'none') sfx.select();
    setSel(s);
  }, []);

  const onDie = useCallback(
    (id: string) => {
      if (!human) return;
      const tone = highlights.dice.get(id);
      if (head?.kind === 'showOfForce' && tone) return void dispatch({ type: 'showOfForce', die: id });
      if (head?.kind === 'unveil' && head.reorganize && tone === 'swap') return void dispatch({ type: 'unveilReroll', die: id });
      if (head) return;
      if (sel.kind === 'swap' && tone === 'swap') return void (dispatch({ type: 'swap', die: sel.die, other: id }) && setSel({ kind: 'none' }));
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
        return select(sel.kind === 'ship' && sel.die === id ? { kind: 'none' } : { kind: 'ship', die: id });
      }
      setSel({ kind: 'none' });
    },
    [human, highlights, head, sel, game, actionPhase, dispatch, select],
  );

  const onCell = useCallback(
    (cell: Cell) => {
      if (!human) return;
      const hl = highlights.cells.get(key(cell));
      if (!hl) return setSel(sel.kind === 'scrap' ? sel : { kind: 'none' });
      if (head?.kind === 'warpGate') return void dispatch({ type: 'warpGate', cell });
      if (head?.kind === 'placeExpansion') return void dispatch({ type: 'placeExpansion', to: cell });
      if (head?.kind === 'placeShips') {
        // Place the selected ship, or the next one in the scrapyard.
        const d = sel.kind === 'scrap' ? sel.die : scrapyard(game, head.player)[0]?.id;
        if (d && dispatch({ type: 'placeShip', die: d, to: cell })) sfx.move();
        return setSel({ kind: 'none' });
      }
      if (head?.kind === 'unveil' && sel.kind === 'scrap') {
        dispatch({ type: 'unveilDeploy', die: sel.die, to: cell });
        return setSel({ kind: 'none' });
      }
      switch (sel.kind) {
        case 'ship':
          if (dispatch({ type: 'move', die: sel.die, to: cell })) {
            sfx.move();
            setSel({ kind: 'none' });
          }
          return;
        case 'scrap':
          if (dispatch({ type: 'deploy', die: sel.die, to: cell })) {
            sfx.move();
            setSel({ kind: 'none' });
          }
          return;
        case 'tactical':
          if (dispatch({ type: 'tactical', die: sel.die, to: cell })) {
            sfx.move();
            setSel({ kind: 'none' });
          }
          return;
        case 'carryDest':
          return select({ kind: 'carryDrop', die: sel.die, passenger: sel.passenger, to: cell, tactical: sel.tactical });
        case 'carryDrop':
          if (dispatch({ type: sel.tactical ? 'tactical' : 'carry', die: sel.die, passenger: sel.passenger, to: sel.to, drop: cell })) {
            sfx.move();
            setSel({ kind: 'none' });
          }
          return;
      }
    },
    [human, highlights, head, sel, dispatch, select],
  );

  const onPlanet = useCallback(
    (id: number) => {
      if (!human) return;
      const hl = highlights.planets.get(id);
      if (!hl) return;
      if (hl.tone === 'start') dispatch({ type: 'placeStart', planet: id });
      else if (hl.tone === 'infamy') dispatch({ type: 'infamy', planet: id });
      else if (hl.tone === 'conquer') dispatch({ type: 'conquer', planet: id });
    },
    [human, highlights, dispatch],
  );

  return { sel, select, highlights, legal, onDie, onCell, onPlanet, human, actionPhase };
}

export type Controller = ReturnType<typeof useController>;

/** One-line guidance for the current human decision. */
export function hintFor(game: GameState, sel: Sel): string {
  const head = game.pending[0];
  if (head) {
    switch (head.kind) {
      case 'placeStart':
        return 'Choose a glowing starting planet for your first quantum cube.';
      case 'placeShips':
        return 'Place your ships in orbit of your starting planet: pick a ship in your scrapyard (or take the next one), then a glowing space.';
      case 'infamy':
        return 'Infamy! Seize any planet that does not have your cube yet.';
      case 'takeCard':
        return `Take ${head.count} card${head.count > 1 ? 's' : ''} from the market below.`;
      case 'placeExpansion':
        return 'Place your new ship in orbit of one of your planets, or send it to your scrapyard.';
      case 'showOfForce':
        return 'Show of Force: choose any ship on the map to destroy.';
      case 'warpGate':
        return `Place Warp Gate ${head.placed.length + 1} of 2 on an empty space.`;
      case 'unveil':
        return head.reorganize
          ? 'Reorganization: click your ships to re-roll them, then place re-rolled ships from your scrapyard. Press Done when finished.'
          : 'Unveil the Fleet: re-roll and deploy ships from your scrapyard, then press Done.';
      case 'discardSkill':
        return head.reason === 'sabotage' ? 'Sabotage! Choose a card to discard.' : 'Choose a card to discard.';
      case 'advance':
        return 'Victory! Advance into the destroyed ship’s space, or hold your position.';
      default:
        return '';
    }
  }
  switch (sel.kind) {
    case 'ship':
      return 'Click a highlighted space to move, or a red target to attack.';
    case 'scrap':
      return 'Click a highlighted orbital space to deploy this ship.';
    case 'swap':
      return 'Choose another of your ships to switch places with.';
    case 'freeAttack':
      return 'Choose an adjacent enemy to attack for free.';
    case 'tactical':
      return 'Tactical: move one space, or attack an adjacent enemy.';
    case 'carryPassenger':
      return 'Choose a ship next to your flagship to carry.';
    case 'carryDest':
      return sel.tactical ? 'Tactical: choose the space the flagship moves to.' : 'Choose where the flagship flies (its own space means out and back).';
    case 'carryDrop':
      return 'Choose where to drop the passenger.';
  }
  return 'Select a ship. Planets glow when your orbiting ships add up to the planet number.';
}
