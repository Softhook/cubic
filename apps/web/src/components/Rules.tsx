import { useEffect } from 'react';
import { SHIP_ABILITIES, SHIP_NAMES } from '@quantum/engine';
import { Die3D } from './Die3D';

export function Rules({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide rules" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Close">×</button>
        <h2>How to play</h2>
        <p className="modal-sub">
          Win by placing all your quantum cubes. Each die is a starship: its number is how far it moves and how strong it
          fights — <b>lower is stronger</b>.
        </p>

        <div className="rules-grid">
          <section>
            <h3>Your turn</h3>
            <p>Take up to <b>3 actions</b>, in any order, repeating as you like:</p>
            <ul>
              <li><b>Move / Attack</b> — move a ship up to its number in straight steps (no diagonals, not through planets or ships). To attack, use your last step to move into an enemy’s space. Each ship moves once per turn.</li>
              <li><b>Conquer</b> (2 actions) — if your ships orbiting a planet add up <i>exactly</i> to its number, place a cube there. The planet glows when you can.</li>
              <li><b>Deploy</b> — bring a ship from your scrapyard into orbit of a planet where you have a cube.</li>
              <li><b>Reconfigure</b> — re-roll a ship on the map or in your scrapyard to a new number.</li>
              <li><b>Research</b> — +1 research. Reaching 6 earns a card.</li>
            </ul>
            <p>Then take <b>one card per planet conquered</b>, plus one for a research breakthrough.</p>
            <p><b>Undo</b> (Ctrl/⌘+Z) takes back a misclick — moves, deploys, conquests, research. Anything involving dice or cards is final.</p>
          </section>

          <section>
            <h3>Combat</h3>
            <p>Both players roll a die and add their ship’s number. <b>Lower total wins</b>; the attacker wins ties.</p>
            <ul>
              <li>Winner: +1 dominance. Loser’s ship goes to their scrapyard (re-rolled). Loser: −1 dominance.</li>
              <li>A failed attacker just bounces back — no penalty.</li>
              <li><b>Missiles</b> 🚀 — anyone may spend one to turn any combat roll into a 1.</li>
              <li><b>Infamy</b> — reach 6 dominance to seize any planet you are not on yet.</li>
            </ul>
            <h3>Cards</h3>
            <ul>
              <li><b>Skills</b> are permanent (max 3) and start working from the next player’s turn.</li>
              <li><b>Tactics</b> happen immediately.</li>
              <li><b>Expansion</b> adds a sixth or seventh ship to your fleet.</li>
              <li>Taking the oldest card (farthest from the deck) lets you <b>peek</b> at the top card instead.</li>
            </ul>
          </section>
        </div>

        <h3>Modes</h3>
        <ul>
          <li><b>Basic</b> — the official rules without cards (so no research or missiles). The best way to learn ships, combat and conquering.</li>
          <li><b>Original</b> — the 2013 rules: Command cards (permanent) and Gambit cards (one-shot, including Expansion).</li>
          <li><b>Community</b> — the fan Community Edition: rebalanced Skills and Tactics, missiles, a starting skill, a separate Expansion pile and card peeking.</li>
        </ul>

        <h3>Ships</h3>
        <div className="ship-table">
          {[1, 2, 3, 4, 5, 6].map((v) => (
            <div key={v} className="ship-row">
              <Die3D value={v} size={30} color="#7fb2ff" sound={false} />
              <div>
                <strong>{SHIP_NAMES[v]}</strong> <span className="muted">moves {v}</span>
                <p>{SHIP_ABILITIES[v].name}: {SHIP_ABILITIES[v].text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="muted small">
          This digital edition follows the Quantum Community Edition. Rulings on ambiguous rules are provisional — see
          docs/OPEN-QUESTIONS.md in the repository.
        </p>
      </div>
    </div>
  );
}
