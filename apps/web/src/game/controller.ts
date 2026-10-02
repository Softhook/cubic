import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  actor,
  canMoveDie,
  carryOptions,
  carryPassengers,
  cellOf,
  conquerCheck,
  deployTargets,
  die as getDie,
  freeAttackTargets,
  hasSkill,
  tacticalOptions,
  infamyTargets,
  isEmptySpace,
  key,
  moveOptions,
  orbitals,
  scrapyard,
  same,
  shipsOnBoard,
  type Action,
  type Cell,
  type GameState,
} from '@quantum/engine';
import { sfx } from '../sound';

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

  const highlights = useMemo<Highlights>(() => {
    const h: Highlights = { cells: new Map(), dice: new Map(), planets: new Map() };
    const addCells = (cells: Cell[], tone: CellTone) => cells.forEach((c) => h.cells.set(key(c), { cell: c, tone }));
    if (!human) return h;

    if (head) {
      switch (head.kind) {
        case 'placeStart':
          for (const p of game.board.planets) if (p.start && !p.cubes.length) h.planets.set(p.id, { tone: 'start', label: 'Start here' });
          break;
        case 'placeShips':
          addCells(orbitals(game.board, game.board.planets[head.planet]).filter((p) => isEmptySpace(game, p)), 'deploy');
          break;
        case 'infamy':
          for (const p of infamyTargets(game, head.player)) h.planets.set(p.id, { tone: 'infamy', label: 'Seize' });
          break;
        case 'placeExpansion':
          addCells(deployTargets(game, head.player), 'deploy');
          break;
        case 'showOfForce':
          for (const d of shipsOnBoard(game)) h.dice.set(d.id, 'target');
          break;
        case 'warpGate': {
          const cells: Cell[] = [];
          for (let r = 0; r < game.board.rows; r++)
            for (let c = 0; c < game.board.cols; c++)
              if (isEmptySpace(game, { r, c }) && !head.placed.some((p) => same(p, { r, c }))) cells.push({ r, c });
          addCells(cells, 'gate');
          break;
        }
        case 'unveil':
          if (sel.kind === 'scrap') addCells(deployTargets(game, head.player), 'deploy');
          if (head.reorganize) {
            for (const d of shipsOnBoard(game, head.player)) if (!head.rerolled.includes(d.id)) h.dice.set(d.id, 'swap');
          }
          break;
      }
      return h;
    }
    if (!actionPhase) return h;

    const me = game.turn.player;
    // Attacking makes you pay for any Curious free moves already taken.
    const canAttack = (cost: number) => game.turn.actionsLeft >= cost + game.turn.freeMovesUsed;
    if (game.turn.actionsLeft >= 2) {
      for (const p of game.board.planets) {
        const check = conquerCheck(game, me, p.id);
        if (check.ok) h.planets.set(p.id, { tone: 'conquer', label: 'Conquer' });
      }
    }
    switch (sel.kind) {
      case 'ship': {
        const d = getDie(game, sel.die);
        const t = game.turn;
        if ((t.actionsLeft > 0 || t.freeMoves > 0) && canMoveDie(game, d)) {
          const opts = moveOptions(game, d.id);
          for (const m of opts.moves.values()) h.cells.set(key(m.cell), { cell: m.cell, tone: m.diagonal ? 'diagonal' : 'move' });
          if (canAttack(1)) for (const id of opts.attacks.keys()) h.dice.set(id, 'attack');
        }
        break;
      }
      case 'scrap':
        if (game.turn.actionsLeft > 0 || game.turn.freeDeploys > 0 || hasSkill(game, me, 'eager')) addCells(deployTargets(game, me), 'deploy');
        break;
      case 'tactical': {
        const opts = tacticalOptions(game, sel.die);
        for (const m of opts.moves) h.cells.set(key(m.cell), { cell: m.cell, tone: m.diagonal ? 'diagonal' : 'move' });
        if (canAttack(0)) for (const x of opts.attacks) h.dice.set(x.die.id, 'attack');
        break;
      }
      case 'swap':
        for (const d of shipsOnBoard(game, me)) if (d.id !== sel.die) h.dice.set(d.id, 'swap');
        break;
      case 'freeAttack':
        if (canAttack(0)) for (const d of freeAttackTargets(game, sel.die)) h.dice.set(d.id, 'attack');
        break;
      case 'carryPassenger':
        for (const d of carryPassengers(game, sel.die)) h.dice.set(d.id, 'passenger');
        break;
      case 'carryDest':
        addCells([...carryOptions(game, sel.die, sel.passenger, sel.tactical ? 1 : undefined).values()].map((x) => x.cell), 'move');
        break;
      case 'carryDrop': {
        const dest = carryOptions(game, sel.die, sel.passenger, sel.tactical ? 1 : undefined).get(key(sel.to));
        addCells((dest?.drops ?? []).filter((c) => !same(c, sel.to)), 'drop');
        break;
      }
    }
    return h;
  }, [game, sel, human, head, actionPhase]);

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

  return { sel, select, highlights, onDie, onCell, onPlanet, human, actionPhase };
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
