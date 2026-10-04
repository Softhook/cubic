import { useRef } from 'react';
import { EXPANSION, ORIGINAL_COMMAND, ORIGINAL_GAMBIT, SKILLS, TACTICS, type CardDef } from '@quantum/engine';
import { download } from '../files';
import css from './rulebook.css?raw';

/**
 * The printable rulebook (#rulebook): the full rules for players, in our own words (docs/RULES.md is
 * the developer reference behind it). Card lists come from the game data, so they never drift.
 * "Save as PDF" prints the page; "Download HTML" saves it as one self-contained file.
 */

const SHIPS: [number, string, string, string][] = [
  [1, 'Battlestation', 'Free Attack', 'Attack an enemy ship in an adjacent space without using this ship’s move. A battlestation can attack twice in one turn this way.'],
  [2, 'Flagship', 'Carry & Move', 'As part of a Move, pick up one of your ships from a surrounding space, travel at least one space, then set the passenger down in any surrounding space. The flagship can’t attack on this move; the passenger can still move and attack normally.'],
  [3, 'Destroyer', 'Switch Places', 'Swap places with any of your other ships on the map.'],
  [4, 'Frigate', 'Change to 3 or 5', 'Turn the die into a Destroyer or an Interceptor.'],
  [5, 'Interceptor', 'Move Diagonally', 'As part of a Move, the interceptor may also move and attack diagonally.'],
  [6, 'Scout', 'Free Reconfigure', 'Re-roll this ship until it shows a new number, without spending an action.'],
];

