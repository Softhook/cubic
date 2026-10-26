# Splitting Regolith from Cubic

Two games come out of this repository:

- **Regolith**, a fully standalone game in its own repository (`~/Documents/GitHub/regolith`, remote
  `github.com/Softhook/regolith`, empty for now), deployed to `softhook.github.io/regolith`. It shares nothing
  with Cubic at runtime or build time and has no Quantum modes: only its own two, **Basic** (no cards, for
  learning) and **Regolith** (the full game).
- **Cubic**, this repository, which keeps **Basic, Classic and Community** and nothing of Regolith. It is
  called Cubic throughout, in place of the `quantum` names it carries today.

The rules of Regolith stay in [PROTOTYPING.md](PROTOTYPING.md) and its cards and look in
[REGOLITH.md](REGOLITH.md). Both move with it.

## Decided (2026-10-26)

| | |
|---|---|
| Regolith | Its own repo, app, packages, docs and history. Two modes: **Basic**, Regolith's rules without cards, for learning; **Regolith**, the full game with its deck. |
| Cubic | This repo. Basic, Classic and Community only. Renamed from `quantum` to `cubic` in packages, storage and the dev hooks. |
| How Regolith starts | A **copy of Cubic's `main` with its history**, taken before Regolith is removed here, so `git blame` on its rules and rulings still works. Cubic is tagged `regolith-split` at that point. |
| Old games | Saved and online Regolith games from Cubic aren't carried over (no users; online games are disposable). |
| Credit | Regolith's rules come from Quantum's, so its lobby and manual still credit Quantum (Eric Zimmerman) and the Community Edition. |

## What makes it cheap

[REGOLITH.md §1](REGOLITH.md#1-the-rename) kept Regolith apart. The engine reaches it only through
`RULESETS.regolith` ([rulesets.ts](../../packages/engine/src/rulesets.ts)). Its folder
([packages/engine/src/regolith/](../../packages/engine/src/regolith)) uses the engine only through the
prototype kit ([prototype.ts](../../packages/engine/src/prototype.ts)). The rest of the code asks the rule set
(`contestedOrbit`, `words`, `look`, …), and `regolith.test.ts` checks it. Removing a mode means deleting
its rule set and following the type errors.

### Prepared already

The app's identity is now set in one place each, so each repo changes one line:

| What | Where | Cubic | Regolith |
|---|---|---|---|
| Browser storage: every localStorage key and the IndexedDB name | `APP_ID` in [apps/web/src/appId.ts](../../apps/web/src/appId.ts) | `quantum` → `cubic` | `regolith` |
| Online namespace: relay tags and game keys are derived under it | `NAMESPACE` in [packages/online/src/codec.ts](../../packages/online/src/codec.ts) | `cubic` | `regolith` |
| The lobby's first mode | `DEFAULT_MODE` in [rulesets.ts](../../packages/engine/src/rulesets.ts) | `community` | `regolith` |

Both apps are served from `softhook.github.io`, **one origin**, so with the same storage names they would
read each other's saved game, lobby choices and online identity. Each service worker's scope is its own
path, so the offline caches don't collide (check with `npm run pwa:check` after the first deploy of each).

## The order

Regolith has to be copied out before Cubic deletes it:

1. **Seed Regolith** (Phase 1), from Cubic as it is now.
2. **Regolith on its own** (Phases 2–3), in the Regolith repo, until it deploys.
3. **Cubic without Regolith** (Phases 4–5), in this repo. It can start as soon as Phase 1 is done.

## Phase 1: seed the Regolith repo

1. In Cubic: commit, `git tag regolith-split`, push the tag.
2. In `~/Documents/GitHub/regolith`: `git pull ../cubic main`, then `git push -u origin main`.
3. `npm install && npm run check` there must pass before anything is deleted, so there's a known-good start.

## Phase 2: Regolith's identity

One commit, no rule changes:

- `APP_ID = 'regolith'`, `NAMESPACE = 'regolith'`, `DEFAULT_MODE = 'regolith'`.
- Packages `@quantum/*` → `@regolith/*` (every `package.json`, every import), root package `name`, the dev
  hook `window.__quantum` → `window.__regolith` (scripts use it too).
- [index.html](../../apps/web/index.html) `<title>`, [manifest.webmanifest](../../apps/web/public/manifest.webmanifest)
  name, colours (the ground palette, not `#050813`), icons and favicon from the mood board, the lobby's credit
  line, `cubic-manual.html` → `regolith-manual.html`.
- README for Regolith. Keep the Develop section's commands.
- Enable Pages on the repo. The Pages workflow carries over as is, its `layout` and `pwa` jobs included.

## Phase 3: Regolith sheds Quantum

Regolith's two modes become the engine's only rule sets. One commit per step, `npm run check` green at each:

1. **Two rule sets.** Delete Quantum's `basic`, `original` and `community`. Inline `regolithMode(COMMUNITY)`
   into a plain `RuleSet`, `regolith`, and make Regolith's own `basic` from it with `cards: null`: the same mechs,
   powers, zones of control, contested orbits and hex maps, without research, the market or a starting skill.
   It is today's `REGOLITH_CARDS = false`, as a mode in the lobby rather than a switch, so the switch goes.
   `GameMode = 'basic' | 'regolith'`, `MODES = [basic, regolith]` (Basic first, as a learning mode),
   `DEFAULT_MODE = 'regolith'`. The lobby's mode menu stays, with two entries. Delete the tests that pin
   Quantum's modes, and give Basic its own golden games.
2. **Cards.** `data/cards.yaml`, the Original and Community decks, the holo card renderer
   (`packages/art/src/card.ts`, `scenes/`) and the Redesigns view go. Regolith's cards keep their `effect` ids
   (they are its rules now). `from` stays as a note of where a card started, but
   [build-data.mjs](../../scripts/build-data.mjs) stops checking it against Community's deck. The `*-original`
   effects, `ingenious`, `refresh` and every `CardRules` switch Regolith doesn't use go.
3. **Maps.** Keep the `hex`, `open` and `drift` groups. Drop the square maps, `drift-square` and the BGA and
   CE groups.
4. **Switches become rules.** `contestedOrbit`, `contestedDeploy`, `homeShipyard`, `maxMovement`,
   `startingMissiles`, `reconfigure: 'unseen'`, `look: 'ground'`, `cards.look`: always on, so the "off" branches
   go. `REGOLITH_OVER_CONQUEST` stays as a switch while PROTOTYPING.md still tries it. Switches that differ
   between Basic and Regolith (`cards`, maybe `startingMissiles`) stay on the `RuleSet`.
5. **No boundary.** The prototype kit and `regolith.test.ts`'s import checks only kept Regolith away from
   Quantum. Fold `src/regolith/` into the engine (`powers/` stays, one file a power), keep `ShipHooks` as the
   way powers plug in.
6. **Words at the source.** Write the log, rule errors and card text in Regolith's words ("mech",
   "objective", "control"), then drop `REGOLITH_WORDS`, `reword` and `useSay`. Code identifiers (`Die`, `ship`,
   `planet`) can stay; renaming them is last, and only if wanted.
