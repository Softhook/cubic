import { useState, type CSSProperties } from 'react';
import { card, rulesOf, type GameState, type PlayerState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import type { Dispatch } from '../game/useGame';
import { CategoryIcon, MissileIcon, categoryStyle } from './Card';
import { CardViewer } from './CardViewer';
import { Tip } from './InfoPop';
import { Scrapyard, turnScrapOwner } from './Scrapyard';

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
  const inTurnPanel = turnScrapOwner(game, ctl).id;
  return (
    <section className="panel players">
      {game.players.map((p) => (
        <PlayerCard key={p.id} game={game} p={p} ctl={ctl} dispatch={dispatch} showScrap={p.id !== inTurnPanel} />
      ))}
    </section>
  );
}

function PlayerCard({ game, p, ctl, dispatch, showScrap }: { game: GameState; p: PlayerState; ctl: Controller; dispatch: Dispatch; showScrap: boolean }) {
  const active = game.phase === 'play' && game.turn.player === p.id;
  const rules = rulesOf(game);
  const placed = game.board.planets.reduce((a, pl) => a + pl.cubes.filter((x) => x === p.id).length, 0);
  const totalCubes = p.cubesLeft + placed;
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <div className={`player ${active ? 'active' : ''}`} style={{ '--pc': p.color } as CSSProperties}>
      <div className="player-head">
        <strong>{p.name}</strong>
        {p.ai && <span className="tag">AI</span>}
        <Tip className="cubes" tip={`${placed} of ${totalCubes} cubes placed`}>
          <small>Cubes {placed}/{totalCubes}</small>
          {Array.from({ length: totalCubes }, (_, i) => (
            <span key={i} className={i < placed ? 'placed' : ''} />
          ))}
        </Tip>
      </div>
      <div className="player-tracks">
        <Track label="Dominance" value={p.dominance} tone="dom" />
        {rules.cards && <Track label="Research" value={p.research} tone="res" />}
      </div>
      <div className="player-row">
        {rules.startingMissiles > 0 && <Tip className="stat" tip="Missiles: set any combat roll to 1"><MissileIcon size={14} /> {p.missiles}</Tip>}
        {p.planAhead > 0 && <Tip className="stat gold" tip="Plan Ahead: all your combat rolls are 1">Plan Ahead</Tip>}
        {p.actionPenalty > 0 && <Tip className="stat bad" tip="Sabotaged: fewer actions next turn">−{p.actionPenalty} action</Tip>}
        {p.ambitionTokens > 0 && <Tip className="stat" tip="Ambition tokens">Ambition {p.ambitionTokens}/3</Tip>}
      </div>
      {/* The turn panel shows one player's scrapyard (see turnScrapOwner); the others' are here. */}
      {showScrap && (
        <div className="player-scrap">
          <Scrapyard game={game} p={p} ctl={ctl} dispatch={dispatch} />
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
              : `${p.name}’s ${rules.cards?.terms.skill ?? 'skill'}${p.skills.some((s) => s.id === viewing && !s.active) ? ' — takes effect from the next player’s turn' : ''}`
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
