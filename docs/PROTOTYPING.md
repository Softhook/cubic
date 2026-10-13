# Prototyping a Fourth Mode

How to build and evaluate **Prototyping**, our experimental rule set, alongside Basic, Classic, and Community.

> **Design Thesis: From Arithmetic Sprint to Positional War**  
> In base Quantum, hyper-mobility collapsed geography. Ships with 5–6 movement on compact boards crossed the map with ease, turning battles into isolated teleport raids and conquest into an arithmetic puzzle.  
> **Prototyping aims to restore territorial gravity**: the current movement cap creates distance;
> candidate powers and experiments explore zone control, forward logistics, and orbital superiority.

Nothing here is permanently adopted. Rulings go to [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) and, once decided, to [RULES.md](RULES.md).

> **Status key:** **Current** rules are enabled in the playable Prototyping mode and covered by
> [prototyping.test.ts](../packages/engine/test/prototyping.test.ts). **Candidates** are described
> design work or partially implemented building blocks; they do not change a Prototyping game until
> they are registered in `PROTOTYPING_SHIPS` or `prototypingMode()`.

## Current Prototyping baseline

As of 2026-10-12, Prototyping is **Community Edition**, with only these changes:

| Status | Rule |
|---|---|
| **Current** | A ship's die value contributes at most **3** movement; skill bonuses apply after that cap. |
| **Current** | **Zones of control:** every ship pickets the 4 orthogonally adjacent spaces (not diagonals) as a mode rule, not a ship power. Diagonals were dropped (2026-10-12) because most ships can't attack diagonally from where they stop. An enemy ship that moves into one must stop there (it may still attack from there; one that starts its move there may leave). Friendly ships are never stopped, and a player with the **Devious** skill ignores zones (ruling 2026-10-12; the card text is unchanged). |
| **Current** | The **5 Interceptor** replaces its diagonal Manoeuvre ability with **Shoot**: spend one action to attack the first enemy in a clear orthogonal line without advancing. Shooting is that ship's action for the turn. |
| **Current** | **Over-conquest:** a player may replace an opponent's cube by meeting an orbit sum of exactly **12**, including on a planet that still has an empty cube location. |
| **Unchanged** | Ships 1–3 retain their Community abilities. The **4 Frigate** retains Modify and the **6 Scout** retains Free Reconfigure. |

Picket is active as the default zone-of-control rule for every ship rather than as the 4's power. Beacon, Contested Orbit, and every other rule below are **candidates**, not current rules.

---

## Table of Contents

