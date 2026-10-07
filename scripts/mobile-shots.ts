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
 * Screenshots go to test-results/mobile/ (the game, each setup popup as `-popupN`, and your first turn
 * with a ship selected as `-turn`). Exits with 1 when a layout is broken: the board wider or taller
 * than its stage, a page wider than the screen (the phone then zooms the page out), a setup popup
 * whose buttons or cards are off screen without scrolling, or something you'd have to scroll to (or
 * that is covered) while placing your ships or on your turn, or the turn bar over the board.
 * Then each device opens the in-game popups (`-combat`, `-changeOfHeart`, `-over`, `-rules`, see
 * POPUPS): the popup must fit the screen, and its buttons must be on screen without scrolling inside
 * it (Change of Heart and the rules scroll their content, so only their heading and × must show).
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices, webkit, type BrowserContextOptions, type Page } from 'playwright';
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

/**
 * The in-game popups, opened through the dev link's `scene` (the rules from the topbar on your turn). `must` lists
 * what has to be on screen without scrolling inside the popup.
 */
const POPUPS = [
  { name: 'combat', play: 'community', scene: 'combat', must: '.combat-card h2, .combat-total, .combat-card button' },
  { name: 'changeOfHeart', play: 'community', scene: 'changeOfHeart', must: '.modal h2, .modal .qcard:first-child' },
  { name: 'over', play: 'basic', scene: 'over', must: '.modal h2, .modal button' },
  { name: 'rules', play: 'basic', scene: 'turn', must: '.dialog > h2, .dialog-close' },
];

const OUT = 'test-results/mobile';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};

/**
 * Lists the shown elements matching `sel` that are off screen or under something from outside their
 * panel (neighbouring 3D dice overlap a little, which doesn't count).
 */
function unreachable(page: Page, sel: string): Promise<string[]> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return []; // not shown at this size
      const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim() || 'ship';
      if (r.top < -1 || r.left < -1 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1) return [`"${label}" off screen`];
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && (el.closest('.panel') ?? el).contains(hit) ? [] : [`"${label}" covered by ${hit?.className}`];
    });
  }, sel);
}

/**
 * Plays the human's setup (start planet, ship placement) and waits through the AI until it's the human's
 * turn, then selects a ship. Checks the ships to place and, at the turn, End turn and the ship's buttons.
 */
async function playToMyTurn(page: Page) {
  const issues: string[] = [];
  let deployChecked = false;
  let myTurn = false;
  for (let i = 0; i < 150 && !myTurn; i++) {
    await page.waitForTimeout(400);
    if (!deployChecked && (await page.locator('.turn-scrap .scrap-die.clickable').count())) {
      deployChecked = true;
      // The turn bar's scrapyard below 980px, the player list's on the desktop layout (the sidebar may scroll there).
      if (await page.locator('.turn-scrap').isVisible()) {
        issues.push(...(await unreachable(page, '.turn-scrap .scrap-die.clickable')).map((t) => `placing ships: ${t}`));
      }
    }
    const step = await page.evaluate(() => {
      const modal = document.querySelector('.overlay .modal');
      if (modal) {
        const keep = [...modal.querySelectorAll('button:not([disabled])')].find((b) => b.textContent!.includes('Keep'));
        ((keep ?? modal.querySelector('.qcard') ?? modal.querySelector('.btn-primary:not([disabled])')) as HTMLElement | null)?.click();
        return 'modal';
      }
      if (document.querySelector('.turn-actions .btn-primary:not([disabled])')) return 'mine';
      const target = document.querySelector('.planet-label')?.closest('.planet-hit') ?? document.querySelector('.hl') ?? document.querySelector('.turn-scrap .scrap-die.clickable');
      (target as HTMLElement | null)?.click();
      return 'wait';
    });
    myTurn = step === 'mine';
  }
  if (!myTurn) return { issues, deployChecked, myTurn };
  await page.evaluate(() => (document.querySelector('.ship.own') as HTMLElement | null)?.click());
  await page.waitForTimeout(500);
  issues.push(...(await unreachable(page, '.turn-actions .btn-primary, .turn-panel .ship-panel button')).map((t) => `your turn: ${t}`));
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('.board')!.getBoundingClientRect();
    const b = document.querySelector('.turn-panel')!.getBoundingClientRect();
    return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) * (Math.min(a.right, b.right) > Math.max(a.left, b.left) ? 1 : 0);
  });
  if (overlap > 2) issues.push(`your turn: turn bar covers ${Math.round(overlap)}px of the board`);
  return { issues, deployChecked, myTurn };
}

