import { SHIP_ABILITIES, SHIP_NAMES, scrapyard, type Die, type GameState, type PlayerState } from '@quantum/engine';
import type { Controller } from '../game/controller';
import type { Dispatch } from '../game/useGame';
import { Die3D } from './Die3D';
import { Tip } from './InfoPop';

/** The ships `player` has re-rolled while unveiling (Unveil tactic) on this device, or null when not unveiling. */
function unveilingOf(game: GameState, player: number, ctl: Controller): string[] | null {
  const head = game.pending[0];
  return head?.kind === 'unveil' && head.player === player && ctl.human ? head.rerolled : null;
}

/** Whether `p` can deploy from their scrapyard on this device now: in their action phase, unveiling, or placing their starting ships. */
export function canDeployFrom(game: GameState, p: PlayerState, ctl: Controller): boolean {
  const head = game.pending[0];
  const placingStart = head?.kind === 'placeShips' && head.player === p.id && ctl.human;
  return (ctl.actionPhase && game.turn.player === p.id) || !!unveilingOf(game, p.id, ctl) || placingStart;
}

/**
 * Whose scrapyard the turn panel shows: whoever can deploy on this device now, else whoever the table
 * waits for in setup, else the turn's player. Their player row leaves it out.
 */
export function turnScrapOwner(game: GameState, ctl: Controller): PlayerState {
  const deployer = game.players.find((q) => canDeployFrom(game, q, ctl));
  if (deployer) return deployer;
  const head = game.pending[0];
  return game.players[game.phase === 'setup' && head && head.kind !== 'combat' ? head.player : game.turn.player];
}

/** A player's scrapyard: their ships off the board, which they tap to deploy when they can. */
export function Scrapyard({ game, p, ctl, dispatch }: { game: GameState; p: PlayerState; ctl: Controller; dispatch: Dispatch }) {
  const scrap = scrapyard(game, p.id);
  if (!scrap.length) return null;
  const unveiling = unveilingOf(game, p.id, ctl);
  const canDeploy = canDeployFrom(game, p, ctl);
  const clickScrap = (d: Die) => {
    ctl.select(ctl.sel.kind === 'scrap' && ctl.sel.die === d.id ? { kind: 'none' } : { kind: 'scrap', die: d.id });
  };
  return (
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
  );
}
