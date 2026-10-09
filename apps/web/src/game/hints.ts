import { SHIP_NAMES, canProfiteer, die, rulesOf, shipOf, type GameState } from '@quantum/engine';
import type { Sel } from './controller';

/** One-line guidance for the current human decision. */
export function hintFor(game: GameState, sel: Sel): string {
  const head = game.pending[0];
  if (head) {
    switch (head.kind) {
      case 'placeStart':
        return 'Choose a glowing starting planet for your first cube.';
      case 'placeShips':
        return 'Place your ships in orbit of your starting planet: pick a ship in your scrapyard (or take the next one), then a glowing space.';
      case 'infamy':
        return 'Infamy! Seize any planet that does not have your cube yet.';
      case 'takeCard':
        return `Take ${head.count} card${head.count > 1 ? 's' : ''} from the market below${rulesOf(game).cards?.refresh ? ', or spend a pick on dealing new cards' : ''}${canProfiteer(game) ? ', or take a missile instead of a card earned by conquering (Profiteering)' : ''}.`;
      case 'patientTactic':
        return 'Patient: you may take a face-up tactic from the market below and store it.';
      case 'placeExpansion':
        return 'Place your new ship in orbit of one of your planets, or send it to your scrapyard.';
      case 'showOfForce':
        return 'Show of Force: choose any ship on the map to destroy.';
      case 'warpGate':
        return `Place Warp Gate ${head.placed.length + 1} of 2 on an empty space.`;
      case 'unveil':
        return head.reorganize
          ? 'Reorganisation: click your ships to re-roll them, then place re-rolled ships from your scrapyard. Press Done when finished.'
          : 'Unveil the Fleet: re-roll and deploy ships from your scrapyard, then press Done.';
      case 'discardSkill':
        return head.reason === 'sabotage' ? 'Sabotage! Choose a card to discard.' : 'Choose a card to discard.';
      case 'advance':
        return `Victory! Advance your ${SHIP_NAMES[die(game, head.die).value]} into the destroyed ship’s space, or hold your position.`;
      case 'relocation':
        return sel.kind === 'relocate'
          ? 'Relocation: choose the planet to move the cube to (click its planet again for another player’s cube there).'
          : 'Relocation: choose a planet with another player’s cube to move.';
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
    case 'power': {
      const { ability } = shipOf(game, die(game, sel.die).value);
      return ability.hint ?? `${ability.name}: ${ability.text}`;
    }
    case 'tactical':
      return 'Tactical: move one space, or attack an adjacent enemy.';
    case 'nomadic':
      return 'Nomadic: choose an orbital position of a neighbouring planet.';
    case 'carryPassenger':
      return 'Choose a ship next to your flagship to carry.';
    case 'carryDest':
      return sel.tactical ? 'Tactical: choose the space the flagship moves to.' : 'Choose where the flagship flies (its own space means out and back).';
    case 'carryDrop':
      return 'Choose where to drop the passenger.';
  }
  return 'Select a ship';
}