function CardTable({ title, note, cards }: { title: string; note: string; cards: CardDef[] }) {
  return (
    <>
      <h3>{title}</h3>
      <p className="rb-note">{note}</p>
      <table className="rb-cards">
        <tbody>
          {cards.map((c) => (
            <tr key={c.id}>
              <th>
                {c.name}
                {c.count > 1 && <span className="rb-count"> ×{c.count}</span>}
                <small>{c.subtitle}</small>
              </th>
              <td>{c.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function Rulebook() {
  const page = useRef<HTMLElement>(null);

  const downloadHtml = () => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cubic — Rulebook</title><style>${css}</style></head><body class="rb-standalone">${page.current!.outerHTML}</body></html>`;
    download('cubic-rulebook.html', new Blob([html], { type: 'text/html' }));
  };

  return (
    <div className="rb-screen">
      <style>{css}</style>
      <div className="rb-toolbar">
        <a className="btn btn-ghost" href="#">← Back to game</a>
        <span className="rb-spacer" />
        <button className="btn" onClick={downloadHtml}>Download HTML</button>
        <button className="btn btn-primary" onClick={() => window.print()}>Save as PDF</button>
      </div>

      <article className="rb-page" ref={page}>
        <header className="rb-cover">
          <p className="rb-kicker">Rulebook</p>
          <h1>CUBIC</h1>
          <p className="rb-tagline">Every die is a starship. 2–4 players · about 60 minutes</p>
        </header>

        <section>
          <h2>The idea</h2>
          <p>
            You command a fleet of dice. A die’s number is its ship: it says how far the ship moves <b>and</b> how well it fights, and{' '}
            <b>lower is stronger</b>. A 6 is a fast, fragile Scout; a 1 is a slow, mighty Battlestation.
          </p>
          <p>
            <b>The first player to place all of their cubes on planets wins.</b> You place a cube by arranging ships around a planet so their numbers add
            up exactly to the planet’s number (<i>conquering</i>), or by destroying enough enemy ships to become infamous.
          </p>
          <p>
            These rules are the <b>Community</b> rules, the recommended way to play. <b>Basic</b> and <b>Original</b> change a few things; see{' '}
            <a href="#rb-modes">Rule sets</a>.
          </p>
        </section>

        <section>
          <h2>Components</h2>
          <ul className="rb-cols">
            <li>Map tiles: 3 × 3 spaces with a planet (7, 8, 9 or 10) in the centre, and a void tile</li>
            <li>7 dice per player in their colour</li>
            <li>2 combat dice (attack and defence)</li>
            <li>Cubes in each player’s colour (5 each; some maps use more or fewer)</li>
            <li>35 Skill cards (light), 18 Tactic cards (dark), 6 Expansion cards</li>
            <li>Missile tokens, 2 Warp Gate tokens, 3 Ambition tokens</li>
            <li>A player board each: Dominance and Research tracks, Skill slots, scrapyard</li>
          </ul>
        </section>

        <section>
          <h2>The map</h2>
          <p>Lay out the tiles edge to edge as the chosen map shows. Planets and ships block movement: nothing moves through them.</p>
          <dl className="rb-terms">
            <dt>Adjacent</dt>
            <dd>The 4 spaces next to a ship or planet, not diagonal.</dd>
            <dt>Orbital positions</dt>
            <dd>The 4 spaces adjacent to a planet. Ships there count for conquering it.</dd>
            <dt>Surrounding</dt>
            <dd>All 8 spaces around a ship or planet, diagonals included.</dd>
            <dt>Once per turn</dt>
            <dd>Once, on your own turn.</dd>
          </dl>
          <p>
            A planet’s number is both the total you need to conquer it and how many cubes it holds: <b>7 holds 1, 8 holds 2, 9 holds 3, 10 holds 4</b>.
            You can have only one cube on a planet. The <b>void tile</b> has no planet: at the start of your turn, gain 1 Research for each of your ships on
            it.
          </p>
        </section>

        <section>
          <h2>Ships</h2>
          <table className="rb-ships">
            <thead>
              <tr>
                <th />
                <th>Ship</th>
                <th>Ability (once per turn)</th>
              </tr>
            </thead>
            <tbody>
              {SHIPS.map(([v, name, ability, text]) => (
                <tr key={v}>
                  <td className="rb-die">{v}</td>
                  <td>
                    <b>{name}</b>
                    <br />
                    <small>moves {v}</small>
                  </td>
                  <td>
                    <b>{ability}.</b> {text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Each die may use <b>one ability per turn</b>, even if it changes type, and only while it is on the map during your turn. The Flagship’s and
            Interceptor’s abilities are part of a Move; the others cost no action.
          </p>
        </section>

        <section>
          <h2>Setup</h2>
          <ol>
            <li>Lay out the map. Put the Expansion cards face up as a pile: one more card than there are players.</li>
            <li>Shuffle the Skill and Tactic decks separately. Deal 3 cards face up in a row beside each deck.</li>
            <li>
              Each player takes a player board, 1 missile, 7 dice and the map’s number of cubes. Set a die to 1 on your Dominance track and one on your
              Research track. Put 2 dice aside as your <b>reserve</b>.
            </li>
            <li>Each player draws 2 Skills, keeps 1 and puts the other on the bottom of the deck.</li>
            <li>Roll your other 3 dice: these are your starting ships. You may re-roll once, but then you re-roll all 3.</li>
            <li>
              The player with the lowest total goes first (roll off ties). In turn order, each player puts a cube on a <b>starting planet</b> marked on the
              map. Then, in the same order, each player places their 3 ships in orbital positions around their starting planet.
            </li>
          </ol>
        </section>

        <section>
          <h2>Your turn</h2>
          <p>
            Play goes clockwise. On your turn, take <b>up to 3 actions</b>, in any order, repeating them as you like, then take any cards you have earned.
            Each ship may move once per turn.
          </p>
          <table className="rb-actions">
            <tbody>
              <tr>
                <th>Move / Attack</th>
                <td className="rb-cost">1</td>
                <td>
                  Move one ship up to its number of spaces, in straight steps (no diagonals). To attack, end the move by moving into an enemy ship’s space.
                </td>
              </tr>
              <tr>
                <th>Conquer</th>
                <td className="rb-cost">2</td>
                <td>
                  If the numbers of <b>your ships in a planet’s orbital positions add up exactly</b> to its number, and it has room and none of your cubes,
                  place a cube on it.
                </td>
              </tr>
              <tr>
                <th>Deploy</th>
                <td className="rb-cost">1</td>
                <td>Move a ship from your scrapyard, keeping its number, to an empty orbital position of a planet with one of your cubes.</td>
              </tr>
              <tr>
                <th>Reconfigure</th>
                <td className="rb-cost">1</td>
                <td>Re-roll one of your ships, on the map or in your scrapyard, until it shows a number it has not shown this turn.</td>
              </tr>
              <tr>
                <th>Research</th>
                <td className="rb-cost">1</td>
                <td>Gain 1 Research (up to 6).</td>
              </tr>
            </tbody>
          </table>
          <p>Ship abilities and card effects can still be used after your last action.</p>
        </section>

        <section>
          <h2>Combat</h2>
          <ol>
            <li>The attacker rolls the attack die and the defender rolls the defence die.</li>
            <li>
              Each adds their roll to their ship’s number. <b>The lower total wins; the attacker wins ties.</b>
            </li>
          </ol>
          <p>
            <b>If the attacker wins</b>, the defending ship is destroyed: its owner re-rolls it and puts it in their scrapyard. The attacker gains 1
            Dominance and the defender loses 1. The attacking ship then moves into the space or stays where it was.
          </p>
          <p>
            <b>If the defender wins</b>, the attacker goes back to the space it attacked from. Nothing else happens.
          </p>
          <p>
            <b>Missiles.</b> At any moment, any player may spend a missile to turn <i>any</i> player’s combat roll into a 1. Everyone starts with one; Black
            Market and Profiteering give more.
          </p>
          <p>
            <b>Infamy.</b> When your Dominance reaches 6, at once place a cube on any planet that has room and none of your cubes, then set your Dominance
            back to 1. If there is nowhere to place it, Dominance stays at 6.
          </p>
          <p>
            <b>Quantum Entanglement.</b> When every planet with room already has one of your cubes, you may conquer a planet that has your cubes, but
            the total needed rises by 3 for each of your cubes already on it. Infamy can then place a cube there too.
          </p>
        </section>

        <section>
          <h2>Cards</h2>
          <p>At the end of your turn, take <b>one card for each planet you conquered</b> this turn (Infamy included). If your Research is at 6, set it to 1 and take one more card.</p>
          <p>Take cards one at a time from the face-up rows. After each, slide the row away from its deck and deal a new card into the space next to the deck, so the card farthest away is always the oldest.</p>
          <ul>
            <li>
              <b>Skills</b> are permanent. A new Skill works from the next player’s turn. You can hold 3; if you take a fourth, discard one.
            </li>
            <li>
              <b>Tactics</b> happen as soon as you take them, then go to the discard pile.
            </li>
            <li>
              <b>Expansion</b>: roll a die from your reserve and put it in an orbital position of a planet with one of your cubes, or in your scrapyard.
            </li>
            <li>
              <b>Peek</b>: when you take the oldest Skill or Tactic, you may first look at the top card of that deck and take it instead.
            </li>
            <li>When a deck runs out, shuffle its discards to make a new one.</li>
          </ul>
          <p>
            Cards taken off your turn (Infamy on someone else’s turn) are taken after the active player’s. A bonus turn from Momentum is played at once;
            any cards still owed are taken at the end of it.
          </p>
        </section>

        <section>
          <h2>Winning</h2>
          <p className="rb-callout">You win the moment you place your last cube, whether by conquering, by Infamy or by a card.</p>
        </section>

        <section id="rb-modes">
          <h2>Rule sets</h2>
          <h3>Basic: learn the game</h3>
          <p>No cards, so no Research action and no missiles. Everything else is as above. Play this first to learn ships, combat and conquering.</p>
          <h3>Original: the 2013 rules</h3>
          <ul>
            <li>Command cards (permanent, like Skills) and Gambit cards (one-shot, like Tactics) replace the Community decks. Expansion is a Gambit card.</li>
            <li>No starting card, no missiles and no peeking.</li>
            <li>Reconfigure: re-roll once to any different number.</li>
            <li>Instead of taking a card, you may discard all six face-up cards and deal six new ones; you take one card fewer that turn.</li>
            <li>An Expansion card can’t be taken once both your reserve dice are in play.</li>
          </ul>
        </section>

        <section className="rb-reference">
          <h2>Card reference: Community</h2>
          <CardTable title="Skills" note="Light deck, one of each. Permanent; hold up to 3." cards={SKILLS} />
          <CardTable title="Tactics" note="Dark deck, two of each. Resolve at once, then discard." cards={TACTICS} />
          <CardTable title="Expansion" note="Face-up pile of players + 1 cards." cards={[EXPANSION]} />
        </section>

        <section className="rb-reference">
          <h2>Card reference: Original</h2>
          <CardTable title="Command" note="Permanent; hold up to 3." cards={ORIGINAL_COMMAND} />
          <CardTable title="Gambit" note="One-shot." cards={ORIGINAL_GAMBIT} />
        </section>

        <footer className="rb-credits">
          Cubic is a non-commercial reimagining of <i>Quantum</i> by Eric Zimmerman (FunForge, 2013) and its fan-made Community Edition. Quantum is a
          trademark of its owners; this rulebook is an independent text.
        </footer>
      </article>
    </div>
  );
}
