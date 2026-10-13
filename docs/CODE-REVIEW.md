# Code review: errors and architectural issues

Review of the whole repository as of commit `834e949` (2026-10-12). At that commit `npm run typecheck` is clean
and all 508 tests pass, so this document lists problems the checks don't catch: latent bugs, gaps
between what the docs promise and what the code does, and structural issues that will cost more the
longer they stay.

Findings are ordered by severity. "Confirmed" means it was reproduced by running code, not only by
reading it. One finding has been accepted for now and is listed separately at the end.

**Status (2026-10-13):** every issue is fixed except three. Issue 2 waits for a decision, issue 8 was
left as it is, and issue 11 needs no change. Each section ends with its status. A second pass checked
the fixes themselves: it corrected two figures and two claims below, and added the missing tests. A
third pass reviewed the commits that made the fixes. It found holes in issues 3, 4, 5, 6, 9 and 12,
now closed and described under each one.

| # | Severity | Area | Issue | Status |
|---|---|---|---|---|
| 1 | High | CI | Deploys to GitHub Pages without running the tests | Fixed |
| 2 | High | Online | Self-reported timestamps let anyone with the link steal a seat or rewrite history | Needs a decision |
| 3 | High | Engine | Circular imports at runtime: loading a module in the wrong order crashes (confirmed) | Fixed |
| 4 | Medium | Engine | `missile` accepts actions `legalActions` never offers (confirmed) | Fixed |
| 5 | Medium | Engine / online | Actions from other browsers are not validated before handlers use them | Fixed |
| 6 | Medium | Web | An AI error hangs the game, and the app has no error boundary | Fixed |
| 7 | Medium | Web | Over-conquest displaces the wrong player's cube and never lets the player choose | Fixed |
| 8 | Low | Engine | The registry pattern stops at activated skills, which are named in several places | Left as is |
| 9 | Low | AI | Level 1 sees the real deck order; the search's position key is maintained by hand | Fixed |
| 10 | Low | Engine | `settle()` stops silently after 50 iterations | Fixed |
| 11 | Low | Engine | Unused prototype hooks and powers | No change needed |
| 12 | Low | Tests | A benchmark takes about 64 of the suite's 66 seconds | Fixed |
| 13 | Low | Docs | Docs disagree with the code in places | Fixed |

---

## 1. CI deploys without running the tests (High)

[.github/workflows/pages.yml](../.github/workflows/pages.yml) runs `npm run build` (data, typecheck, Vite
build) and `npm run mobile:shots`, then deploys. It never runs `npm test`. The golden replays, the
invariant checks, the legality cross-check and the card audit are the main safety net for an engine
whose rules change often (see the recent `picket rules` and `devious override` commits). At present
they only run when someone remembers to run them locally, while every deploy reaches players through
the service worker within one app resume.

**Change:** add a `test` job (`npm ci && npm test`) and make `deploy` depend on it. Consider moving
the slow benchmark out of the default suite first (issue 12) to keep the job fast.

**Status: fixed.** [pages.yml](../.github/workflows/pages.yml) has a `test` job, and `deploy` needs it.

## 2. Timestamps decide seats and history (High)

Two decisions in the timeline depend on `post.at`, which is the poster's own clock, sealed inside
the encrypted body and never checked:

- **Seat ownership.** `owners()` ([timeline.ts:151](../packages/online/src/timeline.ts#L151)) gives each
  open seat to the author of the *earliest* claim, sorted by `at`. Anyone holding the invite link can
  post a claim with `at: 0` at any point in the game and take over a seat that is already being played.
  The rebuild then refuses every later move by the real owner, because `seat.owner !== p.author`.
  The game rolls back to just after setup, for everyone.
- **History.** Rival chained posts are ranked by `at` ([`byRank`](../packages/online/src/timeline.ts#L62)).
  A post that names an old post as `prev` and claims an earlier time replaces the move that followed
  it, and everything after that move.

[MULTIPLAYER.md:79](MULTIPLAYER.md) says a wrong clock "only decides races (two bystanders firing at
once)". That understates it: a wrong clock, or a deliberate one, decides who owns seats and which
history is real. The doc accepts cheating among friends (anyone can read the seed), but these two cases
are different in kind. An invite link forwarded to the wrong person, or one buggy client, can wreck a
game for everyone while it is being played, and the game can't be recovered.

**Change:**
- A claim on a seat counts only if it is chained, so it names the tip it was made at: once the chain
  shows a seat as owned, later claims are ignored whatever their `at`. Alternatively, the creator
  confirms claims.
- For rival posts, rank by something no single poster controls, such as the post id (a hash), or
  accept a rival only if it arrives within a short window of the post it competes with. Never let a
  post displace one that other browsers have already followed with further moves.
- Fix the MULTIPLAYER.md row whichever way this is decided.

**Status: needs a decision.** The MULTIPLAYER.md row now describes what the code does. The options:

- **Chained claims.** A claim joins the chain like a move, so it can't be backdated before moves
  that were already played. This is the smallest change, and anyone with the link can still take an
  open seat first.
- **The creator confirms claims.** A seat is taken only once the creator's browser accepts the claim.
  This is safer, but a game waits for its creator to come online before a friend can join.
- **Ranking rival moves.** Separately, rival moves could be ranked by post id instead of the poster's
  clock, or a late rival could be refused once others have played on top of the move it competes with.

All of these change how posts replay. That is fine now, because games in progress may break.

## 3. Circular imports in the engine (High, confirmed)

The engine has runtime import cycles, not only type-only ones:

```
rules.ts → prototyping/index.ts → prototype.ts → combat.ts → core.ts → queries.ts → rules.ts
core.ts ⇄ queries.ts
```

(`npx madge --circular` reports 18 engine cycles; the web app's 3 are type-only and harmless.)

The code works only because every current entry point happens to import modules in an order where
each value is defined before it is used. [prototype.ts:79](../packages/engine/src/prototype.ts#L79)
already works around this ("rules.ts is still loading when it loads src/prototyping"). Importing the
prototyping folder first, which is what a new test or script for a power would naturally do, crashes:

```
$ vite-node -e "import './packages/engine/src/prototyping/index.ts'"
TypeError: prototypingMode is not a function   (rules.ts:126)
```

The cause is that `rules.ts` both defines what a rule set is and builds the `RULESETS` table, which
needs the prototyping mode, which needs the whole engine through the prototype kit.

**Change:**
- Split `rules.ts` in two. `ruleset.ts` holds the `RuleSet` type, `rulesOf`, `shipOf`, `hooksOf`
  and `modeHooks` and depends only on types and data. `rulesets.ts` builds the `RULESETS` table
  and imports the modes. Engine modules import `ruleset.ts`, and only `index.ts`/`setup.ts`
  import `rulesets.ts`. To break the import, `rulesOf` can look up a table that `rulesets.ts`
  registers, or the `RuleSet` can be stored by id behind a registry.
- Move the helpers that both `core.ts` and `queries.ts` need into a lower layer, so `core`
  doesn't import `queries`.
- Add `madge --circular` (or an equivalent test that ignores type-only imports) to `npm run check`,
  so a new cycle fails the build.

**Status: fixed.** `RULESETS` and `MODES` moved to a new
[rulesets.ts](../packages/engine/src/rulesets.ts), which builds the table and hands it to `rules.ts`
(`defineRuleSets`). `rules.ts` keeps `rulesOf` and imports no mode, so the cycle through the
prototyping folder is gone. The remaining cycles (`core` ⇄ `queries` and others) only call each other
inside functions, which is safe. [load-order.test.ts](../packages/engine/test/load-order.test.ts)
proves it: it loads each of the 30 engine modules first, in a fresh module graph, and plays a few moves.
On the old wiring, 14 of the 29 modules that existed then failed it. Besides the crash above,
loading `core.ts` first left `canMoveDie` undefined inside the Shoot power, because Vitest's module
runner copies `export *` re-exports at load time. A madge check was not added: the remaining cycles
are harmless, and the test guards what matters.

The rule sets are handed over through a setter (`defineRuleSets`) rather than built lazily by
`rulesOf`. A lazy table would have `rules.ts` import `rulesets.ts`, which brings the cycle back:
loading `queries.ts` first would again have the prototype kit copy its `export *` from `queries.ts`
before that module had loaded.

The setter means a module that calls `rulesOf` works only once something has imported `rulesets.ts`.
`setup.ts`, `engine.ts` (and so `legal.ts`) and now `invariants.ts` import it themselves, so each entry
point that takes a state from outside works on its own. `load-order.test.ts` checks each of them with
only its own module imported, which the first version of the test didn't: it always imported the
whole engine afterwards. `rulesOf` and `createGame` look the mode up with `Object.hasOwn`, so a `create`
post with `mode: "__proto__"` gets "Unknown mode", not a TypeError further on.

## 4. `missile` accepts actions `legalActions` never offers (Medium, confirmed)

`missileOffered` ([queries.ts:715](../packages/engine/src/queries.ts#L715)) only lets a player in the
battle fire on their *own* side, and only while that side is losing. The `missile` handler
([combat.ts:87](../packages/engine/src/combat.ts#L87)) checks only that the player has a missile and
that the roll isn't already 1. So the engine accepts a player firing on their opponent's side, or
spending a missile on a battle they are already winning.

A random-play probe over community games found 18 such actions within the first seed. Each one is
self-harm rather than an exploit, but it breaks the architecture's main promise: "a handler decides
whether an action is legal". `consistency.test.ts` doesn't catch it because its brute force only
covers the action phase. For decisions, it trusts `DECISION_CANDIDATES`, which here filters *before*
`tryApply`.

**Change:**
- Have the handler call `missileOffered` and fail otherwise.
- Extend the cross-check to decisions: for each pending kind, brute-force a wider candidate set
  (every seat, every side, every option index) and check that `apply` accepts exactly what
  `legalActions` lists.

**Status: fixed.** The handler now refuses whatever `missileRefusal` names, the reason behind
`missileOffered`, so the rule is written once: the handler's own earlier checks were removed.
`consistency.test.ts` brute-forces every
answer to every kind of decision (`DECISION_BRUTE_FORCE`, typed so a new decision needs an entry). With
the old handler it fails at once. It also found a second case: `takeCard` from the Expansion pile
accepted `store: true` and any `index`. The handler now refuses both. `DEEP=1` passes in every mode.

Every decision state is now checked, not a sample, since decisions are cheap to brute-force. The AI
games never reach four kinds of decision: Relocation, Change of Heart, Brilliant and Ruthless. So
`card-scenarios.test.ts` runs the same check (shared in
[decisions.ts](../packages/engine/test/decisions.ts)) at every decision its scenarios reach, and
`off-turn.test.ts` runs it on Brilliant. That covers all four. The shared helper also replaced a
`keyOf` in `audit.ts` and `card-scenarios.test.ts` that dropped nested fields: it treated moves to
different cells as the same action, which weakened the card audit's "AI chose an action
`legalActions()` doesn't offer" check.

## 5. Untrusted actions are not validated (Medium)

Online, `apply` runs on actions decoded from other browsers' posts. `wellFormed`
([timeline.ts:326](../packages/online/src/timeline.ts#L326)) checks only that `action.type` is a
string. The handlers then trust the rest of the shape. For example, `head[a.side]` in `missile` and
`reroll` will index any property name a peer sends, and cells, ids and indexes are used without
range checks. [MULTIPLAYER.md](MULTIPLAYER.md) §4 lists "Validate untrusted actions" as still to do.

There is a second problem in how failures are reported. `follow()` catches *every* exception as a
refusal ([timeline.ts:239](../packages/online/src/timeline.ts#L239)), so a genuine engine crash shows
up as a "rejected" desync that blames the other player. The local game, by contrast, reports it as an
engine error.

**Change:** validate the shape of an action against the `Action` union at the engine boundary (a small
hand-written schema per action type, so it stays exhaustive through the `Handlers` type). Then keep
`RuleError` refusals apart from crashes in `follow()`, and log crashes as engine bugs.

**Status: fixed.** [actionShape.ts](../packages/engine/src/actionShape.ts) checks every field of every
action type: types, and players, planets and cells in range. It is typed so that a new action or field
doesn't compile without a check. `apply` runs it before any handler, at no measurable cost to the
AI. [untrusted.test.ts](../packages/engine/test/untrusted.test.ts) fuzzes the engine. Without the
check, its first version found 82 distinct crashing actions across six action types (missile,
placeShip, deploy, takeCard, nomadic and discardSkill; for example `missile` with
`side: "__proto__"`); with it, none. The test now also builds random actions of every type from the
game's own ids, cells, planets and players mixed with garbage. That is about 55,000 attempts per run,
of which about 19,000 are well formed and reach a handler, across 50 of the 51 action types. The
handlers' own checks for a Frigate's new number and Clever's integer, now unreachable, were removed.
The first version still let a tampered cell through: the check looked only at `r` and `c`, and the
handlers copied the whole cell into the ship's location, so `to: {r, c, zone: "reserve"}` took a ship
off the board without any invariant noticing. The handlers now copy only `r` and `c` (`boardLoc`), and
the fuzz test checks that extra keys on any cell of a legal action change nothing.

In the timeline, an engine crash is now `Replay.crash`, apart from desyncs, which record the first
disagreement between browsers. It covers a crash on a post and a crash while resolving a battle, which
the first version only logged. It describes the game as it stands: if a rival post the engine takes comes
next, the game goes on and the crash is cleared. Each crash is logged once with the state, not on every
replay. The screen says "The game stopped on a move by X … a bug, not a mistake by X", or "The game
stopped resolving a battle".

## 6. An AI error hangs the game; there is no error boundary (Medium)

- [aiClient.ts](../apps/web/src/game/aiClient.ts): when the worker reports an error, `think()` retries
  on the main thread *inside the message handler*. If that retry throws too (an engine bug the AI
  hits), the exception escapes the handler and the promise never settles. Both
  [useAiDriver.ts](../apps/web/src/game/useAiDriver.ts) and `useAiSeats` in
  [useOnlineGame.ts](../apps/web/src/online/useOnlineGame.ts) wait on it with `void think(...).then(...)`
  and no rejection handling. In a local game the AI stops moving with no message. Online, the browser
  has also marked the job as `working`, so it never retries, and if it holds the tip it never hands
  over to another browser. When there is no worker, the main-thread call throws synchronously inside
  a `useEffect`.
- `chooseCombatResponse` runs synchronously inside effects in both drivers. A throw there unmounts the
  whole React tree, because [App.tsx](../apps/web/src/App.tsx) has no error boundary. Nor does `Lab` or
  `Rulebook`. Any render error, or a lazy chunk that fails to load, leaves a blank page.

ARCHITECTURE.md says "An engine crash … is shown in the UI as 'Engine error'". That holds for human
moves, but not for AI moves.

**Change:** make `think()` always settle (wrap the fallback in try/catch and resolve with an error
result), and surface AI failures through the same "Engine error" path as human moves. Add one error
boundary around each page root that shows a reload button and logs the state.

**Status: fixed.** `think()` and the new `combatResponse()` in
[aiClient.ts](../apps/web/src/game/aiClient.ts) never reject or throw. When the AI fails, they log the
error with the position, return the first legal move (or a pass in combat) so the game goes on, and
both drivers show "Engine error in the AI". [ErrorBoundary.tsx](../apps/web/src/components/ErrorBoundary.tsx)
wraps the game, the Art Lab and the rulebook (now lazy components inside it), with Reload and Back to
the lobby buttons. It shows its screen whatever value was thrown (`null` included, which the first
version took for no error), and logs the last saved position with the error. The error toast both
game hooks use is one hook, `useErrorToast`.

*Decided 2026-10-13: the AI keeps playing stand-in moves after a failure.*

Tests: [aiClient.test.ts](../apps/web/test/aiClient.test.ts) makes the AI throw and checks that
`think()` settles with the stand-in and `combatResponse()` passes.
[timeline-crash.test.ts](../packages/online/test/timeline-crash.test.ts) checks that a crash on a post
or a battle stops the game, including for an AI seat, is logged once, and is cleared by a rival post
that the engine takes. [errorBoundary.test.ts](../apps/web/test/errorBoundary.test.ts) throws falsy
values and strings at the crash screen. The crash screen and
its buttons are checked in Chrome by `npm run ui:check` ([ui-check.ts](../scripts/ui-check.ts)), which
CI runs before every deploy.

## 7. Over-conquest displaces the wrong cube, without asking (Medium)

In [controller.ts:149-154](../apps/web/src/game/controller.ts#L149-L154) a tap on a full planet picks
which opponent's cube to displace. The comment says it picks "the owner who leads (most cubes placed)".
The code sorts ascending by `-cubesLeft`, which puts the player with the *most* cubes left first,
which is the player who is behind. Take a leader with 2 cubes left and a trailing player with 5:
the keys are −2 and −5, so −5 sorts first and the trailing player's cube is displaced.

Separately, the engine offers one `conquer` action per opponent (`replace`), and the rule lets the
conqueror choose, but the UI never shows the choice. On a planet that still has room, the tap always
takes the plain conquest. Over-conquest is therefore impossible there from the UI, even though
[legal.ts:202-204](../packages/engine/src/legal.ts#L202-L204) offers it as a choice.

**Change:** fix the sort direction for now. Better: when there is more than one option, open a small
picker (the same pattern as relocation's "tap again for the next owner"), and add a test in
`highlights.test.ts` or a new controller test.

**Status: fixed.** A planet with one way to conquer it is conquered on a tap. One with several opens
"Conquer planet N" (`ConquerChoice` in [Overlays.tsx](../apps/web/src/components/Overlays.tsx)), with
"Take an empty place" and one "Displace X's cube" button per opponent. What a tap does is
`conquerTap()` in [legal.ts](../apps/web/src/game/legal.ts), covered by
[conquerTap.test.ts](../apps/web/test/conquerTap.test.ts). `npm run ui:check` (run in CI) checks the
dialog in Chrome, on a full planet with two opponents' cubes: the chosen opponent's cube goes, and
the conqueror's comes in.

## 8. Activated skills are named in several places (Low, architectural)

ARCHITECTURE.md says "rules never name a skill" and that `SKILL_RULES` defines each skill in one place.
That holds for passive skills, which are hooks. Activated skills are still spread out:

- [legal.ts:150-207](../packages/engine/src/legal.ts#L150-L207) checks `hasSkill(s, me, 'tactical')`,
  `'flexible'`, `'resourceful'`, `'nomadic'`, `'composed'`, `'ambitious'` and `'tyrannical-original'`,
  each with its own once-per-turn and cost logic. That logic repeats what the handler checks.
- [skillActions.ts](../packages/engine/src/skillActions.ts) names them again.
- Adding one means editing `Action`, `skillActions.ts`, `actionPhaseOptions`, `bruteForce` in the
  consistency test, and the UI controller. The compiler only enforces the first two.

The same duplication is why issue 4 could happen: availability is written twice, once for listing
and once for applying.

**Change:** give `SkillRule` an `activated: { options(s, player): Action[]; apply(s, action) }` entry,
like `ShipHooks.action` for prototype powers, and have `legal.ts` and the handlers read it. The
prototype `power` action already shows the pattern: options computed once, and `apply` accepts only
an offered option. Related: [queries.ts](../packages/engine/src/queries.ts) has grown to 794 lines of
unrelated questions (movement, conquest, combat, cards, skills). Splitting it by topic would make the
dependency graph in issue 3 easier to untangle.

**Status: left as is.** The level-1 AI breaks ties by the order in which `legalActions` lists
actions, so a registry must list them in exactly today's order. Otherwise the golden replays for
Basic, Classic and Community change, which [PROTOTYPING.md](PROTOTYPING.md) rules out. That can be
done, but it's fiddly, for a gain in maintainability only. The concrete risk, a handler and
`legalActions` disagreeing, is now caught by the decision cross-check (issue 4).

## 9. The AI's view of hidden information (Low)

- The [AI README](../packages/ai/src/index.ts) says no level sees "the order of the decks". The search
  levels (2–5) shuffle unseen cards (`hideUnknowns`), but level 1 only replaces the RNG seed
  ([greedy.ts:135](../packages/ai/src/greedy.ts#L135)) and evaluates the real deck order. The effect
  on play is small, but the claim is untrue. Fixing it will change the golden snapshots, which
  replay level 1.
- `signature()` ([search.ts:351](../packages/ai/src/search.ts#L351)), the transposition-table key, is a
  hand-picked list of state fields. It already leaves out `turn.powers` (the prototype power notes),
  `turn.bonus` and the market. Today no power writes notes, so nothing goes wrong yet. The first
  power that uses `turnNote` will make the search merge positions that differ, and nothing will warn.
  Either derive the key from the whole state minus known-irrelevant fields, or add a test that two
  states differing in any `TurnState` field get different keys.

**Status: fixed.** `signature()` now takes the turn and the players whole (less the players' fixed
fields: id, name, colour and AI settings), plus the face-up market and the deck sizes. Nothing can be
left out by mistake, and level-4 decisions are not slower. Level 1 now plays on a shuffle of the
unseen cards, like the other levels ([hidden.ts](../packages/ai/src/hidden.ts)). Its shuffle has a
generator of its own, seeded from the position, so the AI's random stream is untouched. The golden
replays are unchanged, which contradicts an earlier claim here that they would change. That claim was
an untested guess; this was tested. Level 1's missile decision (`chooseMissile`) now plays on the same
hidden position: it used to simulate the rest of the battle with the game's real RNG and decks. Only
the two decks are copied for it, not the whole state.

## 10. `settle()` gives up silently (Low)

[turn.ts:178](../packages/engine/src/turn.ts#L178) loops at most 50 times and then returns, leaving
whatever state it reached. If a future auto-resolve and turn-start interaction ever loops, the game
quietly stalls in an odd state instead of failing. Throw an `Error` when the guard runs out, so it
surfaces as an engine error with the state attached.

**Status: fixed.**

## 11. Unused prototype hooks and powers (Low)

`ShipHooks.freeMove`, `noAttack` and `onMove` have no implementation in any mode, yet `move`,
`attack` and `actionPhaseOptions` call `modeHooks` for them on every move.
[beacon.ts](../packages/engine/src/prototyping/powers/beacon.ts) is imported nowhere. These are
cheap but speculative. Either keep them on purpose (note in PROTOTYPING.md that they are kept as
templates and covered by a test), or remove them until a power needs them. The comment in
`prototype.ts` about hooks "asked about every ship" describes behaviour nothing exercises.

**Status: no change needed.** This finding missed that [PROTOTYPING.md](PROTOTYPING.md) already lists
Beacon as a candidate power with a source file but no ship, and documents each hook in its hook table.
They are kept on purpose.

## 12. A benchmark sits in the unit suite (Low)

[powerUsage.test.ts](../packages/engine/test/powerUsage.test.ts) plays 16 level-4 AI games and prints
tables. Its assertions only check the measurement itself. It takes about 64 of the suite's 66 seconds.
Move it behind an env flag, as `test:deep` does, or into `npm run power:usage` only. That makes
`npm test` fast enough to run on every change and in CI (issue 1).

**Status: fixed.** By default it now plays one level-2 game per mode, so the measurement code stays
tested. The suite takes 18 s instead of 66 s. The numbers worth reading still come from
`POWER_USAGE_GAMES=4 POWER_USAGE_LEVEL=4` or `npm run power:usage`. Level 2 never plays a Flagship
transport, so one level-4 Basic game (about 2 s) checks that transports are counted.

## 13. Docs disagree with the code (Low)

- [MULTIPLAYER.md](MULTIPLAYER.md) §4 still lists `mayAct` as a to-do. It exists in
  [engine.ts:101](../packages/engine/src/engine.ts#L101) and the timeline uses it.
- MULTIPLAYER.md:79 on clocks (issue 2), ARCHITECTURE.md on engine errors (issue 6), and the AI
  README on deck order (issue 9) all promise more than the code does.

**Status: fixed.** The AI docs' claim about deck order is now true at every level (issue 9). The
MULTIPLAYER.md checklist marks `mayAct` and action validation as built, and its clock row says what a
backdated post can do. ARCHITECTURE.md describes the new modules and tests, the extra steps for adding an action or
a decision, and how engine errors now surface. PROTOTYPING.md points at `rulesets.ts`.

---

## Accepted for now: rule changes break online games in progress

*Decided 2026-10-12: the app is still in transition, so a deploy may break online games in progress.*

An online game is a log of moves that every browser replays with its own copy of the engine, and
nothing records which rules the game was started with. Neither `PROTOCOL`
([protocol.ts:8](../packages/online/src/protocol.ts#L8)) nor `GameState.version` has ever been bumped,
and the `create` post carries no engine version. After a deploy that changes a rule, the new build
replays old moves under the new rules. The game stops at the first move that is now refused, and
anything after it disappears.

What players will see when this happens: the game shows a "rejected" desync naming another player,
which suggests that player did something wrong. If that confuses testers, a cheap step short of real
versioning is to put the build id in the `create` post and show "this game was made with an older
version of Cubic" instead.

The local saved game ([savedGame.ts](../apps/web/src/game/savedGame.ts)) has the same trade-off. It
loads any save that has `version === 1` and passes `checkInvariants`, even if an older engine wrote it.

Revisit this when online play is meant to last across deploys. At that point, add a rules version that
is recorded in each game, and refuse to replay a game this build can't play.

---

## What is in good shape

These parts are working well and are worth keeping as they are:

- The engine's core design: a pure `apply`, a seeded RNG in the state, the compiler-checked
  `Handlers` and `DECISION_CANDIDATES` registries, `checkInvariants`, and golden replays.
- `RuleSet` as the only place modes differ, and the prototype kit as a boundary that tests check.
- Defensive storage handling in the web app ([storage.ts](../apps/web/src/storage.ts)): nothing throws,
  and space is reclaimed when the quota is full.
- Test depth on the rules: a scenario per card, a citation per Basic rule, and the card audit.

## Still open

Issue 2: choose how seats are claimed and rival moves ranked, before invite links are shared beyond
people you trust.