1. [How Modes Work Today](#1-how-modes-work-today)
2. [Worked Example: Movement Cap at 3](#2-worked-example-ships-move-at-most-3)
3. [How to Test a New Mode](#3-how-to-test-a-new-mode)
4. [Engine Refactoring Roadmap](#4-refactoring-in-the-order-it-pays-off)
5. [Candidate Ship Redesign: Powers for the 4, 5, and 6](#5-candidate-ship-redesign-powers-for-the-4-5-and-6)
6. [Future Experiments](#6-future-experiments-a-different-game-not-a-re-tuned-one)
7. [Next Steps](#7-next-steps)
8. [Current Status & Playtest Results](#8-current-status--playtest-results-2026-10-11)
9. [Developer Guide: Working on Prototyping](#9-working-on-prototyping)

---

## 1. How modes work today

Every rule lives in [`packages/engine`](../packages/engine). A game is a pure function: take the
state and an action, return the new state. The AI, the web UI, and online play only call
`legalActions()` and `apply()`. Online, every browser replays the same moves through the same engine,
so a new mode needs no network changes as long as it stays deterministic.

```
  Web UI ──┐
  AI ──────┼── legalActions() / apply() ──▶  action handlers ──▶ rule questions ◀── RULESETS
  Online ──┘                                 (actions, combat,   (queries.ts:        (rulesets.ts:
                                              cards, turn)        movementRange,      Basic, Classic,
                                                                  conquerCheck…)      Community, + Prototyping)
```

A mode is one entry in `RULESETS` ([rulesets.ts](../packages/engine/src/rulesets.ts)). The engine reads it
through `rulesOf(state)` ([rules.ts](../packages/engine/src/rules.ts)) and never compares mode names. Today a `RuleSet` varies only these:

| Setting | Basic | Classic | Community |
|---|---|---|---|
| Cards | none | Command + Gambit | Skills + Tactics |
| Starting skill draft, peek, expansion pile | — | no | yes |
| Market refresh | — | yes | no |
| Starting missiles | 0 | 0 | 1 |
| Reconfigure | any new number | any new number | a number not seen this turn |
| Map groups | official | official | official + BGA + CE |

Two patterns make changes cheap:

- **Single choke points.** Each rule question has one function in
  [queries.ts](../packages/engine/src/queries.ts): `movementRange`, `deployTargets`, `conquerCheck`,
  `combatOutcome`, `breakthroughAt`, `infamyAt`. Change the function and every caller follows.
- **Closed registries.** Actions, decisions, and skill effects are closed TypeScript unions. Add one
  without a handler and the build fails, pointing at the gap.

Skills already work like small plugins: each is a set of hooks in
[skillRules.ts](../packages/engine/src/skillRules.ts) (`movement`, `combat.modifier`, `startOfTurn`…).
Prototype ship powers use the same pattern: `ShipHooks` (§9).

---

## 2. Worked example: ships move at most 3

*This is how the cap was first planned. It is now built: `MAX_MOVEMENT` in
[prototyping/index.ts](../packages/engine/src/prototyping/index.ts), read by `movementRange`. §9 details where
the mode's code lives today.*

A ship's movement is calculated in one place:

```ts
// packages/engine/src/queries.ts
export function movementRange(state: GameState, d: Die): number {
  return d.value + skillRules(state, d.owner).reduce((n, r) => n + (r.movement ?? 0), 0);
}
```

The legal-move search (`moveOptions`, `carryOptions`), board highlights, both AI planners
([greedy.ts](../packages/ai/src/greedy.ts), [evaluate.ts](../packages/ai/src/evaluate.ts)), and the
ship panel's "Moves N" label all call it.

1. Add `'prototyping'` to `GameMode` in [data.ts](../packages/engine/src/data.ts).
2. Give `RuleSet` an optional `maxMovement?: number`.
3. Add the mode, copying Community, and list it in `MODES`:
   ```ts
   prototyping: { ...RULESETS.community, id: 'prototyping', name: 'Prototyping', title: 'Prototyping',
            summary: 'Community Edition with redesigned fast ships.', maxMovement: 3 },
   ```
4. Cap the result in `movementRange`.
5. Optional: a `.mode-badge.mode-prototyping` colour in `styles.css`, a row in the rulebook's mode table
   ([Manual.tsx](../apps/web/src/rulebook/Manual.tsx)), and a scenario test.

About 15 lines; the three existing modes and their golden replays don't change.

**Ruling (decided 2026-10-08):** the cap applies to the die value, before skill bonuses and special
powers. A 6 moves 3; a 6 with Agile moves 4. So step 4 is:

```ts
return Math.min(rulesOf(state).maxMovement ?? Infinity, d.value) + skillRules(state, d.owner).reduce((n, r) => n + (r.movement ?? 0), 0);
```

Capping the total instead would make Agile useless on any ship showing 3 or more.

---

## 3. How to test a new mode

1. **Play it by hand.** `npm run dev`, then `localhost:5173/?play=prototyping&players=2&seed=7` skips the
   lobby and starts a game against the AI ([devStart.ts](../apps/web/src/game/devStart.ts)). The same
   seed gives the same dice, so situations can be replayed after each tweak.
2. **Pin each rule with a scenario.** `quickStart(2, 1, 'prototyping')` and `arrange()` in
   [test/helpers.ts](../packages/engine/test/helpers.ts) set up exact positions. One test per rule,
   as in [basic.test.ts](../packages/engine/test/basic.test.ts) and [prototyping.test.ts](../packages/engine/test/prototyping.test.ts).
3. **Check it never breaks the engine.** Add `'prototyping'` to the modes in
   [golden.test.ts](../packages/engine/test/golden.test.ts) and the consistency cross-check: seeded AI
   games run `checkInvariants()` after every action, and `legalActions` and `apply` must agree.
4. **Measure balance with AI self-play.**
   - `npm run ai:match -- 3 3 100 prototyping 2`: turns per game and seat win rates. Compare with `community`.
   - `npm run selfplay:cards -- 50 prototyping`: card win, pick, and use rates.
   - [basic-sweep.ts](../scripts/basic-sweep.ts) is a template for flagging AI mistakes per mode.

**Worth building first:** a stats script that writes one CSV row per game: mode, turns, winner seat,
attacks, conquers, and **moves and power uses per ship value**. The last column is how we measure
whether the new 4/5/6 powers get used.

**Caveat:** the AI plays legally under any rule, but its scoring in `evaluate.ts` is hand-tuned for
Quantum. Passive powers (§5) need no AI work. Reactive powers and radical ideas in §6 need AI
changes before self-play results become meaningful.

---

## 4. Refactoring, in the order it pays off

No up-front refactor is needed. Do each step when a rule needs it. Step 2 is done (§8, §9).

| Step | Refactor | Unlocks | Size |
|---|---|---|---|
| 1 | Lift fixed numbers into `RuleSet`: actions per turn and research cap (done); remaining shared track and threshold rules | Variable tweaks | Small (partial) |
| 2 | **Ship table per mode**: `RuleSet.ships` gives each value its name, movement, and power as hooks like `SkillRule` | §5, and factions in §6 | Medium (Done) |
| 3 | Formula hooks on `RuleSet`: `combatOutcome`, `conquerCheck`, `deployTargets` | Supply, contested orbit (§6.8), new conquer rules | Small–medium |
| 4 | Win check as a hook, not fixed in `placeCube` ([core.ts](../packages/engine/src/core.ts)) | Points, round limits, planet economy (§6.3) | Medium |
| 5 | Mode-owned player state (an extension field, not new fields on every player) | New resources, energy economy | Medium |
| 6 | Mode-gated actions and decisions | Ship activations (§6.9), command dice (§6.4) | Medium–large |
| 7 | AI scoring per mode | Trustworthy self-play evaluation | Medium |
| 8 | UI driven by the rule set: ship names and powers, player tracks, generic decision dialogs | Showing dynamic rule sets on screen | Large |

Step 2 mattered most for ship redesign and is complete. A ship's identity was formerly hard-coded as
`d.value === N` across [abilities.ts](../packages/engine/src/abilities.ts), `moveOptions`, and
[legal.ts](../packages/engine/src/legal.ts). Now each mode has a ship table (`RuleSet.ships`): the engine
queries `hasPower(state, d, 'warp')` or reads a prototype's hooks, and the UI reads names and ability texts
through `shipOf(state, value)`.

---

## 5. Candidate ship redesign: powers for the 4, 5 and 6

### 5.1 The problem: hyper-mobility killed geography

| Ship | Moves | Power today | Why it's weak |
|---|:-:|---|---|
| 4 Frigate | 4 | Turn into a 3 or a 5 | A free half-Reconfigure; no identity of its own |
| 5 Interceptor | 5 | Move and attack diagonally | Barely matters at range 5; long range already reaches everything |
| 6 Scout | 6 | Free Reconfigure | A way to stop being a Scout, not a reason to be one |

Quantum's intended trade-off was "small ships fight, big ships travel". But in practice, with 5–6
movement on maps typically only 6–9 spaces across:
- **Geography collapsed.** Travel was essentially free. There was no operational depth, no frontline,
  and no safe rear territory. A 6 could strike almost anywhere in one or two actions.
- **Battles weren't spatial warfare, but isolated dive-bombing.** Instead of contested borders,
  flanking, or territorial control, ships zipped across the void for lone duels. Positioning between
  turns offered no real protection.
- **Conquering was an arithmetic puzzle, not territorial conquest.** A player could construct a cube
  right next to an enemy armada as long as their own ships in orbit hit the target sum. It felt like
  a sudden math sprint rather than a territorial war.
- **Big ships had no purpose of their own.** Beyond rushing to a planet to fill a sum, their powers
  were mostly about rerolling to stop being a big ship.

### 5.2 Design goals: from arithmetic sprint to positional war

- **Cap movement at 3** (§2), so distance and travel time exist again. The board gains scale, and
  positioning becomes a genuine commitment.
- **Give the board territorial gravity.** Candidate powers could project threat and control space:
  - **Zone control:** Frigates (Picket) could wall off lanes and planet approaches.
  - **Ranged pressure:** Interceptors (Shoot, current) threaten space without having to abandon position.
  - **Forward bases:** Scouts (Beacon) could serve as logistics hubs in a world where crossing the map takes time.
  - **Planetary sieges:** Contested Orbit (§6.8) could require players to clear orbital space before
    constructing.
- **Keep the combat trade-off**: big ships still lose most fights (they add 4–6), so their value lies in
  holding space, supporting small fighters, and shaping the battlefield.
- **Prefer passive powers or clean action extensions**, so the AI copes naturally without complex
  scoring overhauls.

### 5.3 Current and candidate ship powers

Only Shoot is active as a ship power. Picket's hook applies to every ship as the zone-of-control rule (2026-10-12),
so it is not a power of the 4. Beacon is a candidate power with a source file and a reusable hook, not assigned to a ship.

| Ship | Current Prototyping rule | Candidate | Intended role if activated |
|---|:-:|---|---|
| **4 Frigate** | Move 3; **Modify** remains active | **Picket:** an enemy ship entering any of the 4 orthogonally adjacent spaces must stop there (originally 8, including diagonals). | Zone control: walls off planets and corridors |
| **5 Interceptor** | Move 3; **Shoot** is active | — | Ranged pressure: threatens space without abandoning position |
| **6 Scout** | Move 3; **Free Reconfigure** remains active | **Beacon:** Deploy into empty spaces around the Scout, as if it were a planet with your cube. | Logistics: forward staging ground for reinforcements |

If Picket and Beacon are activated, they would reshape play as follows:
- **Frigates turn movement into a puzzle.** A ring of Pickets around a planet could slow enemy approaches
  by a turn and counters "rush the sum" plays.
- **Interceptors control lanes without suicide runs.** Rather than charging into close combat where a 5
  usually loses, Interceptors project ranged area denial.
- **Scouts make the board feel vast.** With movement capped, a Beacon could make being stranded far from home planets hurt less.
  A forward Scout becomes where destroyed ships redeploy, making its survival crucial.

### 5.4 Alternatives explored per ship

| Ship | Alternative | Note |
|---|---|---|
| 4 | **Escort**: an orthogonally adjacent friendly ship subtracts 1 from its combat total when defending | Passive, easy; makes formations matter |
| 4 | **Anchor**: in a Conquer sum, counts as 3, 4, or 5, your choice | Restores flexibility as a conquer tool, not a dice fix |
| 5 | **Intercept**: once/round off-turn reaction attack when an enemy ends within 2 spaces | High interactivity; requires off-turn pending prompts |
| 5 | **Pursuit**: after winning an attack, may attack again from the new space (once per turn) | Aggressive; simpler than Intercept |
| 6 | **Jump**: once per turn, move to any empty space within 2 of another of your ships, ignoring blockers | Mobility without long linear moves |
| 6 | **Survey**: at the start of your turn, look at the top Skill card; may swap with a face-up one | Information role; ties Scout to the market |

#### Idea: Rally (replaces the 2 Flagship's Carry)

**Rally:** as part of a Move action, the Flagship may move any other friendly ship that is orthogonally
adjacent to it, using that ship's normal movement (and attack) rules. Carry is removed.

Is it overpowered? Probably not, but it needs a limit:
- Carry costs the Flagship's move and forbids its attack; the passenger only relocates. Rally lets a
  ship act without spending the Flagship's move, so it is closer to a free extra activation: strictly stronger.
- Under Prototyping's move-3 cap, this gives a second ship 3 moves for one action, which erodes the cap's
  purpose and risks the hyper-mobility problem from 5.1.
- Orthogonal adjacency is a real positional tax, and the Flagship is a single ship, so the effect is bounded.

Tuning options, mildest first: (1) once per turn; (2) the Flagship itself must not move that turn;
(3) the rallied ship moves at most 2 and cannot attack; (4) it replaces the Flagship's own move rather than
adding to it. Suggest testing (1) + (3) first. Needs a Move-action extension hook and a self-play check
on game length and Flagship survival.

### 5.5 Implementation costs

| Power | Engine | AI | UI |
|---|---|---|---|
| Picket | `stopsEnemies` hook; **current** on every ship (zone of control) | Automatic via legal moves | Highlights automatic; zone overlay optional |
| Shoot | `action` hook; **current** | Handled via legal actions | Action button and target highlights |
| Beacon | `deployTargets` hook available; candidate not registered | Automatic | Target cell highlights |
| Escort, Anchor | Combat modifier / conquer-sum hook | Automatic | Combat breakdown line |
| Intercept | Off-turn `Pending` reaction hook | Response choice heuristic | Prompt window (like missiles) |
| Survey | Start-of-turn decision hook | Choice heuristic | Card dialog |

### 5.6 Testing & validation

- Shoot has scenario coverage for its turn limit and line of sight. Before activating Picket or Beacon,
  add scenarios for Picket pass-through and starting positions, and for Beacon targets after a Scout is destroyed.
- Self-play metrics on moves, attacks, and power uses per ship value. Success criterion: 4s, 5s, and 6s
  are fielded intentionally rather than reconfigured away.
- Average game length compared with Community: a cap plus Picket should lengthen games slightly, but
  exceeding a 30% increase suggests adding an action or offensive counterweight.

---

## 6. Future experiments: a different game, not a re-tuned one

These candidates fundamentally alter game dynamics. Each is a distinct prototype; do not combine them until
each is evaluated independently.

### Overview by Theme

- **Spatial Control & Geography:**
  - [§6.2 Supply Lines](#62-supply-lines)
  - [§6.8 Contested Orbit (Orbital Blockade)](#68-contested-orbit-orbital-blockade-no-conquering-under-enemy-ships)
- **Action Economy & Fleet Command:**
  - [§6.4 Command Dice](#64-command-dice-instead-of-three-fixed-actions)
  - [§6.9 Pure Ship Activations (The Wargame Model)](#69-pure-ship-activations-the-wargame-model)
  - [§6.3 Planet Economy](#63-planet-economy)
- **Ship Dynamics & Movement:**
  - [§6.1 Kinetic Ships](#61-kinetic-ships-you-become-how-far-you-moved)
  - [§6.6 Asymmetric Factions](#66-asymmetric-factions)
- **Variants & Rulesets:**
  - [§6.5 Neutral Raiders](#65-neutral-raiders-from-the-void)
  - [§6.7 Fog of War](#67-fog-of-war)

---

### 6.1 Kinetic ships: you become how far you moved

**Rule.** After a ship moves, its value becomes the number of spaces it moved. A ship that moves 2
becomes a Flagship. An attack counts the steps taken to reach the space it attacked from. A ship
that doesn't move keeps its value. Reconfigure still exists.

**Why it's different.** Speed and strength stop being fixed by dice rolls. Every move balances
reaching a space against arriving combat-ready: charging across the map leaves you vulnerable on arrival.
Conquer sums become a positional puzzle solved with movement rather than re-rolls.

**Build.** Small: move handler sets `d.value`; `turn.seen` already tracks values. AI copes via legal
actions. Golden tests unaffected.

---

### 6.2 Supply lines

**Rule.** A ship is **in supply** if it is within 3 spaces of a planet with your cube, or of another
in-supply ship of yours (forming a supply chain). Out-of-supply ships cannot attack and add 2 to their
combat total when defending.

**Why it's different.** Transforms the map into fronts and supply corridors rather than isolated raids.
Cutting a chain matters as much as destroying a ship. Integrates naturally with Beacon Scouts (§5) as
mobile supply depots.

**Build.** Medium: BFS `inSupply` query, read by attack legality and `combatTotal`. UI requires a supply
overlay. AI needs a supply term in its evaluation.

---

### 6.3 Planet economy

**Rule.** Each planet with your cube produces energy each turn: 7 → 1, 8 → 1, 9 → 2, 10 → 2. Energy
purchases bonus actions (3 energy), missiles (2), or free Deploys (1). Win condition remains cubes or
becomes "first to N energy banked".

**Why it's different.** Adds an engine-building layer over the conquest race. Early conquests compound,
making timing and target selection matter as much as total cube counts.

**Build.** Medium–large: mode-owned player state (§4 step 5), spend actions, UI track, AI valuation.

---

### 6.4 Command dice instead of three fixed actions

**Rule.** At the start of your turn, roll 3 command dice. Each face corresponds to an action type:
1–2 Move, 3 Attack, 4 Reconfigure, 5 Research, 6 Wild. Conquer costs two matching dice. Spending a missile
re-rolls one command die.

**Why it's different.** Each turn becomes an operational puzzle: making the best of the orders rolled.
Plans must adapt to tactical friction, extending the dice theme into turn structure itself.

**Build.** Medium: seeded turn rolls into `TurnState`, handlers consume matching dice. AI copes via
legal actions. UI requires a command-dice display strip.

---

### 6.5 Neutral raiders from the void

**Rule.** At the end of each round, a neutral raider appears on each void tile and advances toward the
nearest player ship, attacking when adjacent. Destroying a raider yields +1 research. Alternatively, a
co-op variant where players win together by conquering all planets before raiders destroy N ships.

**Why it's different.** Shared threats introduce emergent truce dynamics and board pressure. The co-op
variant represents a distinct game experience.

**Build.** Large: non-player owner, round-end automated behavior, neutral invariants.

---

### 6.6 Asymmetric factions

**Rule.** Each player chooses a faction with its own ship table: unique powers per value and distinct
movement curves (e.g., a **swarm** faction whose 1s and 2s move 2 extra spaces, or a **dreadnought** faction
whose 6 is a fortified bastion with Picket and +1 defense).

**Why it's different.** Dramatic asymmetry expands replayability, making faction matchups the central
strategic dimension.

**Build.** Once §4 step 2 exists, factions are simply per-player ship tables. Balance validation via
AI self-play is the primary investment.

---

### 6.7 Fog of war

**Rule.** Players see only spaces within 2 of their ships and planets; Scouts reveal range 4.

**Why it's different.** Introduces reconnaissance, hidden fleet movements, and ambushes.

**Caution.** Conflicts with Quantum's online architecture where all clients hold full game state
([MULTIPLAYER.md](MULTIPLAYER.md)). Feasible for hot-seat play, but requires cryptographic commit-reveal
or trusted hosts for online games.

---

### 6.8 Contested orbit (orbital blockade): no conquering under enemy ships

**Rule.** A planet cannot be conquered while any opponent's ship occupies one of its orbital
positions (the 4 orthogonal spaces around the planet). To place a quantum cube you must first clear
orbit, which in practice means destroying every opposing ship there, since nothing forces a ship to
move. Friendly ships never block. The check is made only when conquering: a cube already on the
planet is never lost to ships arriving later.

**Why it's different.** In standard Quantum, enemy ships in orbit only take up space: if your own
ships in the remaining orbital positions hit the exact sum, you can build a cube right next to an
enemy fleet. Requiring a clear orbit changes the dynamics:
- **Defence becomes positional and active.** Any ship parked in orbit, even a weak 6 (combat favours
  the low total), denies conquest without the defender having to beat the attacking fleet.
- **Combat comes before conquest.** Players can no longer rush the sum past the defenders.
  Conquering becomes a two-step effort: win orbit first, then build.

**Implications under the current baseline (2026-10-12).**
- **Tempo: a contested planet usually takes two turns.** Attack (1) + Conquer (2) is the full 3
  actions, so a one-turn capture needs the rest of the sum already in orbit and the attack to succeed.
  If the attacker advances into the vacated orbital space, its own value joins the sum, so
  the attack and the conquest have to be planned together. With the movement cap of 3 and zones of
  control, most sieges will take a turn to set up and a turn to resolve.
- **Zones of control make orbits harder to get around.** Orbital positions are diagonal to each
  other, so ships move between them through the planet's corners. A blocker zones the two corners
  next to it, so an attacker circling the planet is stopped beside the blocker. That is also exactly
  where it has to be to attack, so zones of control channel attackers into the fight rather than
  shielding the blocker.
- **Clearing a blocker means attacking from outside orbit.** Two orbital spaces are never
  orthogonally adjacent, and the planet blocks a straight line between opposite ones. A ship already
  in orbit can't attack another orbital ship without first moving to a corner or further out. The 5's
  **Shoot** works well here: it can remove a blocker from range without leaving its own position.
- **Deploy lets defenders re-block for 1 action.** A destroyed blocker goes to its owner's
  scrapyard. If that owner has a cube on the planet, Deploy puts it straight back into an empty
  orbital position. The attacker can stop this only by filling every orbital position, including the
  one it just emptied (advance after winning). Expansion (Tactic) is a free version of the same
  move. This is the main stalemate risk on planets the defender already holds.
- **Over-conquest becomes a real siege.** The planet over-conquest targets always holds an
  opponent's cube, so that opponent can always Deploy there. A sum of exactly 12 now also requires
  a clear orbit, which may tip over-conquest from "hard" to "almost never". If so, the anti-leader
  lever disappears just when leaders can afford to garrison.
- **Infamy stays the way out.** Each won attack gives +1 dominance, so clearing blockers pushes
  the attacker towards Infamy, which ignores orbital positions. Sieges therefore pay off even when
  the conquest itself fails. Keep Infamy unaffected by the blockade (see rulings below).
- **Cheap denial in multiplayer.** Any opponent blocks, including a third player who has no
  interest in the planet. One spare ship can deny a planet to the leader (good) or to whoever is
  catching up (kingmaking).
- **Skill conquest still needs a clear orbit.** Pioneering, Tyrannical and Intelligent change the
  sum, not the blockade, so a planet with a blocker stays locked whatever they add.

**Rulings to make before building.**
1. Does **Infamy** ignore the blockade? *Proposed: yes*, since Infamy already ignores orbital
   positions, and it keeps a release valve.
2. Do enemy ships on the **corners** block an **Ingenious** conquest? *Proposed: no.* Only the 4
   orthogonal orbital positions block, for every player, so there is one rule to remember.
3. Does the blockade apply to **over-conquest**? *Proposed: yes* at first, and measure it. If
   over-conquest disappears from games, exempt it or let over-conquest ignore one blocker.
4. Softer variant if games stall: block only when the opponent has **at least as many ships** in
   orbit as the conqueror (orbital majority), rather than any single ship.

**Build.** Small: one check in `conquerCheck` ([queries.ts](../packages/engine/src/queries.ts),
§4 step 3) that `orbitals(state.board, planet)` holds no die owned by another player, behind a new
`RuleSet` flag so only Prototyping sees it. Infamy goes through a separate path and is unaffected
unless ruling 1 changes. Legal actions follow automatically. The AI, though, needs an evaluation term
for attacking blockers and for garrisoning its own planets, or self-play will stall around
blockaded planets and understate the rule.

**Test.** Game length, attacks per conquest, share of conquests made through Infamy,
over-conquest frequency, and how often a player Deploys back into a planet they are defending.
Watch for stalled games where every high-value planet is garrisoned.

---

### 6.9 Pure ship activations: the wargame model

**Rule.** Rather than spending a shared pool of 3 actions, the turn structure splits into **ship activations**
and **command actions**:
- **Ship activations:** Every ship on the board can activate once per turn to perform one tactical
  action: **Move**, **Attack**, or use its **Ship Power**.
- **Command actions:** In addition, the player gets **1 or 2 Command Actions** per turn to spend on
  strategic fleet management: **Deploy** (from scrapyard), **Reconfigure**, **Research**, or **Conquer**.

**Why it's different.** In standard Quantum, expanding your fleet to 4 or 5 ships is often an illusion
or even a liability. With only 3 actions total, advancing a modest battlegroup of 3 ships exhausts your
entire turn, leaving zero actions to attack or conquer. Extra ships sit as inert dice on the board,
acting merely as targets for enemy dominance farming. Under pure activations:
- **No inert ships:** Completely eliminates the feeling of ships being "inert dice sitting on the board".
  Every vessel in play can maneuver, screen, or attack every round.
- **Genuine geographical warfare:** You can advance a multi-ship battle line, hold multiple fronts,
  and stage simultaneous planetary sieges.
- **Fleet expansion matters:** Adding a 4th or 5th ship via Expansion genuinely scales your operational
  bandwidth rather than diluting your 3 actions.
- **Natural synergy with the movement cap:** Because ships move at most 3, having more active ships
  does not lead to hyper-mobile chaos; instead, it enables coordinated fleet movements and tactical
  positioning.

**Consideration.** A bigger departure from Quantum's core rules, but the closest to a genuine
positional wargame.

**Build.** Medium–large: replaces fixed `TurnState.actionsLeft` with tracked ship activations
(`turn.acted: string[]`) and a small command action pool (`turn.commandActionsLeft`), gated by §4 step 6.
AI needs an activation sequencer (ordering moves before attacks). UI needs clear visual states
(e.g. dimmed dice or activation pips) for ships that have already acted this turn.

**Test.** Test with 1 vs 2 command actions. Compare game length and fleet sizes with Community. Does it
prevent runaway leaders, or does losing ships to the scrapyard create too steep of a tempo swing?

---

### 6.10 Current rule: over-conquest, a sum of 12 to displace a cube

**Current rule.** A player may conquer a planet that holds an opponent's cube by displacing that cube, whether or not the planet is full. A full planet is not locked out: this is the only way to take it. The requirement is one number to remember: the orbiting ships must sum to **exactly 12**, whatever the planet's printed value. (Doubling the value, 14 to 20, was tried first: those sums were too unlikely, and the AI almost never reached them.)
- On a planet with room, the ordinary conquest (printed value) stays available; over-conquest is the alternative that takes an opponent's cube instead of a free location.
- Ships in orbit are still subject to orbital limits and standard conquer restrictions.
- Upon success the player places their cube and chooses which opponent's cube to replace (if there is a choice). The displaced cube is returned to its owner's supply.

**Why it's different.** In standard Quantum, once all cube slots on a planet are occupied, the planet becomes permanently locked down. In the mid-to-late game, this can restrict options, leading to dead zones or forcing players into tedious cross-map journeys to reach remaining open slots:
- **King-of-the-hill territory.** Central and high-value planets remain relevant battlegrounds for the entire game rather than turning into static background terrain once claimed.
- **Direct catch-up and king-slayer lever.** Displacing a cube actively subtracts a victory point from the target player while granting one to the conqueror. This provides an organic check against runaway leaders without requiring dedicated combat cards.
- **Massive fleet commitment.** Assembling a sum of 12 demands at least two heavy ships, usually three (e.g. 6 + 6, or 5 + 4 + 3), simultaneously holding orbital positions. Committing this much fleet power creates an operational bottleneck and leaves the conqueror vulnerable elsewhere, making over-conquest a major deliberate siege rather than an easy opportunistic capture.
- **Target selection & diplomacy.** When multiple players share a full planet, the conqueror decides whose cube to eliminate, introducing tactical target selection.

**Implementation status.** This is enabled by `RuleSet.overConquest`, checked by
`conquerCheck`, and covered by [prototyping.test.ts](../packages/engine/test/prototyping.test.ts).
The current UI and legal actions offer replacement targets; AI valuation and a dedicated orbit-requirement
display remain possible follow-up work.

---

### Which to try first

| Idea | Core Change | How Different | Build Cost | Fits Architecture |
|---|---|---|---|---|
| **6.8 Contested orbit** | No conquer while enemy in orbit | Medium | Small | Yes (via §4 step 3 hook) |
| **6.1 Kinetic ships** | Speed equals arrival value | High | Small | Yes |
| **6.2 Supply lines** | Supply chains for attack/defense | High | Medium | Yes |
| **6.4 Command dice** | Rolled order dice replace fixed actions | High | Medium | Yes |
| **6.6 Factions** | Asymmetric ship tables per player | Medium–high | Medium after §4 step 2 | Yes |
| **6.9 Ship activations** | Each ship acts once + 1–2 command actions | High | Medium–large | Needs §4 step 6 |
| **6.3 Planet economy** | Planetary energy production & spending | High | Medium–large | Needs §4 steps 4–5 |
| **6.5 Neutral raiders** | Automated void hostiles / co-op | Very high | Large | Needs neutral player |
| **6.7 Fog of war** | Local vision ranges | Very high | Very large | Conflicts with online model |

**Recommendation:**
1. Keep the live Prototyping baseline: **movement cap 3 + Shoot + over-conquest**.
2. Prototype **Contested orbit (§6.8)** first—it is tiny to build (a `conquerCheck` hook) and tests
   whether orbital defense adds useful positional play.
3. Test **Kinetic ships (§6.1)** as an independent one-file experiment to explore movement-driven sums.
4. If fleet expansion still feels underwhelming, evaluate **Ship activations (§6.9)** to unlock full
   multi-front command bandwidth.

---

## 7. Next steps

- [x] Rule on the movement cap: caps die value before skill bonuses and powers
- [x] Add Prototyping mode with `maxMovement: 3` and scenario tests
- [x] Add Prototyping to golden replay and consistency invariants
- [x] Refactor: ship table per mode (§4 step 2)
- [x] Replace the 5's diagonal Manoeuvre ability with Shoot
- [x] Add over-conquest at an orbit sum of 12
- [x] Picket active as the default zone of control for all ships (2026-10-12)
- [ ] Decide whether to activate Beacon (6); its source file is a candidate only
- [ ] Prototype Contested Orbit (§6.8) via `conquerCheck` hook
- [ ] Write per-game stats script (CSV: moves, attacks, power uses per ship value)
- [ ] Prototype Kinetic ships (§6.1) as a separate branch experiment
- [ ] Evaluate Ship Activations (§6.9) if fleet expansion needs more command capacity

---

## 8. Current status & playtest results (2026-10-11)

Prototyping is playable in the lobby. The authoritative current-rule summary is at the top of this
document: Community Edition with a movement cap of 3, Shoot for the 5, and over-conquest. The 4's
Modify and the 6's Free Reconfigure are still active. Picket applies to every ship as the zone-of-control rule (since 2026-10-12); Beacon is not enabled.

### Rulings established during implementation

- **Shoot** attacks the first ship in any orthogonal line (up, down, left, right), at any distance, as
  long as the line is clear: ships (friendly or enemy), planets and the board's edge block it; the void
  does not. (It was first range 1–2, diagonals included, then a free shot alongside the move, then a shot with a separate move.)
  Shooting costs one action and is the ship's one action of the turn, like a move or an attack: a ship
  can't move, attack or shoot again that turn, and can't shoot after moving or attacking. Normal combat, missiles, and re-rolls apply; the
  shooter never advances.
- **Over-conquest** is optional alongside an ordinary conquest when an opponent cube is present. It
  requires an orbit sum of exactly 12 and returns the replaced cube to its owner's reserve.

Scenarios live in [prototyping.test.ts](../packages/engine/test/prototyping.test.ts).

### Playtest status

There is no current self-play benchmark for this baseline. The previous figures measured a different
configuration (Picket and Beacon enabled, plus an earlier version of Shoot) and are intentionally not
used as evidence for the current rules. Re-run the commands in §3 after the current set has stabilized.

---

## 9. Developer guide: working on Prototyping

Prototyping is isolated in a modular sandbox. Everything specific to the mode lives in
[`packages/engine/src/prototyping/`](../packages/engine/src/prototyping). The core engine and web UI never hard-code
its powers or mode name.

### File Layout

```
packages/engine/src/
  prototyping/
    index.ts          mode definition: MAX_MOVEMENT, PROTOTYPING_SHIPS, prototypingMode()
    powers/picket.ts  Picket's hooks, applied to every ship as the zone-of-control rule
    powers/shoot.ts   power text and hooks for Shoot (5)
    powers/beacon.ts  candidate power text and hooks for Beacon (not registered)
  prototype.ts        the prototype kit: ShipHooks, PrototypePower, and the engine helpers a power may use
```

| To Change | File to Edit |
|---|---|
| Movement cap, mode summary, base rules | [prototyping/index.ts](../packages/engine/src/prototyping/index.ts) |
| Which ship has which power, ship names | `PROTOTYPING_SHIPS` in [prototyping/index.ts](../packages/engine/src/prototyping/index.ts) |
| A power's rules text, range, or hooks | Power file in [prototyping/powers/](../packages/engine/src/prototyping/powers) |
| Add a power using existing hooks | New file in `powers/`, referenced in `PROTOTYPING_SHIPS` |
| Add an engine helper to the kit | Re-export from [prototype.ts](../packages/engine/src/prototype.ts) |
| Add a new kind of rule hook | Add to `ShipHooks` in [prototype.ts](../packages/engine/src/prototype.ts) |

### Defining a Power

A power is a `PrototypePower` object combining UI metadata with optional engine hooks. The current
implementation is [shoot.ts](../packages/engine/src/prototyping/powers/shoot.ts); the unregistered
Beacon candidate is a small passive example:

```ts
// packages/engine/src/prototyping/powers/beacon.ts
import { cellOf, surrounding, type PrototypePower } from '../../prototype';

export const beacon: PrototypePower = {
  ability: {
    name: 'Beacon',
    text: 'You may deploy into any empty space around this ship.',
  },
  hooks: {
    deployTargets: (state, ship) => surrounding(state.board, cellOf(ship)!),
  },
};
```

### Engine Integration & Hooks

1. **One import.** `RULESETS.prototyping = prototypingMode(COMMUNITY)` in [rulesets.ts](../packages/engine/src/rulesets.ts)
   is the only place in the main engine importing the `prototyping` folder. Engine modules read the rule set
   through `rulesOf` (rules.ts), which imports no mode, so the engine loads the same whichever module comes
   first (`load-order.test.ts`).
2. **Hooks over names.** Ships have built-in official powers (`strike`, `transport`...) or
   `hooks: ShipHooks`. The engine evaluates hooks via `hooksOf(state, die)`:

   | Hook | Evaluated By | Purpose / User |
   |---|---|---|
   | `stopsEnemies` | `stopZone` → `moveIndexes`, `shipReach` | Stops enemy movement when entering zone (Picket) |
   | `deployTargets` | `deployTargets` | Additional valid cells for Deploy action (Beacon) |
   | `action` (`options`, `apply`) | generic `power` action handler | Custom active power button & execution (Shoot) |

3. **Generic action pipeline.** Powers with an `action` hook produce `{ type: 'power', die, target?, to? }`.
   The UI automatically renders a button with `ability.name`, highlights valid targets, and displays
   `ability.hint` without needing UI code changes.
4. **Zero cost when unused.** Active hooks are cached per mode (`modeHasHook`), ensuring official modes
   experience zero performance overhead.

### Mode Safety & Invariants

- **Complete isolation:** Official modes use `CLASSIC_SHIPS` with no hooks. Their code paths observe
  `undefined` for all hook lookups.
- **Import boundary by convention:** Nothing in `engine` imports `prototyping` except `rulesets.ts`. The
  `prototyping` folder imports nothing from `engine` except `prototype.ts`; `prototyping.test.ts` checks
  static and dynamic relative imports. This is not a sandbox: prototype hooks are trusted engine code
  and can mutate `GameState`.
- **Golden test protection:** Golden replays for Basic, Classic, and Community must never change. Any
  alteration indicates a leak. Only Prototyping replay snapshots may update (`npx vitest run golden -t prototyping -u`).

### Adding a New Hook

Only add a new hook when no existing hook fits:
1. Add the optional hook signature to `ShipHooks` in [prototype.ts](../packages/engine/src/prototype.ts).
2. Name the hook after the **rule concept** (e.g. `stopsEnemies`), not the specific power name (`picket`).
3. Read the hook via `hooksOf` in the single engine function it affects.
4. Add a scenario test in [prototyping.test.ts](../packages/engine/test/prototyping.test.ts).
