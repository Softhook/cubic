# Reference material

Third-party material collected for this project. Not our work — keep attribution,
and don't redistribute publicly without checking with the authors.

## `community-edition-print/`

Print-ready Quantum: Community Edition by **WaterGoesRed**, posted 2026-09-11 in
[BGG thread 3766725](https://boardgamegeek.com/thread/3766725/quantum-community-edition-ready-to-print)
(downloaded 2026-10-02 from the Dropbox links in that post).

| File | Contents |
|---|---|
| `QCB-rules-booklet-A5.pdf` | 15-page A5 rules booklet: overview, setup, turn phases, ship abilities, turn example, ~60 maps with stats |
| `QPS-player-sheet-A5.pdf` | Player board + cheat sheet (4 copies) |
| `QCEC-cards-A4.pdf` | All CE cards laid out for printing: 35 Skills, 9 Tactics ×2, 6 Expansions |

Note: the booklet uses a dice-pip font, so its text layer reads `G H I J K L` for
die faces 1–6 (and `A`–`F` in the player sheet). Use the rendered pages, not
copy-paste.

## `original-2013/`

| File | Contents |
|---|---|
| `Quantum_rules_US.pdf` | Official 2013 FunForge English rulebook (16 pages): setup, basic maps for 2–4 players, actions, ship abilities, dominance, advance cards, sample game, FAQ. Same file as [BGG file 93188](https://boardgamegeek.com/filepage/93188/quantum-rules); downloaded 2026-10-02 from FunForge's site via the Wayback Machine (`funforge.fr/US/files/quantum/Quantum_rules_US.pdf`). |

This is the **first printing**. The designer's errata for the second printing
([BGG thread 1087563](https://boardgamegeek.com/thread/1087563)) corrects its 2p basic map
(to Alpha Sector) and 3p basic map (to Beta Sector), tweaks Nexus, changes Curious and adds
Quantum Entanglement. FunForge never posted an updated PDF. Board Game Arena implements the
second printing.

## `bga/maps.json`

All 71 maps as Board Game Arena implements them, parsed from BGA's public
[maps page](https://x.boardgamearena.net/data/themereleases/current/games/quantum/200826-0854/img/maps_page.html)
on 2026-10-02. Same layout tokens as `data/maps.yaml`. `bga_addition: true` marks maps BGA added
beyond the box. This is the easiest source for transcribing the advanced maps.

## Not mirrored here

- **Quantum rules summary v1** ([BGG file 101664](https://boardgamegeek.com/filepage/101664/quantum-rules-summary), a fan file). Its card notes
  are tested in `packages/engine/test/original-commands.test.ts` as "rules summary": Cruel and
  Relentless re-roll after both players have rolled; Dangerous triggers no other cards;
  Ferocious and Strategic can take a roll below 1; Ravenous ±2 is instead of ±1; Stealthy works
  with Expansion and Reorganization; Strategic's bracketed text is replaced by "when attacking,
  the bonus applies if a friendly ship is orthogonally adjacent to your attacker or the
  defender"; a Stubborn-destroyed attacker loses 1 dominance; Tactical can't move a ship that
  has already moved. It is a fan summary, not an official source. It agrees with the engine on every point except
  Strategic: Original mode now uses the revised card, where an attacker is supported only from
  its own square.

- [stolksdorf/quantum](https://github.com/stolksdorf/quantum) — the original CE
  design repo (2019): `New Rules.md`, `Cards.md`, `src/cards/*.yaml` with design
  notes for every card change, and `reference/cards.original.md` with the 2013
  card list. No license file. Its card art is found imagery (e.g. DeviantArt) and
  must **not** be reused.
- [BGG files: map tiles](https://boardgamegeek.com/filepage/264629) — printable tiles
  used by WaterGoesRed.
