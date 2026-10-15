import { legalActions } from '../packages/engine/src';
import { devServer, launchChrome, playUrl } from './mobile-common';
const { base, close } = await devServer(5297);
const b = await launchChrome();
for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const page = await b.newPage({ viewport: vp });
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(playUrl(base, { play: 'classic', players: 3, scene: 'win' }));
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => window.__quantum.state());
  const c = legalActions(s).find((a) => a.type === 'conquer')!;
  await page.evaluate((a) => window.__quantum.dispatch(a as never), c);
  const t0 = Date.now();
  for (const t of [3600, 4400, 7000, 9300, 13000]) {
    const wait = t - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-softhook-Documents-GitHub-cubic/7e5dc571-e5c1-4a43-baaf-f33a1f27ea85/scratchpad/m-' + vp.width + '-' + t + '.png' });
  }
  console.log(vp.width, errs);
}
await b.close();
await close();
