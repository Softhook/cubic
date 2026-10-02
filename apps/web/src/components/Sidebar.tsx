import { useEffect, useRef, type CSSProperties } from 'react';
import {
  SHIP_ABILITIES,
  SHIP_NAMES,
  canMoveDie,
  canReconfigure,
  canUseAbility,
  card,
  carryPassengers,
  freeAttackTargets,
  hasSkill,
  movementRange,
  reserve,
  scrapyard,
  skillCard,
  type Action,
  type Die,
  type GameState,
  type PlayerState,
} from '@quantum/engine';
import { hintFor, type Controller } from '../game/controller';
import { CategoryIcon } from './Card';
import { Die3D } from './Die3D';

type Dispatch = (a: Action) => boolean;

export function TurnPanel({ game, ctl, dispatch, undo }: { game: GameState; ctl: Controller; dispatch: Dispatch; undo?: () => void }) {
  const t = game.turn;
  const p = game.players[t.player];
  const head = game.pending[0];
  const me = t.player;
  const canAct = ctl.actionPhase;
  const hint = ctl.human ? hintFor(game, ctl.sel) : '';
  const waitingOn = head && head.kind !== 'combat' ? game.players[head.player] : null;

  return (
    <section className="panel turn-panel" style={{ '--pc': p.color } as CSSProperties}>
      <div className="turn-head">
        <span className="turn-dot" />
        <div className="turn-title">
          <small>{game.phase === 'setup' ? 'Setup' : t.bonus ? 'Bonus turn' : `Turn ${t.number}`}</small>
          <strong>{game.phase === 'setup' && waitingOn ? waitingOn.name : p.name}</strong>
        </div>
        {game.phase === 'play' && (
          <div className="action-pips" title={`${t.actionsLeft} action${t.actionsLeft === 1 ? '' : 's'} left`}>
            {Array.from({ length: Math.max(3, t.actionsLeft) }, (_, i) => (
              <span key={i} className={i < t.actionsLeft ? 'on' : ''} />
            ))}
            {t.freeDeploys > 0 && <em title="Free deploy (Industrious)">+1 deploy</em>}
            {t.freeMoves > 0 && <em title="Free move without attacking (Curious)">+1 move</em>}
          </div>
        )}
      </div>

      {(waitingOn?.ai || (!head && p.ai && game.phase === 'play')) && (
        <p className="hint thinking">
          <span className="spinner" /> {waitingOn?.name ?? p.name} is thinking…
        </p>
      )}
      {hint && <p className="hint">{hint}</p>}

      {game.phase === 'play' && !p.ai && (
        <div className="turn-actions">
          {game.mode !== 'basic' && (
            <button
              className="btn"
              disabled={!canAct || t.actionsLeft < 1 || p.research >= 6 || hasSkill(game, me, 'righteous')}
              onClick={() => dispatch({ type: 'research' })}
              title="+1 research. At 6 you gain a card at the end of your turn."
            >
              <CategoryIcon category="research" /> Research
            </button>
          )}
          <SkillButton game={game} effect="composed" disabled={!canAct || t.oncePerTurn.includes('composed')} onClick={() => dispatch({ type: 'composed' })} />
          <SkillButton
            game={game}
            effect="tyrannical-original"
            disabled={!canAct || t.oncePerTurn.includes('tyrannical') || p.research <= 1}
            onClick={() => dispatch({ type: 'tyrannical' })}
          />
          {hasSkill(game, me, 'ambitious') && (
            <button className="btn" disabled={!canAct || t.oncePerTurn.includes('ambitious')} onClick={() => dispatch({ type: 'ambitious' })} title={card('ambitious').text}>
              Ambitious +1
            </button>
          )}
          <button
            className="btn btn-ghost undo-btn"
            disabled={!canAct || !undo}
            onClick={() => {
              ctl.select({ kind: 'none' });
              undo?.();
            }}
            title="Take back your last move (Ctrl/⌘+Z). Dice rolls, battles and cards can’t be undone."
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
            Undo
          </button>
          <button
            className={`btn btn-primary ${canAct && t.actionsLeft === 0 ? 'pulse' : ''}`}
            disabled={!canAct}
            onClick={() => dispatch({ type: 'endTurn' })}
          >
            End turn
          </button>
        </div>
      )}

      {head?.kind === 'advance' && ctl.human && (
        <div className="turn-actions">
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'advance', move: true })}>Advance</button>
          <button className="btn" onClick={() => dispatch({ type: 'advance', move: false })}>Hold position</button>
        </div>
      )}
      {head?.kind === 'placeExpansion' && ctl.human && (
        <div className="turn-actions">
          <button className="btn" onClick={() => dispatch({ type: 'placeExpansion', to: null })}>Send to scrapyard</button>
        </div>
      )}
      {head?.kind === 'unveil' && ctl.human && (
        <div className="turn-actions">
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'unveilDone' })}>Done</button>
        </div>
      )}

      <ShipPanel game={game} ctl={ctl} dispatch={dispatch} />
    </section>
  );
}

