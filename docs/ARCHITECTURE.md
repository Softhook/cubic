# Architecture

How the code is organised, and where to make the common changes.

## Packages

| Package | Role | Depends on |
|---|---|---|
| [`packages/engine`](../packages/engine) | The rules. A game is `apply(state, action) → state`: pure, deterministic (seeded RNG in the state), serialisable. | — |
| [`packages/ai`](../packages/ai) | AI players in four levels ([AI.md](AI.md)). Chooses among `legalActions(state)`; never sees the real RNG or deck order. | engine |
| [`packages/art`](../packages/art) | Artwork as SVG text: tiles, planets, starfields ([GRAPHICS.md](GRAPHICS.md)). Plain functions, seeded, in mm; shared by the game and print. | — |
| [`apps/web`](../apps/web) | React UI. Renders a state, sends actions. Holds no rules of its own: buttons and highlights come from `legalActions` ([`game/legal.ts`](../apps/web/src/game/legal.ts)). The Art Lab is at `#lab` (tiles) and `#lab/cards`; the printable rulebook at `#rulebook`. | engine, ai, art |
| [`data/`](../data) | Cards and maps as YAML, compiled to JSON by `npm run data`. | — |

## Engine modules

| File | Contents |
|---|---|
| `engine.ts` | Public API (`apply`, `tryApply`, `actor`) and the handler registry |
| `rules.ts` | `RuleSet`: everything that differs between Basic, Original and Community |
| `setup.ts` | `createGame` and the setup decisions |
| `actions.ts` | Move/Attack, Deploy, Reconfigure, Research, Conquer, end turn |
| `abilities.ts` | Ship abilities 1–6 |
| `combat.ts` | Attacks, missiles, advancing, Infamy |
| `cards.ts` | Card market, Tactic effects, card decisions |
| `effects.ts` | The implemented Skill and Tactic effects, as types |
| `skillRules.ts` | What every skill does: one entry of hooks per skill (`SKILL_RULES`) |
| `skillActions.ts` | Skills used as an action of their own |
| `turn.ts` | Start/end of turn; `settle()` auto-resolves decisions after each action |
| `legal.ts` | `legalActions()` |
| `queries.ts` | Read-only questions: movement, conquer check, combat totals… |
| `lookups.ts` | Where dice are, what is on a space; no rules |
| `core.ts` | Shared helpers: errors, log, dice, dominance/research, cubes |
| `invariants.ts` | `checkInvariants()`: consistency checks every state must pass |
| `board.ts`, `mapStats.ts`, `data.ts`, `rng.ts`, `types.ts`, `undo.ts` | Board geometry, map stats, card/map data, RNG, types, undo policy |

Two ideas hold it together:

- **Actions and decisions.** A player acts by sending an `Action`. When the rules need someone to
  choose (combat, Infamy, picking a card…), a `Pending` decision is queued in `state.pending`; the
  head of the queue must be answered before anything else. The UI and the AI use the same mechanism.
- **Exhaustive registries.** `Handlers` (engine.ts) maps every `Action` type to one handler;
  `DECISION_CANDIDATES` (legal.ts) maps every `Pending` kind to its possible answers. Both are typed so
  that adding an action or a decision without handling it is a compile error. Skill effects, Tactic
  effects and once-per-turn tags are union types too, so a misspelt name doesn't compile, and
  `SKILL_RULES` must have an entry for every skill effect.
- **One source of truth for "may I?".** A handler decides whether an action is legal. `legalActions`
  lists the same actions for the AI and the UI; `consistency.test.ts` checks that the two agree in both
  directions. The UI never re-checks a rule, it asks `legalActions`.

## Finding bugs

- `checkInvariants(state)` lists everything wrong with a state: cube totals, every card in exactly one
  place, dice and board occupancy, track ranges, well-formed decisions. Tests run it after every action
  of full games; the web app runs it after every action in development and logs a violation to the
  console with the action and the prior state (load it back with `window.__quantum.load(JSON.parse(…))`).
