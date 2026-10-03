# Graphics & Print Plan

How we make the in-game graphics better **and** turn the same drawings into print-ready cards,
tiles and boards. This expands M6 in [ROADMAP.md](ROADMAP.md).

The rule behind every decision below: **one drawing, two outputs.** A planet, a tile, a card face
is drawn by one component. The web app shows it on screen; a print script renders it to PDF/PNG
at physical size. Nothing is drawn twice, so the printed game and the online game can't drift apart.

---

## Where we are today

| Element | How it's drawn | Can it be printed? |
|---|---|---|
| Board tiles, void, planets, gates | Inline SVG in [`Board.tsx`](../apps/web/src/components/Board.tsx), sized in **screen pixels** (`cell` from a `ResizeObserver`) | Not as is: coordinates, blur radius and stroke widths depend on the window size |
| Gradient / filter ids | Global ids (`#tile`, `#planet7`, `#glow`) | Ids clash as soon as two boards or tiles share a page (a print sheet) |
| Cards | HTML + CSS in [`Card.tsx`](../apps/web/src/components/Card.tsx), fixed `px` font sizes, no art slot | Layout is close; needs physical sizes, bleed and an art slot |
| Category icons | SVG (`CategoryIcon`) | Yes, already vector |
| Dice / ships | CSS 3D cube ([`Die3D.tsx`](../apps/web/src/components/Die3D.tsx)) | No, and doesn't need to be (physical dice); ship icons for faces do |
| Starfield background | CSS radial gradients on `body::before` | No; it's screen chrome |
| Explosions, highlights, hit areas | HTML/CSS overlay (`board-layer`) | Never printed, correctly kept separate |
| Fonts | Google Fonts CDN (Inter, Orbitron) | PDFs need local font files to embed |

The board already separates the **SVG art layer** from the **interactive HTML layer**. That split is
exactly what we want and the plan keeps it.

---

## 1. The architecture

```
data/cards.yaml  data/maps.yaml  data/art.yaml (new: seeds, palettes, art credits)
        │               │               │
        └───────────────┴───────┬───────┘
                                ▼
                     packages/art  (new)
       plain functions → SVG markup, physical units, seeded, no DOM measuring
       Starfield · Nebula · Planet · Tile · VoidTile · Gate · CardFace · CardBack
       ShipIcon · CategoryIcon · PlayerBoard · tokens (palette, type, sizes)
                                │
            ┌───────────────────┼─────────────────────┐
            ▼                   ▼                     ▼
       apps/web (game)    apps/web /lab (Art Lab)   scripts/print.ts
       scales art to      explore seeds & params,   Playwright → PDF / PNG
       screen, adds UI    export SVG/PNG, pin       sheets with bleed &
       layer on top       seeds into art.yaml       crop marks
```

### `packages/art` rules

1. **Author in millimetres.** Every component has a fixed `viewBox` in mm (a card is
   `0 0 69.5 94.9` including bleed; a tile is `0 0 T T`). The screen scales it with CSS; print
   renders it 1:1. Stroke widths, blur radii and font sizes are in mm too, so a planet looks the
   same at 40 px and at 600 dpi.
2. **No browser measuring, no app state.** Options in, SVG text out: plain TypeScript functions, no
   React. The same call runs in Node (print scripts, tests) and in the browser. The game shows the
   result as an `<image>` (a `data:` URL), so the browser rasterises each tile's noise filters once
   instead of on every repaint; that is also the "baked" mode §4 needs. Cards, whose text needs HTML
   layout, will be the exception.
