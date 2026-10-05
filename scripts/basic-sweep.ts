/**
 * Basic-rules AI sweep: plays AI games on every map the Basic mode allows and reports, per map,
 * game length, seat results and AI behaviour that is wrong under the Basic rules.
 *
 * Every game runs through the card audit (packages/engine/test/audit.ts), so illegal actions,
 * engine errors and broken invariants are anomalies. On top of that, each step is checked for:
 *
 * - missed win: a Conquer was legal that would have ended the game, and the AI did something else;
 * - missed conquer: the AI ended its turn with a Conquer still legal;
 * - shuttle: a ship moved back to a space it already left this turn;
 * - long shot: an attack the attacker wins less than a third of the time.
 *
 *   npm run sweep:basic -- [games=2] [level=3] [shard=0/1] [maps=id,id,...]
 *
 * `shard=i/n` plays every n-th map starting at i, so several processes can split the maps.
 */
import { auditGame } from '../packages/engine/test/audit';
import type { AiLevel } from '../packages/ai/src';
import { apply, attackOdds, legalActions, MAPS, type Action, type GameState, type PlayerId } from '../packages/engine/src';

const [argGames = '2', argLevel = '3', argShard = '0/1', argMaps] = process.argv.slice(2);
const games = Number(argGames);
const level = Number(argLevel) as AiLevel;
const [shard, shards] = argShard.split('/').map(Number);
const BASIC_GROUPS = ['basic', 'advanced', 'addon'];
const maps = MAPS.filter((m) => BASIC_GROUPS.includes(m.group) && (!argMaps || argMaps.split(',').includes(m.id))).filter((_, i) => i % shards === shard);

interface Finding {
  map: string;
  seed: number;
  turn: number;
  player: PlayerId;
  kind: 'missed win' | 'missed conquer' | 'shuttle' | 'long shot' | 'anomaly' | 'unfinished';
  detail: string;
  log: string[];
}

const findings: Finding[] = [];

function wins(s: GameState, a: Action): boolean {
  try {
    const t = apply(s, a);
    return t.phase === 'over' && t.winner === s.turn.player;
  } catch {
    return false;
  }
}

for (const map of maps) {
  const results: { turns: number; winner: PlayerId | null; seconds: number; attacks: number; conquers: number; endTurnsWithActions: number }[] = [];
  for (let g = 0; g < games; g++) {
    const seed = 7000 + g;
    const started = performance.now();
    let attacks = 0;
    let conquers = 0;
    let endTurnsWithActions = 0;
    let last: GameState | undefined;
    /** Spaces each ship has left this turn, by die id. */
    let left = new Map<string, Set<string>>();
    let turnNo = -1;
    const note = (s: GameState, kind: Finding['kind'], detail: string) =>
      findings.push({ map: map.id, seed, turn: s.turn.number, player: s.turn.player, kind, detail, log: s.log.slice(-6).map((l) => l.text) });

    const result = auditGame(
      { mode: 'basic', mapId: map.id, players: map.players, levels: Array(map.players).fill(level), seed },
      {
        onStep: ({ before: s, action, after }) => {
          last = after;
          if (s.turn.number !== turnNo) {
            turnNo = s.turn.number;
            left = new Map();
          }
          if (s.phase !== 'play' || s.pending.length) return;
          const legal = legalActions(s);
          const conquerActions = legal.filter((a) => a.type === 'conquer');
          if (action.type !== 'conquer' && conquerActions.some((a) => wins(s, a))) note(s, 'missed win', `played ${action.type} instead`);
          if (action.type === 'endTurn') {
            if (s.turn.actionsLeft > 0) endTurnsWithActions++;
            if (conquerActions.length) note(s, 'missed conquer', `ended turn with ${s.turn.actionsLeft} actions left; could conquer planet ${conquerActions.map((a) => (a as { planet: number }).planet).join(', ')}`);
          }
          if (action.type === 'conquer') conquers++;
          if (action.type === 'attack') {
            attacks++;
            const me = s.dice.find((d) => d.id === action.die)!;
            const foe = s.dice.find((d) => d.id === action.target)!;
            const odds = attackOdds(me.value, foe.value);
            if (odds < 1 / 3) note(s, 'long shot', `attack ${me.value} vs ${foe.value}, wins ${(odds * 100).toFixed(0)}%`);
          }
          if (action.type === 'move') {
            const d = s.dice.find((x) => x.id === action.die)!;
            if (d.loc.zone === 'board') {
              const from = `${d.loc.r},${d.loc.c}`;
              const to = `${action.to.r},${action.to.c}`;
              const set = left.get(d.id) ?? new Set();
              if (set.has(to)) note(s, 'shuttle', `ship ${d.id} (${d.value}) moved back to ${to}`);
              set.add(from);
              left.set(d.id, set);
            }
          }
        },
      },
    );
    for (const a of result.anomalies) findings.push({ map: map.id, seed, turn: -1, player: -1 as PlayerId, kind: 'anomaly', detail: `step ${a.step}: ${a.message}`, log: a.context });
    if (!result.finished && last) note(last, 'unfinished', `no winner after ${result.steps} steps`);
    results.push({
      turns: last?.turn.number ?? 0,
      winner: last?.winner ?? null,
      seconds: (performance.now() - started) / 1000,
      attacks,
      conquers,
      endTurnsWithActions,
    });
  }
  const avg = (f: (r: (typeof results)[number]) => number) => (results.reduce((s, r) => s + f(r), 0) / results.length).toFixed(1);
  const winners = results.map((r) => (r.winner === null ? '-' : `P${r.winner}`)).join(' ');
  const mine = findings.filter((f) => f.map === map.id);
  const count = (k: Finding['kind']) => mine.filter((f) => f.kind === k).length;
  console.log(
    `${map.id.padEnd(24)} ${map.players}p  turns ${avg((r) => r.turns).padStart(5)}  attacks ${avg((r) => r.attacks).padStart(5)}  conquers ${avg((r) => r.conquers).padStart(4)}  ` +
      `early ends ${avg((r) => r.endTurnsWithActions).padStart(4)}  winners ${winners.padEnd(8)}  ${avg((r) => r.seconds)}s  ` +
      `| anomaly ${count('anomaly')} unfinished ${count('unfinished')} missed-win ${count('missed win')} missed-conquer ${count('missed conquer')} shuttle ${count('shuttle')} long-shot ${count('long shot')}`,
  );
}

console.log(`\n=== FINDINGS (${findings.length}) ===`);
for (const f of findings) {
  console.log(`\n[${f.kind}] ${f.map} seed ${f.seed} turn ${f.turn} P${f.player}: ${f.detail}`);
  for (const l of f.log) console.log(`    ${l}`);
}
