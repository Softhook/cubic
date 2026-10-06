import { useState, type CSSProperties } from 'react';
import { SHIP_ABILITIES, SHIP_NAMES, card, rulesOf, scrapyard, type Die, type GameState, type PlayerState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import type { Dispatch } from '../game/useGame';
import { CategoryIcon, categoryStyle } from './Card';
import { CardViewer } from './CardViewer';
import { Die3D } from './Die3D';
import { Tip } from './InfoPop';

function Track({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Tip as="div" className={`track track-${tone}`} tip={`${label}: ${value} of 6`}>
      <span className="track-label">{label}</span>
      <div className="track-cells">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span key={n} className={n <= value ? 'on' : ''} />
        ))}
      </div>
    </Tip>
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
  const totalCubes = p.cubesLeft + game.board.planets.reduce((a, pl) => a + pl.cubes.filter((x) => x === p.id).length, 0);
  const head = game.pending[0];
  const placingStart = head?.kind === 'placeShips' && head.player === p.id && ctl.human;
  const [viewing, setViewing] = useState<string | null>(null);
  const canDeploy = (ctl.actionPhase && game.turn.player === p.id) || !!unveiling || placingStart;

  const clickScrap = (d: Die) => {
    ctl.select(ctl.sel.kind === 'scrap' && ctl.sel.die === d.id ? { kind: 'none' } : { kind: 'scrap', die: d.id });
  };

  return (
    <div className={`player ${active ? 'active' : ''}`} style={{ '--pc': p.color } as CSSProperties}>
      <div className="player-head">
        <span className="player-swatch" />
        <strong>{p.name}</strong>
        {p.ai && <span className="tag">AI</span>}
        <Tip className="cubes" tip={`${totalCubes - p.cubesLeft} of ${totalCubes} cubes placed`}>
          {Array.from({ length: totalCubes }, (_, i) => (
            <span key={i} className={i < totalCubes - p.cubesLeft ? 'placed' : ''} />
          ))}
        </Tip>
      </div>
      <div className="player-tracks">
        <Track label="Dominance" value={p.dominance} tone="dom" />
        {rulesOf(game).cards && <Track label="Research" value={p.research} tone="res" />}
      </div>
      <div className="player-row">
        {rulesOf(game).startingMissiles > 0 && <Tip className="stat" tip="Missiles: set any combat roll to 1">🚀 {p.missiles}</Tip>}
        {p.planAhead > 0 && <Tip className="stat gold" tip="Plan Ahead: all your combat rolls are 1">Plan Ahead</Tip>}
        {p.actionPenalty > 0 && <Tip className="stat bad" tip="Sabotaged: fewer actions next turn">−{p.actionPenalty} action</Tip>}
        {p.ambitionTokens > 0 && <Tip className="stat" tip="Ambition tokens">Ambition {p.ambitionTokens}/3</Tip>}
      </div>
      {scrap.length > 0 && (
        <div className="scrapyard">
          <span className="scrap-label">Scrapyard</span>
          {scrap.map((d) => (
            <span key={d.id} className="scrap-die-wrap">
              <Tip
                className={`scrap-die ${canDeploy ? 'clickable' : ''} ${ctl.sel.kind === 'scrap' && ctl.sel.die === d.id ? 'selected' : ''}`}
                onClick={() => canDeploy && (clickScrap(d), true)}
                tip={
                  <>
                    <b>
                      {SHIP_NAMES[d.value]} ({d.value})
                    </b>
                    <span>
                      {SHIP_ABILITIES[d.value].name}: {SHIP_ABILITIES[d.value].text}
                    </span>
                    <span className="muted">Waiting in the scrapyard to be deployed.</span>
                  </>
                }
              >
                <Die3D value={d.value} rolls={d.rolls} size={22} color={p.color} sound={false} />
              </Tip>
              {unveiling && !unveiling.includes(d.id) && (
                <button className="mini-btn" onClick={() => dispatch({ type: 'unveilReroll', die: d.id })}>re-roll</button>
              )}
            </span>
          ))}
        </div>
      )}
      {(p.skills.length > 0 || (p.storedTactics?.length ?? 0) > 0) && (
        <div className="skills">
          {p.skills.map((s, i) => {
            const def = card(s.id);
            const disabled = s.disabledUntil !== undefined;
            return (
              <button
                type="button"
                key={`${s.id}${i}`}
                onClick={() => setViewing(s.id)}
                className={`skill-chip ${s.active ? '' : 'pending'} ${disabled ? 'disabled-chip' : ''}`}
                style={categoryStyle(def.category, true)}
                title={`${def.name}: ${def.text}${disabled ? `\n(Disabled by ${game.players[s.disabledUntil!].name} until their next turn)` : s.active ? '' : '\n(Takes effect from the next player’s turn)'}`}
              >
                <CategoryIcon category={def.category} size={11} />
                {def.name}
              </button>
            );
          })}
          {p.storedTactics?.map((tId, i) => {
            const def = card(tId);
            const canPlay = ctl.legal.can('playStoredTactic', (a) => a.card === tId);
            return (
              <button
                type="button"
                key={`stored-${tId}${i}`}
                onClick={() => setViewing(tId)}
                className={`skill-chip stored-tactic ${canPlay ? 'playable' : ''}`}
                style={categoryStyle(def.category, true)}
                title={`${def.name} (Stored Tactic): ${def.text}${canPlay ? '\n(Click to view / play)' : ''}`}
              >
                <CategoryIcon category={def.category} size={11} />
                {def.name} [Tactic]
              </button>
            );
          })}
        </div>
      )}
      {viewing && (
        <CardViewer
          title={card(viewing).name}
          subtitle={
            p.storedTactics?.includes(viewing)
              ? `${p.name}’s stored tactic`
              : `${p.name}’s ${rulesOf(game).cards?.terms.skill ?? 'skill'}${p.skills.some((s) => s.id === viewing && !s.active) ? ' — takes effect from the next player’s turn' : ''}`
          }
          cards={[viewing]}
          single
          onClose={() => setViewing(null)}
          action={
            ctl.legal.can('playStoredTactic', (a) => a.card === viewing) ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  dispatch({ type: 'playStoredTactic', card: viewing });
                  setViewing(null);
                }}
              >
                Play Tactic
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