function SkillButton({ game, effect, disabled, onClick }: { game: GameState; effect: string; disabled: boolean; onClick: () => void }) {
  const id = skillCard(game, game.turn.player, effect);
  if (!id) return null;
  const def = card(id);
  return (
    <button className="btn" disabled={disabled} onClick={onClick} title={def.text}>
      {def.name}
    </button>
  );
}

function ShipPanel({ game, ctl, dispatch }: { game: GameState; ctl: Controller; dispatch: Dispatch }) {
  const sel = ctl.sel;
  if (sel.kind === 'none' || !ctl.actionPhase) return null;
  const d = game.dice.find((x) => x.id === sel.die);
  if (!d) return null;
  const t = game.turn;
  const me = t.player;
  const onBoard = d.loc.zone === 'board';
  const used = !canUseAbility(game, d);
  const secondUse = !used && !!t.abilityUsed[d.id];
  const seen = t.seen[d.id]?.length ?? 1;
  const tacticalId = skillCard(game, me, 'tactical') ?? skillCard(game, me, 'tactical-original');
  const tacticalReady =
    !!tacticalId &&
    onBoard &&
    !t.oncePerTurn.includes('tactical') &&
    (hasSkill(game, me, 'tactical') || canMoveDie(game, d));
  const ability = SHIP_ABILITIES[d.value];
  const cancel = () => ctl.select({ kind: 'none' });

  const abilityButton = () => {
    if (!onBoard || used) return null;
    switch (d.value) {
      case 1:
        return (
          <button className="btn" disabled={!freeAttackTargets(game, d.id).length} onClick={() => ctl.select({ kind: 'freeAttack', die: d.id })}>
            Free attack
          </button>
        );
      case 2:
        return (
          <button
            className="btn"
            disabled={t.actionsLeft < 1 || !canMoveDie(game, d) || !carryPassengers(game, d.id).length}
            onClick={() => ctl.select({ kind: 'carryPassenger', die: d.id })}
          >
            Carry &amp; move
          </button>
        );
      case 3:
        return <button className="btn" onClick={() => ctl.select({ kind: 'swap', die: d.id })}>Switch places</button>;
      case 4:
        return (
          <>
            <button className="btn" onClick={() => dispatch({ type: 'change', die: d.id, value: 3 })}>Become 3</button>
            <button className="btn" onClick={() => dispatch({ type: 'change', die: d.id, value: 5 })}>Become 5</button>
          </>
        );
      case 6:
        return <button className="btn" disabled={game.mode === 'community' && seen >= 6} onClick={() => dispatch({ type: 'freeReconfigure', die: d.id })}>Free re-roll</button>;
    }
    return null;
  };

  return (
    <div className="ship-panel">
      <div className="ship-panel-head">
        <Die3D value={d.value} rolls={d.rolls} size={34} color={game.players[d.owner].color} sound={false} />
        <div>
          <strong>{SHIP_NAMES[d.value]}</strong>
          <small>
            {onBoard ? `Moves ${movementRange(game, d)} · ${canMoveDie(game, d) ? 'ready' : 'already moved'}` : 'In scrapyard'}
          </small>
        </div>
        <button className="icon-btn" onClick={cancel} aria-label="Deselect">×</button>
      </div>
      <p className="ship-ability">
        <b>{ability.name}</b> {used ? '— used this turn' : `— ${ability.text}`}
        {secondUse && <em className="muted"> (second use via Cunning)</em>}
      </p>
      <div className="turn-actions">
        {abilityButton()}
        <button className="btn" disabled={t.actionsLeft < 1 || !canReconfigure(game, d)} onClick={() => dispatch({ type: 'reconfigure', die: d.id })} title="Spend 1 action to re-roll this ship to a new number.">
          Reconfigure
        </button>
        {tacticalReady && (
          <button className="btn" onClick={() => ctl.select({ kind: 'tactical', die: d.id })} title={card(tacticalId).text}>
            Tactical step
          </button>
        )}
        {onBoard && hasSkill(game, me, 'flexible') && !t.oncePerTurn.includes('flexible') && (
          <>
            <button className="btn" disabled={d.value <= 1} onClick={() => dispatch({ type: 'flexible', die: d.id, delta: -1 })}>−1</button>
            <button className="btn" disabled={d.value >= 6} onClick={() => dispatch({ type: 'flexible', die: d.id, delta: 1 })}>+1</button>
          </>
        )}
        {onBoard && hasSkill(game, me, 'resourceful') && !t.oncePerTurn.includes('resourceful') && (
          <button className="btn" onClick={() => dispatch({ type: 'resourceful', die: d.id })} title={card('resourceful').text}>
            Sacrifice +1 action
          </button>
        )}
      </div>
    </div>
  );
}

