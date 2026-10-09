import { die as getDie, key, moveOptions, same, scrapyard, tacticalOptions, type Cell, type GameState } from '@quantum/engine';
import type { Sel } from './controller';
import type { Legal } from './legal';

export type CellTone = 'move' | 'diagonal' | 'deploy' | 'gate' | 'drop';
export type DieTone = 'attack' | 'swap' | 'target' | 'passenger';
export type PlanetTone = 'conquer' | 'infamy' | 'start' | 'blocked';

export interface Highlights {
  cells: Map<string, { cell: Cell; tone: CellTone }>;
  dice: Map<string, DieTone>;
  planets: Map<number, { tone: PlanetTone; label: string }>;
}

export const noHighlights = (): Highlights => ({ cells: new Map(), dice: new Map(), planets: new Map() });

/**
 * What to light up on the board for a human: the targets of the legal actions that fit the current
 * decision (or, in the action phase, the selected ship). Derived from `legal`, never from rules.
 */
export function highlightsFor(game: GameState, sel: Sel, legal: Legal, actionPhase: boolean): Highlights {
  const h = noHighlights();
  const addCells = (cells: Cell[], tone: CellTone) => cells.forEach((c) => h.cells.set(key(c), { cell: c, tone }));
  const head = game.pending[0];

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
      case 'advance':
        addCells([head.to], 'move');
        break;
      case 'warpGate':
        addCells(legal.of('warpGate').map((a) => a.cell), 'gate');
        break;
      case 'relocation': {
        const moves = legal.of('relocate');
        if (sel.kind === 'relocate') {
          h.planets.set(sel.planet, { tone: 'infamy', label: `${game.players[sel.owner].name}'s cube` });
          for (const a of moves) if (a.planet === sel.planet && a.owner === sel.owner) h.planets.set(a.to, { tone: 'conquer', label: 'Move here' });
        } else for (const a of moves) h.planets.set(a.planet, { tone: 'infamy', label: 'Move cube' });
        break;
      }
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
  // A Flagship transport, as a regular carry or as a Tactical step.
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
    case 'nomadic':
      addCells(legal.of('nomadic', (a) => a.die === sel.die).map((a) => a.to), 'deploy');
      break;
    case 'freeAttack':
      for (const a of legal.of('freeAttack', (a) => a.die === sel.die)) h.dice.set(a.target, 'attack');
      break;
    case 'shoot':
      for (const a of legal.of('shoot', (a) => a.die === sel.die)) h.dice.set(a.target, 'attack');
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
}
