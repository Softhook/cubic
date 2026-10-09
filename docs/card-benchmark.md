# Card benchmark

Card balance measured by AI self-play, 2026-10-09: about 1,600 two-player games across both card
rule sets and AI levels 1, 3 and 4, plus a controlled test of every Community skill. Every number
here is a measure of the cards **as the AI plays them**; see [Limits](#limits).

## Summary

- **Coverage.** Every Community card (35 skills, 9 tactics, Expansion) and every Original card was
  drafted and used, except Original **Reorganisation**, which Commodore never took in 200 games and
  the audit never put in play. The card audit (`npm run audit:cards -- --deep`, 25 games) found no
  anomalies.
- **Too strong:** Tactical, Dangerous, Tyrannical, then Stubborn and Brutal. One of these alone
  wins about 80–90% of games against no skill.
- **About as good as no skill:** Profiteering (never used), Calculating, Patient, Prideful,
  Talented, Precocious, Ruthless, Curious and Devious.
- **Tactics:** Show of Force and Aggression are taken in about half of all games and win 62–72%.
  Black Market wins 69–80%. Unveil the Fleet is the weakest Tactic.

## How it was measured

Two methods. They answer different questions.

**Skill value** (`npm run selfplay:skills`, [scripts/skill-ab.ts](../scripts/skill-ab.ts)). At the
start of play one side holds one skill and the other none. Both then draft as usual. Seats swap
every game and each pair of games shares a map seed. Commodore (level 3), Community rules,
Alpha Sector, 200 games per skill. A control of 400 games with no skill on either side came out at
51%, so the setup is fair. The 95% margin is about ±7 points. This measures what the skill is
worth, independent of who tends to draft it.

**Self-play picks** (`npm run selfplay:cards`, [scripts/selfplay-cards.ts](../scripts/selfplay-cards.ts)).
Normal games in which every card is drafted. A card's win rate is the share of games won by the
players who held it. Cards are taken for conquests, so the leading player takes more of them and
almost every card wins more than 50%. Compare cards with each other, not with 50%. Tactics and
Expansion can only be measured this way.

| Run | Games | Avg turns |
|---|---|---|
| Community, Cadet (level 1) | 200 | 21.4 |
| Community, Commodore (level 3) | 300 | 16.6 |
| Community, Admiral (level 4) | 120 | 17.0 |
| Original, Cadet (level 1) | 200 | 22.7 |
| Original, Commodore (level 3) | 200 | 19.7 |
| Skill value, Commodore | 7,400 | 18.5 (no skill) |

Cadet drafts close to at random (most cards are picked in 20–25% of games). Its numbers say little
about balance and are not shown below.

## Community skills

Ordered by skill value. *Turns* is the average game length in the skill-value games (18.5 with no
skill). *L3* and *L4* are self-play win rates when held, with the number of times taken.

| Skill | Value (vs none) | Turns | L3 win (taken) | L4 win (taken) |
|---|---|---|---|---|
| **Tactical** | **88.5%** | 15.3 | 76.9% (26) | 76.9% (13) |
| **Dangerous** | **86.5%** | 20.9 | 73.1% (26) | 70.0% (10) |
| **Tyrannical** | **83.0%** | 13.0 | 69.6% (46) | 64.7% (17) |
| Stubborn | 79.0% | 15.9 | 71.1% (38) | 58.3% (12) |
| Brutal | 78.5% | 18.1 | 57.7% (26) | 44.4% (9) |
| Steadfast | 75.5% | 19.9 | 48.4% (31) | 58.3% (12) |
| Ferocious | 75.0% | 18.3 | 60.0% (30) | 63.6% (11) |
| Brilliant | 74.5% | 17.4 | 32.0% (25) | 54.5% (11) |
| Stealthy | 74.5% | 16.8 | 60.7% (28) | 52.9% (17) |
| Industrious | 73.5% | 17.3 | 57.1% (35) | 53.8% (13) |
| Intelligent | 71.0% | 14.8 | 52.2% (23) | 55.6% (9) |
| Flexible | 70.0% | 17.0 | 53.1% (32) | 83.3% (6) |
| Agile | 68.0% | 19.1 | 54.1% (61) | 71.0% (31) |
| Righteous | 68.0% | 17.1 | 56.0% (25) | 50.0% (6) |
| Ambitious | 66.0% | 17.0 | 63.0% (27) | 86.7% (15) |
| Hostile | 66.0% | 17.7 | 61.5% (26) | 60.0% (5) |
| Ravenous | 66.0% | 15.9 | 56.5% (23) | 81.8% (11) |
| Resourceful | 65.5% | 17.4 | 51.9% (27) | 45.5% (11) |
| Ingenious | 63.0% | 18.1 | 45.9% (37) | 45.0% (20) |
| Plundering | 61.5% | 17.6 | 45.7% (35) | 54.5% (22) |
| Rational | 61.0% | 18.5 | 51.7% (29) | 45.5% (11) |
| Cunning | 58.0% | 18.8 | 37.5% (24) | 37.5% (8) |
| Strategic | 58.0% | 17.8 | 53.3% (30) | 58.8% (17) |
| Pioneering | 57.5% | 17.8 | 31.3% (16) | 50.0% (8) |
| Composed | 56.0% | 18.3 | 44.4% (27) | 57.1% (7) |
| Clever | 55.0% | 18.5 | 40.6% (32) | 44.4% (18) |
| Devious | 53.0% | 18.7 | 45.0% (40) | 26.7% (15) |
| Curious | 52.0% | 18.3 | 41.4% (29) | 27.3% (11) |
| *No skill (control)* | *51.0%* | *18.5* | | |
| Ruthless | 51.0% | 18.9 | 54.2% (24) | 36.4% (11) |
| Precocious | 50.5% | 19.1 | 37.2% (43) | 53.8% (13) |
| Prideful | 48.5% | 17.0 | 65.7% (70) | 59.0% (25) |
| Talented | 48.5% | 18.5 | 38.5% (39) | 28.6% (14) |
| Profiteering | 47.5% | 18.3 | 32.0% (25) | 42.9% (7) |
| Patient | 46.5% | 19.3 | 52.0% (125) | 40.0% (50) |
| Calculating | 44.5% | 18.1 | 51.7% (29) | 36.4% (11) |

### Findings

- **Tactical is the strongest skill on every measure.** A free one-space move or attack every turn
  is worth more than Ambitious or Industrious, which give whole extra actions.
- **Tyrannical speeds the game up** (13 turns against 18.5). Using Dominance as an extra ship number
  makes planets much easier to conquer. The CE still flags it as playtesting.
- **Defence is strong.** Dangerous (trade your defender for the attacker before the roll) and
  Stubborn (ties win and the attacker dies) together make attacking a poor bet. Dangerous games are
  the longest (20.9 turns).
- **The combat skills are uneven.** The roll-twice and -1 skills (Brutal 78.5%, Ferocious 75%) beat
  Rational (61%) and Strategic (58%) by a wide margin.
- **Profiteering never fired** in any game at any level. A missile is worth less than any card it
  replaces. As written, it is a blank card.
- **Calculating, Curious, Devious, Ruthless and Precocious** made no measurable difference.
- **Talented, Patient and Prideful score low partly because of the method.** Talented does nothing
  until you hold a fourth skill. Patient's on-take Tactic is not given in the skill-value test.
  Prideful can be taken by an opponent who destroys your ship. Patient's real draw is its free
  Tactic: it was taken in 42% of Commodore and Admiral games, far more than any other skill.

## Community tactics and Expansion

Self-play picks only. *Picked* is the share of games in which the card was taken.

| Card | L3 picked | L3 win | L4 picked | L4 win |
|---|---|---|---|---|
| Show of Force | 55.3% | 67.2% | 55.8% | 71.8% |
| Aggression | 49.0% | 71.5% | 48.3% | 62.3% |
| Black Market | 23.3% | 69.4% | 16.7% | 80.0% |
| Momentum | 44.3% | 61.4% | 54.2% | 60.8% |
| Change of Heart | 50.0% | 59.2% | 47.5% | 56.7% |
| Expansion | 64.7% | 55.4% | 62.5% | 60.4% |
| Sabotage | 12.3% | 57.9% | 6.7% | 62.5% |
| Warp Gate | 22.0% | 52.9% | 20.8% | 52.0% |
| Plan Ahead | 11.0% | 66.7% | 14.2% | 38.9% |
| Unveil the Fleet | 13.3% | 47.5% | 13.3% | 43.8% |

- **Show of Force** (destroy any ship, +1 Dominance) and **Aggression** (+2 Dominance) are the
  most-picked Tactics and among the best. This is the self-play data that
  [OPEN-QUESTIONS #41](OPEN-QUESTIONS.md) asked for before revisiting the decision to keep
  Aggression. It is strong, but Show of Force is at least as strong.
- **Black Market** (2 missiles) wins often but is picked less. Its strength depends on the
  2-missile ruling ([#40](OPEN-QUESTIONS.md)). The stolksdorf CE gives 1.
- **Unveil the Fleet** is the weakest Tactic.

## Original rules

Self-play picks at Commodore (level 3), 200 games. Samples are small (8–23 picks per Command
card), so only large gaps are worth reading.

- **Highest:** Warlike 80% (15), Flexible 79% (14), Rational 75% (16), Dangerous 74% (19),
  Brilliant 73% (15), Nomadic 73% (15), Curious 72% (18).
- **Lowest:** Tyrannical 23% (13), Intelligent 31% (16), Tactical 33% (9), Arrogant 38% (8).
  At Cadet, Intelligent (77%, 64 picks) and Tyrannical (63%, 41 picks) were among the best, so
  these are more likely about how the AI plays them than about the cards.
- **Gambits:** Relocation 62.5% (picked 34%), Momentum 60% (47%), Expansion 58% (76.5%),
  Aggression 52% (62.5%). Sabotage was picked in 5.5% of games; **Reorganisation was never taken**.

## Limits

- **The AI scores all skills the same** in its evaluation (`SKILL = 110` in
  [evaluate.ts](../packages/ai/src/evaluate.ts)). Its draft choice comes only from look-ahead.
  Skills that pay off over many turns (Talented, Precocious, Composed) are likely undervalued.
- **Patient:** when taking Patient, the AI always stores the first Tactic in the row
  (`patientTactic` is a chance node in the search and index 0 in greedy) instead of choosing one.
- **Profiteering:** the AI never takes the missile, because a missile is worth 40 against 110–120
  for a card. A better AI might sometimes take the missile.
- **One map, two players.** The skill-value test used Alpha Sector only. Some skills (Devious,
  Stealthy, Ingenious) depend on the map, and multi-player games were not measured.

## Reproduce

```sh
npm run selfplay:skills -- 400 3 community none           # control, ~51%
npm run selfplay:skills -- 200 3 community tactical,agile # one JSON line per skill
npm run selfplay:cards -- 300 community 3                 # pick-based report
npm run selfplay:cards -- 200 original 3
npm run audit:cards -- --deep
```

The skill-value run takes about 1.2 s per Commodore game per process. Split the skill list across
several shells to use more cores.
