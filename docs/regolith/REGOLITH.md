# Regolith

**Regolith** is our own game, and it took Prototyping's place in the lobby. It is played on hex tiles only,
on Phobos's, Deimos's and Mars's ground (the Regolith tiles), and has its own cards in the **screenprint** style.
It starts from the Community Edition cards and moves away from them, card by card, in name, design and
action. This doc sets out the structure for that: where each part lives, what it reuses, and the order to
build it in. It does not design the cards.

The look comes from the [Regolith mood board](../moodboards/regolith/README.md): the CardStyles, CardScale and
Vocabulary boards for the cards (flat inks on paper, three passes per part: colour plate, key ink, accent;
mechs and objectives built from one kit), HexSurface for the ground.

The rules themselves are the ones [PROTOTYPING.md](PROTOTYPING.md) designed, and they go on changing
there: Regolith is a rename and a new identity, not new rules.

## Decided (2026-10-22)

| | |
|---|---|
| Name | **Regolith**, in place of Prototyping in the lobby's mode menu |
| Maps | Hex only, each on Phobos, Deimos or Mars |
| Cards | Start as the Community cards, in Regolith's own deck; names, design and actions move away from Community over time |
| Card style | Screenprint |

## What changes, at a glance

| | Prototyping, before | Regolith |
|---|---|---|
| Lobby | "Prototyping" | "Regolith" (done) |
| Maps | Community's square maps, plus the hex and drift groups | Hex maps only, each on Phobos, Deimos or Mars (done) |
| Tiles | Ground on by default (top-bar switch to space) | The same; ground is the game's look |
| Rules | Community + cap 3, zones of control, Shoot, contested orbit and deploy | The same, and still changing |
| Cards | Community's Skills and Tactics (no Ingenious on hexes) | Regolith's own decks, starting as copies of Community's |
| Card art | `cardSvg`, the holo-grid scenes | A screenprint card renderer and its own scenes |
| Words | Ship, planet, dominance, research | Mech, objective, control, intel (Vocabulary board; done in the UI, §7) |

## 1. The rename

Done (23 October 2026). There were no users to keep, so the rename went all the way down rather than only
changing the label:

- The mode's id is `'regolith'` (`GameMode` in [data.ts](../../packages/engine/src/data.ts), `RULESETS.regolith`
  in [rulesets.ts](../../packages/engine/src/rulesets.ts)), its folder `packages/engine/src/regolith/` with
  `regolithMode()` and the `REGOLITH_*` switches, its tests `regolith.test.ts`. The old ids (`'prototyping'`,
  and `'cubic'` before it) are gone, aliases included: saved and online games under them are dropped.
- The prototype kit ([prototype.ts](../../packages/engine/src/prototype.ts)) keeps its name: it is the engine's
  surface for experimental rules, whichever mode uses it.
- PROTOTYPING.md stays the design log of the rules, retitled as Regolith's, and keeps the word "prototyping" for the work, not the mode.
- **Kept apart, for a later split.** So Regolith can one day leave for its own app on the shared packages,
  only its folder, rulesets.ts and the `GameMode` type name it, by id or name; everything else asks the rule
  set (`contestedOrbit`, `words`, `grid`, `experimental` for the badge's colour, …). `regolith.test.ts` checks
  it across the engine, AI, online and web sources and the web app's styles, as it checks that the folder uses
  the engine only through the kit. It reads text, so a check that gets at the mode some other way (by its
  summary, say) passes it: review still matters.
- **Other versions online.** A browser that gets an invite for a game it can't start (made by a version with
  other modes, maps or protocol) says so and asks both players to reload, rather than "Game not found".

## 2. Maps: hex only

Done (23 October 2026).

- `regolithMode()` sets its own `mapGroups` rather than adding to Community's: `hex`, `open` and `drift`,
  all hex. Binary Reach, the one square drift map, moved to `drift-square`, which no mode plays for now.
