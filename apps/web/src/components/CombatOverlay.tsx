import { useEffect, useState, type CSSProperties } from 'react';
import { SHIP_NAMES, canRespondToCombat, card, combatOutcome, combatReroll, missileOffered, tryApply, type Action, type CombatPending, type CombatRole, type GameState, type PlayerState } from '@quantum/engine';
import type { Dispatch } from '../game/useGame';
import { Die3D } from './Die3D';

const REVEAL_MS = 1250;

export function CombatOverlay({ game, combat, dispatch }: { game: GameState; combat: CombatPending; dispatch: Dispatch }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
    const t = window.setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [combat.id]);

  const out = combatOutcome(game, combat);
  const A = game.players[combat.attacker.player];
  const D = game.players[combat.defender.player];
  const humans = game.players.filter((p) => !p.ai);
  const shooters = humans.filter((p) => p.missiles > 0);
  const autoResolve = !humans.some((p) => canRespondToCombat(game, combat, p.id));
  const leader = out.attackerWins ? A : D;

  const side = (role: CombatRole) => {
    const s = combat[role];
    const p = game.players[s.player];
    const total = role === 'attacker' ? out.attacker : out.defender;
    const winning = revealed && (role === 'attacker') === out.attackerWins;
    return (
      <div className={`combat-side ${role} ${winning ? 'winning' : ''}`} style={{ '--pc': p.color } as CSSProperties}>
        <div className="combat-who">
          <small>{role === 'attacker' ? 'Attacker' : 'Defender'}</small>
          <strong>{p.name}</strong>
        </div>
        <div className="combat-dice">
          <div className="combat-die-col">
            <Die3D value={s.ship} size={64} color={p.color} sound={false} />
            <span>{SHIP_NAMES[s.ship]}</span>
          </div>
          <span className="combat-plus">+</span>
          <div className={`combat-die-col ${s.missile ? 'missiled' : ''}`}>
            <Die3D
              value={total.roll}
              size={64}
              color={role === 'attacker' ? '#1b1f2e' : '#f4f6fb'}
              pip={role === 'attacker' ? '#ff6b81' : '#14192b'}
              tumbleOnMount
              delay={role === 'attacker' ? 0 : 0.12}
              sound={role === 'attacker'}
            />
            <span>{role === 'attacker' ? 'Attack die' : 'Defence die'}</span>
          </div>
        </div>
        <ul className={`combat-parts ${revealed ? 'show' : ''}`}>
          {total.parts.map((part, i) => (
            <li key={i}>
              <span>{part.label}</span>
              <b>{part.value > 0 && i > 0 ? `+${part.value}` : part.value}</b>
            </li>
          ))}
          {s.dice.length > 1 && <li className="muted">Brutal: rolled {s.dice.join(' & ')}</li>}
        </ul>
        <div className={`combat-total ${revealed ? 'show' : ''}`}>{revealed ? total.total : '?'}</div>
        {revealed && humans.map((p) => <RerollButton key={p.id} game={game} combat={combat} role={role} by={p} named={humans.length > 1} dispatch={dispatch} />)}
        {revealed && shooters.map((sh) => <MissileButton key={sh.id} game={game} combat={combat} role={role} shooter={sh} named={humans.length > 1} dispatch={dispatch} />)}
        {revealed && !s.missile && total.roll === 1 && shooters.some((sh) => sh.id === s.player) && (
          <p className="missile-note">Roll is already 1 — a missile can’t help.</p>
        )}
      </div>
    );
  };

  return (
    <div className="overlay combat-overlay">
      <div className="combat-card">
        <h2>Battle</h2>
        <div className="combat-grid">
          {side('attacker')}
          <div className="combat-vs">VS</div>
          {side('defender')}
        </div>
        <p className="combat-rule">Lower total wins · attacker wins ties</p>
        <div className={`combat-verdict ${revealed ? 'show' : ''}`} style={{ '--pc': leader.color } as CSSProperties}>
          {revealed && (
            <>
              <strong>{leader.name}</strong> {out.stubborn ? 'holds firm (Stubborn)' : out.attackerWins ? 'will destroy the defender' : 'will repel the attack'}
            </>
          )}
        </div>
        <div className="combat-footer">
          {autoResolve ? (
            <div className="autobar" key={`${combat.id}-${+combat.attacker.missile}-${+combat.defender.missile}`}>
              <span />
            </div>
          ) : (
            <button className="btn btn-primary" disabled={!revealed} onClick={() => dispatch({ type: 'resolveCombat' })}>
              Resolve battle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Cruel, Relentless or Scrappy: re-roll this side's combat dice (each card once per battle). */
function RerollButton({
  game,
  combat,
  role,
  by,
  named,
  dispatch,
}: {
  game: GameState;
  combat: CombatPending;
  role: CombatRole;
  by: PlayerState;
  named: boolean;
  dispatch: Dispatch;
}) {
  const skill = combatReroll(game, combat, by.id, role);
  if (!skill) return null;
  const via = card(skill.card).name;
  const own = combat[role].player === by.id;
  return (
    <button className="btn btn-missile" onClick={() => dispatch({ type: 'reroll', by: by.id, side: role })}>
      <span>
        🎲 {named ? `${by.name}: ` : ''}
        {own ? `Re-roll (${via})` : `Make ${game.players[combat[role].player].name} re-roll (${via})`}
      </span>
      <small>You must keep the new roll</small>
    </button>
  );
}

/**
 * A missile sets one combat roll to 1. Lower totals win, so firing at your opponent's roll
 * only helps them: combatants are offered their own roll only, and not while already winning;
 * bystanders either roll (engine missileOffered).
 * Each button previews the battle result if fired.
 */
function MissileButton({
  game,
  combat,
  role,
  shooter,
  named,
  dispatch,
}: {
  game: GameState;
  combat: CombatPending;
  role: CombatRole;
  shooter: PlayerState;
  named: boolean;
  dispatch: Dispatch;
}) {
  const side = combat[role];
  const fighting = shooter.id === combat.attacker.player || shooter.id === combat.defender.player;
  if (!missileOffered(game, combat, shooter.id, role)) return null;
  const action: Action = { type: 'missile', by: shooter.id, side: role };
  const next = tryApply(game, action);
  const nextCombat = next?.pending[0];
  if (!next || nextCombat?.kind !== 'combat') return null;

  const now = combatOutcome(game, combat);
  const after = combatOutcome(next, nextCombat);
  const sideWins = (o: typeof after) => (role === 'attacker') === o.attackerWins;
  const mine = role === 'attacker' ? after.attacker.total : after.defender.total;
  const theirs = role === 'attacker' ? after.defender.total : after.attacker.total;
  const flips = sideWins(after) !== sideWins(now);
  const you = fighting && !named;
  const who = you ? 'you' : game.players[side.player].name;
  const verdict = sideWins(after)
    ? `${who} ${flips ? 'would win' : you ? 'still win' : 'still wins'} ${mine} vs ${theirs}`
    : `${who} would still lose ${mine} vs ${theirs}`;

  return (
    <button className={`btn btn-missile ${flips ? 'decisive' : ''}`} onClick={() => dispatch(action)}>
      <span>
        🚀 {named ? `${shooter.name}: ` : ''}
        {fighting ? 'Fire missile — your roll becomes 1' : `Help ${game.players[side.player].name} — roll becomes 1`}
      </span>
      <small>{verdict}</small>
    </button>
  );
}