3. **Deterministic.** Anything random (star positions, planet surface, nebula shape) comes from a
   seeded RNG keyed by a stable string, e.g. `planet:<mapId>:<planetId>` or `card:<cardId>`. The
   same planet looks identical in every game, in the lab and in print. (A small hash + mulberry32
   inside `packages/art`; it must not share the engine's game RNG.)
4. **Scoped ids.** Gradients, filters, clip paths and patterns get ids from a prefix option
   (the tile id by default) so any number of drawings can share a page.
5. **Design tokens in one place.** `packages/art/src/tokens.ts` holds the palette, player colours,
   planet colours, type scale and physical sizes. The web app's CSS variables are generated from it,
   so the game UI and the printed components share colours.
6. **Art vs. chrome.** Things that only exist on screen (highlights, hover rings, explosions, the 3D
   dice, the animated gate spin) stay in `apps/web`. If it could be printed, it lives in `packages/art`.

---

## 2. Visual upgrades (in-game and print)

All of these are built as `packages/art` components with parameters, so the Art Lab can explore them.

### Starfields

Layered, seeded, vector:

- **Far stars**: hundreds of tiny circles, size and brightness drawn from a power-law distribution
  (lots of faint stars, a few bright ones), slight colour temperature variation (blue-white to amber).
- **Near stars**: a handful of bright stars with a soft glow (no diffraction spikes).
- **Nebula**: soft colour clouds. Two techniques:
  - *Vector*: a few large blurred blobs (`feGaussianBlur` on ellipses/paths) in the palette's
    colours. Cheap, predictable, prints well.
  - *Noise*: `feTurbulence` + `feColorMatrix` + masks for wispy texture. Much richer, but slow to
    render live and rasterised when printed (see §4). Use it for backgrounds that are baked once.
- **Dust lanes / dark clouds**: negative masks cutting into the nebula for depth.

Uses: tile backgrounds (each tile gets its own seed so the board doesn't look tiled), card backs,
card art backdrops, box art, the app background (replacing the CSS star pattern).

### Planets

A `Planet` component with seeded parameters:

| Layer | Notes |
|---|---|
| Base sphere | Radial gradient, light from a fixed direction (same on every planet and card) |
| Surface | Type-dependent: banded gas giant (stretched turbulence), rocky (craters as shaded circles), ice (pale, cracked lines), lava (dark with glowing fissures), ocean/continent (thresholded noise) |
| Terminator shadow | Offset circle mask to give a crescent of night side |
| Atmosphere | Thin outer glow ring with the planet's colour |
| Rings / moons | Optional, seeded |
| Gameplay overlay | Planet number and cube pads: drawn **on top** and kept high-contrast so the game stays readable (layout in §2a) |

**The planet carries the number.** Each number is its own kind of world in its own colours, distinct
in hue *and* lightness (`PLANET_FAMILY` in tokens):

| Number | World | Colours |
|---|---|---|
| 7 | Earth-like: blue sea and green land (temperate, jungle or tundra), more or less cloud, sometimes polar caps | green and blue |
| 8 | Ice: white glaciers, frozen seas, turquoise or blue ice; pale cyan, turquoise or blue ice giants | pale, tinted cyan to blue (lightest) |
| 9 | Banded gas giants (Jupiter-gold, Saturn-cream, amber or rust), often with storms or rings | gold and amber |
| 10 | Molten lava worlds: black crust, from thin red cracks to wide orange magma rivers | black and red (darkest) |

No planet is blue-violet, so none blends into the nebula. The number also sets the **size**, in big
steps (7: 22 mm up to 10: 42 mm, nearly twice as wide). So a planet's number reads from its look,
its size and the numeral, which also helps colour-blind players. Within a number, the seed picks the
variant and surface, so every planet is distinct.

**Every physical planet is unique.** A set that plays every map in `maps.yaml` needs 25 tiles (see
§2a), so we design 25 individual planets: each tile has a fixed id (`p7-01` … `p10-04`, `void`), a
pinned seed and look in `art.yaml`, and optionally a name printed small on the tile. The game assigns
a map's planets to tile ids, so the planet on screen is the same one as on the table.

### Tiles

- `Tile` = star background + 3×3 space grid + planet in the centre (or none for an empty tile).
- `VoidTile` = its own look (distorted, darker, violet), as the current gradient suggests.
- Print adds a tile back and corners matched to the die-cut.
- On screen, the whole map renders as tiles in a single SVG, as today, with the interactive HTML
  layer above. The tile art itself is the same as print (planet up to 1.19 cells), so the screen
  and the table look alike. **The live layer is sized for the screen, not the table:** the number and
  the cube slots on screen stay small and don't copy the printed 11 mm cube pads, which would crowd
  the board. They follow the print layout, though: cubes centred on the planet, the number drawn on it
  towards the bottom right, white with a dark outline.
- **Loading.** Drawing a tile's noise filters takes ~45 ms (~1.1 s for a 25-tile map), so the game
  draws each tile once to a 576 px image and keeps it in the browser's IndexedDB
  ([`tileImages.ts`](../apps/web/src/art/tileImages.ts)). Tiles are drawn in the background while
  the lobby is open; later games and window resizes reuse the stored images (all 25 shown ~0.3 s after
  Launch). Each stored image carries a hash of its SVG, so changing the artwork redraws only what
  changed.

**Star backgrounds per tile.** Each of the 25 tiles gets its own seeded starfield and nebula, so a
map never looks like a repeated pattern. Nebula colours are random but kept between blue and pink-purple
(`NEBULA_HUES`, 215–330°) so the set looks consistent (blue clouds are lifted, since blue looks darker), and kept **behind the planet**, so the sky stays in the background and the planet's colour is what tells tiles apart. (The
Void tile keeps a stronger magenta nebula around its rift.) Because tiles are rearranged for every map, backgrounds
can't line up across edges; instead every tile follows the same edge rules so any two tiles sit
together cleanly:

- the nebula fades towards the tile edge into one shared base colour (no cloud cut off at the seam);
- star density and brightness are the same near every edge;
- the brightest features (big stars, nebula cores) sit in the gutters and corners, not in the middle
  of a space, so the grid stays readable and dice don't hide the best bits;
- the planet gets a soft dark halo so it stands out from any background.

---

## 2a. Physical tile and planet geometry

Designed for **19 mm dice**. All numbers live in tokens so they can change after a physical test.

| Measure | Value | Why |
|---|---|---|
| Die | 19 mm | Chosen dice |
| Cell (space) | **32 mm** | Die + 6.5 mm each side: 13 mm between neighbouring dice, enough for fingers; ≈ 1.7× die |
| Space pad | 24 mm rounded square, centred | Shows where a die sits; 2.5 mm clear around the die |
| Attack rings | Two faint rings (5.2 and 8.4 mm across) in the four spaces beside the planet | Where dice go to conquer it; hidden once a die sits there |
| Tile (trim) | **96 × 96 mm** (3 × 3 cells) | |
| Bleed | 3 mm → 102 × 102 mm artwork | |
| Corner radius | 2 mm | Kind to die-cutting; the small gap where four tiles meet doesn't matter |
| Cube | **assumed ≤ 10 mm** (measure ours) | Standard wooden cubes are 8 or 10 mm; pads are sized for 10 |
| Planet diameter | 7: 22 mm · 8: 28 mm · 9: 35 mm · 10: 42 mm | Big steps so size alone tells numbers apart; bigger than the cell is fine (below) |
| Cube pad | 11 mm square outline, 1.5 mm apart | 10 mm cube + tolerance |
| Planet number | **14 mm** type (12.5 mm for "10"), white with a dark outline, no disc | Where the spaces meet at the planet's bottom right; large and never covered by cubes or dice |
| Flavour label | 1.7 mm name, 1.2 mm monospace lines, inside the 8 mm strip between space pads | Where the spaces meet at the planet's top left; made-up survey data, not meant to be read in play |

**Why the planet can be bigger than its cell.** Ships can't enter a planet's space, so only the dice
in the eight surrounding spaces limit its size. A die in the space next to the planet starts
32/2 + 6.5 = 22.5 mm from the planet's centre; a diagonal die's nearest corner is ~31.8 mm away. A
42 mm planet (radius 21 mm) keeps 1.5 mm clear of the nearest die. The 9 and 10 can't go below
33.2 mm, or their cube pads would stick out past the planet's edge.

**Cube pads and number.** Cube pads (capacity 7→1, 8→2, 9→3, 10→4) form a cluster centred on the
planet. The number is centred on the **corner where the four spaces meet at the planet's bottom
right** (16 mm right and down from the centre), white with a dark outline so it reads on any surface.
Dice never reach that corner, so it is the one place a big numeral is always visible. The 10's four
pads reach into it, so its number moves 1.2 mm further out along the same diagonal
(`numberPlacement()`; a test keeps every number on the diagonal).

**Flavour label.** The opposite corner, at the planet's top left, holds a tiny star-atlas label: a
made-up name, catalogue number, class and orbit, and a few measurements to suit the kind of world
(`planetFlavour()`), with a thin leader line to the planet. It stays inside the strip between the
space pads above and below, and no stars are drawn under it. It is seeded like the art, so each tile
always gets the same text. On the Illustrator export it is its own vector layer, `label`.

```
  NAME ·                 NAME ·              NAME ·              NAME ·
  data  ╲                data ╲              data ╲              data ╲
         ╭───╮               ╭─────╮           ╭───────╮          ╭─────────╮
         │[ ]│              │[ ] [ ]│         │ [ ] [ ] │        │ [ ] [ ]  │
         ╰───╯               ╰─────╯          │   [ ]   │        │ [ ] [ ]  │
               7                     8         ╰───────╯          ╰─────────╯
                                                         9                    10
       7: 22 mm               8: 28 mm          9: 35 mm           10: 42 mm
```

A test checks every number's box against the cube pads and against 19 mm dice in the spaces beside,
below and diagonal to the planet.

Printed pads are visible outlines, so a planet's capacity is clear on the
table without remembering the rule. The pad area keeps a calm, darker surface so cubes in any player
colour stand out.

**Start markers.** Maps mark some planets as starting planets (`7*` etc.). Rather than printing extra
"start" versions of tiles, use separate start tokens (up to 4 per map) placed on the planet during
setup. This keeps the set at 25 tiles.

**The tile set.** The most of each planet any map in `maps.yaml` uses at once:

| Tile | Count |
|---|---|
| Planet 7 | 8 |
| Planet 8 | 8 |
| Planet 9 | 4 |
| Planet 10 | 4 |
| Void | 1 |
| **Total** | **25** |

(The "Everything" map uses all 25.) Empty tile slots (`.` in the layouts) are gaps in the map, not
tiles.

**Sheets.** A 102 mm tile with bleed fits **2 × 2 per A4 or US Letter page** (204 mm of 210/216 mm
width), so print-and-play is 7 pages of faces. Print-on-demand vendors get one 102 × 102 mm file per
tile.

### Cards

Built: `cardSvg` / `cardBackSvg` in [`packages/art/src/card.ts`](../packages/art/src/card.ts), shown and
exported in the Art Lab (`#lab/cards`).

- **Size**: poker, 63.5 × 88.9 mm, 3 mm bleed (69.5 × 94.9 mm), 3 mm corner, 3.5 mm safe zone.
- **Two looks by deck**: permanent cards (CE Skills, original Commands) are light with the art in a
  framed window; one-shot cards (Tactics, Gambits, Expansion) are dark with full-bleed art. The decks
  tell apart across the table and face down, like the physical game's light and dark decks.
- **Face**: illustration (top ~half), HUD label with the category and ×copies, a category emblem
  straddling art and panel, name (Orbitron), subtitle, rules text with game terms in bold, footer with
  deck · kind and `CUBIC CE 07/35`.
- **Colour = category** (movement cyan, action amber, combat red, conquer green, research violet,
  ship blue, cards orange, expansion teal). Tactics and Gambits get a category from `THEMES` in card.ts.
- **Illustration = one scene per card**, showing what the card does: Agile's ship flies a fourth,
  glowing space; Brutal rolls two combat dice and strikes out the higher; Sabotage shorts out one of
  an opponent's action chips. Scenes live in `packages/art/src/scenes/` (skills, tactics + expansion,
  original), keyed by card id; each has a one-line caption the Art Lab shows under the card. Original
  cards that do the same as a CE card get a different picture of the same idea. A test checks that
  every card has a scene and no two draw the same.
