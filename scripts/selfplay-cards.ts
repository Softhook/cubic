/**
 * AI self-play card usage tracker and benchmark.
 *
 * Runs 2-player self-play matches, stops on any invariant violation, and reports card usage, win
 * rates, pick rates, and draft timing/context statistics.
 *
 * "Used" counts the times a card took effect: each activation or choice of an activated skill or
 * decision, each Tactic played, each trigger of a triggered skill (first destroy of a turn,
 * research reset, ...), each battle in which a combat skill changed a roll, a total or the result,
 * and each move, deploy or conquer a movement, deployment or conquer skill could have changed.
 * Win rates over a handful of games are noise: check "Taken" before reading anything into them.
 *
 *   npm run selfplay:cards -- [games=50] [mode=community|original] [level=1]
 */
import { chooseAction, chooseCombatResponse, type AiLevel } from '../packages/ai/src';
import {
  activeSkills,
  actor,
  apply,
  card,
  checkInvariants,
  combatOutcome,
  combatReroll,
  createGame,
  effectOf,
  EXPANSION,
  ORIGINAL_COMMAND,
  ORIGINAL_GAMBIT,
  rulesOf,
  SKILLS,
  TACTICS,
  type Action,
  type CardDef,
  type GameMode,
  type GameState,
  type PlayerId,
} from '../packages/engine/src';

const [argGames = '50', argMode = 'community', argLevel = '1'] = process.argv.slice(2);
const numGames = Number(argGames);
const mode = argMode as GameMode;
const level = Number(argLevel) as AiLevel;

function seededRandom(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
}

interface CardUsageStats {
  card: CardDef;
  taken: number;
  played: number;
  turnsActive: number;
  gamesPresent: number;
  wins: number;
  losses: number;

  // Timing and game state when drafted
  turnsTaken: number[];
  cubesLeftWhenTaken: number[];
  dominanceWhenTaken: number[];
  researchWhenTaken: number[];
  takenWhenLeading: number;
  takenWhenTied: number;
  takenWhenBehind: number;
}

const relevantCards: CardDef[] =
  mode === 'original'
    ? [...ORIGINAL_COMMAND, ...ORIGINAL_GAMBIT]
    : mode === 'community'
    ? [...SKILLS, ...TACTICS, EXPANSION]
    : [];

/** The Expansion card of this mode (Original has its own, among the Gambits). */
const expansionId = mode === 'original' ? 'o-expansion' : EXPANSION.id;

/** The active skill `p` holds with one of these engine effects, if any. */
function held(s: GameState, p: PlayerId, effects: readonly string[]): string | undefined {
  return s.players[p].skills.find((sk) => sk.active && effects.includes(effectOf(sk.id)))?.id;
}

/** Actions that are the use of a skill, by the skill's engine effect. */
const ACTION_EFFECTS: Partial<Record<Action['type'], readonly string[]>> = {
  composed: ['composed'],
  flexible: ['flexible'],
  resourceful: ['resourceful'],
  ambitious: ['ambitious'],
  tactical: ['tactical', 'tactical-original'],
  nomadic: ['nomadic'],
  tyrannical: ['tyrannical-original'],
  scrappy: ['scrappy'],
  brilliant: ['brilliant'],
  profiteer: ['profiteering'],
  playStoredTactic: ['patient'],
  dangerous: ['dangerous'],
  ruthless: ['ruthless'],
};

/** Declining a choice (Dangerous, Ruthless, Brilliant) is not a use. */
function isUse(a: Action): boolean {
  if (a.type === 'dangerous') return a.destroy;
  if (a.type === 'ruthless') return !!a.skill;
  if (a.type === 'brilliant') return a.gain;
  return true;
}

const stats = new Map<string, CardUsageStats>();
for (const c of relevantCards) {
  stats.set(c.id, {
    card: c,
    taken: 0,
    played: 0,
    turnsActive: 0,
    gamesPresent: 0,
    wins: 0,
    losses: 0,
    turnsTaken: [],
    cubesLeftWhenTaken: [],
    dominanceWhenTaken: [],
    researchWhenTaken: [],
    takenWhenLeading: 0,
    takenWhenTied: 0,
    takenWhenBehind: 0,
  });
}

console.log(`Starting self-play: ${numGames} ${mode} games with Level ${level} AI...`);

let completedGames = 0;
let totalTurns = 0;

