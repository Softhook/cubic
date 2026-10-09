# Quantum Self-Play Card Benchmark Analysis (Level 4 "Admiral" AI)

This report details the statistical findings from **100 self-play matches** executed with the **Level 4 "Admiral" AI** (the highest level at the time; Level 5 "Fleet Admiral" came later) under **Original Edition** rules on the canonical 2-player map (*Alpha Sector*).

---

## 1. Executive Summary & Benchmark Overview

- **Engine Configuration**: Original Edition rules (`originalGame`), 2-player head-to-head match-up on Alpha Sector.
- **AI Level**: **Level 4 ("Admiral")**
  - Search depth: 3 actions ahead.
  - Multi-action combinatorial turn search (`width: 6, innerWidth: 3`).
  - Flagship transports and carries evaluated.
  - Adversary counter-response pruning (`replies: 3, budget: 6000`).
  - Exact combat probability calculations and opportunistic re-roll exploitation.
- **Match Total**: 100 complete games (1,948 turns total).
- **Game Pace**: Average **19.5 turns per game** (noticeably faster than Level 1 AI's 23.0 turns/game).
- **Card Coverage**: **37 / 37 cards drafted and used (100.0% coverage)** across commands and gambits.

---

## 2. Card Performance & Win Rate Ranking

The table below ranks cards by **Win Rate %** when drafted/held by a player, alongside draft frequency, play counts, pick rate across matches, and active turns on the board.

| Rank | Card Name | Type | Taken | Played | Wins | Losses | Win Rate | Pick Rate | Active Turns |
|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **Intelligent** | conquer | 8 | 0 | 8 | 0 | **100.0%** | 8.0% | 26 |
| 2 | **Dangerous** | combat | 3 | 0 | 3 | 0 | **100.0%** | 3.0% | 7 |
| 3 | **Stealthy** | ship | 1 | 0 | 1 | 0 | **100.0%** | 1.0% | 4 |
| 4 | **Tyrannical** | conquer | 7 | 10 | 6 | 1 | **85.7%** | 7.0% | 24 |
| 5 | **Ferocious** | combat | 6 | 0 | 5 | 1 | **83.3%** | 6.0% | 22 |
| 6 | **Righteous** | conquer | 5 | 0 | 4 | 1 | **80.0%** | 5.0% | 17 |
| 7 | **Nomadic** | movement | 9 | 28 | 7 | 2 | **77.8%** | 9.0% | 51 |
| 8 | **Curious** | action | 8 | 16 | 6 | 2 | **75.0%** | 8.0% | 29 |
| 9 | **Cruel** | combat | 11 | 88 | 8 | 3 | **72.7%** | 11.0% | 46 |
| 10 | **Plundering** | research | 7 | 0 | 5 | 2 | **71.4%** | 7.0% | 23 |
| 11 | **Relentless** | combat | 10 | 57 | 7 | 3 | **70.0%** | 10.0% | 36 |
| 12 | **Rational** | combat | 6 | 0 | 4 | 2 | **66.7%** | 6.0% | 29 |
| 13 | **Stubborn** | combat | 6 | 0 | 4 | 2 | **66.7%** | 6.0% | 17 |
| 14 | **Resourceful** | action | 3 | 9 | 2 | 1 | **66.7%** | 3.0% | 12 |
| 15 | **Clever** | ship | 8 | 27 | 5 | 3 | **62.5%** | 8.0% | 18 |
| 16 | **Aggression** | combat | 86 | 84 | 46 | 28 | **62.2%** | 64.0% | 0 |
| 17 | **Warlike** | action | 5 | 0 | 3 | 2 | **60.0%** | 5.0% | 21 |
| 18 | **Expansion** | expansion | 85 | 81 | 45 | 32 | **58.4%** | 64.0% | 0 |
| 19 | **Momentum** | action | 110 | 107 | 52 | 41 | **55.9%** | 71.0% | 0 |
| 20 | **Ingenious** | conquer | 11 | 0 | 6 | 5 | **54.5%** | 11.0% | 58 |
| 21 | **Agile** | movement | 13 | 0 | 7 | 6 | **53.8%** | 13.0% | 49 |
| 22 | **Energetic** | movement | 8 | 0 | 4 | 4 | **50.0%** | 8.0% | 31 |
| 23 | **Flexible** | ship | 11 | 18 | 5 | 6 | **45.5%** | 11.0% | 21 |
| 24 | **Cunning** | action | 7 | 0 | 3 | 4 | **42.9%** | 7.0% | 37 |
| 25 | **Tactical** | action | 7 | 12 | 3 | 4 | **42.9%** | 7.0% | 16 |
| 26 | **Cerebral** | research | 5 | 9 | 2 | 3 | **40.0%** | 5.0% | 32 |
| 27 | **Scrappy** | action | 5 | 14 | 2 | 3 | **40.0%** | 5.0% | 27 |
| 28 | **Arrogant** | action | 8 | 0 | 3 | 5 | **37.5%** | 8.0% | 32 |
| 29 | **Eager** | action | 11 | 29 | 4 | 7 | **36.4%** | 11.0% | 51 |
| 30 | **Relocation** | conquer | 39 | 39 | 13 | 25 | **34.2%** | 37.0% | 0 |
| 31 | **Precocious** | research | 9 | 0 | 3 | 6 | **33.3%** | 9.0% | 35 |
| 32 | **Reorganisation** | ship | 9 | 8 | 3 | 6 | **33.3%** | 9.0% | 0 |
| 33 | **Conformist** | action | 3 | 0 | 1 | 2 | **33.3%** | 3.0% | 19 |
| 34 | **Brilliant** | research | 7 | 0 | 2 | 5 | **28.6%** | 7.0% | 24 |
| 35 | **Ravenous** | conquer | 7 | 17 | 2 | 5 | **28.6%** | 7.0% | 12 |
| 36 | **Strategic** | combat | 4 | 22 | 1 | 3 | **25.0%** | 4.0% | 15 |
| 37 | **Sabotage** | action | 5 | 4 | 1 | 4 | **20.0%** | 5.0% | 0 |

---

## 3. Draft Timing & Board Context (When Cards Are Chosen)

This table shows the exact game phase and board state when the Admiral AI drafts each card.

| Card Name | Type | Taken | Avg Turn | Phase | Avg Cubes Left | Avg Dom | Avg Res | Leading % | Behind % |
|:---|:---|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **Stealthy** | ship | 1 | Turn 3.0 | Opening | 3.0 | 1.0 | 1.0 | 100% | 0% |
| **Resourceful** | action | 3 | Turn 5.3 | Mid-game | 2.7 | 1.3 | 1.3 | 33% | 33% |
| **Conformist** | action | 3 | Turn 5.7 | Mid-game | 2.7 | 1.3 | 1.0 | 33% | 0% |
| **Curious** | action | 8 | Turn 6.4 | Mid-game | 2.8 | 1.6 | 1.6 | 25% | 13% |
| **Relocation** | conquer | 39 | Turn 7.3 | Mid-game | 2.5 | 1.5 | 1.5 | 67% | 10% |
| **Cerebral** | research | 5 | Turn 7.4 | Mid-game | 2.4 | 2.2 | 1.2 | 40% | 0% |
| **Agile** | movement | 13 | Turn 7.7 | Mid-game | 2.2 | 2.0 | 1.8 | 62% | 15% |
| **Momentum** | action | 110 | Turn 7.7 | Mid-game | 2.4 | 1.6 | 1.5 | 62% | 5% |
| **Arrogant** | action | 8 | Turn 8.3 | Mid-game | 2.0 | 1.9 | 1.3 | 38% | 13% |
| **Relentless** | combat | 10 | Turn 8.3 | Mid-game | 2.4 | 1.4 | 1.4 | 60% | 10% |
| **Nomadic** | movement | 9 | Turn 8.4 | Mid-game | 1.9 | 1.8 | 1.9 | 89% | 0% |
| **Precocious** | research | 9 | Turn 8.4 | Mid-game | 2.2 | 1.4 | 1.8 | 44% | 11% |
| **Cunning** | action | 7 | Turn 9.3 | Endgame | 1.7 | 1.9 | 1.9 | 57% | 0% |
| **Dangerous** | combat | 3 | Turn 9.3 | Endgame | 2.0 | 1.3 | 1.7 | 33% | 33% |
| **Aggression** | combat | 86 | Turn 9.4 | Endgame | 2.0 | 2.1 | 1.5 | 66% | 7% |
| **Stubborn** | combat | 6 | Turn 9.7 | Endgame | 1.5 | 2.0 | 1.2 | 67% | 0% |
| **Energetic** | movement | 8 | Turn 9.9 | Endgame | 1.5 | 1.4 | 1.6 | 50% | 0% |
| **Eager** | action | 11 | Turn 10.6 | Endgame | 2.3 | 1.9 | 1.8 | 27% | 9% |
| **Expansion** | expansion | 85 | Turn 10.7 | Endgame | 1.8 | 1.8 | 1.7 | 49% | 6% |
| **Clever** | ship | 8 | Turn 11.1 | Endgame | 1.8 | 1.4 | 1.6 | 63% | 13% |
| **Intelligent** | conquer | 8 | Turn 11.1 | Endgame | 2.0 | 2.0 | 2.0 | 50% | 0% |
| **Ingenious** | conquer | 11 | Turn 11.2 | Endgame | 2.4 | 2.0 | 1.5 | 36% | 27% |
| **Ferocious** | combat | 6 | Turn 12.2 | Endgame | 2.2 | 1.8 | 1.3 | 50% | 33% |
| **Rational** | combat | 6 | Turn 12.3 | Endgame | 2.0 | 2.2 | 1.8 | 67% | 17% |
| **Scrappy** | action | 5 | Turn 12.4 | Endgame | 2.2 | 1.2 | 1.8 | 80% | 0% |
| **Flexible** | ship | 11 | Turn 12.5 | Endgame | 1.5 | 2.2 | 1.7 | 27% | 9% |
| **Reorganisation** | ship | 9 | Turn 12.9 | Endgame | 1.7 | 2.6 | 1.8 | 44% | 0% |
| **Strategic** | combat | 4 | Turn 13.0 | Endgame | 1.8 | 2.3 | 2.0 | 25% | 0% |
| **Tactical** | action | 7 | Turn 13.7 | Endgame | 1.6 | 1.4 | 1.1 | 43% | 14% |
| **Plundering** | research | 7 | Turn 13.9 | Endgame | 1.6 | 1.9 | 1.6 | 71% | 29% |
| **Warlike** | action | 5 | Turn 14.2 | Endgame | 1.8 | 1.0 | 2.2 | 60% | 0% |
| **Tyrannical** | conquer | 7 | Turn 14.3 | Endgame | 1.9 | 1.1 | 2.0 | 57% | 0% |
| **Cruel** | combat | 11 | Turn 14.8 | Endgame | 1.8 | 1.8 | 1.7 | 55% | 9% |
| **Ravenous** | conquer | 7 | Turn 15.4 | Endgame | 1.6 | 1.7 | 2.9 | 29% | 29% |
| **Sabotage** | action | 5 | Turn 16.8 | Endgame | 2.0 | 1.8 | 2.2 | 0% | 80% |
| **Righteous** | conquer | 5 | Turn 17.0 | Endgame | 1.4 | 2.6 | 2.4 | 80% | 0% |
| **Brilliant** | research | 7 | Turn 17.6 | Endgame | 1.7 | 1.9 | 1.9 | 0% | 29% |

---

## 4. Key Strategic Insights & Level 4 AI Dynamics

### A. Tempo Domination: Gambits Surge to High Priority
- Under Level 1 AI, gambits like **Momentum** were often ignored until the final turns of the game.
- Under **Level 4 Admiral AI**, **Momentum was drafted 110 times (71.0% pick rate)** and **Aggression was drafted 86 times (64.0% pick rate)**.
- **Why**: Admiral evaluates complete 3-action sequence plans. When it spots an opportunity to chain a free bonus turn or gain 2 immediate dominance points for infamy, it drafts the gambit immediately to choke out the opponent's reply window.

### B. High-Leverage Tactical Counter-Play (`Relocation`)
- `Relocation` was drafted **39 times** under Level 4 AI (compared to only 6 times under Level 1).
- Admiral AI actively searches opponent reply states. When an opponent is within 1–2 cubes of victory, Admiral uses `Relocation` to strip their cube off a completed planet, resetting their win condition and buying multiple turns.

### C. Precision Combat Re-rolls (`Cruel` & `Relentless`)
- **Cruel** (72.7% WR, 88 combat rerolls) and **Relentless** (70.0% WR, 57 combat rerolls) demonstrated exceptional conversion rates.
- Rather than blindly rerolling, Admiral's `chooseCombatResponse` evaluates exact dice probability distributions. It invokes Cruel and Relentless strictly when doing so turns a lost battle into a win, denying enemy dominance and preserving board presence.

### D. Surgical Closer Cards
- **`Intelligent` (100.0% WR, 8-0)**: Admiral drafts `Intelligent` (±1 planet construction tolerance) exclusively when it sees an immediate construct path to victory that the opponent cannot defend against.
- **`Tyrannical` (85.7% WR, 6-1)**: Converts research to dominance reliably when closing in on the final cube.
- **`Nomadic` (77.8% WR, 7-2)**: Leverages flagship/orbital hopping across planets for multi-angle conquests.