- **One drawing kit** (`cardkit.ts`) keeps the set consistent: ships are isometric dice with real pip
  layouts, cubes are plain dice, the board is an isometric holo-grid the dice stand on, planets and
  skies come from the tile generators. Rules quantities are flat HUD readouts over the scene, always
  drawn the same way: research (violet) and dominance (red-orange) tracks, hexagonal action chips,
  white combat dice, small cards. Numbers in the art are numerals only (`+1`, `×2`, `−2`), so the
  art needs no translation.
- **Text is SVG**, not HTML as first planned, so one file per card goes to PNG/ZIP and to print
  services. Wrapping uses widths measured with the page's fonts (canvas `measureText`), and the same
  fonts are embedded in each SVG as data URLs, so the layout matches what was measured. Text shrinks in
  0.1 mm steps until it fits. Without the fonts (offline), cards fall back to system fonts.
- **Exports**: one card as PNG 300/600 dpi or SVG; the whole set as a ZIP of 300 dpi PNGs, one folder
  per deck with its back; print sheets, 3 × 3 per A4/Letter page at trim size with crop marks,
  optionally all copies and duplex backs (mirrored columns), printed to PDF from the browser.

### Card art

The art window takes either:

1. **Procedural art** from `packages/art` (planet, starfield, ship silhouettes), always available,
   good for prototypes and for "set" consistency; or
