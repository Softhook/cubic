/**
 * Checks, in Chrome, the screens a unit test can't render: battles resolving or waiting for OK, and the
 * crash screen (components/ErrorBoundary.tsx). Exits with 1 when one of them doesn't work.
 *
 *   npm run ui:check                         # starts its own dev server
 *   npm run ui:check -- --url http://…/      # or checks a running dev server
 *
 * Positions are loaded through the dev-only `window.__game.load`, so the app must be a dev server.
 * Screenshots go to test-results/ui/.
 */
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { apply, type GameState } from '../packages/engine/src';
import { arrange, quickStart } from '../packages/engine/test/helpers';
import { devServer, finish, launchChrome, playUrl, succeeds } from './mobile-common';

const OUT = 'test-results/ui';
mkdirSync(OUT, { recursive: true });

const load = (page: Page, state: unknown) => page.evaluate((st) => window.__game.load(st as GameState), state);

/**
 * A Community battle in which player `attacker` (an AI) attacks `defender`. Player 0 is the only human.
 * Nobody has missiles, so nobody can respond and the battle only waits to be resolved.
 */
function battle(attacker: number, defender: number): GameState {
  let s: GameState = quickStart(3);
  s.players.forEach((p) => {
    p.ai = p.id !== 0;
    p.missiles = 0;
  });
  s.turn.player = attacker;
  s = arrange(s, { [`p${attacker}d0`]: [0, 0, 2], [`p${defender}d0`]: [0, 1, 5] });
  s = apply(s, { type: 'attack', die: `p${attacker}d0`, target: `p${defender}d0` });
  if (s.pending[0]?.kind !== 'combat') throw new Error('no battle');
  return s;
}

let problems = 0;
const fail = (what: string) => {
  problems++;
  console.log(`✗ ${what}`);
};

const { base, close } = await devServer(5197);
const browser = await launchChrome();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto(playUrl(base, { play: 'community', players: 3 }));
  await page.waitForFunction(() => '__game' in window);

  // Battles: one between two AIs resolves by itself while a human watches; a human's own waits for OK.
  const overlay = page.locator('.combat-overlay');
  const okButton = overlay.getByRole('button', { name: 'OK', exact: true });
  await load(page, battle(1, 2));
  await overlay.waitFor({ timeout: 5000 }).catch(() => fail('no battle on screen (AI against AI)'));
  if (await okButton.isVisible()) fail('a battle between two AIs asks the watching human for OK');
  if (await succeeds(overlay.waitFor({ state: 'detached', timeout: 8000 }))) console.log('✓ a battle between two AIs resolves by itself');
  else fail('a battle between two AIs stays on screen');
  await load(page, battle(1, 0));
  await okButton.waitFor({ timeout: 5000 }).catch(() => fail('a battle the human defends in has no OK'));
  await page.waitForTimeout(4000);
  if (!(await overlay.isVisible())) fail('a battle the human defends in resolved without OK');
  else {
    await okButton.click();
    await overlay.waitFor({ state: 'detached', timeout: 5000 }).catch(() => fail('OK leaves the battle on screen'));
    console.log('✓ a battle the human fights in waits for OK');
    // Closing a battle swallows clicks for a moment (CombatOverlay's close): let it pass.
    await page.waitForTimeout(500);
  }

  // A position the screen can't draw: the crash screen, not a blank page, and a way back to the lobby.
  await load(page, { ...quickStart(3, 1), dice: null }).catch(() => {});
  const crash = page.locator('.crash');
  if (await succeeds(crash.waitFor({ timeout: 5000 }))) {
    await page.screenshot({ path: `${OUT}/crash.png` });
    console.log('✓ crash screen shown');
    await page.getByRole('button', { name: 'Back to the lobby' }).click();
    await page
      .locator('.lobby')
      .waitFor({ timeout: 10000 })
      .then(
        () => console.log('✓ "Back to the lobby" reaches the lobby'),
        () => fail('"Back to the lobby" does not reach the lobby'),
      );
  } else fail('a state that cannot be drawn leaves no crash screen');
} finally {
  await browser.close();
  await close();
}
finish(OUT, problems);
