# Roadmap & Backlog

Goal: a high-quality, playable **online version of Quantum (Community Edition) with an
AI opponent**, followed by a **design system that produces our own print-quality
cards, tiles and boards**.

The order matters: the online game comes first, but everything is driven from the
same data ([`data/cards.yaml`](../data/cards.yaml), [`data/maps.yaml`](../data/maps.yaml)),
so the card/tile pipeline later reuses it rather than duplicating it.

```
 M0 Foundations ─► M1 Rules engine ─► M2 Local play ─► M3 AI opponent ─► M4 Online multiplayer
                         │                                   │
                         └──────────────► M5 Balance lab (AI self-play) ◄┘
 M6 Design system (cards / tiles / boards / print) — can start in parallel after M0
```

---

## M0 — Foundations

- [ ] **Decide the ruleset baseline** — print edition (current proposal) vs stolksdorf CE. Record in [RULES.md](RULES.md).
- [ ] **Work through 🔴 items in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)** — these block the engine.
- [x] **Get the original 2013 rulebook** — mirrored in `reference/original-2013/`; Basic mode audited against it.
- [ ] **Name & IP check** — "Quantum" is the publisher's title; game mechanics aren't copyrightable but names, art and trade dress are. Pick a working title for anything public, and don't reuse original or found art.
- [ ] **Contact stolksdorf and WaterGoesRed** — credit, permission to build on their text/maps, interest in collaborating.
- [ ] **Choose a license** for our code (e.g. MIT) and content (e.g. CC BY-NC-SA).
- [ ] **Tech stack decision** (proposal below).
- [x] Set up the monorepo (npm workspaces), typecheck and tests.
- [ ] CI, a GitHub remote, and this backlog as issues.

### Proposed stack

| Layer | Proposal | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One rules engine shared by client, server and AI |
| Rules engine | Plain TS package, **no framework**: pure `(state, action) → state + events`, seeded RNG | Deterministic, replayable, testable, fast enough for AI search |
| Client | React + Vite, board rendered in **SVG** (Canvas/Pixi only if needed for animation) | SVG is crisp, styleable, and the same art pipeline as print |
| Server | Node + WebSockets (Colyseus, PartyKit, or a small custom server) | Authoritative state; hidden info (deck order) stays server-side |
| Persistence | Postgres (or SQLite to start) storing game seed + action log | A game is fully reconstructable from its log |
| AI | Runs on the engine in a Web Worker (client) or worker thread (server) | Doesn't block UI |

*Alternative considered:* boardgame.io gives multiplayer + MCTS bots for free, but
it's lightly maintained and its move model fits Quantum's interrupts (missiles,
Dangerous) awkwardly. Keeping our engine framework-agnostic lets us adopt it later
if wanted.

---

## M1 — Rules engine

Package: `packages/engine`

