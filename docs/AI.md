# AI opponents

The AI comes in five levels. Each player seat in the lobby picks one; the default is 3.

| Level | Name | How it chooses | Thinking time per decision |
|:-:|---|---|---|
| 1 | **Cadet** | One action at a time. Scores the position after each legal action and takes the best. Random actions are sampled 3 times. | ~5 ms |
| 2 | **Captain** | One action at a time, with exact odds for re-rolls and combat and an evaluation that knows whose turn is next and which enemy ships can reach which of its ships. | ~5 ms |
| 3 | **Commodore** | Plans the whole turn: searches combinations of up to 3 actions (plus free ship abilities) and the outcomes of every dice roll on the way. | ~30 ms, ≤ 0.3 s |
| 4 | **Admiral** | Wider turn search, includes Flagship transports, and checks its best three plans against the opponent's actual next turn. | ~85 ms, ≤ 0.5 s |
| 5 | **Fleet Admiral** | Deeper and wider turn search (4 actions, more samples), and checks its best four plans against three replies each, with the same dice for every plan, averaged. | ~125 ms, ≤ 1.2 s |

All levels choose among `legalActions(state)`, so they can only play legal moves. None of them
sees the game's RNG or the order of the decks. Before searching, the AI replaces the RNG seed with
its own and shuffles the unseen deck cards.

In the web app the AI runs in a Web Worker ([`apps/web/src/game/aiWorker.ts`](../apps/web/src/game/aiWorker.ts)),
so the board keeps animating while it thinks. Thinking time counts towards the pause the AI already
takes between actions so that humans can follow along.

## Strength

Self-play results, alternating seats, each pair of games on the same map seed (`npm run ai:match`):

| Match (games) | Basic | Original | Community |
|---|---|---|---|
| Cadet vs Captain | 5 – 35 (40) | | |
| Captain vs Commodore | 9 – 31 (40) | | 9 – 26 (35) |
| Commodore vs Admiral | 20 – 28 (48) | | |
| Admiral vs Fleet Admiral | 20 – 28 (48) | | |
| Cadet vs Commodore | | 1 – 29 (30) | 3 – 27 (30) |

Fleet Admiral beat Admiral 28 – 20 (58%, 2026-10-09), the same margin as Admiral over Commodore, at
about 2.5× Admiral's thinking time in the same run (126 vs 48 ms per decision). Over 48 games that
lead is suggestive, not conclusive (p ≈ 0.15). Earlier candidate settings were no clear gain: a
deeper, wider search alone went 25 – 23 (48 games), and Admiral's search checking five plans against
a Commodore-played reply was 16 – 15 after 31 (interrupted). The shipped setting adds averaged
replies, aimed at the reply check's noise; confirm the gain with a longer run before tuning further.

The levels are clearly ordered. The top two steps are the smallest (58% each); they are where there
is the most room to grow (see Next steps). Empty cells haven't been measured yet.

To measure a change, run for example:

```sh
npm run ai:match -- 2 3 40            # Captain vs Commodore, 40 basic games
npm run ai:match -- 3 4 20 community  # Commodore vs Admiral, community rules
```

Twelve games can mislead: during development one version of Admiral went 7–5 against Commodore
over 12 games, and 38–10 over 48. Use 40 or more before trusting a difference.

## What was wrong with the original AI

The original AI is kept as level 1. Self-play showed it rarely fought (about one attack per Basic
game, with dominance often never leaving 1), re-rolled ships with no purpose, and in Original mode
researched about 27 times a game. The causes were assumptions built into its design:

1. **One action at a time.** It scored each action on its own and never planned how a turn's three
   actions work together. In Quantum the strong moves are combinations ("move A out, move B in,
   conquer").
2. **No idea of the opponent's next turn.** The score was a snapshot. It didn't know whose turn was
   next, and it ignored enemy threats like a conquest that will happen next turn. Its danger term
   measured straight-line distance through planets and ships.
3. **Sampling bias.** Re-rolls and attacks were scored from 3 random samples, and the best-looking
   action was chosen. Whichever random action got lucky in the samples won, which is why it
   reconfigured so often. With 1 sample it reconfigured 70% more.
4. **Weights out of scale.** Dominance 5 scored 150 points while Infamy is worth a cube (1000), so
   destroying ships hardly paid. Research scored a flat 14 per step. Every skill was worth the same.
5. **Reach ignored blocking**, and ignored whether a ship's value fits the planet's sum.

## How levels 2–4 work

| File | Contents |
|---|---|
| [`packages/ai/src/index.ts`](../packages/ai/src/index.ts) | Public API (`chooseAction`, `chooseCombatResponse`), the level table and each level's search settings |
| [`packages/ai/src/greedy.ts`](../packages/ai/src/greedy.ts) | Level 1, unchanged (the golden tests replay it) |
| [`packages/ai/src/evaluate.ts`](../packages/ai/src/evaluate.ts) | Position evaluation for levels 2+ |
| [`packages/ai/src/chance.ts`](../packages/ai/src/chance.ts) | The outcomes of an action, with probabilities |
| [`packages/ai/src/search.ts`](../packages/ai/src/search.ts) | Expectimax over the current turn, the opponent-reply check, missile decisions |

**Evaluation** (`evaluate.ts`) scores a position in *cube points* (one cube = 1000) as my value
minus the strongest rival's. A position in my own turn is scored as if I end the turn now; the
search decides whether to do more first. Each player's value adds up:

- cubes placed; dominance as progress towards Infamy (5 → 6 is worth about a cube); research as
  progress towards a card; skills, missiles, ships on the map and in the scrapyard;
- **conquest potential**: for the best three planets, how many actions a conquest is away (orbit
  already adds up; one ship of the right value can reach orbit; one orbiting ship can leave;
  a re-roll could fix the sum; two ships can fill the gap…), scaled by whether that player moves
  next. Reach uses real paths;
- **exposure**: for each ship, the chance an enemy ship that can actually reach it destroys it,
  times what that costs: the ship, a dominance step, and the attacker's gain, which is a cube if
  it gives them Infamy. Ships of the player who moves next are less exposed (they can react).

**Chance** (`chance.ts`): a re-roll branches into each value it can show, following the mode's
rule (any other value in Original, an unseen value in Community). An attack branches into
win / repelled / attacker destroyed, with exact probabilities from every combination of combat
dice. Card draws and other random effects are sampled with the same seeds for every candidate.

**Search** (`search.ts`): every candidate is first tried one step deep, then the `width` best are
searched deeper, `innerWidth` at deeper nodes, to `depth` actions. A transposition table merges
positions reached in different orders. An evaluation budget caps the work per decision. It counts
positions rather than milliseconds, so games replay identically. Decisions that come up during the
search (advance after a battle, card picks) get each player's best one-step choice.

**Reply check** (Admiral): for the three best plans, the end-of-turn position is played on through
the opponent's next turn by the Captain policy, and each plan scores half its own value and half
the value after the reply. Fleet Admiral checks four plans, each against three replies with
different dice (`replySamples`), the same three for every plan, so that one lucky roll doesn't
decide between plans. `reply` can also set a stronger policy for the opponent's turn.

## Next steps

In rough order of value:

1. **Tune the evaluation by self-play.** The weights in `evaluate.ts` are hand-set. Adjusting them
   automatically (e.g. SPSA over many Captain-vs-Captain games) is the cheapest strength gain, and
   the same harness becomes the M5 balance lab.
2. **Value cards individually.** Every skill is worth the same today. A per-card rating, or better
   a measured one (win rate with/without the card in self-play), would fix card picks in Original
   and Community.
3. **Missiles in the search.** The chance model assumes nobody fires a missile into a battle. The
   defender's possible missile should lower the attacker's odds.
4. **Faster engine for search.** Done (2026-10): states are copied by a plain recursive copy instead
   of `structuredClone`, the board's neighbours are cached per board, and movement (`reach`,
   `moveIndexes`) runs over cell indexes; the search reuses an action's outcomes when it deepens
   it and caches evaluations. Levels 3 and 4 got 3–4× faster with identical choices (88 fixed
   positions). The evaluation's movement for every ship is still most of the time.
5. **Admiral beyond one reply.** Monte Carlo tree search across turns (with determinized decks),
   time-boxed in the worker, as originally planned in the roadmap.
6. **More than 2 players.** The evaluation subtracts the strongest rival and a quarter of the
   others; it doesn't model who attacks whom.
7. **Explain moves.** The evaluation's terms (conquest potential, exposure, dominance) can be shown
   as the reason for a move.
8. **Easier than Cadet.** Level 1's `noise` option already makes it weaker if beginners need it.