7. **Square grid (optional).** Regolith is hex only, so the square paths in `board.ts`, the art and the web
   board can go when they get in the way.
8. **Docs.** Keep PROTOTYPING.md, REGOLITH.md, REGOLITH-WORLD.md, the mood board, HEX.md, AI.md,
   MULTIPLAYER.md, MOBILE.md, GRAPHICS.md and ARCHITECTURE.md, edited to Regolith. Drop RULES.md's Quantum
   modes, OPEN-QUESTIONS.md's rulings for cards that are gone, card-benchmark.md and RULE-SUGGESTIONS.md.
   Write a Regolith rulebook and player aid (REGOLITH.md §9 step 6).

## Phase 4: Cubic without Regolith

In this repo, once Phase 1 is pushed. Everything Regolith brought goes, not just the mode, so the engine
is back to the three modes' rules. One commit per row group, `npm run check` green each time, and **the golden
games for Basic, Classic and Community unchanged**, which proves Cubic still plays as before.

| Area | Goes |
|---|---|
| Mode | `src/regolith/`, `RULESETS.regolith`, `'regolith'` in `GameMode`, `data/regolith.yaml` and its `build-data.mjs` step, `regolith.test.ts` and the Regolith cases in other tests |
| Ship powers | `prototype.ts`, `ShipHooks`, `hooksOf`, `modeHasHook`, the `power` action, zones of control (`stopZone`); `ShipDef.hooks` |
| Engine state | `GameState.barriers`, `addBarrier`, `barrierAt`, `barrierSpaces`, the `placeBarrier` and `kineticShunt` pendings and actions, their invariants; `homeShipyard` on players |
| Rule switches | `maxMovement`, `overConquest`, `contestedOrbit`, `contestedDeploy`, `homeShipyard`, `words`, `look: 'ground'`, `cards.look`, `cards.expansion`, `experimental` |
| Card effects | `barrier`, `kinetic-shunt`, `sabotage-double`, `science`; `CardDef` fields `from`, `status`, `brief`; `addCards` for a mode's own decks |
| Words | `words.ts`, `reword`, `say` / `useSay`: Cubic speaks Quantum's words only |
| AI | barrier and `threatens` terms in `evaluate.ts`, `greedy.ts`, `search.ts`, `candidates.ts`; Regolith's entries in `cardValues.ts` |
| Art | `packages/art/src/screenprint/`. The hex ground tiles **stay** (Cubic's hex maps are drawn on them): rename `art/src/regolith/` to `ground/` and `REGOLITH_*` to `GROUND_*` |
| Web | `BarrierBubble`, the zone-of-control tint, power and shunt controls, the `ground` screen palette in styles.css, the mode's decks in `art/cards.ts` and the Card Lab's Regolith edition |
| Scripts | `regolith-card-picks.*`, `power-ab`, `stall-probe`, `power-usage`, `interaction` |
| Docs | `docs/regolith/`, `docs/moodboards/regolith/` (in the Regolith repo now); the README and ARCHITECTURE.md lose their Regolith lines and gain one pointing to the Regolith repo |

Start with the mode and data, then follow the type errors and knip's unused-export report until both are clean.

## Phase 5: Cubic is called Cubic

One commit, no rule changes:

- Packages `@quantum/*` → `@cubic/*`, root package `"name": "quantum"` → `"cubic"`.
- `APP_ID = 'cubic'` (storage keys `cubic.*`, IndexedDB `cubic-art`). Saved games under `quantum.*` are dropped:
  there are no users.
- The dev hook `window.__quantum` → `window.__cubic`, in the app and the scripts; `QuantumHook` → `CubicHook`.
- The README stops saying "working title". The lobby and manual already say Cubic.
- "Quantum" stays where it names the original game: the credits, the rulebook, `Quantum Entanglement`.

## Open decisions

- **Missiles in Regolith's Basic:** Quantum's Basic has none (they came with the Community Edition). Leave
  them out to keep the learning game smallest, or keep them so Basic plays exactly like Regolith minus the
  cards. Leaning: keep them, so what a player learns carries over unchanged.
- **AI on Basic:** the AI plays every card-free mode, but its levels haven't been measured on Regolith
  without cards; check them with `npm run ai:match` before the first deploy.

## Afterwards

- The Card Picks page and the mood board canvas sync with the Regolith repo, not Cubic.
- This file moves to the Regolith repo as its history. Cubic keeps only the README's pointer.
