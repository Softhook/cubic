# Hex Concepts

Ideas for a game that grows out of the hex board rather than porting Quantum onto it. Nothing here is
built or tested; it is a menu to pick from and try with the AI. For the hex board as it plays today
(the Basic rules, unchanged), see [HEX.md](HEX.md).

## The aim

A small abstract game with a simple core of rules, as basic Santorini is, plus **ship powers on the die
faces**, as in Quantum. The powers are what link the two games: a Santorini god breaks one rule for your
workers; a Quantum ship's face gives it one ability. Here each face breaks one rule of the core, and the
power sits on the piece, not on the player, so it changes when the die changes.

It keeps **combat**, and it makes **space matter**: where your ships are, what lies between them and
the enemy, and how long it takes to get somewhere should decide games. No cards in the core game.

## What goes wrong in Quantum

Quantum makes the board nearly irrelevant:

- **Big numbers move far.** A 6 moves 6 spaces, round any obstacle, on maps about 9 to 12 spaces across.
  Almost anything is in reach within a turn or two.
- **Nothing slows you down.** Ships block only the space they stand on; there is no terrain and no zone of
  control, so a fleet goes round a defender rather than through it.
- **Fast is the default.** High numbers move far and lose fights; low numbers win fights and crawl. A
  player can always swap one for the other (reconfigure), so the trade-off is a dial, not a commitment.
- **Ships appear where they are needed.** Deploying at any planet you own, and Warp Gates, skip the space
  in between.

The concepts below each attack one of these.

## What we borrow

| Game | Core | What it gives us |
|---|---|---|
| **Santorini** (basic) | Each player has 2 workers. A turn is: move one worker one space, then build one level next to it. Stand on level 3 to win; a dome caps a tower for good. | **Move, then act.** Very few pieces. Short moves. Every action changes the board for both players. |
| **Santorini** (gods) | Each player has one god card, and each god breaks exactly one rule: move twice, build twice, swap with an opponent, push them back. | **Powers that bend a small core.** The core is simple enough that one broken rule is easy to learn and to play against. |
| **Amazons** | Each player has 4 queens. A turn is: move a queen in a straight line, then shoot an arrow in a straight line, which burns that space for good. The last player able to move wins. | **Lines and permanent blocking.** The board shrinks and splits into territories. Already played on hex boards. |
| **Hex wargames** | Units on hexes, zones of control, terrain, support from neighbours. | **Geography in combat**: who is next to whom, and what is in the way. |
| **Undaunted 2200: Callisto** (Osprey, 2024) | Small-unit sci-fi skirmish, infantry and mechs, on illustrated maps of a rocky moon and its stations. Each space can have elevation, cover, impassable ground, no-vehicle ground, bridges and objective points. Elevation sets the attacker's die: d12 shooting down, d10 on the level, d8 shooting up. A target's defence is its base plus the space's cover plus 1 per space of range. You may only move through spaces you have scouted or control. A mech is three cards (navigator, gunner, commander) and loses one per casualty. | **Terrain that changes the fight**: high ground, cover, ground heavy units can't cross, range as defence. Units that wear down a step at a time. Advancing as something you prepare for. |
| **Quantum** | Dice as ships, each face a ship type with its own ability; planets with numbers, conquer by ringing a planet, win by placing all your cubes. | **Dice as numbered pieces with powers**, planets, cubes, combat between dice. |

## What the hex board gives

| Hex fact | Why it matters here |
|---|---|
| **6 neighbours, all alike** | One clear idea of "next to" for movement, support and zones of control. No diagonals. |
| **6 lines through every hex** | Lines of sight and shots are easy to see; debris in a line blocks it. |
| **An orbit is a ring of 6** | A planet is a place you hold by surrounding it, and fight over hex by hex. |
| **Zones of control tile cleanly** | Two ships one hex apart close the gap between them, so a few ships can form a real line. Wargames use hexes for this reason. |
| **No crossing paths** | A wall of ships and debris can't be slipped through at a corner, so fronts and enclosures are always clear. |

## Concepts

### 1. Speed and strength

The fix for Quantum's long moves is to stop the die number setting the range, or to make big numbers slow.

