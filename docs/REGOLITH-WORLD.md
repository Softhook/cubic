# Regolith: the world

The one place where Regolith's setting is decided: the story, the sides, the six mechs, the places
worth fighting over, and the words the game uses. Cards, scenes, the player aid, the rulebook and the UI
take their names and flavour from here; when a name changes, it changes here first.
[REGOLITH.md](REGOLITH.md) is how the game is built; this is what it is about.

Everything below is a first draft, to be argued with. Names already on the
[mood board](moodboards/regolith/README.md) (Vocabulary, Mechs, CardStyles) are kept where they still fit.

## The story

**Regolith**: the loose dust and broken rock that covers the moon and Mars. Everything here is built on it, and
everything gets buried in it.

> For forty years the settlements on Mars lived on contracts with Earth: water, power and parts went
> out on the same ships that brought the next crews. Then the ships stopped. Nobody on Mars was told why.
>
> What was left was what was already there: four settlements that had never needed to trust each other,
> a few refineries and reactors, and the ice. Ice is drinking water, air and rocket fuel. There was never
> enough of it near the surface for everyone, and now there is no one to send more.
>
> The mechs were never meant for war. They were mining and construction frames: walkers that dug ice,
> hauled tanks and raised habitat domes. The same chassis takes a drill, a crane, a sensor mast or a
> cannon, and in the first winter of the shortage every workshop on Mars learned to fit cannons.
>
> Nobody can afford to destroy what they are fighting for. A cratered refinery feeds no one. So the war is
> fought for **control**: walk your mechs into the ground around a site, hold it, and plant your claim
> beacons where the others can't pull them out. The side whose claims stand on every site it needs
> outlasts the rest.

**The moon** is the same war, earlier and colder. The first fighting over ice was in the moon's dark polar
craters, between the crews Earth left there; the moon maps are that front. Its ground is grey and its
light is hard; on Mars the ground is rust and the light is dusty.

## Themes

What every card, scene and line of text should feel like:

- **Scarcity.** Water is the prize behind every objective. Nobody is fighting for glory or territory for
  its own sake.
- **Make do.** Machines are refitted, patched and salvaged, never new. A destroyed mech goes to the salvage
  yard and comes back as something else. Reconfiguring is a field refit.
- **Weight.** Mechs are slow, heavy and plant themselves. Ground is held by standing on it (zones of
  control, contested orbits), not by racing across it. This is the rules' own aim (PROTOTYPING.md, *From
  Arithmetic Sprint to Positional War*) told as a story.
- **Ground.** Dust, craters, ice, wind, sinkholes. The map is a place, not a grid in space.
- **Working people, not heroes.** Crews, foremen and engineers. No chosen ones, no aliens, no superweapons.
- **Printed matter.** The screenprint style reads like the settlements' own posters, work orders and field
  manuals: flat inks, bold shapes, stencilled numbers.

Not in Regolith: aliens, warp drives, space battles, giant anime robots, gore. Mechs are big machines
(6–9 m), not giants: a habitat dome is always bigger than a mech (Vocabulary board, *Put together*).

## The sides

Four settlements, one per seat colour. For now they are flavour only: every side plays with the same
mechs and rules. They are the starting point if Regolith ever tries asymmetric sides (PROTOTYPING.md §6.6).

| Seat | Colour | Side | Who they are | Wants |
|---|---|---|---|---|
| 1 | Cyan `#4cc9f0` | **Borealis Cooperative** | Ice miners from the north polar cap, the oldest settlement. Run by their work crews. | To keep the ice that was theirs first |
| 2 | Magenta `#f72585` | **Meridian Extraction** | What is left of the Earth-chartered company: the contracts, the refineries and the best workshops. | To keep running Mars as a business |
| 3 | Amber `#ffb703` | **Tharsis Free Port** | Traders and fixers from the volcanic highlands, who own the reactors and owe nobody. | Power, and the price of it |
| 4 | Green `#80ed99` | **Hellas Domes** | Farm settlements in the deep Hellas basin, the most people and the thirstiest crops. | Water, before the next harvest fails |

The colours are `PLAYER_COLORS` in [theme.ts](../apps/web/src/theme.ts); if they change, the sides follow
their seats, not their colours. Players still choose their own names in the lobby.

## The six mechs

One chassis, six fits. A mech's die value is its current fit: lower is heavier and harder to beat in
combat, higher is lighter and quicker. Reconfiguring re-rolls the die: the crew refits the frame in the field.

| Die | Mech | Fit | Regolith power (rules as they stand) | Why it fits | Silhouette (Mechs board) |
|---|---|---|---|---|---|
| 1 | **Bastion** | Dug-in turret walker | *Free Attack*: attack an adjacent enemy without using its move | Sits on the ground with its gun already trained | Squat, wide stance, turret on top, braced legs |
| 2 | **Herald** | Command carrier | *Carry & Move*: carry a nearby mech as part of its move, drop it next to it | Hauls other frames in its cargo cradle; leads the column | Tall, cradle on the back, mast and lights |
| 3 | **Breacher** | Tunnelling assault frame | *Swap*: swap places with any of your other mechs | Bores through the ice tunnels and surfaces where another mech stood | Heavy arms, drill and ram, hunched |
| 4 | **Warden** | Line mech with a modular hardpoint | *Change to 3 or 5*: refit as a Breacher or a Kestrel | The standard frame: one arm swap away from either | Upright, long gun, missile pod, the "default" mech |
| 5 | **Kestrel** | Jump-jet gunship | *Shoot*: attack the first enemy in a clear straight line, without moving | Fires from the top of its jump, down a line of hexes | Light, jets on the back, legs folded for landing |
| 6 | **Wisp** | Recon drone | *Free Reconfigure*: re-roll for free | Cheap and fragile, swapped out without a second thought | Hovering drone, sensor eye, no legs |

