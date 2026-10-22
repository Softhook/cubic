# Regolith mood board

A look for a moon-and-mech reskin of the hex mode, after *Undaunted 2200* (Callisto, Revolution): survey-style
hex tiles, mech dice, cards, and how illustrative the card art could get. These are hand-drawn mock-ups, not
output from `packages/art`.

Live canvas: https://claude.ai/artifact/HXXvHR2kv7qATjy7nCudZb (private to its owner)

| Board | What it shows |
|---|---|
| [Main](Main.dc.html) | Direction, palette, type |
| [HexMap](HexMap.dc.html) | Seven hex tiles: ground, objectives (7–10, Void), terrain, mech dice, control zone |
| [Tiles](Tiles.dc.html) | One tile in three styles: survey, lunar chart, ops display |
| [Mechs](Mechs.dc.html) | The six classes as mech die faces, side colours, side-view silhouettes |
| [Cards](Cards.dc.html) | Unit card, skill, tactic, back |
| [Ladder](Ladder.dc.html) | One card's art at four levels, diagram to painted |
| [Surface](Surface.dc.html) | Photographic ground from one lit height map (height, smoothness and brightness in the red, green and blue channels), before and after, and how Chrome, Firefox and Safari differ |
| [MechStudy](MechStudy.dc.html) | A detailed mech as full-art card art, built up in six layers (paint, shading, panel lines, light, wear, glow), at full and actual size |
| [HexSurface](HexSurface.dc.html) | The seven-tile map redrawn from the Surface study's lit height map, weathered, overlapping craters, objectives built round their cube bays (1–4), and plain pip dice in the side colours |
| [CardStyles](CardStyles.dc.html) | Four real cards renamed for the theme (Agile, Ferocious, Show of Force, Warp Gate) drawn four ways at print size: detailed (the Mech Study model), cinematic silhouette, screenprint and field-manual diagram, plus the new words |
| [CardScale](CardScale.dc.html) | The same cards at the app's card-viewer and market sizes, and which style to use for what |
| [Vocabulary](Vocabulary.dc.html) | Screenprint parts: the six mech classes, the objectives (Habitat to Reactor, Sinkhole) and props, printed as plate, key ink and accent, with three scenes built from them |

Each board is a static HTML page and opens in a browser as it is. The `support.js` it asks for belongs
to the canvas editor; without it the page draws the same, only not editable. `canvas.json` is the
canvas layout, kept so the set can be published back as a canvas.
