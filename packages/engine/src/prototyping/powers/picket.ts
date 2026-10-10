/** Picket: an enemy ship that moves into a space around this one must stop there. */
import { grid, type PrototypePower } from '../../prototype';

export const picket: PrototypePower = {
  ability: { name: 'Picket', text: 'An enemy ship that moves into any of the 8 spaces around this ship must stop there. It may still attack from there.' },
  hooks: {
    // Adjacency is all 8 surrounding spaces; Warp Gates don't count.
    stopsEnemies: (state, _ship, index) => grid(state.board).around[index],
  },
};
