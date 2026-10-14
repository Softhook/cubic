import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { card, type GameState } from '@quantum/engine';
import { reducedMotion } from '../game/useMediaQuery';
import { lastLogId, useTransient } from '../game/useTransient';
import { CardArt } from './CardViewer';

interface Flight {
  key: string;
  card: string;
  /** The card's top-left corner and width as it sets off. */
  x: number;
  y: number;
  w: number;
  dx: number;
  dy: number;
  color: string;
}

const FLIGHT_MS = 480;
/** No wider than a market card, though a phone's list of them is a row each. */
const MAX_WIDTH = 120;
const CARD_RATIO = 88.9 / 63.5;

/** A face-up card's place in the market (a card when open, a chip when collapsed), found by its title. */
function marketSpot(id: string): DOMRect | undefined {
  const def = card(id);
  const title = `${def.name} — ${def.text}`;
  const el = [...document.querySelectorAll<HTMLElement>('#market-cards .market-card, #market-cards .market-chip')].find(
    (e) => e.title === title,
  );
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 ? r : undefined;
}

/** Where a player's cards go: their row in the players, or else the turn panel (a phone's closed sheet). */
function playerSpot(player: number): DOMRect | undefined {
  for (const el of [document.querySelector(`.player[data-player="${player}"]`), document.querySelector('.turn-panel')]) {
    const r = el?.getBoundingClientRect();
    if (r && r.width > 0 && r.bottom > 0 && r.top < innerHeight) return r;
  }
}

/**
 * A card taken from the market flies from its place there to whoever took it, its art shrinking as it
 * goes. Where the cards were is measured while rendering the new market, before the taken one has gone.
 * None under reduced motion, while not `live` (looking back at the game), or for cards that leave otherwise
 * (a market refresh).
 */
export function useCardFlights(game: GameState, live: boolean) {
  const [was, setWas] = useState(game);
  const [leaving, setLeaving] = useState<{ card: string; player: number; from: DOMRect; key: string }[]>([]);
  const [flights, show] = useTransient<Flight>(FLIGHT_MS);
  if (game !== was) {
    setWas(game);
    const before = lastLogId(was);
    const rows = [...was.market.skillRow, ...was.market.tacticRow];
    // Taken, or played straight from the market (a Tactic): one flight a card.
    const moved = game.log.filter(
      (e) => e.id > before && (e.event === 'cardTaken' || e.event === 'cardPlayed') && e.player !== undefined && rows.includes(e.card!),
    );
    const taken = moved.filter((e, i) => moved.findIndex((x) => x.card === e.card) === i);
    if (live && taken.length && !reducedMotion())
      setLeaving(
        taken.flatMap((e) => {
          const from = marketSpot(e.card!);
          return from ? [{ card: e.card!, player: e.player!, from, key: `${e.id}` }] : [];
        }),
      );
  }

  // Once the new screen is laid out, aim each card at its player.
  useLayoutEffect(() => {
    if (!leaving.length) return;
    const fresh = leaving.flatMap((l): Flight[] => {
      const to = playerSpot(l.player);
      if (!to) return [];
      // Centred on where the card was, then on the player.
      const w = Math.min(l.from.width, MAX_WIDTH);
      const cx = l.from.left + l.from.width / 2;
      const cy = l.from.top + l.from.height / 2;
      const x = cx - w / 2;
      const y = cy - (w * CARD_RATIO) / 2;
      const dx = to.left + to.width / 2 - cx;
      const dy = to.top + to.height / 2 - cy;
      return [{ key: l.key, card: l.card, x, y, w, dx, dy, color: game.players[l.player].color }];
    });
    setLeaving([]);
    show(fresh);
  }, [leaving, game, show]);

  if (!flights.length) return null;
  return createPortal(
    flights.map((f) => (
      <div
        key={f.key}
        className="card-flight"
        aria-hidden
        style={
          {
            left: f.x,
            top: f.y,
            width: f.w,
            '--dx': `${f.dx}px`,
            '--dy': `${f.dy}px`,
            '--pc': f.color,
          } as CSSProperties
        }
      >
        <CardArt id={f.card} size="md" />
      </div>
    )),
    document.body,
  );
}
