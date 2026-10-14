import { actor, MAPS, RULESETS, type PlayerId } from '@quantum/engine';
import { unclaimedSeats, type Replay } from '@quantum/online';

/** How the game stands, for the lobby's list. */
export function summary(r: Replay, mySeats: PlayerId[]) {
  const s = r.steps.at(-1)!.state;
  const open = unclaimedSeats(r).length;
  const waitingOnMe = r.combat
    ? r.combat.waitingOn.some((id) => mySeats.includes(id) && !r.combat!.passed.includes(id))
    : mySeats.includes(actor(s));
  return {
    mode: RULESETS[r.config.mode]?.name,
    map: MAPS.find((m) => m.id === r.config.mapId)?.name,
    players: r.seats.map((x) => x.name),
    over: s.phase === 'over',
    myTurn: s.phase !== 'over' && waitingOnMe,
    status:
      s.phase === 'over'
        ? `${s.players[s.winner ?? 0].name} won`
        : open
          ? `Waiting for ${open} player${open > 1 ? 's' : ''} to join`
          : s.phase === 'setup'
            ? 'Setting up'
            : `Turn ${s.turn.number}`,
  };
}