2. **An image** (commissioned or AI-assisted illustration), listed in `data/art.yaml` with source,
   author and licence. The build fails if an image is missing its licence entry.

Art image requirements: at least **300 dpi at final size including bleed**, better 600 dpi for
headroom. For a card art window filling the whole card with bleed (69.5 × 94.9 mm) that's
**≥ 821 × 1121 px**, ideally ~1650 × 2250 px. Keep originals in RGB, 16-bit PNG/TIFF where possible.

### Iconography

Replace text and pips with one icon set drawn on a 24-unit grid with mm-based stroke widths:
ships 1–6 (also for custom dice faces), actions, dominance, research, missile, cube, card categories.
These are the most reused pieces, so they come first.

---

## 3. The Art Lab (explore and export)

A dev-only route in the web app, e.g. `/#/lab`:

- Pick a component (Starfield, Planet, Tile, Card, Card back…), see it large.
- Sliders and pickers for its parameters (seed, palette, density, planet type, ring on/off…), with
  the URL holding the current settings so a look can be shared.
- A **grid view**: the same component with 24 seeds, to spot variety and pick favourites.
- **Context view**: the planet on a tile, on a card and at in-game size side by side, to check it
  stays readable small and stays good large.
- **Export buttons**: SVG (direct), PNG at chosen dpi (rasterise in the browser via canvas), and
  "Pin": writes the chosen seed/parameters into `data/art.yaml` (copy-paste YAML at first; a dev
  server endpoint later).
