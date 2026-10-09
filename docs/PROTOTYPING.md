# Prototyping a Fourth Mode

How to build **Cubic**, our own rule set, alongside Basic, Classic and Community, and what to change
first. Three parts:

1. The groundwork: how modes work, a worked example, how to test, what to refactor.
2. New powers for the 4, 5 and 6 ships, which move too far and do too little.
3. Radical ideas that would make Cubic a different game, not a re-tuned one.

Nothing here is adopted. Rulings go to [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) and, once decided, to
[RULES.md](RULES.md).

---

## 1. How modes work today

Every rule lives in [`packages/engine`](../packages/engine). A game is a pure function: take the
state and an action, return the new state. The AI, the web UI and online play only call
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
- **Closed registries.** Actions, decisions and skill effects are closed TypeScript unions. Add one
  without a handler and the build fails, pointing at the gap.

Skills already work like small plugins: each is a set of hooks in
[skillRules.ts](../packages/engine/src/skillRules.ts) (`movement`, `combat.modifier`, `startOfTurn`…).
Prototype ship powers now use the same pattern: `ShipHooks` (§9).

## 2. Worked example: ships move at most 3

*This is how the cap was first planned. It is now built: `MAX_MOVEMENT` in
[cubic/index.ts](../packages/engine/src/cubic/index.ts), read by `movementRange`. §9 says where
Cubic's code lives today.*

A ship's movement is calculated in one place:

```ts
// packages/engine/src/queries.ts
export function movementRange(state: GameState, d: Die): number {
  return d.value + skillRules(state, d.owner).reduce((n, r) => n + (r.movement ?? 0), 0);
}
```

The legal-move search (`moveOptions`, `carryOptions`), the board highlights, both AI planners
([greedy.ts](../packages/ai/src/greedy.ts), [evaluate.ts](../packages/ai/src/evaluate.ts)) and the
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
   ([Manual.tsx](../apps/web/src/rulebook/Manual.tsx)), a scenario test.

About 15 lines; the three existing modes and their golden replays don't change.

**Ruling (decided 2026-10-08):** the cap applies to the die value, before skill bonuses and special
powers. A 6 moves 3; a 6 with Agile moves 4. So step 4 is:

```ts
return Math.min(rulesOf(state).maxMovement ?? Infinity, d.value) + skillRules(state, d.owner).reduce((n, r) => n + (r.movement ?? 0), 0);
```

Capping the total instead would make Agile useless on any ship showing 3 or more.

## 3. How to test a new mode

1. **Play it by hand.** `npm run dev`, then `localhost:5173/?play=cubic&players=2&seed=7` skips the
   lobby and starts a game against the AI ([devStart.ts](../apps/web/src/game/devStart.ts)). The same
   seed gives the same dice, so a situation can be replayed after each tweak.
2. **Pin each rule with a scenario.** `quickStart(2, 1, 'cubic')` and `arrange()` in
   [test/helpers.ts](../packages/engine/test/helpers.ts) set up exact positions. One test per rule,
   as in [basic.test.ts](../packages/engine/test/basic.test.ts).
3. **Check it never breaks the engine.** Add `'cubic'` to the modes in
   [golden.test.ts](../packages/engine/test/golden.test.ts) and the consistency cross-check: seeded AI
   games run `checkInvariants()` after every action, and `legalActions` and `apply` must agree.
4. **Measure balance with AI self-play.**
   - `npm run ai:match -- 3 3 100 cubic 2`: turns per game and seat win rates. Compare with `community`.
   - `npm run selfplay:cards -- 50 cubic`: card win, pick and use rates.
   - [basic-sweep.ts](../scripts/basic-sweep.ts) is a template for flagging AI mistakes per mode.

**Worth building first:** a stats script that writes one CSV row per game: mode, turns, winner seat,
attacks, conquers, and **moves and power uses per ship value**. The last column is how we'll know
whether the new 4/5/6 powers get used.

**Caveat:** the AI plays legally under any rule, but its scoring in `evaluate.ts` is hand-tuned for
Quantum. Passive powers (§5) need no AI work. Reactive powers and the radical ideas in §6 need AI
changes before self-play results mean anything.

