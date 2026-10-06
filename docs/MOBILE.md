# Mobile & tablet

How to make the web app play well on phones and iPads: what works today, what breaks, and a
plan sized to where the app is now.

Status: **Step 0 done, Step 1 done in emulation, real-device check on the G55 next.** First written 2026-10-02 as a proposal. Revised
2026-10-06 after measuring the current build in device emulation (`npm run mobile:shots`:
Playwright + Chrome; iPhone SE, iPhone 15, Moto G55 and iPad mini, portrait and landscape).
Not yet checked on real devices.

**Reference devices:**

| Device | CSS viewport | Notes |
|---|---|---|
| **Moto G55** (Android, Chrome) | 412×915 screen, ≈ 412×800 visible | Christian's phone: the primary real-device check |
| iPhone SE (1st gen) | 320×568 | Playwright's "iPhone SE" preset; stands in for the narrowest phones (today's SE is 375 wide) |
| iPhone 15 | 393×852, ≈ 393×659 visible | iOS Safari specifics |
| iPad mini | 768×1024 | tablet, both orientations |

The Moto G55 is 1080×2400 at a device pixel ratio of ≈ 2.625. The visible height subtracts
Chrome's address bar and Android's navigation bar, and changes as the address bar hides.

---

## 1. What changed since the first draft

Online play (shared links, async turns) makes the phone much more important. The likeliest way
someone joins a game now is by tapping an invite link in a chat app on their phone.

Already done, mostly as side effects of other work:

| Item | Where |
|---|---|
| Dev server reachable on the LAN (`host: true`, LAN address used in invites) | [vite.config.ts](../apps/web/vite.config.ts) |
| Market is collapsible, remembers the choice, opens itself during a card pick | [Market.tsx](../apps/web/src/components/Market.tsx) |
| Cards (skills, tech, decks) open a large `CardViewer` on tap, so card text works on touch | [PlayerList.tsx](../apps/web/src/components/PlayerList.tsx), [CardViewer.tsx](../apps/web/src/components/CardViewer.tsx) |
| Ships and highlights take the whole cell as their tap area (option G for ships) | [Board.tsx](../apps/web/src/components/Board.tsx) |
| Fullscreen button (iPad, Android; the API doesn't exist on iPhone Safari, so the button hides there) | [FullscreenButton.tsx](../apps/web/src/components/FullscreenButton.tsx) |
| Lobby and dialogs (fleet roll etc.) fit a 320px phone, *as long as the board doesn't widen the page* (§2, point 1) | |
| Invite uses the native share sheet on touch devices | [OnlineScreen.tsx](../apps/web/src/online/OnlineScreen.tsx) |

Not started: everything else in the old Phase 1 (`100vh`, safe areas, `touch-action`, hover
effects, 44px targets, tooltips), plus the layouts and zoom.

---

## 2. Where we are (measured)

Below 980px the layout is a single scrolling column (board, market, sidebar). The stage is
`min(100vw, 70vh)` tall, and cells are fitted to it with a **34px minimum**
([Board.tsx](../apps/web/src/components/Board.tsx) `useCellSize`). Ships are drawn at 56% of a
cell (about 19px at the minimum), but they are tapped on the whole cell.

Cell size as rendered today. **"floor"** means the fit wanted less than 34px, so the board is
bigger than its box:

| Device (CSS px) | 3×3 Basic 2p | 5×5 Classic 4p | 7×7 4p |
|---|---|---|---|
| iPhone SE portrait (320×568) | 34 (floor) | floor, board 510px wide | floor, 714px |
| iPhone 15 portrait (393×659) | 42 | floor, board 510px wide | floor, 714px |
| iPhone 15 landscape (734×343) | floor (fit ≈ 26) | floor | floor |
| **Moto G55** portrait (412×800) | 44 | floor, board 510px wide | floor, 714px |
| **Moto G55** landscape (867×340) | floor (fit ≈ 26) | floor | floor |
| iPad mini portrait (768×1024) | 78 | 47 | floor (fit ≈ 33) |
| iPad mini landscape (1024×768) | 72 | **floor**, because the market takes ≈ 185px | floor (fit ≈ 24) |

What this means in practice:

1. **Phones, maps of 5×5 and up: the page zooms out.** A 510px board on a 393px (iPhone) or
   412px (Moto G55) screen widens the layout viewport to 518px, so the mobile browser shrinks
   the *whole page*, or leaves it wider than the screen. The board also overflows its stage and
   the market cards draw over its bottom row, and dialogs centre on the wider page, so the fleet
   roll's *Keep fleet* button is half off the screen on the G55. This is the worst bug and the
   cheapest to fix.
2. **Phone landscape breaks even 2-player maps** (the stage is only 240px tall).
3. **iPad landscape with cards (Classic/Community) on 5×5** reaches the 34px floor because of
   the market. Collapsing the market helps, but the board doesn't get bigger until the next
   resize.
4. **You scroll away from the board to act.** On an iPhone 15 the turn panel starts about 60px
   above the bottom of the screen. *End turn* and the ship actions are below the fold, and the
   page is 1,000–1,500px tall.
5. **Ship and planet info is hover-only.** Ability text and planet capacity live in `title=`
   (≈ 70 `title=` attributes across the components). Tapping an opponent's ship does nothing,
   so on touch there is no way to read what it does. Your own ships show their ability in
   ShipPanel when selected.
6. **Touch basics still missing:** `100vh` in `.modal`; no `viewport-fit=cover` or safe-area
   padding; no `touch-action` (double-tap zooms the page); 22 `:hover` rules that stick after a
   tap; `.icon-btn` 32px, `.mini-btn` ≈ 18px, and 13–18 buttons under 44px on a game screen.

Map sizes per player count (from `data/maps.yaml`), which decide how much zoom matters:

| Players | Common sizes |
|---|---|
| 2 | 3×3, 3×5 (most); a few 4×4, 4×5 |
| 3 | 3×3 to 5×5, spread evenly |
| 4 | **5×5 (10 maps)**; 3×3, 3×5, 4×4; a few 6×6, 5×7, 7×7 |
| 5 | 3×3, 5×5; one 10×1 |

Basic's default maps (3×3) already play OK on a portrait phone (44px cells on the Moto G55,
42px on an iPhone 15). Most 4-player games don't.

