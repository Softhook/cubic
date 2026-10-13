/**
 * Checks, in Chrome, the screens a unit test can't render: choosing how to conquer a planet, and the
 * crash screen (components/ErrorBoundary.tsx). Exits with 1 when one of them doesn't work.
 *
 *   npm run ui:check                         # starts its own dev server
 *   npm run ui:check -- --url http://…/      # or checks a running dev server
 *
 * Positions are loaded through the dev-only `window.__quantum.load`, so the app must be a dev server.
 * Screenshots go to test-results/ui/.
 */
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { legalActions, orbitals, type GameState } from '../packages/engine/src';
import { arrange, quickStart } from '../packages/engine/test/helpers';
import { devServer, finish, launchChrome, playUrl } from './mobile-common';

const OUT = 'test-results/ui';
mkdirSync(OUT, { recursive: true });

/** The dev-only hook a local game puts on window (useGame.ts). */
type Quantum = { load(s: unknown): void; state(): GameState };
const load = (page: Page, state: unknown) => page.evaluate((st) => (window as unknown as { __quantum: Quantum }).__quantum.load(st), state);
const cubesOn = (page: Page, planet: number) =>
  page.evaluate((id) => (window as unknown as { __quantum: Quantum }).__quantum.state().board.planets[id].cubes, planet);

/** A Prototyping position where the player to move can conquer a full planet by displacing either opponent's cube. */
function overConquest() {
  let s: GameState = quickStart(3, 1, 'prototyping');
  const me = s.turn.player;
  const planet = s.board.planets.find((p) => !p.cubes.length && p.capacity >= 2)!;
  const [a, b] = orbitals(s.board, planet);
  s = arrange(s, { [`p${me}d0`]: [a.r, a.c, 6], [`p${me}d1`]: [b.r, b.c, 6] });
  const others = [0, 1, 2].filter((p) => p !== me);
  const target = s.board.planets[planet.id];
  for (let i = 0; i < target.capacity; i++) {
    target.cubes.push(others[i % 2]);
    s.players[others[i % 2]].cubesLeft--;
  }
  s.players.forEach((p) => (p.ai = false));
  s.turn.actionsLeft = 3;
  return { s, planet: target, me, victim: others[1] };
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
  await page.goto(playUrl(base, { play: 'prototyping', players: 3 }));
  await page.waitForFunction(() => (window as unknown as { __quantum?: unknown }).__quantum);

  // Over-conquest with two opponents' cubes: the player chooses whose to displace.
  const { s, planet, me, victim } = overConquest();
  if (legalActions(s).filter((x) => x.type === 'conquer' && x.planet === planet.id).length !== 2) fail('the position does not offer two over-conquests');
  await load(page, s);
  await page.click(`.planet-hit[data-r="${planet.r}"][data-c="${planet.c}"]`);
  const dialog = page.getByRole('dialog', { name: `Conquer planet ${planet.number}` });
  await dialog.waitFor({ timeout: 5000 }).catch(() => fail('tapping the planet opens no "Conquer planet" dialog'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/conquer-choice.png` });
  const name = s.players[victim].name;
  await dialog.getByRole('button', { name: `Displace ${name}’s cube` }).click({ timeout: 5000 }).catch(() => fail(`no "Displace ${name}’s cube" button`));
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => fail('the dialog stays open after choosing'));
  const after = await cubesOn(page, planet.id);
  const count = (cubes: number[], p: number) => cubes.filter((c) => c === p).length;
  if (count(after, victim) !== count(planet.cubes, victim) - 1 || count(after, me) !== 1) {
    fail(`displacing ${name}: the planet's cubes went from ${JSON.stringify(planet.cubes)} to ${JSON.stringify(after)}`);
  } else console.log(`✓ over-conquest: chose ${name}'s cube, and it was displaced`);

  // A position the screen can't draw: the crash screen, not a blank page, and a way back to the lobby.
  await load(page, { ...s, dice: null }).catch(() => {});
  const crash = page.locator('.crash');
  if (await crash.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
    await page.screenshot({ path: `${OUT}/crash.png` });
    console.log('✓ crash screen shown');
    await page.getByRole('button', { name: 'Back to the lobby' }).click();
    await page.locator('.lobby').waitFor({ timeout: 10000 }).then(
      () => console.log('✓ "Back to the lobby" reaches the lobby'),
      () => fail('"Back to the lobby" does not reach the lobby'),
    );
  } else fail('a state that cannot be drawn leaves no crash screen');
} finally {
  await browser.close();
  await close();
}
finish(OUT, problems);
