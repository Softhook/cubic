# Online multiplayer

How online play works, and the options we weighed. Expands roadmap milestone **M4**
([ROADMAP.md](ROADMAP.md#m4--online-multiplayer)).

Status: **built (2026-10-06)**: serverless, live *and* asynchronous play between friends,
as described in §0. Sections 1–7 are the original proposal, kept for the server options
(fair dice, notifications, public play) should we want them later.

---

## 0. What's built: a shared move log on public relays

Decision (2026-10-06): **no server of our own.** The site stays static (GitHub Pages); every
player's browser keeps the whole game; moves travel through public **Nostr relays**, which
store small signed messages for anyone. We run nothing.

```
 Alice's browser                  public relays (6)               Bob's browser
 ┌──────────────┐  signed, encrypted  ┌───────────┐                ┌──────────────┐
 │ log → replay │ ─────── post ─────► │  store &  │ ─── fetch / ──►│ log → replay │
 │  (engine)    │ ◄────────────────── │  forward  │ ◄── live sub ──│  (engine)    │
 └──────────────┘                     └───────────┘                └──────────────┘
   localStorage: every event                                     localStorage: every event
```

- **A game is a log of posts** ([`packages/online`](../packages/online)): `create` (config,
  seed, seats), `claim` (take an open seat), `act` (an engine `Action` for a seat), `undo`,
  `ask` (battle preference) and `pass` (nothing to add in a battle). Every browser replays the
  log with the engine (`createGame` + `apply`), so they all compute the same game. A full
  4-player game replays in ~35 ms.
- **Order.** `act`, `undo` and `ask` form a chain: each names the post it follows. If two
  posts follow the same one (two bystanders firing at once, two browsers moving the AI),
  the earlier wins on every browser, whatever order they arrived in (`Timeline`, tested
  with browsers on a network that delays and reorders).
- **Seats.** Each browser has a Nostr key (localStorage). A post counts only if its author
  plays the seat (the earliest claim of an open seat wins), `mayAct` agrees (engine: the
  actor, or the player named in a missile/re-roll), and `apply` accepts it. Anyone may move
  an AI seat.
- **AI seats** are played by the browser that made the last move; if it has gone, any other
  browser takes over after 15 s.
- **Missiles (open question #21).** A battle waits for every player who may respond (fire,
  re-roll), unless their `ask` setting says otherwise: *all battles* (default), *my battles*
  or *never*. Each responds or passes ("Done"); once all have passed, every browser
  resolves the battle the same way. AI seats always answer, so all-AI battles resolve at once.
- **Privacy.** The invite link `#online/<secret>` carries a 128-bit secret in the fragment,
  which browsers never send to a server. Relays see only an encrypted blob (AES-GCM, key
  derived from the secret), a tag derived from it, and the poster's public key.
- **Relays** ([`relays.ts`](../apps/web/src/online/relays.ts)): six that accept bursts from new
  keys (checked 2026-10). Each relay gets a paced send queue; rate limits pause it; a send that
  goes unconfirmed is retried; a relay that refuses for good (payment, web of trust) is only
  read from. After syncing, a browser re-sends anything a relay is missing, so a game survives
  relays dropping old events as long as one player still has it. Every relay sends the whole
  game on connecting, but events the browser already holds are skipped before they are parsed
  or their signature checked (~1 ms each on a laptop, more on a phone), and a reconnect only
  asks for what's new since the last sync. A relay that ends our subscription is asked again.
  The panel shows *Sending…* while a move of ours isn't confirmed by any relay.
- **Staying in sync.** Each move carries a hash of the position it leads to (names and log
  left out, as claims may still be in flight). A browser that gets a different position, or
  refuses a move the seat's owner made from the same position, shows *Out of sync* and asks
  both players to reload: almost always two app versions (a deploy during a game).
- **Async.** Close the tab whenever; open the game from the lobby's *Online games* list or the
  link and it catches up (moves you missed are replayed briefly, or skipped if many). Live
  play works the same way, with moves arriving in about a second.

### Limits (accepted trade-offs)

| Limit | Why / mitigation |
|---|---|
| **Players can cheat with dev tools**: every browser holds the seed, so future rolls and deck order are predictable | Inherent without a trusted party. Fine between friends; a server (§2 C) fixes it |
| No "your turn" notifications | Needs a server to send email/Web Push. The lobby shows *Your move* for games last seen waiting on you |
| A seat lives in one browser | Moving to another device would need exporting the key (not built). Safari may clear a site's storage after ~7 days without a visit, losing the seat; we ask for persistent storage, which helps elsewhere |
| Public relays may rate-limit or drop events | Six relays, paced sending, re-sending from every browser |
| **Engine changes can break games in progress**: replay must give the same result on every browser | `golden.test.ts` flags any behaviour change; bump `PROTOCOL` (protocol.ts) when one would alter replays, which retires older games. A player still on the old version is caught by the position hash (*Out of sync*) |
| Relays promise nothing: they may prune old events or start refusing new keys | Every player's browser is a full copy and re-seeds the relays when it opens the game; the list in `relays.ts` is easy to change. A friend joining an idle game may need the creator to open it first |
| Rival posts are ordered by the poster's clock | A wrong clock only decides races (two bystanders firing at once); fine between friends |
| localStorage (~5 MB) holds every game's events (~0.5 KB each) | Plenty for dozens of games; finished games can be removed from the lobby |

### Testing it

- `packages/online/test/timeline.test.ts`: whole games between simulated browsers over a lossy,
  reordering network (they must end identical), seat authorisation, claim races, rival moves,
  malformed posts, and the codec.
- `apps/web/test/playback.test.ts`: catching up on others' moves walks forward and settles,
  undo included.
- In the browser: create an online game, open the link in a private window (a second identity)
  and join. The dev server listens on the local network and invite links made on it use this
  machine's address, so a phone on the same Wi-Fi can join (encryption is plain JavaScript, so
  it works on plain http too). In dev, `window.__quantumOnline.{state(), view(), legal(), mySeats()}` drives a game
  from a script.

---

## 1. What we already have

The engine was built with this in mind, which makes online play much easier than usual:

| Property | Why it matters online |
|---|---|
| `apply(state, action) → state`, pure and deterministic | A server can run the exact same rules as the browser; no second implementation |
| Seeded RNG stored in the state (`seed`, `rng`) | A game can be stored as *config + action list* and replayed exactly |
| Every legal move comes from `legalActions()`; illegal ones throw `RuleError` | The server can reject anything a client sends that isn't legal |
| `actor(state)` says whose decision it is | The server knows which seat is allowed to act |
| `isUndoable()` (undo.ts) | Undo can stay, with the same rules, for moves that revealed nothing |
| The AI never reads the real RNG or deck order | AI can play from a *redacted* view, the same one a human client gets |
| The UI holds no rules; it renders a state and sends actions | The UI can be pointed at a server with little change |

### What's secret in Quantum

Almost everything is public: board, dice, cubes, skills, tracks, the card rows. The secrets are:

| Secret | In the state as |
|---|---|
| Future dice rolls and shuffles | `seed`, `rng` — **anyone with these can predict every future roll** |
| Deck order | `market.skillDeck`, `market.tacticDeck` |
| The starting-skill draft (two cards, keep one) | `pending: skillDraft.options` — only that player should see them |
| The card seen with Peek | `pending: peek.top` — only that player |

This is the deciding fact for the architecture: **a client must never hold the full
state**, or it can see every future roll. That rules out the "everyone runs the game"
designs unless we accept cheating (fine between friends, not for public play).

---

## 2. Architecture options

### A. Host's browser is the server (peer-to-peer)
One player's browser holds the real state and runs the engine; others connect to it via
WebRTC (with a small signalling/relay service) and receive redacted views.

- ✅ Almost no server: no game state stored centrally, near-zero cost
- ❌ The host can see the RNG and decks (can cheat)
- ❌ Game dies when the host closes the tab; no asynchronous play; WebRTC is fiddly behind some networks
- ➜ A good **first step for playing with friends** — see §2a. Not the end state if we want async or public play.

### B. Lockstep: every client runs the game, a relay just forwards actions
All clients start from the same seed and apply the same actions in the same order.

- ✅ Simplest server (a dumb message relay); instant local feedback
- ❌ Every client has the RNG → can predict every roll and the deck order
- ❌ Fixing that needs commit–reveal randomness between players: complex, slow, and still awkward for decks
- ➜ **Not recommended.**

### C. Authoritative server (recommended)
The server holds the real state and runs the engine. Clients send actions; the server
checks the sender may act, applies the action, and sends each player **their own redacted
view** plus the new log entries.

- ✅ No cheating on rolls or decks; one source of truth; reconnects are trivial (fetch the latest view)
- ✅ Async play works: the game lives on the server while nobody is online
- ✅ AI seats can run on the server
- ❌ Needs hosting and storage (small: a game is a few KB of actions)
- ❌ Every move is a round trip (~50–150 ms) — fine for a board game, no prediction needed

### Where to host option C

| Option | Fit |
|---|---|
| **Cloudflare Durable Objects** (directly, or via PartyKit / `partyserver`) | One object per game = a natural "room": holds the state in memory, has its own storage, handles WebSockets, sleeps when idle (ideal for async games). Runs plain TS, so the engine runs unchanged. Hobby-scale cost. **Recommended.** |
| **Colyseus** on a Node host (Fly.io, Render, a VPS) | Mature room/lobby framework with reconnects and state sync. But its schema-sync model duplicates our state, we'd still manage hosting, persistence and scaling. |
| **Custom Node + `ws`** on a Node host | Full control, simple to reason about; we write rooms, persistence and reconnects ourselves. Good fallback if Cloudflare limits bite (e.g. AI CPU time). |
| **Supabase / Firebase** realtime | Great for lobbies, accounts and notifications; poor as the game authority (validation would live in edge functions with awkward state handling). Possible as the *account* layer next to one of the above. |

The web app itself stays a static site (GitHub Pages, as now, or Cloudflare Pages).

### 2a. Serverless: GitHub Pages + peer-to-peer

Can we skip running a server, keeping only the static site on GitHub Pages? **Yes, for
real-time games between friends.** Browsers can talk directly to each other over WebRTC data
channels. The game creator's browser becomes the host and does exactly what the server
does in option C. Everyone else's browser is a client and receives redacted views.

What "no server" still needs:

| Piece | Why | Serverless answer |
|---|---|---|
| **Signalling** | Two browsers must exchange connection details once before they can talk directly | **Trystero** routes this over public networks (Nostr relays, BitTorrent trackers, MQTT brokers), so we run nothing. Alternatives: PeerJS with its free public broker; or copy-paste / QR-code the connection offer (truly nothing, but clunky). |
| **STUN** | Lets each browser find its public address | Free public STUN servers (e.g. Google's) |
| **TURN** | Relays traffic when a direct connection is impossible (some mobile networks, corporate/school Wi-Fi; roughly 1 in 10 connections) | No good free option. Without it, some players simply can't join. A paid/hosted TURN service is the first "server" we'd need. |

Limits compared with a real server:

- **The host could cheat** — their browser holds the seed and deck order (visible in dev
  tools, not in the UI). Fine between friends. If it matters later, dice can be made fair with
  commit–reveal (every player contributes a secret to each roll), but that means the engine
  asks for randomness from outside instead of using its own seed: a sizeable change, and
  decks are much harder still.
- **The host must stay online.** If the host's tab closes, the game pauses. Mitigations: the host
  saves the game in its browser and can resume it with the same room code; the host can send
  the full state to another player so they take over as host.
- **No asynchronous play** — everyone has to be online at the same time. No notifications.
- **Phones:** iOS suspends a backgrounded Safari tab, which drops the connection. Reconnect has
  to be automatic and quick (rejoin the room, get the latest view).
- **AI seats** run in the host's browser, which already works today (AI web worker).

**The important design choice:** write the game room (seats, `mayAct`, apply, broadcast views,
missile window, undo) as one module that doesn't care how messages arrive. The same module
then runs in the host's browser over WebRTC now, and in a Durable Object or Node server later.
Starting serverless wastes very little: only the WebRTC transport is P2P-specific.

> Using GitHub itself as a backend (storing games in gists or issues through the GitHub API)
> would allow async play without our own server, but every player would need a GitHub account
> and the browser sign-in flow needs a small server anyway. Not recommended.

---

## 3. How a game flows (option C)

```
 Browser (seat 0)          Game room (server)                Browser (seat 1)
       │  join(game, token)        │                                │
       │──────────────────────────►│◄───────────────────────────────│ join(game, token)
       │◄── view(seat 0), v12 ─────│──── view(seat 1), v12 ────────►│
       │                           │                                │
       │  act({move…}, v12)        │                                │
       │──────────────────────────►│ 1. seat 0 may act? (actor)     │
       │                           │ 2. apply() — RuleError → reject│
       │                           │ 3. store action, v13           │
       │◄── view(seat 0), v13 ─────│──── view(seat 1), v13 ────────►│
       │    + new log entries      │     + new log entries          │
```

- **Messages from the client:** `join`, `act(action, version)`, `undo`, `pass` (missile window), `chat`.
- **Messages from the server:** `view(state, version)`, `log(entries)`, `error(reason)`, `presence(who's online)`, `timer`.
- **Version numbers** stop double-submits and stale clicks: an action for an old version is rejected and the client refreshes.
- **Start simple:** send the whole redacted view after each action (a few tens of KB including the log; trim the log to the newest entries). Diffs only if this turns out slow on mobile.
- **No client-side prediction** at first. Moves come back from the server in ~100 ms, and the existing ship animation hides most of that.

### Storage
Per game: config (players, map, mode, seed, **engine version**), the action list, and a
snapshot of the current state. The snapshot is what the server loads; the action list is
for replays and debugging. Our `golden.test.ts` already flags any engine change that would
alter replays, so a game in progress can't silently change rules mid-game: either finish
running games on the snapshot, or bump `GameState.version` with a migration.

---

## 4. What changes in the engine

All small, and all testable without a server:

- [ ] **`viewFor(state, seat)`** — redacted copy: `seed`/`rng` zeroed, deck contents replaced
      by placeholders (count kept), other players' `skillDraft.options` and `peek.top` hidden.
      Spectators get `viewFor(state, null)`.
- [ ] **`mayAct(state, seat, action)`** — the authorisation rule in one place: the seat is
      `actor(state)`; or the action is a `missile` with `by === seat`; `resolveCombat` only from
      the server. Today the UI dispatches some of these on anyone's behalf (hot-seat).
- [ ] **Validate untrusted actions** — a malformed action from a client must be rejected,
      never crash a handler: check the shape against the `Action` union first, and treat any
      non-`RuleError` exception as a rejection (plus a bug report).
- [ ] **Tests:** `legalActions(viewFor(s, actor))` equals `legalActions(s)` (the UI computes
      highlights from the view, so it must be enough); no log entry leaks a hidden card;
      `viewFor` passes `checkInvariants` (with a flag for hidden decks).
- [ ] **Missile response window** — see §5.

### Client changes

Today [useGame.ts](../apps/web/src/game/useGame.ts) owns the state, applies actions and
keeps undo history; it runs the AI through [useAiDriver.ts](../apps/web/src/game/useAiDriver.ts)
and announces log events through [toasts.ts](../apps/web/src/game/toasts.ts). Split that behind
one interface:

```ts
interface GameSource {
  view: GameState;        // what this client may see
  seat: PlayerId | null;  // null = spectator / hot-seat (all seats)
  dispatch(a: Action): void;
  undo?(): void;
}
```

`LocalGame` is today's behaviour (hot-seat + AI in a worker). `RemoteGame` talks to the
server. Board, panels and overlays use `GameSource` and don't care which one it is. The
rest of the online UI is new: create/join screens, the seat picker, "waiting for Anna…",
connection status, timers.

---

## 5. The hard parts

### Missiles: who may interrupt, and for how long?
In a combat, **any** player holding missiles may fire one, on either side. Hot-seat, the
combat overlay simply waits for someone to click *Resolve*. Online, the server must know
when everyone has had their chance. (This is open question #21 in
[OPEN-QUESTIONS.md](OPEN-QUESTIONS.md#interrupts-critical-for-online-play).)

Proposal:
1. After both combat dice are rolled, open a **response window** for every player with missiles.
2. Each such player either fires or passes. If anyone fires, the window reopens for the
   others (they may want to answer it).
3. When everyone has passed, the server resolves the combat.
4. **Timer:** real-time ~15 s, then auto-pass. Async: no timer per combat (it would take days);
   instead each player sets an **auto-pass rule** — "never", "only in my own fights",
   "always ask me" — so async games don't stall on every battle.
5. Players without missiles are never asked, so most combats resolve instantly.

The same mechanism covers **Dangerous** (#22, defender decides before the roll) and any
future "on another player's turn" decision.

### AI seats
The AI works from a redacted view already, so it can run anywhere:

- **On the server** (recommended): needed for async games where no human is online. Risk:
  the stronger levels search for a while; Cloudflare limits CPU per request. Measure each
  level's think time first; if too slow, cap the server AI's search time or run AI on a
  plain Node service instead.
- **In the host's browser** (fallback): the game creator's tab plays the AI seats and sends
  their moves. Free, but the AI stops when that tab closes.

### Undo
Keep today's rule: the acting player may undo moves that revealed nothing new
(`isUndoable`). Online, everyone sees the move taken back, and the history resets as soon as
anything random happens or the turn passes. That matches the current hot-seat behaviour.

### Disconnects and abandoned games
- Reconnect = open the link again; the server sends the latest view.
- Real-time: if a player is gone for N minutes, offer the others "replace with AI" or "end game".
- Async: per-game turn limit (e.g. 3 days), with reminders; then AI takes over or the game ends.

### Identity
- **Phase 1 (guests):** creating or joining a game gives the browser a secret seat token
  (kept in local storage). The invite link lets anyone claim an open seat. No accounts, no email.
- **Later (accounts):** needed for async play across devices, notifications and game history.
  Email magic link or "Sign in with Google/Apple" via a hosted auth service; guest seats can be
  upgraded to an account.

### Notifications (async play)
"It's your turn" via **email** (works everywhere) and **Web Push**. Note: on iPhone/iPad,
Web Push only works when the app is installed to the home screen — this ties in with
phase 5 of [MOBILE.md](MOBILE.md).

---

## 6. Plan

Each phase is playable on its own.

### Phase 0 — Decisions & engine prep (2–3 days)
- [ ] Decide hosting (§2) and the missile window (§5, closes open question #21).
- [ ] `viewFor`, `mayAct`, action validation, and their tests (§4).
- [ ] Engine response window for missiles (also improves hot-seat: no more manual *Resolve*).
- [ ] Measure AI think time per level on a small server instance.

### Phase 1 — Split the client (1–2 days)
- [ ] `GameSource` interface; move today's `useGame` behaviour into `LocalGame`; no visible change.
- [ ] Hot-seat keeps working exactly as before (golden tests + a manual game).

### Phase 2 — Play with friends, real-time (4–6 days)
Can be done **serverless first** (§2a): the room runs in the host's browser over WebRTC,
and the site stays on GitHub Pages. Moving the same room module to a server later is phase 2b.

- [ ] Transport-agnostic game room: create, join, claim seat, start, act, undo, reconnect.
- [ ] P2P transport (Trystero) with room codes; host saves the game locally and can resume it.
- [ ] Guest identity with seat tokens; invite link.
- [ ] Lobby UI: "Create online game" → share link → seats fill (human or AI level) → start.
- [ ] In-game: whose turn, who's connected, waiting states, connection lost/restored.
- [ ] Storage of config + actions + snapshot; local dev server (`npm run dev:server`).

**Done when:** two people on different devices finish an Original-mode game via a link,
including combats with missiles and a page reload in the middle.

### Phase 2b — Move the room to a server (2–3 days, when needed)
Needed for async play (phase 4), public play, or if P2P connections fail too often.
- [ ] Run the same room module in a Durable Object / Node server; storage of config + actions + snapshot.
- [ ] Keep P2P as an option, or drop it.

### Phase 3 — AI seats and timers (2–3 days)
- [ ] AI seats played by the server (or the host's browser, per §5).
- [ ] Missile window timers and auto-pass settings.
- [ ] Replace-with-AI for players who leave.

### Phase 4 — Asynchronous play (4–6 days)
- [ ] Accounts (upgrade a guest to an account).
- [ ] "My games" page: games where it's my turn first.
- [ ] Email notifications; Web Push for installed apps.
- [ ] Turn time limits, reminders, abandon handling.

**Done when:** a 3-player game can be played over a week, one move a day, from phone and desktop.

### Phase 5 — Extras (pick as needed)
- [ ] Table chat (and quick emotes); spectators.
- [ ] Replay viewer (step through the action list; reuses the board).
- [ ] Rematch with the same seats.
- [ ] Missile trading / "give missile" (open question #23), if we adopt it.

### Phase 6 — Public play (only if we want strangers to play)
- [ ] Open lobbies / matchmaking, ratings.
- [ ] Moderation basics (chat filter, report, block).
- [ ] **Name & IP check from roadmap M0 must be settled first** — "Quantum" and its trade dress
      belong to the publisher; anything public needs a working title.

**Rough total:** phases 0–3 about 2–3 weeks (play with friends, real-time, with AI);
phase 4 another 1–2 weeks.

---

## 7. Open decisions

1. **Who is it for first?** Friends via a link (phases 0–3) vs async/long games (phase 4) vs
   public matchmaking (phase 6). This decides how soon accounts are needed.
2. **Hosting:** start serverless (P2P from GitHub Pages, §2a), then Cloudflare Durable Objects
   (recommended) or a Node server (Fly.io/Render/VPS) when async play is wanted.
3. **Missile window** in real-time: timer length; whether to only ask players whose missile
   could change the result (the UI already computes "decisive").
4. **AI on the server or in the host's browser** — depends on the think-time measurement.
5. **Order with [MOBILE.md](MOBILE.md):** mobile first, multiplayer first, or interleaved?
   Async play is most useful on phones, so the two reinforce each other.
