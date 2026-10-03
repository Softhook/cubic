# Rule Suggestions

Proposed rulings for the questions in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) that no source settles. Nothing here is adopted yet; each item needs a decision before it goes into [RULES.md](RULES.md).

**Provenance.** **[Upstream]** items come from the text of [stolksdorf/quantum](https://github.com/stolksdorf/quantum/tree/master) (`Cards.md`, `New Rules.md`, `src/cards/*.yaml`, last touched Nov 2019). That repo settles card wording but not timing or interaction. **[Suggestion]** items are reasoned guesses from the rules text already cited in this repo; no source backs them. The print edition is the baseline, so it wins over upstream where they differ.

---

## 1. Decisions you need to make

| # | Question | Options and recommendation |
|---|---|---|
| 30 | Warp Gate: how general is the link? | The print text ("Any player may consider those spaces adjacent") already settles *who* may use it. Still open: which rules the link counts for. The engine allows movement and attack only. A general link would also cover deploy, Flagship pickup, Stealthy, Strategic support **and the Conquer sum and Ingenious**: a ship on a far gate would count toward the planet's orbital total. That last effect is the strongest. **Recommend:** movement, attack and Strategic support; not deploy, Flagship pickup or Conquer. **Superseded by [§5.2](#52-item-level-findings):** the Conquer worry is a misreading (gates link spaces, not planets); adopt the general link. |
| 26, 27 | Does destruction outside combat cost the victim dominance (Show of Force, Unveil the Fleet)? | The card texts are silent. [RULES.md](RULES.md) says dominance "falls when you're destroyed", and Dangerous needed to state "there is no dominance effect", which suggests destruction normally has one. **Recommend:** Show of Force: the victim loses 1. Unveil the Fleet: no loss, since losing 1 dominance per ship for your own card would make it unplayable. **Superseded by [§5.2](#52-item-level-findings):** no victim loss for either card; dominance changes only through the attack protocol or card text. |
| 25 | Hostile while defending | "First time you destroy an enemy ship each turn" counts on any player's turn ([Upstream]: CE changed "on your turn" to "each turn"). That works for Plundering, Ravenous and Ruthless, but an action gained on someone else's turn has no meaning. **Recommend:** Hostile's extra action is lost when gained off-turn (simplest; no carried state). |
| 7 | Reconfigure history after destruction | The engine replaces the history with the destruction roll ([core.ts](../packages/engine/src/core.ts) `destroyShip`). The alternative keeps the start-of-turn value too. Example: a ship starts at 3, is destroyed and rolls 5. The engine lets a Reconfigure bring it back to 3; the alternative doesn't. **Recommend:** keep the engine (a destroyed ship is "a new ship"; matches the designer ruling that a destroyed ship may show its old number, [BGG 1146181](https://boardgamegeek.com/thread/1146181)). |

---

## 2. Likely worth adopting (upstream text supports it)

| # | Card / rule | Proposal | Basis |
|---|---|---|---|
| 31 | Precocious / Prideful (CE) | The reset is **optional**: the player decides at end of turn. **CE cards only:** the Original Precocious keeps its forced reset at 4 (BGG/BGA). Engine change needed: it currently resets CE Precocious at 4 always. **Rejected in [§5.2](#52-item-level-findings):** "4, 5, or 6" covers jumps past 4, not choice; keep the forced reset. | **[Upstream]** CE text is "resets at 4, 5, or 6". Optional matters with Pioneering, where the research number itself is useful. |
| 37 | Patient | A stored Expansion does not count. | **[Upstream]** Expansion is its own card type in CE, not a Tactic. |
| 39 | Calculating | Applies to every route to the scrapyard (combat, Resourceful, Dangerous, Show of Force, Unveil the Fleet). | **[Upstream]** "When a ship is placed in your scrapyard". |
| 33 | Righteous | Blocks every research gain (Brilliant, Void, Composed, Plundering) but not **resets**. Composed is unusable because its cost (lose 1 Dominance) can't be paid. See [§5.2](#52-item-level-findings): hide Composed under Righteous; the Infamy reset is not a loss. | **[Upstream]** "You can not gain Research"; `New Rules.md` treats "reset" as a separate term. |
| 34 | Tyrannical / Pioneering | Tyrannical **adds** dominance as an extra ship number. Pioneering **replaces** one ship number. | **[Upstream]** Card text. |
| 26 | Show of Force | Counts as a destroy for Hostile and similar cards (enemy ships only, per their text) and for Prideful. "Any one ship" includes your own. Dominance: no victim loss ([§5.2](#52-item-level-findings)). Only Plundering and Ravenous matter in practice, since Tactics resolve in the card phase. | **[Upstream]** "Destroy any one ship. Gain 1 Dominance." |
| 38 | Ambitious | The action is gained first, then the token is placed. On the third token the card is discarded but the action is kept. | **[Upstream]** "take an additional action, then put a token". |
| 46 | Tactical (CE) | Stays free. | **[Upstream]** `New Rules.md` lists card abilities separately from the 3 actions. |

---

## 3. Suggestions (no source)

| # | Question | Suggestion | Confidence / impact |
|---|---|---|---|
| 10 | Combat pipeline | **Keep the current order** (roll → Rational / Plan Ahead → missile → modifiers). The designer says modifiers apply to the combat number, not the die face, and a missile changes the die face. Lower totals win, so applying the missile last would cancel Ferocious and Strategic and let a missile *worsen* an opponent already below 1. Needs a source for the designer claim ([§5.2](#52-item-level-findings)). | Medium / High |
| 10 | Rational (3) and Plan Ahead (1) both active | The **lower** wins. Plan Ahead is a temporary self-buff, so a player would never choose the worse number. | Medium / Low |
| 21 | Missile window | Keep the proposal: one window after both dice are rolled, repeating until all pass. No pre-roll window: Tactics resolve when taken, so Plan Ahead is never played mid-combat, and Dangerous already has its own prompt (#22). | Medium / High |
| 23 | Missile trading | Remove the item. The print baseline has no trading, and an engine can't enforce deals. | Medium / Low |
| 29 | Sabotage | Stacks, so each copy removes one more action. ~~Floor at 1 action~~ (dropped in [§5.2](#52-item-level-findings): unreachable with 2 copies). Applies to each opponent's next regular turn, not a Momentum bonus turn. Weakest part: Momentum says "treat it as a brand-new turn", which hints a bonus turn is a turn. | Medium / Low |
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

---

## 5. Meta-review

A second, critical pass over §1–§4 **and over the first draft of this section**. Every claim here was checked against the print booklet text (`pdftotext` of [QCB-rules-booklet-A5.pdf](../reference/community-edition-print/QCB-rules-booklet-A5.pdf)) and the engine. Several first-draft conclusions turned out to be wrong; they are retracted in [§5.4](#54-retractions-from-the-first-draft).

### 5.1 Systemic problems in the method

1. **Circular sourcing (#26).** §1 argues that destruction "normally" costs dominance because [RULES.md](RULES.md) says dominance "falls when you're destroyed". That line is this project's own paraphrase. The print booklet defines dominance change **only** in the attack protocol: "If the attacker won, the attacker gains +1 dominance … and the defender loses -1 dominance." There is no general rule to fall back on.
2. **Evidence read backwards (#26).** The Dangerous parenthetical ("there is no dominance effect") is needed because Dangerous happens *inside* an attack, where the attack protocol would otherwise apply. It says nothing about destruction outside combat. Show of Force, meanwhile, spells out "Gain 1 Dominance". If destroying a ship gave dominance automatically, that clause would be redundant. The card text points the other way from §1.
3. **"[Upstream]" overstates support.** Most §2 items are just the literal card text, which the print edition shares. Calling them upstream-backed adds no authority. In one case the tag claims support the text doesn't give: #31, see below.
4. **No stated tie-break order.** The rulings swing between literal text (#33, #38), playability (#27, #29) and simplicity (#25) without saying which wins. Proposed order:
   1. literal print text;
   2. designer/BGA precedent for the Original equivalent card;
   3. what the engine already does;
   4. playability.
   Invent a rule only for a state that can actually occur.
5. **Timing blind spot.** Tactics resolve when taken, which is almost always the card phase (§3 #21 relies on exactly this). §2 #26 ignores it. Hostile's action is worthless there. Plundering's research lands after the Researcher check, so it only counts next turn. Ravenous can trigger Infamy mid card phase. The ruling should say which triggers actually matter.
6. **Code impact is never flagged.** Readers can't tell which proposals change behaviour. The live divergences are #26 triggers, #30 Strategic and Stealthy, and #49 Talented (see 5.3), plus Composed being offered under Righteous.

### 5.2 Item-level findings

| # | Finding | Verdict |
|---|---|---|
| 26, 27 | Given 5.1 points 1 and 2, the consistent principle is: **dominance changes only through the attack protocol or explicit card text.** Show of Force: the victim loses nothing; the player gains the stated +1. Unveil and Resourceful: nothing. This is OPEN-QUESTIONS' original proposal, and what the engine already does (`showOfForce`, `unveil-the-fleet`, `resourceful` call only `destroyShip`). §1 should revert. | **Reject §1 #26.** No dominance change. |
| 26 | "Destroy" triggers (Hostile, Plundering, Ravenous) are literal: the card destroys a ship. The engine doesn't fire them, because `onDestroy` in `combat.ts` is combat-only and also carries the combat dominance swing. Given the card-phase timing, only Plundering and Ravenous matter in practice. | Adopt, low priority. Needs the trigger part split from the dominance part; enemy ships only. |
| 31 | The Original Precocious reads "research = 4 **or higher**"; CE rewords it as "resets at 4, 5, or 6". Listing 5 and 6 covers jumps past 4 (Brilliant +2, Composed +3, Plundering +3), not optionality. The Researcher rule it modifies is mandatory ("reset it to 1 then take a card"). CE Precocious **is** implemented, and `research >= 4` forced is the literal reading. The Pioneering argument is weak: conquering happens in phase 1, before the reset. | **Reject.** Keep the engine. Move from §2 to §3 at best. |
| 30 | The Conquer worry rests on a misreading. Gates link two *spaces* (`warpGate` refuses planets). An orbital position is a space adjacent to the *planet*, so a ship on a far gate is adjacent to the orbital space, never to the planet. Conquer, Ingenious and Deploy are unaffected under any reading. A general link ("the two spaces are adjacent, full stop") then only adds Strategic support and Stealthy's "not adjacent to a ship" test. It is the simplest ruling and has no hidden power. The §1 recommendation adds Strategic, which is a code change: RULES.md and the engine exclude it today. | **Adopt the general link.** Code change for Strategic and Stealthy; drop the Conquer caveat. |
| 29 | The engine already stacks (`actionPenalty++`) and exempts bonus turns (`startTurn`). Its floor is 0, but with 2 Sabotage copies the most a turn can lose is 2 actions, leaving 1, so a floor at 1 can never come into play. | Document what the engine does; **delete the invented floor**. |
| 49 | The engine forces a discard on pickup today: new skills are inactive until end of turn, and `skillLimit` counts only active skills, so taking Talented as a 4th skill prompts a discard to 3. The §3 proposal fixes a real weakening of the card. The exploit worry in the first draft is moot if the limit is simply "5 while Talented is held", rechecked on every discard. | **Adopt.** Small code change in `skillLimit`. |
| 33 | Agree on gains. Two gaps: (a) `legal.ts` still offers Composed under Righteous as a no-op that burns its once-per-turn use; (b) the reset-isn't-a-loss logic should also say that the Infamy dominance reset is not a "loss" for Righteous. The engine already does (b): `combat.ts` sets dominance to 1 directly. | Adopt; hide Composed under Righteous and state (b). |
| 10 | Sound argument, but "the designer says modifiers apply to the combat number" carries no link, unlike every other designer citation here. The booklet uses "combat roll" for both the missile and Ferocious, so the text alone doesn't settle the order. | Keep; **add the source or label it a suggestion**. |
| 10 (Rational / Plan Ahead) | Already the engine: `rollOverride` checks Plan Ahead before Rational. | Close. |
| 7, 21, 23, 25 | Correct and already engine behaviour. | Promote to RULES.md. |
| 34, 38, 46 | Literal card text; Ambitious and Tactical are already implemented this way. | Promote to RULES.md. |
| 32, 36, 37, 39, 51 | Reasonable; the cards (Prideful, Curious, Patient, Calculating) are unimplemented, except #51, which is low impact. | Decide with each card. |

### 5.3 What to change in code now

1. **#49 Talented:** let a held Talented raise the limit immediately.
2. **#30 Warp Gate:** treat gate spaces as adjacent for Strategic and Stealthy too.
3. **#33 Righteous:** don't offer Composed when it can't do anything.
4. **#26 triggers** (optional): fire Plundering and Ravenous from Show of Force on enemy ships, with no victim dominance loss.

Each change needs a scenario test that cites this section. Nothing else needs engine work; the remaining items are doc promotions or wait for their card.

### 5.4 Retractions from the first draft

- **#26 dominance:** the first draft endorsed "victim loses 1". Withdrawn (5.1 points 1 and 2).
- **#27:** the "opponent costs 1, self costs 0" principle was built on the same faulty premise. Replaced by "attack protocol or card text only".
- **#31:** it said Precocious was unimplemented in CE and endorsed optional resets. Precocious is implemented, and the forced reading is the literal one.
- **#30:** it said the recommendation "matches RULES.md". It doesn't: adding Strategic is a change.
- **#29:** it called the bonus-turn exemption invented and in the same breath said to keep current behaviour, which *is* the exemption. The real issue is only the unreachable floor.
- **#37–#46:** it said none of these cards were implemented. Ambitious and Tactical are, and they match.
- **#26 own-ship loop:** it warned of a loop with Prideful or Calculating. Both are unimplemented, and a one-shot card can't loop.
- **Ravenous and Ruthless:** Ravenous triggers on the first destroy each turn, not "each destroy". Ruthless isn't implemented, so it can't fire anyway.