| Option | Feel |
|---|---|
| **Heavy is slow**: speed 3 for a 1–2, 2 for a 3–4, 1 for a 5–6; the number is strength | A strong ship is a commitment: it takes turns to arrive, and the enemy sees it coming. Light ships scout, screen and harass. |
| **Everyone moves 2**; the number is strength only | Simplest. Geography comes from distance and blockers alone. |
| **Number = speed and strength, capped at 3 hexes** | Closest to Quantum, but no ship crosses the map in a turn. |

**Changing the number.** In Quantum you can reroll at will. Here a number should change only for a
reason, and somewhere on the map:

- **Refit:** a ship next to a planet you own may spend its action to go up 1. Strength is built at home and
  has to travel to the front.
- **Damage:** a ship that wins a fight goes down 1. Ships wear out away from home.
- **Deploy:** a new ship rolls its number, as in Quantum, and enters next to a planet you own.

Since the power is on the face (see *Ship powers*), changing the number changes the power too. Refitting
is choosing the next ship type, not just adding strength, and a ship damaged in a fight comes out of it as
a different ship.

### 2. Ship powers

Each face is a ship type with one power, and each power **breaks exactly one rule of the core**, as a
Santorini god does. Strength is the number (higher is stronger, the reverse of Quantum) and speed comes
from *Heavy is slow*.

| Face | Ship | Speed | Power | Rule it breaks |
|:-:|---|:-:|---|---|
| 1 | **Scout** | 3 | **Slip:** ignores zones of control and may move through enemy ships (not end on them). | Zones of control stop you. |
| 2 | **Tug** | 3 | **Tow:** takes one friendly ship next to it along on its move and drops it next to where it stops. | You move one ship a turn. |
| 3 | **Sapper** | 2 | **Engineer:** may also lay or clear one debris next to it, on top of its action. | Debris is permanent; one action a turn. |
| 4 | **Gunship** | 2 | **Fire:** attacks along a straight line up to 3 hexes, if nothing is in the way. | You attack only next to you. |
| 5 | **Lancer** | 1 | **Charge:** instead of stepping, moves any distance in a straight line until something blocks it. | You move up to your speed. |
| 6 | **Dreadnought** | 1 | **Anchor:** enemy ships next to it can't move away. | Zones of control only stop ships moving in. |

**Opposite faces counter each other.** On a die the opposite faces add up to 7, and the powers are paired
the same way: the Scout slips zones of control and the Dreadnought makes them stronger; the Tug moves
others and the Lancer moves itself far; the Sapper shapes the terrain and the Gunship shoots across it.
Turning a die over gives you the counter to what you were.

**The faces are a ladder.** Refit goes up one face, damage goes down one: a Scout refits into a Tug, a
Dreadnought that wins a fight becomes a Lancer. Each step changes what the ship is for.

**How the powers are chosen:**

- **One rule each.** The core stays the game; a power is a small exception you can hold in your head
  for every die on the board.
- **About space.** Every power is about movement, lines, zones of control or debris. None of them
  teleports.
- **Readable.** The power is on the face, so you can read the whole board's powers at a glance, as you
  read Santorini's gods.
- **Answered by position.** Each power has a counter on the board: block the Lancer's line, keep
  away from the Dreadnought, put debris in front of the Gunship.

**What's dropped from Quantum, and why.** The Destroyer's swap teleports and the Scout's and Frigate's
free number changes unhook the number from the map, which is the problem this design is trying to fix.
The Battlestation's extra attack and the Flagship's carry live on in the Dreadnought and the Tug. The
Interceptor's diagonal has no clean hex form; the Lancer replaces it.

**Later: fleet doctrines.** A Santorini-style power per player on top, such as a card that changes all your
Gunships, is where Quantum's Command cards and the Community Edition's skills could come back.

### 3. Movement

- **Step** hex to hex up to your speed, round obstacles.
- **Zone of control:** a ship that moves next to an enemy ship stops there. You can't slide past a
  defender; you have to fight it or go the long way round. This alone makes positions and fronts.
- **Blockers:** planets, ships and debris can't be entered or passed.
- **Orbit:** a ship next to a planet may move round its ring one extra hex. Rings are easy to reposition in
  and hard to break into.
- **Deploy only at home.** New ships enter next to your home planet (or any planet you own, if the
  maps get bigger) and walk from there. No Warp Gates in the core game.

### 4. Combat

Keep it dice-driven, as Quantum's is, but let the board change the odds.

- **Attack** an enemy ship next to you. Each side rolls one die and adds its ship's number; **plus 1 for each
  friendly ship next to the defender** (support). Higher wins; the defender wins ties.
