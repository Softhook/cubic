/**
 * Opens a game on phone and tablet screen sizes, saves a screenshot of each and checks the layout.
 * See docs/MOBILE.md.
 *
 *   npm run mobile:shots                         # starts its own dev server
 *   npm run mobile:shots -- --url https://…/     # or checks a running one (e.g. the Pages deploy)
 *   npm run mobile:shots -- --webkit             # WebKit instead of Chrome (npx playwright install webkit)
 *
 * Uses the installed Google Chrome, so Playwright needs no browser download. `--no-proxy-server`
 * skips Chrome's proxy auto-detection, which otherwise costs 12 s on every page. Games start from the
 * dev-only `?play=` link (apps/web/src/game/devStart.ts), so `--url` must be a dev server.
 * Screenshots go to test-results/mobile/ (the game, and each setup popup as `-popupN`). Exits with 1
 * when a layout is broken: the board wider or taller than its stage, a page wider than the screen
 * (the phone then zooms the page out), End turn off screen, or a setup popup whose buttons or cards are off screen
 * without scrolling.
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices, webkit, type BrowserContextOptions } from 'playwright';
import { createServer } from 'vite';

/** The user's Moto G55: 1080×2400 at a device pixel ratio of 2.625, minus Chrome's and Android's bars. */
const motoG55 = { userAgent: devices['Pixel 7'].userAgent, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };

const DEVICES: Record<string, BrowserContextOptions> = {
  'moto-g55': { ...motoG55, viewport: { width: 412, height: 800 } },
  'moto-g55-landscape': { ...motoG55, viewport: { width: 867, height: 340 } },
  'iphone-se': devices['iPhone SE'],
  'iphone-15': devices['iPhone 15'],
  'iphone-15-landscape': devices['iPhone 15 landscape'],
  'ipad-mini': devices['iPad Mini'],
  'ipad-mini-landscape': devices['iPad Mini landscape'],
};

/** A small, a wide (5 sectors across, irregular), a typical 4-player and the largest map, each under rules that offer it. */
const GAMES = [
  { play: 'basic', players: 2, map: 'alpha-sector' },
  { play: 'community', players: 2, map: 'asymptote' },
  { play: 'original', players: 4, map: 'tesseract' },
  { play: 'community', players: 4, map: 'event-horizon' },
];

const OUT = 'test-results/mobile';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};

async function main() {
  const server = arg('--url') ? null : await createServer({ root: 'apps/web', server: { port: 5180, host: '127.0.0.1' } });
  await server?.listen();
  const base = arg('--url') ?? server!.resolvedUrls!.local[0];
  const browser = process.argv.includes('--webkit') ? await webkit.launch() : await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
  mkdirSync(OUT, { recursive: true });

  const problems: string[] = [];
  try {
    for (const [device, options] of Object.entries(DEVICES)) {
      for (const g of GAMES) {
        const ctx = await browser.newContext({ ...options, ignoreHTTPSErrors: true }); // dev:https is self-signed
        const page = await ctx.newPage();
        await page.goto(`${base}?play=${g.play}&players=${g.players}&map=${g.map}&seed=1`);
        await page.waitForSelector('.board');
        const name = `${device}-${g.map}`;
        const screen = options.viewport!;
        const issues: string[] = [];

        // Setup popups (fleet roll, starting skill): screenshot and check each, then take the first
        // choice. Clicks go through the page, so a popup that is partly off screen still advances.
        for (let n = 1; n <= 4; n++) {
          const modal = page.locator('.overlay .modal').first();
          if (!(await modal.waitFor({ timeout: 4000 }).then(() => true, () => false))) break;
          const keep = modal.locator('button', { hasText: 'Keep fleet' });
          if (await keep.count()) await page.locator('.overlay button:not([disabled])', { hasText: 'Keep fleet' }).waitFor({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(600); // let cards and dice finish arriving
          const title = (await modal.locator('h2').textContent())?.trim() ?? `popup ${n}`;
          const pop = await modal.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const hidden = [...el.querySelectorAll('button, .qcard')].filter((t) => {
              const b = t.getBoundingClientRect();
              return b.bottom > innerHeight + 1 || b.right > innerWidth + 1 || b.top < -1 || b.left < -1;
            });
            const label = (t: Element) => (t.matches('.qcard') ? `card ${t.querySelector('h3, .qcard-name')?.textContent ?? ''}`.trim() : t.textContent!.trim());
            return { wide: r.right > innerWidth + 1 || r.left < -1, hidden: hidden.map(label) };
          });
          await page.screenshot({ path: `${OUT}/${name}-popup${n}.png` });
          if (pop.wide) issues.push(`"${title}" wider than the screen`);
          if (pop.hidden.length) issues.push(`"${title}": ${pop.hidden.map((t) => `"${t}"`).join(', ')} off screen`);
          await modal.evaluate((el) => {
            const keepBtn = [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('Keep fleet'));
            (keepBtn ?? (el.querySelector('.qcard') as HTMLElement | null))?.click();
          });
          await page.waitForTimeout(800);
        }
        await page.waitForTimeout(700);

        const m = await page.evaluate(() => {
          const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
          const board = rect('.board');
          const stage = rect('.stage');
          return {
            cell: parseFloat((document.querySelector('.board') as HTMLElement).style.getPropertyValue('--cell')),
            pageWidth: window.innerWidth,
            pageHeight: document.scrollingElement!.scrollHeight,
            overflowsStage: board.width > stage.width + 1 || board.height > stage.height + 1,
            // You never scroll to act: End turn (or, on someone else's turn, the turn panel's head) is on screen.
            turnBarOnScreen: (() => {
              const el = document.querySelector('.turn-panel .btn-primary') ?? document.querySelector('.turn-panel .turn-head');
              const r = el!.getBoundingClientRect();
              return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1;
            })(),
          };
        });
        if (m.pageWidth > screen.width) issues.push(`page ${m.pageWidth}px wide on a ${screen.width}px screen`);
        if (m.overflowsStage) issues.push('board overflows its stage');
        if (!m.turnBarOnScreen) issues.push('turn panel (End turn) off screen');
        await page.screenshot({ path: `${OUT}/${name}.png` });
        console.log(`${name.padEnd(36)} cell ${String(m.cell).padStart(3)}px  page ${m.pageWidth}×${m.pageHeight}  ${issues.length ? '✗ ' + issues.join('; ') : '✓'}`);
        problems.push(...issues.map((i) => `${name}: ${i}`));
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    await server?.close();
  }

  console.log(`\nScreenshots in ${OUT}/`);
  if (problems.length) {
    console.log(`${problems.length} layout problem${problems.length > 1 ? 's' : ''}.`);
    process.exit(1);
  }
}

void main();
