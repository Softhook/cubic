# Mobile & tablet

How to make the web app play well on phones and iPads: the options for the board
(fit, scroll, zoom), the layout per screen size, and a phased plan.

Status: **proposal**, nothing implemented yet. Decisions still open are listed at the end.

---

## 1. Where we are

The app was built desktop-first. [styles.css](../apps/web/src/styles.css) has two breakpoints
(980px, 600px) that stack the desktop layout into one scrolling column. That makes it
*visible* on small screens, but not *playable*:

| Problem | Where | Effect on touch devices |
|---|---|---|
| Board is fit-to-container with a 34px minimum cell | [Board.tsx](../apps/web/src/components/Board.tsx) `ResizeObserver` | Large maps overflow the screen on phones; ships are drawn at 56% of a cell, so ~19px tap targets |
| Information lives in `title=` tooltips | Board, PlayerList, TurnPanel, ShipPanel, Card, Market | Ship abilities, skill text, stat meanings are **unreachable** on touch |
| Below 980px the layout is board → market → sidebar, page scrolls | `.layout` media query | You scroll away from the board to press *End turn*, then back |
| `:hover` lift/glow effects | `.qcard.clickable:hover`, `.ship.own:hover`, … | Effects "stick" after a tap |
| `100vh` in modals and stage | `.modal`, `.stage` | Wrong on iOS Safari (address bar); content cut off |
| No safe-area handling, no `touch-action` | global | Content under the notch / home indicator; double-tap zooms the page |
| Small controls (20–32px) | `.mini-btn`, `.icon-btn`, segmented buttons | Hard to hit with a finger (guideline: 44px) |

### How big does the board get?

Each map tile is 3×3 cells, so a 5×5-tile map is 15×15 cells. Cell size (px) when the
whole board is fitted to the available area. *a/b* = normal / rotated 90°.
Target for comfortable tapping is **≥ 44px**; **< 34px** is not really playable.

| Available board area | 3×3 | 3×5 | 4×4 | 4×5 | 5×5 | 7×7 |
|---|---|---|---|---|---|---|
| Phone portrait (≈374×560) | 41 | 24 / **37** | 31 | 24 / 31 | 24 | 17 |
| Phone landscape (≈520×350) | 38 | **34** / 23 | 29 | 29 / 23 | 23 | 16 |
| iPad portrait (≈790×760) | 84 | 52 | 63 | 52 | 50 | 36 |
| iPad landscape, Basic (≈848×736) | 81 | 56 | 61 | 56 | 49 | 35 |
| iPad landscape, Original + market (≈848×550) | 61 | 56 | 45 | 45 | 36 | 26 |

Map sizes by player count (BGA set, `reference/bga/maps.json`):
2p mostly 3×3 / 3×5; 3p spread up to 5×5; **4p mostly 5×5**, a few up to 7×7.

Takeaways:

- **iPad: fit-to-screen is enough** for nearly every map, provided the market doesn't eat
  the vertical space (see the last row). Zoom is a nice-to-have.
- **Phone: fit-to-screen only works for 2-player maps.** 3–4 player maps need zoom, a
  scrolling board, or both.

---

## 2. Options for the board on small screens

### A. Fit only, plus auto-rotate
Keep fit-to-screen, but render the board rotated 90° when that gives bigger cells (a 3×5
map on a portrait phone goes from 24px to 37px). Rules only care about orthogonal and
diagonal adjacency, so a rotated board plays identically. The engine keeps its own
coordinates; only rendering and tap→cell mapping transform them.

- ✅ Cheap; no gestures; always shows the whole board
- ❌ Doesn't help square maps (4×4, 5×5, 7×7) — useless on phones for 3–4 players
- ➜ **Do it anyway** — it's a free win under every other option.

### B. Native scrolling board
Render the board at a fixed playable cell size (e.g. 48px) inside an `overflow: auto` box;
the player swipes around it like a large image.

- ✅ Very simple; native momentum scrolling; text stays crisp
- ❌ No overview; easy to lose track of the opponent's ships
- ❌ Swipes on the board compete with taps on ships (tolerable) and with page scroll (bad, unless the page itself never scrolls)
- ➜ A reasonable **stepping stone**, not the end state.

### C. Pinch-zoom + pan (free camera)
Board starts fitted. Pinch to zoom in/out, one-finger drag to pan once zoomed, double-tap to
toggle between "fit" and "zoom here". A *Fit* button resets the view.

- ✅ What people expect from maps/games on touch; overview and detail both available
- ✅ Also useful on iPad for 7×7 maps and on desktop (wheel/trackpad zoom)
- ❌ Most implementation work: gesture handling, tap-vs-drag thresholds, bounds clamping
- ❌ Scaled 3D dice can blur on Safari mid-gesture (fix below)

### D. Smart camera (auto-focus)
The app moves the view for you: selecting a ship zooms/pans so its reachable cells are
visible; combat centres on the fight; after the action it eases back to fit. Opponent/AI
moves pan to where they happen.

- ✅ Players rarely need to touch the camera at all
- ❌ Automatic camera moves can feel like fighting the app if overdone
- ➜ Best as a **layer on top of C**, gentle and interruptible (any manual gesture wins).