- Every hex map names its world in [data/maps.yaml](../../data/maps.yaml), and
  [build-data.mjs](../../scripts/build-data.mjs) refuses one that doesn't, so a map's world is a choice, not a
  default. Alpha and Gamma Sector, Circular Logic, Critical Density and Nexus (hex), Stickney Crater and
  Limtoc are `phobos`; Beta Sector, The Great Plan and Tesseract (hex) and Twin Drift are `deimos`; the rest
  are `mars`. (The engine still draws a test's ad-hoc hex map, which has no world, on Mars.)
- More hex maps (HEX.md *Not yet*: advanced, add-on, BGA layouts) go in the same group as they are made. Seven
  advanced maps are in the hex group now, and the open group (HEX.md *Open ground*) spreads its planets
  out with blank tiles; Regolith plays both.
- `regolith.test.ts` pins it: every Regolith map is hex and has a world.

## 3. Cards: data

Regolith's cards get their own data file from the start, so the deck can move away from Community one
card at a time and `data/cards.yaml` stays the Community Edition record.

```
data/
  cards.yaml          Community and Classic, as now
  regolith.yaml       Regolith's decks: permanent, one-shot, and the Expansion card
packages/engine/src/data/
  regolith.json       built by scripts/build-data.mjs, as cards.json is
```

**The first version is a copy.** Every Community card appears once, with the same name, text, category
and count, and `effect` pointing at the Community card's rule (`effect: agile`). The game then plays
exactly as Prototyping does today, but from its own deck. Ingenious ("conquer from the corners") is left
out, as hex tiles have no corners.

Each card is a `CardDef` with the fields cards already have (`id`, `name`, `subtitle`, `text`,
`category`, `count`, `notes`, `effect`), plus:

- **`from`**: the Community card it started as. It stays when the card changes, so the Art Lab can show
  the lineage (as `classic` does for Community cards) and it is clear how far each card has moved.
- **`status`**: how far it has moved, replacing `ce_status` for this file:
  `community` (as the copy), `renamed` (new name and words, same action), `reworked` (action changed:
  a new `effect`), `new` (no Community ancestor, no `from`).

Ids are prefixed (`r-`) so they never collide with Community's or Classic's (`o-`).
[build-data.mjs](../../scripts/build-data.mjs) checks what it checks for `cards.yaml`, plus that every
`effect` is one the engine knows and that `status` agrees with `from` and `effect`.

[data.ts](../../packages/engine/src/data.ts) exports `REGOLITH_PERMANENT`, `REGOLITH_ONESHOT` and
`REGOLITH_EXPANSION` and adds them to `ALL_CARDS`; the prototype kit re-exports them for the mode.

## 4. Cards: rules

- `regolithMode()` sets `cards` to Regolith's decks, with Community's market settings (starting draft,
  peek, expansion pile, no refresh). `REGOLITH_CARDS` still switches cards off. `terms` names the decks.
- **Renamed cards** need no rules work: the engine resolves a card through `effectOf`, and the AI values
  cards by effect ([cardValues.ts](../../packages/ai/src/cardValues.ts)).
- **Reworked and new cards** need new rules. Where an effect can be written as a hook, it goes in
  `packages/engine/src/regolith/cards/`, one file per effect, like
  [powers/](../../packages/engine/src/regolith/powers), so Community's rules can't change by accident. That
  needs a card-hook surface in the kit next to `ShipHooks` (PROTOTYPING.md §9 *Adding a New Hook*), built
  when the first reworked card needs it. An effect too tangled for a hook goes into the engine's effects
  like any card, registered in `IMPLEMENTED_EFFECTS`, and only Regolith's deck deals it.
- Each new effect needs an AI value in `cardValues.ts`, a rule test, and a line in
  [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) for every ruling made while writing it.

## 5. Cards: art (screenprint)

The screenprint look is a second card renderer, not options on the first: layout, palette and type
differ throughout, and `cardSvg` stays as it is for Community and Classic.

```
packages/art/src/
  screenprint/
    index.ts        screenprintCardSvg(face, measure), screenprintBackSvg(deck)
    inks.ts         paper, night paper, key ink, bone, oxide and ice plates, amber accent (Vocabulary board)
    plates.ts       printing a part in three passes: offset colour plate, key ink, accent; registration offset
    layout.ts       the card face: art window, name, subtitle, rules text, category mark, tag
    mechs.ts        the six mech classes (Breacher, Behemoth, Tactician, Chameleon, Sniper, Wisp), posable parts
    objectives.ts   Habitat, Refinery, Ice Mine, Reactor, Sinkhole
    props.ts        bunker, comms mast, drop pod, barricade, boulders, ordnance, intel and control readouts
  scenes/
    regolith.ts     one scene per Regolith card, keyed by card id, with its caption
```

- **Same card contract.** It takes the same `CardFace`, `Measure` and fonts, and fits text the same way,
  so the Art Lab, exports and print sheets take it unchanged. Size, bleed, safe zone and corner are the
  poker card's (GRAPHICS.md *Cards*).
- **Decks tell apart as now:** the permanent deck on light paper, the one-shot deck on night paper with
  bone ink (Vocabulary board). Category still sets the accent and the icon.
- **Rules readouts stay one system:** action chips, combat dice and the other quantities keep their
  meaning from GRAPHICS.md *Cards*, redrawn as flat inks. A hexagon still means an action.
- **The tag** reads `7/35 R`: position in the deck, then the set.
- `CardDeck` in [card.ts](../../packages/art/src/card.ts) gains Regolith's decks, and each deck says which
  renderer draws it, so callers pick by deck, not by mode.
- **Art follows the card, not its status.** While a card is still a Community copy its scene can be
  a plain screenprint of its category's mech or prop; it gets its own scene when it is renamed or reworked.
  Once every card has a scene, the art tests that hold for Community hold here: every card has one, no
  two are the same, no text under `MIN_TEXT`.

**The ground and the cards.** CardScale notes the flat screenprint cards pull away from the photographic
Regolith ground. Pieces that sit beside the map in play (the market, the card viewer, the player aid)
should agree with it; how far the tiles move towards flat inks is open, below.

## 6. Web

- The lobby's mode menu lists Regolith where Prototyping was (it comes from `MODES`), with the hex maps. Done.
- [apps/web/src/art/cards.ts](../../apps/web/src/art/cards.ts): `DECKS` gains Regolith's decks with
  `edition: 'regolith'`; `faceOf` finds their faces. The game shows the cards of the mode it plays.
- On-screen cards (`cardImages`, `cardPalette`) render through the deck's renderer, so a Regolith game's
  market and hand show screenprint cards.
- Art Lab (`#lab/cards`): a Regolith group, each card beside the Community card it is `from`, with its
  `status`; print exports pick it by edition, so a print run is a whole Regolith deck.
- The rulebook and in-game help name the mode's cards as `terms` says. The field-manual style
  (CardStyles D) suits the help and reference cards rather than the deck faces.
- The player aid gets a Regolith version later: the mech die faces and the mode's rules on one sheet.

## 7. Words

The names, words and story are kept in one place, [REGOLITH-WORLD.md](REGOLITH-WORLD.md): the six mechs
(Breacher, Behemoth, Tactician, Chameleon, Sniper, Wisp), the objectives (Habitat, Refinery, Ice Mine, Reactor,
Sinkhole), the sides, and how each Quantum term reads in Regolith.

The game says them everywhere (22 October 2026): `RuleSet.words` (engine `words.ts`) is the mode's
vocabulary, REGOLITH-WORLD.md's table as `REGOLITH_WORDS` (`regolith/words.ts`), and `reword` / `say`
put a text in it, with its case and article ("a planet" → "an objective") and with players' names kept.
The engine, its log and the card data stay in Quantum's words; the web app rewords what it shows: the
log and toasts (`logText`), hints, rule errors, cards (`CardView`, through `useSay` from GameScreen),
modals, tips, and the ship, planet and player panels. A new string in the game UI goes through `say` too.
A card renamed in its own deck can say the words itself; the rewording leaves them as they are.

## 8. Testing

- `regolith.test.ts`: the mode deals only Regolith's cards and plays only hex maps, and still can't
  change Basic, Classic or Community.
- While every card is a copy, a Regolith game plays move for move the same as one on Community's deck
  with the same seed; a test can hold that until the first card is reworked.
- The golden games are refreshed whenever a card's action changes.
- [card-audit.ts](../../scripts/card-audit.ts) and [selfplay-cards.ts](../../scripts/selfplay-cards.ts) run on
  Regolith's deck; results go in PROTOTYPING.md §8 like the other playtests.
- The legal-move cross-check in `consistency.test.ts` plays a Regolith game.

## 9. Order of work

1. **Rename and hex only.** *Done (22–23 October 2026):* the lobby and game say Regolith, the id and
   folder are renamed (§1), the mode plays hex maps only, each with its world (§2), and its ships carry the
   mech names, which the engine and web app take from the game's rules.
2. **Own deck.** `data/regolith.yaml` as a copy of Community's, the build step, exports, `regolithMode()`
   dealing it, `DECKS` and the Art Lab listing it, drawn with today's `cardSvg` for now. The game plays
   as before, from its own deck.
3. **Screenprint renderer.** Inks, plates, the card layout and backs, with plain art windows. Market,
   viewer and print exports switch to it.
4. **Screenprint kit.** Mechs, objectives, props; the category art for copied cards.
5. **Moving away, card by card.** Renames with the new words and their own scenes, then reworked and new
   actions, with the card-hook surface built for the first one. Playtest and AI self-play as they land.
6. **Words and aid.** A Regolith player aid and rulebook pages (the mode-wide vocabulary is done, §7).

Steps 1–4 need no card designed.

## Open decisions

- **Deck names** in the theme (the permanent and the one-shot deck), and whether the Expansion card stays.
- **Deck size:** Community's (35 Skills, 9 Tactics), or smaller as cards are reworked.
- **One look for map and cards:** keep the photographic ground with flat-ink cards, or move tiles and
  dice towards the screenprint inks (CardScale's warning).
- **Binary Reach:** the one square drift map, in `drift-square` and played by no mode: give it to Community, or drop it.
