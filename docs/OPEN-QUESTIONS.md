# Open Rules Questions

A tabletop group can resolve an ambiguity with a shrug; a rules engine can't. Each
item below needs a ruling before (or while) the engine implements it. The
**Proposed ruling** is a default — change it, then record the decision in
[RULES.md](RULES.md) and mark the item ✅.

Legend: 🔴 blocks the core engine · 🟡 needed for a specific card/feature · 🟢 polish · ✅ settled by a source (cited)

---

## Core rules

| # | | Question | Proposed ruling |
|---|---|---|---|
| 1 | ✅ | **Conquer sum** — must *all* your ships in orbital positions be counted, or may you pick a subset? | All of your ships in the 4 orbital positions count; enemy and diagonal ships are ignored. *2013 rulebook p.7: "If your ships in orbital positions add up to a higher or lower number, you cannot construct."* |
| 2 | ✅ | **Infamy timing** — immediately on reaching 6 (print edition) or in the end phase (stolksdorf CE)? | Immediately; play continues, and it can win the game mid-turn. *2013 rulebook p.9: "Place the quantum cube immediately - do not wait until the end of your turn."* The CE print edition agrees. |
| 3 | ✅ | **Movement** — "up to N": must a ship move at least 1? Does the attacked space count as one of the N steps? | At least 1 step. Entering the enemy's space costs a movement point (*2013 rulebook p.6*). A path is a sequence of orthogonal steps through empty spaces. |
| 4 | ✅ | **Repel** — "back to its last space" means the space it occupied immediately before the attack step? | Yes: "moves back into the square from which it attacked" (*2013 rulebook p.6*). |
| 5 | ✅ | **Per-die tracking** — "each die can move once / use one ability, even if it changes type". | Per die id, not per value: "Even if the number of a ship changes, a single ship die can only move/attack once per turn, and can only use one special ability per turn" (*2013 rulebook p.4*). |
| 6 | ✅ | **Deployed ship** — can a ship deployed this turn also move this turn? | Yes: "you can deploy a ship and move it in the same turn" (*2013 rulebook p.5*). |
| 7 | 🔴 | **Reconfigure history** — "until it shows a value it has not had this turn". Does the value it was rolled to on destruction count? | History starts at the value at the start of the turn (or when entering the scrapyard). |
| 8 | ✅ | **Card limits & empty decks** — what happens when the Skill/Tactic deck or face-up row runs out? | Reshuffle discards into a new deck; if still empty, fewer face-up cards. *2013 rulebook p.9: "If there are no more cards in a deck, shuffle the discards and make a new deck."* |
| 9 | 🔴 | **Multiple cards in phase 2** — order of taking (conquer cards vs research card)? | Player chooses order; each refill happens before the next pick. |
| 10 | 🔴 | **Combat roll pipeline** — order of *set* effects (Rational = 3, Plan Ahead = 1, Missile = 1, Brutal) vs *modifiers* (Ferocious −1, Strategic −2). Can a roll go below 1? | `roll (Brutal: min of 2)` → `set (Rational / Plan Ahead)` → `missile override` → `modifiers`. Rolls may go to 0 or below. |
| 11 | ✅ | **Planet capacity** — Infamy and Entanglement still require an empty cube location? | Yes. Infamy: "any empty cube location on a planet where you do NOT already have a cube" (*2013 rulebook p.9*). Entanglement: designer errata (BGG thread 1087563). |
| 12 | 🟡 | **Quantum Entanglement** — target is `planet + 3 × your cubes there`. With Intelligent (±1) and Pioneering/Tyrannical? | Modifiers apply to the raised target. |
| 13 | ✅ | **Expansion with empty reserve** — can you take the card? | No — Expansion is not selectable with an empty reserve, in the Gambit row (Original) or the Expansion pile (CE). *2013 rulebook p.9: "If you already have both of your expansion ships in the game, you cannot use EXPANSION cards."* |
| 14 | ✅ | **Starting planets** — what if a map has more starting planets than players? | Players pick in turn order from any marked starting planet. All cubes are placed first, then each player arranges their ships in player order (*2013 rulebook p.3*). |
| 15 | 🟢 | **Void tile research** — capped at 6? Triggers a card? | Capped at 6; card is taken in phase 2 as normal. |