- **Flanking:** support from opposite sides of the defender is worth more (+2 instead of +1 for each
  opposite pair). Hexes have 3 pairs of opposite sides, so surrounding a ship is a visible, readable goal.
- **Cover:** a defender with debris next to it, between it and the attacker, gets +1.
- **Wrecks:** a destroyed ship leaves **debris** on its hex. Combat shapes the map: a battle leaves a field
  of wreckage that blocks movement and lines of fire for the rest of the game. This is where Amazons'
  blocking comes from in this game, rather than from a separate shooting action.
- **Ranged fire** is the Gunship's power, not a rule for everyone (see *Ship powers*). Debris is then cover
  from fire as well as a wall.

Wrecks are the strongest single idea here: the more players fight in a place, the harder that place gets
to cross, so battles move the front instead of erasing it.

### 5. The action after moving

One action per turn, after the move, as in Santorini:

| Action | What it does |
|---|---|
| **Attack** | As above. |
| **Lay debris** (mine) | Place debris on an empty hex next to the ship: build walls, close a gap, take a hex out of a ring. |
| **Refit** | Next to a planet you own: the ship's number goes up 1. |
| **Claim** | See *Planets*. |
| **Deploy** | Instead of moving at all: bring in a new ship at home. |

### 6. Planets

A planet blocks movement and lines of fire, and its 6 neighbouring hexes are its ring.

| Option | The rule |
|---|---|
| **Sum the ring** (Quantum) | Claim when your ships in the ring add up to at least the planet's number and no enemy ship is in it. Debris in the ring leaves less room for your ships, so a ring full of wrecks can become impossible to take. |
| **Fill the ring** | When no hex of the ring is empty, whoever has more ships in it claims it. |
| **Hold the ring** | The planet is yours while you have more ships in its ring; score each round or at the end. |

The planet's number is both its difficulty and its value: an 8 needs a strong fleet in orbit and is
worth a lot.

### 7. Winning

| Option | Source | Notes |
|---|---|---|
| **Place all your cubes** (one per claimed planet) | Quantum | Clear and fast. |
| **Most planets' numbers** when no more can be claimed | — | Rewards the 8s and 10s. |
| **Connect two of your planets** by a chain of your ships, or wipe out the opponent's fleet | Hex, wargames | A shape on the board; strong on hexes. |
| **The opponent can't move** | Amazons | A fallback that ends every game. |

### 8. Board

- **Size.** Santorini plays on 25 spaces and Amazons on 100. A ring of 7 flower tiles is 49 hexes, the
  current hex Alpha Sector 63. With speeds of 1 to 3, crossing 49 hexes takes 3 to 7 turns: distance is real.
- **Chokepoints.** Gaps in the map, and debris placed at the start, make passes worth holding. Hexes have
  fewer natural chokepoints than squares, so the map has to make them.
- **Tiles that turn.** A flower tile with debris or an off-centre planet on it can be laid in 6 turns, so a few
  tiles give many boards ([HEX.md](HEX.md), *Off-centre planets*).

### 9. Terrain

Undaunted 2200 shows how much a map's surfaces can do in a small fight: the same two units play
differently on a ridge, behind rocks or out in the open. Here, the open space between planets gets
surfaces too, printed on the flower tiles, so turning a tile also turns its terrain. Setting it on and around a
rocky moon, as Callisto is, gives the terrain a reason to be there.

| Surface | Effect | Who it favours |
|---|---|---|
| **Open** | None. | — |
| **Ridge** (high ground) | Attacking down from a ridge, roll 2 dice and keep the better; attacking up onto one, roll 2 and keep the worse. Undaunted does this by changing the die size; with d6 ships, two dice keep the dice the same. | Whoever gets there first. Slow heavies want ridges and take turns to reach them. |
| **Rubble** (rocks, boulder fields) | +1 defence. Ships with speed 1 (5s and 6s) can't enter. | Scouts, Tugs and Sappers: the light ships fight in the rocks, the heavy ones go round. |
| **Crater** | +1 defence, but attacking out of one counts as attacking up. | Defenders. A place to hold, not to attack from. |
| **Ice** | A ship that steps onto ice slides one more hex in the same direction, if it can. | Lancers, which charge further; everyone else risks overshooting. |
| **Chasm** | Impassable, but doesn't block lines of fire. | Gunships, which shoot across what nobody can cross. |
| **Debris** (wrecks) | Blocks movement and lines; +1 defence to a ship next to it, behind it from the attacker. | Defenders; and it grows wherever ships fight. |

