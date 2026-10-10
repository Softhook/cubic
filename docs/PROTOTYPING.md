# Prototyping a Fourth Mode

How to build **Cubic**, our own rule set, alongside Basic, Classic, and Community.

> **Design Thesis: From Arithmetic Sprint to Positional War**  
> In base Quantum, hyper-mobility collapsed geography. Ships with 5–6 movement on compact boards crossed the map with ease, turning battles into isolated teleport raids and conquest into an arithmetic puzzle.  
> **Cubic restores territorial gravity**: movement caps create distance, big ships project zones of control and forward logistics, and planets require orbital superiority before conquest.

Nothing here is permanently adopted. Rulings go to [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) and, once decided, to [RULES.md](RULES.md).

---

## Table of Contents

1. [How Modes Work Today](#1-how-modes-work-today)
2. [Worked Example: Movement Cap at 3](#2-worked-example-ships-move-at-most-3)
3. [How to Test a New Mode](#3-how-to-test-a-new-mode)
4. [Engine Refactoring Roadmap](#4-refactoring-in-the-order-it-pays-off)
5. [The Ship Redesign: Powers for the 4, 5, and 6](#5-new-powers-for-the-4-5-and-6)
6. [Radical Ideas Catalogue](#6-radical-ideas-a-different-game-not-a-re-tuned-one)
7. [Next Steps](#7-next-steps)
8. [Current Status & Playtest Results](#8-what-was-built-2026-10-09)
9. [Developer Guide: Working on Cubic](#9-working-on-cubic)

---

## 1. How modes work today

Every rule lives in [`packages/engine`](../packages/engine). A game is a pure function: take the
state and an action, return the new state. The AI, the web UI, and online play only call
`legalActions()` and `apply()`. Online, every browser replays the same moves through the same engine,
so a new mode needs no network changes as long as it stays deterministic.

```
  Web UI ──┐
  AI ──────┼── legalActions() / apply() ──▶  action handlers ──▶ rule questions ◀── RULESETS
  Online ──┘                                 (actions, combat,   (queries.ts:        (rules.ts:
                                              cards, turn)        movementRange,      Basic, Classic,
                                                                  conquerCheck…)      Community, + Cubic)
```

A mode is one entry in `RULESETS` ([rules.ts](../packages/engine/src/rules.ts)). The engine reads it
through `rulesOf(state)` and never compares mode names. Today a `RuleSet` varies only these:

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
[cubic/index.ts](../packages/engine/src/cubic/index.ts), read by `movementRange`. §9 details where
Cubic's code lives today.*

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

1. Add `'cubic'` to `GameMode` in [data.ts](../packages/engine/src/data.ts).
2. Give `RuleSet` an optional `maxMovement?: number`.
3. Add the mode, copying Community, and list it in `MODES`:
   ```ts
   cubic: { ...RULESETS.community, id: 'cubic', name: 'Cubic', title: 'Cubic',
            summary: 'Community Edition with redesigned fast ships.', maxMovement: 3 },
   ```
4. Cap the result in `movementRange`.
5. Optional: a `.mode-badge.mode-cubic` colour in `styles.css`, a row in the rulebook's mode table
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

1. **Play it by hand.** `npm run dev`, then `localhost:5173/?play=cubic&players=2&seed=7` skips the
   lobby and starts a game against the AI ([devStart.ts](../apps/web/src/game/devStart.ts)). The same
   seed gives the same dice, so situations can be replayed after each tweak.
2. **Pin each rule with a scenario.** `quickStart(2, 1, 'cubic')` and `arrange()` in
   [test/helpers.ts](../packages/engine/test/helpers.ts) set up exact positions. One test per rule,
   as in [basic.test.ts](../packages/engine/test/basic.test.ts) and [cubic.test.ts](../packages/engine/test/cubic.test.ts).
3. **Check it never breaks the engine.** Add `'cubic'` to the modes in
   [golden.test.ts](../packages/engine/test/golden.test.ts) and the consistency cross-check: seeded AI
   games run `checkInvariants()` after every action, and `legalActions` and `apply` must agree.
4. **Measure balance with AI self-play.**
   - `npm run ai:match -- 3 3 100 cubic 2`: turns per game and seat win rates. Compare with `community`.
   - `npm run selfplay:cards -- 50 cubic`: card win, pick, and use rates.
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
| 1 | Lift fixed numbers into `RuleSet`: actions per turn (`ACTIONS_PER_TURN`), track cap (6), movement cap, Infamy and breakthrough thresholds | Variable tweaks | Small |
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

## 5. New powers for the 4, 5 and 6

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
- **Give the board territorial gravity.** Ships should project threat and control space:
  - **Zone control:** Frigates (Picket) wall off lanes and planet approaches.
  - **Ranged pressure:** Interceptors (Shoot) threaten space without having to abandon position.
  - **Forward bases:** Scouts (Beacon) serve as logistics hubs in a world where crossing the map takes time.
  - **Planetary sieges:** Planets cannot be claimed while contested by enemy ships (§6.8). You must
    clear orbital space before constructing.
- **Keep the combat trade-off**: big ships still lose most fights (they add 4–6), so their value lies in
  holding space, supporting small fighters, and shaping the battlefield.
- **Prefer passive powers or clean action extensions**, so the AI copes naturally without complex
  scoring overhauls.

### 5.3 Active set: control, ranged threat, logistics

The trio implemented in Cubic today (see §8 for rulings and playtest stats):

| Ship | Moves | Power | Role |
|---|:-:|---|---|
| **4 Frigate** | 3 | **Picket.** An enemy ship that enters any of the 8 spaces around your Frigate must stop there. Its last step may still be an attack. | Zone control: walls off planets and corridors |
| **5 Interceptor** | 3 | **Shoot.** Attack an enemy 1–2 spaces away in a straight line without advancing. Move and shot cost 1 action together in either order. | Ranged pressure: threatens space without abandoning position |
| **6 Scout** | 3 | **Beacon.** You may Deploy into empty spaces around your Scout, as if it were a planet with your cube. | Logistics: forward staging ground for reinforcements |

How they reshape play:
- **Frigates turn movement into a puzzle.** A ring of Pickets around a planet slows enemy approaches
  by a turn and counters "rush the sum" plays.
- **Interceptors control lanes without suicide runs.** Rather than charging into close combat where a 5
  usually loses, Interceptors project ranged area denial.
- **Scouts make the board feel vast.** With movement capped, being stranded far from home planets hurts.
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

### 5.5 Implementation costs

| Power | Engine | AI | UI |
|---|---|---|---|
| Picket | `stopsEnemies` hook (built) | Automatic via legal moves | Highlights automatic; zone overlay optional |
| Shoot | `action`, `freeMove`, `noAttack` hooks (built) | Handled via legal actions | Action button and target highlights |
| Beacon | `deployTargets` hook (built) | Automatic | Target cell highlights |
| Escort, Anchor | Combat modifier / conquer-sum hook | Automatic | Combat breakdown line |
| Intercept | Off-turn `Pending` reaction hook | Response choice heuristic | Prompt window (like missiles) |
| Survey | Start-of-turn decision hook | Choice heuristic | Card dialog |

### 5.6 Testing & validation

- One scenario test per power, including boundary conditions: Picket stopping pass-through moves but
  not starting ones; Shoot line-of-sight blockage by void/planets/ships; Beacon spaces clearing on Scout destruction.
- Self-play metrics on moves, attacks, and power uses per ship value. Success criterion: 4s, 5s, and 6s
  are fielded intentionally rather than reconfigured away.
- Average game length compared with Community: a cap plus Picket should lengthen games slightly, but
  exceeding a 30% increase suggests adding an action or offensive counterweight.

---

## 6. Radical ideas: a different game, not a re-tuned one

These ideas fundamentally alter game dynamics. Each is a distinct prototype; do not combine them until
each is evaluated independently.

### Overview by Theme

- **Spatial Control & Geography:**
  - [§6.2 Supply Lines](#62-supply-lines)
  - [§6.8 Contested Orbit (Orbital Blockade)](#68-contested-orbit-orbital-blockade-no-conquering-under-enemy-ships)
  - [§6.10 Over-Conquest (Doubled Defense on Occupied Planets)](#610-over-conquest-doubled-planetary-defense-on-fully-occupied-planets)
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

**Rule.** A planet cannot be conquered if an enemy ship occupies any of its orbital spaces (the 4
orthogonal positions around the planet). To place a quantum cube, orbit must be clear of enemies: you
must first destroy or drive off every opposing ship stationed there before constructing.

**Why it's different.** In standard Quantum, enemy ships in orbital positions are ignored during
Conquer actions—as long as your own ships meet the exact sum on the remaining orbital spaces, you can
construct a cube directly beside an enemy fleet. Requiring an uncontested orbit changes the dynamics:
- **Defense becomes positional and active.** Parking any ship in orbit—even a weak 5 or 6, or a 4
  Picket—actively denies enemy conquest without having to eliminate the attacking fleet.
- **Forces combat before victory.** Players cannot simply "rush the sum" while bypassing defending
  ships. Conquering becomes a multi-phase effort: achieve orbital superiority first, then construct.
- **Synergizes with Picket.** A defending Picket in orbit forces attackers to stop upon entry,
  preventing single-turn blitz attacks and turning planet assaults into authentic tactical sieges.

**Build.** Small: a hook on `conquerCheck` ([queries.ts](../packages/engine/src/queries.ts), §4 step 3)
verifying that `orbitals(board, planet)` contains no enemy ship. The AI handles legal actions
automatically, though AI evaluation would benefit from scoring contested planets and prioritizing
clearing blockers.

**Test.** Check average game length and attacks per conquer. Does it encourage richer combat and
defense, or does it risk stalling games when players park defensive ships on high-value planets?

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

### 6.10 Over-conquest: doubled planetary defense on fully occupied planets

**Rule.** When all cube slots at a planet are fully occupied, the planet is not locked out. A player can still conquer the planet, but the planetary defense requirement is **doubled** from its printed planet value:
- A planet of value 7 requires orbiting ships summing to **exactly 14** (instead of 7).
- An 8 requires **exactly 16**, a 9 requires **exactly 18**, and a 10 requires **exactly 20**.
- Ships in orbit are still subject to orbital limits and standard conquer restrictions.
- Upon successfully conquering/occupying the planet, the player places their cube and chooses which existing cube to replace (if there is a choice between opponents, or between multiple cubes on the planet). The displaced cube is returned to its owner's supply.

**Why it's different.** In standard Quantum, once all cube slots on a planet are occupied, the planet becomes permanently locked down. In the mid-to-late game, this can restrict options, leading to dead zones or forcing players into tedious cross-map journeys to reach remaining open slots:
- **King-of-the-hill territory.** Central and high-value planets remain relevant battlegrounds for the entire game rather than turning into static background terrain once claimed.
- **Direct catch-up and king-slayer lever.** Displacing a cube actively subtracts a victory point from the target player while granting one to the conqueror. This provides an organic check against runaway leaders without requiring dedicated combat cards.
- **Massive fleet commitment.** Assembling a sum of 14, 16, 18, or 20 demands multiple heavy ships (e.g. 6 + 6 + 2 = 14, or 5 + 5 + 4 = 14; 6 + 5 + 5 = 16) simultaneously holding orbital positions. Committing this much fleet power creates an operational bottleneck and leaves the conqueror vulnerable elsewhere, making over-conquest a major deliberate siege rather than an easy opportunistic capture.
- **Target selection & diplomacy.** When multiple players share a full planet, the conqueror decides whose cube to eliminate, introducing tactical target selection.

**Build.** Small–medium:
- `conquerCheck` ([queries.ts](../packages/engine/src/queries.ts), §4 step 3): if all cube slots at the planet are full, check if ships sum to `planet.value * 2` rather than disallowing conquest.
- Decision prompt: if multiple cubes occupy the planet, prompt the conqueror with a `replaceCube` decision to choose which cube to displace. If all cubes belong to a single opponent, auto-resolve or prompt.
- Displaced cube returns to owner's reserve (decrementing their placed cube score).
- AI: needs to evaluate over-conquest opportunities (especially targeting the score leader) and calculate sums for doubled defense values.
- UI: planet orbital display shows doubled requirement when full (e.g., "Full: 14 to Conquer") and renders a cube selection dialog when conquered.

---

### Which to try first

| Idea | Core Change | How Different | Build Cost | Fits Architecture |
|---|---|---|---|---|
| **6.8 Contested orbit** | No conquer while enemy in orbit | Medium | Small | Yes (via §4 step 3 hook) |
| **6.10 Over-conquest** | Conquer full planets at 2× value; replace a cube | Medium | Small–medium | Yes (via §4 step 3 hook & decision) |
| **6.1 Kinetic ships** | Speed equals arrival value | High | Small | Yes |
| **6.2 Supply lines** | Supply chains for attack/defense | High | Medium | Yes |
| **6.4 Command dice** | Rolled order dice replace fixed actions | High | Medium | Yes |
| **6.6 Factions** | Asymmetric ship tables per player | Medium–high | Medium after §4 step 2 | Yes |
| **6.9 Ship activations** | Each ship acts once + 1–2 command actions | High | Medium–large | Needs §4 step 6 |
| **6.3 Planet economy** | Planetary energy production & spending | High | Medium–large | Needs §4 steps 4–5 |
| **6.5 Neutral raiders** | Automated void hostiles / co-op | Very high | Large | Needs neutral player |
| **6.7 Fog of war** | Local vision ranges | Very high | Very large | Conflicts with online model |

**Recommendation:**
1. Keep the live Cubic baseline: **Movement cap 3 + Picket + Shoot + Beacon** (§5).
2. Prototype **Contested orbit (§6.8)** first—it is tiny to build (a `conquerCheck` hook) and immediately
   reinforces the siege/defense dynamics of Picket.
3. Test **Kinetic ships (§6.1)** as an independent one-file experiment to explore movement-driven sums.
4. If fleet expansion still feels underwhelming, evaluate **Ship activations (§6.9)** to unlock full
   multi-front command bandwidth.

---

## 7. Next steps

- [x] Rule on the movement cap: caps die value before skill bonuses and powers
- [x] Add Cubic mode with `maxMovement: 3` and scenario tests
- [x] Add Cubic to golden replay and consistency invariants
- [x] Refactor: ship table per mode (§4 step 2)
- [x] Prototype and land Picket (4), Shoot (5), and Beacon (6)
- [ ] Prototype Contested Orbit (§6.8) via `conquerCheck` hook
- [ ] Write per-game stats script (CSV: moves, attacks, power uses per ship value)
- [ ] Prototype Kinetic ships (§6.1) as a separate branch experiment
- [ ] Evaluate Ship Activations (§6.9) if fleet expansion needs more command capacity

---

## 8. Current status & playtest results (2026-10-09)

Cubic is playable in the lobby: Community Edition plus the movement cap, with **Picket** (4), **Shoot** (5),
and **Beacon** (6) replacing Modify, Manoeuvre, and Free Reconfigure. Values 1, 2, and 3 are unchanged.

### Rulings established during implementation

- **Adjacency is all 8 surrounding spaces** for Picket and Beacon. Warp Gates do not link them.
- **Picket** applies to normal moves only (not Transport, Warp, or Tactical steps). A ship starting
  inside a zone may leave, but stops in the next zone space it enters.
- **Shoot** attacks an enemy 1 or 2 spaces away in a straight line (orthogonal or diagonal). At range 2,
  the intervening space must be clear. Move and shot cost **one action together, in either order**:
  shoot first (1 action) and the move is free, or move first (1 action) and the shot is free. A ship
  that shoots cannot also attack normally that turn. Normal combat, missiles, and re-rolls apply; the
  shooter never advances.

Scenarios live in [cubic.test.ts](../packages/engine/test/cubic.test.ts).

### First self-play benchmarks (Level 2 vs Level 2, 2 Players)

| Metric | Community | Cubic |
|---|:-:|:-:|
| Turns per game (`ai:match`, 60 games) | 17.9 | 17.1 |
| Total attacks (30 games) | 208 | 134 |
| 4s / 6s on board at turn end (30 games) | 273 / 171 | 496 / 445 |
| Enemy moves stopping in a Picket zone (30 games) | — | 20 of 534 moves (~4%) |
| Shoot opportunities / usages (15 games, range 1–2) | — | 63 / 15 (4 shoot-then-move) |

**Observations:**
- Games did not lengthen under movement cap 3 (averaging ~17 turns in both modes).
- Players preserve 4s and 6s on the board instead of immediately reconfiguring them away.
- Picket zone control bites in roughly 4% of moves.
- Shoot is used roughly once per game at range 1–2 with diagonals (the AI evaluation does not yet score
  Shoot threats ahead of time, §4 step 7).

---

## 9. Developer guide: working on Cubic

Cubic is isolated in a modular sandbox. Everything specific to Cubic lives in
[`packages/engine/src/cubic/`](../packages/engine/src/cubic). The core engine and web UI never hard-code
Cubic powers or mode names.

### File Layout

```
packages/engine/src/
  cubic/
    index.ts          mode definition: MAX_MOVEMENT, CUBIC_SHIPS, cubicMode()
    powers/picket.ts  power text and hooks for Picket (4)
    powers/shoot.ts   power text and hooks for Shoot (5)
    powers/beacon.ts  power text and hooks for Beacon (6)
  prototype.ts        the prototype kit: ShipHooks, PrototypePower, turn note utilities
```

| To Change | File to Edit |
|---|---|
| Movement cap, mode summary, base rules | [cubic/index.ts](../packages/engine/src/cubic/index.ts) |
| Which ship has which power, ship names | `CUBIC_SHIPS` in [cubic/index.ts](../packages/engine/src/cubic/index.ts) |
| A power's rules text, range, or hooks | Power file in [cubic/powers/](../packages/engine/src/cubic/powers) |
| Add a power using existing hooks | New file in `powers/`, referenced in `CUBIC_SHIPS` |
| Add an engine helper to the kit | Re-export from [prototype.ts](../packages/engine/src/prototype.ts) |
| Add a new kind of rule hook | Add to `ShipHooks` in [prototype.ts](../packages/engine/src/prototype.ts) |

### Defining a Power

A power is a `PrototypePower` object combining UI metadata with optional engine hooks:

```ts
// packages/engine/src/cubic/powers/beacon.ts
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

Powers tracking turn state use `turnNote(state, 'powerName', ship)` and `setTurnNote(...)` to avoid
interfering with other powers.

### Engine Integration & Hooks

1. **One import.** `RULESETS.cubic = cubicMode(COMMUNITY)` in [rules.ts](../packages/engine/src/rules.ts)
   is the only place in the main engine importing the `cubic` folder.
2. **Hooks over names.** Ships have built-in official powers (`strike`, `transport`...) or
   `hooks: ShipHooks`. The engine evaluates hooks via `hooksOf(state, die)`:

   | Hook | Evaluated By | Purpose / User |
   |---|---|---|
   | `stopsEnemies` | `stopZone` → `moveIndexes`, `shipReach` | Stops enemy movement when entering zone (Picket) |
   | `deployTargets` | `deployTargets` | Additional valid cells for Deploy action (Beacon) |
   | `freeMove` | `legalActions`, `move` handler | Free movement following a power action (Shoot) |
   | `noAttack` | `legalActions`, `attack` handler | Prevents standard attacks after using power (Shoot) |
   | `onMove` | `applyMove` handler | State updates when ship moves (Shoot note tracking) |
   | `action` (`options`, `apply`) | generic `power` action handler | Custom active power button & execution (Shoot) |

3. **Generic action pipeline.** Powers with an `action` hook produce `{ type: 'power', die, target?, to? }`.
   The UI automatically renders a button with `ability.name`, highlights valid targets, and displays
   `ability.hint` without needing UI code changes.
4. **Zero cost when unused.** Active hooks are cached per mode (`modeHooks`), ensuring official modes
   experience zero performance overhead.

### Mode Safety & Invariants

- **Complete isolation:** Official modes use `CLASSIC_SHIPS` with no hooks. Their code paths observe
  `undefined` for all hook lookups.
- **Strict architectural boundary:** Nothing in `engine` imports `cubic` except `rules.ts`. The `cubic`
  folder imports nothing from `engine` except `prototype.ts`. Checked in `cubic.test.ts`.
- **Golden test protection:** Golden replays for Basic, Classic, and Community must never change. Any
  alteration indicates a leak. Only Cubic replay snapshots may update (`npx vitest run golden -t cubic -u`).

### Adding a New Hook

Only add a new hook when no existing hook fits:
1. Add the optional hook signature to `ShipHooks` in [prototype.ts](../packages/engine/src/prototype.ts).
2. Name the hook after the **rule concept** (e.g. `stopsEnemies`), not the specific power name (`picket`).
3. Read the hook via `hooksOf` in the single engine function it affects.
4. Add a scenario test in [cubic.test.ts](../packages/engine/test/cubic.test.ts).