---

## 3. Target

The previous draft aimed straight at "one-handed 4p on an iPhone SE". That is still the end
goal, but a realistic order is:

1. **Nothing broken on any device.** No page zoom-out, no overlap, no sticky hover, every piece
   of information reachable by touch.
2. **iPad great, phone good for 2–3 player maps**, which covers the "join a friend's online
   game from a link" case.
3. **Phone good for 4–5 player maps.** This needs board zoom and is the expensive part.

---

## 4. Plan

Each step can ship on its own and leaves desktop as it is or better. Sizes are rough. The
tools and libraries named here are compared in §5.

| Step | Size | Gets us | Checked by |
|---|---|---|---|
| 0 Test setup ✅ | ½ day | One command shows every device; HTTPS on the phone | — |
| 1 Stop the breakage | ½ day | Nothing broken anywhere (target 1) | `mobile:shots` passes; G55 by hand |
| 2 Info on touch | 1 day | Ship and planet info by tap | iPad-size emulation; G55 |
| 3 Phone layout | 1–2 days | No scrolling to act; landscape works (target 2) | `mobile:shots` + G55 + one BrowserStack iOS pass |
| 4 Board zoom | 3–4 days, 1-day spike first | 4–5 player maps on phones (target 3) | G55 + one BrowserStack iOS pass |
| 5 Home-screen app | ½–1 day | Fullscreen on iPhone, offline vs AI | Pages deploy on the G55 |

Steps 1–3 come first; Step 4 is the big one and can wait until they are in.