## Ship abilities

| # | | Question | Proposed ruling |
|---|---|---|---|
| 16 | ✅ | **Battlestation Free Attack** — usable if the die already moved this turn? | Yes. It does not use the die's move. "It is possible to move/attack normally and also use strike for a second attack on the same turn" (*2013 rulebook p.8*). |
| 17 | ✅ | **Flagship carry** — passenger picked from a surrounding space (diagonal OK). Can the passenger have already moved? Does it then still get its own move? | Being carried is not the passenger's move: it may be carried whether or not it has moved, and may still move afterwards if it hasn't. A carried ship may be carried again, and a carried flagship may then transport another ship ("triple-Flagship slingshot", designer, [BGG 1113798](https://boardgamegeek.com/thread/1113798)). Pickup happens before the move, drop-off after; no pickups en route. The flagship may fly out and back to its own space ("zero move" transport, designer, [BGG 1074052](https://boardgamegeek.com/thread/1074052)). |
| 18 | ✅ | **Destroyer swap** — any distance? | Any of your ships on the map, any distance. Warp does not count as the destroyer's move (*2013 rulebook p.8*). |
| 19 | ✅ | **Frigate → 3/5** — can it then use the new type's ability (swap, or diagonal move)? | No: "After you modify, you can't use the ship's new ability this turn" (*2013 rulebook p.8*). |
| 20 | ✅ | **Interceptor diagonal** — may it squeeze diagonally between two blocking pieces? | Yes; only the destination square must be empty, including diagonal steps past a planet's corner. It may mix diagonal and orthogonal steps in one move. Forum consensus, no designer post ([BGG 1286057](https://boardgamegeek.com/thread/1286057), [1558524](https://boardgamegeek.com/thread/1558524)). |

## Interrupts (critical for online play)

| # | | Question | Proposed ruling |
|---|---|---|---|
| 21 | 🔴 | **Missiles "at any time"** — online, we need explicit priority windows. When exactly? | One window after both combat dice are rolled and before resolution. Every player (in turn order from attacker) may respond; window repeats until all pass. Configurable timer. |
| 22 | ✅ | **Dangerous** — defender decides before the roll, on the opponent's turn. | The defender is asked after the attack is declared, before any dice are rolled. Destroying both ships changes no dominance and triggers no "when you destroy" card (Plundering, Warlike…) for either side (designer, [BGG 1070690](https://boardgamegeek.com/thread/1070690)). |
| 23 | 🟡 | **Missile trading** — free-form deals online? | Only the stolksdorf CE allows trading; the print booklet doesn't mention it. Not implemented. If added: a "give missile" action at any time, no binding contracts. |

## Cards

| # | | Card | Question | Proposed ruling |
|---|---|---|---|---|
| 24 | 🟡 | Skills (all) | "Takes effect on the next player's turn" — so a skill taken in phase 2 never helps the current turn? | Correct. Skill becomes active at end of your turn. |
| 25 | 🟡 | Hostile / Plundering / Ravenous / Ruthless | "First time you destroy an enemy ship each turn" — does destroying while **defending** (Stubborn) count? | Yes, on any player's turn. |
| 26 | 🟡 | Show of Force | Does the victim lose dominance? Does it count as "destroying" for Hostile etc.? | Victim loses no dominance. Counts as a destroy. |
| 27 | 🟡 | Unveil the Fleet | Lose dominance for own destroyed ships? Where can ships deploy? | No dominance change. Normal deploy rules, no action cost. |
| 28 | 🟡 | Momentum | Does the bonus turn get a phase 2? Do once-per-turn effects reset? | Yes and yes — a full new turn with 2 actions. |
| 29 | 🟡 | Sabotage | Stacks with multiple copies? Applies to Momentum turns? | Stacks; applies to each opponent's next *regular* turn. |
| 30 | 🟡 | Warp Gate | Is the link usable for attack and deploy-adjacency? Can a ship stand on a gate? | Movement/attack adjacency only. Ships may stand on gates. |
| 31 | 🟡 | Precocious / Prideful | Is reset at 4/5 optional? | Optional — player chooses at end of turn. *Engine today: CE Precocious always resets at 4 (as the Original card does).* |
| 32 | 🟡 | Prideful | When taken by another player, does it count against their skill limit? | Yes; they discard down if over. |
| 33 | 🟡 | Righteous | Blocks all research gain including Brilliant, Void, Composed? | Yes. |
| 34 | 🟡 | Tyrannical vs Pioneering | Tyrannical *adds* dominance as an extra ship; Pioneering *replaces* one ship. Confirm. | Confirmed per card text. |
| 35 | 🟡 | Ingenious | Do diagonal ships add to the sum (all of them)? | Yes — all your ships in the 8 surrounding spaces count. |
| 36 | 🟡 | Curious | "Did not Attack or Conquer" — includes Battlestation free attack and Infamy conquest? | Attack: yes. Infamy: no. |
| 37 | 🟡 | Patient | Does a stored Expansion count? | No — only Tactic cards. |
| 38 | 🟡 | Ambitious | Card discarded mid-turn after third token — keeps the action? | Yes. |
| 39 | 🟡 | Calculating | Applies to every way a ship reaches the scrapyard (combat, Resourceful, Dangerous, Show of Force, Unveil the Fleet)? | Yes. |
| 40 | 🟢 | Black Market | 1 or 2 missiles (source conflict)? | 2 (print edition). |
| 41 | 🟢 | Aggression | Keep it (print) or remove (stolksdorf)? | Keep for v1; revisit with AI self-play balance data. |
| 42 | ✅ | Curious (Original) | 1st printing: "1 extra move action for free (you cannot use it to attack)". Was it changed? | Yes, by the 2nd-printing errata: "You now get an extra move action on your turn, as long as you do not attack any other player during your entire turn" (designer, [BGG 1087563](https://boardgamegeek.com/thread/1087563)). It may be taken at any point in the turn, but not on a ship that has already moved (forum consensus and BGA, [BGG 1142576](https://boardgamegeek.com/thread/1142576), [1696327](https://boardgamegeek.com/thread/1696327)). Engine: the free move is used automatically. Attacking later (including Strike) charges an action for it, which is the same as if the player had not used Curious; an attack you can't pay for is refused. A Transport is a move without an attack, so the free move can pay for it. |
| 43 | ✅ | Cunning | Must the second use be the *same* ability, or can it be the die's new ability after Modify or a Scout re-roll? | Either. The second use can be the new ship's ability (e.g. a Frigate Modifies into a 5, then uses Cunning to move diagonally; a Scout re-rolls into a 4, then Modifies). Without Cunning, a Modified Frigate can't use the new ability ([BGG 1555754](https://boardgamegeek.com/thread/1555754)). Forum consensus, no designer post ([BGG 1166471](https://boardgamegeek.com/thread/1166471), [1144799](https://boardgamegeek.com/thread/1144799)). |
| 44 | ✅ | Tactical (Original) | "Once per turn as a free action, move a ship a total of 1 space." Can that ship also make its normal move this turn? | No. It costs no action, but it is that ship's one move for the turn, so the ship can't have moved already or move again afterwards (only Energetic allows that). Forum consensus, no designer post ([BGG 1166414](https://boardgamegeek.com/thread/1166414), [1137478](https://boardgamegeek.com/thread/1137478), [1093051](https://boardgamegeek.com/thread/1093051)). Agile does not lengthen it ([BGG 2433096](https://boardgamegeek.com/thread/2433096)). |
| 45 | ✅ | Tactical (Original + CE) | Can the 1-space Tactical move use Transport (Flagship) or Maneuver (Interceptor, diagonal step)? | Yes, per forum consensus and BGA ([BGG 1093051](https://boardgamegeek.com/thread/1093051), [2433096](https://boardgamegeek.com/thread/2433096)). A Tactical Transport can't fly out and back, because that needs 2 spaces. Either way the ship uses its ability for the turn; an Interceptor only does if it actually steps or attacks diagonally. |
| 46 | 🟢 | Tactical (CE) | The CE text ("Once per turn, you may move/attack 1 space with a ship even if it's already moved") drops "as a free action". Does it now cost an action? | No, it stays free (current engine). No source rules on it, but the CE removed "as a free action" from every card that had it (Composed, Cunning, Flexible, Tyrannical; stolksdorf `Cards.md`) without changing what they cost. The CE turn wording also lists card abilities separately from the 3 actions. |
| 47 | ✅ | Composed / Cerebral | Can it be used at dominance 1, gaining 3 research without losing anything? | No. The card says "lose 1 Dominance" (CE) / "reduce your dominance by 1" (2013), so it needs dominance 2+. |
| 48 | ✅ | Stubborn | Does the attacker die only on a tie, or whenever the defender wins? | Whenever the defender wins: "ties go in your favor **and** you destroy your attacker if you win (and gain dominance)" (2013 and CE card text). |
| 49 | 🟡 | Talented | Taken as your 4th skill, it isn't active until the next player's turn. Must you discard down to 3 at once? | Engine today: yes (literal reading of "if you have more than 3, immediately discard one"). Many groups would let Talented count itself. |
| 50 | 🟢 | Reconfigure (CE) | The booklet says you *may* continue re-rolling until the die shows a new value. May you stop on a value it already showed? | Engine: no, it always re-rolls to a value not yet seen this turn. Stopping early is almost never useful. |
| 51 | 🟢 | Peek (CE) | The deck is empty but the discard pile isn't. Can you peek? | Engine today: no peek. Arguably the discards should be reshuffled first so the peek is possible. |
| 52 | ✅ | Cruel / Relentless / Scrappy | When are combat re-rolls made, and in what order? | After both players have rolled once, and you must keep the new roll (*2013 rulebook p.14*). Each card re-rolls once per battle, so two cards give two re-rolls (Relentless + Scrappy, [BGG 1137956](https://boardgamegeek.com/thread/1137956)); a Cruel re-roll may itself be re-rolled with Scrappy ([BGG 1196182](https://boardgamegeek.com/thread/1196182)). A roll set by a missile, Plan Ahead or Rational can't be re-rolled. **Engine deviation:** the rulebook says the attacker decides first, then the defender. The engine offers re-rolls in any order in the same window as missiles, as BGA does (it asks whoever is losing, [BGG 2639806](https://boardgamegeek.com/thread/2639806)). |
| 53 | ✅ | Clever (Original) | Which rolls does it cover? | Every roll of one of your ships: Reconfigure, Free Reconfigure, a destroyed ship (on any player's turn), Resourceful, Expansion and Reorganization (*2013 rulebook p.14* for Reorganization; forum consensus, [BGG 1130300](https://boardgamegeek.com/thread/1130300)). Not combat dice. A Reconfigure must still change the number. Not the setup roll (no Command cards then). |
| 54 | ✅ | Scrappy (Original) | "Reroll all of your die rolls a second time" — which rolls, and is a re-rolled Reconfigure still a Reconfigure? | On your turn only: your combat dice once per battle, and each roll of one of your ships, right after it (any other action gives it up). A re-rolled Reconfigure still can't show the number the ship started from (forum consensus, [BGG 1759804](https://boardgamegeek.com/thread/1759804)). With Clever, Clever's choice replaces both. |
| 55 | ✅ | Nomadic (Original) | What is "next to" its planet? Is the relocation a move (attack, Transport, the ship's one move)? | The planets on the 4 orthogonally adjacent tiles (designer, [BGG 1182319](https://boardgamegeek.com/thread/1182319)), so not diagonal tiles; a ship by the Void has no planet. The destination must be an empty orbital position. "Relocate" is not a move: no attack or Transport, and the ship can still move this turn (forum consensus, [BGG 1636855](https://boardgamegeek.com/thread/1636855), [1557183](https://boardgamegeek.com/thread/1557183)). |
| 56 | 🟡 | Relocation (Original) | The 1st printing forbids moving the cube to a higher-numbered planet; later printings drop that ([BGG 2465215](https://boardgamegeek.com/thread/2465215)). Which? | Engine: the 1st-printing text (no higher number), as in `data/cards.yaml`. Any other player's cube, to any planet with room and none of that player's cubes. Skipped when no cube can move. |
