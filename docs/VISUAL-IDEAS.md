# Visual & Appeal Ideas

Ideas for making Cubic look better and pull people in, from a review of the whole game
(lobby, board, market, battle, game over and the Art Lab) on desktop and phone in October 2026.
Nothing here is scheduled yet; the backlog lives in [ROADMAP.md](ROADMAP.md), and the art pipeline
in [GRAPHICS.md](GRAPHICS.md).

The foundation is already strong: a consistent dark space theme, seeded planet tiles, CSS 3D dice,
ships that glide between spaces, explosions and synthesised sound. What's missing is **spectacle
and personality at the moments that matter**, and the best art in the project (the card
illustrations) is mostly hidden in the Art Lab.

**Top three:** [1. Card art in the market](#1-card-art-in-the-market),
[2. Battles as a show](#2-battles-as-a-show), [3. A game over worth sharing](#3-a-game-over-worth-sharing).
1 and 3 mostly reuse art and data we already have; 2 is more work but is where players will feel
the difference most.

---

## The biggest gains

### 1. Card art in the market

**Today.** Every card has a full illustrated scene drawn by `cardSvg`
([card.ts](../packages/art/src/card.ts), scenes in [`scenes/`](../packages/art/src/scenes)): the
Agile grid, the Momentum orbit, the Precocious flask. In game, the market
([Market.tsx](../apps/web/src/components/Market.tsx)) shows the same cards as plain HTML tiles
(white for skills, dark for tactics), and the art only appears when you tap a card and the
[CardViewer](../apps/web/src/components/CardViewer.tsx) opens.

**Idea.** Give each market card an art band across its top, cropped from the printed card's
illustration, with the category stripe, name and text below, as on the printed card.

- The images already exist: [cardImages.ts](../apps/web/src/art/cardImages.ts) renders and caches
  them, and the market already warms them (`warmCardImages`). What's needed is a cropped version
  (or `object-position` on the full image) for the band.
- Fall back to today's tile while an image is still rendering, so nothing waits on art.
- On a phone the cards are small, so a short band (about a third of the card) is enough. The
  colour and shape carry the recognition.
- The same thumbnails can be used for the skill chips in the player list and for the "card played"
  flash.

**Why.** This is the cheapest change with the biggest effect. The market is on screen all game,
and illustrated cards are what make a card game look premium.

### 2. Battles as a show

**Today.** [CombatOverlay.tsx](../apps/web/src/components/CombatOverlay.tsx) opens a modal with
both fleets side by side, reveals the dice after 1.25 s, prints the totals, announces the winner
("Vex will repel the attack") and waits for *Resolve battle*. The explosion then plays on the
board after the popup closes ([Explosions.tsx](../apps/web/src/components/board/Explosions.tsx)).
It's clear, but it reads as a scoreboard.

**Idea.** Stage the battle in beats:

1. **Approach.** Before the popup, the attacking ship lunges toward the defender on the board
   (or the board zooms to the two spaces), with a short charge-up sound.
2. **Roll.** Both combat dice tumble at once with `Die3D`, landing a few hundred ms apart to
   build tension.
3. **Count.** The totals count up from the ship value, and the lower one pulses.
4. **Verdict.** The winner's side flares in their colour, and the loser's ship explodes *inside*
   the popup (or the popup fades and the board explosion follows straight on).
5. **Missile.** Firing a missile gets its own streak of light across the popup and a distinct
   sound, since it's a big swing.

- Keep it skippable: a tap or key skips to the verdict. Online playback (`COMBAT_MS` in
  [playback.ts](../apps/web/src/online/playback.ts)) and the AI driver (`COMBAT_RESOLVE_MS`) need
  to agree on the new length.
- Respect `prefers-reduced-motion`: keep only the fades.

**Why.** Battles are the emotional peak of Quantum (the moment your 1 survives or your 6 dies),
and right now they get the least drama.

### 3. A game over worth sharing

**Today.** A blurred board behind one card: "Victory · Commander conquers the sector · All cubes
placed after 1 turn", with *View board* and *New game*.

**Idea.**

- **Celebrate.** Flood the board in the winner's colour, then light up their cubes one planet at
  a time with a chime each.
- **A real headline.** Name the defeated: "Fleet Admiral Vex defeated in 14 turns".
- **Stats panel.** Battles won and lost, planets taken, ships destroyed, research gained, the
  turn the game was decided, each player's cube count. The log already holds all of it (the
  events in `game.log`).
- **Timeline.** A small strip of dominance or cubes per turn per player, so you can see where the
  game swung. *View board* could step through it with the existing look-back mode
  ([past.ts](../apps/web/src/game/past.ts)).
- **Share image.** See [Share card](#share-card).

**Why.** A screen people want to screenshot is free marketing, and a finish that feels earned is
what makes people play again.

### 4. A lobby that shows the game

**Today.** The three-die logo and gradient title are good, but below them is a settings form.
The map picker shows a grid of planet numbers.

**Idea.**

- **Live background.** Behind the form, show the selected map with its real tiles, slowly
  drifting, planets turning, a few dice gliding between spaces as if in a quiet AI game.
  Re-render when the map changes.
- **Map preview with art.** Replace the number grid with a small render of the tiles, with
  player-colour starting spots marked.
- **Opponent cards.** Each AI seat shows its name, portrait (see 7) and level as a little
  "rival" card, not just a dropdown.
- **One-tap start.** A big "Quick game vs AI" button above the form for first-timers, with the
  full setup below.

**Why.** People decide whether to try a game in the first five seconds, and the lobby is the
first thing they see.

---

## Board & layout

### 5. Use the space on big maps

**Today.** On Event Horizon (4 players, cross-shaped) at 1440×900, the map fills about a third
of the board area and the dice are small. On a phone (412 px wide) the dice are about 12 px.

**Idea.**

- Fit the zoom to the map's actual occupied tiles, not its bounding box, and let it crop
  empty corners ([zoomGeometry.ts](../apps/web/src/components/board/zoomGeometry.ts)).
- On phones, open zoomed onto your home sector at your first turn, with a clear "fit map"
  control (the zoom UI is in [ZoomUi.tsx](../apps/web/src/components/board/ZoomUi.tsx)).
- When it's an AI's turn on a phone, gently pan to where they act, then back.

### 6. Planets that read as prizes

**Today.** Ownership is a small square cube on the planet; the planet number sits beside it.
Basic maps print the planet's name and stats in tiny text on the tile.

**Idea.**

- **Ownership.** A planet you hold gets an orbit ring or atmosphere glow in your colour, so the
  board reads as territory at a glance.
- **Race to conquer.** When your ships orbiting a planet add up to its number (or are one away),
  light the planet up, telling you "you can take this".
- **Names.** Show the planet's name as a proper label on hover or tap, instead of the
  unreadable print.
- **Contested planets.** A subtle crackle when ships of two colours orbit the same planet.

The markings live in [PlanetMarkings.tsx](../apps/web/src/components/board/PlanetMarkings.tsx);
the reachability logic for the hints is in [highlights.ts](../apps/web/src/game/highlights.ts).

### 7. A sidebar with character

**Today.** The player list is tidy but text-only, and below it the space is empty except for a
collapsed Captain's Log.

**Idea.**

- **Portraits.** Commander, Vex, Orion, Lyra and the fifth seat each get a portrait or faction
  emblem. They can be generated in the same seeded-SVG style as the art package, so they print
  too. This alone adds a lot of personality.
- **Your hand.** Your skills shown as small art cards, not text chips.
- **Live log.** Open the Captain's Log by default when there's room, with an icon per event
  (battle, conquest, research, card) and the player's colour.
- **Standings.** A small race bar: cubes placed per player, so you always know who's close to
  winning.

---

## Feel & polish

### 8. An effect for every move

Cubes already pop in (`cube-in` in [styles.css](../apps/web/src/styles.css)) and ships glide.
Extend that to every action, short and different from each other:

| Action | Effect |
|---|---|
| Deploy | Warp-in flash and a ring expanding from the planet |
| Move | The glide we have, plus a faint engine trail |
| Reconfigure | The die spins and re-rolls in place |
| Research | A purple pulse up the research track |
| Conquer | The cube drops in from above with a shockwave across the tile |
| Card played | The card's art (see 1) flies from the market to the player |

All under 500 ms, so they never slow play down, and none under reduced motion.

### 9. Clear turn changes

- When a turn starts, sweep that player's colour across the top bar or the action panel, with
  their portrait.
- Pace AI turns so each action is readable (a short pause between actions), with the camera
  nudging toward the action on small screens.
- "Your turn" already chimes; add a visible banner when the window was in the background.

### 10. Music & ambience

Sound effects are synthesised in [sound.ts](../apps/web/src/sound.ts). Add a quiet generative
space drone in the same way (slow pads, no download), which swells a little during battles and
on your turn, with its own toggle separate from effects.

---

## Reaching new players

### Interactive first game

A guided three-minute Basic game against a Cadet: the board highlights what to do ("tap your 4,
it can move 4 spaces", "your ships add up to 7: conquer!") and the rules are learnt by doing.
The in-app rules and the [hints](../apps/web/src/game/hints.ts) are a start; this makes it a
first experience rather than a reference.

### Share card

An image made at the end of a game: the final board, the winner, the stats from
[3](#3-a-game-over-worth-sharing) and a link to play. Online games could post it to the
invite chat; anywhere else it goes through the share sheet (`navigator.share`) or downloads.
The art package already renders boards to images, so it can reuse that.

### Name & identity

"Cubic" is a working title. A final name and a logo mark beyond the three dice (something that
works at 32 px for the home-screen icon and the browser tab) would make the game feel finished.
The icons are in [`public/`](../apps/web/public).
