/**
 * AI benchmark: plays two AI levels against each other and reports wins and thinking time.
 *
 *   npm run ai:match -- <levelA> <levelB> [games=20] [mode=basic] [players=2] [jobs=1]
 *
 * A level may name a git commit to play that version of the AI against the current one:
 * `3@HEAD~1` is Commodore as of the previous commit (against today's engine). Its source is
 * extracted once into .cache/ai-match/<commit hash>.
 *
 * Seats alternate between games and each pair of games shares a map seed, so neither level
 * gets the better start. With more than 2 players, level A plays seat 0 and level B the rest.
 * With jobs > 1 the games are split between that many processes (one per CPU core is about
 * right); the results are the same as with one, as each game has its own seeds.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as current from '../packages/ai/src';
import { actor, apply, createGame, mulberry32, type Action, type GameMode, type GameState } from '../packages/engine/src';

type Ai = Pick<typeof current, 'chooseAction' | 'chooseCombatResponse'>;

const [a = '1', b = '3', games = '20', mode = 'basic', players = '2', jobs = '1'] = process.argv.slice(2);
const specs = [a, b];
// Split at the first @ only: refs such as main@{1} contain one too.
const parts = specs.map((x) => x.match(/^([^@]*)(?:@(.*))?$/)!);
const levels = parts.map(([, level]) => Number(level) as current.AiLevel);
const ais: Ai[] = await Promise.all(parts.map(([, , ref]) => loadAi(ref)));
const n = Number(games);
const seats = Number(players);
/** Set for a worker process: the games it plays, "from-to". */
const shard = process.env.AI_MATCH_SHARD;

interface Result {
  wins: number[];
  unfinished: number;
  turns: number;
  time: number[];
  decisions: number[];
  slowest: number[];
}

/** The AI at git commit `ref` (extracted on first use), or the current one. */
async function loadAi(ref?: string): Promise<Ai> {
  if (!ref) return current;
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'buffer', maxBuffer: 1 << 28 });
  const commit = git('rev-parse', `${ref}^{commit}`).toString().trim();
  const dir = fileURLToPath(new URL(`../.cache/ai-match/${commit}`, import.meta.url));
  if (!existsSync(dir)) {
    // Extracted beside the final directory and renamed, so parallel workers never see half of it.
    const tmp = `${dir}.${process.pid}`;
    mkdirSync(tmp, { recursive: true });
    execFileSync('tar', ['-x', '-C', tmp, '--strip-components=3'], { input: git('archive', commit, 'packages/ai/src') });
    try {
      renameSync(tmp, dir);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  return import(`${dir}/index.ts`);
}

function play(from: number, to: number, progress: boolean): Result {
  const r: Result = { wins: [0, 0], unfinished: 0, turns: 0, time: [0, 0], decisions: [0, 0], slowest: [0, 0] };
  for (let g = from; g < to; g++) {
    const swap = seats === 2 && g % 2 === 1;
    // Which side (0 = level A, 1 = level B) plays seat p.
    const side = (p: number) => (seats === 2 ? (swap ? 1 - p : p) : p === 0 ? 0 : 1);
    let s: GameState = createGame({
      players: Array.from({ length: seats }, (_, i) => ({ name: `P${i}`, color: '#fff', ai: true })),
      seed: 5000 + Math.floor(g / 2),
      mode: mode as GameMode,
    });
    const random = mulberry32(g * 7919 + 13);
    for (let step = 0; s.phase !== 'over' && step < 3000; step++) {
      let action: Action | null = null;
      if (s.pending[0]?.kind === 'combat') {
        for (const p of s.players) action ??= ais[side(p.id)].chooseCombatResponse(s, p.id, { level: levels[side(p.id)], random });
      }
      const who = side(actor(s));
      const t = performance.now();
      action ??= ais[who].chooseAction(s, { level: levels[who], random });
      const dt = performance.now() - t;
      r.time[who] += dt;
      r.decisions[who]++;
      r.slowest[who] = Math.max(r.slowest[who], dt);
      if (!action) throw new Error(`game ${g}: no action at step ${step}`);
      s = apply(s, action);
    }
    if (s.phase === 'over') {
      r.wins[side(s.winner!)]++;
      r.turns += s.turn.number;
    } else r.unfinished++;
    if (progress) process.stdout.write(`\rgame ${g + 1}/${to}: L${specs[0]} ${r.wins[0]} – ${r.wins[1]} L${specs[1]}`);
  }
  return r;
}

/** Plays the games in `count` worker processes (this script again, each with a shard). */
async function playInParallel(count: number): Promise<Result> {
  // Shards of an even size, so that both games of a pair (one map seed) land in the same one.
  const size = Math.ceil(n / count / 2) * 2;
  const shards: [number, number][] = [];
  for (let from = 0; from < n; from += size) shards.push([from, Math.min(n, from + size)]);
  let done = 0;
  const results = await Promise.all(
    shards.map(
      ([from, to]) =>
        new Promise<Result>((resolve, reject) => {
          // Under vite-node, argv[1] is vite-node itself and the script's path is left out.
          const child = spawn(process.execPath, [process.argv[1], fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
            env: { ...process.env, AI_MATCH_SHARD: `${from}-${to}` },
            stdio: ['ignore', 'pipe', 'inherit'],
          });
          let out = '';
          child.stdout.on('data', (d) => (out += d));
          child.on('error', reject);
          child.on('exit', (code) => {
            if (code !== 0) return reject(new Error(`games ${from}-${to} failed (exit ${code})`));
            process.stdout.write(`\r${(done += to - from)}/${n} games`);
            resolve(JSON.parse(out.trim().split('\n').pop()!));
          });
        }),
    ),
  );
  const sum = (k: 'wins' | 'time' | 'decisions') => [0, 1].map((i) => results.reduce((x, r) => x + r[k][i], 0));
  return {
    wins: sum('wins'),
    time: sum('time'),
    decisions: sum('decisions'),
    slowest: [0, 1].map((i) => Math.max(...results.map((r) => r.slowest[i]))),
    unfinished: results.reduce((x, r) => x + r.unfinished, 0),
    turns: results.reduce((x, r) => x + r.turns, 0),
  };
}

if (shard) {
  const [from, to] = shard.split('-').map(Number);
  console.log(JSON.stringify(play(from, to, false)));
} else {
  const r = Number(jobs) > 1 ? await playInParallel(Number(jobs)) : play(0, n, true);
  const finished = n - r.unfinished;
  console.log(`\n\n${mode}, ${seats} players, ${n} games${r.unfinished ? ` (${r.unfinished} unfinished)` : ''}, ${(r.turns / Math.max(1, finished)).toFixed(1)} turns on average`);
  for (const i of [0, 1]) {
    const avg = r.time[i] / Math.max(1, r.decisions[i]);
    console.log(`  level ${specs[i]}: ${r.wins[i]} wins, ${avg.toFixed(0)} ms per decision, slowest ${r.slowest[i].toFixed(0)} ms`);
  }
  if (seats === 2 && finished) {
    // How surprising the score would be between equal players: |z| > 2 is about p < 0.05.
    const z = (r.wins[0] - finished / 2) / Math.sqrt(finished / 4);
    console.log(`  level ${specs[0]} won ${((100 * r.wins[0]) / finished).toFixed(1)}% (z = ${z.toFixed(2)})`);
  }
}