**Silhouette reference:** [mech-silhouettes.jpg](moodboards/regolith/reference/mech-silhouettes.jpg), twelve
front views (reference only, not ours to print). The mechs should read apart by outline alone, in black, as
these do. Rows and columns count from the top left:

| Mech | Closest silhouettes | What to take |
|---|---|---|
| Bastion (1) | Row 3, 1 and 2 | Squat, solid, low and wide; legs barely visible |
| Herald (2) | Row 2, 1 and 2 | Flat wide body slung between long crane arms: a carrier |
| Breacher (3) | Row 1, 3; row 3, 3 | Hunched, long heavy arms, a drill or ram |
| Warden (4) | Row 1, 1; row 3, 4 | Upright and boxy, missile pod on the shoulder, long gun: the standard frame |
| Kestrel (5) | Row 1, 4 | Top-heavy gun body on thin legs; add jets |
| Wisp (6) | Row 2, 3 | Small pod on spindly legs; lighter than the rest (or lifted off the ground, as the Vocabulary board's drone) |

The mood board drew the Kestrel taking the diagonal, which was Community's 5. Regolith's 5 shoots
instead, so its art should show it firing from the air rather than jumping a corner. If a mech's power
changes in PROTOTYPING.md, its row here changes with it, and the name stays only if it still fits.

## Objectives

The planets of Quantum are the sites worth holding. Their number is what it takes to claim them, so the
bigger the site, the more it is worth fighting for.

| Number | Objective | What it is | On the mood board |
|---|---|---|---|
| 7 | **Habitat** | Pressure domes and a connecting tube, where crews live | Domes and a tube |
| 8 | **Refinery** | Turns ice and regolith into water, air and fuel | Tanks, stacks, pipes |
| 9 | **Ice Mine** | A drill over a buried ice sheet | Derrick, shed, ice heap |
| 10 | **Reactor** | Power for everything around it | Cooling tower, dome |
| Void | **Sinkhole** | Ground that collapsed into a melted ice pocket. Nothing to hold, but a mech there finds out what lies under the map (Research → Intel) | A hole in the map |

Props on the board and on cards: bunker, comms mast, drop pod, barricade, boulders (Vocabulary board).

## The words

How Quantum's terms read in Regolith. A Regolith card uses these as soon as it is renamed; the rest of the
UI follows once the mode-wide vocabulary exists ([REGOLITH.md](REGOLITH.md) §7).

| Quantum | Regolith | Note |
|---|---|---|
| Ship | **Mech** | Battlestation … Scout become the six mechs above |
| Planet | **Objective** | Habitat, Refinery, Ice Mine, Reactor; Void → Sinkhole |
| Orbit, orbital positions | **Perimeter** | The hexes around an objective. *Proposed* |
| Quantum cube | **Claim beacon** (short: **claim**) | Planted on an objective; placing your last one wins. *Proposed* |
| Conquer | **Stake a claim** | *Proposed* |
| Dominance | **Control** | |
| Research | **Intel** | |
| Scrapyard | **Salvage yard** | |
| Reconfigure | **Refit** | *Proposed* |
| Deploy | **Drop** | A mech arrives by drop pod. *Proposed* |
| Missile | **Ordnance** | |
| Warp Gate | **Ice Tunnel** | |
| Skill / Tactic decks | *Undecided* | Candidates: Doctrine / Orders, Upgrades / Gambits, Kit / Field Orders |
| Sector (map names) | **Region** | Real places: Utopia Planitia, Hellas Basin, Tharsis Rise, Arcadia; on the moon, Shackleton, Peary, Malapert. *Proposed* |

## Where the names live in code

So that a name changed here is changed once in code:

- **Mech names and power texts:** Regolith's ship table (`PROTOTYPING_SHIPS`, to become `REGOLITH_SHIPS`)
  in the mode's folder. Today the web app takes ship names from the engine's global `SHIP_NAMES` (board,
  hints, combat and other overlays), not from the mode's table; those callers need to ask the game's rule
  set for the name instead, so a Regolith game says "Bastion" and a Community game "Battlestation".
- **Mech art:** `packages/art/src/screenprint/mechs.ts` is keyed by die value, not by name, so a rename
  needs no art change.
- **Objective names:** a table keyed by planet number in the mode's folder, next to the ship table, read
  by the UI and the cards.
- **The other words:** the mode-wide vocabulary that `RuleSet.cards.terms` grows into.
- **Side names:** not in code until the game uses them (lobby seat defaults, a faction rule).