**Range as defence.** Undaunted adds 1 to a target's defence per space of range. That fits the Gunship:
its fire up to 3 hexes is safe but less likely to hit the further it goes.

**Building terrain.** Santorini builds levels; here the Sapper could raise rubble or clear it, as well as
debris, so that the map's surfaces change during the game, but only where a Sapper has been.

**Scouting.** Undaunted only lets you move through spaces you have scouted or control. A light version:
ships may only end a move on a hex within 3 of a friendly ship or planet you own. Fleets can't leap
ahead of their supply, and Scouts are what push the edge forward.

**Wearing down.** An Undaunted mech is three cards and loses one per casualty, so a hit weakens it before
it dies. Here the faces already do this: a ship that wins a fight goes down a face, so a long fight wears
a Dreadnought down into a Lancer, then a Gunship.

## A first ruleset

The smallest game to try first. Two players.

- **Board:** a 7-tile flower (49 hexes): a home planet 7 on each of two opposite tiles, an 8 on each of the
  other four, a 10 in the middle.
- **Pieces:** each player has 3 ships, rolled at the start, next to their home planet, and 3 cubes. The home
  planet starts claimed.
- **Speed:** a 1 or 2 moves 3 hexes, a 3 or 4 moves 2, a 5 or 6 moves 1.
- **Powers:** each face has its power from the table in *Ship powers*, and a ship uses it as the table says.
- **Turn:** move one ship (or deploy), then take one action.
  - **Move:** step hex to hex up to its speed. Moving next to an enemy ship ends the move. Ships, debris and
    planets block.
  - **Attack:** an enemy ship next to it. Each side rolls a die, adds its number and +1 per friendly ship
    next to the defender. Higher wins, the defender wins ties. The loser's ship becomes debris and goes back to
    its owner's pool; the winner's number goes down 1 (at least 1).
  - **Lay debris** on an empty hex next to it.
  - **Refit:** next to a planet you own, +1 to its number.
  - **Claim:** your ships in the planet's ring add up to at least its number and no enemy ship is in it:
    place a cube.
  - **Deploy** (instead of the move): a ship from your pool is rolled and enters next to your home planet.
- **Win:** place all your cubes, destroy every enemy ship, or the opponent can't move.

Questions this ruleset should answer in play:

1. Does heavy-is-slow work, or does everyone just refit to 6 at home? Is +1 per refit too fast or too slow?
2. Do wrecks pile up fast enough to shape the board, or too fast, so that the middle closes up?
3. Is support +1 enough to make positioning beat luck, or should it be +2?
4. Does the zone of control make the game stall in a standoff, and if so does "stop" need to become "slow"?
5. Are 3 ships each enough to fight and claim at once?
6. Is every face worth being? Look for a face the AI always refits past, or always stays on. The
   Lancer's charge and the Dreadnought's anchor look the strongest, the Tug's tow the weakest.
7. Do the opposite faces really counter each other, or does one of each pair just win?
8. With terrain: does the first player to the ridges win, or can ridges be taken? Does rubble that heavy
   ships can't enter make the light faces worth keeping?

## Testing

The engine already has the hex board, distances, neighbours, rings (`orbitals`), Quantum combat and the
AI and self-play tools. Still missing:

- **Debris** as a new kind of piece on a space, blocking moves and lines.
- **Zones of control** in move generation.
- **Terrain** on each hex, laid out in [`data/maps.yaml`](../data/maps.yaml) and printed on the flower tiles, and
  read by movement and combat. Debris can be one kind of terrain rather than a piece.
- **Lines** (for the Gunship's fire and the Lancer's charge): the hexes along each of the 6 directions from a
  hex, stopping at the first block. One helper next to `adjacent` in [board.ts](../packages/engine/src/board.ts).
- **The six powers**, each as a small exception in move generation or combat, as the Quantum ship
  abilities are now.
- **A new rule set** next to Basic, Original and Community, so the lobby, AI and sweeps can run it.

Branching is small (3 ships, at most 3 hexes of movement, a handful of actions), so a search-based AI
should play it well, and the AI's games are a quick first read on each question before playing by hand.