### E. Two-level zoom (overview ↔ region)
No continuous zoom. Tap an area of the overview to jump to a fixed zoom on that tile and
its neighbours; tap *Overview* to go back.

- ✅ Simpler than C; predictable; plays well with the 3×3 tile structure
- ❌ Moves that cross regions are awkward (ship at a region edge, target in the next)
- ❌ An extra tap before almost every action on large maps

### F. Magnifier / loupe
Hold a finger on the board; a magnified bubble shows what's under it, release to pick.

- ✅ No camera state at all
- ❌ Hold-and-release is slow for a game with many taps per turn; conflicts with long-press-for-info
- ➜ Not recommended.

### G. Bigger hit areas (complements any option)
Make the tappable area of a ship/cell the **whole cell** (or more) even when the dice are
drawn smaller, and resolve ambiguous taps to the nearest legal target.

- ✅ Raises the effective tap target from ~19px to the full cell; at 34–40px cells, smart
  snapping makes play workable without zooming
- ➜ **Do it everywhere.**

### Recommendation

**A + G + C + D**, in that order:

1. Auto-rotate and full-cell hit areas (cheap, helps immediately).
2. Pinch-zoom/pan with a *Fit* button; enabled on every device, default zoom = fit.
3. Gentle auto-focus: when you select a ship and its targets aren't comfortably visible
   (cells < 44px on screen), zoom just enough to show them. Never move the camera while the
   player's finger is down; any manual gesture cancels auto-focus until the next selection.
4. Optional: a small mini-map inset when zoomed in (we already have a `.mini-map` component
   in the Lobby that can be reused).

B is the fallback if C proves fiddly on real devices: it's a subset of the same work
(render at a larger `cell`, let the container scroll).

### Implementation notes for C

- **Gesture → transform, settle → re-render.** During a pinch/pan, apply a CSS
  `transform: translate() scale()` to the `.board` element directly (ref + `requestAnimationFrame`,
  no React re-render per frame). When the gesture ends, commit the zoom by changing `cell`
  (the board re-lays out at the new size) and reset the scale to 1. This keeps SVG, text
  and the 3D dice crisp, and the existing `cell`-based layout keeps working unchanged.
- **Tap vs drag:** treat a pointer that moves < 8px and lifts within ~300ms as a tap;
  anything else is a pan and must not fire `onClick` on ships/cells.
- **Bounds:** zoom between *fit* and ~72px cells; pan clamped so the board can't leave the screen.
- **Tap mapping:** `onBoardClick` divides by `cell`; with rotation it also has to un-rotate.
  Put this in one `screenToCell()` helper.
- **CSS:** `touch-action: none` on the board container (we handle gestures),
  `touch-action: manipulation` everywhere else (kills double-tap page zoom).
- **Library or not:** `@use-gesture/react` (~10 kB, handles pinch/drag/wheel uniformly) is
  the pragmatic choice; hand-rolled Pointer Events is ~150 lines and no dependency.
  `react-zoom-pan-pinch` is higher level but owns the transform, which fights the
  "commit to `cell`" approach.

---

## 3. Layout per screen size

### Phone portrait (< 600px wide) — options

| | Layout | Verdict |
|---|---|---|
| P1 | Current stacked scrolling page | ❌ Board and controls never visible together |
| P2 | **Full-height board + fixed bottom turn bar + slide-up sheet** (tabs: Players · Cards/Market · Log) | ✅ Recommended |
| P3 | Tabbed full screens (Board / Players / Cards) | ⚠️ Simple, but hides the board while you read |

P2 in detail:

```
┌──────────────────────────┐
│ QUANTUM   ⓘ  🔊  ☰       │  compact top bar
├──────────────────────────┤
│                          │
│          board           │  pinch / pan, Fit button in a corner
│     (fills the space)    │
│                     [⤢]  │
├──────────────────────────┤
│ ● Anna  ■■□  Move a ship │  turn bar: always visible
│ [Research] [Undo] [End ▶]│  contextual actions (ShipPanel actions here when a ship is selected)
├──────────────────────────┤
│ Players · Cards · Log  ▲ │  sheet handle; drag/tap to expand over the board
└──────────────────────────┘
```

- The sheet opens to ~60% height; the board stays visible above it.
- When the game needs a card pick (market), the Cards tab opens automatically.
- The page itself never scrolls: `height: 100dvh`, only the sheet's contents scroll.

### Phone landscape
Board on the left (fitted to height), a ~260px panel on the right with the turn bar on top
and the same tabs below. Short screens make this cramped for 4p maps — zoom handles it.

### iPad portrait (600–1024px)
Board on top (~60% height), below it the turn panel and player list **side by side**,
log collapsible. Market as a horizontal strip that collapses to a "Cards" button when it
isn't your card phase. No page scroll.

### iPad landscape / desktop (> 1024px)
Current layout. Changes: sidebar 300px instead of 360px below 1280px wide; market
collapsible (it costs ~190px of height, which is what pushes 5×5 Original maps to 36px cells).

