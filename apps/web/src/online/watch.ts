import { getPublicKey } from 'nostr-tools/pure';
import { updateGame, type OnlineGameEntry } from './games';
import { identity, openGameLog } from './storage';
import { RelayLink } from './relays';
import { summary, yourMoveSince } from './summary';
import { alertYourMove } from './alerts';

/** How long a burst of relay events is gathered before the game is replayed. */
const BATCH_MS = 200;
/** How long a game counts as being checked when no relay answers (offline, say). */
const CHECK_TIMEOUT_MS = 15000;

/**
 * Follows the given games on the relays while the lobby shows them, so their entries (whose move it
 * is, above all) keep up with moves made since this browser last had them open. Each game asks only
 * for events from about when its saved events were last whole (`syncedAt`). `onChange` runs after
 * an entry changes; `onChecked` once per game, when a relay has sent all it holds of it (or none has
 * answered in time). Nothing is sent or saved: the game does that when it opens (re-sending this
 * browser's moves no relay took), and a tab playing the game meanwhile would otherwise have its newer
 * events overwritten. Returns a stop.
 */
export function watchGames(games: OnlineGameEntry[], onChange: () => void, onChecked: (secret: string) => void): () => void {
  const me = getPublicKey(identity());
  const stops = games.map(({ secret, syncedAt }) => {
    // Whether it was the player's move when last replayed; what the first check finds isn't alerted
    // (the list shows it), only moves made while the lobby is open.
    let was: boolean | null = null;
    const { keys, timeline, receive, load } = openGameLog(secret);
    let since = syncedAt;
    try {
      load();
    } catch (e) {
      // Damaged saved events: the relays still have the whole game.
      console.warn('[quantum] could not load a saved online game', e);
      since = undefined;
    }
    let timer: number | undefined;
    let checked = false;
    const refresh = () => {
      timer = undefined;
      const r = timeline.replay();
      if (!r) return;
      const mine = r.seats.filter((s) => s.owner === me).map((s) => s.id);
      const now = summary(r, mine);
      const { turn } = yourMoveSince(r, mine, me, checked ? was : null);
      was = now.myTurn;
      if (!updateGame(secret, now)) return;
      onChange();
      if (turn) alertYourMove({ secret, turn, where: 'lobby', battle: !!r.combat });
    };
    const check = () => {
      if (checked) return;
      window.clearTimeout(timeout);
      // What the relay sent shows with the spinner gone, not a moment after, and isn't alerted; and
      // what it found is what the next move is alerted against.
      window.clearTimeout(timer);
      refresh();
      checked = true;
      onChecked(secret);
    };
    const timeout = window.setTimeout(check, CHECK_TIMEOUT_MS);
    const link = new RelayLink(
      keys.tag,
      () => [],
      (e) => receive(e) && timer === undefined && (timer = window.setTimeout(refresh, BATCH_MS)),
      () => {},
      check,
      since,
    );
    link.start();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      link.close();
    };
  });
  return () => stops.forEach((stop) => stop());
}