for (let g = 0; g < numGames; g++) {
  const seed = 6000 + g;
  let s: GameState = createGame({
    players: [
      { name: 'Cadet-0', color: '#3b82f6', ai: true },
      { name: 'Cadet-1', color: '#ef4444', ai: true },
    ],
    seed,
    mode,
  });

  const random = seededRandom(g * 43 + 11);
  const cardsInGame = new Set<string>();
  const playerCardsInGame = new Map<number, Set<string>>([
    [0, new Set<string>()],
    [1, new Set<string>()],
  ]);

  /** A card drafted by `player`, with the position `st` it was taken in. */
  function recordCardDraft(st: GameState, cardId: string, player: number) {
    const stat = stats.get(cardId);
    if (!stat) return;
    stat.taken++;
    cardsInGame.add(cardId);
    playerCardsInGame.get(player)?.add(cardId);
    stat.turnsTaken.push(Math.max(1, st.turn.number));
    const pl = st.players[player];
    stat.cubesLeftWhenTaken.push(pl.cubesLeft);
    stat.dominanceWhenTaken.push(pl.dominance);
    stat.researchWhenTaken.push(pl.research);
    const foe = st.players.find((p) => p.id !== player);
    if (foe) {
      if (pl.cubesLeft < foe.cubesLeft) stat.takenWhenLeading++;
      else if (pl.cubesLeft > foe.cubesLeft) stat.takenWhenBehind++;
      else stat.takenWhenTied++;
    }
  }

  for (let step = 0; s.phase !== 'over' && step < 3000; step++) {
    let action: Action | null = null;
    if (s.pending[0]?.kind === 'combat') {
      for (const p of s.players) {
        action ??= chooseCombatResponse(s, p.id, { level, random });
      }
    }
    action ??= chooseAction(s, { level, random });
    if (!action) throw new Error(`Game ${g}: no action at step ${step}`);

    const sBefore = s;
    const head = s.pending[0];
    const who = actor(s);
    s = apply(s, action);
    const errors = checkInvariants(s);
    if (errors.length) throw new Error(`Game ${g}, step ${step}, after ${JSON.stringify(action)}: ${errors.join('; ')}`);

    const use = (id: string | undefined) => {
      if (id && stats.has(id)) {
        stats.get(id)!.played++;
        cardsInGame.add(id);
      }
    };
    const useHeld = (p: PlayerId, effects: readonly string[]) => use(held(sBefore, p, effects));

    // Card picks. A tactic taken (and not stored) or an Expansion is played at once.
    if (action.type === 'takeCard' && head?.kind === 'takeCard') {
      const m = sBefore.market;
      const deck = action.deck === 'skill' ? m.skillDeck : m.tacticDeck;
      const row = action.deck === 'skill' ? m.skillRow : m.tacticRow;
      const willPeek = rulesOf(sBefore).cards?.peek && action.index === row.length - 1 && row.length === 3 && deck.length;
      const id = action.deck === 'expansion' ? expansionId : willPeek ? null : row[action.index];
      if (id) {
        recordCardDraft(sBefore, id, head.player);
        if (action.deck !== 'skill' && !action.store) use(id);
      }
    } else if (action.type === 'peekChoice' && head?.kind === 'peek') {
      const id = action.takeTop ? head.top : (head.deck === 'skill' ? sBefore.market.skillRow : sBefore.market.tacticRow)[2];
      recordCardDraft(sBefore, id, head.player);
      if (head.deck === 'tactic' && !head.store) use(id);
    } else if (action.type === 'draftSkill' && head?.kind === 'skillDraft') {
      recordCardDraft(sBefore, action.skill, head.player);
    } else if (action.type === 'changeOfHeart' && head?.kind === 'changeOfHeart') {
      recordCardDraft(sBefore, action.skill, head.player);
    } else if (action.type === 'playStoredTactic') {
      use(action.card);
    }

    // Activated skills and choices: each use counts.
    const effects = ACTION_EFFECTS[action.type];
    if (effects && isUse(action)) useHeld(who, effects);
    if (action.type === 'clever' && head?.kind === 'clever') useHeld(head.player, head.source === 'calculating' ? ['calculating'] : ['clever', 'clever-original']);
    if (action.type === 'prideful' && action.take && head?.kind === 'prideful') {
      use('prideful');
      playerCardsInGame.get(head.player)?.add('prideful');
    }
    if (!sBefore.turn.curiousUsed && s.turn.curiousUsed) useHeld(who, ['curious']);
    if (action.type === 'move' && sBefore.turn.freeMoves > s.turn.freeMoves) useHeld(who, ['curious-original']);
    if (action.type === 'deploy' && sBefore.turn.freeDeploys > s.turn.freeDeploys) useHeld(who, ['industrious']);
    if (!sBefore.turn.oncePerTurn.includes('cunning') && s.turn.oncePerTurn.includes('cunning')) useHeld(who, ['cunning']);

    // Passive skills: the actions they could change.
    if (action.type === 'move' || action.type === 'carry') useHeld(who, ['agile', 'devious', 'steadfast']);
    if (action.type === 'deploy') useHeld(who, ['stealthy', 'eager']);
    if (action.type === 'conquer') useHeld(who, ['ingenious', 'intelligent', 'pioneering', 'tyrannical']);

    // Combat: skills that changed a roll or total, Stubborn when it decided the battle, re-rolls made.
    if (action.type === 'resolveCombat' && head?.kind === 'combat') {
      const out = combatOutcome(sBefore, head);
      for (const [side, total] of [['attacker', out.attacker], ['defender', out.defender]] as const) {
        for (const a of activeSkills(sBefore, head[side].player)) {
          const name = card(a.card).name;
          if (total.parts.some((x) => x.label === name || x.label === `${name} roll`)) use(a.card);
        }
      }
      if (out.stubborn) useHeld(head.defender.player, ['stubborn']);
    }
    if (action.type === 'reroll' && head?.kind === 'combat') use(combatReroll(sBefore, head, action.by, action.side)?.card);

    // Destroying an enemy ship (first time this turn), and keeping dominance when losing one.
    for (const p of s.turn.destroyedBy) {
      if (!sBefore.turn.destroyedBy.includes(p) && s.turn.number === sBefore.turn.number) {
        useHeld(p, ['hostile', 'plundering', 'plundering-original', 'ravenous', 'ravenous-original', 'ruthless']);
      }
    }
    for (const d of s.dice) {
      const was = sBefore.dice.find((x) => x.id === d.id)!;
      if (was.loc.zone === 'board' && d.loc.zone === 'scrapyard') useHeld(d.owner, ['righteous', 'righteous-original']);
    }

    // Thresholds: a research reset below 6 (Precocious), more than 3 skills (Talented).
    for (const p of s.players) {
      const was = sBefore.players[p.id];
      if (p.research < was.research && was.research < 6 && was.research >= 4) useHeld(p.id, ['precocious']);
      if (p.skills.length > 3 && was.skills.length <= 3) useHeld(p.id, ['talented']);
    }

    // A new turn: the previous player's active skills were in play for it; start-of-turn bonuses.
    if (s.turn.number !== sBefore.turn.number) {
      for (const sk of sBefore.players[sBefore.turn.player].skills) {
        if (sk.active && stats.has(sk.id)) {
          stats.get(sk.id)!.turnsActive++;
          cardsInGame.add(sk.id);
        }
      }
      const p = s.turn.player;
      useHeld(p, ['brilliant']);
      if (s.turn.actionsLeft > 3) useHeld(p, ['arrogant', 'conformist']);
    }
  }

  if (s.phase === 'over') {
    completedGames++;
    totalTurns += s.turn.number;
    const winner = s.winner;
    if (winner !== null) {
      for (const p of s.players) {
        const isWinner = p.id === winner;
        const playerCardSet = playerCardsInGame.get(p.id) ?? new Set<string>();
        // Credit currently held skills
        for (const sk of p.skills) playerCardSet.add(sk.id);

        for (const cardId of playerCardSet) {
          const st = stats.get(cardId);
          if (st) {
            if (isWinner) st.wins++;
            else st.losses++;
          }
        }
      }
    }
    for (const id of cardsInGame) {
      const st = stats.get(id);
      if (st) st.gamesPresent++;
    }
  }

  process.stdout.write(`\rPlayed game ${g + 1}/${numGames}...`);
}

