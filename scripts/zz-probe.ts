import type { Page, BrowserContextOptions } from 'playwright';
import type { GameState } from '../packages/engine/src';
import { devServer, launchChrome, MOTO_G55, MOTO_G55_LANDSCAPE, playUrl } from './mobile-common';

const { base, close } = await devServer(5199);
const browser = await launchChrome();
const size = (p: Page) => p.evaluate(() => { const b = document.querySelector('.board')!.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; });
async function run(name: string, ctx: BrowserContextOptions, collapsed: string) {
  const c = await browser.newContext(ctx);
  const page = await c.newPage();
  await page.goto(base);
  await page.evaluate((v) => { localStorage.clear(); localStorage.setItem('quantum.logOpen', '1'); localStorage.setItem('quantum.marketCollapsed', v); }, collapsed);
  await page.goto(playUrl(base, { play: 'community', players: 3, seed: 7 }));
  await page.waitForFunction(() => '__quantum' in window);
  await page.evaluate(() => { const s = structuredClone(window.__quantum.state()) as GameState; s.players.forEach((p) => (p.ai = true)); window.__quantum.load(s); });
  await page.waitForFunction(() => window.__quantum.state().log.length >= 50, null, { timeout: 180000 });
  const sheet = await page.locator('.sheet-handle').count();
  if (sheet) { await page.tap('.sheet-handle'); await page.waitForTimeout(400); if (await page.locator('.log-toggle[aria-expanded="false"]').count()) await page.tap('.log-toggle'); }
  const first = page.locator('.log li button').first();
  await first.scrollIntoViewIfNeeded();
  await (sheet ? first.tap() : first.click());
  await page.waitForTimeout(500);
  const seen: string[] = [];
  for (let i = 0; i < 60 && (await page.locator('.review-bar').count()); i++) {
    seen.push(await size(page));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
  }
  const changes = seen.filter((s, i) => i && s !== seen[i - 1]).length;
  console.log(`${name} collapsed=${collapsed}: ${seen.length} steps, ${changes} size changes, sizes ${[...new Set(seen)].join(' ')}`);
  await c.close();
}
try {
  for (const w of [1440, 1100]) for (const col of ['0', '1']) await run(`desktop ${w}`, { viewport: { width: w, height: 860 } }, col);
  await run('tablet 900', { viewport: { width: 900, height: 1100 } }, '0');
  await run('phone', MOTO_G55, '1');
  await run('phone landscape', MOTO_G55_LANDSCAPE, '1');
} finally { await browser.close(); await close(); }
