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
| [Cards](Cards.dc.html) | Unit card, skill, tactic, back |
| [Ladder](Ladder.dc.html) | One card's art at four levels, diagram to painted |
| [Surface](Surface.dc.html) | Photographic ground from one lit height map (height, smoothness and brightness in the red, green and blue channels), before and after, and how Chrome, Firefox and Safari differ |
| [MechStudy](MechStudy.dc.html) | A detailed mech as full-art card art, built up in six layers (paint, shading, panel lines, light, wear, glow), at full and actual size |
| [HexSurface](HexSurface.dc.html) | The seven-tile map redrawn from the Surface study's lit height map, weathered, overlapping craters, objectives built round their cube bays (1–4), and plain pip dice in the side colours |
| [GroundMechs](GroundMechs.dc.html) | Ground × mechs: a moon and a Mars tile from the game's own renderer four ways (today, recoloured in the mech inks, quieter, screenprint), with the Silhouettes mechs standing on them as counters. The `ground-*.jpg` renders are its images |
| [CardStyles](CardStyles.dc.html) | Four real cards renamed for the theme (Agile, Ferocious, Show of Force, Warp Gate) drawn three ways at print size: detailed (the Mech Study model), cinematic silhouette and screenprint, plus the new words |
| [RegolithCards](RegolithCards.dc.html) | All 44 Regolith cards (data/regolith.yaml) as the screenprint renderer draws them: each scene is an uploaded render (opened from the repo, the board shows no art); the name, label and rules are board text to retype. Under each card: the Community card it came from, its subtitle, art brief title and the other names from card-ideas.yaml. Carry changes back into data/regolith.yaml |
| [World](World.dc.html) | The setting as a screenprint bulletin: the story, the four sides, what it feels like, the objectives and the words ([REGOLITH-WORLD.md](../../regolith/REGOLITH-WORLD.md)) |
| [Roster](Roster.dc.html) | The six mechs: die face, fit, power and the reference silhouettes for each. Their names are the board's Tweaks (*Mech names*), so a rename shows everywhere on the board; copy a settled name into REGOLITH-WORLD.md |
| [Silhouettes](Silhouettes.dc.html) | Our own front-view outline for each of the six mechs, in one ink and to one scale beside a 1.8 m person: a lineup, then one panel per mech. Drawn from each mech's fit, with weight, stance and scale taken from the reference sheets but no outline copied |

**Reference images** (other people's art, for looking at only: not to be traced, printed or shipped):

| Image | What it's for | Source |
|---|---|---|
| [mech-silhouettes.jpg](reference/mech-silhouettes.jpg) | Twelve front-view mech silhouettes: industrial walkers with boxy or domed bodies, heavy and spindly legs, claw, drill and gun arms. The weight and range of shapes for the six mechs ([REGOLITH-WORLD.md](../../regolith/REGOLITH-WORLD.md) *The six mechs*) | Pinterest, `i.pinimg.com/1200x/f0/02/12/f002126832905d7f7582f08f3b746c36.jpg`; artist not credited there. Uploaded to the canvas as `/_blob/171dfca01254210e3507e462e1f69d33`, which the Roster board crops; opened from the repo, that board shows no silhouettes |
| [mech-silhouettes-2.jpg](reference/mech-silhouettes-2.jpg) | Eight front-view mech silhouettes in two rows of four, each beside a human figure: walkers with gun, cannon and missile arms, a shield, a four-legged turret. Scale against a person, and more weapon shapes | Unknown; the uploaded file was named `360_F_2189037674_…`, a stock-photo preview's name, so probably a stock image. Uploaded to the canvas as `/_blob/dc782efb217408f61db8a0ccbf2f0491`, shown whole on the Roster board |

Each board is a static HTML page and opens in a browser as it is. The `support.js` it asks for belongs
to the canvas editor; without it the page draws the same, only not editable. `canvas.json` is the
canvas layout, kept so the set can be published back as a canvas.