/** Opens each of POPUPS on a new page and lists what doesn't fit. */
async function checkPopups(newPage: () => Promise<Page>, base: string, device: string): Promise<string[]> {
  const issues: string[] = [];
  for (const pop of POPUPS) {
    const page = await newPage();
    await page.goto(`${base}?play=${pop.play}&players=2&seed=1&scene=${pop.scene}`);
    await page.waitForSelector('.board');
    if (pop.name === 'rules') await page.locator('.topbar button', { hasText: 'Rules' }).evaluate((b: HTMLElement) => b.click());
    const box = page.locator('.overlay .modal, .overlay .combat-card').first();
    if (!(await box.waitFor({ timeout: 5000 }).then(() => true, () => false))) {
      issues.push(`${pop.name}: never opened`);
      await page.context().close();
      continue;
    }
    await page.waitForTimeout(2000); // the battle reveals its totals and buttons after 1.25 s
    await page.screenshot({ path: `${OUT}/${device}-${pop.name}.png` });
    const found = await box.evaluate((el, must) => {
      const b = el.getBoundingClientRect();
      const out: string[] = [];
      if (b.top < -1 || b.left < -1 || b.bottom > innerHeight + 1 || b.right > innerWidth + 1) out.push(`${Math.round(b.width)}×${Math.round(b.height)} box, larger than the screen`);
      const top = Math.max(0, b.top), bottom = Math.min(innerHeight, b.bottom), left = Math.max(0, b.left), right = Math.min(innerWidth, b.right);
      const items = [...el.querySelectorAll(must)];
      if (!items.length) out.push(`nothing matches ${must}`);
      for (const t of items) {
        const r = t.getBoundingClientRect();
        if (r.top < top - 1 || r.bottom > bottom + 1 || r.left < left - 1 || r.right > right + 1) {
          out.push(`"${(t.getAttribute('aria-label') ?? t.textContent ?? '').trim().slice(0, 30)}" off screen`);
        }
      }
      return out;
    }, pop.must);
    issues.push(...found.map((t) => `${pop.name}: ${t}`));
    await page.context().close();
  }
  return issues;
}

async function main() {
  const server = arg('--url') ? null : await createServer({ root: 'apps/web', server: { port: 5180, host: '127.0.0.1' } });
  await server?.listen();
  const base = arg('--url') ?? server!.resolvedUrls!.local[0];
  const browser = process.argv.includes('--webkit') ? await webkit.launch() : await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
  mkdirSync(OUT, { recursive: true });

  const problems: string[] = [];
  try {
    // Devices run side by side (each plays its games in turn); results print in the usual order.
    const results = await Promise.all(Object.entries(DEVICES).map(async ([device, options]) => {
      const lines: string[] = [];
      for (const g of GAMES) {
        const ctx = await browser.newContext({ ...options, ignoreHTTPSErrors: true }); // dev:https is self-signed
        // As if the player has zoomed before, so the start-of-game zoom demo doesn't play while the board is measured.
        await ctx.addInitScript(() => localStorage.setItem('quantum.zoomLearned', '1'));
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
        await page.screenshot({ path: `${OUT}/${name}.png` });

        const m = await page.evaluate(() => {
          const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
          const board = rect('.board');
          const stage = rect('.stage');
          return {
            cell: parseFloat((document.querySelector('.board') as HTMLElement).style.getPropertyValue('--cell')),
            pageWidth: window.innerWidth,
            pageHeight: document.scrollingElement!.scrollHeight,
            overflowsStage: board.width > stage.width + 1 || board.height > stage.height + 1,
          };
        });
        if (m.pageWidth > screen.width) issues.push(`page ${m.pageWidth}px wide on a ${screen.width}px screen`);
        if (m.overflowsStage) issues.push('board overflows its stage');

        // Play on to your first turn: you never scroll to act. Placing your ships, then with a ship
        // selected, everything you tap is on screen and not under anything, and the turn bar doesn't
        // cover the board.
        const turn = await playToMyTurn(page);
        if (!turn.deployChecked) issues.push('never had ships to place');
        if (!turn.myTurn) issues.push('never reached your turn');
        issues.push(...turn.issues);
        await page.screenshot({ path: `${OUT}/${name}-turn.png` });
        lines.push(`${name.padEnd(36)} cell ${String(m.cell).padStart(3)}px  page ${m.pageWidth}×${m.pageHeight}  ${issues.length ? '✗ ' + issues.join('; ') : '✓'}`);
        problems.push(...issues.map((i) => `${name}: ${i}`));
        await ctx.close();
      }
      const popIssues = await checkPopups(async () => (await browser.newContext({ ...options, ignoreHTTPSErrors: true })).newPage(), base, device);
      lines.push(`${`${device} popups`.padEnd(36)} ${POPUPS.map((p) => p.name).join(', ')}  ${popIssues.length ? '✗ ' + popIssues.join('; ') : '✓'}`);
      problems.push(...popIssues.map((i) => `${device}: ${i}`));
      return lines;
    }));
    console.log(results.flat().join('\n'));
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
