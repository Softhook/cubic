# Rule Suggestions

Proposed rulings for the questions in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) that no source settles. Nothing here is adopted yet; each item needs a decision before it goes into [RULES.md](RULES.md).

**Provenance.** **[Upstream]** items come from the text of [stolksdorf/quantum](https://github.com/stolksdorf/quantum/tree/master) (`Cards.md`, `New Rules.md`, `src/cards/*.yaml`, last touched Nov 2019). That repo settles card wording but not timing or interaction. **[Suggestion]** items are reasoned guesses from the rules text already cited in this repo; no source backs them. The print edition is the baseline, so it wins over upstream where they differ.

---

## 1. Decisions you need to make

| # | Question | Options and recommendation |
|---|---|---|
| 30 | Warp Gate: how general is the link? | The print text ("Any player may consider those spaces adjacent") already settles *who* may use it. Still open: which rules the link counts for. The engine allows movement and attack only. A general link would also cover deploy, Flagship pickup, Stealthy, Strategic support **and the Conquer sum and Ingenious**: a ship on a far gate would count toward the planet's orbital total. That last effect is the strongest. **Recommend:** movement, attack and Strategic support; not deploy, Flagship pickup or Conquer. |
| 26, 27 | Does destruction outside combat cost the victim dominance (Show of Force, Unveil the Fleet)? | The card texts are silent. [RULES.md](RULES.md) says dominance "falls when you're destroyed", and Dangerous needed to state "there is no dominance effect", which suggests destruction normally has one. **Recommend:** Show of Force: the victim loses 1. Unveil the Fleet: no loss, since losing 1 dominance per ship for your own card would make it unplayable. |
| 25 | Hostile while defending | "First time you destroy an enemy ship each turn" counts on any player's turn ([Upstream]: CE changed "on your turn" to "each turn"). That works for Plundering, Ravenous and Ruthless, but an action gained on someone else's turn has no meaning. **Recommend:** Hostile's extra action is lost when gained off-turn (simplest; no carried state). |
| 7 | Reconfigure history after destruction | The engine replaces the history with the destruction roll ([core.ts](../packages/engine/src/core.ts) `destroyShip`). The alternative keeps the start-of-turn value too. Example: a ship starts at 3, is destroyed and rolls 5. The engine lets a Reconfigure bring it back to 3; the alternative doesn't. **Recommend:** keep the engine (a destroyed ship is "a new ship"; matches the designer ruling that a destroyed ship may show its old number, [BGG 1146181](https://boardgamegeek.com/thread/1146181)). |

---

## 2. Likely worth adopting (upstream text supports it)

| # | Card / rule | Proposal | Basis |
|---|---|---|---|
| 31 | Precocious / Prideful (CE) | The reset is **optional**: the player decides at end of turn. **CE cards only:** the Original Precocious keeps its forced reset at 4 (BGG/BGA). Engine change needed: it currently resets CE Precocious at 4 always. | **[Upstream]** CE text is "resets at 4, 5, or 6". Optional matters with Pioneering, where the research number itself is useful. |
| 37 | Patient | A stored Expansion does not count. | **[Upstream]** Expansion is its own card type in CE, not a Tactic. |
| 39 | Calculating | Applies to every route to the scrapyard (combat, Resourceful, Dangerous, Show of Force, Unveil the Fleet). | **[Upstream]** "When a ship is placed in your scrapyard". |
| 33 | Righteous | Blocks every research gain (Brilliant, Void, Composed, Plundering) but not **resets**. Composed is unusable because its cost (lose 1 Dominance) can't be paid. | **[Upstream]** "You can not gain Research"; `New Rules.md` treats "reset" as a separate term. |
| 34 | Tyrannical / Pioneering | Tyrannical **adds** dominance as an extra ship number. Pioneering **replaces** one ship number. | **[Upstream]** Card text. |
| 26 | Show of Force | Counts as a destroy for Hostile and similar cards (enemy ships only, per their text) and for Prideful. "Any one ship" includes your own. Dominance: see §1. | **[Upstream]** "Destroy any one ship. Gain 1 Dominance." |
| 38 | Ambitious | The action is gained first, then the token is placed. On the third token the card is discarded but the action is kept. | **[Upstream]** "take an additional action, then put a token". |
| 46 | Tactical (CE) | Stays free. | **[Upstream]** `New Rules.md` lists card abilities separately from the 3 actions. |

---

## 3. Suggestions (no source)

| # | Question | Suggestion | Confidence / impact |
|---|---|---|---|
| 10 | Combat pipeline | **Keep the current order** (roll → Rational / Plan Ahead → missile → modifiers). The designer says modifiers apply to the combat number, not the die face, and a missile changes the die face. Lower totals win, so applying the missile last would cancel Ferocious and Strategic and let a missile *worsen* an opponent already below 1. | Medium / High |
| 10 | Rational (3) and Plan Ahead (1) both active | The **lower** wins. Plan Ahead is a temporary self-buff, so a player would never choose the worse number. | Medium / Low |
| 21 | Missile window | Keep the proposal: one window after both dice are rolled, repeating until all pass. No pre-roll window: Tactics resolve when taken, so Plan Ahead is never played mid-combat, and Dangerous already has its own prompt (#22). | Medium / High |
| 23 | Missile trading | Remove the item. The print baseline has no trading, and an engine can't enforce deals. | Medium / Low |
| 29 | Sabotage | Stacks, so each copy removes one more action. Floor at 1 action (invented, to keep a turn playable). Applies to each opponent's next regular turn, not a Momentum bonus turn. Weakest part: Momentum says "treat it as a brand-new turn", which hints a bonus turn is a turn. | Medium / Low |
| 32 | Prideful and the skill limit | The taker discards down to the limit at once, but may not discard the Prideful just taken. Taking is optional, so this only stops a denial play (take it and bin it). | Low / Low |
| 36 | Curious and Infamy | The Infamy placement in the end phase is not a Conquer action, so it does not block Curious. Attacks, including Battlestation Strike, do. | Low / Low |
| 49 | Talented | Counts toward the cap, and the cap rises as soon as it is in hand, so no forced discard on pickup. This is an explicit exception to #24 (skills become active at end of turn). CE says "up to 5", so the original "discard immediately" wording no longer applies. | Medium / Low |
| 51 | Peek with an empty deck | Reshuffle discards first, consistent with #8, so a peek always has a card to show. | Medium / Low |

---

## 4. Close without a decision

- **#12 Entanglement with Intelligent / Pioneering / Tyrannical.** The order doesn't matter: (planet ± 1) + 3k = (planet + 3k) ± 1, and Pioneering and Tyrannical change the ship side of the sum, not the target.
- **#15 Void research.** Research is already capped at 1–6 ([RULES.md](RULES.md)), and the Researcher check comes in the card phase.
- **#24 Skill activation, #50 Reconfigure (CE) stopping early.** The proposed ruling is what the engine does; nothing better is on offer.
- **#40 Black Market (2), #41 Aggression (keep).** Already the print text and the data. Upstream conflicts with itself on both, so it can't override the baseline.
