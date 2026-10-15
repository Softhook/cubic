import {
  die as getDie,
  grid,
  isEmptySpace,
  key,
  moveOptions,
  same,
  scrapyard,
  shipsByIndex,
  stopZone,
  tacticalOptions,
  type Cell,
  type GameState,
} from '@quantum/engine';
import type { Sel } from './controller';
import type { Legal } from './legal';

type CellTone = 'move' | 'diagonal' | 'zone' | 'deploy' | 'gate' | 'drop' | 'launch';
type DieTone = 'attack' | 'swap' | 'target' | 'passenger';
type PlanetTone = 'conquer' | 'infamy' | 'start' | 'blocked';

export interface Highlights {
  cells: Map<string, { cell: Cell; tone: CellTone }>;
  dice: Map<string, DieTone>;
  planets: Map<number, { tone: PlanetTone; label: string }>;
  /** The empty spaces where enemy zones of control would stop the selected ship (stopZone), shown only. */
  zones: Cell[];
}

export const noHighlights = (): Highlights => ({ cells: new Map(), dice: new Map(), planets: new Map(), zones: [] });

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
        addCells(
          legal.of('placeShip', (a) => a.die === die).map((a) => a.to),
          'deploy',
        );
        break;
      }
      case 'infamy':
        for (const a of legal.of('infamy')) h.planets.set(a.planet, { tone: 'infamy', label: 'Seize' });
        break;
      case 'placeExpansion':
        addCells(
          legal.of('placeExpansion').flatMap((a) => (a.to ? [a.to] : [])),
          'deploy',
        );
        break;
      case 'showOfForce':
        for (const a of legal.of('showOfForce')) h.dice.set(a.die, 'target');
        break;
      case 'advance':
        addCells([head.to], 'move');
        break;
      case 'warpGate':
        addCells(
          legal.of('warpGate').map((a) => a.cell),
          'gate',
        );
        break;
      case 'relocation': {
        const moves = legal.of('relocate');
        if (sel.kind === 'relocate') {
          h.planets.set(sel.planet, { tone: 'infamy', label: `${game.players[sel.owner].name}'s cube` });
          for (const a of moves)
            if (a.planet === sel.planet && a.owner === sel.owner) h.planets.set(a.to, { tone: 'conquer', label: 'Move here' });
        } else for (const a of moves) h.planets.set(a.planet, { tone: 'infamy', label: 'Move cube' });
        break;
      }
      case 'unveil':
        if (sel.kind === 'scrap')
          addCells(
            legal.of('unveilDeploy', (a) => a.die === sel.die).map((a) => a.to),
            'deploy',
          );
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
      const moves = legal.of('move', (a) => a.die === sel.die);
      // The zones only while the ship may still go somewhere.
      if (moves.length || legal.can('attack', (a) => a.die === sel.die)) h.zones = zonesFor(game, sel.die);
      const stops = new Set(h.zones.map(key));
      for (const a of moves) {
        // A space in a zone of control: the ship stops there, next to an enemy.
        const tone = stops.has(key(a.to)) ? 'zone' : diagonal.get(key(a.to))?.diagonal ? 'diagonal' : 'move';
        h.cells.set(key(a.to), { cell: a.to, tone });
      }
      for (const a of legal.of('attack', (a) => a.die === sel.die)) h.dice.set(a.target, 'attack');
      break;
    }
    case 'attackFrom':
      h.zones = zonesFor(game, sel.die);
      // The chosen target, the spaces to attack it from, and the other targets, to change one's mind.
      for (const a of legal.of('attack', (a) => a.die === sel.die)) {
        if (a.target !== sel.target) h.dice.set(a.target, 'attack');
        else if (a.from) h.cells.set(key(a.from), { cell: a.from, tone: 'launch' });
      }
      h.dice.set(sel.target, 'target');
      break;
    case 'scrap':
      addCells(
        legal.of('deploy', (a) => a.die === sel.die).map((a) => a.to),
        'deploy',
      );
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
      addCells(
        legal.of('nomadic', (a) => a.die === sel.die).map((a) => a.to),
        'deploy',
      );
      break;
    case 'freeAttack':
      for (const a of legal.of('freeAttack', (a) => a.die === sel.die)) h.dice.set(a.target, 'attack');
      break;
    case 'power':
      for (const a of legal.of('power', (a) => a.die === sel.die)) {
        if (a.target) h.dice.set(a.target, 'attack');
        else if (a.to) h.cells.set(key(a.to), { cell: a.to, tone: 'move' });
      }
      break;
    case 'carryPassenger':
      for (const t of transports(sel.die, sel.tactical)) h.dice.set(t.passenger, 'passenger');
      break;
    case 'carryDest':
      addCells(
        transports(sel.die, sel.tactical)
          .filter((t) => t.passenger === sel.passenger)
          .map((t) => t.to),
        'move',
      );
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

/** The empty spaces in enemy zones of control, for the ship's owner; none in a mode without them. */
function zonesFor(game: GameState, die: string): Cell[] {
  const zone = stopZone(game, getDie(game, die).owner, shipsByIndex(game));
  if (!zone) return [];
  const { cells } = grid(game.board);
  return cells.filter((c, i) => zone[i] && isEmptySpace(game, c));
}
