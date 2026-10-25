/**
 * Skill value test: what one skill is worth on its own, with nothing else changed.
 *
 * At the start of play one side holds the skill and the other none (both drafted starting skills
 * are removed); both keep drafting as usual. Seats swap every game and each pair of games shares a
 * map seed, so "none" (neither side holds a skill) should come out near 50%. Prints one JSON line
 * per skill with the wins of the side that held it. 200 games give a 95% margin of about ±7 points.
 *
 * The games are played on the fast cores (pool.ts), a pair at a time; the results are the same with any
 * number of jobs, as each game has its own seeds.
 *
 * Each skill stops early once it is clear whether its side wins `margin` percentage points more than
 * 50%, as much less, or neither ("verdict": better, worse or even; sprt.ts). With the defaults a
 * skill worth 10 points takes about 250 games, one worth 5 about 700 and one worth nothing about
 * 900; up to 2000 games find 19 in 20 skills worth the margin. A skill that runs out of games first
 * is undecided; a margin of 0 always plays them all. "games" is how many were played.
 *
 * Each skill tested has its own 2.5% chance of a "better" it doesn't deserve: over thirty skills,
 * expect one (a reminder goes to stderr). Check a surprise by playing that skill again with another
 * `seed`, which plays other games: the same seed plays the same games, with the same verdict.
 *
 *   npm run selfplay:skills -- [games=2000] [level=3] [mode=community] [skills=none,agile,...] [jobs=fast cores] [margin=5] [seed=0]
 *
 * Any argument may be given by name instead, in any order: `--skills=agile --seed=1` (args.ts).
 */
import { chooseAction, chooseCombatResponse, type AiLevel } from '../packages/ai/src';
import { apply, createGame, mulberry32, type Action, type GameMode, type GameState } from '../packages/engine/src';
import { fileURLToPath } from 'node:url';
import { setSkills } from '../packages/engine/test/audit';
import { args } from './args';
import { defaultJobs, pool } from './pool';
import { addPair, FALSE_ALARM, noPairs, splitShare, sprt, type Verdict } from './sprt';

const {
  games,
  level: lvl,
  mode,
  skills: list,
  jobs,
  margin,
  seed,
} = args({
  games: '2000',
  level: '3',
  mode: 'community',
  skills: 'none',
  jobs: defaultJobs,
  margin: '5',
  seed: '0',
});
const n = Number(games);
const level = Number(lvl) as AiLevel;
const skills = list.split(',');
/** Where this run's game seeds start: each `seed` has games of its own. */
const first = Number(seed) * 100_000;

interface Result {
  winsA: number;
  unfinished: number;
  turns: number;
}

/** Plays games from-to with `skill` held by one side into a result. */
function play(skill: string, from: number, to: number): Result {
  const r: Result = { winsA: 0, unfinished: 0, turns: 0 };
  for (let g = from; g < to; g++) {
    const aSeat = g % 2;
    let s: GameState = createGame({
      players: [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', ai: true })),
      seed: 9000 + first + Math.floor(g / 2),
      mode: mode as GameMode,
    });
    const random = mulberry32((first + g) * 7919 + 13);
    let dealt = false;
    for (let step = 0; s.phase !== 'over' && step < 4000; step++) {
      if (s.phase === 'play' && !dealt) {
        dealt = true;
        setSkills(s, 0, []);
        setSkills(s, 1, []);
        if (skill !== 'none') setSkills(s, aSeat, [skill]);
      }
      let action: Action | null = null;
      if (s.pending[0]?.kind === 'combat') for (const p of s.players) action ??= chooseCombatResponse(s, p.id, { level, random });
      action ??= chooseAction(s, { level, random });
      if (!action) throw new Error(`no action, game ${g}`);
      s = apply(s, action);
    }
    if (s.phase === 'over') {
      if (s.winner === aSeat) r.winsA++;
      r.turns += s.turn.number;
    } else r.unfinished++;
  }
  return r;
}

const tasks: [number, number, number][] = [];
for (let k = 0; k < skills.length; k++) for (let from = 0; from < n; from += 2) tasks.push([k, from, Math.min(n, from + 2)]);
const totals = skills.map(() => ({ winsA: 0, unfinished: 0, turns: 0, games: 0, pairs: noPairs(), verdict: 'undecided' as Verdict }));
let printed = 0;
await pool(
  fileURLToPath(import.meta.url),
  tasks,
  Number(jobs),
  ([k, from, to]) => play(skills[k], from, to),
  (r, [k, from, to]) => {
    const t = totals[k];
    t.winsA += r.winsA;
    t.unfinished += r.unfinished;
    t.turns += r.turns;
    t.games += to - from;
    addPair(t.pairs, r.winsA, to - from - r.unfinished);
    t.verdict = sprt(t.pairs, 0.5, Number(margin) / 100);
    // One line per skill, in the order given, as soon as it and the skills before it are done.
    for (; printed < skills.length && (totals[printed].games === n || totals[printed].verdict !== 'undecided'); printed++) {
      const { winsA, unfinished, turns, games, verdict, pairs } = totals[printed];
      const avgTurns = turns / Math.max(1, games - unfinished);
      console.log(
        JSON.stringify({
          skill: skills[printed],
          level,
          mode,
          games,
          winsA,
          unfinished,
          avgTurns,
          verdict,
          split: splitShare(pairs).split,
        }),
      );
    }
  },
  { skip: ([k]) => totals[k].verdict !== 'undecided' },
);
if (skills.length > 1 && Number(margin) > 0) {
  const expected = (2 * FALSE_ALARM * skills.length).toFixed(1);
  console.error(
    `${skills.length} skills: if none mattered, about ${expected} would still be called better or worse. Check a surprise with another seed.`,
  );
}