function Track({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`track track-${tone}`} title={`${label}: ${value} of 6`}>
      <span className="track-label">{label}</span>
      <div className="track-cells">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span key={n} className={n <= value ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

export function PlayerList({ game, ctl, dispatch }: { game: GameState; ctl: Controller; dispatch: Dispatch }) {
  const head = game.pending[0];
  return (
    <section className="panel players">
      {game.players.map((p) => (
        <PlayerCard key={p.id} game={game} p={p} ctl={ctl} dispatch={dispatch} unveiling={head?.kind === 'unveil' && head.player === p.id && ctl.human ? head.rerolled : null} />
      ))}
    </section>
  );
}

function PlayerCard({
  game,
  p,
  ctl,
  dispatch,
  unveiling,
}: {
  game: GameState;
  p: PlayerState;
  ctl: Controller;
  dispatch: Dispatch;
  unveiling: string[] | null;
}) {
  const active = game.phase === 'play' && game.turn.player === p.id;
  const scrap = scrapyard(game, p.id);
  const res = reserve(game, p.id);
  const totalCubes = p.cubesLeft + game.board.planets.reduce((a, pl) => a + pl.cubes.filter((x) => x === p.id).length, 0);
  const canDeploy = (ctl.actionPhase && game.turn.player === p.id) || !!unveiling;

  const clickScrap = (d: Die) => {
    if (!canDeploy) return;
    ctl.select(ctl.sel.kind === 'scrap' && ctl.sel.die === d.id ? { kind: 'none' } : { kind: 'scrap', die: d.id });
  };

  return (
    <div className={`player ${active ? 'active' : ''}`} style={{ '--pc': p.color } as CSSProperties}>
      <div className="player-head">
        <span className="player-swatch" />
        <strong>{p.name}</strong>
        {p.ai && <span className="tag">AI</span>}
        <span className="cubes" title={`${totalCubes - p.cubesLeft} of ${totalCubes} cubes placed`}>
          {Array.from({ length: totalCubes }, (_, i) => (
            <span key={i} className={i < totalCubes - p.cubesLeft ? 'placed' : ''} />
          ))}
        </span>
      </div>
      <div className="player-tracks">
        <Track label="Dominance" value={p.dominance} tone="dom" />
        {game.mode !== 'basic' && <Track label="Research" value={p.research} tone="res" />}
      </div>
      <div className="player-row">
        {game.mode === 'community' && <span className="stat" title="Missiles: set any combat roll to 1">🚀 {p.missiles}</span>}
        {p.planAhead > 0 && <span className="stat gold" title="Plan Ahead: all your combat rolls are 1">Plan Ahead</span>}
        {p.actionPenalty > 0 && <span className="stat bad" title="Sabotaged: fewer actions next turn">−{p.actionPenalty} action</span>}
        {p.ambitionTokens > 0 && <span className="stat" title="Ambition tokens">Ambition {p.ambitionTokens}/3</span>}
        {game.mode !== 'basic' && <span className="stat muted" title="Reserve ships (brought in by Expansion cards)">Reserve {res.length}</span>}
      </div>
      {scrap.length > 0 && (
        <div className="scrapyard">
          <span className="scrap-label">Scrapyard</span>
          {scrap.map((d) => (
            <span key={d.id} className="scrap-die-wrap">
              <span className={`scrap-die ${canDeploy ? 'clickable' : ''} ${ctl.sel.kind === 'scrap' && ctl.sel.die === d.id ? 'selected' : ''}`} onClick={() => clickScrap(d)} title={`${SHIP_NAMES[d.value]} (${d.value}) — ${canDeploy ? 'click to deploy' : 'waiting to be deployed'}`}>
                <Die3D value={d.value} rolls={d.rolls} size={22} color={p.color} sound={false} />
              </span>
              {unveiling && !unveiling.includes(d.id) && (
                <button className="mini-btn" onClick={() => dispatch({ type: 'unveilReroll', die: d.id })}>re-roll</button>
              )}
            </span>
          ))}
        </div>
      )}
      {p.skills.length > 0 && (
        <div className="skills">
          {p.skills.map((s, i) => {
            const def = card(s.id);
            return (
              <span key={`${s.id}${i}`} className={`skill-chip cat-${def.category} ${s.active ? '' : 'pending'}`} title={`${def.name}: ${def.text}${s.active ? '' : '\n(Takes effect from the next player’s turn)'}`}>
                <CategoryIcon category={def.category ?? 'card'} size={11} />
                {def.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Log({ game }: { game: GameState }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [game.log.length, game.logCounter]);
  return (
    <section className="panel log">
      <h3>Captain’s log</h3>
      <ol ref={ref}>
        {game.log.slice(-40).map((e) => (
          <li key={e.id} style={{ '--pc': e.player !== undefined ? game.players[e.player].color : 'var(--muted)' } as CSSProperties}>
            {e.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