- [x] **Data loading** — typed loaders + validation for `cards.yaml` and `maps.yaml`.
- [x] **Board model** — tiles → grid of spaces; planets, void, gaps; adjacency (orthogonal / surrounding / Warp Gate links).
- [x] **Game state** — players (dice with ids, dominance, research, skills, missiles, reserve, scrapyard), cubes on planets, decks, face-up rows, turn/phase, per-die per-turn flags.
- [x] **Seeded RNG** — all dice and shuffles through one RNG in the state.
- [x] **Setup** — map, decks, starting skill draft, fleet roll + one re-roll, first player, deployment.
- [x] **Actions** — Move/Attack (pathfinding), Deploy, Reconfigure, Research, Conquer (sum check, capacity).
- [x] **Combat** — attack/defence roll pipeline (see open question #10), repel/destroy, dominance, scrapyard re-roll.
- [x] **Ship abilities** — all six, with once-per-die tracking.
- [x] **Infamy, Quantum Entanglement, Void research, win check.**
- [x] **Phase 2** — conqueror/researcher cards, card protocol, slide & refill, Peek.
- [x] **Decisions / interrupts** — model "pending decision" states (choose card, missile window, Dangerous prompt, Prideful steal, discard-down-to-limit) so UI and AI use the same mechanism.
- [x] **Game modes** — Basic (no cards), Original (2013), Community Edition.
- [x] **Original cards** — all 31 Command and 6 Gambit cards.
- [ ] **Skills** — *27 of 35 done; remaining: Calculating, Clever, Curious, Devious, Patient, Prideful, Profiteering, Ruthless.* Implement all 35 via a hook/trigger system (start of turn, on destroy, on combat roll, on conquer check, on scrapyard, movement modifiers, action-count modifiers).
- [x] **Tactics** — all 9; Expansion.
- [x] **Legal action generator** — `legalActions(state)`; required by the UI (highlighting) and AI.
- [ ] **Event log + replay** — *a text log exists; structured events + replay viewer still to do.* — every state change emits events; replaying seed + actions reproduces the game.
- [ ] **Tests** — *basic movement/conquer/combat tests and AI-vs-AI fuzz games exist; per-card scenario tests still to do.* a scenario test per rule and per card; property tests (random legal play never crashes, invariants hold: dice count = 7, cubes ≤ capacity, tracks in 1–6).
- [x] **Map stat check** — `mapStats()` recomputes slack/shared from layouts; `maps.test.ts` checks every map.

## M2 — Local play (hot-seat)

Package: `apps/web`

- [x] Board renderer (SVG): tiles, planets with cube slots, dice as ships with clear type icons, void, gates.
- [x] Player panel: dominance/research tracks, skills, missiles, scrapyard, reserve.
- [x] Card rows (Skill / Tactic / Expansion) with Peek interaction.
- [x] Action UX: click ship → highlight legal moves/attacks; conquer button lights up when a sum matches.
- [x] Combat UX: dice roll animation, missile window, result.
- [ ] Rules help in-context (hover a card or ship for its rule; link to RULES.md sections).
- [x] Turn log panel; undo of deterministic moves within a turn (never past a roll, battle or card).
- [x] Map picker with stats; player count 2–4. All 70 official, add-on and BGA maps *(the CE booklet's fan and 5-player maps not yet)*.
- [ ] Mobile-friendly layout — options and plan in [MOBILE.md](MOBILE.md).

## M3 — AI opponent

Package: `packages/ai`

- [x] **Level 0 — Random legal**: baseline + fuzzing the engine.
- [x] **Difficulty levels** — four levels, picked per seat in the lobby; see [AI.md](AI.md).
  - [x] **1 Cadet** — greedy one-action heuristic (the original AI).
  - [x] **2 Captain** — exact odds for re-rolls and combat; evaluation with whose turn is next, path-based reach and threats.
  - [x] **3 Commodore** — expectimax over the whole turn, with an evaluation budget.
  - [x] **4 Admiral** — wider turn search, Flagship transports, best plans checked against the opponent's reply.
- [x] AI runs in a Web Worker; `npm run ai:match` benchmarks levels by self-play.
- [x] Card-pick policy (which Skill/Tactic to take) and missile/Dangerous reaction policy.
- [ ] **Tune the evaluation by self-play** (weights are hand-set) and rate cards individually.
- [ ] **Search across turns**: Monte Carlo Tree Search with chance nodes for dice and *determinization* (ISMCTS) for hidden deck order. Time-boxed per move.
- [ ] "Explain move" — AI shows why it did something (from the heuristic terms).
- [ ] *Optional:* LLM-driven persona (taunts, commentary, post-game review) layered on top of the search AI — not used for move selection.

## M4 — Online multiplayer

Options and plan: [MULTIPLAYER.md](MULTIPLAYER.md).

- [x] Serverless play between friends: a shared move log on public Nostr relays, replayed by every browser ([MULTIPLAYER.md §0](MULTIPLAYER.md#0-whats-built-a-shared-move-log-on-public-relays)).
- [x] Lobbies: create/join by link, seat AI players, choose map.
- [x] Real-time and asynchronous play (no notifications yet).
- [x] Missile response window (open question #21): each player who may respond is asked, with a per-player *ask* setting; no timers.
- [ ] Fair dice and hidden decks: needs a trusted server (today every browser holds the seed).
- [ ] Turn notifications (email / Web Push): needs a server.
- [ ] Missile trading / "give missile" action and table chat.
- [ ] Reconnects, spectators, saved games and replay viewer.
- [ ] Accounts (optional: guest play first).

## M5 — Balance lab

- [ ] Headless runner: thousands of AI-vs-AI games per config.
- [ ] Reports: win rate by seat, by map, by skill held, by tactic taken; game length.
- [ ] Use it to settle CE "playtesting" cards (Devious, Patient, Prideful, Profiteering, Ruthless, Tyrannical, Show of Force, Black Market) and Aggression keep/remove.
- [ ] Validate map stats and find degenerate maps.
- [ ] **Intelligent (CE) looks overpowered.** "Add or subtract 1 from the planet number" means a single 6 ship conquers any 7 planet on its own (7 − 1 = 6), and every planet gets two extra targets. Measure its win rate; candidate nerfs: once per turn, or only add/subtract when two or more ships are in orbit. (Noted 2026-10-03.)

## M6 — Design system: cards, tiles, boards, print

The reason the existing fan cards look poor is that each was made by hand. We'll make
them **generated from data** with a consistent visual language. Plan for shared in-game and
print rendering: [GRAPHICS.md](GRAPHICS.md).

- [ ] **Art direction** — mood board, palette, typography (replace the dice-pip font approach with proper icons), faction identities (4–5 factions, colours that work for colour-blind players).
- [ ] **Iconography** — ship types 1–6, actions, dominance, research, missile, cube, card categories (movement / action / combat / conquer / research / ship / card).
- [ ] **Card template** — SVG/HTML templates fed by `cards.yaml`: name, subtitle, rules text, category icon, art slot, deck back. Shared by the web app and print.
- [ ] **Card art** — commission an illustrator, or a consistent AI-assisted pipeline with human art direction; one illustration per unique card (45: 35 Skills, 9 Tactics, Expansion) plus 3 card backs. Track licensing per image.
- [ ] **Map tiles** — planet tiles 7/8/9/10, void tile, starting markers; tile backs.
- [ ] **Player board** — tracks, skill slots, scrapyard, reserve, cheat sheet.
- [ ] **Rulebook** — typeset from RULES.md with diagrams generated from engine states.
- [ ] **Print pipeline** — render to PDF with bleed and crop marks (e.g. Playwright/Chromium). Target specs: poker cards 63.5×88.9 mm with 3 mm bleed; tile size TBD. Vendors to evaluate: The Game Crafter, MakePlayingCards, Printer Studio, DriveThruCards.
- [ ] **Print-and-play** output (A4 + US Letter) and a print-on-demand output.
- [ ] **Components** — dice (custom engraved 1–6 ship icons?), cubes, missile & gate tokens, box.

---

## Next three things to do

1. Play a few games and note anything that feels wrong — that's the fastest way to settle the 🔴 open questions.
2. Implement the remaining 8 skills (Calculating needs a new interrupt prompt).
3. Transcribe the CE booklet's fan and 5-player maps (most 2–4p ones are already in from BGA).
