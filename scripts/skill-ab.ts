/**
 * Skill value test: what one skill is worth on its own, with nothing else changed.
 *
 * At the start of play one side holds the skill and the other none (both drafted starting skills
 * are removed); both keep drafting as usual. Seats swap every game and each pair of games shares a
 * map seed, so "none" (neither side holds a skill) should come out near 50%. Prints one JSON line
 * per skill with the wins of the side that held it. 200 games give a 95% margin of about ±7 points.
 *
 * The games are played on all cores (pool.ts), a pair at a time; the results are the same with any
 * number of jobs, as each game has its own seeds.
 *
 *   npm run selfplay:skills -- [games=100] [level=3] [mode=community] [skills=none,agile,...] [jobs=all cores]
 */
import { chooseAction, chooseCombatResponse, type AiLevel } from '../packages/ai/src';
import { apply, createGame, mulberry32, type Action, type GameMode, type GameState } from '../packages/engine/src';
import { fileURLToPath } from 'node:url';
import { setSkills } from '../packages/engine/test/audit';
import { allCores, pool } from './pool';

const [games = '100', lvl = '3', mode = 'community', list = 'none', jobs = allCores] = process.argv.slice(2);
const n = Number(games);
const level = Number(lvl) as AiLevel;
const skills = list.split(',');

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
      seed: 9000 + Math.floor(g / 2),
      mode: mode as GameMode,
    });
    const random = mulberry32(g * 7919 + 13);
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
const totals = skills.map(() => ({ winsA: 0, unfinished: 0, turns: 0, games: 0 }));
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
    // One line per skill, in the order given, as soon as it and the skills before it are done.
    for (; printed < skills.length && totals[printed].games === n; printed++) {
      const { winsA, unfinished, turns } = totals[printed];
      console.log(
        JSON.stringify({ skill: skills[printed], level, mode, games: n, winsA, unfinished, avgTurns: turns / Math.max(1, n - unfinished) }),
      );
    }
  },
);