## 4. Refactoring, in the order it pays off

No up-front refactor is needed. Do each step when a rule needs it. Step 2 is done (§8, §9).

| Step | Refactor | Unlocks | Size |
|---|---|---|---|
| 1 | Lift fixed numbers into `RuleSet`: actions per turn (`ACTIONS_PER_TURN`), track cap (6), movement cap, Infamy and breakthrough thresholds | Variable tweaks | Small |
| 2 | **Ship table per mode**: `RuleSet.ships` gives each value its name, movement and power, as hooks like `SkillRule` | §5, and factions in §6 | Medium |
| 3 | Formula hooks on `RuleSet`: `combatOutcome`, `conquerCheck`, `deployTargets` | Supply, new conquer rules | Small–medium |
| 4 | Win check as a hook, not fixed in `placeCube` ([core.ts](../packages/engine/src/core.ts)) | Points, round limits | Medium |
| 5 | Mode-owned player state (an extension field, not new fields on every player) | New resources | Medium |
| 6 | Mode-gated actions and decisions | New actions, reactions, phases | Medium–large |
| 7 | AI scoring per mode | Trustworthy self-play | Medium |
| 8 | UI driven by the rule set: ship names and powers, player tracks, a generic decision dialog | Showing it all on screen | Large |

Step 2 matters most for this document. Today a ship's identity is its die value, hard-coded in:

- **Engine:** [abilities.ts](../packages/engine/src/abilities.ts) (`change` checks for a 4,
  `freeReconfigure` for a 6), `moveOptions` (`d.value === 5` turns on diagonals), and the ability list
  in [legal.ts](../packages/engine/src/legal.ts) (lines ~170–171).
- **Data and UI:** `SHIP_NAMES` and `SHIP_ABILITIES` in `data.ts`, read by about ten components
  (Board, ShipPanel, CombatOverlay, Overlays, the rulebook).

A per-mode ship table replaces each `d.value === N` with "does this ship's power have hook X?",
exactly as skills do. The UI then reads names and power texts from the rule set instead of fixed maps.

---

## 5. New powers for the 4, 5 and 6

### The problem

| Ship | Moves | Power today | Why it's weak |
|---|:-:|---|---|
| 4 Frigate | 4 | Turn into a 3 or a 5 | A free half-Reconfigure; no identity of its own |
| 5 Interceptor | 5 | Move and attack diagonally | Barely matters at range 5; long range already reaches everything |
| 6 Scout | 6 | Free Reconfigure | A way to stop being a Scout, not a reason to be one |

The trade-off Quantum is built on is "small ships fight, big ships travel". With 5–6 movement on
mostly 3–4 tile maps, travel is almost free, so the big ships' only real job is to reach a planet and
make up a sum. Two of their three powers are about stopping being that ship.

### Design goals

- **Cap movement at 3** (§2), so distance matters again and positioning becomes a decision. The cap
  is on the die value; skill bonuses and powers (Agile, Jump) still add to it.
- **Give each big ship a role** the small ships can't fill. Small ships fight; big ships **control
  space, react, and extend reach**.
- **Keep the combat trade-off**: big ships still lose most fights, so a power must justify fielding a
  weak fighter.
- **Prefer passive powers or new uses of existing decisions**, so the AI copes without new scoring.

### Proposed set: control, reaction, logistics

| Ship | Moves | Power | Role |
|---|:-:|---|---|
| **4 Frigate** | 3 | **Picket.** An enemy ship that enters a space adjacent to your Frigate must stop there. Its last step may still be an attack on a ship next to that space. | Zone control: walls off planets and lanes |
| **5 Interceptor** | 3 | **Intercept.** Once per round, when an enemy ship ends a move within 2 spaces of your Interceptor, you may immediately attack it with the Interceptor (off-turn, no action). | Reaction: punishes careless approaches |
| **6 Scout** | 3 | **Beacon.** You may Deploy into empty spaces adjacent to your Scout, as if it were a planet with your cube. | Logistics: a forward base for the fleet |

How they change play:

- **Frigates turn movement into a puzzle.** A ring of Pickets around a planet you want to conquer
  slows every approach by a turn. They counter the "rush the sum" pattern.
- **Interceptors make the opponent's turn interactive.** Today nothing happens on someone else's
  turn except missiles and card effects. Intercept rewards keeping a 5 in the right spot and makes
  approaching a defended planet a real risk.
- **Scouts make the board feel bigger.** With movement capped, being far from your planets hurts.
  A Scout pushed forward becomes where your destroyed ships come back in. Losing it matters.

All three keep big ships weak in combat (they still add 4–6), so they stay support pieces.

### Alternatives per ship

| Ship | Alternative | Note |
|---|---|---|
| 4 | **Escort**: an orthogonally adjacent friendly ship subtracts 1 from its combat total when defending | Passive, easy; makes formations matter |
| 4 | **Anchor**: in a Conquer sum, counts as 3, 4 or 5, your choice | Restores the old flexibility as a conquer tool, not a dice fix |
| 5 | **Pursuit**: after winning an attack, may attack again from the new space (once per turn) | Aggressive; no off-turn decision, so simpler than Intercept |
| 5 | **Strafe**: may attack a ship 2 spaces away in a straight line without moving | Ranged threat; easy to show on the board |
| 6 | **Jump**: once per turn, move to any empty space within 2 of another of your ships, ignoring blockers | Mobility without long moves |
| 6 | **Survey**: at the start of your turn, look at the top Skill card; you may swap it with a face-up one | Information role; ties the Scout to the market |

### What each costs to build

| Power | Engine | AI | UI |
|---|---|---|---|
| Picket | `stopsEnemies` hook (built) | Automatic, via legal moves | Highlights automatic; a zone overlay is nice-to-have |
| Intercept | New `Pending` kind after a move, `mayAct` lets the off-turn player answer (like missiles): a new hook | Needs a response choice, like `chooseCombatResponse` | A prompt, like the missile window |
| Beacon | `deployTargets` hook (built) | Automatic | Automatic |
| Escort, Anchor | A combat modifier / a conquer-sum option: a new hook | Automatic | A line in the combat breakdown |
| Pursuit, Strafe, Jump | `action` hook (Shoot is built this way) | Automatic (new legal actions) | Automatic: a button and highlights |
| Survey | New start-of-turn decision: a new hook | Small choice heuristic | A dialog |

With `ShipHooks` (§9), a power that fits an existing hook is a change to the cubic folder alone.
Intercept is the most interesting and the most work, roughly a week including AI and UI.

### How to test them

- One scenario test per power, including the edges: Picket stops a move that passes by but not one
  that starts adjacent; Intercept fires only once per round; Beacon spaces vanish when the Scout is
  destroyed.
- Self-play stats on **moves, attacks and power uses per ship value**. Success: 4s, 5s and 6s are
  kept on the board rather than reconfigured away, and their power use is above a few percent of turns.
- Compare **average game length** with Community. A movement cap plus Picket will lengthen games;
  more than 30% longer probably needs a counterweight (e.g. 4 actions per turn).

---

## 6. Radical ideas: a different game, not a re-tuned one

These change what the game is about. Each one is a separate prototype; don't combine them until each
works alone.

### 6.1 Kinetic ships: you become how far you moved

**Rule.** After a ship moves, its value becomes the number of spaces it moved. A ship that moves 2
becomes a Flagship. An attack counts the steps taken to reach the space it attacked from. A ship
that doesn't move keeps its value. Reconfigure still exists.

**Why it's different.** Speed and strength stop being fixed by the dice. Every move is a choice
between getting there and arriving strong. Charging across the map leaves you weak on arrival.
Conquer sums become a positional puzzle you solve with movement, not with re-rolls. It also fixes the
"6 moves 6" problem by itself: moving 6 means arriving as a 6.

**Build.** Small: the move handler sets `d.value`; `turn.seen` already tracks values. The AI copes
through legal actions, though its scoring undervalues the new trick. Golden tests unaffected.

**Test.** Does Reconfigure usage drop? Do conquers come from movement (good) or still from re-rolls?

