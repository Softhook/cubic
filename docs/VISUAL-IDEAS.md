# Visual & Appeal Ideas

Ideas for making Cubic look better and pull people in, from a review of the whole game
(lobby, board, market, battle, game over and the Art Lab) on desktop and phone in October 2026,
updated on 16 October 2026 after the first round of polish landed. The backlog lives in
[ROADMAP.md](ROADMAP.md), and the art pipeline in [GRAPHICS.md](GRAPHICS.md).

The game now *moves* well: every action has its effect, cards fly and cast, shots cross the map,
the lobby has a live backdrop, and there is music. What's still missing is **information and
identity at the moments that matter**: the market still hides the card art, the game over
doesn't say what happened, and the players have no faces.

**Top three now:** [1. Card art in the market](#1-card-art-in-the-market),
[2. A game over that tells the story](#2-a-game-over-that-tells-the-story),
[3. Battles as a show](#3-battles-as-a-show).

---

## Done since the first review

- **Effects for every move** ([ActionEffects](../apps/web/src/components/board/ActionEffects.tsx)):
  deploy warp-in, engine trail, conquer shockwave. Reconfigure was tried and dropped.
- **Card effects** ([CardEffects](../apps/web/src/components/board/CardEffects.tsx),
  [CardCast](../apps/web/src/components/CardCast.tsx),
  [CardFlight](../apps/web/src/components/CardFlight.tsx)): a taken card flies from the market to
  its player with its art; a played card casts beams to what it marks.
- **Panel effects** ([panelEffects.ts](../apps/web/src/components/panelEffects.ts)): track pulses,
  chips flashing on, off and away.
- **Shots** ([Shots](../apps/web/src/components/board/Shots.tsx)): a missile crosses the map before
  a ranged battle opens, with its own sound.
- **Following the action**: zoomed in, the map pans to an opponent's moves
  (`useFollowMoves` in [ZoomUi.tsx](../apps/web/src/components/board/ZoomUi.tsx)), and the AI
  pauses to let a played card be read.
- **Victory and defeat**: fireworks, a flash in the winner's colour and a fanfare; a lament and a
  board drained of colour for the loser ([Overlays.tsx](../apps/web/src/components/Overlays.tsx),
  [gameOverSound.ts](../apps/web/src/gameOverSound.ts)).
- **Lobby backdrop** ([Backdrop.tsx](../apps/web/src/components/lobby/Backdrop.tsx)): the chosen
  map's real tiles on a turning plane, with fleets drifting and fighting; a title intro with its
  own opening sound. Its planets stand up as 3D spheres.
- **Music** ([ambience.ts](../apps/web/src/ambience.ts)): a generative drone with its own toggle.
- **Card art in the market** (19 October 2026, idea 1 below): each market card has a band of its printed
  illustration across the top with its name and category icon on it, and the deck piles show the printed card back
  ([Card.tsx](../apps/web/src/components/Card.tsx), [Market.tsx](../apps/web/src/components/Market.tsx)).
  Cards whose text is cut short offer "more", which shows the whole card. Not done yet: thumbnails on the
  skill chips in the player list.
- **Tile art, round one** (picked 17 October 2026 from seven ideas with three candidates each):
  film-style planet lighting (hard terminator, edge-lit atmosphere, back light), spaces and cube slots as etched wells, and a black hole, the old rift and a supernova on the
  three Void tiles
  ([planet.ts](../packages/art/src/planet.ts), [tile.ts](../packages/art/src/tile.ts)). Kept as they
  were: the nebula colours (a corner key light was tried and dropped), the molten 10s, the planet number and the starfield. Not tried yet: ring shadows, and
  animation on the board (drifting clouds, a turning disc).

---

## The biggest gains

### 1. Card art in the market

**Done** (see above). What follows is the original idea.

**Today.** Every card has a full illustrated scene ([card.ts](../packages/art/src/card.ts), scenes
in [`scenes/`](../packages/art/src/scenes)), and the art now shows in play when a card flies or
casts. But the market itself ([Market.tsx](../apps/web/src/components/Market.tsx)), on screen all
game, is still plain HTML tiles.

**Idea.** Give each market card an art band across its top, cropped from the printed card's
illustration, with the category stripe, name and text below, as on the printed card.

- The images exist and are warmed ([cardImages.ts](../apps/web/src/art/cardImages.ts)), and
  `CardArt` is already used by CardFlight. What's needed is a band (`object-position` on the full
  image, or a cropped render).
- Fall back to today's tile while an image is still rendering.
- On a phone a short band (about a third of the card) is enough.
- The same thumbnails can go on the skill chips in the player list (see 6).

**Why.** Still the cheapest change with the biggest effect, and the flights now make the
mismatch more visible: an illustrated card flies out of a plain tile.

### 2. A game over that tells the story

**Today.** The celebration is done. The text is still "Commander conquers the sector · All cubes
placed after 14 turns", with *View board* and *New game*.

**Idea.**

- **A real headline.** Name the defeated: "Fleet Admiral Vex defeated in 14 turns".
- **Stats panel.** Done: cubes, planets conquered, battles won–lost, ships destroyed–lost and
  cards taken per player, counted by the engine (`PlayerState.stats`). Could still add research
  gained and the turn the game was decided.
- **Timeline.** A small strip of cubes (or dominance) per turn per player, showing where the game
  swung. *View board* could step through it with look-back mode
  ([past.ts](../apps/web/src/game/past.ts)).
- **Share image.** See [Share card](#share-card).

**Why.** The ending now *feels* good but says nothing, and a screen worth screenshotting is free
marketing.

### 3. Battles as a show

**Today.** Ranged battles open after the missile lands, but the battle itself is unchanged:
[CombatOverlay.tsx](../apps/web/src/components/CombatOverlay.tsx) reveals the dice after 1.25 s,
prints the totals and the verdict, and the explosion plays on the board after the popup closes.

**Idea.** Stage the popup in beats:

1. **Approach.** For a normal attack, the attacker lunges at the defender on the board before the
   popup opens, as the shot does for ranged ones.
2. **Roll.** Both combat dice tumble at once with `Die3D`, landing a few hundred ms apart.
3. **Count.** The totals count up from the ship value; the lower one pulses.
4. **Verdict.** The winner's side flares in their colour and the loser's ship explodes inside the
   popup (or the board explosion follows straight on).
5. **Missile.** Using a missile to set your roll to 1 gets its own streak and sound.

- Skippable with a tap or key. `COMBAT_MS` ([playback.ts](../apps/web/src/online/playback.ts)),
  `COMBAT_RESOLVE_MS` and `shotWait` ([strike.ts](../apps/web/src/game/strike.ts)) must agree on
  the new length.
- Under `prefers-reduced-motion`, fades only.

**Why.** Battles are the emotional peak of Quantum, and now that everything around them animates,
the static popup stands out more.

### 4. A lobby for first-timers

**Today.** The live backdrop is in. The map preview is still a grid of planet numbers
([NewGameFields.tsx](../apps/web/src/components/lobby/NewGameFields.tsx), `MiniMap`), and AI seats
are dropdowns.

**Idea.**

- **One-tap start.** A big "Quick game vs AI" button above the form, with the full setup below.
- **Map preview with art.** A small render of the real tiles (the backdrop already draws them),
  with player-colour starting spots.
- **Rival cards.** Each AI seat as a little card with name, portrait (see 6) and level.

**Why.** The backdrop sells the game; the form still asks a newcomer to make decisions they can't
judge yet.

---

## Board & layout

### 5. Space and planets

**Use the space on big maps.** On Event Horizon at 1440×900 the map fills about a third of the
board area, and on a phone the dice are about 12 px.

- Fit the zoom to the occupied tiles, not the bounding box
  ([zoomGeometry.ts](../apps/web/src/components/board/zoomGeometry.ts)).
- On phones, open zoomed onto your home sector at your first turn, with a clear "fit map" control.

**Planets that read as prizes.** Ownership is still a small cube beside the planet number.

- **3D planets.** Bring the lobby backdrop's spheres onto the board.

- **Ownership.** An orbit ring or atmosphere glow in the owner's colour, so the board reads as
  territory at a glance.
- **Within reach.** Light a planet up when your ships orbiting it add up to its number, or are one
  away ([highlights.ts](../apps/web/src/game/highlights.ts)).
- **Names** as a proper label on hover or tap, instead of the tiny print on Basic tiles.
- **Contested.** A subtle crackle when two colours orbit the same planet.

The markings live in [PlanetMarkings.tsx](../apps/web/src/components/board/PlanetMarkings.tsx).

### 6. A sidebar with character

**Today.** The player panels now animate, but are text-only, and below them is a collapsed
Captain's Log.

- **Portraits.** Commander, Vex, Orion, Lyra and the fifth seat each get a portrait or faction
  emblem, generated in the art package's seeded-SVG style so they print too. Used here, on rival
  cards (4), turn changes (7) and the game over (2). The biggest gain in personality left.
- **Your hand.** Skills as small art cards, not text chips (shares the work of 1).
- **Standings.** A small race bar of cubes placed per player.
- **Live log.** Open the Captain's Log by default when there's room, with an icon and colour per
  event.

### 7. Clear turn changes

- When a turn starts, sweep that player's colour across the top bar or action panel, with their
  portrait.
- "Your turn" chimes; add a visible banner when the window was in the background.

---

## Reaching new players

### Interactive first game

A guided three-minute Basic game against a Cadet: the board highlights what to do ("tap your 4,
it can move 4 spaces", "your ships add up to 7: conquer!"). The in-app rules and the
[hints](../apps/web/src/game/hints.ts) are a start; pairs well with the quick-start button (4).

### Share card

An image made at the end of a game: the final board, the winner, the stats from
[2](#2-a-game-over-that-tells-the-story) and a link to play. Online games post it to the invite
chat; elsewhere it goes through `navigator.share` or downloads. The art package already renders
boards to images.

### Name & identity

"Cubic" is a working title. A final name and a logo mark beyond the three dice (one that works at
32 px for the home-screen icon and browser tab) would make the game feel finished. The icons are
in [`public/`](../apps/web/public).

---

## Small leftovers

- Let the music swell a little during battles and on your turn.
