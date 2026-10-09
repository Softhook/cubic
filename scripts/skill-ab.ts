/**
 * Skill value test: what one skill is worth on its own, with nothing else changed.
 *
 * At the start of play one side holds the skill and the other none (both drafted starting skills
 * are removed); both keep drafting as usual. Seats swap every game and each pair of games shares a
 * map seed, so "none" (neither side holds a skill) should come out near 50%. Prints one JSON line
 * per skill with the wins of the side that held it. 200 games give a 95% margin of about ±7 points.
 *
 *   npm run selfplay:skills -- [games=100] [level=3] [mode=community] [skills=none,agile,...]
 */
import { chooseAction, chooseCombatResponse, type AiLevel } from '../packages/ai/src';
import { apply, createGame, mulberry32, type Action, type GameMode, type GameState } from '../packages/engine/src';
import { setSkills } from '../packages/engine/test/audit';

const [games = '100', lvl = '3', mode = 'community', list = 'none'] = process.argv.slice(2);
const n = Number(games);
const level = Number(lvl) as AiLevel;

for (const skill of list.split(',')) {
  let winsA = 0, unfinished = 0, turns = 0;
  for (let g = 0; g < n; g++) {
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
      if (s.winner === aSeat) winsA++;
      turns += s.turn.number;
    } else unfinished++;
  }
  console.log(JSON.stringify({ skill, level, mode, games: n, winsA, unfinished, avgTurns: turns / Math.max(1, n - unfinished) }));
}
