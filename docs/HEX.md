# Hex Tiles

The Basic game played on hexagonal tiles instead of 3×3 squares. The rules are unchanged; what changes
is which spaces are next to each other, how far apart they are, and what counts as a diagonal. Pick a
map from the **Hex tiles** group in the lobby with the **Basic** rules.

## The tiles

A hex tile is a 7-hex flower: the planet in the middle and the six spaces around it. Flowers tile the
plane with no gaps, and the planets of touching tiles are 3 spaces apart, as on squares.

| | Square tile | Hex tile |
|---|---|---|
| Spaces | 8 around the planet | 6 around the planet |
| Orbital positions (where ships conquer from) | the 4 orthogonal ones | all 6 |
| Spaces that are no planet's orbit | the 4 corners | none |
| Tiles a tile touches | up to 4 (and 4 at a corner) | up to 6 |

Every space on a hex map is in some planet's orbit, and each space orbits one planet only.

## How the rules read on hexes

| Rule | On squares | On hexes |
|---|---|---|
| Next to / adjacent (moving, attacking, deploying, the 1's free attack) | 4 orthogonal spaces | the 6 hexes sharing a side |
| Movement | up to the die number, orthogonally | up to the die number, hex to hex |
| Distance | rows + columns | hexes |
| Conquer | your ships in the planet's 4 orbital positions add up exactly to its number | the same, with 6 orbital positions |
| 2 Flagship: carry a nearby ship and drop it next to you | the 8 surrounding spaces | the 6 touching hexes |
| 5 Interceptor: move and attack diagonally | the 4 corner spaces, touching only at a corner | the 6 hexes two away that sit between two neighbours |
| Warp Gates, Nomadic (not in Basic) | unchanged | unchanged (Nomadic's neighbouring tiles are the planets 3 hexes away) |

**The Interceptor's diagonal.** A square's diagonal step covers two spaces of distance in one step and
slips between two neighbours. The hex diagonal does the same: it is two hexes away, between the two
hexes that touch both, and the Interceptor may take it even when both are occupied. So the 5 keeps
the same edge it has on squares: it is never boxed in, and it attacks from one step farther away.

**Conquering.** Six orbital positions mean up to six of your ships can count towards a planet's
number, and an opponent needs more ships to block it. With 3 to 5 ships per player, a conquest still
needs most of your fleet in orbit.

## The maps

Hex versions of the three basic maps, with the same cubes per player. A layout in
[`data/maps.yaml`](../data/maps.yaml) with `grid: hex` reads as rows of tiles where each odd row sits half
a tile to the right.

| Map | Shape | Planets | Starts |
|---|---|---|---|
| Alpha Sector (hex), 2 players | A 3×3 rhombus on its point (rows 1-2-3-2-1) | eight 7s, an 8 in the middle | the two far points, 4 tiles apart |
| Beta Sector (hex), 3 players | A triangle of 10 tiles around a 10 | the 7s and 8s alternate around the 10 | the corners (8s), each touching one 7 and one 8 |
| Gamma Sector (hex), 4 players | The rhombus, with a 10 in the middle | 9s and 8s, mirrored | the points (9s), touching a 9 and an 8; the sides (8s), touching a 9, an 8 and the 10 |

The square maps' corners are all alike; a rhombus has two sharp points and two blunt sides, so Gamma
starts two players at each, with bigger home planets on the remoter points. The seats aren't alike yet:
the sides also touch the 10 and are 4 hexes from both points, while the points are 8 from each other. Beta, a 3-player map, can be
fully symmetric on hexes.

## First AI results

20 games per map, level 2 AI (Captain) in every seat, 19 October 2026: averages per game.

| Map | Rounds | Attacks | Conquers | Wins by seat |
|---|--:|--:|--:|---|
| Alpha Sector | 10.4 | 12.5 | 6.0 | 10/10 |
| Alpha Sector (hex) | 10.8 | 17.4 | 5.8 | 14/6 |
| Beta Sector | 13.7 | 33.4 | 8.2 | 11/3/6 |
| Beta Sector (hex) | 14.9 | 43.4 | 7.5 | 8/4/8 |
| Gamma Sector | 14.9 | 48.9 | 9.6 | 2/4/6/8 |
| Gamma Sector (hex) | 19.2 | 85.8 | 7.0 | 6/3/6/5 |

On hexes ships meet more often: more neighbours, and every space is some planet's orbit. Games run a
little longer, and Gamma's much longer (+29%), with conquests harder to finish among more fighting.
Twenty games are too few to read anything into the seat wins.

## Drawing

Hexes are flat-topped, one space tall, with columns √3/2 of a space apart. The flower lattice is turned
about 11° from the hexes, so a map's rows of tiles lean a little. Each tile's painting (starfield and
planet, without the square pads) is cut to the flower, with a well etched for each space.

## Code

- **Engine.** [`board.ts`](../packages/engine/src/board.ts) builds hex boards (`Board.hex`) in axial
  coordinates. `geometry(board)` is the one place the two shapes differ: each one's sides, diagonals,
  touching spaces and step count. `adjacent`, `surrounding`, `distance`, `diagonals`, `isDiagonalStep`,
  `tileCentres` and `grid()`'s neighbour lists all read it, and the rest of the engine and the AI ask
  those, so the rules needed no change. `drawing(board)` says where each space is drawn, and
  `cellAtPoint` which space a tap lands on.
- **Web.** Everything on the map is placed with `drawing(board).at`. `BoardArt` draws the tiles with
  [`SquareTiles.tsx`](../apps/web/src/components/board/SquareTiles.tsx) or
  [`HexTiles.tsx`](../apps/web/src/components/board/HexTiles.tsx), each centred on its tile's middle
  space. The lobby previews hex maps as hexes; its turning backdrop shows the square map for as many
  players.
- **Tests.** [`hex.test.ts`](../packages/engine/test/hex.test.ts) pins each rule above, and the
  legal-move cross-check in [`consistency.test.ts`](../packages/engine/test/consistency.test.ts) plays a
  hex game (all three with `DEEP=1`). `npm run hex:check` plays a first move in Chrome on the square
  Alpha Sector and each hex map, tapping where the space is drawn.

## Not yet

- Cards (Classic, Community, Prototyping): most work unchanged, but Ingenious and Hostile ("conquer from
  the corners") need a ruling, as hex tiles have no corners; Prototyping's Shoot and zones of control
  assume squares.
- Hex versions of the advanced, add-on and BGA maps; wrapping maps.
- Printed hex tiles in the Art Lab.
- Turning a tall map on its side to fit a wide screen.
