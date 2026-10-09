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

Done: ruleset baseline (CE print edition; Basic and Original follow the 2013 rules, see [RULES.md](RULES.md)), no 🔴 items left in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md), the 2013 rulebook (`reference/original-2013/`), the npm-workspaces monorepo, a GitHub remote and Actions (Pages deploy, gated on build, typecheck and the mobile layout check).

- [ ] **Name & IP check** — "Quantum" is the publisher's title; game mechanics aren't copyrightable but names, art and trade dress are. Pick a working title for anything public, and don't reuse original or found art.
- [ ] **Contact stolksdorf and WaterGoesRed** — credit, permission to build on their text/maps, interest in collaborating.
- [ ] **Choose a license** for our code (e.g. MIT) and content (e.g. CC BY-NC-SA). There is no LICENSE file yet.
- [ ] **CI:** run `npm test` and `npm run pwa:check` before deploying (today only the build and `mobile:shots` run).
- [ ] This backlog as GitHub issues (optional).

### Stack (as built)

TypeScript throughout. `packages/engine`: a pure `(state, action) → state` rules engine with a seeded RNG, so a game is reproducible from its seed and action log. `apps/web`: React + Vite, board in SVG, deployed to GitHub Pages as a PWA. `packages/ai`: runs in a Web Worker. `packages/online`: no server; a shared move log on public Nostr relays ([MULTIPLAYER.md](MULTIPLAYER.md)). `packages/art`: print and in-game art.

---

## M1 — Rules engine

Package: `packages/engine`

Done: data loading, board model, game state, seeded RNG, setup, all actions, combat, ship abilities, Infamy, Quantum Entanglement, Void research, win check, Phase 2 cards, pending decisions/interrupts, the three game modes (Basic, Original, Community Edition), all 37 Original cards, all 35 CE Skills, 9 Tactics and Expansion, `legalActions()`, map stat checks, and a text game log. Tests: per-card scenario tests (Original and CE), golden games, consistency/property tests, and the card audit (AI games checked at every step).

- [ ] **Replay viewer** — replaying seed + actions already reproduces a game (online play relies on it); there's no viewer to step through one. A structured event stream (rather than the text log) would help it.

## M2 — Local play (hot-seat)

Package: `apps/web`