### 6.2 Supply lines

**Rule.** A ship is **in supply** if it is within 3 spaces of a planet with your cube, or of another
in-supply ship of yours (a chain). Out-of-supply ships can't attack and add 2 to their combat total
when defending.

**Why it's different.** The map becomes fronts and lines instead of isolated raids. Cutting a chain
matters as much as destroying a ship. Combines naturally with the Beacon Scout (§5) as a supply
depot.

**Build.** Medium: an `inSupply` query (BFS like `reach()`), read by attack legality and
`combatTotal`. UI needs a supply overlay to be playable. AI needs a supply term in its scoring.

### 6.3 Planet economy

**Rule.** Each planet with your cube produces energy each turn: 7 → 1, 8 → 1, 9 → 2, 10 → 2. Energy
buys an extra action (3), a missile (2) or a free Deploy (1). The win condition stays cubes, or
becomes "first to N energy banked".

**Why it's different.** An engine-building layer on top of a racing game. Early conquests compound,
so who conquers what and when matters, not just how many.

**Build.** Medium–large: mode-owned player state (§4 step 5), new spend actions, a UI track, an AI
valuation of energy. Possibly a new win check (§4 step 4).

### 6.4 Command dice instead of three fixed actions

**Rule.** At the start of your turn, roll 3 command dice. Each face is an action type: 1–2 Move, 3
Attack, 4 Reconfigure, 5 Research, 6 Wild. Conquer costs two of them. Spending a missile re-rolls one
command die.

**Why it's different.** Every turn becomes a small puzzle: what can I do with *these* orders? Plans
must survive bad rolls, and the dice theme reaches the turn structure itself.

**Build.** Medium: turn start rolls into `TurnState` (seeded, so online stays in sync), and every
action handler checks and spends a matching die. The AI handles it through legal actions. The UI
needs a command-dice strip.

### 6.5 Neutral raiders from the void

**Rule.** At the end of each round, a neutral raider ship appears on each void tile and moves toward
the nearest player ship, attacking when adjacent. Destroying a raider gives +1 research. Optionally a
co-op variant: players win together if they conquer every planet before the raiders destroy N ships.

**Why it's different.** A shared threat changes the social game. Players hold back from attacking
each other, and the board has its own pressure. The co-op variant is a new game entirely.

**Build.** Large: a non-player owner, automated raider behaviour at round end, invariants for a
neutral player. Raiders follow fixed rules, so online determinism holds.

### 6.6 Asymmetric factions

**Rule.** Each player picks a faction with its own ship table: different powers per value, and
sometimes a different movement curve. For example, a **swarm** faction whose 1s and 2s move 2 more,
or a **dreadnought** faction whose 6 is a slow fortress with Picket and +1 defence.

**Why it's different.** Every matchup plays differently, which gives replay value and makes balance
the main design work.

**Build.** Once §4 step 2 exists (ship table per mode), a faction is a ship table per *player* rather
than per mode: a small extension. Balance testing is the real cost: AI self-play per faction pair.

### 6.7 Fog of war

**Rule.** You see only spaces within 2 of your ships and planets; Scouts see 4.

**Why it's different.** Bluffing, scouting and ambushes, none of which exist today.

**Caution.** This breaks a core assumption of online play: every browser holds the whole game state
([MULTIPLAYER.md](MULTIPLAYER.md)). Hiding information would need commit-reveal or a trusted host. It
is realistic only for hot-seat play, or as a later, larger project.

### Which to try first

| Idea | How different | Build cost | Fits the current architecture |
|---|---|---|---|
| 6.1 Kinetic ships | High | Small | Yes |
| 6.2 Supply lines | High | Medium | Yes |
| 6.4 Command dice | High | Medium | Yes |
| 6.6 Factions | Medium–high | Medium after §4 step 2 | Yes |
| 6.3 Planet economy | High | Medium–large | Needs §4 steps 4–5 |
| 6.5 Neutral raiders | Very high | Large | Needs a neutral player |
| 6.7 Fog of war | Very high | Very large | Conflicts with online play |

