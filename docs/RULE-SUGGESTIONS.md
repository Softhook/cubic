# Rule Suggestions

Proposed rulings for the questions in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) that no source settles. Nothing here is adopted yet; each item needs a decision before it goes into [RULES.md](RULES.md).

**Provenance.** Items marked **[Upstream]** come from the text of [stolksdorf/quantum](https://github.com/stolksdorf/quantum/tree/master) (`Cards.md`, `New Rules.md`, `src/cards/*.yaml`). Items marked **[Suggestion]** are reasoned guesses from the rules text already cited in this repo. They are not designer rulings and no source backs them.

Confidence: **High** / **Medium** / **Low**. Impact is how much the ruling changes gameplay.

## Sources and method

- **Read:** every rules or card text file in the stolksdorf repo: `README.md`, `New Rules.md`, `Cards.md`, `reference/cards.original.md`, `src/cards/*.yaml`, its two issues (neither relevant) and its commit history. The rest of the repo is art, fonts, player-aid code and build scripts.
- **Limits:** the repo is a card-design repo, not a rulebook, and was last touched in Nov 2019. It settles card wording but not timing or interaction questions (#7, #10, #21 and similar).
- **Web search:** general search was no help (it returned wrong claims such as "Quantum has no Sabotage card"). The BGG threads already cited in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) remain the best source.
- **Upstream conflicts:** upstream disagrees with itself in places (Black Market 1 vs 2 missiles, Aggression kept and also "replaced" by Show of Force). Both are noted below.

---

## 1. Likely worth adopting (upstream text supports it)

| # | Card / rule | Proposal | Basis |
|---|---|---|---|
| 31 | Precocious / Prideful | The reset is **optional**: the player decides at end of turn. **Engine today always resets Precocious at 4, so it would need to change.** | **[Upstream]** CE text is "resets at 4, 5, or 6", the same optional wording as the base game. |
| 30 | Warp Gate (Hypernet Gate) | Ships may stand on a gate. Adjacency is **general** (movement, attack, Stealthy, Strategic, Flagship pickup, deploy). The engine currently allows movement and attack only. | **[Upstream]** CE says "may consider those spaces adjacent", with no restriction, and the tokens are flat "a die can sit on top of". **[Suggestion]** A general link is a strong effect, so restricting it is a design choice. Decide on purpose. |
| 30 | Who may use a gate | Pick one baseline. The stolksdorf CE lets only players who played the card use it. The print edition lets any player. | **[Upstream]** and print edition. This is a decision for you. |
| 37 | Patient | A stored Expansion does not count. | **[Upstream]** Expansion is its own card type in CE, not a Tactic. |
| 39 | Calculating | Applies to every route to the scrapyard (combat, Resourceful, Dangerous, Show of Force, Unveil the Fleet). | **[Upstream]** Wording is "When a ship is placed in your scrapyard". |
| 25 | Hostile / Plundering / Ravenous / Ruthless | Destroying a ship while defending counts, on any player's turn. | **[Upstream]** CE says "each turn", not "on your turn". The designer note says the old phrase was unclear. |
| 33 | Righteous | Blocks every research gain (Brilliant, Void, Composed, Plundering). It does not block **resets**. Composed is unusable because it can't pay its cost. | **[Upstream]** "You can not gain Research". `New Rules.md` treats "reset" as a separate term. |
| 34 | Tyrannical / Pioneering | Tyrannical **adds** dominance as an extra ship number. Pioneering **replaces** one ship number. | **[Upstream]** Card text. |
| 26 | Show of Force | The victim loses no dominance. It counts as a destroy for Hostile and similar cards. "Any one ship" can include your own. | **[Upstream]** Text is "Destroy any one ship. Gain 1 Dominance." |
| 38 | Ambitious | The action is gained first, then the token is placed. If that is the third token, the card is discarded but the action is kept. | **[Upstream]** "take an additional action, then put a token". |
| 46 | Tactical (CE) | Stays free. | **[Upstream]** `New Rules.md` lists card abilities separately from the 3 actions. |
| 23 | Missile trading | Allowed. | **[Upstream]** "Missiles may be traded between players." |
| 40 | Black Market | Keep **2** (print baseline). | **[Upstream]** conflicts: `Cards.md` (June 2019) says 2, `tactics.new.yaml` (Nov 2019, later) says 1. |
| 41 | Aggression | Keep for v1. | **[Upstream]** is inconsistent: `Cards.md` lists Aggression as unchanged and also calls Show of Force its replacement. |

---

## 2. My suggestions (no source)

### Combat and dice

| # | Question | Suggestion | Confidence / impact |
|---|---|---|---|
| 10 | Order of set effects and modifiers | **Missile last, so the result is exactly 1.** The text says it "changes the roll to a 1" and exists to remove bad luck. A missile that could yield 0 would be a worse missile than the text implies. This changes the current pipeline, where the missile comes before modifiers. | Medium / **High** |
| 10 | Rational (3) and Plan Ahead (1) both active | The **lower** wins. Plan Ahead is a temporary self-buff, so a player would never choose the worse number. | Medium / Low |
| 7 | Reconfigure history | The roll made on destruction **counts** as a value shown. History = the starting value, plus every value shown since (including a destruction roll). This is consistent with your current proposal. | **Low** / Low |
| 50 | Reconfigure (CE) "may continue" | The player may stop at any new value, never at a repeat. | Low / Low |
| 12 | Entanglement with Intelligent / Pioneering / Tyrannical | Keep "modifiers apply to the raised target". Entanglement raises the cost and the card still applies to the final requirement. Against this, CE defines "planet number" as the printed number, but that is only a glossary term. | **Low** / Medium |

### Timing and online play

| # | Question | Suggestion | Confidence / impact |
|---|---|---|---|
| 21 | Missile window | Keep your proposal: one window after both dice are rolled, repeating until all pass. **Add a short window before any roll** for effects that depend on knowing the target, such as Plan Ahead or Dangerous. | Medium / **High** |
| 23 | Missile trading online | A "give 1 missile to player X" action, allowed at any time. No binding promises, since an engine can't enforce them. I suggest removing this item. | Medium / Medium |
| 24 | Skill activation | Keep as proposed: a skill becomes active at end of turn. | High / Low |

### Cards and resources

| # | Question | Suggestion | Confidence / impact |
|---|---|---|---|
| 15 | Void research | Cap at 6, no carry-over. The research die has six faces, and the Researcher check is at end of turn, so research gained at turn start still counts. | Medium / Low |
| 27 | Unveil the Fleet dominance | No dominance change. Dominance moves only in combat, and Dangerous explicitly has no dominance effect. Deploy under normal rules with no action cost. | Medium / Low |
| 29 | Sabotage | Stacks, so each copy removes one more action. Applies to each opponent's next regular turn, not a Momentum bonus turn. Floor at 1 action. | Medium / Low |
| 32 | Prideful and the skill limit | The taker discards down to the limit at once. They may not discard the Prideful they just took. This prevents a free hot-potato. | Low / Low |
| 36 | Curious and Infamy | The Infamy placement in the end phase is not a Conquer action, so it does not block Curious. Attacks do. | Low / Low |
| 49 | Talented | Counts toward the 5-skill cap, and the cap rises as soon as it is in hand, with no forced discard on pickup. CE says "up to 5", so the original "discard immediately" wording no longer applies. | Medium / Low |
| 51 | Peek with an empty deck | Reshuffle discards first, consistent with #8, so a peek always has a card to show. | Medium / Low |
| 41 | Aggression | Revisit after AI self-play balance data. | n/a |

---

## 2b. What upstream says on the questions above

Where the upstream text bears on a suggestion in section 2 without settling it.

- **#10 Combat rolls.** CE uses "combat roll" throughout: Rational "Your Combat rolls are 3", Plan Ahead "all your combat rolls are 1", Ferocious "-1 to your Combat rolls", Missile "change any player's combat roll to a 1". This is set-versus-modifier wording, but upstream never states an order, or what happens when Rational and Plan Ahead are both held. The Missile rationale ("reduce that bad RNG feeling") is the basis for the missile-last suggestion.
- **#21 Missile window.** Upstream says only "spend missiles at any time". It gives no priority rules, so the window design is entirely ours.
- **#12 Intelligent and Entanglement.** CE defines "planet number" as "the number printed on the planet", and Intelligent says "add or subtract 1 from the planet number". Read literally, that does not touch a raised Entanglement target. This argues against the suggestion in section 2, but it is a glossary reading, not a statement.
- **#29 Sabotage.** CE says "Every opponent's next turn has 1 fewer actions", with nothing on stacking. Momentum says "treat it as a brand-new turn", which hints a bonus turn counts as a turn, but nothing explicit.
- **#32 Prideful.** Upstream is silent on the skill limit.
- **#36 Curious.** The text is "At the end of your turn, if you did not Attack or Conquer". Upstream puts the Infamy conquest in the End Phase too, so the order between the two is undefined.
- **#51 Peek.** The Peek text says nothing about an empty deck. The base rule that discards are reshuffled when a deck runs out (#8) is the basis for the suggestion.

---

## 3. Cannot be answered from any source


Only the designer, Board Game Arena developers or BGG threads can settle these. The proposals above are my best reading.

- #7 Reconfigure history edge case (exactly what counts as a value "had this turn")
- #15 Void cap
- #24 Skill activation timing, beyond the 2013 wording
- #27 Unveil the Fleet and dominance
- #50 Stopping a CE Reconfigure early

---

## 4. Decisions you need to make

1. **#31:** make the Precocious / Prideful reset optional, which means an engine change.
2. **#30:** pick the baseline (any player or only players who played it), and decide whether adjacency is general.
3. **#10:** missile last (exactly 1) or before modifiers.
4. **#21:** add a pre-roll window as well as the post-roll one.