Done: SVG board, player panel, card market with Peek, action and combat UX, missile window, turn log, undo within a turn, map picker with stats for 2–5 players (all 84 maps: basic, advanced, add-on, BGA and the CE booklet's 5-player maps), tap for ship/planet/card info, the in-app rulebook.

- [ ] **Mobile** — built and passing in emulation (Steps 0–5 in [MOBILE.md](MOBILE.md), including zoom, the phone-portrait bottom sheet and the offline PWA); the real-device pass on the Moto G55 is still to do.
- [ ] Any CE booklet fan maps not already in from BGA (check against the booklet).

## M3 — AI opponent

Package: `packages/ai`

Done: five levels picked per seat (1 Cadet, 2 Captain, 3 Commodore, 4 Admiral, 5 Fleet Admiral; see [AI.md](AI.md)), running in a Web Worker; card-pick, missile and Dangerous policies; `npm run ai:match` benchmarks.

Open, in the order of [AI.md § Next steps](AI.md#next-steps):

- [ ] **Tune the evaluation by self-play** (weights are hand-set).
- [ ] **Value cards individually** (every skill is worth the same today); ideally from measured win rates (M5).
- [ ] Missiles in the search.
- [ ] **Search across turns**: MCTS with chance nodes and determinized decks, time-boxed per move.
- [ ] Better play with more than 2 players (who attacks whom).
- [ ] "Explain move" — show why the AI did something (from the evaluation's terms).
- [ ] *Optional:* LLM-driven persona (taunts, commentary, post-game review), not used for move selection.

## M4 — Online multiplayer

Options and plan: [MULTIPLAYER.md](MULTIPLAYER.md).

Done: serverless play between friends via a shared move log on public Nostr relays ([MULTIPLAYER.md §0](MULTIPLAYER.md#0-whats-built-a-shared-move-log-on-public-relays)); lobbies by link with AI seats and map choice; real-time and asynchronous play; reconnecting (the log is replayed); the missile response window with a per-player *ask* setting; local autosave of the game on this device.

- [ ] Fair dice and hidden decks: needs a trusted server (today every browser holds the seed).
- [ ] Turn notifications (email / Web Push): needs a server.
- [ ] Missile trading / "give missile" action and table chat.
- [ ] Spectators and a replay viewer for finished games.
- [ ] A smoke test that plays an online game between two browsers through the real relays (could run on GitHub Actions).
- [ ] Accounts (optional: guest play first).

## M5 — Balance lab

Done: headless runners (`npm run ai:match` win rates by seat and level, `npm run sweep:basic` per map, `npm run selfplay:cards` win and pick rates per card, `npm run audit:cards` card coverage and anomalies); map stats recomputed and checked for every map.

- [ ] Use the runs to settle CE "playtesting" cards (Devious, Patient, Prideful, Profiteering, Ruthless, Tyrannical, Show of Force, Black Market) and Aggression keep/remove. Needs far more games than so far (see the overnight run below).
- [ ] Find degenerate maps (the Basic sweep reports game length and seat results per map; not yet for Classic or CE).
- [ ] **Intelligent (CE) looks overpowered.** "Add or subtract 1 from the planet number" means a single 6 ship conquers any 7 planet on its own (7 − 1 = 6), and every planet gets two extra targets. Measure its win rate; candidate nerfs: once per turn, or only add/subtract when two or more ships are in orbit. (Noted 2026-10-03.)
- [ ] **Card oracles for the rest of the cards.** The audit (`packages/engine/test/audit.ts`) checks a card's effect against its text only for the cards in `CHECKED_EFFECTS` (28/45 CE, 18/37 Original); the others are only played, so a wrong effect that doesn't crash goes unnoticed however many games run. Unchecked CE: Agile, Composed, Cunning, Devious, Ferocious, Flexible, Ingenious, Intelligent, Pioneering, Rational, Resourceful, Steadfast, Stealthy, Strategic, Tactical, Talented, Tyrannical. Unchecked Original: Agile, Cerebral, Cruel, Cunning, Eager, Energetic, Ferocious, Flexible, Ingenious, Intelligent, Nomadic, Rational, Relentless, Resourceful, Scrappy, Stealthy, Strategic, Tactical, Tyrannical. Do this before the overnight run below, or it only proves those cards don't crash. (Noted 2026-10-07.)
- [ ] **Overnight card run on GitHub Actions, at Level 3.** A manually started workflow (`workflow_dispatch`, inputs: games, mode, level, shards; e.g. `gh workflow run selfplay.yml -f games=2000 -f mode=original -f level=3 -f shards=20`), run now and then rather than on a schedule. Two parts: (1) correctness: many seeds with skills *dealt* (the audit's `deal`), so every card is in play many times, reporting anomalies and "held, never fired"; (2) balance: *drafted* self-play, merging win and pick rates across shards, with confidence intervals (the 100-game Level 4 report had cards taken 1–8 times, too few to judge). `scripts/selfplay-cards.ts` needs a seed offset per shard (seeds are fixed at `6000 + g`), to log anomalies and carry on rather than exit on the first, and JSON output for a merge job that writes the job summary. Time a few Level 3 games locally first to size games per shard (6 h job limit). (Noted 2026-10-07.)

## M6 — Design system: cards, tiles, boards, print

The reason the existing fan cards look poor is that each was made by hand. We'll make
them **generated from data** with a consistent visual language. Plan for shared in-game and
print rendering: [GRAPHICS.md](GRAPHICS.md).

Done: `packages/art` (tokens, seeded RNG, mm units), procedural tiles, planets and starfields; the Art Lab (`#lab`) with card and tile labs; cards drawn from `cards.yaml` at poker size; the A6 player aid (`#lab/aid`); print exports (PNG/SVG/ZIP, with or without bleed) and A4/US Letter sheets with crop marks, saved as PDF from the print dialog; the in-app rulebook with diagrams. [GRAPHICS.md § Phases](GRAPHICS.md#5-phases) has the detailed list.

- [ ] **Art direction** — mood board, palette, typography, faction identities (4–5 factions, colours that work for colour-blind players).
- [ ] **Iconography** — a proper icon set: ship types 1–6, actions, dominance, research, missile, cube, card categories.
- [ ] **Card art** — commission an illustrator, or a consistent AI-assisted pipeline with human art direction; one illustration per unique card (45: 35 Skills, 9 Tactics, Expansion) plus 3 card backs. Track licensing per image.
- [ ] **Map tiles** — pin the chosen seeds for all 30 tiles (`data/art.yaml`); tile backs and starting markers; print one test tile at 100 % with real dice and cubes.
- [ ] **Player board** — the A6 player aid is built (cube rail, dominance and research pads, actions, ships); still to decide whether it needs skill slots, a scrapyard and a reserve.
- [ ] **Rulebook for print** — typeset, with diagrams rendered from engine states.
- [ ] **Print-on-demand** — choose vendors (The Game Crafter, MakePlayingCards, Printer Studio, DriveThruCards) and set trim/bleed to their specs; physical proof.
- [ ] **Components** — dice (custom engraved 1–6 ship icons?), cubes, missile & gate tokens, box.

---

## Next three things to do

1. Play Step 3–5 of [MOBILE.md](MOBILE.md) on the Moto G55 (whole games, zoom, bottom sheet, install and offline).
2. Add `npm test` and `npm run pwa:check` to the GitHub workflow.
3. Card oracles for the unchecked cards, then the first overnight Level 3 card run (M5).