- **SVG for Illustrator**: the art is built from SVG filters (noise, displacement, colour ramps),
  which only browsers render; Illustrator drops them and also doesn't read `hsl()` colours. This export
  embeds the art as a 600 dpi PNG (layer `art`) with the markings on top as plain vectors (layer
  `markings`: hex colours, no `paint-order`), so it opens looking the same and the markings stay
  editable. The plain SVG export is for browsers only.
- **Print preview**: CMYK-ish soft-proof toggle (a rough simulation, see §4) and bleed/safe-zone
  overlay.

`data/art.yaml` (new) records the pinned choices:

```yaml
planets:            # keyed by map + planet, or by number for defaults
  default: { 7: { palette: green }, 8: { palette: ice }, 9: { palette: gold }, 10: { palette: magma } }
  overrides:
    - { map: alpha-sector, planet: p3, seed: 81723, type: gas, rings: true }
cards:
  agile: { art: procedural, seed: 4412 }
  brilliant: { art: images/cards/brilliant.png, author: "…", licence: "…", source: "…" }
backs:
  skill: { seed: 12 }
```

---

## 4. Print pipeline

### Rendering

`scripts/print.ts`, run with `npm run print -- <target>`:

1. Starts Vite (or uses a build) and opens a **print route** (`/#/print/<target>`) in Playwright
   Chromium. The print route lays out pages with the same `packages/art` components.
2. Waits for fonts and images (`document.fonts.ready`, image `decode()`).
3. Calls `page.pdf({ width, height, printBackground: true, preferCSSPageSize: true })` per output.
4. For PNG outputs (vendors that want one image per card), screenshots each element at the target
   dpi with `deviceScaleFactor`.

Because the print route is a normal page, it can be opened in a browser to check before printing.

### Outputs

| Target | What | Size |
|---|---|---|
| `cards-pod` | One PDF page (or PNG) per card face and back, with 3 mm bleed, no marks | 69.5 × 94.9 mm |
| `cards-pnp` | Print-and-play sheets, 3×3 cards, crop marks, duplex backs mirrored | A4 and US Letter |
| `tiles` | One file per tile (25) with bleed, plus backs | 102 × 102 mm |
| `tiles-pnp` | Tiles 2 × 2 per page with crop marks | A4 and US Letter |
| `player-board` | Player board / reference sheet | A4 or A5 |
| `proof` | Contact sheet of everything at reduced size, for review | A4 |

Card and tile **trim, bleed and safe zone** live in tokens, with the vendor's numbers once chosen
(MakePlayingCards, The Game Crafter, DriveThruCards differ slightly). Safe zone default: 3 mm inside
the trim.

Tile, planet and cube-pad sizes are in §2a.

### Things that behave differently in print

- **Filters are rasterised.** Chromium turns `feTurbulence`, `feGaussianBlur` and friends into
  bitmaps inside the PDF, at a resolution we don't fully control. For printed pieces, **bake heavy
  effects to images first**: render the background layer alone to PNG at 600 dpi, then place that
  image under the vector layers (planet numbers, grid, text, icons stay vector). The art components
  take a `mode: 'live' | 'baked'` prop for this.
