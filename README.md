# Quantum — Community Edition (digital + print)

A new edition of [Quantum](https://boardgamegeek.com/boardgame/143519/quantum)
(Eric Zimmerman, 2013), the out-of-print dice-as-starships 4X game, built on the
fan-made **Community Edition**.

Goals:

1. **Online game** with an **AI opponent** (first).
2. **Design system** that generates high-quality cards, map tiles and player boards
   for print, from the same data the game uses.

## Play it

```bash
npm install
npm run dev        # http://localhost:5173 — hot-seat play vs AI opponents (2–4 players)
npm test           # rules engine tests + full AI-vs-AI games
npm run build      # typecheck + production build in apps/web/dist
```

The first playable version uses the **proposed rulings** from
[docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md); each lives in one place in the engine,
so changing a ruling later is a small edit.

**Three modes**, picked in the lobby: **Basic** (no cards — for learning),
**Original** (2013 Command & Gambit cards) and **Community Edition** (rebalanced cards,
missiles, starting skill, peek). See [Game modes](docs/RULES.md#game-modes).

**What works:** setup, all five actions, all six ship abilities, combat (with missiles in
CE), Infamy, Quantum Entanglement, void tiles, the card market, and most cards: 26 of 35
CE Skills, all 9 CE Tactics, 25 of 31 original Command cards and 5 of 6 Gambit types.
Unimplemented cards are left out of the decks. Only the three basic maps are available.

## Repository

| Path | What |
|---|---|
| [`packages/engine`](packages/engine) | Pure TypeScript rules engine: `(state, action) → state`, seeded RNG, legal-move generator |
| [`packages/ai`](packages/ai) | Greedy one-ply AI that samples dice outcomes and scores positions heuristically |
| [`apps/web`](apps/web) | React + Vite client: SVG board, CSS 3D dice with roll animations, synthesized sound |
| [`docs/RULES.md`](docs/RULES.md) | The game and the full rules (CE baseline), cards, maps, divergences between versions |
| [`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md) | Rules ambiguities that need a ruling before the engine can implement them |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the code is organised and how to add actions, cards, rule sets and maps |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Milestones and backlog: engine → local play → AI → online → balance lab; design system |
| [`data/cards.yaml`](data/cards.yaml) | All 35 Skills, 9 Tactics, Expansion — canonical card data |
| [`data/maps.yaml`](data/maps.yaml) | Map layouts (basic maps done; advanced maps to transcribe) |
| [`reference/`](reference/) | Third-party source material: CE print booklet, player sheet, card sheets |

## Credits

- **Quantum** — designed by Eric Zimmerman, published by FunForge.
- **Community Edition** — [stolksdorf/quantum](https://github.com/stolksdorf/quantum) and contributors.
- **CE print edition** (rules booklet, player sheet, card layouts, 5-player maps) — WaterGoesRed,
  [BGG thread](https://boardgamegeek.com/thread/3766725/quantum-community-edition-ready-to-print).

This is a non-commercial fan project.
