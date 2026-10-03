import { useState, type CSSProperties } from 'react';
import { SHIP_NAMES, card, reserve, rulesOf, scrapyard, type Die, type GameState, type PlayerState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import type { Dispatch } from '../game/useGame';
import { CategoryIcon } from './Card';
import { CardViewer } from './CardViewer';
import { Die3D } from './Die3D';

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
  const head = game.pending[0];
  const placingStart = head?.kind === 'placeShips' && head.player === p.id && ctl.human;
  const [viewing, setViewing] = useState<string | null>(null);
  const canDeploy = (ctl.actionPhase && game.turn.player === p.id) || !!unveiling || placingStart;

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
        {rulesOf(game).cards && <Track label="Research" value={p.research} tone="res" />}
      </div>
      <div className="player-row">
        {rulesOf(game).startingMissiles > 0 && <span className="stat" title="Missiles: set any combat roll to 1">🚀 {p.missiles}</span>}
        {p.planAhead > 0 && <span className="stat gold" title="Plan Ahead: all your combat rolls are 1">Plan Ahead</span>}
        {p.actionPenalty > 0 && <span className="stat bad" title="Sabotaged: fewer actions next turn">−{p.actionPenalty} action</span>}
        {p.ambitionTokens > 0 && <span className="stat" title="Ambition tokens">Ambition {p.ambitionTokens}/3</span>}
        {rulesOf(game).cards && <span className="stat muted" title="Reserve ships (brought in by Expansion cards)">Reserve {res.length}</span>}
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
              <button type="button" key={`${s.id}${i}`} onClick={() => setViewing(s.id)} className={`skill-chip cat-${def.category} ${s.active ? '' : 'pending'}`} title={`${def.name}: ${def.text}${s.active ? '' : '\n(Takes effect from the next player’s turn)'}`}>
                <CategoryIcon category={def.category ?? 'card'} size={11} />
                {def.name}
              </button>
            );
          })}
        </div>
      )}
      {viewing && (
        <CardViewer
          title={card(viewing).name}
          subtitle={`${p.name}’s ${rulesOf(game).cards?.terms.skill ?? 'skill'}${p.skills.some((s) => s.id === viewing && !s.active) ? ' — takes effect from the next player’s turn' : ''}`}
          cards={[viewing]}
          single
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