- An engine crash (anything but a `RuleError`) is shown in the UI as "Engine error" and logged the same
  way; the AI no longer swallows them.
- `npm run test:deep` runs the legal-action cross-check exhaustively over more games (minutes).

## How to…

**Add an action.** Add it to `Action` in `types.ts`, then add its handler to the module it belongs to
(the compiler will point you there). Add it to `actionPhaseOptions` in `legal.ts` so the AI and the UI
can use it, and to `bruteForce` in `consistency.test.ts` so the cross-check covers it.

**Add a decision.** Add it to `Pending`, push it where the rule triggers, handle its answer action,
and add its candidates to `DECISION_CANDIDATES`. If it can have no legal answer, add an
`AUTO_RESOLVE` entry in `turn.ts`.

**Add a Tactic.** Add the card to `data/cards.yaml`, its effect to `TACTIC_EFFECT_IDS` in `effects.ts`,
then its implementation to `TACTIC_EFFECTS` in `cards.ts` (the compiler asks for it). It joins the deck
automatically, and `data.test.ts` drops it from the not-yet-implemented list.

**Add a Skill.** Add the card to `data/cards.yaml` and its effect to `SKILL_EFFECTS` in `effects.ts`;
the compiler then asks for its entry in `SKILL_RULES` (`skillRules.ts`). An entry is a set of hooks the
rules read — `movement`, `conquer.sums`, `combat.modifier`, `startOfTurn`, `onDestroy`… — so a skill
is defined in one place. If no hook fits, add one to `SkillRule` and read it where the rule lives
(via `skillRules(state, player)`; rules never name a skill). A skill that is an action of its own
sets `activated` and gets a handler in `skillActions.ts`.

**Add a rule set** (e.g. our own edition). Add a `GameMode` and an entry in `RULESETS` (`rules.ts`). If
the new rule set changes a rule rather than a parameter, add a field to `RuleSet` and read it where the
rule lives. Don't compare `state.mode` to a name anywhere else.

**Add a map.** Add it to `data/maps.yaml` with its published stats (or `mapStats()`'s, if none are published); [`maps.test.ts`](../packages/engine/test/maps.test.ts) recomputes the stats
from the layout and fails if they disagree. Official layouts are in
[`reference/bga/maps.json`](../reference/bga/maps.json).

## Tests

| Test | Guards |
|---|---|
| [`basic.test.ts`](../packages/engine/test/basic.test.ts) | Every official rule in Basic mode, one scenario each, citing its source |
| [`engine.test.ts`](../packages/engine/test/engine.test.ts) | Card effects, modes, missiles, undo |
| [`consistency.test.ts`](../packages/engine/test/consistency.test.ts) | `legalActions` and `apply` agree (every offered action is accepted; brute force: every accepted action is offered); invariants after every action |
| [`data.test.ts`](../packages/engine/test/data.test.ts) | Card ids unique; every card effect implemented or on the known-missing list |
| [`golden.test.ts`](../packages/engine/test/golden.test.ts) | Exact replay of seeded AI-vs-AI games in every mode, with invariants checked after every action. Fails on *any* behaviour change. After an intended change, review and run `npx vitest run -u`. |
| [`maps.test.ts`](../packages/engine/test/maps.test.ts) | Map stats match layouts |
| [`original-cards.test.ts`](../packages/engine/test/original-cards.test.ts) | Original cards that open decisions of their own (combat re-rolls, Dangerous, Clever, Nomadic, Relocation) |
| [`original-commands.test.ts`](../packages/engine/test/original-commands.test.ts) | Original Command and Gambit cards that hook into existing rules, citing the 2013 FAQ |
| [`off-turn.test.ts`](../packages/engine/test/off-turn.test.ts) | Cards taken on someone else's turn (skills, Plan Ahead, Momentum); Warp Gate, Change of Heart and Ambitious edge cases; when CE Brilliant asks |

Shared helpers (`quickStart`, `playAiGame`…) are in [`test/helpers.ts`](../packages/engine/test/helpers.ts). `npm run check` typechecks
everything (tests included) and runs the tests.