**Recommendation:** start Cubic as *movement cap 3 + Picket + Beacon* (§5), which needs only §4
step 2, and prototype **Kinetic ships** in parallel as a one-file experiment. Both are cheap and test
the same question from opposite ends: what should a big ship be for?

## 7. Next steps

- [x] Rule on the movement cap: it caps the die value, before skill bonuses and powers
- [x] Add the Cubic mode with `maxMovement: 3` and a scenario test
- [x] Add Cubic to the golden and consistency tests
- [ ] Write the per-game stats script (CSV, including moves and power uses per ship value)
- [x] Refactor: ship table per mode (§4 step 2)
- [x] Prototype Picket, Shoot and Beacon; first measure of big-ship usage against Community (below)
- [ ] Prototype Kinetic ships as a separate experiment

## 8. What was built (2026-10-09)

Cubic is in the lobby: Community Edition plus the movement cap, with **Picket** (4), **Shoot** (5)
and **Beacon** (6) replacing Modify, Manoeuvre and Free Reconfigure. The 1, 2 and 3 are unchanged.
Rulings made while building it:

- **Adjacency is all 8 surrounding spaces** for Picket and Beacon. Warp Gates don't count.
- **Picket** applies to normal moves only (not Transport, Warp or the Tactical step). A ship that
  starts in a zone may leave, but stops in the next zone space it enters.
- **Shoot** (first built as Strafe, renamed and reworked the same day) attacks an enemy 1 or 2
  spaces away in a straight line, orthogonal or diagonal, from where the Interceptor stands. At 2,
  the space in between must be empty (a ship, planet or void blocks it). Its move and its shot cost **one action together, in either
  order**: shoot first (1 action) and the move is free, or move first (1 action) and the shot is
  free. A ship that shot can't also attack, and it shoots at most once a turn. The shooter never
  advances. Normal combat applies, missiles and re-rolls included.

Code: see §9. Scenarios are in [cubic.test.ts](../packages/engine/test/cubic.test.ts).

**First self-play numbers** (level 2 vs level 2, 2 players):

| | Community | Cubic |
|---|:-:|:-:|
| Turns per game (`ai:match`, 60 games) | 17.9 | 17.1 |
| Attacks (30 games) | 208 | 134 |
| 4s / 6s on the map at turn ends (30 games) | 273 / 171 | 496 / 445 |
| Enemy moves that ended in a Picket zone (30 games) | — | 20 of 534 moves |
| Shoot possible / used (15 games, range 1–2 with diagonals) | — | 63 / 15 (4 shoot-then-move) |

Games did not get longer, so the 30% threshold in §5 isn't hit. 4s and 6s now stay on the map. Picket
bites in about 4% of moves. **Shoot:** with exact range 2 in orthogonal lines it was possible twice in 15 games and never used.
At range 1–2 with diagonals the AI uses it about once a game. The AI's evaluation knows nothing of Shoot or Beacon threats yet (§4 step 7).

## 9. Working on Cubic

Cubic is a sandbox. Everything that is Cubic lives in one folder,
[packages/engine/src/cubic/](../packages/engine/src/cubic), and the rest of the engine and the UI
never name it or its powers. The folder in turn sees the engine only through one file, the prototype
kit [prototype.ts](../packages/engine/src/prototype.ts): the `ShipHooks` interface, `PrototypePower`,
turn notes, and the engine's building blocks (board, lookups, queries, core helpers, `startCombat`),
re-exported whole so a new power rarely needs to touch it.

```
cubic/
  index.ts          the mode: MAX_MOVEMENT, CUBIC_SHIPS (which ship has which power), cubicMode()
  powers/picket.ts  one file per power: its rules text (name, text, hint) and its hooks
  powers/shoot.ts
  powers/beacon.ts
```

