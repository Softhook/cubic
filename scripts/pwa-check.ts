/**
 * Checks the home-screen app's offline play and updates on real production builds. See docs/MOBILE.md, Step 5.
 *
 *   npm run pwa:check
 *
 * Builds the app four times (versions v1–v4, told apart by BUILD_ID) into test-results/pwa/ and serves
 * one at a time under /quantum/, as GitHub Pages does (with its 10-minute HTTP cache). Then, in Chrome
 * sized as the Moto G55:
 *   1. a first visit installs the service worker, which has every file of the build;
 *   2. with the network gone (and the server down) the app opens and a game against the AI starts;
 *   3. v2 is deployed: back in the foreground the app finds it, but doesn't reload while you play;
 *   4. the app goes to the background: v2 takes over, and the game is back on screen;
 *   5. v3 is deployed: an app just opened switches to it at once;
 *   6. v4 is deployed: the lobby's *Check for updates* switches to it, then says *Up to date*.
 * Uses the installed Google Chrome, like mobile:shots. Exits with 1 if a check fails.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';
import { chromium, devices, type Page } from 'playwright';
import { build } from 'vite';

const OUT = resolve('test-results/pwa');
const VERSIONS = ['v1', 'v2', 'v3', 'v4'] as const;
type Version = (typeof VERSIONS)[number];
const PORT = 5190;
const BASE = `http://127.0.0.1:${PORT}/quantum/`;

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

let failures = 0;
function check(what: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${what}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

function filesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesOf(join(dir, e.name)) : [relative(join(OUT), join(dir, e.name)).split('/').slice(1).join('/')],
  );
}

/** Which version's page this is, by the script its index.html loads. */
const entryOf = (html: string) => html.match(/<script type="module"[^>]*src="\.?\/?([^"]+)"/)?.[1];
const ENTRIES = new Map<string, Version>();

async function buildAll() {
  process.env.NODE_ENV = 'production'; // vite-node sets development, which would make development builds
  for (const v of VERSIONS) {
    process.env.BUILD_ID = `pwa-check-${v}`;
    await build({ root: 'apps/web', logLevel: 'error', build: { outDir: join(OUT, v), emptyOutDir: true } });
    ENTRIES.set(entryOf(readFileSync(join(OUT, v, 'index.html'), 'utf8'))!, v);
  }
  delete process.env.BUILD_ID;
}

/** The deployed version; null: the server is down. */
let live: Version | null = 'v1';
const server = createServer((req, res) => {
  if (!live) return req.socket.destroy();
  const path = new URL(req.url!, BASE).pathname;
  if (!path.startsWith('/quantum/')) return res.writeHead(404).end();
  const file = join(OUT, live, path.slice('/quantum/'.length) || 'index.html');
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'max-age=600' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});

let openedAt = 0;
/** Navigations reset the app's "just opened" window (10 s, src/pwa.ts); wait it out so an update counts as later. */
async function pastOpening() {
  const left = openedAt + 11_000 - Date.now();
  if (left > 0) await new Promise((r) => setTimeout(r, left));
}

async function servedVersion(page: Page): Promise<Version | undefined> {
  const src = await page.evaluate(() => document.querySelector<HTMLScriptElement>('script[type=module]')?.src ?? '');
  return ENTRIES.get(new URL(src).pathname.replace('/quantum/', ''));
}

const versionLine = (page: Page) => page.locator('.version');
const onScreenGame = async (page: Page) => (await page.locator('.board').count()) > 0 && (await page.locator('.lobby').count()) === 0;

async function main() {
  await buildAll();
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
  const context = await browser.newContext({
    userAgent: devices['Pixel 7'].userAgent, viewport: { width: 412, height: 800 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
  });
  try {
    let page = await context.newPage();
    page.on('load', () => (openedAt = Date.now()));

    console.log('1. First visit');
    await page.goto(BASE);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}));
    await page.reload();
    check('the service worker controls the page after a reload', await page.evaluate(() => !!navigator.serviceWorker.controller));
    await versionLine(page).filter({ hasText: 'pwa-check-v1' }).waitFor({ timeout: 5000 });
    check('the lobby shows the version', true, (await versionLine(page).textContent())!.trim());
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname);
      return urls;
    });
    const missing = filesOf(join(OUT, 'v1')).filter((f) => !/^(sw\.js|workbox-.*\.js)$/.test(f) && !cached.includes(`/quantum/${f}`));
    check('every file of the build is cached for offline', missing.length === 0, missing.join(', ') || `${cached.length} files`);

    console.log('2. Offline');
    await context.setOffline(true);
    live = null;
    await page.reload();
    await versionLine(page).filter({ hasText: 'pwa-check-v1' }).waitFor({ timeout: 5000 });
    check('the app opens offline', true);
    await page.getByRole('button', { name: 'Launch fleet' }).click();
    await page.locator('.overlay button:not([disabled])', { hasText: 'Keep fleet' }).click({ timeout: 10_000 });
    await page.locator('.board').waitFor({ timeout: 5000 });
    check('a game against the AI starts offline', await onScreenGame(page));
    await context.setOffline(false);

    console.log('3. v2 deployed while you play');
    await pastOpening();
    live = 'v2';
    await page.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
    // Back in the foreground: the app looks for a new version.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const found = await page
      .waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting, null, { timeout: 20_000 })
      .then(() => true, () => false);
    check('returning to the app finds the new version', found);
    await page.waitForTimeout(2000);
    check('it does not reload while you play', await page.evaluate(() => (window as unknown as { kept?: boolean }).kept === true));

    console.log('4. The app goes to the background');
    const reloaded = page.waitForEvent('load', { timeout: 10_000 }).then(() => true, () => false);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    check('the new version takes over in the background', await reloaded);
    await page.locator('.board').waitFor({ timeout: 5000 }).catch(() => {});
    check('it runs v2', (await servedVersion(page)) === 'v2', await servedVersion(page));
    check('the game is back on screen, not the lobby', await onScreenGame(page));

    console.log('5. v3 deployed, the app opened afresh');
    await page.close();
    live = 'v3';
    page = await context.newPage();
    page.on('load', () => (openedAt = Date.now()));
    await page.goto(BASE);
    const fresh = await versionLine(page).filter({ hasText: 'pwa-check-v3' }).waitFor({ timeout: 15_000 }).then(() => true, () => false);
    check('an app just opened switches to the new version at once', fresh, (await versionLine(page).textContent())?.trim());

    console.log('6. v4 deployed, Check for updates');
    await pastOpening();
    live = 'v4';
    await versionLine(page).getByRole('button', { name: 'Check for updates' }).click();
    const manual = await versionLine(page).filter({ hasText: 'pwa-check-v4' }).waitFor({ timeout: 15_000 }).then(() => true, () => false);
    check('Check for updates switches to the new version', manual, (await versionLine(page).textContent())?.trim());
    await versionLine(page).getByRole('button', { name: 'Check for updates' }).click();
    const current = await versionLine(page).getByRole('button', { name: 'Up to date' }).waitFor({ timeout: 10_000 }).then(() => true, () => false);
    check('with nothing new it says Up to date', current);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