### Step 0: Test setup ✅ (2026-10-06)
- [x] **`npm run mobile:shots`** ([scripts/mobile-shots.ts](../scripts/mobile-shots.ts)): starts
      its own dev server, opens a 2p 3×3, a 2p wide map (Asymptote, 15 cells across), a 4p 5×5
      and a 4p 7×7 game on the 7 device sizes from §2, screenshots each setup popup (fleet roll,
      starting skill) and the game to `test-results/mobile/` (git-ignored), and prints the cell
      size and page size for each. It **exits with 1 when a layout is broken**: page wider than
      the screen, board bigger than its stage, or a setup popup with buttons or cards off screen
      (you'd have to scroll inside it). 2026-10-06 after Step 1: board and page pass everywhere;
      16 of 28 fail on popups (fleet roll in phone landscape, skill cards on phones; Step 3).
      `--url` checks a running dev server instead, `--webkit` uses WebKit (needs
      `npx playwright install webkit`). Takes about 4 minutes.
- [x] **Dev link straight into a game** ([devStart.ts](../apps/web/src/game/devStart.ts), dev
      server only): `?play=classic&players=4&map=tesseract&seed=1`. `play` takes a mode's id or
      name; `map` defaults to the basic map; `seed` repeats the same dice. One human
      (Commander) against AI. Reloading starts it again; it replaces the saved game, like any new
      game. Not in production builds.
- [x] **`npm run dev:https`**: the dev server with a self-signed certificate
      (`@vitejs/plugin-basic-ssl` v1; v2 needs Vite 6). On the phone open
      `https://<Mac's LAN address>:5173/`, accept the warning once, and the share sheet and
      clipboard work.
- ~~**Moto G55 remote debugging** over USB (`chrome://inspect`)~~ dropped 2026-10-06: the phone
      stayed at "Pending authentication" (no *Allow USB debugging?* prompt), and installing
      `adb` hit Gatekeeper. Real-device checks are by eye instead: the dev server over Wi-Fi
      (phone and Mac on the same network, no client isolation) or the GitHub Pages build.

**Done when:** one command produces the device matrix ✅.

### Step 1: Stop the breakage (small, ½ day)
- [x] **Board never wider than its box.** In `useCellSize`
      ([Board.tsx](../apps/web/src/components/Board.tsx)) drop the 34px floor: always fit (8px floor, only against zero). Tap
      areas are already full cells, so 25px cells on a 5×5 are tight but usable, and far better
      than a zoomed-out page; 7×7 on a phone (≈ 17px) stays poor until Step 4.
- [x] Stage height on phones: give the board the space it needs, e.g.
      `height: min(100vw, calc(100dvh - topbar - turn bar))`, and in landscape let the board
      use the full height.
- [ ] Re-fit the board when the market collapses or expands (it's a `ResizeObserver` on the
      wrap, so check the stage really resizes rather than overflows).
- [x] `viewport-fit=cover` + `env(safe-area-inset-*)` padding; `100vh` → `100dvh` (`.modal`,
      and anywhere else that is sized by the viewport).
- [x] `touch-action: manipulation` on the app; `user-select: none` and
      `-webkit-touch-callout: none` on the board and the dice.
- [x] Wrap the 22 `:hover` rules in `@media (hover: hover)`.
- [x] `@media (pointer: coarse)`: 44px minimum for `.icon-btn`, `.mini-btn`, segmented
      buttons, topbar buttons (padding or a larger hit area via `::after`, so things don't look
      bloated).

Done 2026-10-06: `npm run mobile:shots` passes 21 of 21 (G55 cells: 3×3 44px, 5×5 26px,
7×7 19px portrait; 31 / 18 / 13px landscape). The stage is
`min(100vw, 100dvh − topbar − safe areas)`; the hit areas are a centred `::after`, so the
buttons look the same. Not yet checked: the market re-fit (on phones the stage height no
longer depends on the market, so it only matters ≥ 980px), and everything on the real G55.

**Done when:** `npm run mobile:shots` reports no problems (it checks the first two points
on every device), and on the G55 a double-tap never zooms the page and nothing sticks after a
tap.

### Step 2: Info on touch (small to medium, 1 day)
- [ ] **Tap any ship to see its info.** When tapping an opponent's ship (or your own outside
      your action phase) does nothing today, show a small info popover instead: owner, ship
      name, value, ability text. No conflict with play, because those taps are currently no-ops.
