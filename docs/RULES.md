# Quantum — The Game and the Rules

This is the consolidated rules reference for this project. It is based on the
**Quantum: Community Edition (CE)**, using the print-ready rules booklet by
*WaterGoesRed* (Sept 2026) as the baseline, which itself consolidates the
[stolksdorf/quantum](https://github.com/stolksdorf/quantum) Community Edition
on top of the original 2013 rules. Where those sources disagree, it is called out
in [Ruleset divergences](#ruleset-divergences).

The **Basic** and **Original** modes follow the official rules: the 2013 FunForge rulebook
(first printing, mirrored in [`reference/original-2013/`](../reference/original-2013/)) plus the
designer's errata for the second printing ([BGG thread 1087563](https://boardgamegeek.com/thread/1087563)),
which corrects the 2p and 3p basic maps, adds Quantum Entanglement and changes Curious. Card
text follows the revised edition (the second printing, as Board Game Arena implements it), so
Relocation has no planet-number limit and Strategic drops "you can consider an attacker to be in
either square". The first-printing PDF is only mirrored because FunForge never posted a revised
one; where the two differ, the revision, then designer rulings on BGG, win. Every Basic-mode rule has a scenario test citing its
source in
[`packages/engine/test/basic.test.ts`](../packages/engine/test/basic.test.ts).

Rule ambiguities that matter for a digital implementation are tracked separately
in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md). Card and map data are machine-readable
in [`data/`](../data/).

---

## Game modes

The digital edition offers three rule sets, chosen when starting a game:

| | Basic | Original (2013) | Community Edition |
|---|---|---|---|
| Purpose | Learning the core game | The published rules | Recommended; the rest of this document |
| Rules source | Official rules + errata, minus cards | Official rules + errata | CE print booklet |
| Cards | None | 31 Command (permanent) + 22 Gambit (one-shot) | 35 Skills + 9 Tactics ×2 + Expansion pile |
| Research action | — (it only earns cards) | ✓ | ✓ |
| Missiles | — | — | 1 per player |
| Starting skill | — | — | Draw 2, keep 1 |
| Expansion | — | 8 Expansion cards in the Gambit deck | Separate pile, players + 1 |
| Peek at oldest card | — | — | ✓ |
| Spend a card pick to deal 6 new face-up cards | — | ✓ (rulebook p.9) | — |
| Reconfigure | Ship on the map or scrapyard; any different value | Ship on the map or scrapyard; any different value | Ship on the map or scrapyard; new value not seen this turn |
| Infamy, Quantum Entanglement, void tiles | ✓ | ✓ | ✓ |
| Maps | Published (basic, advanced, add-on pack) | Published | Published + Board Game Arena's |

Basic mode has no Research action: in the 2013 rules research only earns advance cards.

Original card text is in [`data/cards.yaml`](../data/cards.yaml) under `original_command` / `original_gambit`.
Cards whose behaviour matches a Community Edition card share its implementation (e.g. Cerebral ≙ Composed,
Energetic ≙ Steadfast, Warlike ≙ Hostile).

Every Original card is implemented. Not yet implemented in the Community Edition (left out of the deck until
they are): Calculating, Clever, Curious, Devious, Patient, Prideful, Profiteering, Ruthless.

---

## 1. About the game

| | |
|---|---|
| **Original title** | Quantum ([BGG #143519](https://boardgamegeek.com/boardgame/143519/quantum)) |
| **Designer** | Eric Zimmerman |
| **Publisher** | FunForge (2013), with regional partners; now out of print |
| **Players** | 2–4 (CE print edition adds 5-player maps) |
| **Play time** | ~60 minutes |
| **Genre** | Light 4X / area control, dice-as-units, modular grid board |

Each player is a fleet commander conquering a sector of space. **Every die is a
starship.** The face value is both the ship's **speed** (how far it moves) and its
**combat strength** — *lower is stronger*. A 6 is a fast but fragile Scout; a 1 is
a slow but mighty Battlestation.

You win by placing all of your **quantum cubes** on planets. You place cubes by:

1. **Conquering** — arranging ships around a planet so their values sum exactly to
   the planet's number, or
2. **Infamy** — destroying enemy ships to push your **dominance** to 6.

Along the way you collect **Skill** cards (permanent abilities) and **Tactic** cards
(one-shot effects), which are what give each faction its personality.

### Lineage of this ruleset

| Version | What it is |
|---|---|
| **Original (2013)** | 31 Command cards (permanent), 22 Gambit cards (one-shot, incl. 8 Expansion). |
| **stolksdorf CE (2019)** | Renames Command → Skill, Gambit → Tactic, cubes → "Conquer markers". Rebalances/replaces many cards, moves Expansion out of the Tactic deck, adds Starting Skill, Card Peek, and Missiles. Written as a *diff* against the original rules. |
| **WaterGoesRed CE print edition (2026)** | Standalone rewrite of the CE: A5 rules booklet, A5 player sheet, printable card sheets, all official + fan maps, new 5-player maps, map stats. Keeps "quantum cubes", renames Hypernet Gate → Warp Gate, adds Quantum Entanglement rule. **This is our baseline.** |

---

## 2. Components

| Component | Physical game | Notes for digital |
|---|---|---|
| Map tiles | 3×3-space tiles, planet in the centre | Board is a square grid; tiles laid out per map |
| Dice | 7 per player, one colour each | 3 start as ships, 2 in reserve, 2 used as trackers |
| Combat dice | 1 attack die + 1 defence die (d6) | RNG |
| Quantum cubes | 5 per player (some maps need 4, 6 or 7) | Per map |
| Skill deck (light) | 35 cards, 1 of each | [`data/cards.yaml`](../data/cards.yaml) |
| Tactic deck (dark) | 9 cards × 2 copies = 18 | |
| Expansion deck | Players + 1 cards (print set has 6) | Always face-up |
| Missile tokens | 1 per player at start (~8 total) | |
| Warp Gate tokens | 2 | Used by *Warp Gate* tactic |
| Ambition tokens | 3 | Used by *Ambitious* skill |
| Player board | Dominance track, research track, skill slots, scrapyard | |

---

## 3. Key concepts

### The board

Each map tile is a 3×3 block of spaces with a **planet** in the centre:

```
 ·  ·  ·
 ·  8  ·      8 = planet number
 ·  ·  ·
```

Tiles are placed edge-to-edge to form the map (see [Maps](#9-maps)). Planets and
ships block movement.

| Term | Definition |
|---|---|
| **Adjacent** | The 4 orthogonal spaces next to a ship or planet. |
| **Orbital positions** | The 4 spaces adjacent to a planet. Ships here count toward conquering. |
| **Surrounding spaces** | The 8 spaces around a ship or planet (orthogonal + diagonal). |
| **Once per turn** | Once, on your own turn only. |

### Planets

- The **planet number** (7, 8, 9, 10) is the target sum for conquering **and** its
  number of cube locations: **7 → 1, 8 → 2, 9 → 3, 10 → 4**.
- A player may have at most **one** cube on a given planet (except via
  [Quantum Entanglement](#quantum-entanglement)).
- **Void tile (0):** no planet and no cube locations. At the start of your turn,
  gain **+1 research per ship of yours on the void tile**.

### Ships

The die's value is its ship type. Movement = value. In combat, lower totals win.

| Value | Ship | Moves | Ability (once per die per turn) |
|:-:|---|:-:|---|
| **1** | Battlestation | 1 | **Free Attack** — move 1 space to attack an orthogonally adjacent enemy. Can give the battlestation a second attack in the same turn. |
| **2** | Flagship | 2 | **Carry & Move** — pick up one of your ships from a surrounding space, use the flagship's move to travel at least 1 space, then drop the passenger in any surrounding space. The flagship can't attack during this move; the passenger may then move/attack normally. *(Part of a Move action.)* |
| **3** | Destroyer | 3 | **Switch Places** — swap with any of your other ships on the map. |
| **4** | Frigate | 4 | **Change to 3 or 5** — turn into a Destroyer or Interceptor. |
| **5** | Interceptor | 5 | **Move Diagonally** — may also move and attack diagonally. *(Part of a Move action.)* |
| **6** | Scout | 6 | **Free Reconfigure** — re-roll until you get a new number. |

Ability rules:
- Each die may use **one ability per turn**, even if it changes ship type.
- Flagship and Interceptor abilities are used **as part of** a Move/Attack action.
  All other abilities are used **outside** actions (they cost no action).
- Only ships on the map use abilities, and only during Phase 1 of your own turn.

### Player state

- **Dominance** (1–6) — rises when you destroy enemies, falls when you're destroyed.
- **Research** (1–6) — rises with the Research action.
- **Scrapyard** — destroyed ships (already re-rolled) waiting to be deployed.
- **Reserve** — dice not yet in play, brought in by Expansion cards.
- **Skills** — up to 3 (5 with *Talented*).
- **Missiles** — spend any time to set any combat roll to 1.

---

## 4. Setup

### Map
1. Choose a map for the player count and lay it out.
2. Build the **Expansion deck**: Expansion cards = players + 1. Place it face-up.
3. Shuffle the **Skill** and **Tactic** decks separately; place each face-down.
4. Deal **3 Skill** and **3 Tactic** cards face-up in a line from each deck.
5. Put the attack and defence dice by the map.

### Each player
1. Take a player board, **1 missile**, **7 dice** and the map's number of cubes.
2. Put a die on **dominance** and on **research**, both set to **1**.
3. Put **2 dice in your reserve**.
4. Draw **2 Skill cards**, keep 1 secretly, put the other on the **bottom** of the Skill deck.
5. Roll your remaining **3 dice** as starting ships. You may re-roll once, but must re-roll **all 3**.

### Deployment
- The player with the **lowest total** of their 3 ships goes first (ties: roll off).
- Starting with the first player and going clockwise, each player places one cube on
  a **starting planet** (marked on the map).
- Then, in player order, each player places their 3 ships in orbital positions around
  their starting planet, choosing which ship goes where (one position stays empty).

---

## 5. Turn sequence

Players take turns clockwise. Each turn has two phases.

### Phase 1 — Use up to 3 actions (and ship abilities)

You may take the same action more than once. **Each die may move once per turn and
use one ability per turn**, even if it changes type.

| Action | Cost | Effect |
|---|:-:|---|
| **Conquer** | 2 | Place a cube on an empty cube location of a planet where you have no cube, if the values of **your ships in its orbital positions sum exactly** to the planet number. |
| **Deploy** | 1 | Move a ship from your scrapyard (keeping its value) to an empty orbital position of a planet that holds one of your cubes. This is not that ship's move. |
| **Move / Attack** | 1 | Move one ship orthogonally up to its value in spaces. Can't pass through planets or ships. To attack, move "halfway" into an enemy ship's space as part of the move; the move ends there. |
| **Reconfigure** | 1 | Re-roll one of your ships (on the map **or** in your scrapyard). Keep re-rolling until it shows a value it has not shown this turn. |
| **Research** | 1 | +1 research (max 6). |

After spending all 3 actions you may still use ship abilities and card effects.

### Attack protocol

1. Attacker rolls the **attack die**, defender rolls the **defence die**.
2. Each adds their roll to their **ship's value**. **Lower total wins; attacker wins ties.**
3. Anyone may spend a **missile** at any time to change **any player's** combat roll to 1.

| Result | Effect |
|---|---|
| **Defender wins** | Attacker is repelled to the space it came from. No dominance change. |
| **Attacker wins** | Attacker **+1 dominance** (max 6), defender **−1 dominance** (min 1). Defender re-rolls the destroyed ship and puts it in their scrapyard. Attacker may move into the defender's space or stay in its previous space. |

### Infamy

When your dominance reaches **6**, **immediately conquer any planet** that doesn't have
your cube (ignore orbital positions; there must still be an empty cube location), then
reset dominance to **1**. If there is nowhere to place the cube, dominance stays at 6.

### Quantum Entanglement

If **every** planet with an empty cube location already has one of your cubes, you may
conquer planets that already have your cubes, but the target number rises by **+3 for
each of your cubes already there**.

### Phase 2 — Take cards

- **Conqueror:** take 1 card for **each planet conquered this turn** (including via Infamy).
- **Researcher:** if your research is at **6**, reset it to **1** and take 1 card.
- Take the cards one at a time; each pick's slot is refilled before the next. A Tactic / Gambit
  resolves as soon as it's taken, so a Momentum turn is played at once and any picks still owed
  are taken in its card phase (designer, [BGG 1068669](https://boardgamegeek.com/thread/1068669)).
- A player who placed a cube through Infamy on **someone else's turn** takes its card in that
  turn's card phase, after the active player; several such players pick in turn order (designer,
  [BGG 1087563](https://boardgamegeek.com/thread/1087563)).

### Card protocol

When you take a card, pick one of the face-up cards:

| Type | Effect |
|---|---|
| **Skill** (light) | Keep it. It takes effect from the **next player's turn**. If you'd have more than 3, discard one immediately. |
| **Tactic** (dark) | Resolve immediately, then discard. |
| **Expansion** | Immediately roll a die from your reserve and put it in an orbital position on a planet with one of your cubes, or in your scrapyard. Discard. |

After taking a face-up card, slide the remaining cards away from the deck and deal a
new card into the slot **next to the deck** (card order = age).

**Peek:** if you pick the face-up Skill/Tactic **farthest from its deck** (the oldest),
you may first peek at the top card of that deck and take that instead.

**Empty decks:** when a deck runs out, shuffle its discards into a new deck (2013 rulebook p.9;
the CE booklet doesn't say otherwise).

*Original mode only:* instead of taking a card, you may spend the pick to discard all six
face-up cards and deal six new ones ("each time you do this, you draw one card fewer that
turn", 2013 rulebook p.9). An Expansion card can't be taken once both reserve ships are in play
(p.9, p.15).

---

## 6. Winning

You win **immediately** when you place your final quantum cube — whether by
conquering, Infamy, or a card effect.

---

## 7. Missiles

- Each player starts with **1 missile**.
- Spend a missile **at any time** to change **any** player's combat roll to **1**.
- The CE print booklet has no missile trading. Trading comes from the stolksdorf CE and is
  not implemented (see [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) #23).
- Extra missiles come from *Black Market* (tactic) and *Profiteering* (skill).

---

## 8. Cards

Full data (with categories, CE status and design notes) lives in
[`data/cards.yaml`](../data/cards.yaml). Summary:

### Skills (35, one copy each) — permanent

| Skill | Subtitle | Effect |
|---|---|---|
| Agile | Movement bonus | All of your ships have +1 movement. |
| Ambitious | 3 extra actions | Once per turn you may take an additional action, then put a token on this card. If this card has three tokens on it, discard it. |
| Brilliant | Research bonus | At the start of your turn, you may gain 2 Research. |
| Brutal | Combat with advantage | For Combat rolls, roll twice and use the lower number. |
| Calculating | Controlled scrapping | When a ship is placed in your scrapyard, choose its ship number. |
| Clever | Flexible modification | After reconfiguring, you may increase or decrease the ship number by 1. |
| Composed | Reduce dominance for research | Once per turn, you may lose 1 Dominance and gain 3 Research. |
| Cunning | Extra ship ability | Once per turn, you may use one ship ability a second time. |
| Curious | Bonus peaceful move | At the end of your turn, if you did not Attack or Conquer, gain an additional Move or Research action. |
| Dangerous | Destroy your attacker | When you defend, before players roll combat dice, you can decide to destroy both ships (there is no dominance effect). |
| Devious | Slingshot past enemies | You may move your ships through enemy ships. These spaces do not count towards your movement. |
| Ferocious | Combat bonus | −1 to your Combat rolls. |
| Flexible | Adjust a ship | Once per turn, you may increase or decrease one of your ship numbers by 1. |
| Hostile | Extra action for destruction | The first time you destroy an enemy ship each turn, gain 1 action. |
| Industrious | Extra deployment | Gain an additional Deploy action each turn. |
| Ingenious | Conquer from corners | When Conquering, you may use spaces diagonal to a planet. |
| Intelligent | Flexible conquering | When Conquering, you may add or subtract 1 from the planet number. |
| Patient | Delayed tactics | Whenever you take a Tactic, you may instead store it. At the end of each of your turns, you may play a stored Tactic. When you take this Skill, you may take and store a Tactic. |
| Pioneering | Conquer with research | You may use your Research number in place of one of your ship numbers when Conquering. |
| Plundering | Destruction is research | The first time you destroy an enemy ship each turn, gain 3 Research. |
| Precocious | Accelerated breakthrough | Your Research resets at 4, 5, or 6. |
| Prideful | Accelerated domination | Your Dominance resets at 4, 5, or 6. When a player destroys one of your ships, they may take this card from you. |
| Profiteering | Missiles from conquering | When you take a card for Conquering, you may instead gain 1 Missile. |
| Rational | Fixed combat | Your Combat rolls are 3. |
| Ravenous | Dominance amplification | The first time you destroy an enemy ship each turn, gain 1 additional Dominance. |
| Resourceful | Sacrifice for action | Once per turn, you may destroy one of your ships and gain 1 Action. |
| Righteous | Irreducible dominance | You cannot lose Dominance. You cannot gain Research. |
| Ruthless | Weaken your enemies | The first time you destroy an enemy ship each turn, you may disable one of the enemy's Skills until the start of your next turn. |
| Steadfast | Move more than once | Your ships can move or move/attack more than once per turn (each move counts as an action). |
| Stealthy | Isolated deployment | You may deploy to any space that is not adjacent to a ship. |
| Strategic | Combat support bonus | During combat, if your ship is adjacent to one or more friendly ships, −2 to your Combat roll. |
| Stubborn | Strong defence | When you are attacked, ties go in your favour and you destroy your attacker if you win (and gain dominance). |
| Tactical | Bonus short move | Once per turn, you may move/attack 1 space with a ship even if it's already moved. |
| Talented | Get more skills | You can have up to 5 Skills. |
| Tyrannical | Conquer with dominance | You may use your Dominance number as an additional ship number when Conquering. |

### Tactics (9 × 2 copies = 18) — one-shot

| Tactic | Subtitle | Effect |
|---|---|---|
| Aggression | Add dominance | Immediately add 2 to dominance. |
| Black Market | Gain missiles | Gain 2 Missiles. |
| Change of Heart | Choose a skill | Search the Skill deck and take a card of your choosing, then shuffle the deck. |
| Momentum | Take a bonus turn | Immediately take another turn, but with 2 actions instead of 3 (treat it as a brand-new turn). |
| Plan Ahead | Become the missile | Until the end of your next turn, all your combat rolls are 1. |
| Sabotage | Limit enemy action | Every opponent's next turn has 1 fewer action. |
| Show of Force | Target destroyed | Destroy any one ship. Gain 1 Dominance. |
| Unveil the Fleet | Destroy & reroll ships | Destroy all your ships. You may reroll any ships in your scrapyard once. Deploy any number of ships. |
| Warp Gate | Teleportation system | Place the Warp Gate tokens on two different spaces on the board. Any player may consider those spaces adjacent. |

### Expansion (players + 1 in play; 6 printed)

| Card | Effect |
|---|---|
| Expansion — *Expand your fleet* | Immediately roll a reserve ship and put it in orbital position on a planet with one of your quantum cubes, or in your scrapyard. |

---

## 9. Maps

A map is a grid of tiles. In the diagrams below each number is a **tile** (planet
number), `·` is an empty gap (no tile), `0` is a void tile, and `*` marks a
**starting planet**.

### Basic maps (recommended first games)

```
ALPHA SECTOR (2p)     BETA SECTOR (3p)      GAMMA SECTOR (4p)
 7*  7   7             8*  9   8*            8*  9   8*
 7   8   7             8   9   8             8  10   8
 7   7   7*            8   7*  8             9*  8   9*
5 cubes, 0 slack      5 cubes, +4 slack     5 cubes, +3 slack
1/7 shared            4/8 shared            6/9 shared
```

### Map stats

- **cubes** — starting cubes per player (more = longer game).
- **slack** — spare cube locations if everyone placed all their cubes (higher = more choice).
- **X/Y planets shared** — X of the Y planets must be shared if everyone placed all
  cubes (higher = more contested).

### Advanced maps

The print booklet contains ~60 maps grouped by player count and style:

| Players | Constant Contact | Shared Space | Open Frontier |
|---|---|---|---|
| 2 | Entanglement, Axiomatic, Asymptote, False Binary, Terra Minor, Precis | Null Hypothesis, Non Sequitur, Circular Logic, From Dust to Dust, Beyond, Matter and Antimatter | Parallax, Outer Fringe, The Great Plan, Wave Function, Rupture, Terra Major |
| 3 | Gravitational Constant, Quandary, The Empty Centre | Origin of Thought, Crux, Pivot Point, String Theory, Critical Density, Space-Time Continuum, Aperture, Foundation, Ouroboros | Infamous, Edge of Oblivion, Einstein-Rosen Bridge, Lattice, Outer Reaches |
| 4 | Singularity, Super Collider, Spiral Nebula | Brownian Motion, Doppler Effect, Event Horizon, Nexus | The Great Expanse, Galactic Rotation, Circumgyration, Gordian Knot, Helix, Barren Empire |
| 5 | Omega Sector, Ad Hominem, False Dilemma, Reification, No True Scotsman, Anecdotal, Fallacy Fallacy, Bandwagon | Appeal to Authority, False Equivalence, Special Pleading, False Dichotomy, Ambiguity, Beg the Question | — |

Layouts are in the [rules booklet PDF](../reference/community-edition-print/QCB-rules-booklet-A5.pdf)
(pages 8–15). Transcribing them into [`data/maps.yaml`](../data/maps.yaml) is a
roadmap task — the PDF's text layer loses the gaps, so they must be read from the
rendered pages.

---

## 10. Terminology

| This doc (CE print) | stolksdorf CE | Original |
|---|---|---|
| Skill card | Skill card | Command card |
| Tactic card | Tactic card | Gambit card |
| Quantum cube | Conquer marker | Quantum cube |
| Conquer | Conquer | Construct |
| Reserve | Reserve dice | Expansion ships |
| Combat roll | Combat roll | Weapons/defences roll |
| Warp Gate | Hypernet Gate | — |
| Infamy | — | Infamy |

---

## Ruleset divergences

Where the sources disagree. The **Baseline** column is what this project uses unless
we decide otherwise (see [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)).

| Topic | Original | stolksdorf CE | Print edition (baseline) |
|---|---|---|---|
| Aggression tactic | 4 copies | Removed (→ Show of Force) | Kept, 2 copies |
| Expansion | 8 Gambit cards | Separate pool of reserve dice | Separate deck, players + 1 cards |
| Black Market | — | "Gain 1/2 Missiles" (yaml says 1, Cards.md says 2) | Gain 2 Missiles |
| Warp/Hypernet Gate | — | Only players who played it may use the link | **Any** player may use it |
| Infamy timing | Immediately at 6 (confirmed on BGG) | End of turn (End Phase) | Immediately at 6 |
| Starting skill | None | Draw 2, keep 1 | Draw 2, keep 1 |
| Starting fleet re-roll | One optional re-roll | Re-roll any of the dice once | Once, must re-roll all 3 |
| Reconfigure | Ship on map or scrapyard (rulebook p.5) | Ship on map | Ship on map or scrapyard; must show a value not yet seen this turn |
| Tactic copies | Varies | All ×2 | All ×2 |
| Deal 6 new face-up cards for a pick | ✓ (rulebook p.9) | — | — (Peek instead) |
| Missile trading | — | ✓ | — |
| Quantum Entanglement | Added in the second printing (designer errata) | — | Included |
| 5 players | — | — | Added (maps only) |

---

## Sources

- Original game: [BoardGameGeek #143519](https://boardgamegeek.com/boardgame/143519/quantum)
- Original 2013 rulebook (FunForge, English): [BGG file 93188](https://boardgamegeek.com/filepage/93188/quantum-rules), mirrored in [`reference/original-2013/`](../reference/original-2013/)
- Designer's errata for the second printing (maps, Quantum Entanglement, Curious): [BGG thread 1087563](https://boardgamegeek.com/thread/1087563)
- Revised-edition card text, as on Board Game Arena: [card sheet](https://x.boardgamearena.net/data/themereleases/current/games/quantum/200826-0854/img/cards.jpg)
- Designer rulings on the BGG rules forum, e.g. Flagship transport ([1074052](https://boardgamegeek.com/thread/1074052), [1113798](https://boardgamegeek.com/thread/1113798))
- Board Game Arena rules help (void tile, Entanglement): [en.doc.boardgamearena.com/Gamehelpquantum](https://en.doc.boardgamearena.com/Gamehelpquantum); all official maps as BGA implements them: [`reference/bga/maps.json`](../reference/bga/maps.json)
- Community Edition design notes: [github.com/stolksdorf/quantum](https://github.com/stolksdorf/quantum) (`New Rules.md`, `Cards.md`, `src/cards/*.yaml`)
- Print-ready CE by WaterGoesRed: [BGG thread 3766725](https://boardgamegeek.com/thread/3766725/quantum-community-edition-ready-to-print) — PDFs mirrored in [`reference/community-edition-print/`](../reference/community-edition-print/)
- Quantum (base game) is playable on [Board Game Arena](https://boardgamearena.com); CE rules are not, as BGA requires publisher endorsement for variants.
