/**
 * Where in `before` the cards gone from a market row were. The row keeps its order and new cards enter at its
 * front, so matching from the back finds them, telling apart copies of a card (save next to each other, where
 * either would look the same).
 */
export function leftRow(before: readonly string[], after: readonly string[]): number[] {
  const gone: number[] = [];
  for (let i = before.length - 1, j = after.length - 1; i >= 0; i--) {
    if (j >= 0 && before[i] === after[j]) j--;
    else gone.push(i);
  }
  return gone.reverse();
}
