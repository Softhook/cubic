/** Beacon: its owner may deploy around it, as if it were a planet with their cube. */
import { cellOf, surrounding, type PrototypePower } from '../../prototype';

export const beacon: PrototypePower = {
  ability: { name: 'Beacon', text: 'You may deploy into any empty space around this ship.' },
  hooks: {
    deployTargets: (state, ship) => surrounding(state.board, cellOf(ship)!),
  },
};