- [ ] One `<Tip>` popover component (hover on mouse, tap or long-press on touch) for things
      that aren't actionable: planet capacity, stat tracks, cubes, the ✦ "ability used" badge,
      scrapyard dice. Then replace the `title=` strings one component at a time (Board,
      PlayerList, TurnPanel, ShipPanel, Market first). Build it on the browser's own
      **Popover API + CSS anchor positioning** (no dependency; §5), with a plain bottom-centre
      fallback via `@supports` for older iOS.
- [ ] Long-press for info on actionable things (own ships, planets) is a nice-to-have; skip
      unless real-device testing shows it's needed.

**Done when:** on an iPad you can find every piece of information without a mouse.

### Step 3: Phone layout, minimal version (medium, 1–2 days)
Keep the scrolling column, but pin what matters:
- [ ] **Sticky bottom turn bar** on phones: current player, short prompt, the main actions
      (End turn, Undo, the selected ship's actions). This can be the TurnPanel/ShipPanel in a
      compact form with `position: sticky; bottom: 0`. You never have to scroll to act.
- [ ] Board first and fully visible on load; market (collapsed by default on phones), players
      and log below it.
- [ ] Phone landscape: board on the left at full height, sidebar scrolling on the right
      (a two-column grid below 980px when `orientation: landscape` and the height is small).
- [ ] Overlays at 320–393px: check combat (dice and totals), card choice (two large cards
      side by side), Change of Heart (whole-deck search), game over, rules.
- [ ] iPad portrait: put the turn panel and the player list side by side under the board,
      so the page stops being 1,800px tall.

The slide-up sheet with tabs (P2 in the old draft) is the polished version of this. Do it only
if the sticky bar turns out not to be enough. If it comes to that, don't use Vaul, which is
unmaintained (§5).

- [ ] Check one full turn on the G55 for smoothness (no remote profiling, see Step 0): 3D dice,
      four `backdrop-filter` blur layers, explosions. Its Dimensity 7025 is mid-range and the screen runs at 120 Hz.
      Only optimise what the profile shows.

**Done when:** a 2p Basic game and a 3p Classic game, setup to game over, can be played on
the Moto G55 (and on an iPhone, through BrowserStack) without scrolling to act; a full 4p
Classic game is comfortable on an iPad in both orientations. Add a check to `mobile:shots` that
the turn bar's *End turn* is inside the screen.

### Step 4: Board zoom (larger, 3–4 days)
Needed for 4–5 player maps on phones. Start with a **one-day spike with
`react-zoom-pan-pinch`** (§5). It now covers most of the list below out of the box
(`zoomToElement` for auto-focus, a MiniMap, coordinate helpers), so it may well be good enough.
Judge it on the G55 (and once on BrowserStack iOS) by three things: are dice and text crisp
after a zoom, does a tap on a ship ever turn into a pan (or the reverse), and does it feel
smooth at 120 Hz.

If it fails, fall back to our own Pointer Events (~150 lines), using the design from the old
draft:
- [ ] Pinch-zoom / pan / wheel zoom / double-tap, a *Fit* button, bounds from "fit" to ≈ 64px
      cells.
- [ ] During the gesture, apply a CSS `transform` to `.board`; when it ends, commit by changing
      `cell` (crisp SVG, text and dice) and reset the transform.
- [ ] Tap vs drag: under 8px of movement and ~300ms is a tap; anything else pans and must not
      fire ship/cell clicks. One `screenToCell()` helper for `onBoardClick`.
- [ ] `touch-action: none` on the board only.

Either way:
- [ ] Optional: gentle auto-focus on selection (zoom just enough to show the reachable cells),
      follow opponent and AI moves during online replays, a mini-map inset.
- [ ] Playwright pinch tests through Chrome's DevTools protocol
      (`Input.synthesizePinchGesture` / `Input.dispatchTouchEvent`): `page.touchscreen` only
      does single taps. These run in Chromium only.

Auto-rotating the board 90° (old option A) only helps rectangular maps (3×5, 4×5, 4×7). It's
cheap once `screenToCell()` exists; worth adding then, not before.

**Done when:** a 5×5 4-player map is playable on the Moto G55 and an iPhone with ships
≥ 44px when zoomed in, and panning never makes a move.

### Step 5: Home-screen app (small, optional)
More useful now that online games are async: people come back to a game over days.
- [ ] `vite-plugin-pwa` (v2, Oct 2026) for the manifest and service worker, and
      `@vite-pwa/assets-generator` for icons from `favicon.svg`. Add `apple-mobile-web-app-capable`
      so "Add to Home Screen" opens fullscreen. This is also the only way to get fullscreen on an
      iPhone.
- [ ] Service worker for offline play against the AI (everything already runs client-side).
- [ ] **Watch out: stale clients in online games.** A cached old build replaying a log made by
      a newer build can desync. Use `registerType: 'autoUpdate'` and check for an update when
      the app comes back to the foreground. Then a home-screen app is never more than one
      resume behind.
- [ ] Check the scope and start URL with the `./` base on the GitHub Pages subpath.
- [ ] Screen Wake Lock during a game, if it turns out to matter.
- Turn notifications would need a push server, which goes against the no-server rule. Out of
  scope.

### Later / ideas
- Pass-and-play on iPad: a "hand over" screen between human players.
- Haptics on combat results (Android only; iOS Safari has no `navigator.vibrate`).

---

## 5. Tools, libraries and services

Researched 2026-10-06. Free options come first; nothing here needs a server of our own.

### Testing

| Tool | Cost | What it gives us | Use it for |
|---|---|---|---|
| **Moto G55 + Chrome remote debugging** (USB, `chrome://inspect` on the Mac) | free | Real Android Chrome with full DevTools on the phone's page: console, element picker, performance profiles on real hardware | Every step's real-device check; profiling |
| **Playwright** device emulation (the installed Chrome via `channel: 'chrome'`) | free | Layout matrix in seconds; screenshots; `toHaveScreenshot` for visual regression | Step 0 script; catching layout regressions |
| **Safari Responsive Design Mode** (Develop menu, already on the Mac) | free | Real WebKit at phone sizes. Closer to iOS than Chrome emulation, but still desktop Safari | Quick WebKit sanity checks |
| ~~iOS Simulator~~ | free, but needs full Xcode | Real Mobile Safari | **Not used**: decided 2026-10-06 not to install Xcode |
| **Android Emulator** (Android Studio) | free | Other Android sizes and Chrome versions | Only if a bug looks device-specific; the G55 covers Android |
| **BrowserStack open-source programme** | free for public repos (this one is public), needs an application | Real iPhones and iPads in the cloud, manual (Live) and automated (Playwright) | Final pass of Steps 3–4 on real iOS hardware, if no iPhone is at hand |
| **Eruda** (on-page console, loaded only with `?debug`) | free | Console and network on a phone without a cable | Friends testing online games on iPhones |

**iOS without an iPhone or Xcode (decided 2026-10-06):** routine checks use Playwright's
WebKit build and Safari's Responsive Design Mode on the Mac (both real WebKit, but desktop).
Before calling Steps 1, 3 and 4 done, do one pass on real iPhones and iPads through
BrowserStack's open-source programme. A friend's iPhone during an online game is a bonus
check. The iOS-only details (safe areas, the collapsing toolbar, the long-press callout) are
the least-tested area. Write them defensively, following the standard patterns in Step 1.

What emulation can't show: real touch and pinch feel, scroll momentum, iOS toolbar resizing,
real performance (it runs on the Mac's CPU and GPU). Hence the G55 and BrowserStack.

### Secure context on the LAN

The dev server on `http://192.168.x.x` is **not a secure context** on the phone. The share
sheet, clipboard, service worker and Wake Lock are all missing there. Inviting from the phone
currently falls back to a `prompt()`, so it looks broken in dev when it isn't. Options:

- **`@vitejs/plugin-basic-ssl`**: a self-signed certificate, so you click through a warning
  once per device. Recommended: one dev dependency behind a `dev:https` script.
- **mkcert**: a trusted local certificate, no warning, but the root certificate has to be
  installed on each phone. More setup than it's worth here.
- **The GitHub Pages deploy** is already HTTPS on every push to `main`, so it's the real test
  for share, clipboard and PWA behaviour.
- **A tunnel** (Cloudflare quick tunnel, ngrok): HTTPS plus access off the LAN, but it puts the
  dev server on the public internet. Only for a short session with a remote friend.

### Libraries

| Need | Choice | Why | Rejected |
|---|---|---|---|
| Board zoom (Step 4) | **`react-zoom-pan-pinch`** v4.2 (Sept 2026), spike first | Actively maintained; pinch, pan, wheel, double-tap, `zoomToElement`, MiniMap, coordinate helpers built in | `@use-gesture/react`: works, but no release in 3 years. Own Pointer Events code stays the fallback |
| Info popovers (Step 2) | **Native Popover API + CSS anchor positioning** | Baseline in every major browser since Jan 2026 (Safari 26, Firefox 147): positioning and light-dismiss with no dependency | Floating UI: excellent, but only needed for older browsers. Tippy.js: legacy |
| Bottom sheet (only if Step 3 needs one) | Hand-rolled, or Base UI's drawer | Small; no gestures needed if it only opens by tap | **Vaul: unmaintained** (its author says so); shadcn/ui moved its drawer off it |
| Home-screen app (Step 5) | **`vite-plugin-pwa`** v2 + `@vite-pwa/assets-generator` | The standard for Vite; Workbox underneath; icons generated from one SVG | Hand-written service worker: more risk around update handling |

Not worth it: hosted visual-testing services (Percy, Chromatic). Playwright's own screenshots
are enough at this size. Paid device clouds beyond the free open-source programme: also not
needed.

### Playwright details

- No Moto G55 preset: use
  `{ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true }`
  (landscape ≈ 867×340).
- Games start from the `?play=` dev link. *Keep fleet* is disabled for 1.35 s while the dice
  land; wait for it to be enabled, then click it from inside the page (on a too-wide page it
  can be partly off screen). Event Horizon (7×7) is offered under Community, not Classic.
- Launch Chrome with `--no-proxy-server`. Otherwise its proxy auto-detection adds **12 s to
  every page load** on this Mac (the whole matrix took 5 minutes instead of 45 s).
- Playwright's own `webkit` is desktop WebKit, not iOS Safari. Treat it as a hint, not a
  verdict.

---

## 6. Open decisions

1. **Order:** Steps 0–3 first (phone good for 2–3p, iPad great), with zoom later? Or is 4p on
   a phone important enough to do Step 4 early?
2. **Stopgap for big maps on phones before zoom:** fit at small cells (recommended above), or
   a horizontally scrolling board at 34px (simpler, but swipes compete with the page)?
3. **Dependencies:** `playwright` and `@vitejs/plugin-basic-ssl` are in (dev only, agreed
   2026-10-06). Still to decide: `react-zoom-pan-pinch` (if the Step 4 spike works) and
   `vite-plugin-pwa` (Step 5).
4. **Home-screen app (Step 5):** now, given async online play, or later?
5. **Run `mobile:shots` in CI?** GitHub's Ubuntu runners have Chrome, so the Pages workflow
   could run it and fail the deploy on a broken layout. Worth it once Step 1 makes it pass;
   until then it would block every deploy.
