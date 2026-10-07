/** What the phone scripts (mobile-shots, mobile-play, pwa-check) share: the test phone, flags, server and browser. */
import { chromium, devices, type BrowserContextOptions } from 'playwright';
import { createServer } from 'vite';

/** The user's Moto G55: 1080×2400 at a device pixel ratio of 2.625, minus Chrome's and Android's bars. */
const g55 = { userAgent: devices['Pixel 7'].userAgent, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };
export const MOTO_G55: BrowserContextOptions = { ...g55, viewport: { width: 412, height: 800 } };
export const MOTO_G55_LANDSCAPE: BrowserContextOptions = { ...g55, viewport: { width: 867, height: 340 } };

/** The value after `--name` on the command line. */
export const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};

/** The app to test: `--url`, or a dev server of our own on `port`. */
export async function devServer(port: number): Promise<{ base: string; close: () => Promise<void> }> {
  const url = arg('--url');
  if (url) return { base: url, close: async () => {} };
  const server = await createServer({ root: 'apps/web', server: { port, host: '127.0.0.1' } });
  await server.listen();
  return { base: server.resolvedUrls!.local[0], close: () => server.close() };
}

/**
 * The installed Google Chrome, so Playwright needs no browser download. `--no-proxy-server` skips
 * Chrome's proxy auto-detection, which otherwise costs 12 s on every page.
 */
export const launchChrome = () => chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