### Overlays on phones
- **Card choice** (two `qcard-lg` side by side = 440px) → use `qcard-md` or a swipeable row.
- **Change of Heart** (search the whole deck) → full-screen sheet with a scrolling grid.
- **Combat** already stacks to one column below 980px; check the dice and totals fit at 374px.
- **Rules** → full-screen on phones.

---

## 4. Tooltips → touch-friendly info

Everything currently in `title=` needs another way in. Options:

1. **Long-press shows a popover** — standard on iOS/Android; doesn't interfere with taps.
2. **Tap shows info for things that aren't actionable** (skill chips, stats, cubes, decks);
   actionable things (ships, buttons) keep tap = act, long-press = info.
3. **An "ⓘ inspect" toggle** in the top bar: while on, every tap shows info instead of acting.

Recommendation: **1 + 2**, plus a richer *selected ship* panel (selecting a ship already
shows its ability in ShipPanel — on phones that panel lives in the turn bar).

Implementation: one `<Tip>` popover component and a `tip` prop/`data-tip` attribute that
replaces the `title` strings. On devices with a mouse, the same component shows on hover,
so desktop gets nicer tooltips too.

---

## 5. Plan

Each phase is shippable on its own and leaves desktop unchanged or better.

### Phase 0 — Test setup (½ day)
- [ ] `vite --host` script so the dev server can be opened on a real iPhone/iPad on the LAN.
- [ ] Dev URL shortcut to jump straight into a game: `?mode=original&map=<id>&players=4`
      (saves going through the lobby on every check).
- [ ] Reference devices: iPhone SE (375×667), iPhone 15 (393×852), iPad mini (744×1133),
      iPad Air (820×1180), both orientations. Chrome DevTools device mode for quick checks,
      **real Safari** before calling a phase done.
- [ ] Optional: Playwright screenshot script over devices × {3×3, 5×5, 7×7} maps × {Basic, Original}.

### Phase 1 — Touch basics (1–2 days) · helps every device
- [ ] `viewport-fit=cover` + `env(safe-area-inset-*)` padding; `100vh` → `100dvh`.
- [ ] `touch-action: manipulation` globally; disable text selection and the iOS callout on game UI.
- [ ] Wrap hover effects in `@media (hover: hover)`.
- [ ] Minimum 44px touch targets on touch devices (`@media (pointer: coarse)`).
- [ ] `<Tip>` component; replace every `title=` (list in §1).
- [ ] Full-cell hit areas for ships (option G).

**Done when:** on an iPad you can find every piece of information without a mouse, and nothing sticks or zooms by accident.

### Phase 2 — Tablet layouts (1–2 days)
- [ ] iPad portrait layout (board top, panels side by side, no page scroll).
- [ ] Collapsible market; narrower sidebar on mid-size screens.
- [ ] Board auto-rotate (option A).

**Done when:** a full Original-mode 4-player game is comfortable on iPad in both orientations.

### Phase 3 — Board camera (3–4 days)
- [ ] `screenToCell()` helper (scale + rotation), used by all board taps.
- [ ] Pinch-zoom / pan / wheel zoom / double-tap, Fit button, bounds (option C).
- [ ] Commit-to-`cell` after gestures for crisp rendering.
- [ ] Auto-focus on selection and combat; follow AI/opponent moves (option D).
- [ ] Optional mini-map inset.

**Done when:** a 5×5 4-player map is playable on an iPhone with ships at ≥ 44px when zoomed, and no accidental moves while panning.

### Phase 4 — Phone layout (2–3 days)
- [ ] Bottom turn bar (TurnPanel + ShipPanel actions in compact form).
- [ ] Slide-up sheet with Players / Cards / Log tabs; auto-open Cards during card picks.
- [ ] Phone landscape variant.
- [ ] Phone-sized overlays (card choice, Change of Heart, combat, rules, game over).

**Done when:** a full game, setup to game over, can be played one-handed on an iPhone SE.

### Phase 5 — Installable app (½–1 day, optional)
- [ ] Web app manifest + icons + `apple-mobile-web-app-capable` → "Add to Home Screen" opens fullscreen.
- [ ] Service worker for offline play vs the AI (everything already runs client-side).
- [ ] Keep the screen awake during a game (Screen Wake Lock API) if it turns out to matter.

### Later / ideas
- **Pass-and-play on iPad:** a "hand over" screen between human players; optionally rotate
  the turn bar towards the active player when the iPad lies flat between two people.
- Haptics (`navigator.vibrate`) on combat results — Android only; iOS Safari doesn't support it.

**Total:** roughly 8–12 days of work for phases 0–4.

---

## 6. Open decisions

1. **How good must the phone be?** "Fully playable incl. 4p maps" (phases 3–4 needed) vs
   "best on tablet, phone OK for 2p" (phases 1–2 plus option A/G may be enough at first).
2. **Zoom approach:** pinch-zoom camera (C, recommended) vs scrolling board (B, simpler).
3. **Dependency:** OK to add `@use-gesture/react`, or keep the client dependency-free?
4. **Installable / offline (phase 5):** wanted now, or after online multiplayer (M4)?