console.log(`\n\nCompleted ${completedGames}/${numGames} games, avg ${(totalTurns / Math.max(1, completedGames)).toFixed(1)} turns/game.\n`);

// ---------------------------------------------------------------------------
// Report 1: Performance & Win Rate
// ---------------------------------------------------------------------------
console.log('=== CARD PERFORMANCE & WIN RATE REPORT ===');
console.log(
  'Name'.padEnd(20) +
    'Type'.padEnd(10) +
    'Taken'.padStart(7) +
    'Used'.padStart(8) +
    'Wins'.padStart(6) +
    'Losses'.padStart(8) +
    'Win Rate'.padStart(10) +
    'Pick Rate'.padStart(11) +
    'Active Turns'.padStart(14),
);
console.log('-'.repeat(94));

// Sort by win rate (among cards drafted at least once), then by total wins
const sortedByWinRate = [...stats.values()].sort((a, b) => {
  const aTotal = a.wins + a.losses;
  const bTotal = b.wins + b.losses;
  if (aTotal === 0 && bTotal === 0) return b.taken - a.taken;
  if (aTotal === 0) return 1;
  if (bTotal === 0) return -1;
  const aRate = a.wins / aTotal;
  const bRate = b.wins / bTotal;
  if (Math.abs(bRate - aRate) > 0.001) return bRate - aRate;
  return b.wins - a.wins;
});

