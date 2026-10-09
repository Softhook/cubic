import { useEffect, useState, type CSSProperties } from 'react';
import { SHIP_NAMES, canRespondToCombat, card, combatOutcome, combatReroll, missileOffered, tryApply, type Action, type CombatPending, type CombatRole, type GameState, type PlayerId, type PlayerState } from '@quantum/engine';
import type { Dispatch } from '../game/useGame';
import type { GameView } from '../game/view';
import { COMBAT_RESOLVE_MS } from '../game/useAiDriver';
import { PHONE, useMediaQuery } from '../game/useMediaQuery';
import { useShortcut } from '../game/useShortcut';
import { COMBAT_MS } from '../online/playback';
import { COMBAT_DICE } from '../theme';
import { MissileIcon } from './Card';
import { Die3D } from './Die3D';

const REVEAL_MS = 1250;

export function CombatOverlay({
  game,
  combat,
  dispatch,
  mine,
  aiResponder,
  online,
}: {
  game: GameState;
  combat: CombatPending;
  dispatch: Dispatch;
  /** The players this screen responds for. */
  mine: (p: PlayerId) => boolean;
  /** On this device: the AI about to respond, so the battle can't be resolved yet. */
  aiResponder: PlayerId | null;
  /** Online: who the battle waits for; it resolves once everyone who may respond is done. */
  online?: GameView['combat'];
}) {
  const [revealed, setRevealed] = useState(false);
  const dieSize = useMediaQuery(PHONE) ? 40 : 64;
  useEffect(() => {
    setRevealed(false);
    const t = window.setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [combat.id]);

  const out = combatOutcome(game, combat);
  const A = game.players[combat.attacker.player];
  const D = game.players[combat.defender.player];
  const humans = game.players.filter((p) => (online ? online.responders.includes(p.id) : mine(p.id)));
  const shooters = humans.filter((p) => p.missiles > 0);
  const autoResolve = !humans.some((p) => canRespondToCombat(game, combat, p.id));
  const waitingNames = online ? online.waitingOn.map((id) => game.players[id].name).join(' and ') : aiResponder !== null ? game.players[aiResponder].name : undefined;
  // A battle nobody here can change stays up until OK (or a click beside it), so the player can
  // see how it went: online, it moves on once decided; here, OK resolves it. Online, other players'
  // battles move on by themselves (playback), as do the battles of a game with no humans.
  const ok = online
    ? !online.mustAnswer && !waitingNames
      ? close(online.dismiss)
      : undefined
    : autoResolve && game.players.some((p) => !p.ai)
      ? close(() => dispatch({ type: 'resolveCombat' }))
      : undefined;
  const ready = revealed && aiResponder === null;
  // Enter or Escape is OK too; not held down (it would carry on into the next choice), nor on a
  // focused button (Enter presses that already).
  useShortcut(
    (e) => ready && !!ok && !e.repeat && (e.key === 'Enter' || e.key === 'Escape') && (e.target as HTMLElement | null)?.tagName !== 'BUTTON',
    (e) => {
      e.preventDefault();
      ok?.();
    },
  );
  const leader = out.attackerWins ? A : D;

  const side = (role: CombatRole) => {
    const s = combat[role];
    const p = game.players[s.player];
    const total = role === 'attacker' ? out.attacker : out.defender;
    const winning = revealed && (role === 'attacker') === out.attackerWins;
    // The dice show the ship and the roll; listed are only what else counts: a card that sets the
    // roll (not a missile: its die says so) and bonuses.
    const rollPart = total.parts.find((part) => part.kind === 'roll');
    const bonuses = total.parts.filter((part) => part.kind === 'modifier');
    const setBy = rollPart?.set && !s.missile && total.roll !== Math.min(...s.dice) ? rollPart.label : null;
    return (
      <div className={`combat-side ${role} ${winning ? 'winning' : ''}`} style={{ '--pc': p.color } as CSSProperties}>
        <div className="combat-who">
          <small>{role === 'attacker' ? 'Attacker' : 'Defender'}</small>
          <strong>{p.name}</strong>
        </div>
        <div className="combat-dice">
          <div className="combat-die-col">
            <Die3D value={s.ship} size={dieSize} color={p.color} sound={false} />
            <span>{SHIP_NAMES[s.ship]}</span>
          </div>
          <span className="combat-plus">+</span>
          <div className={`combat-die-col ${s.missile ? 'missiled' : ''}`}>
            <Die3D
              value={total.roll}
              size={dieSize}
              color={COMBAT_DICE[role].color}
              pip={COMBAT_DICE[role].pip}
              tumbleOnMount
              delay={role === 'attacker' ? 0 : 0.12}
              sound={role === 'attacker'}
            />
            <span>{s.missile ? 'Missile' : role === 'attacker' ? 'Attack die' : 'Defence die'}</span>
          </div>
        </div>
        <ul className={`combat-parts ${revealed ? 'show' : ''}`}>
          {setBy && (
            <li>
              <span>{setBy}</span>
              <b>roll {total.roll}</b>
            </li>
          )}
          {bonuses.map((part, i) => (
            <li key={i}>
              <span>{part.label}</span>
              <b>{part.value > 0 ? `+${part.value}` : `−${-part.value}`}</b>
            </li>
          ))}
          {s.dice.length > 1 && !rollPart?.set && <li className="muted">Brutal: rolled {s.dice.join(' & ')}</li>}
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
    <div className="overlay combat-overlay" onClick={(e) => ready && e.target === e.currentTarget && ok?.()}>
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
          {online?.mustAnswer ? (
            <button className="btn btn-primary" disabled={!revealed} onClick={close(online.pass)}>
              {humans.some((p) => canRespondToCombat(game, combat, p.id)) ? 'Done — no response' : 'Continue'}
            </button>
          ) : waitingNames ? (
            <p className="combat-waiting">
              <span className="spinner" /> Waiting for {waitingNames}…
            </p>
          ) : ok ? (
            <button className="btn btn-primary" disabled={!ready} onClick={ok}>
              OK
            </button>
          ) : online || autoResolve ? (
            // The battle moves on by itself shortly; restarts when a missile changes it.
            <div className="autobar" key={`${combat.id}-${+combat.attacker.missile}-${+combat.defender.missile}`}>
              <span style={{ animationDuration: `${online ? COMBAT_MS : COMBAT_RESOLVE_MS}ms` }} />
            </div>
          ) : (
            <button className="btn btn-primary" disabled={!ready} onClick={close(() => dispatch({ type: 'resolveCombat' }))}>
              Resolve battle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Closes the battle with `f`, then swallows clicks for a moment: a double click would otherwise
 * land on whatever is under the battle (a ship, a space, the next choice). Undefined stays so.
 */
function close(f: (() => void) | undefined): (() => void) | undefined {
  if (!f) return undefined;
  return () => {
    const stop = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('click', stop, true);
    window.setTimeout(() => window.removeEventListener('click', stop, true), 400);
    f();
  };
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
        <MissileIcon /> {named ? `${shooter.name}: ` : ''}
        {fighting ? 'Fire missile — your roll becomes 1' : `Help ${game.players[side.player].name} — roll becomes 1`}
      </span>
      <small>{verdict}</small>
    </button>
  );
}
