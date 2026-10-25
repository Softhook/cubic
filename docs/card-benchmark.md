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
- **Regolith** (2026-10-25, [below](#regolith)): defence gets stronger. Unstable Reactor and
  Entrenched lead, with Science Survey and Field Refit; Remodel, Engineering and Sneak are blank.

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

## Regolith

Measured 2026-10-25 with the AI as it is now, at level 2: about 50,000 two-player games. Regolith's
deck plays by the Community rules card for card (`effect` in
[cards.json](../packages/engine/src/regolith/cards.json)), except Science and Sabotage (2 actions). What
differs is the mode around them: hex maps, moves capped at 3, zones of control, contested orbits, the
Sniper and the Wisp. To separate the mode from the AI, every skill was also measured in Community at
the same level as a control.

**Method.** Skill value as above, but at level 2 with sequential stopping (`margin=5`, up to 2,000
games): each skill stops once it is clear whether it is worth 5 points more than none, 5 less, or
neither. *Games* is how many it took. Strong skills stop after 40–70 games, so their percentages are
rough and lean high; read the order, not the exact figure. A *Change* under about 10 points is within
noise unless both sides played several hundred games. Self-play picks: 2,000 games per mode at level 2
(19.0 turns a game in Regolith, 16.7 in Community). The AI drafts Regolith cards by their Community
values ([cardValues.ts](../packages/ai/src/cardValues.ts)), which is partly why Remodel and Arms Deal
are almost never taken.

### Regolith skills

Ordered by skill value. *Community* is the same card's value in the control. *Drafted* columns are
from self-play picks.

| Skill (Community) | Value (games) | Community (games) | Change | Drafted win | Drafted pick |
|---|---|---|---|---|---|
| **Unstable Reactor** (Dangerous) | **84.1%** (44) | 74.2% (66) | +9.8 | 77.6% | 23.4% |
| **Science Survey** (Brilliant) | **81.3%** (48) | 83.3% (48) | -2.1 | 61.8% | 15.7% |
| **Entrenched** (Stubborn) | **80.8%** (52) | 69.8% (106) | +11.0 | 70.4% | 22.3% |
| **Field Refit** (Flexible) | **77.6%** (58) | 68.1% (94) | +9.5 | 51.9% | 11.6% |
| **Martial Law** (Tyrannical) | **77.6%** (58) | 93.3% (30) | -15.7 | 62.8% | 25.7% |
| **Armour Piercing** (Ferocious) | **75.8%** (66) | 80.8% (52) | -5.0 | 59.6% | 18.9% |
| **Advance** (Tactical) | **75.0%** (64) | 75.8% (66) | -0.8 | 63.8% | 41.1% |
| Close Protection (Strategic) | 72.2% (72) | 66.7% (90) | +5.6 | 52.9% | 6.0% |
| Double Time (Steadfast) | 71.6% (88) | 76.4% (72) | -4.8 | 46.4% | 16.1% |
| Infiltration (Stealthy) | 69.8% (86) | 67.8% (90) | +2.0 | 52.6% | 16.4% |
| Hacking (Intelligent) | 67.6% (108) | 84.1% (44) | -16.5 | 60.7% | 16.1% |
| Tune Up (Agile) | 66.7% (126) | 66.0% (94) | +0.7 | 55.6% | 25.8% |
| Paired Cannons (Brutal) | 65.9% (126) | 82.6% (46) | -16.7 | 58.7% | 25.4% |
| Trophy Hunters (Ravenous) | 65.0% (120) | 69.1% (94) | -4.1 | 46.8% | 11.6% |
| Recycle (Resourceful) | 64.6% (130) | 58.3% (278) | +6.3 | 47.1% | 8.5% |
| Exploit (Plundering) | 64.6% (144) | 62.5% (152) | +2.1 | 45.1% | 6.7% |
| Prospectors (Curious) | 64.0% (136) | 56.6% (350) | +7.4 | 36.2% | 2.4% |
| Breakthrough (Hostile) | 63.6% (140) | 61.8% (152) | +1.7 | 43.6% | 10.2% |
| Final Push (Ambitious) | 63.0% (138) | 60.7% (168) | +2.3 | 55.3% | 10.3% |
| Science (Pioneering) | 62.7% (162) | 58.5% (224) | +4.3 | 56.6% | 25.9% |
| Fanatics (Righteous) | 61.9% (134) | 57.0% (300) | +4.9 | 43.4% | 11.3% |
| Drill Sergeant (Rational) | 59.7% (206) | 73.0% (74) | -13.3 | 39.7% | 7.0% |
| Free Drop (Industrious) | 58.6% (256) | 64.4% (118) | -5.8 | 44.5% | 14.5% |
| Stand Down (Composed) | 54.7% (590) | 63.3% (150) | -8.6 | 40.5% | 4.0% |
| Rush Research (Precocious) | 54.4% (702) | 50.8% (738) | +3.6 | 24.0% | 1.3% |
| Boost (Cunning) | 53.6% (1292) | 58.4% (250) | -4.8 | 43.6% | 5.9% |
| Sneak (Devious) | 51.4% (1244) | 51.0% (902) | +0.4 | 39.7% | 3.1% |
| Stolen Flag (Prideful) | 51.3% (764) | 50.0% (396) | +1.3 | 65.0% | 19.4% |
| *No skill (control)* | *51.0%* (702) | *49.4%* (526) | | | |
| Strategic Plan (Patient) | 50.9% (638) | 50.2% (486) | +0.7 | 47.1% | 18.1% |
| Remodel (Calculating) | 50.0% (510) | 62.4% (170) | -12.4 | – (2 taken) | 0.1% |
| Engineering (Clever) | 49.7% (576) | 62.5% (152) | -12.8 | 41.9% | 2.1% |
| Signal Jammer (Ruthless) | 49.6% (500) | 51.1% (740) | -1.5 | 46.2% | 1.3% |
| Arms Deal (Profiteering) | 49.2% (610) | 50.0% (454) | -0.8 | 58.3% | 0.6% |
| Veteran Crew (Talented) | 48.4% (1062) | 50.8% (612) | -2.4 | 41.0% | 12.6% |

### Regolith tactics and Expansion

Self-play picks only, level 2, 2,000 games per mode.

| Card (Community) | Picked | Win | Community picked | Community win |
|---|---|---|---|---|
| Contraband (Black Market) | 23.8% | 65.6% | 23.3% | 65.2% |
| Headhunter (Change of Heart) | 51.8% | 64.0% | 49.9% | 63.7% |
| Forced March (Momentum) | 28.8% | 61.1% | 28.9% | 58.9% |
| Reinforcements (Expansion) | 58.8% | 60.9% | 60.0% | 56.0% |
| Power Grab (Aggression) | 49.5% | 60.7% | 48.7% | 63.9% |
| Orbital Cannon (Show of Force) | 52.0% | 58.7% | 50.6% | 63.6% |
| Kill Zone (Plan Ahead) | 18.0% | 54.2% | 21.7% | 54.7% |
| Sabotage (2 actions; Community 1) | 19.3% | 53.4% | 8.8% | 52.2% |
| Ice Tunnel (Warp Gate) | 14.5% | 50.8% | 13.9% | 51.9% |
| Invasion (Unveil the Fleet) | 4.9% | 49.5% | 6.0% | 45.5% |

### Regolith findings

- **Too strong: Unstable Reactor, Entrenched, Science Survey, Field Refit,** then Martial Law, Armour
  Piercing and Advance. One of these alone wins about 75–85% against no skill.
- **The mode makes defence stronger.** Unstable Reactor and Entrenched, both triggered by being
  attacked, gain about 10 points over Community and top the self-play picks (77.6% and 70.4% win
  when drafted). Zones of control and contested orbits already make attacks scarcer and costlier.
  Close Protection gains too (+5.6): a mech has more neighbours on hexes.
- **Field Refit gains about 10 points.** With moves capped at 3 and the Sniper and Wisp, which number
  a mech shows matters more than how far it moves.
- **Remodel and Engineering lose all their value** (about +12 in Community, nothing here, over 500+
  games each): the clearest change the mode makes. Choosing a mech's number on salvage or Refit pays
  less where high numbers no longer move further. Both are blank cards in Regolith as written.
- **Sneak does nothing** (51.4% over 1,244 games, picked in 3%), though ignoring zones of control
  looked like it should be worth more here than Devious is in Community.
- **Weak:** Stand Down, Rush Research and Boost, 54–55%.
- **Can't be valued this way:** Veteran Crew, Strategic Plan, Stolen Flag, Arms Deal and Signal
  Jammer, for the reasons under [Findings](#findings). Stolen Flag wins 65% when drafted.
- **Martial Law, Hacking, Paired Cannons and Drill Sergeant** show drops of 13–17 points, but their
  Community runs stopped after 30–74 games; all but Drill Sergeant are still among the stronger skills.
- **Tactics move little.** Sabotage's second action doubled its pick rate without lifting its win
  rate. Invasion is still the weakest Tactic.
- **Card audit:** Science's uses were not counted in self-play (its effect was missing from the
  audit's conquer skills, [audit.ts](../packages/engine/test/audit.ts)); fixed 2026-10-25.

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

All the numbers above were measured with the AI as it was before the fixes below. They are the
AI's view of each card.

- **Fixed since: the AI drafted skills by row position.** Every skill had the same value in the
  evaluation (`SKILL = 110`), and a skill only takes effect after the turn it is taken in, so the
  search couldn't tell skills apart. 76% of skill picks went to the first card in the row. The
  self-play pick rates and win rates for skills reflect that. Skills now have values from the
  skill value test ([cardValues.ts](../packages/ai/src/cardValues.ts)).
- **Fixed since: Patient stored the first Tactic in the row.** Every stored Tactic was worth the
  same. Stored Tactics are now valued card by card.
- **Fixed since: Calculating always chose 1.** The evaluation doesn't tell scrapyard numbers
  apart, so the first option won. Measured over 200 games each, Calculating against no skill won
  39.5% choosing 1s, 42% choosing 6s, 46% choosing 3s and 57% choosing 4s (a Frigate can become
  a 3 or a 5). The AI now prefers 4, then 3, 5, 2, 6, 1. Even played this way, Calculating is
  worth about as much as no skill.
- **Fixed since: the AI's threat estimate ignored combat skills.** How likely a ship is to be
  destroyed came from plain dice, so Brutal, Ferocious, Rational, Strategic and Stubborn made no
  difference to it (actual attacks were always worked out exactly). It now uses `attackChance`
  ([queries.ts](../packages/engine/src/queries.ts)).
- With these fixes, the new Commodore beat the old one 158–82 over 240 games (65.8%). The
  benchmark should be run again with the new AI.
- **Profiteering:** the AI never takes the missile, because a missile is worth 40 against 110–120
  for a card. A better AI might sometimes take the missile.
- **Dangerous:** the AI attacks into a Dangerous defender about three times a game. The defender
  then destroys both ships 92% of the time, which costs the attacker an action for an even trade.
  The search sees this coming and still judges the trade worth it. That may be too generous.
- **One map, two players.** The skill value test used Alpha Sector only. Some skills (Devious,
  Stealthy, Ingenious) depend on the map, and multi-player games were not measured.

## Reproduce

```sh
npm run selfplay:skills -- 400 3 community none           # control, ~51%
npm run selfplay:skills -- 200 3 community tactical,agile # one JSON line per skill
npm run selfplay:cards -- 300 community 3                 # pick-based report
npm run selfplay:cards -- 200 original 3
npm run audit:cards -- --deep

# Regolith (2026-10-25), level 2; each skill list as one comma-separated argument
npm run selfplay:skills -- --mode=regolith --level=2 --skills=none,r-agile,...
npm run selfplay:skills -- --mode=community --level=2 --skills=none,agile,...  # the control
npm run selfplay:cards -- --games=2000 --mode=regolith --level=2
```

At level 2 a game takes about 0.14 s; all 35 Regolith skills took about 50 minutes on 4 cores.

The skill-value run takes about 1.2 s per Commodore game per process. Split the skill list across
several shells to use more cores.