let usedCount = 0;
for (const st of sortedByWinRate) {
  const isUsed = st.taken > 0 || st.turnsActive > 0 || st.played > 0;
  if (isUsed) usedCount++;
  const typeStr = st.card.category ?? 'card';
  const totalDecided = st.wins + st.losses;
  const winRateStr = totalDecided > 0 ? `${((st.wins / totalDecided) * 100).toFixed(1)}%` : '-';
  const pickRateStr = `${((st.gamesPresent / Math.max(1, completedGames)) * 100).toFixed(1)}%`;

  console.log(
    st.card.name.padEnd(20) +
      typeStr.padEnd(10) +
      String(st.taken).padStart(7) +
      String(st.played).padStart(8) +
      String(st.wins).padStart(6) +
      String(st.losses).padStart(8) +
      winRateStr.padStart(10) +
      pickRateStr.padStart(11) +
      String(st.turnsActive).padStart(14),
  );
}
console.log('-'.repeat(94));
console.log(`Cards drafted/used: ${usedCount}/${relevantCards.length} (${((usedCount / relevantCards.length) * 100).toFixed(1)}%)\n`);

// ---------------------------------------------------------------------------
// Report 2: When Cards Are Chosen (Timing & Draft Context)
// ---------------------------------------------------------------------------
console.log('=== WHEN CARDS ARE CHOSEN (TIMING & BOARD STATE CONTEXT) ===');
console.log(
  'Name'.padEnd(20) +
    'Type'.padEnd(10) +
    'Taken'.padStart(6) +
    'Avg Turn'.padStart(10) +
    'Phase'.padStart(11) +
    'Avg Cubes'.padStart(11) +
    'Avg Dom'.padStart(9) +
    'Avg Res'.padStart(9) +
    'Leading %'.padStart(11) +
    'Behind %'.padStart(10),
);
console.log('-'.repeat(107));

const draftedCards = [...stats.values()]
  .filter((st) => st.taken > 0)
  .sort((a, b) => {
    const aAvg = a.turnsTaken.reduce((sum, v) => sum + v, 0) / Math.max(1, a.turnsTaken.length);
    const bAvg = b.turnsTaken.reduce((sum, v) => sum + v, 0) / Math.max(1, b.turnsTaken.length);
    return aAvg - bAvg;
  });

for (const st of draftedCards) {
  const typeStr = st.card.category ?? 'card';
  const avgTurn = st.turnsTaken.reduce((sum, v) => sum + v, 0) / st.turnsTaken.length;
  const avgCubes = st.cubesLeftWhenTaken.reduce((sum, v) => sum + v, 0) / st.cubesLeftWhenTaken.length;
  const avgDom = st.dominanceWhenTaken.reduce((sum, v) => sum + v, 0) / st.dominanceWhenTaken.length;
  const avgRes = st.researchWhenTaken.reduce((sum, v) => sum + v, 0) / st.researchWhenTaken.length;

  let phase = 'Opening';
  if (avgTurn >= 9) phase = 'Endgame';
  else if (avgTurn >= 4) phase = 'Mid-game';

  const leadPct = `${((st.takenWhenLeading / st.taken) * 100).toFixed(0)}%`;
  const behindPct = `${((st.takenWhenBehind / st.taken) * 100).toFixed(0)}%`;

  console.log(
    st.card.name.padEnd(20) +
      typeStr.padEnd(10) +
      String(st.taken).padStart(6) +
      `Turn ${avgTurn.toFixed(1)}`.padStart(10) +
      phase.padStart(11) +
      `${avgCubes.toFixed(1)} left`.padStart(11) +
      avgDom.toFixed(1).padStart(9) +
      avgRes.toFixed(1).padStart(9) +
      leadPct.padStart(11) +
      behindPct.padStart(10),
  );
}
console.log('-'.repeat(107));
