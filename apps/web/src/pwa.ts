import { registerSW } from 'virtual:pwa-register';

/**
 * The service worker: the app works offline (against the AI) and opens fast from the home screen.
 *
 * An old build replaying an online game's log made by a newer one could desync, so a new version
 * goes live as soon as it can without interrupting anyone: straight away if it arrives just after the
 * app opened, otherwise the next time the app goes to the background (the reload happens unseen, and
 * the saved game resumes). The app checks for a new version each time it comes back to the foreground,
 * so it is never more than one resume behind.
 */
export function startServiceWorker() {
  const opened = Date.now();
  let waiting = false;
  let registration: ServiceWorkerRegistration | undefined;

  const update = registerSW({
    onRegisteredSW(_url, r) {
      registration = r;
    },
    onNeedRefresh() {
      waiting = true;
      if (document.hidden || Date.now() - opened < 10_000) void update(true);
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (waiting) void update(true);
    } else if (navigator.onLine) {
      void registration?.update().catch(() => {}); // offline or the server unreachable: try next time
    }
  });
}