- **The same trick helps in-game performance.** Rendering a turbulence nebula per tile every frame is
  slow; the game can bake each tile's background once into an image (cached by seed) and draw that.
- **Colour.** Chromium produces RGB PDFs. Most print-on-demand vendors accept RGB and convert;
  if one needs CMYK, convert with Ghostscript and an ICC profile as a last step. Dark space art
  needs care either way:
  - neon cyans, violets and greens on screen fall outside CMYK and print duller; choose palette
    colours that survive conversion, and check them in the lab's soft-proof;
  - large dark areas: use a deliberate rich black rather than pure RGB black, and stay under the
    vendor's ink limit;
  - order one physical proof before any real run.
- **Fonts.** Self-host the font files (Inter and Orbitron are both SIL Open Font License, so
  embedding is allowed) instead of the Google CDN, so PDFs embed them and builds work offline.
- **Thin lines.** Keep printed strokes ≥ 0.15 mm and text ≥ 6 pt; tokens enforce minimums.

### Checks

- `pdffonts` / `pdfinfo` in CI: every font embedded, page size as expected.
- Visual snapshots (Playwright screenshots) of each art component at two sizes, so an art change
  shows up in review.
- Text-fit test: every card's rules text fits its box.
- Licence test: every image referenced in `art.yaml` has author, source and licence.

---

## 5. Phases

Each phase leaves the game working and better-looking.

**Phase 1 — Foundations (no visible change)**
- [x] Create `packages/art` with tokens, seeded RNG, scoped ids, mm units.
- [x] Tile, void and planet drawing moved out of `Board.tsx` into `tileSvg` / `planet` / `starfield`.
- [ ] Gate drawing likewise
      components; `Board.tsx` places them and keeps the interactive layer.
- [ ] Self-host fonts; generate the app's CSS colour variables from tokens.

**Phase 2 — Print loop working end to end (ugly is fine)**
- [ ] Print route + `scripts/print.ts`; output current cards and tiles as `cards-pnp` and `tiles`
      PDFs with bleed and crop marks.
- [ ] Convert `CardView` to the mm/`cqw` card used by both the game and print; add art window and
      backs.
- [ ] PDF and text-fit checks.

**Phase 3 — Art Lab**
- [x] Lab route (`#lab`): all 25 tiles, seed/type/rings controls, SVG, SVG for Illustrator and PNG (300/600 dpi) export.
- [ ] Context view (tile vs. card vs. in-game size) and starfield/planet-only views.
- [ ] `data/art.yaml` and pinning.

**Phase 4 — The new look**
- [ ] Art direction: mood board, palette (tested for colour-blind players and for CMYK), type.
- [ ] Icon set (ships 1–6 first).
- [x] First pass: seeded starfield with warped-noise nebula, filaments and dust; five planet types (gas, rocky, ice, lava, ocean), each planet number its own kind of world from noise with sphere shading, atmosphere and rings; Void rift.
- [ ] Iterate on the look in the lab; card frames and backs.
- [x] The game maps each planet to a tile id (`assignTiles`), so a tile looks the same on every map.
- [ ] Pin the chosen seeds for all 25 tiles in `art.yaml` (the lab shows each spec to copy).
- [ ] Print one test tile at 100 % and check it with real 19 mm dice and cubes before the full set.
- [x] In-game tiles are drawn once to images and cached in IndexedDB; drawn in the background in the lobby.
- [ ] Pre-rendered PNG backgrounds for print (filters rasterise at an uncontrolled resolution in PDFs).
- [ ] App background uses the same starfield.

**Phase 5 — Production**
- [ ] Choose card and tile vendor; set trim/bleed tokens to their specs.
- [ ] Card art (procedural or illustrated) for every card, with licences.
- [ ] Player board, tile backs, box art, rulebook diagrams (rendered from engine states with the
      same components).
- [ ] Physical proof, then fix colours.

---

## Open decisions

- **Cube size**: pads assume cubes up to 10 mm; measure the cubes we'll use.
- **Tile thickness / material** (chipboard vs. card), from the vendor.
- **Vendor** (sets bleed, colour handling, file format).
- **Card art source**: procedural only, commissioned, or AI-assisted with human art direction.
  Affects budget, look and licensing (see the IP note in ROADMAP M0: no reuse of original or fan art).
- **Name** on the printed components (the app is currently titled "Cubic").
