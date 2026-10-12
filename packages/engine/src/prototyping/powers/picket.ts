/** Picket: an enemy ship that moves into a space next to this one (up, down, left or right) must stop there. */
import { grid, type PrototypePower } from '../../prototype';

export const picket: PrototypePower = {
  ability: { name: 'Picket', text: 'An enemy ship that moves into a space next to this ship, up, down, left or right, must stop there. It may still attack from there.' },
  hooks: {
    // Orthogonal only, as most ships can't attack diagonally from where they stop; Warp Gates don't count.
    stopsEnemies: (state, _ship, index) => grid(state.board).ortho[index],
  },
};