| To change | Edit |
|---|---|
| The movement cap, the mode's name or summary, the base mode (Community) | [cubic/index.ts](../packages/engine/src/cubic/index.ts) (`MAX_MOVEMENT`, `cubicMode`) |
| Which ship has which power, ship names | `CUBIC_SHIPS` in cubic/index.ts: `5: { name: 'Interceptor', ...shoot }` |
| How a power works or its text (Shoot's range, what Picket covers…) | Its file in [cubic/powers/](../packages/engine/src/cubic/powers) |
| A new power that fits an existing hook | Copy a file in powers/, then put it on a ship in `CUBIC_SHIPS` |
| An engine helper the kit doesn't have yet | Re-export it from prototype.ts |
| A new kind of power | Add a hook to `ShipHooks` (prototype.ts) and read it in the engine (below) |

A power is a `PrototypePower`, `{ ability, hooks }`:

```ts
// cubic/powers/beacon.ts
import { cellOf, surrounding, type PrototypePower } from '../../prototype';

export const beacon: PrototypePower = {
  ability: { name: 'Beacon', text: 'You may deploy into any empty space around this ship.' },
  hooks: {
    deployTargets: (state, ship) => surrounding(state.board, cellOf(ship)!),
  },
};
```

A power that tracks something over a turn keeps it with `turnNote(state, 'shoot', ship)` /
`setTurnNote(…)`, under its own name so powers never overwrite each other's notes (Shoot's order).

### How the engine reaches it

- **One import.** `RULESETS.cubic = cubicMode(COMMUNITY)` in [rules.ts](../packages/engine/src/rules.ts)
  is the only place outside the folder that imports it.
- **Hooks, not names.** A ship in a `ShipTable` has either a built-in `power` (the official ships:
  `strike`, `transport`…) or `hooks: ShipHooks` (a prototype). The engine reads hooks through
  `hooksOf(state, die)` and never asks which power a ship has. The hooks today:

  | Hook | Read by | Used by |
  |---|---|---|
  | `stopsEnemies` | `stopZone` → `moveIndexes`, `shipReach` | Picket |
  | `deployTargets` | `deployTargets` | Beacon |
  | `freeMove`, `noAttack`, `onMove` | the `move` and `attack` handlers, legal moves; asked about every ship, as a ship may change number after using a power | Shoot |
  | `action` (`options`, `apply`) | the generic `power` action, legal actions, the UI | Shoot |

- **A generic action.** A power with an `action` hook is played as
  `{ type: 'power', die, target?, to? }`. The handler accepts exactly what `options` offers, so the
  legal actions and the engine can't disagree. The UI shows a button named after the power, highlights
  its targets (ships) or spaces, and shows `ability.hint` as the hint. No UI change is needed for a new
  action power.
- **Its own turn state.** `turn.powers` holds each power's per-ship notes for the turn, by power name
  (Shoot's order), read and written through `turnNote` / `setTurnNote`.
- **No cost when unused.** Which powers have which hook is worked out once per ship table
  (`modeHooks`), so the hooks add nothing to the official modes' move and legal-action searches.
- **Ranged combat.** `startCombat(…, ranged = true)` is a battle where the winner doesn't advance.

### What keeps the official modes safe

- The official ship tables have no hooks, and every hook is optional, so their code paths only see
  `undefined`. `stopZone` and `deployTargets` skip the search when no ship in the mode has the hook.
- cubic.test.ts checks that Basic, Original and Community use `CLASSIC_SHIPS` with no hooks and no
  movement cap, and that the 4, 5 and 6 gain no Cubic powers there. It also checks the boundary both
  ways: nothing in the engine but rules.ts imports the cubic folder, and the cubic folder imports
  nothing from the engine but prototype.ts.
- The golden replays of the three official modes must not change. If a Cubic change alters one of
  them, it has leaked. Only the Cubic snapshots may be updated (`npx vitest run golden -t cubic -u`).
- The consistency test plays Cubic games and checks that legal actions and the engine agree.

### Adding a new hook

Only when no existing hook fits. Add the optional hook to `ShipHooks` in
[prototype.ts](../packages/engine/src/prototype.ts) with a comment on what it means, read it in the one engine
function it affects through `hooksOf` (and `modeHasHook` if it is on a hot path), and add a scenario
to cubic.test.ts. Keep its name about the rule (`stopsEnemies`), not the power (`picket`), so the next
prototype can reuse it.

