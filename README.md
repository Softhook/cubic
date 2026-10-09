# Cubic — Quantum, Community Edition (digital + print)

A new edition of [Quantum](https://boardgamegeek.com/boardgame/143519/quantum)
(Eric Zimmerman, 2013), the out-of-print dice-as-starships 4X game, built on the
fan-made **Community Edition**. "Cubic" is the working title.

Goals:

1. **Online game** with **AI opponents** (first).
2. **Design system** that generates high-quality cards, map tiles and player boards
   for print, from the same data the game uses.

**Play it:** [softhook.github.io/cubic](https://softhook.github.io/cubic/). It runs in the
browser, installs to a phone or tablet home screen and plays offline.

## What's in the game

- **Three rule sets**, picked in the lobby: **Basic** (no cards, for learning), **Original**
  (the 2013 Command and Gambit cards) and **Community Edition** (rebalanced cards, missiles,
  starting skill, Peek). See [Game modes](docs/RULES.md#game-modes).
- **Every card**: all 35 CE Skills, 9 Tactics and Expansion, and all 37 Original Command and
  Gambit cards.
- **84 maps for 2–5 players**: 3 basic, 37 advanced from the print booklet, 6 from the 2014
  add-on pack, 24 from Board Game Arena and the CE booklet's 14 five-player maps.
- **AI opponents in five levels**, Cadet to Fleet Admiral, picked per seat and run in a Web
  Worker ([AI.md](docs/AI.md)).
- **Hot-seat or online with friends**, live or one move at a time over days, with no server: the
  lobby makes an invite link, and moves travel through public Nostr relays while every browser
  keeps the whole game ([MULTIPLAYER.md](docs/MULTIPLAYER.md)).
- **Phones and tablets**: pinch zoom, a bottom sheet in phone portrait, tap anything for its info
  ([MOBILE.md](docs/MOBILE.md)).
- **The rules in the app**: *How to play* in game, and the printable manual at `#rulebook`.
- **Print**: the Art Lab (`#lab` tiles, `#lab/cards` cards, `#lab/aid` player aid) exports PNG,
  SVG and ZIP sets with or without bleed, and A4/US Letter sheets with crop marks
  ([GRAPHICS.md](docs/GRAPHICS.md)).

Where the published rules are unclear, the engine follows the rulings in
[OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md); each lives in one place in the engine.

## Develop

Needs Node 22.

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:https  # the same over HTTPS, to test on a phone on your network
npm test           # every package's and the web app's tests, including full AI-vs-AI games
npm run check      # typecheck everything (tests included), then test
npm run build      # typecheck + production build in apps/web/dist
```

Cards and maps are edited in `data/*.yaml`; `npm run data` compiles them to JSON, and every
script above runs it first. Pushing to `main` deploys to GitHub Pages
([workflow](.github/workflows/pages.yml)) once the build and the phone/tablet layout check pass.

More tools, all headless:

| Command | What it does |
|---|---|
| `npm run ai:match -- 3 4 40 community` | AI level vs level win rates ([AI.md § Strength](docs/AI.md#strength)) |
| `npm run audit:cards` | AI games with every card dealt, each step checked for legality and each card's effect against its text |
| `npm run selfplay:cards` | Card win, pick and use rates over AI self-play |
| `npm run sweep:basic` | AI games on every Basic map: game length, seat results, odd play |
| `npm run test:deep` | The legal-move cross-check over many more games (minutes) |
| `npm run mobile:shots` / `mobile:play` | Phone and tablet layouts in emulated Chrome; whole games played by tapping |
| `npm run pwa:check` | Install, offline and update behaviour of the home-screen app |
| `npm run perf:probe` / `perf:zoom` | Timings on a throttled CPU (roughly a mid-range phone) |
| `npm run relays:check` | Which public Nostr relays carry online games |

## Repository

| Path | What |
|---|---|
| [`packages/engine`](packages/engine) | Pure TypeScript rules engine: `(state, action) → state`, seeded RNG, legal-move generator, invariant checks |
| [`packages/ai`](packages/ai) | AI players in five levels, from one-action greedy to whole-turn search with reply checks |
| [`packages/online`](packages/online) | Online play without a server: a game as a log of signed, encrypted posts that every browser replays |
| [`packages/art`](packages/art) | Artwork as SVG, in mm and seeded: tiles, planets, starfields, cards, player aid; shared by the game and print |
| [`apps/web`](apps/web) | React + Vite PWA: SVG board, CSS 3D dice, synthesised sound, the Art Lab, print exports and the rulebook |
| [`data/`](data) | Canonical card and map data (YAML) |
| [`scripts/`](scripts) | The headless tools above |
| [`reference/`](reference/) | Third-party source material: rulebooks, CE print booklet, player sheet, card sheets, BGA maps |

## Documentation

| Doc | What |
|---|---|
| [RULES.md](docs/RULES.md) | The game and its full rules (CE baseline), cards, maps, differences between versions |
| [OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | Rules ambiguities and how the engine rules on them |
| [RULE-SUGGESTIONS.md](docs/RULE-SUGGESTIONS.md) | Proposed rulings and a review of the method behind them |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code is organised; how to add actions, cards, rule sets and maps; the tests |
| [AI.md](docs/AI.md) | How each AI level chooses, measured strength, next steps |
| [MULTIPLAYER.md](docs/MULTIPLAYER.md) | How serverless online play works, its limits, and the server options |
| [MOBILE.md](docs/MOBILE.md) | Phone and tablet support: plan, progress and device checks |
| [GRAPHICS.md](docs/GRAPHICS.md) | The art package, Art Lab and print pipeline |
| [PROTOTYPING.md](docs/PROTOTYPING.md) | Ideas for a fourth rule set of our own |
| [ROADMAP.md](docs/ROADMAP.md) | Milestones, what's done and the backlog |
| [card-benchmark-level4.md](docs/card-benchmark-level4.md) | Card win and pick rates from 100 Admiral self-play games, Original rules |

## Credits

- **Quantum** — designed by Eric Zimmerman, published by FunForge.
- **Community Edition** — [stolksdorf/quantum](https://github.com/stolksdorf/quantum) and contributors.
- **CE print edition** (rules booklet, player sheet, card layouts, 5-player maps) — WaterGoesRed,
  [BGG thread](https://boardgamegeek.com/thread/3766725/quantum-community-edition-ready-to-print).

This is a non-commercial fan project.
